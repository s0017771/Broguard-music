// E2E 테스트 — 실제 브라우저(Chromium)에서 tab.html 동작 확인
// 실행: node tests/e2e.test.mjs
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

// 1) 페이지 로드 + 샘플 자동 변환(autotest 훅)
await page.goto(`${base}/tab.html?autotest=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });

await check('샘플 자동 변환으로 6줄 타브가 출력된다', async () => {
  const tab = await page.textContent('#tabOut');
  assert.ok(tab.includes('학교종'), '제목 포함');
  for (const s of ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']) assert.ok(tab.includes(s), s + ' 줄 존재');
  assert.ok(/\d/.test(tab), '프렛 숫자 존재');
});

await check('복사/저장 버튼이 활성화된다', async () => {
  assert.equal(await page.isEnabled('#btnCopy'), true);
  assert.equal(await page.isEnabled('#btnSave'), true);
});

// 2) 사용자가 직접 붙여넣고 변환 버튼 클릭
await page.goto(`${base}/tab.html`, { waitUntil: 'domcontentloaded' });
await check('ABC 붙여넣기 → 변환 버튼 → 타브 출력', async () => {
  await page.fill('#abcIn', 'X:1\nT:E2E 테스트곡\nM:3/4\nL:1/4\nK:G\n"G"G A B | "C"c B A | "G"G3 |');
  await page.click('#btnConvert');
  const tab = await page.textContent('#tabOut');
  assert.ok(tab.includes('E2E 테스트곡'));
  assert.ok(tab.includes('e|'));
});

await check('옵션 변경(카포) 시 자동 재변환', async () => {
  const before = await page.textContent('#tabOut');
  await page.selectOption('#optCapo', '3');
  await page.waitForFunction(
    prev => document.getElementById('tabOut').textContent !== prev, before, { timeout: 3000 });
  const after = await page.textContent('#tabOut');
  assert.ok(after.includes('카포 3프렛'));
});

await check('멀티보이스 입력 시 보이스 목록이 채워지고 LH 선택 가능', async () => {
  const sampleBtn = page.locator('#btnSample');
  await sampleBtn.click();
  await page.waitForFunction(() => document.querySelectorAll('#optVoice option').length >= 3, { timeout: 3000 });
  await page.selectOption('#optVoice', 'LH');
  await page.waitForFunction(() => /보이스 LH/.test(document.getElementById('metaLine').textContent), { timeout: 3000 });
});

await check('.txt 저장 버튼이 타브 내용을 다운로드한다', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSave'),
  ]);
  // 헤드리스 크로뮴은 한글 파일명을 'download'로 대체하므로 내용으로 검증
  const path = await download.path();
  const content = readFileSync(path, 'utf8');
  assert.ok(content.includes('e|') && content.includes('E|'), '다운로드 파일에 타브 내용 포함');
});

await check('쿵짝 베이스 켜면 낮은 줄에 베이스가 추가된다', async () => {
  await page.selectOption('#optBass', 'off');
  await page.fill('#abcIn', 'X:1\nT:베이스테스트곡\nM:4/4\nL:1/8\nK:C\n"C"G2 G2 A2 A2 | "G"G2 E2 D2 E2 |');
  await page.waitForFunction(() =>
    document.getElementById('tabOut').textContent.includes('베이스테스트곡'), undefined, { timeout: 5000 });
  await page.selectOption('#optBass', 'boomchick');
  await page.waitForFunction(() =>
    document.getElementById('tabOut').textContent.includes('쿵짝 베이스'), undefined, { timeout: 5000 });
  const tab = await page.textContent('#tabOut');
  const lines = tab.split('\n');
  const lowRows = lines.filter(l => /^[EA]\|/.test(l));
  assert.ok(lowRows.some(l => /\d/.test(l.slice(2))), '낮은 줄(E/A)에 베이스 숫자가 있어야 함');
  const meta = await page.textContent('#metaLine');
  assert.ok(meta.includes('쿵짝'), 'metaLine에 쿵짝 표시');
});

await check('빈 입력이면 버튼 비활성 + 안내 문구', async () => {
  await page.fill('#abcIn', '');
  await page.waitForFunction(() => document.getElementById('btnCopy').disabled === true, { timeout: 3000 });
  const tab = await page.textContent('#tabOut');
  assert.ok(tab.includes('변환 결과'));
});

await check('콘솔에 심각한 JS 오류가 없다', async () => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/tab.html?autotest=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nE2E 전체 통과');
process.exit(failures ? 1 : 0);
