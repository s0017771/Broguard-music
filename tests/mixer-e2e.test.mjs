// 곡 믹서 UI E2E — 실행: node tests/mixer-e2e.test.mjs
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
  page.on('console', m => { if (m.type() === 'error' && !/abcjs|ABCJS|cdnjs|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  try {
    await page.goto(`${base}/mixer.html?autotest=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });
    await page.waitForTimeout(200);

    // 1) 예시 섞기 → 결과 ABC · 마디 띠 · 안내
    assert.ok(/K:C/.test(await page.textContent('#resultAbc')), '결과 ABC(A조 C)');
    assert.equal(await page.$$eval('#strip .bar', els => els.length), 4, '마디 띠 4칸');
    assert.ok(/이조|맞춰 섞/.test(await page.textContent('#mixInfo') + await page.textContent('#warn')), '이조 안내');
    ok('예시를 섞으면 결과·마디 띠·안내가 나온다');

    // 2) 비율 슬라이더 실시간 반영
    await page.evaluate(() => { const s = document.getElementById('ratio'); s.value = 50; s.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(150);
    assert.equal(await page.$$eval('#strip .bar.A', els => els.length), 2, '50%면 A 2마디');
    assert.equal(await page.textContent('#pa'), '50');
    ok('비율을 바꾸면 마디 배분이 실시간으로 바뀐다');

    // 3) 악보연구소/타브로 보내기 → localStorage 핸드오프 설정
    await page.evaluate(() => { window.__open = window.open; window.open = () => {}; });
    await page.click('#toLabBtn');
    assert.ok((await page.evaluate(() => localStorage.getItem('broguard_lab_abc'))).includes('K:C'), '연구소 핸드오프');
    await page.click('#toTabBtn');
    assert.ok((await page.evaluate(() => localStorage.getItem('broguard_tab_abc'))).includes('K:C'), '타브 핸드오프');
    ok('연구소·타브로 보내기가 곡을 넘긴다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음');
  } catch (e) { bad('곡 믹서 UI', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll mixer E2E passed');
