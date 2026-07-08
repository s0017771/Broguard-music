// ABC↔MIDI 변환기 E2E — 실제 브라우저(Chromium)에서 midi.html 동작 확인
// 실행: node tests/midi-e2e.test.mjs
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

// autotest 훅으로 샘플 왕복 검증
await page.goto(`${base}/midi.html?autotest=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });

await check('페이지 로드 시 샘플 왕복(ABC→MIDI→ABC)이 성공한다', async () => {
  const r = await page.evaluate(() => window.__autotest);
  assert.ok(r.ok, '왕복 실패: ' + (r.error || ''));
  assert.ok(r.midiBytes > 20, 'MIDI 바이트 생성');
  assert.ok(r.noteCount > 0, '음표 복원');
  const out = await page.inputValue('#abcOut');
  assert.ok(out.includes('K:C') && out.trim().endsWith('|]'));
});

// ABC → MIDI 다운로드
await page.goto(`${base}/midi.html`, { waitUntil: 'domcontentloaded' });
await check('샘플 → MIDI로 변환·저장 버튼이 .mid 다운로드를 발생시킨다', async () => {
  await page.click('#btnSample');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnToMidi'),
  ]);
  const path = await download.path();
  const bytes = readFileSync(path);
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  const note = await page.textContent('#abcNote');
  assert.ok(note.includes('저장됨'));
});

// MIDI → ABC (엔진으로 만든 MIDI를 파일 인풋으로 주입)
await check('MIDI 파일 업로드 → ABC 출력 + 복사/저장 버튼 활성화', async () => {
  // 페이지 내 엔진으로 MIDI 바이트를 만들어 File로 주입
  const b64 = await page.evaluate(() => {
    const bytes = AbcMidi.abcToMidi('X:1\nT:E2E\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 | G2 E2 C2 z2 |]');
    let s = ''; for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s);
  });
  await page.setInputFiles('#midiFile', {
    name: 'from-magenta.mid', mimeType: 'audio/midi',
    buffer: Buffer.from(b64, 'base64'),
  });
  await page.waitForFunction(() => document.getElementById('abcOut').value.includes('K:C'), undefined, { timeout: 5000 });
  const out = await page.inputValue('#abcOut');
  assert.ok(out.includes('C2 E2 G2 c2'), 'ABC 본문 복원: ' + out);
  assert.equal(await page.isEnabled('#btnCopy'), true);
  assert.equal(await page.isEnabled('#btnSaveAbc'), true);
  const note = await page.textContent('#midiNote');
  assert.ok(note.includes('음'), 'meta 정보 표시');
});

await check('「악보 연구소로 보내기」 → 새 창의 악보 연구소에 ABC가 실려 열린다', async () => {
  assert.equal(await page.isEnabled('#btnToLab'), true, '변환 후 버튼 활성화');
  const [popup] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 5000 }),
    page.click('#btnToLab'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForFunction(() => {
    const t = document.getElementById('abcInput');
    return t && t.value.includes('K:C');
  }, undefined, { timeout: 5000 });
  const loaded = await popup.inputValue('#abcInput');
  assert.ok(loaded.includes('C2 E2 G2 c2'), '넘어온 ABC가 입력창에 채워짐: ' + loaded);
  // 핸드오프 키는 소비 후 제거된다
  const leftover = await popup.evaluate(() => localStorage.getItem('broguard_lab_abc'));
  assert.equal(leftover, null, '핸드오프 키 제거됨');
  await popup.close();
});

await check('.abc 저장 버튼이 ABC 텍스트를 다운로드한다', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveAbc'),
  ]);
  const content = readFileSync(await download.path(), 'utf8');
  assert.ok(content.includes('X:1') && content.includes('K:C'));
});

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  assert.equal(await page.getAttribute('header a.home', 'href'), 'index.html');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nABC↔MIDI E2E 전체 통과');
process.exit(failures ? 1 : 0);
