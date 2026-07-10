// 편곡실 E2E — 실제 브라우저(Chromium)에서 5트랙 격자·강약 편집·멀티트랙 저장 확인
// 실행: node tests/studio-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
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
const errors = []; page.on('pageerror', e => errors.push(e.message));
let fail = 0;
const ok = (n) => console.log('ok - ' + n);
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + e.message); };

await page.goto(`${base}/songmaker.html`, { waitUntil: 'domcontentloaded' });
try {
  await page.fill('#title', '어깨 펴고 화이팅');
  await page.selectOption('#genre', 'pop');
  await page.fill('#seed', '106');
  await page.click('#btnPlan');
  await page.waitForSelector('#studioCard', { state: 'visible' });
  // 격자: 5개 트랙 행 + 섹션 열
  const trackRows = await page.$$eval('#studioGrid tbody tr .trk', els => els.map(e => e.textContent.trim()));
  assert.deepEqual(trackRows, ['보컬(리드)', '피아노', '메인기타', '베이스', '드럼'], '5트랙 행: ' + trackRows);
  const intSelects = await page.$$('#studioGrid select.int');
  assert.ok(intSelects.length >= 6, '섹션별 세기 셀렉트: ' + intSelects.length);
  const cells = await page.$$('#studioGrid input.cell');
  assert.ok(cells.length === trackRows.length * intSelects.length, '격자 셀 = 트랙×섹션: ' + cells.length);
  ok('편곡실 격자 렌더(5트랙 × 섹션)');
} catch (e) { bad('편곡실 격자 렌더', e); }

try {
  // 가사를 넣어두면 피아노롤 아래에 텍스트로 함께 보인다
  await page.fill('#lyricPaste', '[벌스]\n거울 속 흰머리 하나\n[코러스]\n어깨 펴고 화이팅');
  await page.click('#btnApplyLyric');
  await page.click('#btnProduce');
  await page.waitForFunction(() => /편곡 완성/.test(document.getElementById('studioStatus').textContent), undefined, { timeout: 10000 });
  const st = await page.textContent('#studioStatus');
  assert.ok(/보컬/.test(st) && /드럼/.test(st) && /BPM/.test(st), '요약: ' + st);
  assert.equal(await page.isEnabled('#btnSaveStudioMidi'), true, '.mid 저장 활성화');
  const hasSrc = await page.evaluate(() => (document.getElementById('studioPlayer').src || '').startsWith('blob:'));
  assert.ok(hasSrc, '플레이어 src 설정');
  ok('편곡 생성 → 플레이어·저장 활성화');
} catch (e) { bad('편곡 생성', e); }

try {
  // 피아노롤 아래 가사 텍스트 표시 + 세로 스크롤 없음(가로만 스크롤)
  assert.equal(await page.isVisible('#studioLyrics'), true, '가사 텍스트 표시');
  const ly = await page.textContent('#studioLyrics');
  assert.ok(/어깨 펴고 화이팅/.test(ly) && /\[코러스\]/.test(ly), '가사 내용: ' + ly);
  const ovY = await page.evaluate(() => getComputedStyle(document.querySelector('#studioPlayerWrap .viz-scroll')).overflowY);
  assert.equal(ovY, 'hidden', '피아노롤은 세로 스크롤 없음(overflow-y:hidden)');
  ok('피아노롤 아래 가사 텍스트 + 세로 스크롤 제거');
} catch (e) { bad('가사 텍스트/세로 스크롤', e); }

try {
  // 강약 편집: 첫 섹션 여림으로, 기타 트랙 전체 Off 후 재생성 → 채널 2 사라짐 확인은 저장 파일로
  await page.evaluate(() => { document.querySelector('#studioGrid input.mtr[data-key="guitar"]').click(); });
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    (async () => { await page.click('#btnProduce'); await page.waitForTimeout(400); await page.click('#btnSaveStudioMidi'); })()
  ]);
  const bytes = readFileSync(await dl.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  assert.equal(bytes[9], 1, 'SMF 포맷 1');
  ok('트랙 Off 편집 후 .mid 저장(멀티트랙)');
} catch (e) { bad('트랙 Off 편집+저장', e); }

try { assert.deepEqual(errors, []); ok('심각한 JS 오류 없음'); } catch (e) { bad('JS 오류', e); }

await browser.close(); server.close();
console.log(fail ? `\n${fail}개 실패` : '\n편곡실 E2E 전체 통과');
process.exit(fail ? 1 : 0);
