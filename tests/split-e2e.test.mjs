// ABC 분리기 E2E — 실제 브라우저(Chromium)에서 split.html 동작 확인
// 특히 MIDI 파일 입력 → ABC 변환 → 리듬/멜로디 분리 경로
// 실행: node tests/split-e2e.test.mjs
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

await page.goto(`${base}/split.html`, { waitUntil: 'domcontentloaded' });

await check('로드 시 예시 ABC가 리듬/멜로디로 분리되어 있다', async () => {
  const r = await page.inputValue('#rhythmOut');
  const m = await page.inputValue('#melodyOut');
  assert.ok(r.trim().length > 0 && m.trim().length > 0, '리듬·멜로디 출력 존재');
  assert.ok(/도|레|미/.test(m), '계이름 출력');
});

await check('MIDI 파일 입력 → ABC로 변환 후 리듬/멜로디로 분리된다', async () => {
  // 페이지 내 AbcMidi 엔진으로 MIDI 바이트를 만들어 File로 주입
  const b64 = await page.evaluate(() => {
    const bytes = AbcMidi.abcToMidi('X:1\nT:e2e\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 E2 | D2 G2 B2 G2 | E2 A2 c2 A2 | F2 A2 c4 |]');
    let s = ''; for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s);
  });
  await page.setInputFiles('#fileInput', {
    name: 'from-magenta.mid', mimeType: 'audio/midi',
    buffer: Buffer.from(b64, 'base64'),
  });
  await page.waitForFunction(() => document.getElementById('abcIn').value.includes('K:C'), undefined, { timeout: 5000 });
  const abc = await page.inputValue('#abcIn');
  assert.ok(abc.includes('K:C'), 'MIDI가 ABC로 변환되어 입력창에 채워짐');
  const rhythm = await page.inputValue('#rhythmOut');
  const melody = await page.inputValue('#melodyOut');
  assert.ok(/\d/.test(rhythm), '리듬(음 길이) 출력: ' + rhythm);
  assert.ok(melody.includes('도') && melody.includes('미') && melody.includes('솔'), '멜로디 계이름 출력: ' + melody);
  const warn = await page.textContent('#warn');
  assert.ok(/분리했어요/.test(warn), '분리 성공 안내');
});

await check('잘못된 MIDI(깨진 바이트)는 오류 안내를 보여준다', async () => {
  await page.setInputFiles('#fileInput', {
    name: 'broken.mid', mimeType: 'audio/midi',
    buffer: Buffer.from([1, 2, 3, 4, 5, 6]),
  });
  await page.waitForFunction(() => /MIDI/.test(document.getElementById('warn').textContent), undefined, { timeout: 5000 });
  const warn = await page.textContent('#warn');
  assert.ok(/MIDI/.test(warn), 'MIDI 오류 안내 표시');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\nABC 분리기 E2E 전체 통과');
process.exit(failures ? 1 : 0);
