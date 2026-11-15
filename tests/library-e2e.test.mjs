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
let albumOffline = false;
await page.route(/scores\/album\.json/, r => {
  if (albumOffline) return r.abort();
  r.fulfill({ contentType: 'application/json', body: JSON.stringify(ALBUM) });
});
await page.route(/scores\/.*\.abc/, r => {
  const name = decodeURIComponent(r.request().url().split('/').pop().split('?')[0]);
  if (ABC[name]) r.fulfill({ contentType: 'text/plain', body: ABC[name] });
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

await check('버튼 → 확인 화면: 없는 곡만, 건너뛰는 곡 수 표시, 전체 선택', async () => {
  await page.click('#btnAlbum');
  await page.waitForSelector('#albumReview', { state: 'visible', timeout: 5000 });
  assert.match(await page.textContent('#albumCount'), /새 곡 2곡/, '제목이 같은 1곡은 제외');
  assert.match(await page.textContent('#albumSkip'), /이미 있는 1곡은 건너뜁니다/);
  const boxes = await page.$$eval('#albumList input[data-alb]', els => els.map(c => c.checked));
  assert.deepEqual(boxes, [true, true], '기본 전체 선택');
  const items = await page.$$eval('#albumList li span', els => els.map(s => s.textContent));
  assert.deepEqual(items, ['2. 별빛 왈츠', '3. 아침 이슬 연습곡'], '번호·제목 표시');
});

await check('추가 → 기타 분류로 저장, 기존 곡은 그대로', async () => {
  await page.click('#btnAlbumConfirm');
  await page.waitForFunction(() => /곡을 추가했어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  const es = await lib();
  assert.equal(es.length, 4, '2 + 새 2곡');
  const w = es.find(e => e.id === 'fireflies-album-002');
  const d = es.find(e => e.id === 'fireflies-album-003');
  assert.ok(w && d, '고정 id로 저장');
  assert.equal(w.cat, '기타'); assert.equal(d.cat, '기타');
  assert.ok(/별빛 왈츠/.test(w.abc), 'abc 본문 저장');
  const old = es.find(e => e.id === 'rnd123');
  assert.equal(old.abc, EDITED_ABC, '사용자가 고친 기존 곡은 덮어쓰지 않음');
  assert.ok(!(await page.isVisible('#albumReview')), '확인 화면 닫힘');
});

await check('다시 눌러도 중복 없음 — "새 곡이 없어요"', async () => {
  await page.click('#btnAlbum');
  await page.waitForFunction(() => /새 곡이 없어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  assert.match(await page.textContent('#formStatus'), /3곡이 모두 들어 있어요/);
  assert.equal((await lib()).length, 4, '중복 0');
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
  assert.equal(es.length, 2, '선택한 2곡만');
  assert.ok(!es.some(e => e.id === 'fireflies-album-001'), '해제한 곡 제외');
});

await check('오프라인(목록 실패) → 안내만, 악보집은 그대로', async () => {
  const before = (await lib()).length;
  albumOffline = true;
  await page.click('#btnAlbum');
  await page.waitForFunction(() => /앨범 목록을 받지 못했어요/.test(document.getElementById('formStatus').textContent), undefined, { timeout: 5000 });
  assert.equal((await lib()).length, before, '악보집 변화 없음');
  albumOffline = false;
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n악보집(반딧불 앨범) E2E 전체 통과');
process.exit(failures ? 1 : 0);
