// MIDI 드럼 병합(1단계) E2E — 실제 브라우저에서 merge.html 동작 확인
// 실행: node tests/merge-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// 멜로디 MIDI 바이트를 Node에서 미리 생성(ABC↔MIDI 코어 사용)
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

await check('autotest: 샘플 드럼 분석 성공(드럼 감지·PPQ 220·4마디)', async () => {
  const r = await page.evaluate(() => window.__autotest);
  assert.ok(r.ok, r.error || '');
  assert.equal(r.hasDrums, true);
  assert.equal(r.ppq, 220);
  assert.equal(r.bars, 4);
  assert.equal(r.drumTrack, true);
});

await check('샘플 불러오기 → 분석 표와 재생 카드가 표시된다', async () => {
  await page.goto(`${base}/merge.html`, { waitUntil: 'domcontentloaded' });
  await page.click('#btnSample');
  await page.waitForSelector('#infoBox table.info', { timeout: 3000 });
  const info = await page.textContent('#infoBox');
  assert.ok(info.includes('드럼'), '드럼 표기');
  assert.ok(info.includes('PPQ 220'), 'PPQ 표시');
  assert.ok(info.includes('킥') && info.includes('스네어'), 'GM 드럼 이름');
  assert.ok(await page.isVisible('#playCard'), '재생 카드 표시');
});

await check('멜로디 MIDI 업로드 → 멜로디로 분석(드럼 아님)', async () => {
  await page.setInputFiles('#midiFile', { name: 'melody.mid', mimeType: 'audio/midi', buffer: melodyBytes });
  await page.waitForFunction(() => /PPQ 480/.test(document.getElementById('infoBox').textContent), undefined, { timeout: 3000 });
  const info = await page.textContent('#infoBox');
  assert.ok(info.includes('멜로디'));
  assert.ok(!info.includes('드럼 포함'), '드럼으로 오인하지 않음');
});

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  assert.equal(await page.getAttribute('header a.home', 'href'), 'index.html');
});

await check('심각한 JS 오류가 없다(재생기 미로드 허용)', async () => {
  // html-midi-player CDN은 샌드박스에서 차단되지만 페이지 자체 오류는 없어야 함
  const real = errors.filter(e => !/midi-player|magenta|tone|Failed to fetch|Loading/.test(e));
  assert.deepEqual(real, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nMIDI 병합 1단계 E2E 전체 통과');
process.exit(failures ? 1 : 0);
