// 피아노 교실 E2E — 실제 브라우저(Chromium)에서 practice.html 동작 확인
// 실행: node tests/practice-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html; charset=utf-8' };
const server = createServer((req, res) => {
  const path = join(root, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'text/plain' });
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

await page.goto(`${base}/practice.html`, { waitUntil: 'domcontentloaded' });

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  assert.equal(await page.getAttribute('header a', 'href'), 'index.html');
});

await check('내장곡 목록과 연습 시작 버튼이 있다', async () => {
  const opts = await page.$$eval('#songSel option', els => els.map(o => o.value));
  assert.ok(opts.includes('twinkle') && opts.includes('custom'), '내장곡 + 직접입력: ' + opts.join(','));
  assert.ok(await page.$('#startBtn'), '연습 시작 버튼');
});

await check('parseSong(테스트 훅)이 ABC를 음표로 파싱한다', async () => {
  const abc = 'X:1\nT:t\nM:4/4\nL:1/8\nK:C\n[V:RH] C2 E2 G2 c2 |';
  const n = await page.evaluate((a) => {
    const s = window.__practice.parseSong(a);
    return s && s.seq ? s.seq.filter(x => !x.rest).length : -1;
  }, abc);
  assert.equal(n, 4, '4음(C E G c) 파싱');
});

await check('다른 랩 → 연습 핸드오프: broguard_practice_abc를 읽어 직접입력에 채운다', async () => {
  const song = 'X:1\nT:handoff\nM:4/4\nL:1/8\nK:C\n[V:RH] G2 A2 B2 c2 |';
  await page.evaluate((s) => localStorage.setItem('broguard_practice_abc', s), song);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('songSel').value === 'custom', undefined, { timeout: 5000 });
  const val = await page.inputValue('#abcInput');
  assert.ok(val.includes('handoff'), '넘어온 곡이 채워짐: ' + val.slice(0, 30));
  const leftover = await page.evaluate(() => localStorage.getItem('broguard_practice_abc'));
  assert.equal(leftover, null, '핸드오프 키 소비됨');
});

await check('심각한 JS 오류가 없다 (abcjs 미로딩 환경 포함)', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n피아노 교실 E2E 전체 통과');
process.exit(failures ? 1 : 0);
