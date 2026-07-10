// Producer(편곡실) 유닛 테스트 — songmaker.html에서 엔진 추출
// SongCore(plan) → Producer(5트랙 멀티 MIDI: 악기별 GM + 강약 벨로시티)
// 실행: node --test tests/producer.test.mjs
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
const tmp = mkdtempSync(join(tmpdir(), 'prod-'));
const require = createRequire(import.meta.url);
function load(id, globalName) {
  const p = join(tmp, id + '.cjs');
  writeFileSync(p, block(id) + `\nif(typeof module!=='undefined')module.exports=${globalName};`);
  return require(p);
}
const SongCore = load('songcore', 'SongCore');
const Arranger = load('arranger', 'Arranger');
const MidiCore = load('midi-core', 'MidiCore');
globalThis.Arranger = Arranger;               // Producer는 전역 Arranger를 사용
const Producer = load('producer', 'Producer');

// 트랙 채널 매핑(고정): vocal0 · piano1 · guitar2 · bass3 · drums9
const CH = { vocal: 0, piano: 1, guitar: 2, bass: 3, drums: 9 };
function channelsOf(bytes) {
  const p = MidiCore.parseMidi(bytes);
  const set = new Set();
  p.tracks.forEach(t => t.channels.forEach(c => set.add(c)));
  return set;
}
// 노트온(벨로시티 포함) 스캐너 — 트랙별 델타·러닝스테이터스 처리
function noteOns(bytes) {
  let p = 8; const u16 = () => { const v = (bytes[p] << 8) | bytes[p + 1]; p += 2; return v; };
  const u32 = () => { const v = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0; p += 4; return v; };
  u16(); const ntrk = u16(); u16();
  const out = [];
  for (let ti = 0; ti < ntrk; ti++) {
    p += 4; const len = u32(); const end = p + len; let tick = 0, status = 0;
    const varr = () => { let v = 0, c; do { c = bytes[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
    while (p < end) {
      tick += varr(); const b = bytes[p];
      if (b === 0xff) { p++; p++; const l = varr(); p += l; continue; }
      if (b === 0xf0 || b === 0xf7) { p++; const l = varr(); p += l; continue; }
      if (b & 0x80) { status = b; p++; }
      const hi = status & 0xf0, ch = status & 0x0f;
      if (hi === 0x90 || hi === 0x80) { const key = bytes[p++], vel = bytes[p++]; if (hi === 0x90 && vel > 0) out.push({ tick, ch, vel }); }
      else if (hi === 0xc0 || hi === 0xd0) { p++; }
      else { p += 2; }
    }
    p = end;
  }
  return out;
}

test('defaultConfig: 섹션마다 강약·트랙 프리셋을 만든다(코러스=셈, 기타는 코러스만)', () => {
  const plan = SongCore.planSong({ title: '테스트', mood: 'bright', genre: 'pop', seed: 7 });
  const cfg = Producer.defaultConfig(plan);
  assert.equal(cfg.sections.length, plan.sections.length, '섹션 수 일치');
  assert.ok(['vocal', 'piano', 'guitar', 'bass', 'drums'].every(k => cfg.enabled[k] === true), '기본 전체 On');
  const chorus = cfg.sections[plan.sections.findIndex(s => s.name === '코러스')];
  assert.equal(chorus.intensity, 'high', '코러스는 셈');
  assert.ok(chorus.tracks.guitar === true, '코러스에 메인기타');
  // 저에너지 섹션(있으면)은 기타가 꺼져 있다
  plan.sections.forEach((s, i) => { if (s.energy < 0.8) assert.equal(cfg.sections[i].tracks.guitar, false, s.name + ' 기타 꺼짐'); });
});

test('produce: 유효한 멀티트랙 MIDI(type 1) — 악기별 채널이 담긴다', () => {
  const plan = SongCore.planSong({ title: '여름밤', mood: 'bright', genre: 'pop', seed: 7 });
  const out = Producer.produce(plan);
  assert.equal(String.fromCharCode(out.bytes[0], out.bytes[1], out.bytes[2], out.bytes[3]), 'MThd');
  const parsed = MidiCore.parseMidi(out.bytes);
  assert.equal(parsed.format, 1, 'SMF 포맷 1(멀티트랙)');
  assert.equal(out.bars, plan.totalBars, '편곡 마디 = 설계 총 마디');
  const chs = channelsOf(out.bytes);
  ['vocal', 'piano', 'bass', 'drums'].forEach(k => assert.ok(chs.has(CH[k]), k + ' 채널(' + CH[k] + ') 존재'));
  assert.ok(chs.has(CH.guitar), '코러스가 있으니 메인기타(ch2)도 존재');
  assert.equal(parsed.tempoBpm, plan.tempo, '템포 반영');
});

test('produce: 트랙 전체 Off면 그 악기의 음이 사라진다(기타 뮤트)', () => {
  const plan = SongCore.planSong({ mood: 'excited', genre: 'rock', seed: 3 });
  const cfg = Producer.defaultConfig(plan);
  cfg.enabled.guitar = false;
  const chs = channelsOf(Producer.produce(plan, cfg).bytes);
  assert.ok(!chs.has(CH.guitar), '기타 채널 없음');
  assert.ok(chs.has(CH.vocal) && chs.has(CH.bass), '다른 트랙은 유지');
});

test('produce: 보컬만 남기면 채널이 보컬(0) 하나뿐이다', () => {
  const plan = SongCore.planSong({ mood: 'calm', genre: 'ballad', seed: 5 });
  const cfg = Producer.defaultConfig(plan);
  ['piano', 'guitar', 'bass', 'drums'].forEach(k => cfg.enabled[k] = false);
  const chs = channelsOf(Producer.produce(plan, cfg).bytes);
  assert.deepEqual([...chs].sort(), [0], '보컬 채널만');
});

test('produce: 강약이 벨로시티로 반영된다(셈 > 여림)', () => {
  const plan = SongCore.planSong({ mood: 'bright', genre: 'pop', seed: 11 });
  function allAt(intensity) {
    const cfg = Producer.defaultConfig(plan);
    cfg.sections.forEach(s => { s.intensity = intensity; Object.keys(s.tracks).forEach(k => s.tracks[k] = true); });
    return Producer.produce(plan, cfg).bytes;
  }
  const avgVocal = bytes => { const v = noteOns(bytes).filter(n => n.ch === 0); return v.reduce((a, n) => a + n.vel, 0) / v.length; };
  const hi = avgVocal(allAt('high')), lo = avgVocal(allAt('low'));
  assert.ok(hi > lo + 20, `셈(${Math.round(hi)}) > 여림(${Math.round(lo)})`);
  assert.ok(lo >= 1 && hi <= 127, '벨로시티 범위');
});

test('produce: 섹션별 강약이 구간 벨로시티에 실제로 나타난다', () => {
  // 첫 섹션은 여림, 마지막 섹션은 셈으로 강제 → 앞구간 평균 < 뒷구간 평균
  const plan = SongCore.planSong({ mood: 'bright', genre: 'dance', seed: 9 });
  const cfg = Producer.defaultConfig(plan);
  cfg.sections.forEach(s => Object.keys(s.tracks).forEach(k => s.tracks[k] = true));
  cfg.sections[0].intensity = 'low';
  cfg.sections[cfg.sections.length - 1].intensity = 'high';
  const out = Producer.produce(plan, cfg);
  const barTicks = Producer.PPQ * 4;
  const firstBars = plan.sections[0].bars, totalBars = out.bars;
  const ons = noteOns(out.bytes).filter(n => n.ch === 0);
  const early = ons.filter(n => n.tick < firstBars * barTicks);
  const late = ons.filter(n => n.tick >= (totalBars - plan.sections[plan.sections.length - 1].bars) * barTicks);
  const avg = a => a.reduce((x, n) => x + n.vel, 0) / a.length;
  assert.ok(early.length && late.length, '두 구간 모두 음이 있음');
  assert.ok(avg(late) > avg(early) + 20, `뒷구간 셈(${Math.round(avg(late))}) > 앞구간 여림(${Math.round(avg(early))})`);
});

test('produce: 시드 재현성(같은 plan+cfg = 같은 바이트)', () => {
  const plan = SongCore.planSong({ mood: 'sad', genre: 'ballad', seed: 42 });
  const a = Producer.produce(plan), b = Producer.produce(plan);
  assert.deepEqual([...a.bytes], [...b.bytes], '동일 출력');
});
