// 악보집 E2E — 🎹 반딧불 앨범 받기 (scores/album.json → 없는 곡만 '기타'로 추가)
// 실행: node tests/library-e2e.test.mjs
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

// 가짜 앨범: 3곡 — 1곡은 사용자가 제목만 같게(무작위 id로) 이미 넣어둔 곡
const ALBUM = {
  album: '반딧불 앨범', category: '기타', updated: '2026-11-15', count: 3,
  tracks: [
    { no: 1, id: 'fireflies-album-001', title: '퇴근길의 반딧불', file: 'fireflies-way-home.abc' },
    { no: 2, id: 'fireflies-album-002', title: '별빛 왈츠', file: 'starlight-waltz.abc' },
    { no: 3, id: 'fireflies-album-003', title: '아침 이슬 연습곡', file: 'morning-dew.abc' }
  ]
};
const ABC = {
  'fireflies-way-home.abc': 'X:1\nT:퇴근길의 반딧불\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 |',
  'starlight-waltz.abc': 'X:1\nT:별빛 왈츠\nM:3/4\nL:1/8\nK:G\nG2 B2 d2 |',
  'morning-dew.abc': 'X:1\nT:아침 이슬 연습곡\nM:4/4\nL:1/8\nK:F\nF2 A2 c2 f2 |'
};
// 원장님 리믹스 앨범(두 번째 목록) — 폴더가 달라 경로 해석도 함께 검증된다
const REMIX = {
  album: '반딧불 리믹스', category: '기타', updated: '2026-11-18', count: 1,
  tracks: [{ no: 1, id: 'fireflies-remix-901', title: '리믹스 테스트곡', file: 'remix-test.abc' }]
};
const REMIX_ABC = { 'remix-test.abc': 'X:1\nT:리믹스 테스트곡\nM:4/4\nL:1/8\nK:D\nD2 F2 A2 d2 |' };
// 🏛 클래식 목록(시대→작곡가→곡→단계) — 받기 + 찾아보기 트리 둘 다 이걸 쓴다
const CLASSICAL = {
  collection: '클래식 악보집', category: '클래식', updated: '2026-11-21',
  levels: [
    { id: 'intermediate', no: 1, name: '인터미디어트' },
    { id: 'advanced', no: 2, name: '어드밴스' },
    { id: 'original', no: 3, name: '원곡' }
  ],
  eras: [
    { id: 'baroque', name: '바로크', years: '1600–1750', summary: '대위법의 시대',
      composers: [
        { id: 'bach', name: '요한 제바스티안 바흐', shortName: '바흐', years: '1685–1750', nickname: '음악의 아버지', status: 'in-progress',
          pieces: [
            { id: 'bach-anh114', title: '미뉴에트 G장조', work: 'BWV Anh. 114', year: '1725', status: 'done',
              scores: [
                { level: 'intermediate', id: 'classical-bach-anh114-1', title: '바흐 · 미뉴에트 G장조 [1 인터미디어트]', file: 'bach/minuet-1.abc' },
                { level: 'original', id: 'classical-bach-anh114-3', title: '바흐 · 미뉴에트 G장조 [3 원곡]', file: 'bach/minuet-3.abc' }
              ] },
            { id: 'bach-anh115', title: '미뉴에트 G단조', work: 'BWV Anh. 115', status: 'planned', scores: [] }
          ] },
        { id: 'handel', name: '헨델', years: '1685–1759', status: 'planned', pieces: [] }
      ] },
    { id: 'era-classical', name: '고전', years: '1750–1820', summary: '소나타의 시대',
      composers: [{ id: 'mozart', name: '모차르트', years: '1756–1791', status: 'planned', pieces: [] }] }
  ]
};
const CLASSICAL_ABC = {
  'minuet-1.abc': 'X:1\nT:바흐 · 미뉴에트 G장조 [1 인터미디어트]\nM:3/4\nL:1/8\nK:G\nd2 g2 a2 |',
  'minuet-3.abc': 'X:1\nT:바흐 · 미뉴에트 G장조 [3 원곡]\nM:3/4\nL:1/8\nK:G\nd2 g2 a2 b2 |'
};
let scoresDown = false, remixDown = false, classicalDown = false;
await page.route(/scores\/album\.json/, r => {
  if (scoresDown) return r.abort();
  r.fulfill({ contentType: 'application/json', body: JSON.stringify(ALBUM) });
});
await page.route(/remixes\/album\.json/, r => {
  if (remixDown) return r.abort();
  r.fulfill({ contentType: 'application/json', body: JSON.stringify(REMIX) });
});
await page.route(/classical\/catalog\.json/, r => {
  if (classicalDown) return r.abort();
  r.fulfill({ contentType: 'application/json', body: JSON.stringify(CLASSICAL) });
});
await page.route(/classical\/.*\.abc/, r => {
  const name = decodeURIComponent(r.request().url().split('/').pop().split('?')[0]);
  if (CLASSICAL_ABC[name]) r.fulfill({ contentType: 'text/plain', body: CLASSICAL_ABC[name] });
  else r.fulfill({ status: 404, body: 'nf' });
});
await page.route(/scores\/.*\.abc/, r => {
  const name = decodeURIComponent(r.request().url().split('/').pop().split('?')[0]);
  if (ABC[name]) r.fulfill({ contentType: 'text/plain', body: ABC[name] });
  else r.fulfill({ status: 404, body: 'nf' });
});
await page.route(/remixes\/.*\.abc/, r => {
  const name = decodeURIComponent(r.request().url().split('/').pop().split('?')[0]);
  if (REMIX_ABC[name]) r.fulfill({ contentType: 'text/plain', body: REMIX_ABC[name] });
  else r.fulfill({ status: 404, body: 'nf' });
});

