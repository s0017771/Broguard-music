// Melody Maker(무난작곡기) 엔진 유닛 테스트 — melody.html에서 엔진 스크립트를 추출해 실행
// 실행: node --test tests/melody-engine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'melody.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = blocks.find(b => /module\.exports/.test(b));
assert.ok(engine, 'melody.html에 module.exports를 가진 엔진 <script> 블록이 있어야 합니다');

const tmp = mkdtempSync(join(tmpdir(), 'melody-'));
writeFileSync(join(tmp, 'engine.cjs'), engine);
const { generate, generateSong } = createRequire(import.meta.url)(join(tmp, 'engine.cjs'));

// 코드 심볼 → 구성음 pitchClass (강박 검증용)
const ROOT_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function chordPcs(sym) {
  const m = sym.trim().match(/^([A-G])([#b]?)(m(?!aj)|min)?/);
  let pc = ROOT_PC[m[1]];
  if (m[2] === '#') pc = (pc + 1) % 12;
  if (m[2] === 'b') pc = (pc + 11) % 12;
  const minor = !!m[3];
  return [pc, (pc + (minor ? 3 : 4)) % 12, (pc + 7) % 12];
}

const CANON = 'C G Am Em F C F G';

// ---------- 기본 출력 ----------
test('generate: 요청한 개수만큼 후보를 반환하고 각 후보에 bars·score·abc가 있다', () => {
  const out = generate(CANON, { count: 5, seed: 1 });
  assert.equal(out.results.length, 5);
  for (const c of out.results) {
    assert.ok(Array.isArray(c.bars) && c.bars.length === 8, '8마디');
    assert.equal(typeof c.score, 'number');
    assert.ok(c.abc.startsWith('X:'), 'ABC는 X:로 시작');
  }
});

test('generate: 마디 음 개수 = 리듬 슬롯 개수, 리듬 합 = 8(4/4·L=1/8)', () => {
  const out = generate(CANON, { count: 3, seed: 7 });
  for (const c of out.results) {
    for (const b of c.bars) {
      assert.equal(b.notes.length, b.rhythm.length, '음 개수 = 리듬 슬롯 수');
      const sum = b.rhythm.reduce((a, d) => a + d, 0);
      assert.ok(Math.abs(sum - 8) < 1e-9, `마디 길이 8이어야 함(실제 ${sum})`);
    }
  }
});

// ---------- 핵심 규칙: 강박 = 코드톤 ----------
test('규칙: 모든 마디의 강박(1·3박, onset%4===0) 음은 그 코드의 구성음', () => {
  const out = generate(CANON, { count: 6, seed: 123 });
  for (const c of out.results) {
    for (const b of c.bars) {
      const pcs = chordPcs(b.chord);
      let onset = 0;
      for (let k = 0; k < b.notes.length; k++) {
        if (onset % 4 === 0) {
          assert.ok(pcs.includes(b.notes[k] % 12),
            `강박 코드톤 위반: ${b.chord} 마디 onset ${onset} 음 midi ${b.notes[k]}`);
        }
        onset += b.rhythm[k];
      }
    }
  }
});

test('규칙: 멜로디 음역은 A3(57)~A5(81) 안에 있다', () => {
  const out = generate('Am F C G Am F C G', { count: 5, seed: 55 });
  for (const c of out.results)
    for (const b of c.bars)
      for (const n of b.notes) assert.ok(n >= 57 && n <= 81, `음역 이탈 midi ${n}`);
});

// ---------- 시드 재현성 ----------
test('시드 재현성: 같은 시드+옵션 → 완전히 동일한 결과', () => {
  const a = generate(CANON, { count: 5, seed: 999, tempo: 100 });
  const b = generate(CANON, { count: 5, seed: 999, tempo: 100 });
  assert.deepEqual(a.results.map(r => r.abc), b.results.map(r => r.abc));
});

test('시드 다르면: 대체로 다른 결과', () => {
  const a = generate(CANON, { count: 5, seed: 1 });
  const b = generate(CANON, { count: 5, seed: 2 });
  assert.notDeepEqual(a.results.map(r => r.abc), b.results.map(r => r.abc));
});

// ---------- 모드 ----------
test('모드: 전 구간 모드 모두 결과를 생성한다', () => {
  for (const mode of ['full', 'ki', 'seung', 'jeon', 'gyeol']) {
    const out = generate(CANON, { count: 2, seed: 3, mode });
    assert.ok(out.results.length >= 1, `${mode} 모드가 후보를 내야 함`);
    assert.equal(out.mode, mode);
  }
});

test('모드 gyeol: 마지막 마디 첫 음이 으뜸음 C(pitchClass 0)로 착지', () => {
  const out = generate('C G Am F C G F C', { count: 5, seed: 8, mode: 'gyeol' });
  for (const c of out.results) {
    const last = c.bars[c.bars.length - 1];
    assert.equal(last.notes[0] % 12, 0, '결 모드 종지는 도(C)로 끝나야 함');
  }
});

test('모드 gyeol: 마지막 코드가 C가 아니면 종지 규칙으로 C 치환 안내', () => {
  const out = generate('C F C F C F C G', { count: 2, seed: 4, mode: 'gyeol' });
  assert.ok(/종지 규칙/.test(out.cadenceNote), '마지막 G→C 종지 안내');
});

// ---------- 16분음표 해상도 ----------
test('16분음표 옵션: 0.5(16분) 슬롯이 등장하고, 마지막 마디에는 없다', () => {
  const out = generate(CANON, { count: 5, seed: 21, sixteenth: true });
  let anySix = false;
  for (const c of out.results) {
    const last = c.bars[c.bars.length - 1];
    assert.ok(!last.rhythm.includes(0.5), '마지막 마디에 16분음표 금지');
    if (c.bars.some(b => b.rhythm.includes(0.5))) anySix = true;
  }
  assert.ok(anySix, '16분음표 옵션에서 적어도 한 후보엔 16분 쌍이 있어야 함');
});

test('8분음표 옵션(기본): 16분음표 슬롯이 전혀 없다', () => {
  const out = generate(CANON, { count: 5, seed: 21, sixteenth: false });
  for (const c of out.results)
    for (const b of c.bars)
      assert.ok(!b.rhythm.includes(0.5), '8분 모드에 16분음표가 있으면 안 됨');
});

// ---------- ABC 출력 형식 ----------
test('toAbc: 헤더(M/L/Q/K)와 코드 주석·마디선을 포함', () => {
  const out = generate(CANON, { count: 1, seed: 5, tempo: 120 });
  const abc = out.results[0].abc;
  assert.ok(abc.includes('M:4/4'));
  assert.ok(abc.includes('L:1/8'));
  assert.ok(abc.includes('Q:1/4=120'));
  assert.ok(abc.includes('K:C'));
  assert.ok(abc.includes('"C"') && abc.includes('"G"'), '코드 주석 포함');
  assert.ok(abc.trim().endsWith('|]'), '마지막 마디선 |]로 종료');
});

// ---------- 입력 검증 ----------
test('오류: 해석 불가 코드 / 개수 범위 위반', () => {
  assert.ok(/해석할 수 없/.test(generate('C Xyz G', {}).error));
  assert.ok(/2~16/.test(generate('C', {}).error));
  assert.ok(/2~16/.test(generate('C '.repeat(20), {}).error));
});

test('프리셋 진행들이 모두 정상 생성된다', () => {
  for (const prog of ['C G Am F C G Am F', 'Am F C G Am F C G', 'C Am Dm G C Am Dm G']) {
    const out = generate(prog, { count: 3, seed: 11 });
    assert.ok(!out.error && out.results.length >= 1, `${prog} 생성 실패`);
  }
});

// ---------- 기승전결 한번에(완성곡) ----------
test('generateSong: 기·승·전·결 4섹션 × 16마디 = 총 64마디를 하나의 ABC로', () => {
  const out = generateSong(CANON, { seed: 42, barsPerSection: 16 });
  assert.ok(!out.error, '오류 없이 생성: ' + (out.error || ''));
  assert.equal(out.sections.length, 4);
  assert.deepEqual(out.sections.map(s => s.mode), ['ki', 'seung', 'jeon', 'gyeol']);
  for (const s of out.sections) assert.equal(s.bars.length, 16, `${s.label} 16마디`);
  assert.equal(out.totalBars, 64);
  assert.ok(out.abc.startsWith('X:1') && out.abc.includes('K:C'));
  // 섹션 주석과 종지선
  ['── 기 ──', '── 승 ──', '── 전 ──', '── 결 ──'].forEach(mk =>
    assert.ok(out.abc.includes(mk), '섹션 주석 ' + mk));
  assert.ok(out.abc.trim().endsWith('|]'), '완성곡은 |]로 종료');
});

test('generateSong: 결 섹션 마지막 마디는 으뜸음 C로 착지', () => {
  const out = generateSong('C G Am F', { seed: 9, barsPerSection: 16 });
  const gyeol = out.sections[3];
  const last = gyeol.bars[gyeol.bars.length - 1];
  assert.equal(last.notes[0] % 12, 0, '결 종지는 도(C)');
});

test('generateSong: 같은 시드 → 동일한 곡, 잘못된 코드는 오류', () => {
  const a = generateSong(CANON, { seed: 7 });
  const b = generateSong(CANON, { seed: 7 });
  assert.equal(a.abc, b.abc);
  assert.ok(/해석할 수 없/.test(generateSong('C Xyz', {}).error));
  assert.ok(/2개 이상/.test(generateSong('C', {}).error));
});
