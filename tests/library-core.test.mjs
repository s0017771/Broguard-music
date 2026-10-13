// LibraryCore(내 악보집) 유닛 테스트 — library.html에서 엔진 스크립트를 추출해 실행
// 실행: node --test tests/library-core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'library.html'), 'utf8');
const m = html.match(/<script id="library-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'library.html에 library-core 스크립트가 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'lib-'));
const p = join(tmp, 'library-core.cjs');
writeFileSync(p, m[1]);
const LibraryCore = createRequire(import.meta.url)(p);

test('indexKey: 한글 초성 추출(쌍자음은 기본자음으로)', () => {
  assert.equal(LibraryCore.indexKey('나비야'), 'ㄴ');
  assert.equal(LibraryCore.indexKey('학교종'), 'ㅎ');
  assert.equal(LibraryCore.indexKey('까치'), 'ㄱ');   // ㄲ → ㄱ
  assert.equal(LibraryCore.indexKey('땅'), 'ㄷ');     // ㄸ → ㄷ
  assert.equal(LibraryCore.indexKey('쑥갓'), 'ㅅ');   // ㅆ → ㅅ
  assert.equal(LibraryCore.indexKey('아리랑'), 'ㅇ');
});

test('indexKey: 영문 대문자·숫자·기타', () => {
  assert.equal(LibraryCore.indexKey('Amazing Grace'), 'A');
  assert.equal(LibraryCore.indexKey('happy'), 'H');
  assert.equal(LibraryCore.indexKey('1곡'), '#');
  assert.equal(LibraryCore.indexKey('  '), '#');
  assert.equal(LibraryCore.indexKey('ㄱ자음'), 'ㄱ');   // 자음만
});

test('sortEntries: 가나다 순 정렬', () => {
  const list = [{ title: '학교종' }, { title: '나비야' }, { title: '가을' }, { title: '다람쥐' }];
  const sorted = LibraryCore.sortEntries(list).map(e => e.title);
  assert.deepEqual(sorted, ['가을', '나비야', '다람쥐', '학교종']);
});

test('sortEntries: 원본 배열을 바꾸지 않는다(불변)', () => {
  const list = [{ title: '나' }, { title: '가' }];
  const before = list.map(e => e.title);
  LibraryCore.sortEntries(list);
  assert.deepEqual(list.map(e => e.title), before);
});

test('group: 초성별 그룹 + indexOrder 순서', () => {
  const list = [{ title: 'Bee' }, { title: '학교종' }, { title: '가위' }, { title: '개나리' }, { title: '9번' }];
  const g = LibraryCore.group(list);
  assert.deepEqual(g['ㄱ'].map(e => e.title), ['가위', '개나리']);  // 그룹 내 가나다
  assert.deepEqual(g['ㅎ'].map(e => e.title), ['학교종']);
  assert.deepEqual(g['B'].map(e => e.title), ['Bee']);
  assert.deepEqual(g['#'].map(e => e.title), ['9번']);
  const order = LibraryCore.indexOrder();
  assert.ok(order.indexOf('ㄱ') < order.indexOf('ㅎ'));      // ㄱ이 ㅎ보다 앞
  assert.ok(order.indexOf('ㅎ') < order.indexOf('A'));       // 한글이 영문보다 앞
  assert.equal(order[order.length - 1], '#');                // 기타는 맨 뒤
});

test('serialize/parse: 왕복 보존 + 잘못된 입력 방어', () => {
  const list = [{ id: 'a1', title: '나비야', abc: 'X:1\nK:C\nGEE2', added: 123 }];
  const json = LibraryCore.serialize(list);
  assert.deepEqual(LibraryCore.parse(json), list);
  assert.deepEqual(LibraryCore.parse('[{"title":"x","abc":"y"}]'), [{ title: 'x', abc: 'y' }]); // 배열도 허용
  assert.equal(LibraryCore.parse('깨진문자열{'), null);
  assert.equal(LibraryCore.parse('{"foo":1}'), null);
});

test('CATS/normCat: 분류 목록과 정규화', () => {
  assert.ok(LibraryCore.CATS.includes('클래식') && LibraryCore.CATS.includes('K-가요') && LibraryCore.CATS.includes('록'));
  assert.equal(LibraryCore.normCat('재즈'), '재즈');
  assert.equal(LibraryCore.normCat('없는분류'), '기타');
  assert.equal(LibraryCore.normCat(undefined), '기타');   // 기존(분류없는) 항목
});

test('splitAbcTunes: 다중 곡(X: 블록) 분리 + T: 제목', () => {
  const txt = 'X:1\nT:나비야\nK:C\nGEE2|\n\nX:2\nT:학교종\nK:C\nGGAA|';
  const tunes = LibraryCore.splitAbcTunes(txt, 'file');
  assert.equal(tunes.length, 2);
  assert.deepEqual(tunes.map(t => t.title), ['나비야', '학교종']);
  assert.ok(/GEE2/.test(tunes[0].abc) && /^X:1/m.test(tunes[0].abc));
});

test('splitAbcTunes: T: 없으면 파일명, X: 없으면 헤더 보강', () => {
  const noTitle = LibraryCore.splitAbcTunes('X:1\nK:C\nCDEF|', '내파일');
  assert.equal(noTitle[0].title, '내파일');
  const noX = LibraryCore.splitAbcTunes('K:C\nCDEF|', '헤더없음');
  assert.equal(noX.length, 1);
  assert.ok(/^X:1/m.test(noX[0].abc), 'X: 헤더 보강');
  assert.deepEqual(LibraryCore.splitAbcTunes('   ', 'x'), []);  // 빈 파일
});

test('mergeEntries: 누적 합치기 — id·(제목+내용) 중복은 건너뜀', () => {
  const local = [
    { id: 'a', title: '곡A', abc: 'X:1\nK:C\nC4' },
    { id: 'b', title: '곡B', abc: 'X:1\nK:C\nD4' }
  ];
  const remote = [
    { id: 'a', title: '곡A', abc: 'X:1\nK:C\nC4' },              // 같은 id → 건너뜀
    { id: 'z', title: '곡B', abc: 'X:1\nK:C\nD4' },              // id 다르지만 제목+내용 동일(다른 기기 저장) → 건너뜀
    { id: 'c', title: '곡C', abc: 'X:1\nK:C\nE4' },              // 새 곡 → 추가
    { title: '곡D', abc: 'X:1\nK:C\nF4' },                        // id 없음 → id 부여 후 추가
    { title: '', abc: 'X:1\nK:C\nG4' },                           // 제목 없음 → 무시
    { id: 'e', title: '곡E', abc: '' }                            // 내용 없음 → 무시
  ];
  let n = 0;
  const added = LibraryCore.mergeEntries(local, remote, () => 'new' + (++n));
  assert.equal(added, 2, '곡C·곡D만 추가');
  assert.equal(local.length, 4);
  assert.deepEqual(local.map(e => e.title), ['곡A', '곡B', '곡C', '곡D']);
  assert.equal(local[3].id, 'new1', 'id 없던 곡에 id 부여');
});

test('mergeEntries: 같은 제목이라도 내용이 다르면 둘 다 보존(편곡 버전)', () => {
  const local = [{ id: 'a', title: '곡A', abc: 'X:1\nK:C\nC4' }];
  const remote = [{ id: 'b', title: '곡A', abc: 'X:1\nK:G\nG4' }];
  const added = LibraryCore.mergeEntries(local, remote);
  assert.equal(added, 1);
  assert.equal(local.length, 2, '다른 편곡은 삭제하지 않고 둘 다 유지');
});

test('serialize/parsePlaylists: 플레이리스트 포함 왕복 + 예전 파일 호환', () => {
  const entries = [{ id: 'a', title: '곡', abc: 'X:1\nK:C\nC4' }];
  const sets = [{ name: '감상코스', items: [{ id: 'a', title: '곡' }], saved: 100 }];
  const json = LibraryCore.serialize(entries, sets);
  assert.deepEqual(LibraryCore.parse(json), entries, '곡 목록은 기존과 동일하게 읽힘');
  assert.deepEqual(LibraryCore.parsePlaylists(json), sets, '플레이리스트도 함께 실림');
  // 예전 형식(플레이리스트 없음) → null (에러 없이)
  assert.equal(LibraryCore.parsePlaylists(LibraryCore.serialize(entries)), null);
  assert.equal(LibraryCore.parsePlaylists('깨진{'), null);
});

test('mergePlaylists: 이름 기준 — 새 이름 추가, 같은 이름은 최근 저장본이 이김', () => {
  const local = [
    { name: '감상코스', items: [{ id: 'a', title: 'A' }], saved: 200 },
    { name: '드라이브', items: [{ id: 'b', title: 'B' }], saved: 100 }
  ];
  const incoming = [
    { name: '감상코스', items: [{ id: 'x', title: 'X' }], saved: 150 },          // 더 오래됨 → 무시
    { name: '드라이브', items: [{ id: 'y', title: 'Y' }, { id: 'z', title: 'Z' }], saved: 300 }, // 더 최근 → 교체
    { name: '댄스곡', items: [{ id: 'd', title: 'D' }], saved: 50 },              // 새 이름 → 추가
    { name: '망가진것' },                                                          // items 없음 → 무시
    { items: [{ id: 'q' }] }                                                       // 이름 없음 → 무시
  ];
  const ch = LibraryCore.mergePlaylists(local, incoming);
  assert.deepEqual(ch, { added: 1, updated: 1 });
  assert.equal(local.length, 3);
  assert.deepEqual(local[0].items.map(i => i.id), ['a'], '더 오래된 원격은 무시');
  assert.deepEqual(local[1].items.map(i => i.id), ['y', 'z'], '더 최근 원격이 교체');
  assert.equal(local[1].saved, 300);
  assert.equal(local[2].name, '댄스곡', '새 이름 추가');
});
