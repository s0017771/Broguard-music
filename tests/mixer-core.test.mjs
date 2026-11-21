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

test('splitBarHalf: 마디를 반으로 나눔(경계 넘는 음은 잘라 재발음)', () => {
  assert.deepEqual(MX.splitBarHalf('C2 E2 G2 c2', 4), ['C2 E2', 'G2 c2'], '고르게 절반');
  assert.deepEqual(MX.splitBarHalf('C8', 4), ['C4', 'C4'], '온음표는 반으로 잘림');
  assert.deepEqual(MX.splitBarHalf('"C"C3 E1 G4', 4), ['"C"C3 E', 'G4'], '코드기호 유지');
});

test('mix(half): 반마디 단위로 섞으면 한 마디 안에 두 곡이 섞인다', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nK:C\n"C"C2 E2 G2 c2 | "F"F2 A2 c2 f2 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:C\n"G"G2 B2 d2 g2 | "Am"A2 c2 e2 a2 |';
  const r = MX.mix(A, B, { ratioB: 50, granularity: 'half' });
  assert.equal(r.slotsPerBar, 2, '반마디 = 마디당 2슬롯');
  assert.equal(r.nSlots, 4, '2마디 × 2 = 4슬롯');
  assert.equal(r.pattern.filter(x => x === 'A').length, 2, '50%면 A 2슬롯');
  // 한 마디 안에 A 절반 + B 절반이 섞여 있어야(마디 통째 모드보다 촘촘)
  const barMode = MX.mix(A, B, { ratioB: 50, granularity: 'bar' });
  assert.notEqual(r.abc, barMode.abc, '반마디 결과는 마디 통째와 다르다');
  assert.ok(/반마디/.test(r.abc), '제목에 반마디 표기');
});

test('mix: 비율 100이면 전부 B(A 0마디)', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nK:C\nC4 C4 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:C\nG4 G4 | E4 E4 |';
  const r = MX.mix(A, B, { ratioB: 100 });
  assert.equal(r.aCount, 0);
  assert.ok(r.pattern.every(x => x === 'B'));
});

test('rhythmMelodyBar: A 리듬(길이) 유지 + B 멜로디(음정) 배분', () => {
  // 슬롯 수가 같으면 그대로 대응 — A 길이, B 음정·코드
  assert.equal(MX.rhythmMelodyBar('C2 E2 G2 c2', '"G"G2 B2 d2 g2'), '"G"G2 B2 d2 g2');
  // A 리듬이 다르면 A 길이를 그대로 쓰되 음정만 B에서: 온음표 두 개 → B의 4음을 2슬롯에 배분
  assert.equal(MX.rhythmMelodyBar('C4 C4', '"C"C2 E2 G2 c2'), '"C"C4 G4', 'B 4음을 A 2슬롯에 고르게');
});

test('rhythmMelodyBar: A 쉼표는 그대로 두고 음 슬롯에만 B 멜로디', () => {
  // A: E4 z2 F2 (음 2 + 쉼표 1), B: C E G → 쉼표 위치 보존
  assert.equal(MX.rhythmMelodyBar('E4 z2 F2', '"C"C2 E2 G2'), '"C"C4 z2 E2', 'A 쉼표 유지');
  // A가 전부 쉼표면 원본 그대로(붙일 음 없음)
  assert.equal(MX.rhythmMelodyBar('z4 z4', '"C"C2 E2 G2 c2'), 'z4 z4', 'A 전부 쉼표면 유지');
});

test('rhythmMelodyBar: B 음이 A 슬롯보다 적으면 반복 배분', () => {
  // A 4슬롯, B 2음 → B 음정이 늘어나며 채워짐
  assert.equal(MX.rhythmMelodyBar('C2 C2 C2 C2', '"C"e2 e4'), '"C"e2 e2 e2 e2', 'B 적으면 채움');
});

test('crossBar: 반마디 교차 — 앞=A리듬+B멜로디, 뒤=B리듬+A멜로디', () => {
  // 앞 반마디: A(C E)의 리듬에 B(G B)의 음정 → "G"G2 B2
  // 뒤 반마디: B(d g)의 리듬에 A(G c)의 음정 → G2 c2 (역할 뒤바뀜)
  assert.equal(MX.crossBar('C2 E2 G2 c2', '"G"G2 B2 d2 g2', 4), '"G"G2 B2 G2 c2');
});

