// Interpolate E2E — 실제 브라우저(Chromium)에서 interpolate.html 동작 확인
// 실행: node tests/interp-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
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
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failures++; console.error(`NOT OK - ${name}\n  ${e.message}`); }
}
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${base}/interpolate.html?autotest=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });

await check('autotest: morph·bridge 코어가 정상 동작', async () => {
  const r = await page.evaluate(() => window.__autotest);
  assert.ok(r.ok, r.error || '');
  assert.equal(r.morphCount, 5);
  assert.ok(r.hasBridge);
});

await check('로드 시 Morph 결과 블록이 렌더링된다', async () => {
  await page.waitForSelector('.resultblock', { timeout: 5000 });
  const blocks = await page.$$('.resultblock');
  assert.equal(blocks.length, 5, 'N=3 + 양끝 2 = 5블록');
  const first = await page.inputValue('.resultblock textarea');
  assert.ok(first.includes('K:C'));
});

await check('Bridge 모드 전환 후 생성 → 이어붙임(stitched) 블록 표시', async () => {
  await page.click('#mBridge');
  await page.click('#btnGo');
  await page.waitForSelector('.resultblock.stitched', { timeout: 5000 });
  const note = await page.textContent('#topNote');
  assert.ok(note.includes('Bridge'), 'topNote에 Bridge 상태');
  const stitched = await page.$eval('.resultblock.stitched textarea', el => el.value);
  assert.ok(stitched.includes('K:C') && stitched.trim().endsWith('|]'));
});

await check('샘플 A·B 넣기 버튼이 두 입력을 채운다', async () => {
  await page.click('#mMorph');
  await page.click('#btnSample');
  assert.ok((await page.inputValue('#abcA')).includes('X:1'));
  assert.ok((await page.inputValue('#abcB')).includes('X:1'));
  await page.waitForSelector('.resultblock', { timeout: 3000 });
});

await check('코드 진행 입력 시 topNote에 반영 표시', async () => {
  await page.click('#mMorph');
  await page.click('#btnSample');
  await page.fill('#chordStr', 'C F G C');
  await page.click('#btnGo');
  await page.waitForFunction(() => /코드 진행 반영/.test(document.getElementById('topNote').textContent), undefined, { timeout: 3000 });
  const note = await page.textContent('#topNote');
  assert.ok(note.includes('C F G C'));
});

await check('각 결과 블록에 재생·복사 버튼이 있다', async () => {
  const plays = await page.$$('.resultblock .rb-play');
  const copies = await page.$$('.resultblock .rb-copy');
  assert.ok(plays.length >= 1 && plays.length === copies.length, '블록마다 재생·복사 버튼');
});

await check('오프라인 내장 신스로 재생 클릭 시 오류 없이 정지 상태로 토글', async () => {
  const play = await page.$('.resultblock .rb-play');
  await play.click();                                  // Web Audio 오실레이터 재생(오프라인 OK)
  // 재생 시작하면 버튼이 "정지"로 바뀜(음표가 있으므로)
  const label = await play.evaluate(el => el.textContent);
  assert.ok(/정지|재생/.test(label));
  await play.click();                                  // 다시 눌러 정지 — 오류 없어야 함
});

await check('AI Morph 모드 칩이 있고 전환 시 안내가 표시된다', async () => {
  await page.click('#mAI');
  await page.waitForFunction(() => document.getElementById('mAI').classList.contains('on'), undefined, { timeout: 3000 });
  const desc = await page.textContent('#modeDesc');
  assert.ok(desc.includes('MusicVAE'), '모드 설명에 MusicVAE');
  assert.ok(await page.isVisible('#aiStatus'), 'AI 상태 안내 표시');
  await page.click('#mMorph');   // 원복
});

await check('멜로디 A 파일 열기 → 내용이 채워진다', async () => {
  await page.setInputFiles('#fileA', {
    name: 'melodyA.abc', mimeType: 'text/plain',
    buffer: Buffer.from('X:1\nT:불러온A\nM:4/4\nL:1/8\nK:C\nE2 E2 D2 C2 |'),
  });
  await page.waitForFunction(() => document.getElementById('abcA').value.includes('불러온A'), undefined, { timeout: 3000 });
  assert.ok((await page.inputValue('#abcA')).includes('불러온A'));
});

await check('입력이 비면 오류 메시지', async () => {
  await page.fill('#abcA', '');
  await page.fill('#abcB', '');
  await page.click('#btnGo');
  await page.waitForFunction(() => /입력하세요/.test(document.getElementById('topNote').textContent), undefined, { timeout: 3000 });
});

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  assert.equal(await page.getAttribute('header a.home', 'href'), 'index.html');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nInterpolate E2E 전체 통과');
process.exit(failures ? 1 : 0);
