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
