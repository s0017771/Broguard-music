// 악보연구소 '악보집에서 불러오기' E2E
// 실행: node tests/lab-libload-e2e.test.mjs
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

const LIB = {
  app: 'broguard-library', v: 1, entries: [
    { id: 's1', title: '학교종', cat: '동요', abc: 'X:1\nT:학교종\nK:C\nG2 G2 A2 A2 |', added: 100 },
    { id: 's2', title: '나비야', cat: '동요', abc: 'X:1\nT:나비야\nK:C\nc2 c2 G4 |', added: 200 },
    { id: 's3', title: '아리랑', cat: 'K-가요', abc: 'X:1\nT:아리랑\nK:C\nE2 G2 A4 |', added: 300 }
  ]
};

{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${base}/lab.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(lib => localStorage.setItem('broguard_library', JSON.stringify(lib)), LIB);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#loadLibBtn');

    // 1) 버튼 클릭 → 모달 열림, 3곡 표시(최근 저장 순)
    await page.click('#loadLibBtn');
    await page.waitForSelector('#libModal', { state: 'visible' });
    const titles = await page.$$eval('#libList .lib-item .t', els => els.map(e => e.textContent));
    assert.deepEqual(titles, ['아리랑', '나비야', '학교종'], '최근 저장 순 정렬');
    ok('버튼 클릭 시 저장곡 목록이 최근 순으로 뜬다');

    // 2) 검색 필터
    await page.fill('#libSearch', '나비');
    const filtered = await page.$$eval('#libList .lib-item .t', els => els.map(e => e.textContent));
    assert.deepEqual(filtered, ['나비야'], '제목 검색 필터');
    ok('제목으로 검색하면 해당 곡만 남는다');

    // 3) 곡 선택 → 입력창에 ABC 로드, 모달 닫힘, 상태표시
    await page.click('#libList .lib-item');
    await page.waitForSelector('#libModal', { state: 'hidden' });
    const val = await page.inputValue('#abcInput');
    assert.ok(val.includes('T:나비야') && val.includes('c2 c2 G4'), '선택곡 ABC가 입력창에 들어감');
    const status = await page.textContent('#status');
    assert.ok(/불러왔어요/.test(status), '불러오기 상태 메시지');
    ok('곡을 고르면 악보연구소 입력창에 불러와진다');

    // 4) 빈 검색 결과 안내
    await page.click('#loadLibBtn');
    await page.fill('#libSearch', 'zzz없는곡');
    const empty = await page.textContent('#libList');
    assert.ok(/검색 결과가 없습니다/.test(empty), '빈 결과 안내');
    ok('검색 결과가 없으면 안내 문구를 보여준다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음');
  } catch (e) { bad('악보집 불러오기', e); }
  await page.close();
}

// 저장곡이 하나도 없을 때 안내
{
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/lab.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('broguard_library'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.click('#loadLibBtn');
    const txt = await page.textContent('#libList');
    assert.ok(/아직 저장된 악보가 없습니다/.test(txt), '빈 악보집 안내');
    ok('악보집이 비어 있으면 안내 문구를 보여준다');
  } catch (e) { bad('빈 악보집', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll lab-libload E2E passed');
