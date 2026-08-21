// 기타 타브 변환기 '지판 따라가기' E2E
// 실행: node tests/tab-fretboard-e2e.test.mjs
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
  page.on('console', m => { if (m.type() === 'error' && !/abcjs|ABCJS|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  try {
    await page.goto(`${base}/tab.html?autotest=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });
    await page.waitForTimeout(200);

    // 1) 변환 성공 시 지판 카드가 뜬다
    assert.equal(await page.$eval('#fbCard', el => getComputedStyle(el).display) !== 'none', true, '지판 카드 표시');
    const boardKids = await page.$eval('#fretboard', el => el.childElementCount);
    assert.ok(boardKids > 10, '지판 SVG가 그려짐(줄·프렛)');
    ok('변환하면 지판 카드가 나타나고 지판이 그려진다');

    // 2) 상태줄에 음 개수/시간 안내
    const status = await page.textContent('#fbStatus');
    assert.ok(/음/.test(status) && /초/.test(status), '상태 안내');
    ok('상태줄에 음 개수·시간이 표시된다');

    // 3) 재생하면 지판에 불(프렛 점)이 켜지고 버튼이 정지로 바뀐다
    await page.click('#fbPlay');
    await page.waitForTimeout(500);
    const dots = await page.$$eval('#fretboard g circle', els => els.length);
    assert.ok(dots >= 1, '재생 중 프렛 점이 켜짐');
    assert.ok(/정지/.test(await page.textContent('#fbPlay')), '버튼이 정지로 전환');
    ok('재생하면 지판에 프렛 점이 켜지고 버튼이 정지로 바뀐다');

    // 4) 정지하면 점이 사라지고 버튼이 재생으로 복귀
    await page.click('#fbPlay');
    await page.waitForTimeout(150);
    const dotsAfter = await page.$$eval('#fretboard g circle', els => els.length);
    assert.equal(dotsAfter, 0, '정지 시 점 제거');
    assert.ok(/재생/.test(await page.textContent('#fbPlay')), '버튼 재생 복귀');
    ok('정지하면 점이 사라지고 버튼이 재생으로 돌아온다');

    // 5) 속도 슬라이더가 배속 라벨을 바꾼다
    await page.evaluate(() => { const s = document.getElementById('fbSpeed'); s.value = 60; s.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.textContent('#fbSpeedVal'), '0.6×', '배속 라벨 갱신');
    ok('속도 슬라이더가 배속 라벨을 바꾼다');

    // 6) 입력을 비우면 지판 카드가 숨는다
    await page.evaluate(() => { const t = document.getElementById('abcIn'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(450);
    assert.equal(await page.$eval('#fbCard', el => getComputedStyle(el).display), 'none', '카드 숨김');
    ok('입력을 비우면 지판 카드가 숨는다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음');
  } catch (e) { bad('지판 따라가기', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll tab-fretboard E2E passed');
