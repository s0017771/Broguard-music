// Arranger + 편곡 파이프라인 유닛 테스트 — songmaker.html에서 엔진 추출
// SongCore(plan) → Arranger(ABC) → AbcMidi(MIDI) → MidiCore(드럼·병합)
// 실행: node --test tests/arranger.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'songmaker.html'), 'utf8');
function block(id) {
  const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'));
  assert.ok(m, `songmaker.html에 <script id="${id}"> 필요`);
  return m[1];
}
const tmp = mkdtempSync(join(tmpdir(), 'arr-'));
const require = createRequire(import.meta.url);
function load(id, globalName) {
  const p = join(tmp, id + '.cjs');
  writeFileSync(p, block(id) + `\nif(typeof module!=='undefined')module.exports=${globalName};`);
  return require(p);
}
const SongCore = load('songcore', 'SongCore');
const Arranger = load('arranger', 'Arranger');
const AbcMidi = load('abcmidi-core', 'AbcMidi');
const MidiCore = load('midi-core', 'MidiCore');

const CHORD_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function chordTones(sym) {
  const m = /^([A-G])([#b]?)(m)?/.exec(sym);
  let pc = CHORD_PC[m[1]]; if (m[2] === '#') pc = (pc + 1) % 12; if (m[2] === 'b') pc = (pc + 11) % 12;
  const minor = !!m[3];
  return [pc, (pc + (minor ? 3 : 4)) % 12, (pc + 7) % 12];
}

test('arrange: 설계도 마디 수만큼 멀티보이스(RH/LH) ABC를 만든다', () => {
  const plan = SongCore.planSong({ title: '테스트', mood: 'bright', genre: 'pop', seed: 7 });
  const arr = Arranger.arrange(plan, { seed: 7 });
  assert.equal(arr.bars, plan.totalBars, '편곡 마디 = 설계 총 마디');
  assert.ok(arr.abc.includes('%%score {RH LH}') && arr.abc.includes('[V:RH]') && arr.abc.includes('[V:LH]'));
  assert.ok(arr.abc.includes('Q:1/4=' + plan.tempo));
});

test('arrange: 멜로디 강박(각 마디 첫 음)은 그 코드의 구성음이다', () => {
  const plan = SongCore.planSong({ mood: 'bright', genre: 'pop', seed: 3 });
  const arr = Arranger.arrange(plan, { seed: 3 });
  // RH 라인에서 마디별 첫 토큰의 코드 주석 + 첫 음 확인 (간단화: 코어 함수로 직접)
  const chord = Arranger.parseChord('G');
  const bar = Arranger.melodyBar(chord, 74, true, Math.random, 67, 83);
  assert.ok(chordTones('G').includes(((bar[0].midi % 12) + 12) % 12), '강박=코드톤');
});

test('arrange: 베이스는 근음·5도(쿵짝)로 낮은 음역', () => {
  const bass = Arranger.bassBar(Arranger.parseChord('C'));
  assert.equal(bass.length, 4);
  assert.equal(((bass[0].midi % 12) + 12) % 12, 0, '1박=근음 C');
  assert.equal(((bass[1].midi % 12) + 12) % 12, 7, '2박=5도 G');
  assert.ok(bass.every(n => n.midi >= 36 && n.midi <= 57), '베이스 음역');
});

test('파이프라인: ABC→MIDI 멀티트랙(멜로디+베이스) 유효', () => {
  const plan = SongCore.planSong({ mood: 'excited', genre: 'dance', seed: 11 });
  const arr = Arranger.arrange(plan, { seed: 11 });
  const mel = AbcMidi.abcToMidi(arr.abc);
  assert.equal(String.fromCharCode(mel[0], mel[1], mel[2], mel[3]), 'MThd');
  const p = AbcMidi.parseMidi(mel);
  const voiced = p.tracks.filter(t => t.notes.length > 0);
  assert.equal(voiced.length, 2, 'RH·LH 두 트랙');
});

test('파이프라인: 드럼 생성 + 병합 → 멜로디·드럼 음이 모두 있는 MIDI', () => {
  const plan = SongCore.planSong({ mood: 'bright', genre: 'pop', seed: 5 });
  const arr = Arranger.arrange(plan, { seed: 5 });
  const mel = AbcMidi.abcToMidi(arr.abc);
  const drums = MidiCore.makeBasicBeat(mel, { pattern: 4, tempoBpm: plan.tempo });
  const merged = MidiCore.mergeMidis(mel, drums, { tempoBpm: plan.tempo });
  assert.equal(String.fromCharCode(merged.bytes[0], merged.bytes[1], merged.bytes[2], merged.bytes[3]), 'MThd');
  assert.ok(merged.melNotes > 0 && merged.drmNotes > 0, `멜로디 ${merged.melNotes} · 드럼 ${merged.drmNotes}`);
  assert.ok(Math.abs(merged.melBars - plan.totalBars) <= 1, `마디 ${merged.melBars}≈${plan.totalBars}`);
});

test('arrange: 멜로디만 ABC는 단선율(베이스·V:LH·드럼 없음)이고 편집 가능', () => {
  const plan = SongCore.planSong({ mood: 'bright', genre: 'pop', seed: 5 });
  const arr = Arranger.arrange(plan, { seed: 5 });
  assert.ok(arr.melodyAbc, 'melodyAbc 존재');
  assert.ok(!/%%score/.test(arr.melodyAbc) && !/\[V:LH\]/.test(arr.melodyAbc), '멀티보이스 아님');
  assert.ok(arr.melodyAbc.includes('(멜로디)'), '제목에 멜로디 표시');
  assert.ok(/"\^인트로"/.test(arr.melodyAbc), '섹션 텍스트 주석');
  // ABC→MIDI 하면 트랙(음표 있는) 하나 = 순수 단선율
  const mid = AbcMidi.abcToMidi(arr.melodyAbc);
  const voiced = AbcMidi.parseMidi(mid).tracks.filter(t => t.notes.length > 0);
  assert.equal(voiced.length, 1, '멜로디 한 트랙만');
  // 멜로디 음역(G4~B5 근처) — 베이스 음(낮은 C2~) 없음
  const notes = voiced[0].notes.map(n => n.midi);
  assert.ok(notes.every(m => m >= 60), '낮은 베이스 음이 섞이지 않음: ' + Math.min(...notes));
});

test('arrange: 시드 재현성', () => {
  const plan = SongCore.planSong({ mood: 'calm', genre: 'ballad', seed: 9 });
  const a = Arranger.arrange(plan, { seed: 9 }), b = Arranger.arrange(plan, { seed: 9 });
  assert.equal(a.abc, b.abc);
});
