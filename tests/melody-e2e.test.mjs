// Melody Maker E2E — 실제 브라우저(Chromium)에서 melody.html 동작 확인
// 실행: node tests/melody-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = join(root, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('not found'); return; }
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

await page.goto(`${base}/melody.html`, { waitUntil: 'domcontentloaded' });

await check('로드 시 기본 진행(캐논)으로 후보가 자동 생성된다', async () => {
  await page.waitForSelector('.card', { timeout: 5000 });
  const cards = await page.$$('.card');
  assert.ok(cards.length >= 1, '후보 카드가 하나 이상');
  const abc = await page.inputValue('#abc-0');
  assert.ok(abc.startsWith('X:'), 'ABC 텍스트가 채워짐');
  assert.ok(abc.includes('K:C'));
});

await check('메타 줄에 시도/선별/시드 정보가 표시된다', async () => {
  const meta = await page.textContent('#meta');
  assert.ok(/시도/.test(meta) && /시드/.test(meta), 'meta 정보 표시');
});

await check('코드 진행 변경 + 생성 버튼 → 새 후보 생성', async () => {
  const before = await page.inputValue('#abc-0');
  await page.fill('#chords', 'Am F C G Am F C G');
  await page.fill('#seed', '77');
  await page.click('#go');
  await page.waitForFunction(prev => {
    const t = document.getElementById('abc-0');
    return t && t.value !== prev;
  }, before, { timeout: 5000 });
  const after = await page.inputValue('#abc-0');
  assert.ok(after.startsWith('X:'));
  assert.notEqual(after, before);
});

await check('시드 고정 시 재생성해도 동일한 결과', async () => {
  await page.fill('#seed', '77');
  const first = await page.inputValue('#abc-0');
  await page.click('#go');
  await page.waitForTimeout(200);
  const second = await page.inputValue('#abc-0');
  assert.equal(second, first, '같은 시드 → 같은 ABC');
});

await check('모드 전환(전 전용) 후 생성 시 메타에 모드명이 반영된다', async () => {
  await page.click('#modes .mode-chip[data-m="jeon"]');
  await page.click('#go');
  await page.waitForFunction(() => /전 전용/.test(document.getElementById('meta').textContent), undefined, { timeout: 5000 });
  const meta = await page.textContent('#meta');
  assert.ok(meta.includes('전 전용'));
});

await check('16분음표 해상도 전환이 동작한다', async () => {
  await page.click('#resolution .mode-chip[data-r="16"]');
  await page.click('#modes .mode-chip[data-m="full"]');
  await page.fill('#seed', '21');
  await page.click('#go');
  await page.waitForFunction(() => /16분음표/.test(document.getElementById('meta').textContent), undefined, { timeout: 5000 });
  assert.ok((await page.textContent('#meta')).includes('16분음표'));
});

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  const href = await page.getAttribute('header a', 'href');
  assert.equal(href, 'index.html');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nMelody Maker E2E 전체 통과');
process.exit(failures ? 1 : 0);
