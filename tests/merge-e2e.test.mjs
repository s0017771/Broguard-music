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

await check('autotest: ABC→멜로디→기본드럼→병합 전 과정 성공', async () => {
  const r = await page.evaluate(() => window.__autotest);
  assert.ok(r.ok, r.error || '');
  assert.ok(r.melFromAbc, 'ABC→MIDI 변환');
  assert.ok(r.drumMade, '드럼 생성');
  assert.equal(r.mergedPpq, 480);
  assert.equal(r.hasDrums, true);
  assert.ok(r.canSave, '저장 버튼 활성화');
});

await page.goto(`${base}/merge.html`, { waitUntil: 'domcontentloaded' });

await check('샘플 멜로디(ABC) → 자동 MIDI 변환·분석', async () => {
  await page.click('#btnSampleMel');
  await page.waitForFunction(() => /멜로디/.test(document.getElementById('infoMel').textContent), undefined, { timeout: 3000 });
  assert.ok((await page.inputValue('#abcIn')).includes('X:1'), 'ABC 채워짐');
  assert.equal(await page.isEnabled('#btnBasic'), true, '드럼 버튼 활성화');
});

await check('기본 비트 생성 → 드럼 분석 표시(채널10·GM)', async () => {
  await page.click('#btnBasic');
  await page.waitForFunction(() => /드럼/.test(document.getElementById('infoDrum').textContent), undefined, { timeout: 3000 });
  const info = await page.textContent('#infoDrum');
  assert.ok(info.includes('킥') && info.includes('스네어'), 'GM 드럼');
  assert.ok((await page.textContent('#drumStatus')).includes('기본 비트'));
});

await check('🎲 다시 생성 → 패턴 변경', async () => {
  const before = await page.textContent('#infoDrum');
  await page.click('#btnRegen');
  await page.waitForFunction(prev => document.getElementById('infoDrum').textContent !== prev || /패턴 2/.test(document.getElementById('drumStatus').textContent), before, { timeout: 3000 });
  assert.ok((await page.textContent('#drumStatus')).match(/패턴 [23]/), '패턴 번호 변경');
});

await check('함께 재생 → 병합 정보 + 저장 버튼 활성화', async () => {
  await page.click('#btnPlayBoth');
  await page.waitForFunction(() => /PPQ 480/.test(document.getElementById('mergeInfo').textContent), undefined, { timeout: 3000 });
  assert.ok((await page.textContent('#mergeInfo')).includes('멜로디'));
  assert.ok(await page.isVisible('#playerWrap'));
  assert.equal(await page.isEnabled('#btnSave'), true, '저장 버튼');
});

await check('병합 .mid 저장 → 다운로드 발생(MThd)', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSave'),
  ]);
  const bytes = readFileSync(await download.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  assert.ok(download.suggestedFilename().endsWith('.mid'));
});

await check('멜로디 MIDI 파일 업로드도 동작', async () => {
  await page.setInputFiles('#fileMel', { name: 'my-melody.mid', mimeType: 'audio/midi', buffer: melodyBytes });
  await page.waitForFunction(() => /PPQ 480/.test(document.getElementById('infoMel').textContent), undefined, { timeout: 3000 });
  assert.ok((await page.textContent('#infoMel')).includes('멜로디'));
});

await check('AI 드럼 버튼 존재(오프라인은 기본 비트로 폴백)', async () => {
  assert.ok(await page.$('#btnAI'), 'AI 드럼 버튼');
  await page.click('#btnBasic');   // 멜로디 파일 업로드 후 드럼 재생성
  await page.waitForFunction(() => /드럼/.test(document.getElementById('infoDrum').textContent), undefined, { timeout: 3000 });
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
