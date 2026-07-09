// Stage3(가라오케 타임라인 + 커버 스펙) 유닛 테스트 — songmaker.html에서 추출
// 실행: node --test tests/stage3.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'songmaker.html'), 'utf8');
function blk(id) { const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>')); assert.ok(m, id); return m[1]; }
const tmp = mkdtempSync(join(tmpdir(), 'stage3-'));
const require = createRequire(import.meta.url);
function load(id, g) { const p = join(tmp, id + '.cjs'); writeFileSync(p, blk(id) + `\nif(typeof module!=='undefined')module.exports=${g};`); return require(p); }
const SongCore = load('songcore', 'SongCore');
const Stage3 = load('stage3', 'Stage3');

const PLAN = SongCore.planSong({ title: '어깨 펴고 화이팅', mood: 'bright', genre: 'pop', seed: 106 });
const BLOCKS = [
  { name: '인트로', text: '오늘도 알람보다 먼저' },
  { name: '벌스', text: '거울 속 흰머리 하나 늘어도\n넥타이 고쳐 매고 문을 나서' },
  { name: '프리코러스', text: '조금 지쳐도 괜찮아' },
  { name: '코러스', text: '어깨 펴고 화이팅 오늘도 한 걸음\n넘어져도 다시 일어나는 아빠' }
];

test('buildKaraoke: 줄마다 시작·끝 시간이 있고 시간은 단조 증가한다', () => {
  const k = Stage3.buildKaraoke(PLAN, BLOCKS);
  assert.ok(k.lines.length > 0);
  assert.ok(k.totalSec > 0);
  for (let i = 0; i < k.lines.length; i++) {
    assert.ok(k.lines[i].endSec > k.lines[i].startSec, '끝>시작');
    if (i > 0) assert.ok(k.lines[i].startSec >= k.lines[i - 1].startSec, '단조 증가');
  }
  // 마지막 줄 끝 ≈ 총 길이
  assert.ok(Math.abs(k.lines[k.lines.length - 1].endSec - k.totalSec) < 0.5);
});

test('buildKaraoke: 총 길이 = 총 마디 × 박 × (60/템포)', () => {
  const k = Stage3.buildKaraoke(PLAN, BLOCKS);
  const expected = PLAN.totalBars * 4 * (60 / PLAN.tempo);
  assert.ok(Math.abs(k.totalSec - expected) < 0.5, `${k.totalSec} ≈ ${expected}`);
});

test('lineAt: 특정 시각의 현재 줄 인덱스를 정확히 찾는다', () => {
  const k = Stage3.buildKaraoke(PLAN, BLOCKS);
  assert.equal(Stage3.lineAt(k, k.lines[0].startSec + 0.01), 0);
  assert.equal(Stage3.lineAt(k, k.lines[3].startSec + 0.01), 3);
  assert.equal(Stage3.lineAt(k, -1), -1, '시작 전은 -1');
  assert.equal(Stage3.lineAt(k, k.totalSec + 10), k.lines.length - 1, '끝 이후는 마지막');
});

test('buildKaraoke: 가사 없으면 섹션 이름 자리표시로라도 타임라인을 만든다', () => {
  const k = Stage3.buildKaraoke(PLAN, []);
  assert.equal(k.lines.length, PLAN.sections.length, '섹션당 한 줄');
  assert.ok(k.lines.every(l => l.text.length > 0));
});

test('buildKaraoke: 반복 코러스는 코러스 가사를 재사용한다(이름 매칭)', () => {
  const k = Stage3.buildKaraoke(PLAN, BLOCKS);
  const chorusLines = k.lines.filter(l => l.section === '코러스');
  assert.ok(chorusLines.some(l => l.text.includes('어깨 펴고')), '코러스 가사 반영');
});

test('coverSpec: 분위기별 색·도형·제목을 반환(시드 재현)', () => {
  const a = Stage3.coverSpec(PLAN), b = Stage3.coverSpec(PLAN);
  assert.deepEqual(a, b, '같은 plan=같은 커버');
  assert.ok(Array.isArray(a.bg) && a.bg.length === 2 && /^#/.test(a.bg[0]));
  assert.ok(a.shapes.length >= 5 && a.shapes.every(s => s.x >= 0 && s.x <= 1 && /^#/.test(s.c)));
  assert.equal(a.title, '어깨 펴고 화이팅');
  const sad = Stage3.coverSpec(SongCore.planSong({ mood: 'sad', genre: 'ballad', seed: 1 }));
  assert.notDeepEqual(sad.bg, a.bg, '슬픔과 밝음은 다른 색');
});
