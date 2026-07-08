// AbcMidi 코어 유닛 테스트 — midi.html에서 엔진을 추출해 실행
// 실행: node --test tests/abcmidi.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'midi.html'), 'utf8');
const m = html.match(/<script id="abcmidi-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'midi.html에 <script id="abcmidi-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'abcmidi-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const AbcMidi = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

// ABC 본문에서 음/쉼표/마디만 추출(왕복 비교용)
function bodyOf(abc) {
  return abc.split(/K:[^\n]*\n/)[1].replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- ABC → MIDI: SMF 구조 ----------
test('abcToMidi: 유효한 SMF 헤더(MThd)와 트랙(MTrk)을 만든다', () => {
  const b = AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nQ:1/4=90\nK:C\nC2 D2 E2 F2 |]');
  assert.ok(b instanceof Uint8Array);
  assert.equal(String.fromCharCode(b[0], b[1], b[2], b[3]), 'MThd');
  // division(PPQ) = 480
  const ppq = (b[12] << 8) | b[13];
  assert.equal(ppq, 480);
  // 최소한 하나의 MTrk 존재
  let hasTrk = false;
  for (let i = 0; i < b.length - 3; i++) if (String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]) === 'MTrk') hasTrk = true;
  assert.ok(hasTrk, 'MTrk 트랙이 있어야 함');
});

test('abcToMidi → parseMidi: 음표 개수·피치·템포 보존', () => {
  const b = AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nQ:1/4=132\nK:C\nC2 D2 E2 F2 | G2 A2 B2 c2 |]');
  const p = AbcMidi.parseMidi(b);
  assert.equal(p.tempoBpm, 132);
  assert.deepEqual(p.timeSig, [4, 4]);
  const notes = p.tracks.flatMap(t => t.notes).sort((a, b) => a.startTick - b.startTick);
  assert.equal(notes.length, 8);
  assert.deepEqual(notes.map(n => n.midi), [60, 62, 64, 65, 67, 69, 71, 72]);
});

test('abcToMidi: 화음은 동시 시작 노트로 인코딩된다', () => {
  const b = AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nK:C\n[CEG]4 [FAc]4 |]');
  const notes = AbcMidi.parseMidi(b).tracks.flatMap(t => t.notes);
  assert.equal(notes.length, 6);
  const atZero = notes.filter(n => n.startTick === 0).map(n => n.midi).sort((a, b) => a - b);
  assert.deepEqual(atZero, [60, 64, 67]); // C E G 동시
});

test('abcToMidi: 멀티보이스는 여러 트랙으로', () => {
  const abc = 'X:1\nM:4/4\nL:1/8\nK:C\n%%score {RH LH}\nV:RH\nV:LH\n[V:RH] c4 c4 |\n[V:LH] C,4 C,4 |';
  const p = AbcMidi.parseMidi(AbcMidi.abcToMidi(abc));
  const voiced = p.tracks.filter(t => t.notes.length > 0);
  assert.equal(voiced.length, 2, 'RH·LH 두 트랙');
});

// ---------- MIDI → ABC ----------
test('midiToAbc: 잘못된 파일은 예외', () => {
  assert.throws(() => AbcMidi.midiToAbc(Uint8Array.from([1, 2, 3, 4])), /MThd/);
});

test('midiToAbc: 빈 MIDI(음표 없음)는 error 반환', () => {
  const b = AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nK:C\nz8 |]');
  const r = AbcMidi.midiToAbc(b);
  assert.ok(r.error && /음표가 없/.test(r.error));
});

test('midiToAbc: 헤더(M/L/Q/K)를 포함하고 |]로 끝난다', () => {
  const b = AbcMidi.abcToMidi('X:1\nM:3/4\nL:1/8\nQ:1/4=80\nK:C\nC2 E2 G2 |]');
  const r = AbcMidi.midiToAbc(b);
  assert.ok(r.abc.includes('M:3/4'));
  assert.ok(r.abc.includes('Q:1/4=80'));
  assert.ok(r.abc.includes('K:C'));
  assert.ok(r.abc.trim().endsWith('|]'));
});

