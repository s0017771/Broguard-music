// AudioMidi 코어 유닛 테스트 — audio.html에서 엔진을 추출해 실행
// 실행: node --test tests/audiomidi.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'audio.html'), 'utf8');
const m = html.match(/<script id="audiomidi-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'audio.html에 <script id="audiomidi-core"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'audiomidi-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const AM = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

// 사인파 멜로디 PCM 생성
function synth(freqs, sr, noteDur, gap) {
  const chunks = [];
  for (const f of freqs) {
    const seg = new Float32Array(Math.floor(sr * noteDur));
    for (let i = 0; i < seg.length; i++) seg[i] = 0.6 * Math.sin(2 * Math.PI * f * i / sr);
    chunks.push(seg);
    if (gap) chunks.push(new Float32Array(Math.floor(sr * gap)));
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const pcm = new Float32Array(total); let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.length; }
  return pcm;
}
const HZ = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, C5: 523.25 };

// ---------- 음정 탐지 ----------
test('detectPitch: 순음 주파수를 정확히 찾는다(±1 반음)', () => {
  const sr = 16000;
  for (const f of [HZ.C4, HZ.A4, HZ.C5]) {
    const buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.sin(2 * Math.PI * f * i / sr);
    const hz = AM.detectPitch(buf, sr, 80, 1000);
    assert.ok(Math.abs(AM.hzToMidi(hz) - AM.hzToMidi(f)) <= 1, `${f}Hz 탐지 오차 큼: ${hz}`);
  }
});

test('hzToMidi: A4=440→69, C4=261.63→60', () => {
  assert.equal(AM.hzToMidi(440), 69);
  assert.equal(AM.hzToMidi(261.63), 60);
});

// ---------- 전체 파이프라인(단선율) ----------
test('transcribe: 도미솔높은도 멜로디 → MIDI [60,64,67,72]', () => {
  const pcm = synth([HZ.C4, HZ.E4, HZ.G4, HZ.C5], 16000, 0.5, 0.1);
  const r = AM.transcribe(pcm, 16000, { tempo: 120 });
  assert.ok(!r.error, r.error);
  assert.deepEqual(r.notes.map(n => n.midi), [60, 64, 67, 72]);
});

test('transcribe: 결과 ABC는 헤더와 |]로 끝을 갖춘다', () => {
  const pcm = synth([HZ.C4, HZ.D4, HZ.E4, HZ.F4], 16000, 0.5, 0.05);
  const r = AM.transcribe(pcm, 16000, { tempo: 120 });
  assert.ok(r.abc.includes('M:4/4') && r.abc.includes('K:C') && r.abc.includes('Q:1/4=120'));
  assert.ok(r.abc.trim().endsWith('|]'));
});

test('transcribe: 0.5초 음 @120BPM = 2분음표(steps 2)로 양자화된다', () => {
  const pcm = synth([HZ.C4, HZ.G4], 16000, 0.5, 0.0);
  const r = AM.transcribe(pcm, 16000, { tempo: 120 });
  const body = r.abc.split('K:C\n')[1];
  // 0.5초 @120 → 4분음표=0.5초 → 8분음표 2칸 → "C2"
  assert.ok(/C2/.test(body) && /G2/.test(body), '2분음표(2칸) 양자화: ' + body);
});

test('transcribe: 무음/잡음은 음을 찾지 못하면 error', () => {
  const noise = new Float32Array(16000);
  for (let i = 0; i < noise.length; i++) noise[i] = 0.0005 * (Math.sin(i) - 0.5); // 게이트 아래
  const r = AM.transcribe(noise, 16000, {});
  assert.ok(r.error && /찾지 못/.test(r.error));
});

// ---------- ABC 음이름 ----------
test('midiToAbcPitch: 옥타브 표기(C3=C, C4=C, C5=c, C6=c\')', () => {
  assert.equal(AM.midiToAbcPitch(60), 'C');   // C4 가운데 도
  assert.equal(AM.midiToAbcPitch(48), 'C,');  // C3
  assert.equal(AM.midiToAbcPitch(72), 'c');   // C5
  assert.equal(AM.midiToAbcPitch(84), "c'");  // C6
  assert.equal(AM.midiToAbcPitch(61), '^C');  // C#4
});

// ---------- 폴리포닉(AI 모드용) ----------
test('notesPolyToAbc: 겹치는 음은 화음 [ ]으로 묶인다', () => {
  const poly = [
    { midi: 60, start: 0, dur: 1 }, { midi: 64, start: 0, dur: 1 }, { midi: 67, start: 0, dur: 1 },
    { midi: 65, start: 1, dur: 1 }, { midi: 69, start: 1, dur: 1 }, { midi: 72, start: 1, dur: 1 }
  ];
  const abc = AM.notesPolyToAbc(poly, { tempo: 120 });
  const body = abc.split('K:C\n')[1];
  assert.ok(/\[CEG\]/.test(body), 'C장조 화음: ' + body);
  assert.ok(/\[FAc\]/.test(body), 'F화음: ' + body);
});

test('notesPolyToAbc: 빈 노트 목록도 유효한 ABC', () => {
  const abc = AM.notesPolyToAbc([], { tempo: 100 });
  assert.ok(abc.includes('K:C') && abc.trim().endsWith('|]'));
});

// ---------- AbcMidi 연동 가능성(같은 파일에 내장) ----------
test('결과 ABC가 내장 AbcMidi로 MIDI 변환 가능한 형식이다', () => {
  const am = html.match(/<script id="abcmidi-core">([\s\S]*?)<\/script>/);
  assert.ok(am, 'audio.html에 abcmidi-core도 내장되어 .mid 저장 가능');
  writeFileSync(join(tmp, 'abcmidi.cjs'), am[1]);
  const AbcMidi = createRequire(import.meta.url)(join(tmp, 'abcmidi.cjs'));
  const pcm = synth([HZ.C4, HZ.E4, HZ.G4], 16000, 0.5, 0.05);
  const r = AM.transcribe(pcm, 16000, { tempo: 120 });
  const bytes = AbcMidi.abcToMidi(r.abc);
  assert.ok(bytes instanceof Uint8Array && bytes.length > 20);
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), 'MThd');
});