test('mix(rmCross): 반마디 교차 모드 · B곡을 A조로 이조', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nQ:1/4=90\nK:C\n"C"C2 E2 G2 c2 | "F"F2 A2 c2 f2 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:G\n"G"G2 B2 d2 g2 | "Em"E2 G2 B2 e2 |';
  const r = MX.mix(A, B, { mode: 'rmCross' });
  assert.ok(r.ok);
  assert.equal(r.mode, 'rmCross');
  assert.equal(r.total, 2);
  assert.equal(r.shift, 5, 'G→C는 +5반음');
  assert.ok(/K:C/.test(r.abc), '결과는 A조(C)');
  assert.ok(/T:곡 믹서 \(반마디 교차\)/.test(r.abc), '제목 표기');
  // 첫 마디: 앞반 = A리듬+B멜로디(C조 이조), 뒤반 = B리듬+A멜로디
  assert.ok(/"C"c2 e2 G2 c2/.test(r.abc), '반마디마다 역할 교차');
  // 둘째 마디: Em→Am 이조가 앞반 멜로디에 반영
  assert.ok(/"Am"/.test(r.abc), 'Em → Am 이조');
});

test('mix(rhythmMelody): 모든 마디 A리듬+B멜로디 · B곡을 A조로 이조', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nQ:1/4=90\nK:C\n"C"C2 E2 G2 c2 | "F"F2 A2 c2 f2 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:G\n"G"G2 B2 d2 g2 | "Em"E2 G2 B2 e2 |';
  const r = MX.mix(A, B, { mode: 'rhythmMelody' });
  assert.ok(r.ok);
  assert.equal(r.mode, 'rhythmMelody');
  assert.equal(r.total, 2);
  assert.equal(r.shift, 5, 'G→C는 +5반음');
  assert.equal(r.fromKey, 'G'); assert.equal(r.toKey, 'C');
  assert.ok(/K:C/.test(r.abc), '결과는 A조(C)');
  assert.ok(/T:곡 믹서 \(A리듬 \+ B멜로디\)/.test(r.abc), '제목 표기');
  // B의 Em 마디가 C조로 이조되면 Am 코드
  assert.ok(/"Am"/.test(r.abc), 'Em → Am 이조');
  // 첫 마디: A의 8분×4 리듬에 B의 G장조 멜로디(C조로 이조)
  assert.ok(/"C"c2 e2 g2 c'2/.test(r.abc), 'A 리듬 유지 + B 멜로디 이조');
});

test('voiceTexts: 2성부 분리, 단선율은 bass 없음', () => {
  const v = MX.voiceTexts('X:1\nM:4/4\nL:1/8\nK:C\n[V:1] "C"C2 E2 G2 c2 |\n[V:2] C,4 G,4 |');
  assert.ok(/C2 E2/.test(v.melody) && !/C,4/.test(v.melody), '멜로디 성부만');
  assert.ok(/C,4 G,4/.test(v.bass), '베이스 성부');
  const s = MX.voiceTexts('X:1\nK:C\nC2 E2 |');
  assert.equal(s.bass, null, '단선율은 베이스 없음');
});

test('suitBassBar: 근음 차이 이동 + 화음 성질(장·단) 보정', () => {
  // A: C장화음 베이스 C, E(장3도) → B: Am(단화음) — 근음 -3 이동 후 3도 보정
  const out = MX.suitBassBar('C,2 E,2 G,2 E,2', { pc: 0, kind: 0 }, { pc: 9, kind: 1 }, 'C', 'C');
  // C(48)-3=45 A,, / E(52)-3=49 C#→단3도 보정 48 C, / G(55)-3=52 E,
  assert.equal(out, 'A,,2 C,2 E,2 C,2', 'Am 분산화음으로: ' + out);
});

test('suitBassBar: 장화음 대상일 때 단3도 → 장3도 보정', () => {
  // A: Am(단) 베이스 A, C(단3도) → B: C(장) — +3 이동하면 C, Eb → Eb를 E로 보정
  const out = MX.suitBassBar('A,2 C2', { pc: 9, kind: 1 }, { pc: 0, kind: 0 }, 'C', 'C');
  assert.equal(out, 'C2 E2', '장3도로 보정: ' + out);
});

