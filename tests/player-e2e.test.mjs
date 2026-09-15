// 브로가드 플레이어 E2E — 재생목록 담기·저장·연속 재생·반복·옵션 전달
// 실행: node tests/player-e2e.test.mjs   (로컬 abcjs가 있으면 재생 엔진까지 검증, 없으면 UI만)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const ABCJS_CANDIDATES = [
  join(root, 'node_modules/abcjs/dist/abcjs-basic-min.js'),
  '/tmp/claude-0/-home-user-Broguard-music/c040e24c-4a69-5b46-9c8e-25ca04c1bca0/scratchpad/node_modules/abcjs/dist/abcjs-basic-min.js'
];
const abcjsPath = ABCJS_CANDIDATES.find(existsSync);
const abcjsSrc = abcjsPath ? readFileSync(abcjsPath, 'utf8') : null;

const server = createServer((req, res) => {
  const path = join(root, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': extname(path) === '.html' ? 'text/html; charset=utf-8' : 'text/plain' });
  res.end(readFileSync(path));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let fail = 0;
const ok = n => console.log('ok - ' + n);
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + (e && e.message || e)); };

const page = await browser.newPage();
if (abcjsSrc) await page.route(/abcjs.*\.js/, r => r.fulfill({ contentType: 'application/javascript', body: abcjsSrc }));
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/cdnjs|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });

await page.addInitScript(() => {
  localStorage.setItem('broguard_library', JSON.stringify({ entries: [
    { id: 'p1', title: '곡 하나', cat: 'K-가요', abc: 'X:1\nT:곡 하나\nM:4/4\nL:1/8\nK:C\n"C" C2 E2 G2 c2 |]', added: 3 },
    { id: 'p2', title: '곡 둘', abc: 'X:1\nT:곡 둘\nM:4/4\nL:1/8\nK:G\nG2 A2 B2 d2 |]', added: 2 },
    { id: 'p3', title: '곡 셋', abc: 'X:1\nT:곡 셋\nM:3/4\nL:1/8\nK:Am\nA2 c2 e2 |]', added: 1 }
  ] }));
});
await page.goto(`${base}/player.html`, { waitUntil: 'domcontentloaded' });