// ---------- 왕복(round-trip) ----------
function roundtrip(abc) {
  return bodyOf(AbcMidi.midiToAbc(AbcMidi.abcToMidi(abc)).abc);
}

test('왕복: 4/4 스케일 — 음·마디 보존', () => {
  const abc = 'X:1\nM:4/4\nL:1/8\nQ:1/4=90\nK:C\nC2 D2 E2 F2 | G2 A2 B2 c2 |]';
  assert.equal(roundtrip(abc), 'C2 D2 E2 F2 | G2 A2 B2 c2 |]');
});

test('왕복: 화음·온음표·2분음표', () => {
  const abc = 'X:1\nM:4/4\nL:1/8\nK:C\nG4 [CEG]4 | c8 |]';
  assert.equal(roundtrip(abc), 'G4 [CEG]4 | c8 |]');
});

test('왕복: 3/4 왈츠', () => {
  const abc = 'X:1\nM:3/4\nL:1/8\nK:C\nC2 E2 G2 | c6 | G2 E2 C2 |]';
  assert.equal(roundtrip(abc), 'C2 E2 G2 | c6 | G2 E2 C2 |]');
});

test('왕복: 옥타브 위·아래 표기 보존', () => {
  const abc = 'X:1\nM:4/4\nL:1/8\nK:C\nC,2 G,2 c2 g2 | c\'2 G2 E2 C2 |]';
  assert.equal(roundtrip(abc), "C,2 G,2 c2 g2 | c'2 G2 E2 C2 |]");
});

test('왕복: 샵/조표(G장조 F#) 피치 보존', () => {
  // G major → F는 F#. MIDI로 갔다 오면 K:C 기준이므로 ^F로 표기되지만 피치는 동일
  const abc = 'X:1\nM:4/4\nL:1/8\nK:G\nG2 A2 B2 c2 | d2 F2 G2 z2 |]';
  const mid = AbcMidi.abcToMidi(abc);
  const notes = AbcMidi.parseMidi(mid).tracks.flatMap(t => t.notes).sort((a, b) => a.startTick - b.startTick);
  // F는 F#=66 이어야 함(G장조)
  assert.ok(notes.map(n => n.midi).includes(66), 'F#(66) 존재');
  // 왕복 ABC에 ^F(올림 파) 표기
  assert.ok(AbcMidi.midiToAbc(mid).abc.includes('^F'));
});

test('왕복: 마디 경계를 넘는 긴 음은 붙임줄(-)로 분할', () => {
  // 2박 쉼 뒤 6박짜리 음 → 다음 마디로 넘어가며 tie
  const abc = 'X:1\nM:4/4\nL:1/8\nK:C\nz4 C4- | C4 z4 |]';
  const out = AbcMidi.midiToAbc(AbcMidi.abcToMidi(abc)).abc;
  assert.ok(/C\d?-/.test(out), '붙임줄로 마디 넘김: ' + bodyOf(out));
});

test('왕복: 16분음표 리듬 — 총 길이 보존', () => {
  const abc = 'X:1\nM:4/4\nL:1/16\nQ:1/4=100\nK:C\nCCDDEEFF GGAABBcc |]';
  const b = AbcMidi.abcToMidi(abc);
  const notes = AbcMidi.parseMidi(b).tracks.flatMap(t => t.notes);
  assert.equal(notes.length, 16);
  const r = AbcMidi.midiToAbc(b);
  assert.equal(r.L, 1 / 16, '16분음표 기준으로 인식');
});

test('왕복: 템포·박자 메타 보존(6/8, 144bpm)', () => {
  const b = AbcMidi.abcToMidi('X:1\nM:6/8\nL:1/8\nQ:1/4=144\nK:C\nC2 E2 G2 | c2 G2 E2 |]');
  const p = AbcMidi.parseMidi(b);
  assert.equal(p.tempoBpm, 144);
  assert.deepEqual(p.timeSig, [6, 8]);
});