test('mixSuit: B 멜로디·코드·조성 + A 리듬·템포·베이스', () => {
  const A = 'X:1\nT:리듬곡\nM:4/4\nL:1/16\nQ:1/4=104\nK:C\n[V:1] "C"C2C2 C2D2 E2E2 G4 | "G"D2D2 D2E2 F2F2 A4 |\n[V:2] C,2[CE]2C,2[CE]2 C,2[CE]2C,2[CE]2 | G,2[B,D]2G,2[B,D]2 G,2[B,D]2G,2[B,D]2 |';
  const B = 'X:1\nT:멜로디곡\nM:4/4\nL:1/8\nQ:1/4=70\nK:Am\n"Am"A2 c2 e2 a2 | "Em"g2 e2 B2 e2 | "F"f2 a2 c2 f2 | "E"e2 ^g2 b2 e2 |';
  const r = MX.mix(A, B, { mode: 'suit' });
  assert.ok(r.ok, (r.warns || []).join(','));
  assert.equal(r.total, 4, 'B의 4마디가 주인');
  assert.ok(/M:4\/4/.test(r.abc) && /L:1\/16/.test(r.abc) && /Q:1\/4=104/.test(r.abc), '박자·단위·템포는 A');
  assert.ok(/K:Am/.test(r.abc), '조성은 B');
  assert.ok(/%%score/.test(r.abc) && /\[V:2\]/.test(r.abc), 'A 베이스 패턴으로 2성부');
  assert.ok(/"Am"/.test(r.abc) && /"Em"/.test(r.abc) && /"F"/.test(r.abc), 'B의 코드 그대로');
  // 1마디 베이스: A의 움-파(C,+[CE])가 Am 근음으로: C,→A,, / [CE]→[AC](보정 포함)
  const v2 = r.abc.split('\n').find(l => l.startsWith('[V:2]'));
  assert.ok(/A,,2 \[A,C\]2 A,,2 \[A,C\]2/.test(v2), 'Am 움-파 베이스: ' + v2);
  assert.ok(/E,2 \[\^G,B,\]2/.test(v2), 'E장화음 보정(G#) + 임시표: ' + v2);
});

test('mixSuit: 박자가 다르면 거절, A에 베이스 없으면 단선율 + 경고', () => {
  const bad = MX.mix('X:1\nM:3/4\nL:1/8\nK:C\nC2 E2 G2 |', 'X:1\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 |', { mode: 'suit' });
  assert.equal(bad.ok, false);
  assert.ok(/박자가 같아야/.test(bad.warns[0]));
  const nb = MX.mix('X:1\nM:4/4\nL:1/8\nK:C\n"C"C2 E2 G2 c2 |', 'X:1\nM:4/4\nL:1/8\nK:G\n"G"G2 B2 d2 g2 |', { mode: 'suit' });
  assert.ok(nb.ok && !/\[V:2\]/.test(nb.abc), '단선율 출력');
  assert.ok(nb.warns.some(w => /베이스 성부가 없어/.test(w)), '경고 안내');
});

test('mixSuit 변주: 결정적(같은 입력=같은 결과) + 변주마다 서로 다른 배치', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nK:C\n[V:1] "C"C2C2 D2E2 | "F"F4 A2c2 | "G"GGAB c2d2 |\n[V:2] C,2[CE]2C,2[CE]2 | F,8 | G,2G,2G,2G,2 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:Am\n"Am"A2 B2 c2 e2 | "Dm"d2 f2 a2 d2 | "E"e2 ^g2 b2 e2 |';
  const base1 = MX.mix(A, B, { mode: 'suit', vari: 0 });
  const base2 = MX.mix(A, B, { mode: 'suit', vari: 0 });
  assert.equal(base1.abc, base2.abc, '기본: 두 번 돌려도 동일');
  const v1 = MX.mix(A, B, { mode: 'suit', vari: 1 });
  const v2 = MX.mix(A, B, { mode: 'suit', vari: 2 });
  const v3 = MX.mix(A, B, { mode: 'suit', vari: 3 });
  assert.equal(MX.mix(A, B, { mode: 'suit', vari: 1 }).abc, v1.abc, '변주1도 재현 가능');
  assert.notEqual(v1.abc, base1.abc, '변주1 ≠ 기본 (리듬 한 마디 밀기)');
  assert.notEqual(v2.abc, base1.abc, '변주2 ≠ 기본 (리듬 역순)');
  assert.notEqual(v2.abc, v1.abc, '변주2 ≠ 변주1');
  assert.notEqual(v3.abc, base1.abc, '변주3 ≠ 기본 (멜로디 양끝 강조)');
  assert.ok(/변주 1/.test(v1.abc) && v1.vari === 1, '제목·결과에 변주 번호');
  assert.ok(!/변주/.test(base1.abc), '기본은 변주 표기 없음');
});

