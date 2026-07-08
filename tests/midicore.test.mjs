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
const b64 = html.match(/SAMPLE_B64 = '([^']+)'/)[1];
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