await page.goto(`${base}/library.html`, { waitUntil: 'domcontentloaded' });
// 기존 악보집: '퇴근길의 반딧불'은 무작위 id + 사용자가 고친 abc(템포 추가), 그 외 무관한 곡 1개
const EDITED_ABC = 'X:1\nT:퇴근길의 반딧불\nM:4/4\nL:1/8\nQ:1/4=72\nK:C\nC2 E2 G2 c2 |';
await page.evaluate(abc => localStorage.setItem('broguard_library', JSON.stringify({
  app: 'broguard-library', v: 1, entries: [
    { id: 'rnd123', title: '퇴근길의 반딧불', abc: abc, cat: '기타', added: 1 },
    { id: 'rnd456', title: '내 다른 곡', abc: 'X:1\nK:C\nCDEF|', cat: 'K-가요', added: 2 }
  ]
})), EDITED_ABC);
await page.reload({ waitUntil: 'domcontentloaded' });

const lib = () => page.evaluate(() => JSON.parse(localStorage.getItem('broguard_library')).entries);

await check('버튼 → 확인 화면: 두 앨범(반딧불+리믹스) 합쳐 없는 곡만, 건너뛰는 곡 수 표시', async () => {
  await page.click('#btnAlbum');
  await page.waitForSelector('#albumReview', { state: 'visible', timeout: 5000 });
  assert.match(await page.textContent('#albumCount'), /새 곡 5곡/, '제목이 같은 1곡은 제외, 리믹스·클래식 포함');
  assert.match(await page.textContent('#albumSkip'), /이미 있는 1곡은 건너뜁니다/);
  const boxes = await page.$$eval('#albumList input[data-alb]', els => els.map(c => c.checked));
  assert.deepEqual(boxes, [true, true, true, true, true], '기본 전체 선택');
  const items = await page.$$eval('#albumList li span', els => els.map(s => s.textContent));
  assert.deepEqual(items, ['2. 별빛 왈츠', '3. 아침 이슬 연습곡', '1. 리믹스 테스트곡',
    '바흐 · 미뉴에트 G장조 [1 인터미디어트]', '바흐 · 미뉴에트 G장조 [3 원곡]'], '번호·제목 표시(리믹스·클래식은 뒤에)');
});