test('parseBarElements: 셋잇단·화음 내부길이·당김리듬까지 마디 길이 정확(성부 벌어짐 방지)', () => {
  const sum = els => els.reduce((t, e) => t + e.dur, 0);
  const t1 = MX.parseBarElements('(3CDE F2 G2 A2');
  assert.ok(Math.abs(sum(t1) - 8) < 1e-6, '셋잇단 포함 8: ' + sum(t1));
  assert.ok(Math.abs(t1[0].dur - 2 / 3) < 1e-6, '셋잇단 한 음 = 2/3');
  const t2 = MX.parseBarElements('[C2E2] G2 c4');
  assert.ok(Math.abs(sum(t2) - 8) < 1e-6, '화음 내부길이 반영 8: ' + sum(t2));
  const t3 = MX.parseBarElements('C>D E2 F2 G2');
  assert.ok(Math.abs(t3[0].dur - 1.5) < 1e-6 && Math.abs(t3[1].dur - 0.5) < 1e-6, '당김리듬 1.5/0.5');
  assert.equal(MX.lenToAbc(2 / 3), '2/3', '셋잇단 길이 표기');
});

test('mixSuit: 셋잇단 템플릿에도 멜로디·베이스 마디 길이가 항상 같다', () => {
  const A = 'X:1\nM:4/4\nL:1/8\nK:C\n[V:1] "C"(3CDE (3EFG G2 c2 | "G"B2 A2 G2 D2 |\n[V:2] C,2 G,2 C2 G,2 | G,2 D2 G,2 D2 |';
  const B = 'X:1\nM:4/4\nL:1/8\nK:Am\n"Am"A2 c2 e2 a2 | "Dm"d2 f2 a2 f2 | "E"e2 ^g2 b2 e2 | "Am"a2 e2 c2 A2 |';
  const r = MX.mix(A, B, { mode: 'suit' });
  assert.ok(r.ok);
  const sum = bar => MX.parseBarElements(bar).reduce((t, e) => t + e.dur, 0);
  const melLines = r.abc.split('\n').filter(l => l.startsWith('[V:1]'));
  const bassLines = r.abc.split('\n').filter(l => l.startsWith('[V:2]'));
  const melBars = melLines.join(' ').replace(/\[V:1\]/g, '').split('|').map(x => x.trim()).filter(Boolean);
  const bassBars = bassLines.join(' ').replace(/\[V:2\]/g, '').split('|').map(x => x.trim()).filter(Boolean);
  assert.equal(melBars.length, bassBars.length, '마디 수 동일');
  for (let i = 0; i < melBars.length; i++) {
    assert.ok(Math.abs(sum(melBars[i]) - sum(bassBars[i])) < 1e-3, (i + 1) + '마디 길이 일치: ' + sum(melBars[i]) + ' vs ' + sum(bassBars[i]));
  }
});

test('parseBarElements: 코드+지시 연속 따옴표("E7""^rit.")에서 유령 음표가 생기지 않는다', () => {
  const sum = els => els.reduce((t, e) => t + e.dur, 0);
  // 예전 버그: "E7"의 E를 7박 음표로, "Gm"의 G를 1박 음표로 잘못 읽어 첫 마디가 길어졌다
  const t1 = MX.parseBarElements('"E7""^rit."c3 A B4');
  assert.ok(Math.abs(sum(t1) - 8) < 1e-6, '유령 박 없이 8: ' + sum(t1));
  assert.equal(t1[0].pre, '"E7""^rit."', '코드·지시는 첫 음표에 함께 붙음');
  const t2 = MX.parseBarElements('"Gm""^장난스럽게"d2d2 d2dc B2G2 B4');
  assert.ok(Math.abs(sum(t2) - 16) < 1e-6, '섹션 머리도 정확: ' + sum(t2));
  const t3 = MX.parseBarElements('"C"C2 E2 G2 c2');   // 단일 따옴표 기존 동작 유지
  assert.equal(t3[0].pre, '"C"');
  assert.ok(Math.abs(sum(t3) - 8) < 1e-6);
});
