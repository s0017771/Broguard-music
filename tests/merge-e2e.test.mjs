// MIDI 드럼 병합(2단계) E2E — 실제 브라우저에서 merge.html 동작 확인
// 실행: node tests/merge-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tmp = mkdtempSync(join(tmpdir(), 'merge-e2e-'));
writeFileSync(join(tmp, 'abcmidi.cjs'), readFileSync(join(root, 'midi.html'), 'utf8').match(/<script id="abcmidi-core">([\s\S]*?)<\/script>/)[1]);
const AbcMidi = require(join(tmp, 'abcmidi.cjs'));
const melodyBytes = Buffer.from(AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nC2 E2 G2 c2 | G2 E2 C2 z2 |'));

const server = createServer((req, res) => {
  const path = join(root, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': extname(path) === '.html' ? 'text/html; charset=utf-8' : 'text/plain' });
  res.end(readFileSync(path));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failures++; console.error(`NOT OK - ${name}\n  ${e.message}`); }
}
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${base}/merge.html?autotest=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__autotestDone === true, { timeout: 6000 });

await check('autotest: 샘플 멜로디+드럼 병합 성공(PPQ 480·멜로디/드럼 트랙)', async () => {
  const r = await page.evaluate(() => window.__autotest);
  assert.ok(r.ok, r.error || '');
  assert.equal(r.mergedPpq, 480);
  assert.equal(r.hasDrums, true);
  assert.ok(r.melCh, '멜로디 트랙 존재');
  assert.ok(r.drumCh, '드럼 트랙 존재');
});

await page.goto(`${base}/merge.html`, { waitUntil: 'domcontentloaded' });

await check('샘플 멜로디·드럼 버튼 → 각 슬롯 분석 표시', async () => {
  await page.click('#btnSampleMel');
  await page.click('#btnSampleDrum');
  await page.waitForFunction(() => /PPQ/.test(document.getElementById('infoMel').textContent) && /PPQ/.test(document.getElementById('infoDrum').textContent), undefined, { timeout: 3000 });
  assert.ok((await page.textContent('#infoMel')).includes('멜로디'));
  const drumInfo = await page.textContent('#infoDrum');
  assert.ok(drumInfo.includes('드럼'), '드럼 표시');
  assert.ok(drumInfo.includes('220'), '드럼 PPQ 220');
});

await check('둘 다 있으면 "함께 재생" 버튼이 활성화된다', async () => {
  assert.equal(await page.isEnabled('#btnPlayBoth'), true);
  assert.equal(await page.isEnabled('#playMel'), true);
  assert.equal(await page.isEnabled('#playDrum'), true);
});

await check('함께 재생 → 병합 정합 정보(PPQ 480·멜로디+드럼) 표시', async () => {
  await page.click('#btnPlayBoth');
  await page.waitForFunction(() => /PPQ 480/.test(document.getElementById('mergeInfo').textContent), undefined, { timeout: 3000 });
  const info = await page.textContent('#mergeInfo');
  assert.ok(info.includes('멜로디') && info.includes('드럼'));
  assert.ok(await page.isVisible('#playerWrap'), '플레이어 표시');
});

await check('파일 업로드(멜로디 슬롯) → 멜로디로 분석', async () => {
  await page.setInputFiles('#fileMel', { name: 'my-melody.mid', mimeType: 'audio/midi', buffer: melodyBytes });
  await page.waitForFunction(() => /PPQ 480/.test(document.getElementById('infoMel').textContent), undefined, { timeout: 3000 });
  assert.ok((await page.textContent('#infoMel')).includes('멜로디'));
});

await check('길이 정합 옵션(그대로/반복) 선택 가능', async () => {
  const opts = await page.$$eval('#loopOpt option', els => els.map(e => e.value));
  assert.deepEqual(opts, ['asis', 'loop']);
});

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  assert.equal(await page.getAttribute('header a.home', 'href'), 'index.html');
});

await check('심각한 JS 오류가 없다(재생기 미로드 허용)', async () => {
  const real = errors.filter(e => !/midi-player|magenta|tone|Failed to fetch|Loading|soundfont/i.test(e));
  assert.deepEqual(real, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nMIDI 병합 2단계 E2E 전체 통과');
process.exit(failures ? 1 : 0);
