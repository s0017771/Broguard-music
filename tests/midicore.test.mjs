// MidiCore(채널 인식 MIDI 파서/요약) 유닛 테스트 — merge.html에서 코어 추출
// 실행: node --test tests/midicore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const html = readFileSync(join(root, 'merge.html'), 'utf8');
const m = html.match(/<script id="midi-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'merge.html에 <script id="midi-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'midicore-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const MidiCore = require(join(tmp, 'core.cjs'));

// merge.html에 박아둔 샘플 드럼(base64)을 추출해 실제 데이터로 검증
const b64 = html.match(/SAMPLE_DRUM = '([^']+)'/)[1];
const drum = Uint8Array.from(Buffer.from(b64, 'base64'));

// 멜로디 MIDI는 ABC↔MIDI 변환기로 생성
const midiHtml = readFileSync(join(root, 'midi.html'), 'utf8');
writeFileSync(join(tmp, 'abcmidi.cjs'), midiHtml.match(/<script id="abcmidi-core">([\s\S]*?)<\/script>/)[1]);
const AbcMidi = require(join(tmp, 'abcmidi.cjs'));
const melody = AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nC2 D2 E2 F2 | G2 A2 G2 E2 |');

test('parseMidi: 실제 Magenta 드럼 — 채널 10·GM 드럼·PPQ 220', () => {
  const p = MidiCore.parseMidi(drum);
  assert.equal(p.format, 0);
  assert.equal(p.ppq, 220);
  assert.equal(p.tempoBpm, 120);
  const t = p.tracks[0];
  assert.deepEqual(t.channels, [9], '드럼은 채널 9(0-index)=10(1-index)');
  assert.ok(t.isDrum, '드럼 트랙으로 감지');
  assert.ok(t.noteCount > 0);
  // 노트에 채널 정보가 담긴다
  assert.ok(t.notes.every(n => n.channel === 9));
});

test('describe: 드럼 요약 — hasDrums·마디·GM 이름', () => {
  const d = MidiCore.describe(drum);
  assert.ok(d.hasDrums);
  assert.equal(d.ppq, 220);
  assert.equal(d.bars, 4);
  const dt = d.tracks.find(t => t.isDrum);
  assert.ok(dt.drumNotes.length >= 3, '여러 종류의 드럼');
  const names = dt.drumNotes.map(x => x.name);
  assert.ok(names.some(n => /킥/.test(n)), '킥 포함');
  assert.ok(names.some(n => /스네어/.test(n)), '스네어 포함');
  assert.ok(names.some(n => /하이햇/.test(n)), '하이햇 포함');
  // 킥=36, 스네어=38, 하이햇=42 표준 GM 노트 번호
  const notes = dt.drumNotes.map(x => x.note);
  assert.ok(notes.includes(36) && notes.includes(38) && notes.includes(42));
});

test('describe: 멜로디 MIDI는 드럼으로 오인하지 않는다', () => {
  const d = MidiCore.describe(melody);
  assert.equal(d.hasDrums, false, '드럼 없음');
  assert.equal(d.ppq, 480);
  const melTrack = d.tracks.find(t => t.noteCount > 0);
  assert.ok(!melTrack.isDrum);
  assert.ok(melTrack.channels.indexOf(9) < 0, '채널 10 아님');
});

test('parseMidi: 잘못된 파일은 예외', () => {
  assert.throws(() => MidiCore.parseMidi(Uint8Array.from([1, 2, 3, 4])), /MThd/);
});

test('GM_DRUM 매핑에 핵심 타악기가 있다', () => {
  assert.ok(/킥/.test(MidiCore.GM_DRUM[36]));
  assert.ok(/스네어/.test(MidiCore.GM_DRUM[38]));
  assert.ok(/하이햇/.test(MidiCore.GM_DRUM[42]));
});

// ---------- 병합 (2단계) ----------
test('mergeMidis: 멜로디+드럼 → 멜로디 ch1·드럼 ch10, 공통 PPQ 480', () => {
  const res = MidiCore.mergeMidis(melody, drum, {});
  assert.equal(res.ppq, 480);
  const d = MidiCore.describe(res.bytes);
  assert.equal(d.ppq, 480);
  assert.ok(d.hasDrums, '병합본에 드럼 포함');
  const melTrack = d.tracks.find(t => !t.isDrum && t.noteCount > 0);
  const drumTrack = d.tracks.find(t => t.isDrum);
  assert.ok(melTrack, '멜로디 트랙 존재');
  assert.ok(drumTrack, '드럼 트랙 존재');
  assert.deepEqual(melTrack.channels, [0], '멜로디는 채널 1(0-index 0)');
  assert.deepEqual(drumTrack.channels, [9], '드럼은 채널 10(0-index 9)');
});

test('mergeMidis: 드럼 틱을 PPQ 480으로 정확히 환산(220→480)', () => {
  const drumParsed = MidiCore.parseMidi(drum);
  const expected = Math.round(drumParsed.totalTicks * 480 / 220);
  const merged = MidiCore.parseMidi(MidiCore.mergeMidis(melody, drum, {}).bytes);
  // 병합 총틱은 드럼(더 긴 쪽)의 환산값과 일치
  assert.ok(Math.abs(merged.totalTicks - expected) <= 2, `총틱 ${merged.totalTicks} ≈ ${expected}`);
});

