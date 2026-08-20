// slurSameToTie 유닛 테스트 — lab.html의 abcmidi-core에서 추출해 실행
// 실행: node --test tests/lab-slurtie.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'lab.html'), 'utf8');
const m = html.match(/<script id="abcmidi-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'lab.html에 <script id="abcmidi-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'labslur-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const AbcMidi = createRequire(import.meta.url)(join(tmp, 'core.cjs'));
const T = AbcMidi.slurSameToTie;

test('같은 음 슬러 → 붙임줄(공백 1칸을 - 로), 길이 보존', () => {
  const src = 'X:1\nL:1/16\nK:C\n(G2 G2) z8 |]';
  const out = T(src);
  assert.ok(out.includes('(G2-G2)'), out);
  assert.equal(out.length, src.length, '문자 수(길이) 보존');
});

test('세 음 이상 같은 음 슬러도 모두 이어붙임', () => {
  assert.ok(T('(G2 G2 G2)').includes('(G2-G2-G2)'));
});

test('서로 다른 음의 슬러는 건드리지 않음(프레이징 유지)', () => {
  assert.equal(T('(G2 A2)'), '(G2 A2)');
  assert.equal(T('(C E G)'), '(C E G)');
});

test('슬러 안에서 같은 음만 선택적으로 이어붙임', () => {
  assert.equal(T('(G2 G2 A2)'), '(G2-G2 A2)');
  assert.equal(T('(A2 G2 G2)'), '(A2 G2-G2)');
});

test('임시표·옥타브 표기까지 같아야 이어붙임', () => {
  assert.ok(T('(^F2 ^F2)').includes('(^F2-^F2)'));
  assert.ok(T("(C,2 C,2)").includes('(C,2-C,2)'));
  // 옥타브가 다르면 서로 다른 음 → 유지
  assert.equal(T('(C2 c2)'), '(C2 c2)');
});

test('슬러 밖의 반복 음은 그대로(마크 없으면 두 음 유지)', () => {
  assert.equal(T('G2 G2'), 'G2 G2');
});

test('셋잇단( (3 )은 슬러가 아니므로 건드리지 않음', () => {
  assert.equal(T('(3G2G2G2'), '(3G2G2G2');
});

test('헤더 줄(T:, K: 등)은 절대 변형하지 않음', () => {
  const src = 'X:1\nT:(Song G G)\nK:C\n(G2 G2) |]';
  const out = T(src).split('\n');
  assert.equal(out[1], 'T:(Song G G)', '제목 줄 보존');
  assert.ok(out[3].includes('(G2-G2)'));
});

test('이미 붙임줄(-)이 있으면 중복 삽입 안 함', () => {
  assert.equal(T('(G2-G2)'), '(G2-G2)');
});
