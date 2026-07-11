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

test('keyToPad: 대소문자·별칭(J=킥)·스페이스', () => {
  assert.equal(BkdCore.keyToPad('a').id, 'hhc');
  assert.equal(BkdCore.keyToPad('A').id, 'hhc', '대문자도');
  assert.equal(BkdCore.keyToPad(' ').id, 'kick', 'Space=킥');
  assert.equal(BkdCore.keyToPad('j').id, 'kick', 'J=킥 별칭');
  assert.equal(BkdCore.keyToPad('x'), null, '없는 키');
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
  // 레슨 5종 모두 파싱 가능
  BkdCore.LESSONS.forEach(les => {
    const st = BkdCore.patternToSteps(les.pattern);
    assert.ok(st.steps.length > 0 && st.totalSteps % 8 === 0, les.name);
  });
});
