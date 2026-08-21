// CombineCore 유닛 테스트 — combine.html에서 엔진을 추출해 실행
// 실행: node --test tests/combine-core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'combine.html'), 'utf8');
const m = html.match(/<script id="combine-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'combine.html에 <script id="combine-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'combine-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const CC = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

const body = abc => abc.split(/K:[^\n]*\n/)[1].trim();

// ── 옥타브 (요청 2) ──
test('옥타브: 가운데/낮음/높음 구분', () => {
  assert.equal(CC.parseSyllable('도').abc + CC.parseSyllable('도').oct, 'C');
  assert.equal(CC.parseSyllable(',도').abc + CC.parseSyllable(',도').oct, 'C,');
  assert.equal(CC.parseSyllable(',,도').abc + CC.parseSyllable(',,도').oct, 'C,,');
  assert.equal(CC.parseSyllable("도'").abc + CC.parseSyllable("도'").oct, 'c');
  assert.equal(CC.parseSyllable("도''").abc + CC.parseSyllable("도''").oct, "c'");
});

test('옥타브: ^ 를 높음 별칭으로 지원(도^ = 도\')', () => {
  const a = CC.parseSyllable('도^'), b = CC.parseSyllable("도'");
  assert.equal(a.abc + a.oct, b.abc + b.oct);
  const c = CC.parseSyllable('도^^');
  assert.equal(c.abc + c.oct, "c'");
});

// ── 16분음표 옵션 (요청 1) ──
test('단위: 8분이면 L:1/8, 16분이면 L:1/16 · 마디 길이합 기준이 달라짐', () => {
  const r8 = CC.build({ rhythm: '2 2 2 2', melody: '도 레 미 파', unit: '8', meter: '4/4' });
  assert.ok(/L:1\/8/.test(r8.abc)); assert.equal(r8.beats, 8);
  assert.equal(r8.warns.length, 0, '8분 4/4에서 합 8 정상');
  const r16 = CC.build({ rhythm: '4 4 4 4', melody: '도 레 미 파', unit: '16', meter: '4/4' });
  assert.ok(/L:1\/16/.test(r16.abc)); assert.equal(r16.beats, 16);
  assert.equal(r16.warns.length, 0, '16분 4/4에서 합 16 정상(4분=4)');
});

test('16분: 1=16분음표를 표현할 수 있다', () => {
  const r = CC.build({ rhythm: '1 1 1 1 4 4 4', melody: '도 레 미 파 솔 라 시', unit: '16', meter: '4/4' });
  assert.equal(r.warns.length, 0, '16분 16칸 정상');
  assert.ok(body(r.abc).indexOf('C ') === 0, '첫 음 16분(길이 표기 없음)');
});

// ── 붙임음: 붙여쓰기 (요청 3) ──
test('붙임음: 같은 음 붙여쓰면 하나로 이어진 긴 음', () => {
  // 도도 = 2칸을 한 음으로 (길이 2+2=4), 도 도 = 두 음
  const tied = CC.combineBar('도도 레 미', '2 2 2 2', '', 0, true, 8);
  assert.equal(tied.abc, 'C4 D2 E2', '붙임음은 길이 합산(C4=2+2)');
  const sep = CC.combineBar('도 도 레 미', '2 2 2 2', '', 0, true, 8);
  assert.equal(sep.abc, 'C2 C2 D2 E2', '띄어쓰면 따로');
});

test('붙임음: 옥타브가 다르면 이어지지 않음', () => {
  const r = CC.combineBar("도도'", '2 2', '', 0, true, 4);
  assert.equal(r.abc, "C2 c2", "도와 높은 도는 다른 음 → 각각");
});

test('붙임음: 세 칸 이어붙이기', () => {
  const r = CC.combineBar('도도도', '2 2 2', '', 0, true, 6);
  assert.equal(r.abc, 'C6', '2+2+2 = 6');
});

// ── 코드 (요청 4) ──
test('코드: 한 마디에 한 코드 → 첫 음에 붙음', () => {
  const r = CC.combineBar('도 레 미 파', '2 2 2 2', 'C', 0, true, 8);
  assert.equal(r.abc, '"C"C2 D2 E2 F2');
});

test('코드: 한 마디에 두 코드 → 앞부분·중간부터 나눠 붙음', () => {
  // 4/4(합8): 슬롯 시작 0,2,4,6 → 두 번째 코드는 시작>=4 인 첫 음(=세번째, 시작4)
  const r = CC.combineBar('도 레 미 파', '2 2 2 2', 'F G', 0, true, 8);
  assert.equal(r.abc, '"F"C2 D2 "G"E2 F2');
});

test('코드: 코드 없으면 그냥 음만', () => {
  const r = CC.combineBar('도 레', '4 4', '', 0, true, 8);
  assert.equal(r.abc, 'C4 D4');
});

test('코드+붙임음 함께: 붙임 후 남은 음에 둘째 코드', () => {
  const r = CC.combineBar('도도 레 미 파', '2 2 2 2', 'C G', 0, true, 8);
  // 출력음: C4(0) D(4) E(6) F(?) — 합이 8이어야: 2+2 | 2 | 2 => C4(0) D(4) ... 실제 길이합=8
  assert.ok(/^"C"C4 /.test(r.abc), '첫 코드는 붙임음에');
  assert.ok(/"G"/.test(r.abc), '둘째 코드가 중간 음에');
});

// ── 통합 build ──
test('build: 마디 구분 r, 4마디 줄바꿈, 종지 |]', () => {
  const r = CC.build({ rhythm: '4 4 r 4 4', melody: '도 레 r 미 파', chords: 'C r G', unit: '8', meter: '4/4' });
  assert.ok(/\|\]$/.test(r.abc.trim()), '종지선');
  assert.ok(/"C"/.test(r.abc) && /"G"/.test(r.abc), '두 마디 코드');
  assert.equal(r.warns.length, 0);
});

test('build: 자동 개수 맞춤 동작', () => {
  const r = CC.build({ rhythm: '2 2 2 2', melody: '도 레', unit: '8', meter: '4/4' });
  assert.equal(r.fittedCount, 1, '음 2 vs 리듬 4 → 자동 맞춤');
  assert.equal(r.warns.length, 0);
});