await check('추가 → 기타/클래식 분류로 저장, 기존 곡은 그대로', async () => {
  await page.click('#btnAlbumConfirm');
  await page.waitForFunction(() => /곡을 추가했어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  const es = await lib();
  assert.equal(es.length, 7, '2 + 새 5곡(리믹스·클래식 포함)');
  const w = es.find(e => e.id === 'fireflies-album-002');
  const d = es.find(e => e.id === 'fireflies-album-003');
  const x = es.find(e => e.id === 'fireflies-remix-901');
  const c1 = es.find(e => e.id === 'classical-bach-anh114-1');
  const c3 = es.find(e => e.id === 'classical-bach-anh114-3');
  assert.ok(w && d && x && c1 && c3, '고정 id로 저장(리믹스·클래식 포함)');
  assert.equal(w.cat, '기타'); assert.equal(d.cat, '기타'); assert.equal(x.cat, '기타');
  assert.equal(c1.cat, '클래식'); assert.equal(c3.cat, '클래식', "클래식은 '클래식' 분류('기타' 아님)");
  assert.ok(/별빛 왈츠/.test(w.abc), 'abc 본문 저장');
  assert.ok(/리믹스 테스트곡/.test(x.abc), '리믹스는 remixes/ 폴더에서 받아옴');
  assert.ok(/미뉴에트/.test(c1.abc), '클래식은 classical/ 폴더(하위 bach/)에서 받아옴');
  const old = es.find(e => e.id === 'rnd123');
  assert.equal(old.abc, EDITED_ABC, '사용자가 고친 기존 곡은 덮어쓰지 않음');
  assert.ok(!(await page.isVisible('#albumReview')), '확인 화면 닫힘');
});

await check('다시 눌러도 중복 없음 — "새 곡이 없어요"', async () => {
  await page.click('#btnAlbum');
  await page.waitForFunction(() => /새 곡이 없어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  assert.match(await page.textContent('#formStatus'), /6곡이 모두 들어 있어요/);
  assert.equal((await lib()).length, 7, '중복 0');
});

await check('체크 해제한 곡은 추가되지 않는다', async () => {
  await page.evaluate(() => localStorage.setItem('broguard_library', JSON.stringify({
    app: 'broguard-library', v: 1, entries: []
  })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('#btnAlbum');
  await page.waitForSelector('#albumReview', { state: 'visible', timeout: 5000 });
  await page.uncheck('#albumList input[data-alb="0"]');   // 1번 곡 제외
  await page.click('#btnAlbumConfirm');
  await page.waitForFunction(() => /곡을 추가했어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  const es = await lib();
  assert.equal(es.length, 5, '선택한 5곡만(빈 악보집: 전체 6곡 중 1곡 해제)');
  assert.ok(!es.some(e => e.id === 'fireflies-album-001'), '해제한 곡 제외');
});

await check('한쪽 목록만 실패 → 받은 목록만으로 진행', async () => {
  scoresDown = true;   // 반딧불 앨범만 실패 — 리믹스·클래식(이미 보유)만 남아 '새 곡 없음'
  await page.click('#btnAlbum');
  await page.waitForFunction(() => /새 곡이 없어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  assert.match(await page.textContent('#formStatus'), /3곡이 모두 들어 있어요/, '리믹스·클래식 목록만으로 판정');
  scoresDown = false;
});

await check('오프라인(목록 전부 실패) → 안내만, 악보집은 그대로', async () => {
  const before = (await lib()).length;
  scoresDown = true; remixDown = true; classicalDown = true;
  await page.click('#btnAlbum');
  await page.waitForFunction(() => /앨범 목록을 받지 못했어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  assert.equal((await lib()).length, before, '악보집 변화 없음');
  scoresDown = false; remixDown = false; classicalDown = false;
});

// ── 🏛 클래식 찾아보기: 시대 → 작곡가 → 곡 → 단계 ──
await check('클래식 분류 → 시대 목록(역사 순) + 기타 클래식 묶음', async () => {
  await page.evaluate(() => localStorage.setItem('broguard_library', JSON.stringify({
    app: 'broguard-library', v: 1, entries: [
      { id: 'classical-bach-anh114-1', title: '바흐 · 미뉴에트 G장조 [1 인터미디어트]', abc: 'X:1\nT:바흐 · 미뉴에트 G장조 [1 인터미디어트]\nK:G\nd2 g2|', cat: '클래식', added: 3 },
      { id: 'old-eliza', title: '엘리제를 위하여', abc: 'X:1\nT:엘리제를 위하여\nK:Am\ne^d e^d e|', cat: '클래식', added: 2 },
      { id: 'rnd456', title: '내 다른 곡', abc: 'X:1\nK:C\nCDEF|', cat: 'K-가요', added: 1 }
    ]
  })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('#catBar button[data-cat="클래식"]');
  await page.waitForSelector('.cl-row', { timeout: 5000 });
  const rows = await page.$$eval('#list .cl-row', els => els.map(e => e.textContent));
  assert.ok(/바로크/.test(rows[0]) && /1600/.test(rows[0]) && /대위법/.test(rows[0]), '시대 + 연도 + 한 줄 설명: ' + rows[0]);
  assert.ok(/고전/.test(rows[1]), '역사 순');
  assert.ok(/기타 클래식/.test(rows[2]) && /1곡/.test(rows[2]), '목록 밖의 곡(엘리제) 묶음: ' + rows[2]);
});

await check('시대 → 작곡가(태어난 순, 준비 중 흐리게) → 곡 → 단계 + 경로 표시', async () => {
  await page.click('[data-tree="era-go"][data-id="baroque"]');
  let rows = await page.$$eval('#list .cl-row', els => els.map(e => ({ t: e.textContent, dim: e.classList.contains('dim') })));
  assert.ok(/요한 제바스티안 바흐/.test(rows[0].t) && /음악의 아버지/.test(rows[0].t) && !rows[0].dim, '바흐: 이름·별명, 클릭 가능');
  assert.ok(/악보 1곡/.test(rows[0].t), '악보 있는 곡 수');
  assert.ok(/헨델/.test(rows[1].t) && rows[1].dim && /준비 중/.test(rows[1].t), '헨델: 준비 중 흐리게');
  await page.click('[data-tree="comp-go"][data-id="bach"]');
  rows = await page.$$eval('#list .cl-row', els => els.map(e => ({ t: e.textContent, dim: e.classList.contains('dim') })));
  assert.ok(/미뉴에트 G장조/.test(rows[0].t) && /BWV Anh\. 114/.test(rows[0].t) && !rows[0].dim, '곡: 제목·작품번호');
  assert.ok(/미뉴에트 G단조/.test(rows[1].t) && rows[1].dim && /준비 중/.test(rows[1].t), 'planned 곡 흐리게');
  await page.click('[data-tree="piece-go"][data-id="bach-anh114"]');
  const nav = await page.textContent('.cl-nav');
  assert.ok(/클래식/.test(nav) && /바로크/.test(nav) && /바흐/.test(nav) && /미뉴에트 G장조/.test(nav), '경로: ' + nav.trim());
  const lvs = await page.$$eval('#list .cl-lv', els => els.map(e => e.textContent));
  assert.deepEqual(lvs, ['1 인터미디어트', '2 어드밴스', '3 원곡'], '세 단계 표시');
  assert.ok(await page.isVisible('.entry[data-id="classical-bach-anh114-1"]'), '1단계: 악보집 곡 카드');
  const dims = await page.$$eval('#list .cl-row.dim', els => els.map(e => e.textContent));
  assert.ok(dims.some(t => /앨범 받기/.test(t)), '3단계(목록엔 있음): 앨범 받기 안내');
  assert.ok(dims.some(t => /준비 중/.test(t)), '2단계: 준비 중');
});

await check('단계에서 악보 열기 + 뒤로 가기', async () => {
  await page.click('.entry[data-id="classical-bach-anh114-1"] .entry-head');
  assert.ok(await page.isVisible('#sheet-classical-bach-anh114-1'), '카드가 열려 악보 영역 표시');
  await page.click('[data-tree="back"]');            // 곡 목록으로
  assert.ok(await page.isVisible('[data-tree="piece-go"][data-id="bach-anh114"]'), '뒤로: 곡 목록');
  await page.click('[data-tree="back"]');            // 작곡가 목록
  await page.click('[data-tree="back"]');            // 시대 목록
  assert.ok(await page.isVisible('[data-tree="era-go"][data-id="baroque"]'), '뒤로 두 번: 시대 목록');
});

await check('기타 클래식: 목록에 없는 곡이 그대로 보인다 + 다른 분류는 기존 정렬', async () => {
  await page.click('[data-tree="others"]');
  assert.ok(await page.isVisible('.entry[data-id="old-eliza"]'), '엘리제를 위하여 보존');
  const title = await page.textContent('.entry[data-id="old-eliza"] .entry-title');
  assert.equal(title, '엘리제를 위하여');
  await page.click('#catBar button[data-cat="K-가요"]');
  assert.ok(await page.isVisible('.entry[data-id="rnd456"]'), '다른 분류는 일반 목록 그대로');
  assert.equal(await page.$('#list .cl-row'), null, '트리 흔적 없음');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n악보집(반딧불 앨범) E2E 전체 통과');
process.exit(failures ? 1 : 0);
