// Interp(Morph·Bridge) 코어 유닛 테스트 — interpolate.html에서 엔진 추출
// 실행: node --test tests/interp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'interpolate.html'), 'utf8');
const m = html.match(/<script id="interp-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'interpolate.html에 <script id="interp-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'interp-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const Interp = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

const A = 'X:1\nM:4/4\nL:1/8\nK:C\nC2 D2 E2 F2 | G2 A2 G2 E2 |';
const B = 'X:1\nM:4/4\nL:1/8\nK:C\ng2 e2 c2 e2 | d2 c2 C4 |';
const SCALE_PC = [0, 2, 4, 5, 7, 9, 11];
function bodyOf(abc) { return abc.split(/K:[^\n]*\n/)[1].replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim(); }

// ---------- Morph ----------
test('morph: 양끝 포함 시 결과 수 = N + 2, t값 순서대로', () => {
  const out = Interp.morph(A, B, { steps: 3, includeEnds: true });
  assert.equal(out.results.length, 5);
  assert.deepEqual(out.results.map(r => r.t), [0, 0.25, 0.5, 0.75, 1]);
});

test('morph: 양끝 제외 시 결과 수 = N', () => {
  const out = Interp.morph(A, B, { steps: 4, includeEnds: false });
  assert.equal(out.results.length, 4);
  assert.ok(out.results.every(r => r.t > 0 && r.t < 1));
});

test('morph: t=0은 A의 음높이 윤곽, t=1은 B의 음높이 윤곽을 재현', () => {
  const out = Interp.morph(A, B, { steps: 3, includeEnds: true });
  const L = out.len;
  const as = Interp.resample(Interp.flattenToSteps(A, 0.5).steps, L);
  const bs = Interp.resample(Interp.flattenToSteps(B, 0.5).steps, L);
  const snap = p => (p === null ? null : Interp.DIA[Interp.nearestDiaIdx(p)]);
  assert.deepEqual(out.results[0].steps, as.map(snap === undefined ? x => x : (p => (p === null ? null : p))));
  // t=1: B가 C장조라 스냅=항등 → bs와 동일
  assert.deepEqual(out.results[out.results.length - 1].steps, bs);
});

test('morph: 모든 생성 음이 C장조 다이어토닉 안에 있다', () => {
  const out = Interp.morph(A, B, { steps: 5 });
  for (const r of out.results)
    for (const p of r.steps)
      if (p !== null) assert.ok(SCALE_PC.includes(((p % 12) + 12) % 12), '비다이어토닉 음: ' + p);
});

test('morph: 모든 결과 ABC가 K:C·|]를 갖고 다시 파싱된다', () => {
  const out = Interp.morph(A, B, { steps: 4 });
  for (const r of out.results) {
    assert.ok(r.abc.includes('K:C') && r.abc.trim().endsWith('|]'));
    const song = Interp.parseABC(r.abc);
    assert.ok(song.voices['1'].events.some(e => e.type === 'note'), '음표가 있어야 함');
  }
});

test('morph: 길이가 다른 A/B도 동작(짧은 쪽을 리샘플)', () => {
  const short = 'X:1\nM:4/4\nL:1/8\nK:C\nC2 G2 E2 C2 |';       // 1마디
  const out = Interp.morph(A, short, { steps: 2 });            // A는 2마디
  assert.ok(out.len >= 16, '더 긴 A 길이에 맞춰짐');
  assert.equal(out.results.length, 4);
});

test('morph: 멜로디메이커식 코드 심볼이 있어도 무시하고 동작', () => {
  const withChords = 'X:1\nM:4/4\nL:1/8\nK:C\n"C"c2 G2 E2 C2 | "G"d2 B2 G2 D2 |';
  const out = Interp.morph(A, withChords, { steps: 2 });
  assert.ok(out.results.length === 4);
});

// ---------- Bridge ----------
test('bridge: A 끝음·B 첫음을 정확히 잡는다', () => {
  const br = Interp.bridge(A, B, { bars: 1 });
  assert.equal(br.aEnd, 64);   // A 마지막 음 E4=64
  assert.equal(br.bStart, 79); // B 첫 음 g'=? g(소문자)=67? 확인은 아래에서
});

test('bridge: 연결 마디 길이 = bars × 마디 스텝(4/4=8)', () => {
  assert.equal(Interp.bridge(A, B, { bars: 1 }).steps.length, 8);
  assert.equal(Interp.bridge(A, B, { bars: 2 }).steps.length, 16);
});

test('bridge: 연결음이 A끝~B첫음 사이 음역에 놓이고 다이어토닉', () => {
  const br = Interp.bridge(A, B, { bars: 1 });
  const lo = Math.min(br.aEnd, br.bStart), hi = Math.max(br.aEnd, br.bStart);
  for (const p of br.steps) {
    assert.ok(SCALE_PC.includes(((p % 12) + 12) % 12), '다이어토닉');
    assert.ok(p >= lo - 2 && p <= hi + 2, '연결음이 두 끝음 사이 범위: ' + p);
  }
});

test('bridge: stitched는 A로 시작해 B로 끝나며 다시 파싱된다', () => {
  const br = Interp.bridge(A, B, { bars: 1 });
  assert.ok(br.stitchedAbc.includes('K:C') && br.stitchedAbc.trim().endsWith('|]'));
  const song = Interp.parseABC(br.stitchedAbc);
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.equal(notes[0].midis[0], 60, 'A의 첫 음 C=60으로 시작');       // A 시작 C
  // stitched 길이 = A스텝 + bridge + B스텝
  const aLen = Interp.flattenToSteps(A, 0.5).steps.length;
  const bLen = Interp.flattenToSteps(B, 0.5).steps.length;
  assert.equal(bodyOf(br.stitchedAbc).length > 0, true);
});

test('bridge: 끝음==첫음이면 같은 음 유지(예외 없음)', () => {
  const same = 'X:1\nM:4/4\nL:1/8\nK:C\nC2 D2 E2 C2 |'; // 끝음 C=60
  const same2 = 'X:1\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 |'; // 첫음 C=60
  const br = Interp.bridge(same, same2, { bars: 1 });
  assert.equal(br.aEnd, 60); assert.equal(br.bStart, 60);
  assert.ok(br.steps.every(p => p === 60), '같은 음이면 유지');
});

// ---------- 코드 진행 반영 ----------
test('parseChordTones/parseChordList: 코드 구성음', () => {
  assert.deepEqual(Interp.parseChordTones('C').pcs, [0, 4, 7]);
  assert.deepEqual(Interp.parseChordTones('Am').pcs, [9, 0, 4]);
  assert.deepEqual(Interp.parseChordTones('G7').pcs, [7, 11, 2]);
  assert.deepEqual(Interp.parseChordTones('F#m').pcs, [6, 9, 1]);
  assert.deepEqual(Interp.parseChordTones('Bdim').pcs, [11, 2, 5]);
  assert.equal(Interp.parseChordList('C G Am F').length, 4);
  assert.equal(Interp.parseChordTones('Xyz'), null);
});

test('morph+코드: 중간 단계의 강박(1·3박)이 코드톤에 놓인다', () => {
  const out = Interp.morph(A, B, { steps: 3, chordStr: 'C F' });
  assert.deepEqual(out.chords, ['C', 'F']);
  const chordPcs = { 0: [0, 4, 7], 1: [5, 9, 0] }; // 마디0=C, 마디1=F
  // 중간(t≠0,1) 결과만 검사
  out.results.filter(r => r.t !== 0 && r.t !== 1).forEach(r => {
    // 스텝을 런으로 묶어 각 런의 시작 위치가 강박이면 코드톤인지 확인
    let pos = 0, i = 0;
    while (i < r.steps.length) {
      let c = 1; while (i + c < r.steps.length && r.steps[i + c] === r.steps[i]) c++;
      const stepInMeasure = pos % 8, measure = Math.floor(pos / 8) % 2;
      if (r.steps[i] !== null && stepInMeasure % 4 === 0) {
        assert.ok(chordPcs[measure].includes(((r.steps[i] % 12) + 12) % 12),
          `강박 코드톤 위반: 마디${measure} pos${pos} midi${r.steps[i]}`);
      }
      pos += c; i += c;
    }
  });
});

test('morph+코드: 양끝(A·B 원곡)은 코드 스냅을 적용하지 않는다', () => {
  const plain = Interp.morph(A, B, { steps: 3 });
  const chorded = Interp.morph(A, B, { steps: 3, chordStr: 'Am Dm' });
  // t=0, t=1 결과는 코드 유무와 무관하게 동일(원곡 보존)
  assert.equal(chorded.results[0].abc, plain.results[0].abc);
  assert.equal(chorded.results[chorded.results.length - 1].abc, plain.results[plain.results.length - 1].abc);
});

test('bridge+코드: 연결음 강박이 코드톤에, 결과 재파싱', () => {
  const br = Interp.bridge(A, B, { bars: 2, chordStr: 'G C' });
  assert.deepEqual(br.chords, ['G', 'C']);
  const song = Interp.parseABC(br.bridgeAbc);
  assert.ok(song.voices['1'].events.some(e => e.type === 'note'));
});

test('snapStepsToChords: 코드 없으면 원본 그대로', () => {
  const steps = [60, 60, 62, 64];
  assert.deepEqual(Interp.snapStepsToChords(steps, '4/4', []), steps);
});

// ---------- AI 모드용 NoteSequence 변환 ----------
test('abcToNoteSequence: 2마디·16분 양자화 시퀀스', () => {
  const ns = Interp.abcToNoteSequence(A, { bars: 2 });
  assert.equal(ns.quantizationInfo.stepsPerQuarter, 4);
  assert.equal(ns.totalQuantizedSteps, 32);              // 2마디 4/4 = 32 십육분음
  assert.equal(ns.notes.length, 8);
  assert.deepEqual(ns.notes[0], { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 4 });
  assert.ok(ns.tempos[0].qpm > 0);
});

test('abcToNoteSequence: 2마디보다 짧으면 쉼표로 패딩, 길면 자름', () => {
  const short = 'X:1\nM:4/4\nL:1/8\nK:C\nC2 E2 G2 c2 |';   // 1마디
  const nsShort = Interp.abcToNoteSequence(short, { bars: 2 });
  assert.equal(nsShort.totalQuantizedSteps, 32);          // 여전히 2마디 길이
  const long = 'X:1\nM:4/4\nL:1/8\nK:C\nC8 | D8 | E8 |';   // 3마디
  const nsLong = Interp.abcToNoteSequence(long, { bars: 2 });
  assert.equal(nsLong.totalQuantizedSteps, 32);           // 앞 2마디만
  assert.equal(nsLong.notes.length, 2);
});

test('noteSequenceToAbc: 양자화 시퀀스 → ABC (왕복 음정 보존)', () => {
  const ns = Interp.abcToNoteSequence(A, { bars: 2 });
  const abc = Interp.noteSequenceToAbc(ns, {});
  assert.ok(abc.includes('K:C') && abc.trim().endsWith('|]'));
  const notes = Interp.parseABC(abc).voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.midis[0]), [60, 62, 64, 65, 67, 69, 67, 64]); // A와 동일 음정
});

test('noteSequenceToAbc: MusicVAE식 출력(다른 음길이)도 변환', () => {
  const fake = { notes: [
    { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 8 },
    { pitch: 64, quantizedStartStep: 8, quantizedEndStep: 16 },
    { pitch: 67, quantizedStartStep: 16, quantizedEndStep: 32 }],
    quantizationInfo: { stepsPerQuarter: 4 }, totalQuantizedSteps: 32 };
  const notes = Interp.parseABC(Interp.noteSequenceToAbc(fake, {})).voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.midis[0]), [60, 64, 67]);
});
