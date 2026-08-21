// 합치기 계이름 입력 도우미(건반) E2E
// 실행: node tests/combine-keypad-e2e.test.mjs
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
let fail = 0;
const ok = n => console.log('ok - ' + n);
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + (e && e.message || e)); };

{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/cdnjs|xlsx|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  try {
    await page.goto(`${base}/combine.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#kpNotes .kp-note');
    await page.evaluate(() => { document.getElementById('melodyIn').value = ''; });

    // 1) 계이름 버튼 7개, 누르면 멜로디 칸에 입력
    assert.equal(await page.$$eval('#kpNotes .kp-note', els => els.length), 7, '도~시 7개');
    await page.click('#kpNotes .kp-note:nth-child(3)'); // 미
    await page.click('#kpNotes .kp-note:nth-child(1)'); // 도
    assert.equal(await page.inputValue('#melodyIn'), '미 도 ', '버튼이 멜로디 칸에 입력');
    ok('계이름 버튼을 누르면 멜로디 칸에 입력된다');

    // 2) r · 0 삽입
    await page.click('.keypad [data-ins="r"]');
    await page.click('.keypad [data-ins="0"]');
    assert.equal(await page.inputValue('#melodyIn'), '미 도 r 0 ', 'r·0 삽입');
    ok('마디(r)·쉼표(0) 버튼이 삽입된다');

    // 3) 옥타브: 높게 → 도' , 낮게 → ,솔
    await page.selectOption('#kpOct', 'high');
    await page.click('#kpNotes .kp-note:nth-child(1)'); // 도'
    await page.selectOption('#kpOct', 'low');
    await page.click('#kpNotes .kp-note:nth-child(5)'); // ,솔
    assert.equal(await page.inputValue('#melodyIn'), "미 도 r 0 도' ,솔 ", '옥타브 표시');
    ok('옥타브 선택에 따라 도\'·,솔 로 입력된다');

    // 4) 지우기: 마지막 토큰 제거
    await page.click('#kpBack');
    assert.equal(await page.inputValue('#melodyIn'), "미 도 r 0 도' ", '마지막 토큰 삭제');
    ok('지우기(⌫)가 마지막 토큰을 지운다');

    // 5) 입력한 멜로디로 실제 합치기 동작(오류 없음)
    await page.evaluate(() => { document.getElementById('rhythmIn').value = '2 2 r 2 2'; document.getElementById('melodyIn').value = '미 도 r 도\' ,솔'; document.getElementById('goBtn').click(); });
    const result = await page.textContent('#result');
    assert.ok(/E2 C2/.test(result) && /L:1\/8/.test(result), '건반 입력이 ABC로 합쳐짐');
    ok('건반으로 넣은 멜로디가 정상적으로 합쳐진다');

    // 6) 숫자자판 1~7 = 도~시 (멜로디 칸에서 물리 키 입력)
    await page.evaluate(() => { const m = document.getElementById('melodyIn'); m.value = ''; m.focus(); });
    await page.selectOption('#kpOct', '0');
    await page.focus('#melodyIn');
    await page.keyboard.press('1'); await page.keyboard.press('3'); await page.keyboard.press('5');
    assert.equal(await page.inputValue('#melodyIn'), '도 미 솔 ', '숫자키 1·3·5 → 도·미·솔');
    await page.keyboard.press('0'); // 쉼표는 그대로 입력(리매핑 안 함)
    assert.ok((await page.inputValue('#melodyIn')).indexOf('0') >= 0, '0은 쉼표로 그대로 입력');
    ok('숫자자판 1~7로 피아노처럼 계이름을 친다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음');
  } catch (e) { bad('계이름 건반', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll combine-keypad E2E passed');
