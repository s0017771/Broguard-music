// TabCore 유닛 테스트 — tab.html에서 엔진 스크립트를 추출해 Node에서 실행
// 실행: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'tab.html'), 'utf8');
const m = html.match(/<script id="tab-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'tab.html 안에 <script id="tab-core"> 블록이 있어야 합니다');

const tmp = mkdtempSync(join(tmpdir(), 'tabcore-'));
writeFileSync(join(tmp, 'tab-core.cjs'), m[1]);
const TabCore = createRequire(import.meta.url)(join(tmp, 'tab-core.cjs'));

const PIANO_ABC = `X:1
T:학교종 (샘플)
M:4/4
L:1/8
Q:1/4=90
%%score {RH LH}
V:RH clef=treble
V:LH clef=bass
K:C
[V:RH] "C"G2 G2 A2 A2 | "C"G2 G2 E2 E2 | "C"G2 E2 G2 E2 | "G"D6 z2 |
[V:LH] C,4 E,4 | C,4 C,4 | E,4 E,4 | G,,6 z2 |
[V:RH] "C"G2 G2 A2 A2 | "C"G2 G2 E2 E2 | "G7"G2 E2 D2 E2 | "C"C6 z2 |
[V:LH] C,4 F,4 | C,4 C,4 | G,,4 G,,4 | C,6 z2 |
`;

// ---------- 조표 ----------
test('parseKey: 장조/단조 샵·플랫 개수', () => {
  assert.deepEqual(TabCore.parseKey('C').map, {});
  assert.deepEqual(TabCore.parseKey('G').map, { F: 1 });
  assert.deepEqual(TabCore.parseKey('D').map, { F: 1, C: 1 });
  assert.deepEqual(TabCore.parseKey('F').map, { B: -1 });
  assert.deepEqual(TabCore.parseKey('Bb').map, { B: -1, E: -1 });
  assert.deepEqual(TabCore.parseKey('Amin').map, {});
  assert.deepEqual(TabCore.parseKey('Em').map, { F: 1 });
  assert.deepEqual(TabCore.parseKey('Eminor ').map, { F: 1 });
  assert.deepEqual(TabCore.parseKey('Dmaj').map, { F: 1, C: 1 });
  assert.deepEqual(TabCore.parseKey('none').map, {});
});

// ---------- 파싱 ----------
test('parseABC: 헤더와 멀티보이스([V:RH] 프리픽스) 인식', () => {
  const song = TabCore.parseABC(PIANO_ABC);
  assert.equal(song.title, '학교종 (샘플)');
  assert.equal(song.meter, '4/4');
  assert.equal(song.unit, 1 / 8);
  assert.deepEqual(song.voiceOrder, ['RH', 'LH']);
});

test('parseABC: 음높이 — 중앙 C=60, 옥타브 기호', () => {
  const song = TabCore.parseABC('X:1\nK:C\nC c C, c\' B,, |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.midis[0]), [60, 72, 48, 84, 47]);
});

test('parseABC: 조표 적용 + 마디 내 임시표 지속 + 마디선 리셋', () => {
  // K:D → F#, C#. 첫 마디에서 =F 이후 같은 마디의 F는 내추럴 유지, 다음 마디는 다시 F#
  const song = TabCore.parseABC('X:1\nK:D\nF =F F | F |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.midis[0]), [66, 65, 65, 66]);
});

test('parseABC: 임시표는 같은 옥타브에만 적용', () => {
  const song = TabCore.parseABC('X:1\nK:C\n^F f |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.midis[0]), [66, 77]); // f(높은 옥타브)는 영향 없음
});

test('parseABC: 길이 — 배수, 분수, 슬래시 축약', () => {
  const song = TabCore.parseABC('X:1\nL:1/8\nK:C\nC2 C C/2 C// C3/2 |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.dur), [2, 1, 0.5, 0.25, 1.5]);
});

test('parseABC: 브로큰 리듬 > <', () => {
  const song = TabCore.parseABC('X:1\nL:1/8\nK:C\nC>D E<F |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => n.dur), [1.5, 0.5, 0.5, 1.5]);
});

test('parseABC: 셋잇단 (3', () => {
  const song = TabCore.parseABC('X:1\nL:1/8\nK:C\n(3CDE F |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.deepEqual(notes.map(n => Math.round(n.dur * 3) / 3), [2 / 3, 2 / 3, 2 / 3, 1]);
});

test('parseABC: 화음 [CEG] — 음 정렬, 외부 길이 적용', () => {
  const song = TabCore.parseABC('X:1\nL:1/8\nK:C\n[GCE]2 |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0].midis, [60, 64, 67]);
  assert.equal(notes[0].dur, 2);
});

test('parseABC: 붙임줄 — 같은 음 병합', () => {
  const song = TabCore.parseABC('X:1\nL:1/8\nK:C\nC2- C2 D |');
  const notes = song.voices['1'].events.filter(e => e.type === 'note');
  assert.equal(notes.length, 2);
  assert.equal(notes[0].dur, 4);
});

test('parseABC: 쉼표·코드 심볼·장식 무시', () => {
  const song = TabCore.parseABC('X:1\nK:C\n"Am"C z2 !f!{ag}D |');
  const evs = song.voices['1'].events;
  const notes = evs.filter(e => e.type === 'note');
  assert.equal(notes[0].chordSym, 'Am');
  assert.equal(evs.filter(e => e.type === 'rest').length, 1);
  assert.equal(notes.length, 2);
});

test('parseABC: 마디 수 보존', () => {
  const song = TabCore.parseABC(PIANO_ABC);
  const bars = song.voices.RH.events.filter(e => e.type === 'bar').length;
  assert.equal(bars, 8); // 마지막 | 뒤 음표가 없으므로 8개 마디 경계
});

// ---------- 보이스 선택 ----------
test('pickVoice: RH 우선, 지정 시 해당 보이스', () => {
  const song = TabCore.parseABC(PIANO_ABC);
  assert.equal(TabCore.pickVoice(song, 'auto').id, 'RH');
  assert.equal(TabCore.pickVoice(song, 'LH').id, 'LH');
});

test('pickVoice: 이름 매칭 실패 시 평균 음높이 높은 보이스', () => {
  const abc = 'X:1\nK:C\nV:low\nC,, D,, |\nV:high\nc d |';
  const song = TabCore.parseABC(abc);
  assert.equal(TabCore.pickVoice(song, 'auto').id, 'high');
});

// ---------- 옥타브 보정 ----------
test('autoShift: 범위 안이면 0, 높으면 -12 배수', () => {
  assert.equal(TabCore.autoShift([50, 55, 60], 40, 76), 0);
  assert.equal(TabCore.autoShift([84, 86, 88], 40, 76), -12);
  assert.equal(TabCore.autoShift([95, 97, 100], 40, 76), -24);
  assert.equal(TabCore.autoShift([30, 32, 35], 40, 76), 12);
  assert.equal(TabCore.autoShift([20, 22, 25], 40, 76), 24);
});

// ---------- 프렛 배치 ----------
test('assignFrets: 모든 프렛이 0..maxFret, 화음은 줄 중복 없음', () => {
  const res = TabCore.convert(PIANO_ABC, { maxFret: 15 });
  assert.ok(res.ok);
  for (const ev of res.events) {
    if (ev.type !== 'note') continue;
    const strings = new Set();
    for (const f of ev.frets) {
      assert.ok(f, '프렛 배치 누락');
      assert.ok(f.fret >= 0 && f.fret <= 15, `프렛 범위 초과: ${f.fret}`);
      assert.ok(!strings.has(f.string), '한 줄에 두 음 배치');
      strings.add(f.string);
    }
  }
});

test('assignFrets: 화음 프렛 스팬 ≤ 4', () => {
  const res = TabCore.convert('X:1\nK:C\n[CEG] [FAc] |', {});
  assert.ok(res.ok);
  for (const ev of res.events) {
    if (ev.type !== 'note') continue;
    const fretted = ev.frets.filter(f => f.fret > 0).map(f => f.fret);
    if (fretted.length > 1) {
      const span = Math.max(...fretted) - Math.min(...fretted);
      assert.ok(span <= 4, `스팬 ${span} > 4`);
    }
  }
});

test('assignFrets: 음역 밖 음은 옥타브 이동 + 경고', () => {
  const res = TabCore.convert("X:1\nK:C\nc'''' |", { octaveShift: 0 });
  assert.ok(res.ok);
  assert.ok(res.warnings.some(w => /옥타브 이동/.test(w)));
  const note = res.events.find(e => e.type === 'note');
  assert.ok(note.frets[0].fret <= 15);
});

test('카포: 프렛은 카포 기준 상대값', () => {
  // E2(MIDI 40)는 카포 2에서 연주 불가 → 옥타브 위로 이동되어 배치됨
  const res = TabCore.convert('X:1\nK:C\nE,, |', { capo: 2, octaveShift: 0 });
  assert.ok(res.ok);
  const note = res.events.find(e => e.type === 'note');
  assert.ok(note.frets[0].fret >= 0);
});

// ---------- ASCII 렌더링 ----------
test('renderAscii: 6줄 시스템, 줄 길이 동일, 마디선 존재', () => {
  const res = TabCore.convert(PIANO_ABC, {});
  assert.ok(res.ok);
  const lines = res.tab.split('\n');
  const tabLines = lines.filter(l => /^[eBGDAE]\|/.test(l));
  assert.equal(tabLines.length % 6, 0);
  assert.ok(tabLines.length >= 6);
  for (let i = 0; i < tabLines.length; i += 6) {
    const sys = tabLines.slice(i, i + 6);
    const w = sys[0].length;
    for (const l of sys) {
      assert.equal(l.length, w, '시스템 내 줄 길이 불일치:\n' + sys.join('\n'));
      assert.ok(l.endsWith('|'));
    }
  }
  assert.deepEqual(tabLines.slice(0, 6).map(l => l[0]), ['e', 'B', 'G', 'D', 'A', 'E']);
});

test('renderAscii: 코드 심볼 행 표시', () => {
  const res = TabCore.convert(PIANO_ABC, {});
  assert.ok(/(^|\n)\s*C\s+/.test(res.tab), '코드 심볼 C가 타브 위에 표시되어야 함');
});

test('renderAscii: 타브 폭 제한으로 시스템 분리', () => {
  const narrow = TabCore.convert(PIANO_ABC, { width: 40 });
  const wide = TabCore.convert(PIANO_ABC, { width: 200 });
  const count = t => t.tab.split('\n').filter(l => /^e\|/.test(l)).length;
  assert.ok(count(narrow) > count(wide), '좁은 폭에서 더 많은 시스템이 생겨야 함');
});

// ---------- 전체 파이프라인 ----------
test('convert: 학교종 샘플 끝까지 변환 (음 개수 보존)', () => {
  const res = TabCore.convert(PIANO_ABC, {});
  assert.ok(res.ok);
  assert.equal(res.voiceUsed, 'RH');
  const notes = res.events.filter(e => e.type === 'note');
  assert.equal(notes.length, 26); // RH 멜로디 26음 (마디당 4·4·4·1 × 2)
  assert.ok(res.tab.includes('학교종'));
  assert.ok(res.tab.includes('EADGBE'));
});

test('convert: 단일 보이스(보이스 선언 없음) ABC도 동작', () => {
  const res = TabCore.convert('X:1\nT:간단\nM:3/4\nL:1/4\nK:G\nG A B | c B A | G3 |', {});
  assert.ok(res.ok);
  assert.equal(res.events.filter(e => e.type === 'note').length, 7);
});

test('convert: 빈 입력·음표 없는 입력은 경고와 함께 실패', () => {
  assert.equal(TabCore.convert('', {}).ok, false);
  const r = TabCore.convert('X:1\nK:C\n', {});
  assert.equal(r.ok, false);
  assert.ok(r.warnings.length > 0);
});

test('convert: 높은 피아노 멜로디 자동 옥타브 하향', () => {
  const res = TabCore.convert("X:1\nK:C\nc' d' e' f' g' a' b' c'' |", {});
  assert.ok(res.ok);
  assert.ok(res.shift < 0, `옥타브 하향 필요 (shift=${res.shift})`);
  for (const ev of res.events) {
    if (ev.type === 'note') assert.ok(ev.frets[0].fret <= 15);
  }
});
