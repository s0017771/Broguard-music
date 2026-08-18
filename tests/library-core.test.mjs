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
