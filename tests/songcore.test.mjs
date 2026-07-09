// SongCore 코어 유닛 테스트 — songmaker.html에서 엔진 추출
// 실행: node --test tests/songcore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'songmaker.html'), 'utf8');
const m = html.match(/<script id="songcore">([\s\S]*?)<\/script>/);
assert.ok(m, 'songmaker.html에 <script id="songcore"> 블록이 있어야 합니다');
const tmp = mkdtempSync(join(tmpdir(), 'songcore-'));
writeFileSync(join(tmp, 'core.cjs'), m[1]);
const SongCore = createRequire(import.meta.url)(join(tmp, 'core.cjs'));

// ---------- 설계도 기본 ----------
test('planSong: 섹션·코드·템포·조성을 갖춘 설계도를 만든다', () => {
  const p = SongCore.planSong({ title: '여름밤', theme: '바닷가', mood: 'bright', genre: 'pop', seed: 1 });
  assert.ok(p.sections.length >= 6, '팝은 여러 섹션');
  assert.ok(p.sections.every(s => Array.isArray(s.chords) && s.chords.length === 4), '섹션마다 코드 4개');
  assert.equal(p.meter, '4/4');
  assert.ok(p.tempo >= 50 && p.tempo <= 160, '템포 범위: ' + p.tempo);
  assert.ok(p.totalBars === p.sections.reduce((a, s) => a + s.bars, 0), '총 마디 합산 일치');
  assert.ok(p.estSec > 0);
  assert.ok(p.sections.some(s => s.name === '코러스') && p.sections.some(s => s.name === '벌스'));
});

test('planSong: 슬픔=단조, 밝음=장조', () => {
  const sad = SongCore.planSong({ mood: 'sad', genre: 'ballad', seed: 3 });
  const bright = SongCore.planSong({ mood: 'bright', genre: 'ballad', seed: 3 });
  assert.ok(sad.minor && /단조/.test(sad.key), '슬픔은 단조');
  assert.ok(!bright.minor && /장조/.test(bright.key), '밝음은 장조');
  // 단조 코러스는 Am 시작, 장조 코러스는 C 시작
  assert.equal(sad.sections.find(s => s.name === '코러스').chords[0], 'Am');
  assert.equal(bright.sections.find(s => s.name === '코러스').chords[0], 'C');
});

test('planSong: 장르별 템포 성향(발라드 < 댄스)', () => {
  const ballad = SongCore.planSong({ genre: 'ballad', mood: 'calm', seed: 5 });
  const dance = SongCore.planSong({ genre: 'dance', mood: 'excited', seed: 5 });
  assert.ok(ballad.tempo < dance.tempo, `발라드 ${ballad.tempo} < 댄스 ${dance.tempo}`);
  assert.equal(dance.drumStyle, '포 온 더 플로어');
});

test('planSong: 시드 재현성 + short는 full보다 섹션이 적거나 같다', () => {
  const a = SongCore.planSong({ genre: 'pop', mood: 'bright', seed: 42 });
  const b = SongCore.planSong({ genre: 'pop', mood: 'bright', seed: 42 });
  assert.deepEqual(a, b, '같은 시드=같은 설계');
  const full = SongCore.planSong({ genre: 'pop', mood: 'bright', seed: 42, length: 'full' });
  const short = SongCore.planSong({ genre: 'pop', mood: 'bright', seed: 42, length: 'short' });
  assert.ok(short.sections.length <= full.sections.length, '짧게가 더 짧음');
  assert.ok(short.sections.some(s => s.name === '코러스'), '짧게도 코러스는 있음');
});

test('planSong: 코드는 Melody Maker가 읽는 심볼(C G Am F 등)이다', () => {
  const p = SongCore.planSong({ genre: 'pop', mood: 'bright', seed: 7 });
  const all = p.sections.flatMap(s => s.chords);
  assert.ok(all.every(c => /^[A-G][#b]?m?$/.test(c)), '코드 심볼 형식: ' + all.join(','));
});

// ---------- 가사 ----------
test('draftLyrics: 섹션마다 초안 가사를 만든다(오프라인 폴백)', () => {
  const p = SongCore.planSong({ title: '그리움', theme: '첫사랑', mood: 'sad', genre: 'ballad', seed: 2 });
  const ly = SongCore.draftLyrics(p);
  assert.equal(ly.length, p.sections.length);
  assert.ok(ly.every(b => b.name && typeof b.text === 'string'));
  assert.ok(ly.some(b => b.text.includes('첫사랑')), '주제어가 가사에 반영');
});

test('buildLyricPrompt: 제목·분위기·구성이 프롬프트에 담긴다', () => {
  const p = SongCore.planSong({ title: '별빛', theme: '밤하늘', mood: 'calm', genre: 'pop', seed: 9 });
  const prompt = SongCore.buildLyricPrompt(p);
  assert.ok(prompt.includes('별빛') && prompt.includes('밤하늘'));
  assert.ok(prompt.includes('코러스'), '구성 포함');
  assert.ok(/한국어/.test(prompt));
});

test('parseLyricText: [섹션] 머리표로 나뉜 LLM 응답을 블록으로 파싱', () => {
  const text = '[벌스]\n첫 줄\n둘째 줄\n\n[코러스]\n후렴 한 줄\n후렴 둘째 줄\n';
  const blocks = SongCore.parseLyricText(text);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].name, '벌스');
  assert.ok(blocks[0].text.includes('첫 줄') && blocks[0].text.includes('둘째 줄'));
  assert.equal(blocks[1].name, '코러스');
});
