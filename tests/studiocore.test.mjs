// StudioCore(프로듀싱 스튜디오) 유닛 테스트 — studio.html에서 엔진 추출
// SongCore(plan) → StudioCore(드럼·베이스 트랙 생성 + 멀티트랙 조합)
// 실행: node --test tests/studiocore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'studio.html'), 'utf8');
function blk(id) { const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>')); assert.ok(m, id); return m[1]; }
const tmp = mkdtempSync(join(tmpdir(), 'studio-'));
const require = createRequire(import.meta.url);
function load(id, g) { const p = join(tmp, id + '.cjs'); writeFileSync(p, blk(id) + `\nif(typeof module!=='undefined')module.exports=${g};`); return require(p); }
const SongCore = load('songcore', 'SongCore');
const StudioCore = load('studio-core', 'StudioCore');

const PLAN = SongCore.planSong({ title: '리듬', mood: 'bright', genre: 'pop', seed: 7 });
const PPQ = StudioCore.PPQ, BAR = PPQ * 4;

// ── 간이 SMF 파서(채널·프로그램·벨로시티) ──
function parse(bytes) {
  let p = 8; const u16 = () => { const v = (bytes[p] << 8) | bytes[p + 1]; p += 2; return v; };
  const u32 = () => { const v = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0; p += 4; return v; };
  const fmt = u16(), ntrk = u16(); u16();
  const progs = [], ons = []; let trackCount = 0;
  for (let ti = 0; ti < ntrk; ti++) {
    p += 4; const len = u32(); const end = p + len; let st = 0; trackCount++;
    const varr = () => { let v = 0, c; do { c = bytes[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
    while (p < end) {
      varr(); const b = bytes[p];
      if (b === 0xff) { p++; p++; const l = varr(); p += l; continue; }
      if (b === 0xf0 || b === 0xf7) { p++; const l = varr(); p += l; continue; }
      if (b & 0x80) { st = b; p++; }
      const hi = st & 0xf0, ch = st & 0x0f;
      if (hi === 0xc0) { progs.push({ ch, prog: bytes[p++] }); }
      else if (hi === 0x90 || hi === 0x80) { const k = bytes[p++], v = bytes[p++]; if (hi === 0x90 && v > 0) ons.push({ ch, midi: k, vel: v }); }
      else if (hi === 0xd0) { p += 1; } else { p += 2; }
    }
    p = end;
  }
  return { fmt, ntrk, trackCount, progs, ons };
}

test('genDrums: 드럼 타점 생성 — GM 드럼음, 마디마다 킥(1박)', () => {
  const lane = StudioCore.genDrums(PLAN, { style: 0 });
  assert.ok(lane.length > PLAN.totalBars * 3, '충분한 타점: ' + lane.length);
  const drumPitches = new Set([35, 36, 37, 38, 39, 42, 46, 47, 49, 51]);
  assert.ok(lane.every(n => drumPitches.has(n.midi)), '모두 GM 드럼음');
  // 각 마디 첫 박(barStart)에 킥(36)이 있다
  for (let bar = 0; bar < PLAN.totalBars; bar++) {
    assert.ok(lane.some(n => n.midi === 36 && n.start === bar * BAR), '마디 ' + bar + ' 킥');
  }
});

test('genDrums: 스타일마다 타점이 달라진다(포 온 더 플로어 = 킥 많음)', () => {
  const rock = StudioCore.genDrums(PLAN, { style: 0 }).filter(n => n.midi === 36).length;
  const four = StudioCore.genDrums(PLAN, { style: 5 }).filter(n => n.midi === 36).length;
  assert.ok(four > rock, `포온플로어 킥(${four}) > 기본록(${rock})`);
});

test('genBass: 마디 첫 음 = 그 코드의 근음, 낮은 음역', () => {
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const lane = StudioCore.genBass(PLAN, { pattern: 1 });
  let bar = 0;
  PLAN.sections.forEach(sec => {
    for (let b = 0; b < sec.bars; b++) {
      const sym = sec.chords[b % sec.chords.length];
      let pc = PC[sym[0]]; if (sym[1] === '#') pc = (pc + 1) % 12; if (sym[1] === 'b') pc = (pc + 11) % 12;
      const first = lane.find(n => n.start === bar * BAR);
      assert.ok(first, '마디 ' + bar + ' 베이스 음');
      assert.equal(((first.midi % 12) + 12) % 12, pc, '마디 ' + bar + ' 근음(' + sym + ')');
      assert.ok(first.midi >= 36 && first.midi <= 55, '베이스 음역');
      bar++;
    }
  });
});

test('genBass: 패턴별 음 밀도(홑음 < 쿵짝 < 펌핑)', () => {
  const whole = StudioCore.genBass(PLAN, { pattern: 0 }).length;
  const boom = StudioCore.genBass(PLAN, { pattern: 1 }).length;
  const pump = StudioCore.genBass(PLAN, { pattern: 3 }).length;
  assert.ok(whole < boom && boom < pump, `홑음 ${whole} < 쿵짝 ${boom} < 펌핑 ${pump}`);
  assert.equal(whole, PLAN.totalBars, '홑음은 마디당 1음');
  assert.equal(pump, PLAN.totalBars * 8, '펌핑은 마디당 8음');
});

test('combine: 멀티트랙 SMF(type1) — 드럼 ch10 + 베이스 ch3, 프로그램 체인지', () => {
  const drums = StudioCore.genDrums(PLAN, { style: 0 });
  const bass = StudioCore.genBass(PLAN, { pattern: 1 });
  const out = StudioCore.combine({ drums, bass }, { tempo: PLAN.tempo, order: ['drums', 'bass'] });
  assert.equal(String.fromCharCode(out.bytes[0], out.bytes[1], out.bytes[2], out.bytes[3]), 'MThd');
  const p = parse(out.bytes);
  assert.equal(p.fmt, 1, 'SMF 포맷 1');
  assert.equal(p.trackCount, 3, '메타 + 2트랙');
  const chs = new Set(p.ons.map(o => o.ch));
  assert.ok(chs.has(9) && chs.has(3), '드럼 ch10 · 베이스 ch3');
  assert.ok(p.progs.some(x => x.ch === 3 && x.prog === 33), '베이스 프로그램(33)');
  assert.deepEqual(out.tracks, ['drums', 'bass']);
});

test('combine: 볼륨을 낮추면 그 트랙 벨로시티가 작아진다', () => {
  const bass = StudioCore.genBass(PLAN, { pattern: 1 });
  const loud = parse(StudioCore.combine({ bass }, { tempo: 100, vol: { bass: 1 } }).bytes).ons.filter(o => o.ch === 3);
  const soft = parse(StudioCore.combine({ bass }, { tempo: 100, vol: { bass: 0.4 } }).bytes).ons.filter(o => o.ch === 3);
  const avg = a => a.reduce((s, o) => s + o.vel, 0) / a.length;
  assert.ok(avg(soft) < avg(loud) - 20, `작게(${Math.round(avg(soft))}) < 크게(${Math.round(avg(loud))})`);
});

test('combine: 솔로(한 트랙만) = 채널 하나', () => {
  const drums = StudioCore.genDrums(PLAN, { style: 0 });
  const p = parse(StudioCore.combine({ drums }, { tempo: 100 }).bytes);
  assert.deepEqual([...new Set(p.ons.map(o => o.ch))], [9], '드럼 채널만');
});

test('genDrums/genBass: 시드·입력 같으면 재현된다', () => {
  const a = StudioCore.genDrums(PLAN, { style: 0, seed: 5 }), b = StudioCore.genDrums(PLAN, { style: 0, seed: 5 });
  assert.deepEqual(a, b, '드럼 재현');
  const c = StudioCore.genBass(PLAN, { pattern: 2 }), d = StudioCore.genBass(PLAN, { pattern: 2 });
  assert.deepEqual(c, d, '베이스 재현');
});

test('parseBassPattern: 문법·마디합 검증(r2 z2 f2 z2 | r4 f4)', () => {
  const ok = StudioCore.parseBassPattern('r2 z2 f2 z2 | r4 f4');
  assert.ok(!ok.error, ok.error);
  assert.equal(ok.bars.length, 2);
  assert.deepEqual(ok.bars[0][0], { deg: 'r', up: false, len: 2 });
  assert.equal(ok.bars[0][1].deg, null, 'z=쉼표');
  // 대문자 = 옥타브 위
  const up = StudioCore.parseBassPattern('R4 F4');
  assert.equal(up.bars[0][0].up, true);
  // 오류: 합 != 8, 모르는 토큰
  assert.ok(StudioCore.parseBassPattern('r2 f2').error, '합 4는 오류');
  assert.ok(StudioCore.parseBassPattern('x8').error, '모르는 토큰');
});

test('genBassPattern: 근음·3음·5음·높은5음이 코드에 맞고 패턴이 반복된다', () => {
  const lane = StudioCore.genBassPattern(PLAN, 'r2 t2 f2 a2');
  // 첫 마디(코드 = 첫 섹션 첫 코드)
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const sym = PLAN.sections[0].chords[0];
  let pc = PC[sym[0]]; if (sym[1] === '#') pc = (pc + 1) % 12;
  const minor = /m$/.test(sym);
  const first4 = lane.slice(0, 4).map(n => ((n.midi % 12) + 12) % 12);
  assert.equal(first4[0], pc, '근음');
  assert.equal(first4[1], (pc + (minor ? 3 : 4)) % 12, '3음');
  assert.equal(first4[2], (pc + 7) % 12, '5음');
  assert.equal(first4[3], (pc + 7) % 12, '높은5음(같은 pc, 옥타브 위)');
  assert.ok(lane[3].midi > lane[2].midi, 'a는 f보다 높음');
  assert.equal(lane.length, PLAN.totalBars * 4, '마디마다 4음');
  // 대문자 옥타브
  const hi = StudioCore.genBassPattern(PLAN, 'R8')[0].midi;
  const lo = StudioCore.genBassPattern(PLAN, 'r8')[0].midi;
  assert.equal(hi - lo, 12, '대문자=+12');
});

test('parseDrumPattern/genDrumsPattern: 동시타(kh) · 반복 · 벨로시티', () => {
  const p = StudioCore.parseDrumPattern('kh1 h1 sh1 h1 kh1 h1 sh1 h1');
  assert.ok(!p.error, p.error);
  assert.deepEqual(p.bars[0][0].hits.sort(), [36, 42], 'kh = 킥+햇');
  assert.ok(StudioCore.parseDrumPattern('kh1 h1').error, '합!=8 오류');
  assert.ok(StudioCore.parseDrumPattern('x8').error, '모르는 글자');
  const lane = StudioCore.genDrumsPattern(PLAN, 'kh1 h1 sh1 h1 kh1 h1 sh1 h1');
  // 마디마다 첫 박에 킥
  for (let bar = 0; bar < PLAN.totalBars; bar++) {
    assert.ok(lane.some(n => n.midi === 36 && n.start === bar * BAR), '마디 ' + bar + ' 킥');
  }
  const kick = lane.find(n => n.midi === 36), hat = lane.find(n => n.midi === 42);
  assert.ok(kick.vel > hat.vel, '킥이 햇보다 큼');
});

test('genPiano: 코드 구성음 화음, 패턴별 밀도(온음 < 4박 컴핑)', () => {
  const hold = StudioCore.genPiano(PLAN, { pattern: 0 });
  const four = StudioCore.genPiano(PLAN, { pattern: 2 });
  assert.equal(hold.length, PLAN.totalBars * 3, '온음 = 마디당 3음(트라이어드)');
  assert.equal(four.length, PLAN.totalBars * 12, '4박 = 마디당 12음');
  // 첫 마디 화음 = 첫 코드 구성음, C4 옥타브(60~71)
  const sym = PLAN.sections[0].chords[0];
  const chord = StudioCore.parseChord(sym);
  const first = hold.slice(0, 3).map(n => ((n.midi % 12) + 12) % 12).sort((a, b) => a - b);
  assert.deepEqual(first, [chord.root, chord.third, chord.fifth].sort((a, b) => a - b), '구성음(' + sym + ')');
  assert.ok(hold.every(n => n.midi >= 60 && n.midi <= 71), 'C4 옥타브 보이싱');
});

test('genGuitar: 파워코드(근음+5도+옥타브), 아르페지오는 단음 흐름', () => {
  const pw = StudioCore.genGuitar(PLAN, { pattern: 0 });
  const chord = StudioCore.parseChord(PLAN.sections[0].chords[0]);
  const first3 = pw.slice(0, 3).map(n => n.midi).sort((a, b) => a - b);
  assert.equal(first3[1] - first3[0], 7, '근음+5도');
  assert.equal(first3[2] - first3[0], 12, '+옥타브');
  assert.equal(((first3[0] % 12) + 12) % 12, chord.root, '근음 일치');
  const arp = StudioCore.genGuitar(PLAN, { pattern: 3 });
  // 아르페지오는 같은 시각에 한 음만
  const byStart = {};
  arp.forEach(n => { byStart[n.start] = (byStart[n.start] || 0) + 1; });
  assert.ok(Object.values(byStart).every(c => c === 1), '아르페지오 = 단음');
  const drive = StudioCore.genGuitar(PLAN, { pattern: 2 });
  assert.ok(drive.length > pw.length, '8분 드라이브가 더 촘촘');
});

test('genMelody: 음역·마디 첫 음=코드톤·시드 재현·재생성 차이·성격별 밀도', () => {
  const lane = StudioCore.genMelody(PLAN, { style: 1, seed: 7 });
  assert.ok(lane.every(n => n.midi >= 67 && n.midi <= 83), '멜로디 음역 G4~B5');
  // 각 마디 첫 음은 그 코드 구성음
  let bar = 0;
  PLAN.sections.forEach(sec => {
    for (let b = 0; b < sec.bars; b++) {
      const chord = StudioCore.parseChord(sec.chords[b % sec.chords.length]);
      const first = lane.find(n => n.start === bar * BAR);
      assert.ok(first, '마디 ' + bar + ' 첫 음');
      const pc = ((first.midi % 12) + 12) % 12;
      assert.ok([chord.root, chord.third, chord.fifth].includes(pc), '마디 ' + bar + ' 강박=코드톤');
      bar++;
    }
  });
  // 시드 재현 + 재생성 차이
  const again = StudioCore.genMelody(PLAN, { style: 1, seed: 7 });
  assert.deepEqual(lane, again, '같은 시드 = 같은 멜로디');
  const other = StudioCore.genMelody(PLAN, { style: 1, seed: 999 });
  assert.notDeepEqual(lane.map(n => n.midi), other.map(n => n.midi), '다른 시드 = 다른 멜로디');
  // 성격: 활발 > 차분 밀도
  const calm = StudioCore.genMelody(PLAN, { style: 0, seed: 7 }).length;
  const busy = StudioCore.genMelody(PLAN, { style: 2, seed: 7 }).length;
  assert.ok(busy > calm, `활발(${busy}) > 차분(${calm})`);
});

test('combine: 5트랙 전체 — 채널·프로그램 올바름', () => {
  const lanes = {
    drums: StudioCore.genDrums(PLAN, { style: 0 }),
    bass: StudioCore.genBass(PLAN, { pattern: 1 }),
    piano: StudioCore.genPiano(PLAN, { pattern: 1 }),
    guitar: StudioCore.genGuitar(PLAN, { pattern: 0 }),
    melody: StudioCore.genMelody(PLAN, { style: 1, seed: 7 })
  };
  const out = StudioCore.combine(lanes, { tempo: PLAN.tempo, order: ['drums', 'bass', 'piano', 'guitar', 'melody'] });
  const p = parse(out.bytes);
  assert.equal(p.trackCount, 6, '메타 + 5트랙');
  const chs = new Set(p.ons.map(o => o.ch));
  [9, 3, 1, 2, 0].forEach(ch => assert.ok(chs.has(ch), '채널 ' + ch));
  assert.ok(p.progs.some(x => x.ch === 2 && x.prog === 29), '기타 프로그램(29)');
  assert.ok(p.progs.some(x => x.ch === 0 && x.prog === 54), '멜로디 프로그램(54)');
  assert.deepEqual(out.tracks, ['drums', 'bass', 'piano', 'guitar', 'melody']);
});

test('MELODY_VOICES: 악기 5종 + 허밍 2종, 남성 보컬은 옥타브 아래', () => {
  const v = StudioCore.MELODY_VOICES;
  assert.equal(v.length, 7, '7종');
  assert.ok(v.some(x => /여성 보컬/.test(x.name)) && v.some(x => /남성 보컬/.test(x.name)), '허밍 2종');
  ['바이올린', '플루트', '오보에', '클라리넷', '신스'].forEach(n =>
    assert.ok(v.some(x => x.name.includes(n)), n));
  const male = v.find(x => /남성/.test(x.name));
  assert.equal(male.oct, -12, '남성 = -12(한 옥타브 아래)');
  v.forEach(x => assert.ok(x.prog >= 0 && x.prog <= 127, x.name + ' GM 번호'));
});

test('combine: progs 덮어쓰기 — 멜로디를 바이올린(40)으로', () => {
  const melody = StudioCore.genMelody(PLAN, { style: 1, seed: 7 });
  const p = parse(StudioCore.combine({ melody }, { tempo: 100, progs: { melody: 40 } }).bytes);
  assert.ok(p.progs.some(x => x.ch === 0 && x.prog === 40), '바이올린 프로그램');
  assert.ok(!p.progs.some(x => x.ch === 0 && x.prog === 54), '기본(54) 아님');
});

test('sectionRanges + filterBySections: 구간 배치 — 끈 섹션의 음이 빠진다', () => {
  const ranges = StudioCore.sectionRanges(PLAN);
  assert.equal(ranges.length, PLAN.sections.length);
  assert.equal(ranges[0].startTick, 0);
  assert.equal(ranges[ranges.length - 1].endTick, PLAN.totalBars * BAR, '마지막 끝 = 총 마디');
  const lane = StudioCore.genBass(PLAN, { pattern: 1 });
  // 첫 섹션만 끄기
  const enabled = PLAN.sections.map((s, i) => i !== 0);
  const filtered = StudioCore.filterBySections(lane, ranges, enabled);
  assert.ok(filtered.length < lane.length, '음이 줄어듦');
  assert.ok(filtered.every(n => n.start >= ranges[0].endTick), '첫 섹션 구간에 음이 없음');
  // 모두 켜면 그대로
  assert.equal(StudioCore.filterBySections(lane, ranges, PLAN.sections.map(() => true)).length, lane.length);
  // enabled 없으면 그대로
  assert.equal(StudioCore.filterBySections(lane, ranges, null).length, lane.length);
});

test('genTrackSections: 섹션별 다른 패턴 — 코드·위상 유지, 지정 구간만 생성', () => {
  const ranges = StudioCore.sectionRanges(PLAN);
  // 첫 섹션=아르페지오(3), 마지막 섹션=4박 컴핑(2), 나머지 없음
  const patterns = PLAN.sections.map((s, i) => i === 0 ? 3 : (i === PLAN.sections.length - 1 ? 2 : null));
  const lane = StudioCore.genTrackSections(PLAN, 'piano', patterns);
  assert.ok(lane.length > 0);
  // 모든 음이 첫/마지막 섹션 안에만
  const last = ranges[ranges.length - 1];
  assert.ok(lane.every(n => (n.start < ranges[0].endTick) || (n.start >= last.startTick && n.start < last.endTick)), '지정 구간만');
  // 첫 섹션은 아르페지오(단음) — 같은 시각 1음
  const firstSec = lane.filter(n => n.start < ranges[0].endTick);
  const byStart = {};
  firstSec.forEach(n => { byStart[n.start] = (byStart[n.start] || 0) + 1; });
  assert.ok(Object.values(byStart).every(c => c === 1), '첫 섹션=아르페지오(단음)');
  // 마지막 섹션은 4박 컴핑(화음 3음씩)
  const lastSec = lane.filter(n => n.start >= last.startTick);
  const byStart2 = {};
  lastSec.forEach(n => { byStart2[n.start] = (byStart2[n.start] || 0) + 1; });
  assert.ok(Object.values(byStart2).every(c => c === 3), '마지막 섹션=화음 3음');
  // 전체 곡을 그 패턴으로 만든 것과 구간 내용이 일치(코드 위상 보존)
  const fullArp = StudioCore.genPiano(PLAN, { pattern: 3 });
  const expected = StudioCore.filterBySections(fullArp, ranges, ranges.map((r, i) => i === 0));
  assert.deepEqual(firstSec, expected, '코드 진행 위상 일치');
});

test('genMelody: 같은 시드라도 장르/분위기가 다르면 멜로디가 다르다', () => {
  // 섹션(코드)까지 똑같이 두고 genreKey만 바꿔 순수 시드 혼합 효과 확인
  const planB = JSON.parse(JSON.stringify(PLAN)); planB.genreKey = 'ballad';
  const a = StudioCore.genMelody(PLAN, { style: 1, seed: 7 });
  const b = StudioCore.genMelody(planB, { style: 1, seed: 7 });
  assert.notDeepEqual(a.map(n => n.midi + ':' + n.start), b.map(n => n.midi + ':' + n.start), '장르 다르면 멜로디 다름');
  const planC = JSON.parse(JSON.stringify(PLAN)); planC.moodKey = 'calm';
  const c = StudioCore.genMelody(planC, { style: 1, seed: 7 });
  assert.notDeepEqual(a.map(n => n.midi + ':' + n.start), c.map(n => n.midi + ':' + n.start), '분위기 다르면 멜로디 다름');
});

// ── 내 곡 불러오기(importMelody) ──
function makeMelodyMidi(notes, ppq = 480, bpm = 100) {
  // notes: [[midi, startBeats, lenBeats], ...]  (드럼 아님, ch0)
  function vlq(v) { const a = [v & 0x7f]; v >>= 7; while (v > 0) { a.unshift((v & 0x7f) | 0x80); v >>= 7; } return a; }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function u16(v) { return [(v >>> 8) & 255, v & 255]; }
  function chunk(id, d) { const a = []; for (const ch of id) a.push(ch.charCodeAt(0)); return a.concat(u32(d.length), d); }
  const uspq = Math.round(60000000 / bpm);
  let ev = [];
  notes.forEach(([m, s, l]) => { ev.push({ t: Math.round(s * ppq), on: 1, m }); ev.push({ t: Math.round((s + l) * ppq), on: 0, m }); });
  ev.sort((a, b) => a.t - b.t || (a.on - b.on));
  let trk = [].concat(vlq(0), [0xff, 0x51, 3, (uspq >> 16) & 255, (uspq >> 8) & 255, uspq & 255]);
  let last = 0;
  ev.forEach(e => { trk = trk.concat(vlq(e.t - last)); trk.push(e.on ? 0x90 : 0x80, e.m & 0x7f, e.on ? 90 : 0); last = e.t; });
  trk = trk.concat(vlq(0), [0xff, 0x2f, 0]);
  return Uint8Array.from(chunk('MThd', u16(0).concat(u16(1), u16(ppq))).concat(chunk('MTrk', trk)));
}

test('importMelody: 조성·템포·멜로디 추출 (C장조 8마디)', () => {
  // C major 멜로디(흰건반만): C E G E / A C E C / F A C A / G B D B … → 명확한 C장조
  const barTones = [
    [60, 64, 67, 64], [69, 72, 76, 72], [65, 69, 72, 69], [67, 71, 74, 71],
    [60, 64, 67, 64], [69, 72, 76, 72], [65, 69, 72, 69], [60, 64, 67, 72]
  ];
  const notes = [];
  for (let bar = 0; bar < 8; bar++) barTones[bar].forEach((m, i) => notes.push([m, bar * 4 + i, 1]));
  const bytes = makeMelodyMidi(notes, 480, 120);
  const res = StudioCore.importMelody(bytes);
  assert.ok(res.ok, res.error);
  assert.equal(res.plan.tempo, 120, '템포 추출');
  assert.equal(res.plan.totalBars, 8, '8마디');
  assert.equal(res.plan.sections.reduce((a, s) => a + s.bars, 0), 8, '섹션 합=총 마디');
  // C장조 ↔ A단조는 나란한 조(구성음 동일) — 둘 중 하나로 판단되면 OK
  assert.ok((res.plan.keyRoot === 0 && !res.plan.minor) || (res.plan.keyRoot === 9 && res.plan.minor),
    '조성 = C장조 또는 나란한 A단조: ' + res.plan.key);
  // 추정 코드는 모두 C장조 다이어토닉({C Dm Em F G Am})이어야 한다
  const DIATONIC = new Set(['C', 'Dm', 'Em', 'F', 'G', 'Am']);
  const all = res.plan.sections.flatMap(s => s.chords);
  assert.ok(all.every(c => DIATONIC.has(c)), '모든 코드가 C장조 다이어토닉: ' + [...new Set(all)].join(','));
  // 멜로디 레인: 음이 있고 스튜디오 PPQ 기준 시작이 0
  assert.ok(res.melodyLane.length >= 32, '멜로디 음 수');
  assert.equal(res.melodyLane[0].start, 0, '첫 음 시작 0');
});

test('importMelody: 추정 코드로 반주 생성이 이어진다 (베이스 근음 일치)', () => {
  const notes = [];
  for (let bar = 0; bar < 4; bar++) { const root = 60; notes.push([root, bar * 4, 2], [root + 4, bar * 4 + 2, 2]); }
  const res = StudioCore.importMelody(makeMelodyMidi(notes, 480, 100));
  assert.ok(res.ok);
  const bass = StudioCore.genBass(res.plan, { pattern: 1 });
  // 첫 마디 베이스 근음 = 첫 코드 근음
  const sym = res.plan.sections[0].chords[0];
  const PCn = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = PCn[sym[0]]; if (sym[1] === '#') pc = (pc + 1) % 12;
  const first = bass.find(n => n.start === 0);
  assert.equal(((first.midi % 12) + 12) % 12, pc, '베이스 근음 = 추정 코드 근음');
});

test('importMelody: 비 MIDI·빈 파일은 오류', () => {
  assert.ok(StudioCore.importMelody(Uint8Array.from([1, 2, 3, 4])).error, '비 MIDI');
});

test('detectKey: A단조 멜로디를 단조로 판단', () => {
  const w = new Array(12).fill(0);
  [9, 11, 0, 2, 4, 5, 7].forEach((pc, i) => { w[pc] = [8, 2, 5, 4, 5, 4, 3][i]; }); // A minor 스케일 가중
  const k = StudioCore.detectKey(w);
  assert.equal(k.root, 9, '으뜸 A');
  assert.equal(k.minor, true, '단조');
});

test('parseAbcMelody / importMelodyAbc: ABC 단선율을 멜로디로', () => {
  const abc = 'X:1\nT:t (멜로디)\nM:4/4\nL:1/8\nQ:1/4=110\nK:C\n"C"C2 E2 G2 c2 | "G"G2 B2 d2 z2 |]\n';
  const p = StudioCore.parseAbcMelody(abc);
  assert.ok(!p.error, p.error);
  assert.equal(p.tempo, 110, '템포');
  assert.deepEqual(p.notes.map(n => n.midi), [60, 64, 67, 72, 67, 71, 74], 'C E G c / G B d (z 제외)');
  assert.equal(p.notes[0].d, 480, '2/8=4분음표=480틱(ppq480)');
  const res = StudioCore.importMelodyAbc(abc);
  assert.ok(res.ok, res.error);
  assert.equal(res.plan.tempo, 110);
  assert.ok(res.melodyLane.length === 7, '멜로디 레인 7음');
});

test('laneToAbc → parseAbcMelody 왕복: 음높이 보존', () => {
  const u = StudioCore.PPQ / 2; // 1/8
  const lane = [
    { midi: 60, start: 0, dur: u * 2, vel: 92 }, { midi: 64, start: u * 2, dur: u * 2, vel: 92 },
    { midi: 67, start: u * 4, dur: u * 2, vel: 92 }, { midi: 72, start: u * 6, dur: u * 2, vel: 92 }
  ];
  const abc = StudioCore.laneToAbc(lane, { tempo: 100, title: 'x' });
  assert.ok(/L:1\/8/.test(abc) && /\|\]/.test(abc), 'ABC 형식');
  const back = StudioCore.parseAbcMelody(abc);
  assert.deepEqual(back.notes.map(n => n.midi), [60, 64, 67, 72], '왕복 음높이 보존');
});

test('expandLoop: 씨앗(4마디)을 전체 곡 구성으로 채운다', () => {
  // 4마디 씨앗 plan + 멜로디
  const seed = StudioCore.importMelodyAbc('X:1\nL:1/8\nQ:1/4=100\nK:C\n"C"C2 E2 G2 E2 | "F"F2 A2 c2 A2 | "G"G2 B2 d2 B2 | "C"C2 E2 G2 c2 |]\n');
  assert.equal(seed.plan.totalBars, 4, '씨앗 4마디');
  const out = StudioCore.expandLoop(seed.plan, seed.melodyLane);
  assert.ok(out.plan.totalBars > seed.plan.totalBars, '확장됨: ' + out.plan.totalBars);
  assert.equal(out.plan.sections.length, 9, '인트로~아웃트로 9섹션');
  assert.equal(out.plan.totalBars, 9 * 4, '9섹션 × 4마디');
  assert.ok(out.plan.sections.some(s => s.name === '코러스') && out.plan.sections.some(s => s.name === '벌스'), '구성에 벌스·코러스');
  // 벌스 섹션 코드 = 씨앗 코드 타일링
  const verse = out.plan.sections.find(s => s.name === '벌스');
  assert.deepEqual(verse.chords, seed.plan.sections[0].chords, '씨앗 코드 반복');
  // 멜로디도 확장(음 수 증가), 코러스 구간에 음이 있다
  assert.ok(out.melodyLane.length > seed.melodyLane.length, '멜로디 확장');
  const BARt = StudioCore.PPQ * 4;
  const chorusIdx = out.plan.sections.findIndex(s => s.name === '코러스');
  const chorusStart = out.plan.sections.slice(0, chorusIdx).reduce((a, s) => a + s.bars, 0) * BARt;
  assert.ok(out.melodyLane.some(n => n.start >= chorusStart && n.start < chorusStart + 4 * BARt), '코러스 구간 멜로디');
  // 인트로는 성겨야(강박 음만) — 인트로 음 수 < 벌스 음 수
  const introCount = out.melodyLane.filter(n => n.start < 4 * BARt).length;
  const verseStart = 4 * BARt, verseCount = out.melodyLane.filter(n => n.start >= verseStart && n.start < 2 * verseStart).length;
  assert.ok(introCount <= verseCount, `인트로(${introCount}) ≤ 벌스(${verseCount})`);
  // ── 섹션마다 멜로디가 달라야 한다(단순 타일링 아님) ──
  // 각 섹션 구간의 음을 (섹션-상대 시작, midi)로 뽑는 헬퍼
  const secAt = i => {
    const start = out.plan.sections.slice(0, i).reduce((a, s) => a + s.bars, 0) * BARt;
    return out.melodyLane.filter(n => n.start >= start && n.start < start + seed.plan.totalBars * BARt)
      .map(n => (n.start - start) + ':' + n.midi).join(',');
  };
  // 코러스 인덱스들(4,5,7) — role 캐시로 서로 동일해야
  const chorusIdxs = out.plan.sections.map((s, i) => s.name === '코러스' ? i : -1).filter(i => i >= 0);
  assert.ok(chorusIdxs.length >= 2, '코러스 2개 이상');
  const firstChorus = secAt(chorusIdxs[0]);
  chorusIdxs.slice(1).forEach(ci => assert.equal(secAt(ci), firstChorus, '반복 코러스는 동일한 변형'));
  // 벌스(첫)와 코러스는 서로 달라야(변형 적용됨)
  const firstVerse = secAt(1);
  assert.notEqual(firstVerse, firstChorus, '벌스 ≠ 코러스(변형 적용)');
  // 벌스1 ≠ 벌스2(둘째 벌스는 변주 vary=0.30)
  const verse2Idx = out.plan.sections.map((s, i) => s.name === '벌스' ? i : -1).filter(i => i >= 0)[1];
  assert.notEqual(secAt(1), secAt(verse2Idx), '벌스1 ≠ 벌스2(변주)');
});
