// MixerCore 유닛 테스트 — mixer.html에서 엔진을 추출해 실행
// 실행: node --test tests/mixer-core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'mixer.html'), 'utf8');
const m = html.match(/<script id="mixer-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'mixer.html에 <script id="mixer-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'mixer-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const MX = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

const bodyLine = abc => abc.split(/K:[^\n]*\n/)[1].replace(/\n/g, ' ').trim();

test('parseSong: 헤더와 마디 분리, 도돌이 제거', () => {
  const s = MX.parseSong('X:1\nT:t\nM:3/4\nL:1/16\nQ:1/4=120\nK:D\n|: "D"D2 E2 F2 :| "A"A2 F2 D2 |]');
  assert.equal(s.key, 'D'); assert.equal(s.meter, '3/4'); assert.equal(s.unit, '1/16');
  assert.deepEqual(s.bars, ['"D"D2 E2 F2', '"A"A2 F2 D2'], '도돌이 제거 + 마디 분리');
});

test('transposeBody: C→G(+7) 음·코드 이조', () => {
  assert.equal(MX.transposeBody('"C"C2 E2 G2 c2', 7, 'C', false, 1), '"G"G2 B2 d2 g2');
  // Am +3 → Cm (C·Eb·G). C장조는 샵 표기라 Eb는 ^d(D#)로 — 소리는 동일(이명동음)
  assert.equal(MX.transposeBody('"Am"A2 c2 e2', 3, 'C', false, 1), '"Cm"c2 ^d2 g2', 'Am +3 → Cm');
});

test('transposeBody: 조표 반영(D조의 F는 F#)', () => {
  // D조에서 표기 없는 F는 실제 F#. +0 이조라도 조표를 명시적으로 살려 재출력
  assert.equal(MX.transposeBody('F2 A2', 0, 'D', false, 1), '^F2 A2');
});

test('transposeBody: 길이 스케일(16분→8분은 절반 길이)', () => {
  // B가 1/16, A가 1/8 → lenScale = 16/8 = 2 (같은 실길이 유지 위해 숫자 2배)
  assert.equal(MX.transposeBody('C2 E4', 0, 'C', false, 2), 'C4 E8');
});

test('weave: 무작위 아님 · 고르게 분포 · 개수 정확', () => {
  const w = MX.weave(10, 3, 0);
  assert.equal(w.filter(x => x === 'A').length, 3, 'A 3마디');
  assert.equal(w.length, 10);
  // 고르게: 두 A 사이 간격이 비슷(몰리지 않음)
  const idx = w.map((x, i) => x === 'A' ? i : -1).filter(i => i >= 0);
  assert.ok(idx[1] - idx[0] >= 2 && idx[2] - idx[1] >= 2, '고르게 퍼짐');
});

test('mix: 다른 조 두 곡을 A조로 맞춰 섞음', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nQ:1/4=90\nK:C\n"C"C2 E2 G2 c2 | "G"G2 E2 C4 | "F"F2 A2 c2 f2 | "C"c2 G2 E4 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:G\n"G"G2 B2 d2 g2 | "D"D2 B2 G4 | "Em"E2 G2 B2 e2 | "C"c2 G2 E4 |';
  const r = MX.mix(A, B, { ratioB: 70 });
  assert.ok(r.ok);
  assert.equal(r.total, 4);
  assert.equal(r.aCount, 1, '30% of 4 ≈ 1 A마디');
  assert.equal(r.pattern.filter(x => x === 'A').length, 1);
  assert.ok(/K:C/.test(r.abc), '결과는 A조(C)');
  assert.ok(!r.warns.length, '박자 같으면 경고 없음');
  // B의 Em 마디가 C조로 이조되면 Am 코드가 됨(G→C는 +5)
  assert.ok(/"Am"/.test(r.abc), 'Em → Am 이조');
});

test('mix: 박자 다르면 경고', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 |';
  const B = 'X:1\nM:3/4\nL:1/8\nK:C\nC2 E2 G2 |';
  const r = MX.mix(A, B, { ratioB: 50 });
  assert.ok(r.ok && r.warns.length >= 1 && /박자/.test(r.warns[0]));
});

test('mix: 비율 100이면 전부 B(A 0마디)', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nK:C\nC4 C4 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:C\nG4 G4 | E4 E4 |';
  const r = MX.mix(A, B, { ratioB: 100 });
  assert.equal(r.aCount, 0);
  assert.ok(r.pattern.every(x => x === 'B'));
});
