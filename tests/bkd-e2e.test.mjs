// BKD 드럼 교실 E2E — 패드 렌더·키보드 타격·녹음·패턴 복사·미디 저장·레슨
// 실행: node tests/bkd-e2e.test.mjs
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
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
let fail = 0;
const ok = n => console.log('ok - ' + n);
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + e.message); };

await page.goto(`${base}/drum.html`, { waitUntil: 'domcontentloaded' });

await (async () => { try {
  const pads = await page.$$('#kit .pad');
  assert.equal(pads.length, 11, '11개 패드');
  const labels = await page.$$eval('#kit .pad .nm', els => els.map(e => e.textContent));
  ['스네어', '하이햇', '킥(베이스)', '라이드', '크래시'].forEach(n =>
    assert.ok(labels.some(l => l.includes(n.split('(')[0])), n + ' 패드'));
  const keys = await page.$$eval('#kit .pad .ky', els => els.map(e => e.textContent));
  assert.ok(keys.includes('D') && keys.includes('A') && keys.some(k => /Space/.test(k)), '키 라벨 표시');
  ok('드럼 킷 11패드 + 키 라벨 렌더');
} catch (e) { bad('킷 렌더', e); } })();

await (async () => { try {
  // 키보드 타격: D(스네어) → hit 클래스
  await page.keyboard.press('d');
  // hit는 90ms만 붙으므로 즉시 확인이 어려움 → 커스텀으로 감시
  const flashed = await page.evaluate(() => new Promise(res => {
    const el = document.getElementById('pad-snare');
    const mo = new MutationObserver(() => { if (el.classList.contains('hit')) { mo.disconnect(); res(true); } });
    mo.observe(el, { attributes: true });
    // 이벤트 직접 발생
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    setTimeout(() => res(el.classList.contains('hit')), 300);
  }));
  assert.ok(flashed, '스네어 패드 시각 반응');
  ok('키보드 타격(D=스네어) 시각 반응');
} catch (e) { bad('키보드 타격', e); } })();

await (async () => { try {
  // 녹음: 시작 → 키 타격 3번 → 종료 → 패턴 복사
  await page.click('#btnRec');
  await page.evaluate(() => new Promise(res => {
    const seq = [' ', 'd', ' '];   // 킥, 스네어, 킥
    let i = 0;
    const iv = setInterval(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: seq[i], bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: seq[i], bubbles: true }));
      if (++i >= seq.length) { clearInterval(iv); res(); }
    }, 120);
  }));
  await page.click('#btnRec');
  await page.waitForFunction(() => /녹음됨/.test(document.getElementById('recStatus').textContent), undefined, { timeout: 3000 });
  assert.equal(await page.isEnabled('#btnCopyPattern'), true, '패턴 복사 활성화');
  await page.click('#btnCopyPattern');
  await page.waitForFunction(() => /복사됨/.test(document.getElementById('exportStatus').textContent), undefined, { timeout: 3000 });
  const st = await page.textContent('#exportStatus');
  assert.ok(/[ks]/.test(st) && /직접 입력/.test(st), '패턴 문자열 안내: ' + st);
  ok('녹음 → 스튜디오 패턴 복사');
} catch (e) { bad('녹음·패턴 복사', e); } })();

await (async () => { try {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveMidi')
  ]);
  const bytes = readFileSync(await dl.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  ok('.mid 저장');
} catch (e) { bad('.mid 저장', e); } })();

await (async () => { try {
  // 레슨: 시범 시작 → 가이드 불(guide 클래스) 켜짐 → 정지
  await page.selectOption('#lessonSel', '0');
  await page.click('#btnLesson');
  await page.waitForFunction(() => document.querySelectorAll('#kit .pad.guide').length > 0, undefined, { timeout: 4000 });
  const hint = await page.textContent('#lessonHint');
  assert.ok(/킥/.test(hint), '레슨 힌트: ' + hint);
  await page.click('#btnLessonStop');
  await page.waitForFunction(() => document.querySelectorAll('#kit .pad.guide').length === 0, undefined, { timeout: 2000 });
  ok('레슨 시범(가이드 불) 시작·정지');
} catch (e) { bad('레슨', e); } })();

await (async () => { try { assert.deepEqual(errors, []); ok('심각한 JS 오류 없음'); } catch (e) { bad('JS 오류', e); } })();

await browser.close(); server.close();
console.log(fail ? `\n${fail}개 실패` : '\nBKD 드럼 교실 E2E 전체 통과');
process.exit(fail ? 1 : 0);
