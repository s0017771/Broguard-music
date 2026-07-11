// BkdCore(BKD 드럼 교실) 유닛 테스트 — drum.html에서 엔진 추출
// 실행: node --test tests/bkd.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'drum.html'), 'utf8');
const m = html.match(/<script id="bkd-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'drum.html에 bkd-core 필요');
const tmp = mkdtempSync(join(tmpdir(), 'bkd-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const BkdCore = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

test('PADS: 11패드 — 왼손/오른손 배치, 키가 겹치지 않는다', () => {
  assert.equal(BkdCore.PADS.length, 11);
  const keys = BkdCore.PADS.map(p => p.key);
  assert.equal(new Set(keys).size, keys.length, '키 중복 없음');
  const left = BkdCore.PADS.filter(p => p.hand === 'L').map(p => p.id);
  const right = BkdCore.PADS.filter(p => p.hand === 'R').map(p => p.id);
  assert.ok(left.includes('snare') && left.includes('hhc'), '왼손: 스네어·하이햇');
  assert.ok(right.includes('kick') && right.includes('ride'), '오른손: 킥·라이드');
});

test('keyToPad: 새 키맵(C·M킥, Space스네어, QWER, F/G·H/J, I/O)', () => {
  assert.equal(BkdCore.keyToPad('c').id, 'kick', 'C=킥');
  assert.equal(BkdCore.keyToPad('m').id, 'kick', 'M=킥(별칭)');
  assert.equal(BkdCore.keyToPad(' ').id, 'snare', 'Space=스네어');
  assert.equal(BkdCore.keyToPad('q').id, 'pedal', 'Q=페달햇');
  assert.equal(BkdCore.keyToPad('w').id, 'hhc', 'W=하이햇');
  assert.equal(BkdCore.keyToPad('e').id, 'crash', 'E=크래시(좌)');
  assert.equal(BkdCore.keyToPad('r').id, 'hho', 'R=오픈햇');
  assert.equal(BkdCore.keyToPad('f').id, 'tom1', 'F=탐1');
  assert.equal(BkdCore.keyToPad('g').id, 'tom2', 'G=탐2');
  assert.equal(BkdCore.keyToPad('h').id, 'tom2', 'H=탐2(별칭)');
  assert.equal(BkdCore.keyToPad('j').id, 'floor', 'J=플로어탐');
  assert.equal(BkdCore.keyToPad('i').id, 'crash2', 'I=크래시(우)');
  assert.equal(BkdCore.keyToPad('o').id, 'ride', 'O=라이드');
  assert.equal(BkdCore.keyToPad('W').id, 'hhc', '대문자도');
  assert.equal(BkdCore.keyToPad('x'), null, '없는 키');
});

test('PADS: 패드가 킷 안에 들어온다(가림 없음 — x+size ≤ 100, y+size×1.8 ≤ 100)', () => {
  BkdCore.PADS.forEach(p => {
    assert.ok(p.x + p.size <= 100, p.id + ' 가로: ' + (p.x + p.size));
    assert.ok(p.y + p.size * 1.8 <= 100, p.id + ' 세로: ' + (p.y + p.size * 1.8));
  });
});

test('quantizeHits: 8분음표로 붙이고 같은 스텝은 합친다', () => {
  const bpm = 120;                    // 8분음표 = 0.25초
  const hits = [
    { padId: 'kick', t: 0.01 }, { padId: 'hhc', t: 0.02 },   // step 0 (동시)
    { padId: 'hhc', t: 0.26 },                                 // step 1
    { padId: 'snare', t: 0.49 }                                // step 2
  ];
  const q = BkdCore.quantizeHits(hits, bpm, 1);
  assert.deepEqual(q.map(s => s.step), [0, 1, 2]);
  assert.deepEqual(q[0].padIds.sort(), ['hhc', 'kick'], '동시 타격 병합');
});

test('hitsToPattern: 스튜디오 「직접 입력」과 호환되는 문자열(마디 합=8)', () => {
  const bpm = 120;
  const hits = [
    { padId: 'kick', t: 0.0 }, { padId: 'hhc', t: 0.0 },
    { padId: 'hhc', t: 0.25 },
    { padId: 'snare', t: 0.5 }, { padId: 'hhc', t: 0.5 },
    { padId: 'hhc', t: 0.75 },
    { padId: 'kick', t: 1.0 }, { padId: 'hhc', t: 1.0 },
    { padId: 'hhc', t: 1.25 },
    { padId: 'snare', t: 1.5 }, { padId: 'hhc', t: 1.5 },
    { padId: 'hhc', t: 1.75 }
  ];
  const pat = BkdCore.hitsToPattern(hits, bpm, 1);
  assert.equal(pat, 'hk1 h1 hs1 h1 hk1 h1 hs1 h1', '기본 록: ' + pat);
  // 각 마디 합=8 검증(간이 파서)
  pat.split('|').forEach(bar => {
    const sum = bar.trim().split(/\s+/).reduce((a, tk) => a + +(/(\d+)$/.exec(tk)[1]), 0);
    assert.equal(sum, 8);
  });
});

test('hitsToPattern: 빈 스텝은 z로 합쳐진다(z1 z1 → 앞 토큰에 흡수)', () => {
  const pat = BkdCore.hitsToPattern([{ padId: 'kick', t: 0 }], 120, 1);
  assert.equal(pat, 'k8', '킥 하나 + 나머지 쉼: ' + pat);
});

test('hitsToMidi: 유효한 드럼 MIDI(MThd + ch10 노트)', () => {
  const bytes = BkdCore.hitsToMidi([{ padId: 'kick', t: 0 }, { padId: 'snare', t: 0.5 }], 120);
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), 'MThd');
  // 0x99(ch10 노트온) 존재
  let found = false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x99) { found = true; break; }
  assert.ok(found, '채널 10 노트온');
});

