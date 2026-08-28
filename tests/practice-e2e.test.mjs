// 피아노 교실 E2E — 실제 브라우저(Chromium)에서 practice.html 동작 확인
// 실행: node tests/practice-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html; charset=utf-8' };
const server = createServer((req, res) => {
  const path = join(root, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'text/plain' });
  res.end(readFileSync(path));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failures++; console.error(`NOT OK - ${name}\n  ${e.message}`); }
}
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${base}/practice.html`, { waitUntil: 'domcontentloaded' });

await check('랩 홈 링크가 index.html을 가리킨다', async () => {
  assert.equal(await page.getAttribute('header a', 'href'), 'index.html');
});

await check('내장곡 목록과 연습 시작 버튼이 있다', async () => {
  const opts = await page.$$eval('#songSel option', els => els.map(o => o.value));
  assert.ok(opts.includes('twinkle') && opts.includes('custom'), '내장곡 + 직접입력: ' + opts.join(','));
  assert.ok(await page.$('#startBtn'), '연습 시작 버튼');
});

await check('parseSong(테스트 훅)이 ABC를 음표로 파싱한다', async () => {
  const abc = 'X:1\nT:t\nM:4/4\nL:1/8\nK:C\n[V:RH] C2 E2 G2 c2 |';
  const n = await page.evaluate((a) => {
    const s = window.__practice.parseSong(a);
    return s && s.seq ? s.seq.filter(x => !x.rest).length : -1;
  }, abc);
  assert.equal(n, 4, '4음(C E G c) 파싱');
});

await check('다른 랩 → 연습 핸드오프: broguard_practice_abc를 읽어 직접입력에 채운다', async () => {
  const song = 'X:1\nT:handoff\nM:4/4\nL:1/8\nK:C\n[V:RH] G2 A2 B2 c2 |';
  await page.evaluate((s) => localStorage.setItem('broguard_practice_abc', s), song);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('songSel').value === 'custom', undefined, { timeout: 5000 });
  const val = await page.inputValue('#abcInput');
  assert.ok(val.includes('handoff'), '넘어온 곡이 채워짐: ' + val.slice(0, 30));
  const leftover = await page.evaluate(() => localStorage.getItem('broguard_practice_abc'));
  assert.equal(leftover, null, '핸드오프 키 소비됨');
});

await check('classifyDur: 음 길이(beats)별로 올바른 음표 모양을 고른다', async () => {
  const r = await page.evaluate(() => {
    const c = window.__practice.classifyDur;
    return {
      whole: c(4), half: c(2), dotHalf: c(3), quarter: c(1),
      dotQuarter: c(1.5), eighth: c(0.5), sixteenth: c(0.25)
    };
  });
  assert.ok(r.whole.hollow && !r.whole.stem, '온음표=빈 머리·기둥 없음');
  assert.ok(r.half.hollow && r.half.stem && r.half.flags === 0, '2분음표=빈 머리·기둥');
  assert.ok(r.dotHalf.dot && r.dotHalf.hollow, '점2분음표=부점');
  assert.ok(!r.quarter.hollow && r.quarter.stem && r.quarter.flags === 0, '4분음표=채운 머리·기둥');
  assert.ok(r.dotQuarter.dot && r.dotQuarter.flags === 0, '점4분음표=부점');
  assert.equal(r.eighth.flags, 1, '8분음표=꼬리 1개');
  assert.equal(r.sixteenth.flags, 2, '16분음표=꼬리 2개');
});

await check('레인에 실제 음 길이별 음표 모양이 그려진다', async () => {
  // 온음표·2분·4분·8분·16분·점4분이 섞인 한 마디들
  const abc = 'X:1\nT:dur\nM:4/4\nL:1/16\nK:C\n[V:RH] C16 | D8 D8 | E4 E4 E4 E4 | F2 F2 F2 F2 F2 F2 F2 F2 | G6 G2 A4 A4 |';
  const r = await page.evaluate((a) => window.__practice.renderLaneFor(a), abc);
  assert.ok(r.notes >= 10, '여러 음표: ' + r.notes);
  assert.ok(r.open >= 1, '빈 머리(2분·온음표) 최소 1개: ' + r.open);
  assert.ok(r.flags >= 1, '꼬리(8분·16분) 최소 1개: ' + r.flags);
  assert.ok(r.dots >= 1, '부점 최소 1개(점4분음표): ' + r.dots);
  // 온음표는 기둥이 없으므로 stems < notes
  assert.ok(r.stems < r.notes, '온음표는 기둥 없음(stems ' + r.stems + ' < notes ' + r.notes + ')');
});

await check('parseSong: 악보의 코드 기호를 위치와 함께 캡처한다', async () => {
  const abc = 'X:1\nT:c\nM:4/4\nL:1/8\nK:Bm\n"Bm" B2 c2 "F#m" d2 e2 | "G" G2 A2 B2 c2 |';
  const r = await page.evaluate((a) => {
    const s = window.__practice.parseSong(a);
    return { chords: s.abcChords, notes: s.seq.filter(x => !x.rest).length };
  }, abc);
  assert.equal(r.notes, 8, '음 8개');
  assert.equal(r.chords.length, 3, '코드 3개 캡처');
  assert.deepEqual(r.chords.map(c => c.name), ['Bm', 'F#m', 'G'], '이름 그대로');
  assert.deepEqual(r.chords.map(c => c.cell), [0, 4, 8], '위치(cell): 마디 중간 포함');
});

await check('chordsFromAbc: 적힌 코드로 마디별 반주 코드를 만든다(자동 추정보다 우선)', async () => {
  const abc = 'X:1\nM:4/4\nL:1/8\nK:Bm\n"Bm" B2 c2 d2 e2 | "G" G2 A2 B2 c2 |';
  const r = await page.evaluate((a) => {
    const s = window.__practice.parseSong(a);
    const ch = window.__practice.chordsFromAbc(s);
    return ch.map(c => ({ name: c.name, root: c.rootPc, kind: c.kind }));
  }, abc);
  assert.deepEqual(r.map(c => c.name), ['Bm', 'G']);
  assert.equal(r[0].root, 11); assert.equal(r[0].kind, 1, 'Bm=단3화음');
  assert.equal(r[1].root, 7); assert.equal(r[1].kind, 0, 'G=장3화음');
});

await check('레인에 코드가 음표와 함께 그려진다(.lchord)', async () => {
  const abc = 'X:1\nT:lc\nM:4/4\nL:1/8\nK:C\n"C" C2 E2 "G7" G2 c2 | "Am" A2 c2 e2 a2 |';
  const n = await page.evaluate((a) => {
    window.__practice.renderLaneFor(a);
    return document.querySelectorAll('#laneSvg .lchord').length;
  }, abc);
  assert.equal(n, 3, '코드 텍스트 3개(마디 중간 G7 포함): ' + n);
});

await check('악보집(broguard_library)에서 불러오기 목록이 생긴다', async () => {
  await page.evaluate(() => {
    localStorage.setItem('broguard_library', JSON.stringify({ entries: [
      { id: 'e1', title: '내 곡 하나', abc: 'X:1\nT:내 곡 하나\nM:4/4\nL:1/8\nQ:1/4=72\nK:C\n"C" C2 E2 G2 c2 |', added: 2 },
      { id: 'e2', title: '내 곡 둘', abc: 'X:1\nT:내 곡 둘\nM:3/4\nL:1/8\nK:G\nG2 A2 B2 |', added: 1 }
    ] }));
    window.__practice.populateLibrary();
  });
  const opts = await page.$$eval('#songSel optgroup[data-lib] option', els => els.map(o => ({ v: o.value, t: o.textContent })));
  assert.equal(opts.length, 2, '악보집 곡 2개');
  assert.equal(opts[0].t, '내 곡 하나', '최근 저장이 먼저');
  // 곡 선택 → BPM 자동(Q:1/4=72) + 연습 시작이 그 곡을 사용
  await page.selectOption('#songSel', 'lib:e1');
  await page.evaluate(() => document.getElementById('songSel').dispatchEvent(new Event('change')));
  assert.equal(await page.inputValue('#bpmInput'), '72', '악보집 곡의 Q 템포 반영');
  await page.selectOption('#modeSel', 'timed');
  await page.click('#startBtn');
  await page.waitForFunction(() => {
    const st = window.__practice.getState();
    return st.playing && st.song && st.song.title === '내 곡 하나';
  }, undefined, { timeout: 4000 });
  const laneChords = await page.evaluate(() => document.querySelectorAll('#laneSvg .lchord').length);
  assert.ok(laneChords >= 1, '악보집 곡의 코드가 레인에 표시: ' + laneChords);
  await page.click('#stopBtn');
});

await check('레인이 일정한 속도로 흐른다(rAF 등속 구동)', async () => {
  await page.evaluate(() => {
    localStorage.setItem('broguard_library', JSON.stringify({ entries: [
      { id: 's1', title: '속도 테스트', abc: 'X:1\nT:속도\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nC2 D2 E2 F2 | G2 A2 B2 c2 | C2 D2 E2 F2 | G2 A2 B2 c2 |', added: 9 }
    ] }));
    window.__practice.populateLibrary();
  });
  await page.selectOption('#songSel', 'lib:s1');
  await page.selectOption('#modeSel', 'timed');
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__practice.getState().playing, undefined, { timeout: 4000 });
  // 두 구간의 이동 속도(px/ms)를 재서 등속인지 확인 — setInterval(30ms) 지터와 달리 rAF는 선형
  const readX = () => page.evaluate(() => {
    const g = document.getElementById('laneG');
    const m = /translate\((-?[\d.]+)/.exec(g.getAttribute('transform') || 'translate(0');
    return { x: parseFloat(m[1]), t: performance.now() };
  });
  const a = await readX();
  await page.waitForTimeout(300);
  const b = await readX();
  await page.waitForTimeout(300);
  const c = await readX();
  const v1 = (a.x - b.x) / (b.t - a.t), v2 = (b.x - c.x) / (c.t - b.t);
  // LANE_SPEED = 0.13 px/ms — 두 구간 모두 ±15% 안에서 같은 속도
  assert.ok(Math.abs(v1 - 0.13) < 0.02, '1구간 속도 ≈ 0.13px/ms: ' + v1.toFixed(4));
  assert.ok(Math.abs(v2 - 0.13) < 0.02, '2구간 속도 ≈ 0.13px/ms: ' + v2.toFixed(4));
  assert.ok(Math.abs(v1 - v2) < 0.01, '두 구간 속도 일치(등속): ' + v1.toFixed(4) + ' vs ' + v2.toFixed(4));
  await page.click('#stopBtn');
});

await check('심각한 JS 오류가 없다 (abcjs 미로딩 환경 포함)', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n피아노 교실 E2E 전체 통과');
process.exit(failures ? 1 : 0);
