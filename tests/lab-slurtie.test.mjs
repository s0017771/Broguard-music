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
// 본문 한 줄만 편하게 비교
const body = s => T('X:1\nM:4/4\nL:1/16\nK:C\n' + s).split('\n').slice(4).join('\n');

test('같은 음 슬러 → 직전 음 뒤에 붙임줄 삽입', () => {
  assert.equal(body('(G2 G2) z8 |]'), '(G2- G2) z8 |]');
});

test('세 음 이상 같은 음 슬러도 모두 이어붙임', () => {
  assert.equal(body('(G2 G2 G2) z4 |]'), '(G2- G2- G2) z4 |]');
});

test('서로 다른 음의 슬러는 건드리지 않음(프레이징 유지)', () => {
  assert.equal(body('(G2 A2) |]'), '(G2 A2) |]');
  assert.equal(body('(C E G) |]'), '(C E G) |]');
});

test('슬러 안에서 같은 음만 선택적으로 이어붙임', () => {
  assert.equal(body('(G2 G2 A2) |]'), '(G2- G2 A2) |]');
  assert.equal(body('(A2 G2 G2) |]'), '(A2 G2- G2) |]');
});

test('슬러 밖의 반복 음은 그대로(마크 없으면 두 음 유지)', () => {
  assert.equal(body('G2 G2 |]'), 'G2 G2 |]');
});

test('슬러 밖 음과 슬러 안 첫 음은 잇지 않음(과잉 병합 방지)', () => {
  // ( 앞의 G2 에는 붙임줄이 붙으면 안 되고, 슬러 안 같은 음끼리만 이어짐
  assert.equal(body('G2F2G2(G2 G2) z2 |]'), 'G2F2G2(G2- G2) z2 |]');
});

test('마디선·코드기호를 건너뛰는 이음줄(실제 악보 형태)', () => {
  assert.equal(body('E2F2E2(G2 |"Em"G8) z2 |]'), 'E2F2E2(G2- |"Em"G8) z2 |]');
  assert.equal(body('C2(A2|"F"A2)A2 |]'), 'C2(A2-|"F"A2)A2 |]');
  assert.equal(body('(E2 "G/F"E2) |]'), '(E2- "G/F"E2) |]');
});

test('임시표·옥타브 표기까지 같아야 이어붙임', () => {
  assert.equal(body('(^F2 ^F2) |]'), '(^F2- ^F2) |]');
  assert.equal(body("(C,2 C,2) |]"), '(C,2- C,2) |]');
  assert.equal(body('(C2 c2) |]'), '(C2 c2) |]');  // 옥타브 다름 → 유지
});

test('쉼표(z)가 끼면 잇지 않음', () => {
  assert.equal(body('(G2 z2 G2) |]'), '(G2 z2 G2) |]');
});

test('셋잇단( (3 )은 슬러가 아니므로 붙임줄 없음', () => {
  assert.equal(body('(3G2G2G2 z8 |]'), '(3G2G2G2 z8 |]');
});

test('이미 붙임줄(-)이 있으면 중복 삽입 안 함', () => {
  assert.equal(body('(G2-G2) |]'), '(G2-G2) |]');
});

test('줄바꿈을 건너뛰는 이음줄(다음 줄에서 닫힘)', () => {
  assert.equal(body('G2(F2 |\n"Dm"F2) z8 |]'), 'G2(F2- |\n"Dm"F2) z8 |]');
});

test('주석(%)줄을 건너뛰는 이음줄도 이어짐', () => {
  assert.equal(body('G2(F2 |\n% 코멘트 (m1)\n"Dm"F2) z8 |]'), 'G2(F2- |\n% 코멘트 (m1)\n"Dm"F2) z8 |]');
});

test('헤더 줄(T:, K: 등)은 절대 변형하지 않음', () => {
  const out = T('X:1\nT:(Song G G)\nK:C\n(G2 G2) |]').split('\n');
  assert.equal(out[1], 'T:(Song G G)', '제목 줄 보존');
  assert.equal(out[3], '(G2- G2) |]');
});

/* ── 한글 IME 전각 문자 대응 ── */
test('전각 괄호 （ ）·공백 　·대시 －/— 정규화 후 병합', () => {
  assert.equal(body('（G2 G2） |]'), '(G2- G2) |]');
  assert.equal(body('（G2　G2） |]'), '(G2- G2) |]');
  assert.equal(body('G2－G2 |]'), 'G2-G2 |]');
  assert.equal(body('G2—G2 |]'), 'G2-G2 |]');
  assert.equal(body('（G2 A2） |]'), '(G2 A2) |]'); // 다른 음은 유지
});

/* ── MIDI 경로(좋은 소리로 / 사운드폰트)도 한 음으로 이어져야 함 ── */
const HEAD = 'X:1\nM:4/4\nL:1/16\nQ:1/4=120\nK:C\n';

test('parseABC: 같은 음 슬러를 정규화하면 한 음(합산 길이)으로 병합', () => {
  const merged = AbcMidi.parseABC(T(HEAD + '(G2 G2) |')).voices['1'].events.filter(e => e.type === 'note');
  const single = AbcMidi.parseABC(HEAD + 'G4 |').voices['1'].events.filter(e => e.type === 'note');
  assert.equal(merged.length, 1, '두 음이 하나로 병합');
  assert.equal(merged[0].dur, single[0].dur, 'G4(한 음)와 같은 길이');
});

test('abcToMidi: 같은 음 슬러가 G4(한 음)와 동일한 MIDI를 만든다', () => {
  const slur = AbcMidi.abcToMidi(HEAD + '(G2 G2) z8 |');
  const one = AbcMidi.abcToMidi(HEAD + 'G4 z8 |');
  assert.deepEqual([...slur], [...one], '슬러 병합 결과가 한 음 악보와 바이트까지 동일');
});

test('abcToMidi: 마디 건너뛰는 이음줄도 한 음(합산 길이)으로', () => {
  // (G2 |"Em"G8) → G 2/16 + 8/16 = 10/16, C10 한 음과 같은 총 길이의 G가 되어야
  const merged = AbcMidi.parseABC(T(HEAD + 'z6 (G2 |"Em"G8) |')).voices['1'].events.filter(e => e.type === 'note');
  assert.equal(merged.length, 1, '마디 건너 한 음으로 병합');
  assert.equal(merged[0].dur, 10, '2+8 = 10 (L=1/16 단위)');
});

test('abcToMidi: 서로 다른 음의 슬러는 병합하지 않음(두 음 유지)', () => {
  const twoDiff = AbcMidi.abcToMidi(HEAD + '(G2 A2) z8 |');
  const oneNote = AbcMidi.abcToMidi(HEAD + 'G4 z8 |');
  assert.notDeepEqual([...twoDiff], [...oneNote], '다른 음 슬러는 한 음이 되면 안 됨');
});
