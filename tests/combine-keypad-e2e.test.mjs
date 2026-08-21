// 합치기 '함께 입력'(알파벳 피아노 + 숫자 리듬) E2E
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
  const clear = () => page.evaluate(() => { document.getElementById('melodyIn').value = ''; document.getElementById('rhythmIn').value = ''; });
  try {
    await page.goto(`${base}/combine.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#piano .pkey');

    // 1) 멜로디가 왼쪽, 리듬이 오른쪽
    const order = await page.$$eval('.io-grid .io-box textarea', els => els.map(t => t.id));
    assert.deepEqual(order, ['melodyIn', 'rhythmIn'], '멜로디 왼쪽 · 리듬 오른쪽');
    ok('멜로디 칸이 왼쪽, 리듬 칸이 오른쪽에 있다');

    // 2) 피아노 15건반 + 숫자 9개, 피아노 클릭 → 멜로디 입력
    assert.equal(await page.$$eval('#piano .pkey', e => e.length), 15, '흰건반 15');
    assert.equal(await page.$$eval('#rnums .rnum', e => e.length), 9, '리듬 숫자 9');
    await clear();
    await page.click('#piano .pkey:nth-child(4)'); // 도
    assert.equal(await page.inputValue('#melodyIn'), '도 ', '피아노 클릭 → 멜로디');
    ok('피아노 15건반 · 숫자 9개, 클릭하면 멜로디에 입력된다');

    // 3) 물리 키: 알파벳=멜로디, 숫자=리듬, 스페이스=도, Q=마디(둘 다), T=쉼표
    await clear();
    await page.focus('#melodyIn');
    for (const k of ['a', 's', 'd']) await page.keyboard.press(k);  // 도 레 미
    await page.keyboard.press('Space');                            // 도
    for (const k of ['4', '4', '4', '4']) await page.keyboard.press(k); // 리듬으로 라우팅
    await page.keyboard.press('q');                                // 마디(둘 다)
    await page.keyboard.press('z');                                // 낮은솔
    await page.keyboard.press('t');                                // 쉼표(멜로디 0)
    await page.keyboard.press(';');                                // 솔
    await page.keyboard.press('p');                                // 높은도
    assert.equal(await page.inputValue('#melodyIn'), "도 레 미 도 r ,솔 0 솔 도' ", '알파벳/스페이스/Q/T/기호 매핑');
    assert.equal(await page.inputValue('#rhythmIn'), '4 4 4 4 r ', '숫자→리듬, Q→리듬에도 마디');
    ok('알파벳=멜로디 · 숫자=리듬 · 스페이스=도 · Q=마디 · T=쉼표');

    // 4) u 도 솔 (별칭)
    await clear(); await page.focus('#melodyIn'); await page.keyboard.press('u');
    assert.equal(await page.inputValue('#melodyIn'), '솔 ', 'u = 솔');
    ok('u 키도 솔로 입력된다');

    // 5) 크로스 라우팅: 리듬 칸에 커서를 둬도 알파벳은 멜로디로
    await clear(); await page.focus('#rhythmIn');
    await page.keyboard.press('a'); await page.keyboard.press('2');
    assert.equal(await page.inputValue('#melodyIn'), '도 ', '리듬 칸에서 친 알파벳 → 멜로디');
    assert.equal(await page.inputValue('#rhythmIn'), '2 ', '리듬 칸에서 친 숫자 → 리듬');
    ok('어느 칸에 커서를 둬도 알파벳→멜로디, 숫자→리듬');

    // 6) 지우기 버튼
    await clear(); await page.focus('#melodyIn');
    await page.keyboard.press('a'); await page.keyboard.press('s');
    await page.click('#kpBackM');
    assert.equal(await page.inputValue('#melodyIn'), '도 ', '⌫ 멜로디 = 마지막 토큰 삭제');
    ok('⌫ 멜로디/리듬 버튼이 마지막 토큰을 지운다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음');
  } catch (e) { bad('함께 입력 피아노', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll combine-keypad E2E passed');
