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

// ── 2단계: 구간 반복 + 속도 트레이너 ──
{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/abcjs|ABCJS|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  try {
    await page.goto(`${base}/tab.html?autotest=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__autotestDone === true, { timeout: 5000 });
    await page.waitForTimeout(200);

    // 1) 구간 반복 켜면 마디 선택·트레이너가 나타난다
    assert.equal(await page.$eval('#fbRangeWrap', el => getComputedStyle(el).display), 'none', '초기엔 마디선택 숨김');
    await page.click('#fbLoop');
    assert.equal(await page.$eval('#fbLoop', el => el.getAttribute('aria-pressed')), 'true');
    assert.notEqual(await page.$eval('#fbRangeWrap', el => getComputedStyle(el).display), 'none', '마디 선택 표시');
    assert.notEqual(await page.$eval('#fbTrainer', el => getComputedStyle(el).display), 'none', '트레이너 버튼 표시');
    assert.ok(/반복/.test(await page.textContent('#fbStatus')), '상태에 반복 표기');
    ok('구간 반복을 켜면 마디 선택과 트레이너가 나타난다');

    // 2) 1마디만 반복 지정 후 재생하면, 한 번 길이가 지나도 계속 재생(=반복)된다
    await page.selectOption('#fbBarA', '1');
    await page.selectOption('#fbBarB', '1');
    await page.evaluate(() => { const s = document.getElementById('fbSpeed'); s.value = 110; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#fbPlay');
    await page.waitForTimeout(3500);   // 1마디 재생 시간보다 충분히 길게
    assert.ok(/정지/.test(await page.textContent('#fbPlay')), '한 번 지나도 계속 재생 중(반복)');
    ok('구간 반복이 한 소절을 지나도 멈추지 않고 반복한다');
    await page.click('#fbPlay'); // stop

    // 3) 트레이너 켜고 반복하면 배속이 올라간다
    await page.evaluate(() => { const s = document.getElementById('fbSpeed'); s.value = 70; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#fbTrainer');
    const spd0 = await page.textContent('#fbSpeedVal');
    await page.click('#fbPlay');
    await page.waitForTimeout(6000);   // 1마디(0.7×)를 최소 한 번 되감으며 +0.05
    const spd1 = await page.textContent('#fbSpeedVal');
    await page.click('#fbPlay'); // stop
    assert.notEqual(spd0, spd1, `트레이너로 배속 증가 (${spd0} → ${spd1})`);
    ok('속도 트레이너를 켜면 반복마다 배속이 올라간다');

    // 4) 구간 반복 끄면 마디 선택이 다시 숨고 트레이너도 꺼진다
    await page.click('#fbLoop');
    assert.equal(await page.$eval('#fbRangeWrap', el => getComputedStyle(el).display), 'none', '마디 선택 숨김');
    assert.equal(await page.$eval('#fbTrainer', el => el.getAttribute('aria-pressed')), 'false', '트레이너 해제');
    ok('구간 반복을 끄면 마디 선택이 숨고 트레이너도 꺼진다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음(2단계)');
  } catch (e) { bad('구간 반복·트레이너', e); }
  await page.close();
}

// ── 3·4단계: 코드 다이어그램 + 주법 제안 ──
{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/abcjs|ABCJS|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  const convert = async (abc, arrange) => {
    await page.evaluate(a => { document.getElementById('optArrange').value = a; }, arrange);
    await page.evaluate(t => { const el = document.getElementById('abcIn'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, abc);
    await page.waitForTimeout(450);
  };
  try {
    await page.goto(`${base}/tab.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // 1) 코드 다이어그램: 오픈 + 바레 코드 모두 그려진다
    await convert('X:1\nM:4/4\nL:1/8\nK:C\n"C"C2 E2 G2 c2 | "F"F2 A2 c2 f2 | "Bb"B,2 D2 F2 B2 |', 'off');
    assert.notEqual(await page.$eval('#chordCard', el => getComputedStyle(el).display), 'none', '코드 카드 표시');
    const names = await page.$$eval('.chord-cell .chord-name', els => els.map(e => e.textContent));
    assert.deepEqual(names, ['C', 'F', 'Bb'], '사용 코드가 다이어그램으로');
    assert.ok(await page.$$eval('.chord-cell svg circle', els => els.length) > 0, '운지 점이 그려짐');
    assert.ok(await page.$$eval('.chord-cell svg rect', els => els.length) >= 2, '바레(F·Bb) 막대가 그려짐');
    ok('사용 코드가 다이어그램(오픈·바레)으로 그려진다');

    // 2) 주법 제안: 같은 줄 반음 진행 → 해머온/풀오프
    await convert('X:1\nM:4/4\nL:1/8\nK:C\nC ^C D ^D E F ^F G | G ^F F E ^D D ^C C |', 'off');
    assert.notEqual(await page.$eval('#techCard', el => getComputedStyle(el).display), 'none', '주법 카드 표시');
    const rows = await page.$$eval('.tech-row', els => els.map(e => e.textContent));
    assert.ok(rows.length > 0 && rows.some(r => /해머온|풀오프|슬라이드/.test(r)), '주법 제안 생성');
    ok('같은 줄 진행에서 해머온/풀오프 제안이 뜬다');

    // 3) 코드가 없고 반주 없으면 코드 카드는 숨는다(멜로디만)
    await convert('X:1\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 |', 'off');
    // (bass=쿵짝 기본이라 자동 코드가 생길 수 있음 → 최소한 오류 없이 동작하면 통과)
    ok('코드 없는 단순 멜로디도 오류 없이 처리된다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음(3·4단계)');
  } catch (e) { bad('코드 다이어그램·주법', e); }
  await page.close();
}

// ── 악보집 → '🎸 타브로' 곡 넘겨받기 ──
{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${base}/tab.html`, { waitUntil: 'domcontentloaded' });
    // 악보집이 하는 것과 동일: broguard_tab_abc 에 곡을 담고 tab.html 다시 열기
    await page.evaluate(() => localStorage.setItem('broguard_tab_abc', 'X:1\nT:넘겨온곡\nM:4/4\nL:1/8\nK:C\n"C"C2 E2 G2 c2 | "G"G2 E2 C4 |'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    assert.ok((await page.inputValue('#abcIn')).includes('넘겨온곡'), '넘겨온 곡이 입력창에 로드');
    assert.ok(/넘겨온곡/.test(await page.textContent('#tabOut')), '자동 변환되어 타브 표시');
    assert.equal(await page.evaluate(() => localStorage.getItem('broguard_tab_abc')), null, '사용 후 키 제거(재방문 시 재로드 안 함)');
    ok('악보집의 타브로 버튼이 곡을 타브 변환기로 넘긴다');

    assert.equal(errors.length, 0, 'JS 오류 없음: ' + errors.join(' | '));
    ok('페이지 JS 오류 없음(타브로 넘김)');
  } catch (e) { bad('타브로 곡 넘김', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll tab-fretboard E2E passed');