test('mergeMidis: 두 음원의 노트가 모두 보존된다', () => {
  const melN = MidiCore.parseMidi(melody).tracks.reduce((a, t) => a + t.noteCount, 0);
  const drmN = MidiCore.parseMidi(drum).tracks.reduce((a, t) => a + t.noteCount, 0);
  const res = MidiCore.mergeMidis(melody, drum, {});
  assert.equal(res.melNotes, melN);
  assert.equal(res.drmNotes, drmN);
  const total = MidiCore.parseMidi(res.bytes).tracks.reduce((a, t) => a + t.noteCount, 0);
  assert.equal(total, melN + drmN);
});

test('mergeMidis: loopToMatch로 짧은 쪽을 반복해 길이를 맞춘다', () => {
  // 1마디 멜로디 vs 4마디 드럼 → 멜로디가 반복되어 노트가 늘어남
  const shortMel = AbcMidi.abcToMidi('X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nC2 E2 G2 c2 |');
  const asis = MidiCore.mergeMidis(shortMel, drum, { loopToMatch: false });
  const looped = MidiCore.mergeMidis(shortMel, drum, { loopToMatch: true });
  assert.ok(looped.melNotes > asis.melNotes, `반복으로 멜로디 노트 증가 (${asis.melNotes} → ${looped.melNotes})`);
});

test('mergeMidis: 표준 GM 드럼 노트가 병합 후에도 유지', () => {
  const res = MidiCore.mergeMidis(melody, drum, {});
  const dt = MidiCore.describe(res.bytes).tracks.find(t => t.isDrum);
  const notes = dt.drumNotes.map(x => x.note);
  assert.ok(notes.includes(36) && notes.includes(38) && notes.includes(42), '킥·스네어·하이햇 유지');
});

// ---------- 기본 비트 자동 생성 ----------
test('makeBasicBeat: 멜로디 박자·템포에 맞는 드럼(채널10·GM) 생성', () => {
  const beat = MidiCore.makeBasicBeat(melody, { pattern: 0 });
  const d = MidiCore.describe(beat);
  assert.ok(d.hasDrums, '드럼으로 인식');
  assert.equal(d.ppq, 480);
  assert.equal(d.tempoBpm, 120, '멜로디 템포 따름');
  const dt = d.tracks.find(t => t.isDrum);
  assert.deepEqual(dt.channels, [9], '채널 10');
  const notes = dt.drumNotes.map(x => x.note);
  assert.ok(notes.includes(36), '킥');
  assert.ok(notes.includes(38), '스네어');
  assert.ok(notes.includes(42) || notes.includes(46), '하이햇');
});

test('makeBasicBeat: 6가지 스타일이 모두 드럼을 만들고 서로 다르다', () => {
  assert.equal(MidiCore.BEAT_STYLES.length, 6);
  const counts = MidiCore.BEAT_STYLES.map((_, i) => {
    const dt = MidiCore.describe(MidiCore.makeBasicBeat(melody, { pattern: i })).tracks.find(t => t.isDrum);
    assert.ok(dt && dt.noteCount > 0, `스타일 ${i} 드럼 있음`);
    return dt.noteCount;
  });
  assert.ok(new Set(counts).size >= 4, '스타일별 구성이 대체로 다름');
});

test('makeBasicBeat: pattern 인덱스는 스타일 수로 순환(음수·초과 안전)', () => {
  const a = MidiCore.describe(MidiCore.makeBasicBeat(melody, { pattern: 0 })).tracks.find(t => t.isDrum).noteCount;
  const b = MidiCore.describe(MidiCore.makeBasicBeat(melody, { pattern: 6 })).tracks.find(t => t.isDrum).noteCount;
  assert.equal(a, b, 'pattern 6 == pattern 0');
});

test('makeBasicBeat + mergeMidis: 멜로디에 기본 드럼을 얹어 병합', () => {
  const beat = MidiCore.makeBasicBeat(melody, { pattern: 0 });
  const merged = MidiCore.mergeMidis(melody, beat, { loopToMatch: true });
  const d = MidiCore.describe(merged.bytes);
  assert.ok(d.hasDrums);
  assert.ok(d.tracks.some(t => !t.isDrum && t.noteCount > 0), '멜로디 트랙');
  assert.ok(d.tracks.some(t => t.isDrum), '드럼 트랙');
});

test('melodyToTapSequence: 멜로디 온셋을 2마디·16분 탭 시퀀스로', () => {
  const tap = MidiCore.melodyToTapSequence(melody, 2);
  assert.equal(tap.quantizationInfo.stepsPerQuarter, 4);
  assert.equal(tap.totalQuantizedSteps, 32);
  assert.ok(tap.notes.length > 0 && tap.notes.every(n => n.isDrum));
});

test('drumSequenceToMidi: GrooVAE식 출력 → 드럼 MIDI(채널10)', () => {
  const fakeGroove = { notes: [
    { pitch: 36, quantizedStartStep: 0 }, { pitch: 42, quantizedStartStep: 2 },
    { pitch: 38, quantizedStartStep: 4 }, { pitch: 42, quantizedStartStep: 6 }],
    tempos: [{ qpm: 120 }] };
  const midi = MidiCore.drumSequenceToMidi(fakeGroove, { tempoBpm: 120 });
  const d = MidiCore.describe(midi);
  assert.ok(d.hasDrums);
  assert.deepEqual(d.tracks.find(t => t.isDrum).channels, [9]);
});
