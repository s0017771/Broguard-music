// 프로듀싱 스튜디오 E2E — 설계 → 드럼·베이스 생성 → 조합 → 저장
// 실행: node tests/studio-app-e2e.test.mjs
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
const ok = n => console.log('ok - ' + n);
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + e.message); };

await page.goto(`${base}/studio.html`, { waitUntil: 'domcontentloaded' });

await (async () => { try {
  await page.fill('#title', '리듬 습작'); await page.selectOption('#genre', 'pop'); await page.fill('#seed', '7');
  await page.click('#btnPlan');
  await page.waitForSelector('#drumCard', { state: 'visible' });
  const sum = await page.textContent('#summary');
  assert.ok(/템포/.test(sum) && /BPM/.test(sum), '요약 표시: ' + sum);
  assert.ok(/코드 진행/.test(await page.textContent('#chords')), '코드 진행 표시');
  assert.equal(await page.isVisible('#bassCard'), true, '베이스 카드');
  assert.equal(await page.isVisible('#mixCard'), true, '조합기 카드');
  ok('곡 설계 → 트랙·조합 카드 노출');
} catch (e) { bad('곡 설계', e); } })();

await (async () => { try {
  await page.selectOption('#drumStyle', '5');   // 포 온 더 플로어
  await page.click('#btnGenDrum');
  await page.waitForFunction(() => /드럼/.test(document.getElementById('drumStatus').textContent), undefined, { timeout: 4000 });
  assert.ok(/✓/.test(await page.textContent('#drumStatus')), '드럼 생성됨');
  assert.equal(await page.isEnabled('#btnRegenDrum'), true, '다시 생성 활성화');
  assert.equal(await page.isEnabled('#btnSoloDrum'), true, '솔로 활성화');
  ok('드럼 트랙 생성');
} catch (e) { bad('드럼 생성', e); } })();

await (async () => { try {
  await page.selectOption('#bassPattern', '1');  // 쿵짝
  await page.click('#btnGenBass');
  await page.waitForFunction(() => /베이스/.test(document.getElementById('bassStatus').textContent), undefined, { timeout: 4000 });
  assert.ok(/✓/.test(await page.textContent('#bassStatus')), '베이스 생성됨');
  ok('베이스 트랙 생성');
} catch (e) { bad('베이스 생성', e); } })();

await (async () => { try {
  await page.click('#btnMix');
  await page.waitForFunction(() => /합주 완성/.test(document.getElementById('mixStatus').textContent), undefined, { timeout: 5000 });
  const st = await page.textContent('#mixStatus');
  assert.ok(/드럼/.test(st) && /베이스/.test(st), '합주 요약: ' + st);
  assert.equal(await page.isEnabled('#btnSaveMix'), true, '.mid 저장 활성화');
  const hasSrc = await page.evaluate(() => (document.getElementById('mixPlayer').src || '').startsWith('blob:'));
  assert.ok(hasSrc, '조합 플레이어 src');
  ok('조합(합주) → 재생·저장 활성화');
} catch (e) { bad('조합', e); } })();

await (async () => { try {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveMix')
  ]);
  const bytes = readFileSync(await dl.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  assert.equal(bytes[9], 1, 'SMF 포맷 1(멀티트랙)');
  ok('.mid 저장(멀티트랙)');
} catch (e) { bad('.mid 저장', e); } })();

await (async () => { try {
  // 합주에서 베이스 빼면 요약에서 베이스가 빠진다
  await page.uncheck('#bassOn');
  await page.click('#btnMix');
  await page.waitForFunction(() => /합주 완성/.test(document.getElementById('mixStatus').textContent), undefined, { timeout: 5000 });
  const st = await page.textContent('#mixStatus');
  assert.ok(/드럼/.test(st) && !/베이스/.test(st), '베이스 제외 반영: ' + st);
  ok('트랙 On/Off가 합주에 반영');
} catch (e) { bad('트랙 On/Off', e); } })();

await (async () => { try {
  await page.check('#bassOn');
  await page.click('#btnSoloDrum');
  await page.waitForFunction(() => /트랙만 재생/.test(document.getElementById('mixStatus').textContent), undefined, { timeout: 4000 });
  ok('이 트랙만 듣기(솔로) 동작');
} catch (e) { bad('솔로', e); } })();

await (async () => { try { assert.deepEqual(errors, []); ok('심각한 JS 오류 없음'); } catch (e) { bad('JS 오류', e); } })();

await browser.close(); server.close();
console.log(fail ? `\n${fail}개 실패` : '\n프로듀싱 스튜디오 E2E 전체 통과');
process.exit(fail ? 1 : 0);
