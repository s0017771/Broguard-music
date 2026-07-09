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

test('buildVocalBrief: 영어 스타일 태그 + 섹션 태그 가사(가사는 한글 유지)', () => {
  const brief = Stage3.buildVocalBrief(PLAN, BLOCKS);
  assert.ok(brief.includes('[Style]') && brief.includes('[Lyrics]'));
  assert.ok(brief.includes(PLAN.tempo + ' BPM'));
  // 스타일 태그는 영어여야 함(한글 장르·분위기 금지) — 밝음 팝 → pop, bright
  assert.ok(/pop/.test(brief) && /bright/.test(brief), '영어 장르·분위기: ' + brief.split('\n')[0]);
  assert.ok(brief.includes('korean vocal') && brief.includes('C major'));
  const styleLine = brief.split('\n')[0];
  assert.ok(!/[가-힣]/.test(styleLine), '[Style] 줄에 한글이 없어야 함: ' + styleLine);
  // 섹션 이름은 영어 태그, 가사 본문은 한글 유지
  assert.ok(brief.includes('[Verse]') && brief.includes('[Chorus]'));
  assert.ok(brief.includes('거울 속 흰머리'), '한글 가사 본문 유지');
});

test('buildVocalBrief: "(인트로)" 같은 자리표시는 가사에서 제거된다(가수가 읽지 않게)', () => {
  const blocksWithPlaceholders = [
    { name: '인트로', text: '(인트로)' },
    { name: '벌스', text: '진짜 가사 한 줄' },
    { name: '프리코러스', text: '(프리코러스)' },
    { name: '코러스', text: '후렴 가사' }
  ];
  const brief = Stage3.buildVocalBrief(PLAN, blocksWithPlaceholders);
  assert.ok(!brief.includes('(인트로)') && !brief.includes('(프리코러스)'), '괄호 자리표시 제거: ' + brief);
  assert.ok(brief.includes('[Intro]') && brief.includes('[Pre-Chorus]'), '섹션 태그는 유지');
  assert.ok(brief.includes('진짜 가사 한 줄') && brief.includes('후렴 가사'), '실제 가사는 유지');
});

test('scaleKaraoke: 타임라인을 실제 오디오 길이에 맞춰 선형 스케일', () => {
  const k = Stage3.buildKaraoke(PLAN, BLOCKS);
  const scaled = Stage3.scaleKaraoke(k, 60);
  assert.equal(scaled.totalSec, 60);
  assert.equal(scaled.lines.length, k.lines.length);
  // 마지막 줄 끝 ≈ 60
  assert.ok(Math.abs(scaled.lines[scaled.lines.length - 1].endSec - 60) < 0.5);
  // 비율 보존: 첫 줄 끝/총길이 동일
  assert.ok(Math.abs(scaled.lines[0].endSec / 60 - k.lines[0].endSec / k.totalSec) < 0.01);
  // 여전히 단조 증가
  for (let i = 1; i < scaled.lines.length; i++) assert.ok(scaled.lines[i].startSec >= scaled.lines[i - 1].startSec);
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