test('patternToSteps: 레슨 패턴 → 스텝(가이드) — 라운드트립', () => {
  const l = BkdCore.LESSONS[0];
  const s = BkdCore.patternToSteps(l.pattern);
  assert.equal(s.totalSteps, 8, '한 마디 = 8스텝');
  assert.ok(s.steps.some(x => x.step === 0 && x.padIds.includes('kick')), '1박 킥');
  assert.ok(s.steps.some(x => x.step === 2 && x.padIds.includes('snare')), '2박 스네어');
});

test('LESSONS: 기본 비트 10종 — 모두 파싱되고 마디 단위', () => {
  assert.equal(BkdCore.LESSONS.length, 10, '10종');
  BkdCore.LESSONS.forEach(les => {
    const st = BkdCore.patternToSteps(les.pattern);
    assert.ok(st.steps.length > 0 && st.totalSteps % 8 === 0, les.name);
    assert.ok(les.hint && les.hint.length > 5, les.name + ' 힌트');
  });
});

test('SONGS: PD곡 10곡 — 멜로디 합=8의 배수, 음역 유효, 비트 파싱', () => {
  assert.equal(BkdCore.SONGS.length, 10, '10곡');
  BkdCore.SONGS.forEach(song => {
    const total = song.melody.reduce((s, n) => s + n[1], 0);
    assert.equal(total % 8, 0, song.name + ' 멜로디 합(' + total + ')은 8의 배수');
    song.melody.forEach(n => { if (n[0] != null) assert.ok(n[0] >= 48 && n[0] <= 84, song.name + ' 음역: ' + n[0]); });
    assert.ok(song.bpm >= 60 && song.bpm <= 160, song.name + ' BPM');
    const st = BkdCore.patternToSteps(song.pattern);
    assert.ok(st.steps.length > 0, song.name + ' 드럼 패턴');
  });
});

test('parseMidiMelody: .mid에서 멜로디를 8분 양자화로 추출한다', () => {
  // 간단한 SMF(멜로디 2음: C4 4분, E4 4분, 120BPM, PPQ480) 직접 제작
  function vlq(v) { const a = [v & 0x7f]; v >>= 7; while (v > 0) { a.unshift((v & 0x7f) | 0x80); v >>= 7; } return a; }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function u16(v) { return [(v >>> 8) & 255, v & 255]; }
  function chunk(id, d) { const a = []; for (const ch of id) a.push(ch.charCodeAt(0)); return a.concat(u32(d.length), d); }
  let trk = [].concat(vlq(0), [0xff, 0x51, 3, 0x07, 0xa1, 0x20]);      // 120 BPM
  trk = trk.concat(vlq(0), [0x90, 60, 90], vlq(480), [0x80, 60, 0]);   // C4 4분
  trk = trk.concat(vlq(0), [0x90, 64, 90], vlq(480), [0x80, 64, 0]);   // E4 4분
  trk = trk.concat(vlq(0), [0xff, 0x2f, 0]);
  const bytes = Uint8Array.from(chunk('MThd', u16(0).concat(u16(1), u16(480))).concat(chunk('MTrk', trk)));
  const res = BkdCore.parseMidiMelody(bytes);
  assert.ok(!res.error, res.error);
  assert.equal(res.bpm, 120);
  const notes = res.melody.filter(n => n[0] != null);
  assert.deepEqual(notes.map(n => n[0]), [60, 64], '두 음 추출');
  assert.equal(notes[0][1], 2, '4분음표 = 2스텝(8분)');
  const total = res.melody.reduce((s, n) => s + n[1], 0);
  assert.equal(total % 8, 0, '마디 채움');
  // 오류 처리
  assert.ok(BkdCore.parseMidiMelody(Uint8Array.from([1, 2, 3, 4])).error, '비 MIDI 오류');
});