try {
  // 1) 악보집 목록
  const lib = await page.$$eval('#liblist li .t', els => els.map(e => e.textContent));
  assert.deepEqual(lib, ['곡 하나', '곡 둘', '곡 셋'], '악보집 3곡, 최근순');
  ok('악보집 곡들이 목록에 보인다');

  // 2) 담기 + 전체 담기 → 재생목록 구성
  await page.click('#liblist li:nth-child(2) button');   // 곡 둘 담기
  await page.click('#addAllBtn');                        // + 전체(3곡)
  let st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 4, '재생목록 4곡(담기 1 + 전체 3)');
  assert.deepEqual(st.titles, ['곡 둘', '곡 하나', '곡 둘', '곡 셋']);
  assert.equal(await page.$$eval('#plist li', e => e.length), 4, '목록 UI 4줄');
  ok('➕ 담기 / 전체 담기가 재생목록에 쌓인다');

  // 3) 순서 이동·빼기
  await page.click('#plist li:nth-child(1) button[title="아래로"]');
  st = await page.evaluate(() => window.__player.getState());
  assert.deepEqual(st.titles.slice(0, 2), ['곡 하나', '곡 둘'], '↓ 이동');
  await page.click('#plist li:nth-child(3) button[title="빼기"]');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '✕ 빼기');
  ok('↑↓ 이동과 ✕ 빼기가 동작한다');

  // 4) 자동 저장 → 새로고침 후 유지
  await page.reload({ waitUntil: 'domcontentloaded' });
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '재생목록이 저장되어 복원됨');
  ok('재생목록이 자동 저장·복원된다');

  if (abcjsSrc) {
    // 신디 스텁: init 옵션 캡처 + onEnded 저장(곡 끝 흉내)
    await page.evaluate(() => {
      window.__inits = [];
      window.AudioContext = function () { this.state = 'running'; this.resume = function () { return Promise.resolve(); }; };
      window.webkitAudioContext = window.AudioContext;
      ABCJS.synth.CreateSynth = function () {
        return {
          init: function (o) { window.__inits.push({ chordsOff: !!o.options.chordsOff, sf: o.options.soundFontUrl || 'default' }); window.__onEnded = o.options.onEnded; return Promise.resolve(); },
          prime: function () { return Promise.resolve(); },
          start: function () {}, stop: function () {}, pause: function () {}, resume: function () {}
        };
      };
    });

    // 5) 재생 → 첫 곡, 기본 음질, 코드 반주 켬
    await page.click('#playBtn');
    await page.waitForFunction(() => window.__inits && window.__inits.length >= 1, undefined, { timeout: 5000 });
    st = await page.evaluate(() => window.__player.getState());
    assert.equal(st.curIdx, 0, '첫 곡부터');
    assert.ok(st.playing, '재생 중');
    let inits = await page.evaluate(() => window.__inits);
    assert.equal(inits[0].chordsOff, false, '코드 반주 켬 → chordsOff:false');
    assert.equal(inits[0].sf, 'default', '기본 음질');
    assert.ok(/곡 하나/.test(await page.textContent('#nowTitle')), '지금 재생 표시');
    ok('▶ 재생이 첫 곡부터 시작한다');

    // 6) 곡 끝(onEnded) → 자동 다음 곡
    await page.evaluate(() => window.__onEnded());
    await page.waitForFunction(() => window.__inits.length >= 2, undefined, { timeout: 5000 });
    st = await page.evaluate(() => window.__player.getState());
    assert.equal(st.curIdx, 1, '자동으로 2번째 곡');
    assert.ok(/곡 둘/.test(await page.textContent('#nowTitle')));
    ok('곡이 끝나면 자동으로 다음 곡이 이어진다');

    // 7) 마지막 곡 끝 + 🔁 꺼짐 → 정지 / 🔁 켬 → 처음으로
    await page.click('#nextBtn');   // 3번째(마지막) 곡
    await page.waitForFunction(() => window.__inits.length >= 3, undefined, { timeout: 5000 });
    await page.evaluate(() => window.__onEnded());
    await page.waitForFunction(() => !window.__player.getState().playing, undefined, { timeout: 5000 });
    ok('반복 꺼짐: 마지막 곡 뒤에 정지한다');
    await page.check('#loopChk');
    await page.click('#playBtn');   // 마지막 곡부터 다시
    await page.waitForFunction(() => window.__inits.length >= 4, undefined, { timeout: 5000 });
    await page.evaluate(() => window.__onEnded());
    await page.waitForFunction(() => window.__player.getState().curIdx === 0 && window.__player.getState().playing, undefined, { timeout: 5000 });
    ok('🔁 전체 반복: 마지막 곡 뒤 처음으로 돌아간다');

    // 8) 코드 반주 끔 + 고음질 → 다음 init에 반영(즉시 재시작)
    await page.uncheck('#chordAccChk');
    await page.waitForFunction(n => window.__inits.length > n, await page.evaluate(() => window.__inits.length) - 1, { timeout: 5000 });
    await page.selectOption('#soundSel', 'musyng');
    await page.waitForFunction(() => {
      const last = window.__inits[window.__inits.length - 1];
      return last.chordsOff === true && /MusyngKite/.test(last.sf);
    }, undefined, { timeout: 5000 });
    ok('🎸 코드 반주 끔·🔊 고음질이 재생에 즉시 반영된다');
    await page.click('#stopBtn');
  } else {
    console.log('SKIP - 로컬 abcjs 없음: 재생 엔진 검증 생략(UI 검증만 수행)');
  }

  // 9) 섞기·비우기
  await page.click('#shuffleBtn');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '섞어도 곡 수 유지');
  await page.click('#clearBtn');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 0, '비우기');
  ok('🔀 섞기 · 🗑 비우기 동작');

  assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' | '));
  ok('페이지 JS 오류 없음');
} catch (e) { bad('플레이어', e); }
await page.close();

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll player E2E passed');
