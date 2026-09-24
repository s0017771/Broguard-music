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
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
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
  // 1) 악보집 목록 — 카테고리(분류) 그룹으로 표시
  const groups = await page.$$eval('#liblist details.catgrp', els => els.map(d => ({
    name: d.querySelector('summary span').textContent,
    cnt: d.querySelector('summary .cnt').textContent,
    titles: Array.from(d.querySelectorAll('li .t')).map(e => e.textContent)
  })));
  assert.equal(groups.length, 2, '분류 그룹 2개(K-가요·기타)');
  assert.equal(groups[0].name, 'K-가요'); assert.deepEqual(groups[0].titles, ['곡 하나']);
  assert.equal(groups[1].name, '기타'); assert.deepEqual(groups[1].titles, ['곡 둘', '곡 셋'], '분류 없는 곡은 기타로');
  assert.equal(groups[1].cnt, '2곡', '곡 수 표기');
  ok('악보집이 카테고리별로 묶여 보인다');

  // 2) 담기(개별/분류/전체) — 같은 곡은 중복으로 담기지 않는다
  await page.evaluate(() => {   // '곡 둘' 개별 담기
    const li = Array.from(document.querySelectorAll('#liblist li')).find(l => l.querySelector('.t').textContent === '곡 둘');
    li.querySelector('button').click();
  });
  let st = await page.evaluate(() => window.__player.getState());
  assert.deepEqual(st.titles, ['곡 둘'], '개별 담기');
  await page.evaluate(() => {   // '기타' 분류 통째 담기 → 곡 둘은 이미 있어 곡 셋만 추가
    document.querySelectorAll('#liblist details.catgrp summary button.catadd')[1].click();
  });
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 2, '분류 담기: 이미 있는 곡 제외하고 +1곡');
  await page.click('#addAllBtn');                        // 전체 담기 → 곡 하나만 새로
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '전체 담기: 새 곡만 +1');
  assert.ok(/이미 있던/.test(await page.textContent('#status')), '제외 안내 문구');
  await page.click('#addAllBtn');                        // 한 번 더 → 아무것도 안 늘어남
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '전체 담기 반복해도 중복 없음');
  assert.equal(await page.$$eval('#plist li', e => e.length), 3, '목록 UI 3줄');
  ok('담기가 중복 없이 쌓인다(같은 곡 반복 재생 방지)');

  // 3) 순서 이동·빼기
  await page.click('#clearBtn');
  await page.evaluate(() => {
    const li = Array.from(document.querySelectorAll('#liblist li')).find(l => l.querySelector('.t').textContent === '곡 둘');
    li.querySelector('button').click();
  });
  await page.click('#addAllBtn');
  st = await page.evaluate(() => window.__player.getState());
  assert.deepEqual(st.titles, ['곡 둘', '곡 하나', '곡 셋']);
  await page.click('#plist li:nth-child(1) button[title="아래로"]');
  st = await page.evaluate(() => window.__player.getState());
  assert.deepEqual(st.titles.slice(0, 2), ['곡 하나', '곡 둘'], '↓ 이동');
  await page.click('#plist li:nth-child(3) button[title="빼기"]');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 2, '✕ 빼기');
  ok('↑↓ 이동과 ✕ 빼기가 동작한다');

  // 4) 자동 저장·복원 + 예전에 중복으로 저장된 목록은 자동 정리
  await page.evaluate(() => localStorage.setItem('broguard_player_list', JSON.stringify([
    { id: 'p1', title: '곡 하나' }, { id: 'p2', title: '곡 둘' }, { id: 'p1', title: '곡 하나' },
    { id: 'p3', title: '곡 셋' }, { id: 'p2', title: '곡 둘' }
  ])));
  await page.reload({ waitUntil: 'domcontentloaded' });
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '중복 5곡 → 3곡으로 정리');
  assert.deepEqual(st.titles, ['곡 하나', '곡 둘', '곡 셋'], '순서 유지하며 중복 제거');
  ok('재생목록 자동 저장·복원 + 저장된 중복 자동 정리');

  if (abcjsSrc) {
    // 신디 스텁: init 옵션 캡처 + download()는 60초 무음 WAV(진짜 <audio> 재생 검증)
    await page.evaluate(() => {
      window.__inits = [];
      (function () {   // 60초 무음 WAV — 테스트 중 자연 종료되지 않게
        const sr = 8000, n = sr * 60, ab = new ArrayBuffer(44 + n * 2), dv = new DataView(ab);
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
        dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
        dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
        ws(36, 'data'); dv.setUint32(40, n * 2, true);
        window.__testWav = URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
      })();
      window.AudioContext = function () { this.state = 'running'; this.resume = function () { return Promise.resolve(); }; };
      window.webkitAudioContext = window.AudioContext;
      ABCJS.synth.CreateSynth = function () {
        return {
          init: function (o) { window.__inits.push({ chordsOff: !!o.options.chordsOff, sf: o.options.soundFontUrl || 'default' }); return Promise.resolve(); },
          prime: function () { return Promise.resolve(); },
          download: function () { return window.__testWav; },
          start: function () {}, stop: function () {}
        };
      };
      window.__ended = () => document.getElementById('audioEl').dispatchEvent(new Event('ended'));
    });

    // 5) 재생 → 첫 곡이 <audio>로 실제 재생됨, 기본 음질, 코드 반주 켬
    await page.click('#playBtn');
    await page.waitForFunction(() => window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    st = await page.evaluate(() => window.__player.getState());
    assert.equal(st.curIdx, 0, '첫 곡부터');
    assert.ok(st.playing, '재생 중');
    assert.ok(/^blob:/.test(st.audioSrc), '오디오 요소가 음원(WAV)을 재생: ' + st.audioSrc.slice(0, 24));
    let inits = await page.evaluate(() => window.__inits);
    assert.equal(inits[0].chordsOff, false, '코드 반주 켬 → chordsOff:false');
    assert.equal(inits[0].sf, 'default', '기본 음질');
    assert.ok(/곡 하나/.test(await page.textContent('#nowTitle')), '지금 재생 표시');
    ok('▶ 재생: 곡이 통째 음원으로 만들어져 <audio>로 재생된다');

    // 6) 곡 끝(ended) → 자동 다음 곡 (다음 곡은 미리 준비된 캐시 사용 가능)
    await page.evaluate(() => window.__ended());
    await page.waitForFunction(() => window.__player.getState().curIdx === 1 && window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    assert.ok(/곡 둘/.test(await page.textContent('#nowTitle')));
    ok('곡이 끝나면 자동으로 다음 곡이 이어진다');

    // 7) 마지막 곡 끝 + 🔁 꺼짐 → 정지 / 🔁 켬 → 처음으로
    await page.click('#nextBtn');   // 3번째(마지막) 곡
    await page.waitForFunction(() => window.__player.getState().curIdx === 2 && window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    await page.evaluate(() => window.__ended());
    await page.waitForFunction(() => !window.__player.getState().playing, undefined, { timeout: 6000 });
    st = await page.evaluate(() => window.__player.getState());
    assert.ok(!st.audioPlaying, '정지 시 오디오도 멈춤');
    ok('반복 꺼짐: 마지막 곡 뒤에 정지한다');
    await page.check('#loopChk');
    await page.click('#playBtn');   // 마지막 곡부터 다시
    await page.waitForFunction(() => window.__player.getState().playing && window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    await page.evaluate(() => window.__ended());
    await page.waitForFunction(() => window.__player.getState().curIdx === 0 && window.__player.getState().playing, undefined, { timeout: 6000 });
    ok('🔁 전체 반복: 마지막 곡 뒤 처음으로 돌아간다');

    // 8) 코드 반주 끔 + 고음질 → 새 음원으로 다시 만들어 반영
    await page.uncheck('#chordAccChk');
    await page.waitForFunction(() => {
      const arr = window.__inits;
      return arr.length && arr[arr.length - 1].chordsOff === true;
    }, undefined, { timeout: 6000 });
    await page.selectOption('#soundSel', 'musyng');
    await page.waitForFunction(() => {
      const last = window.__inits[window.__inits.length - 1];
      return last.chordsOff === true && /MusyngKite/.test(last.sf);
    }, undefined, { timeout: 6000 });
    ok('🎸 코드 반주 끔·🔊 고음질이 재생에 즉시 반영된다');

    // 8.2) ⏸ 일시정지 — 가짜 '곡 끝' 이벤트가 와도 다음 곡으로 튀지 않는다
    await page.waitForFunction(() => window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    const idxBefore = (await page.evaluate(() => window.__player.getState())).curIdx;
    await page.click('#pauseBtn');
    st = await page.evaluate(() => window.__player.getState());
    assert.ok(st.paused, '일시정지 상태');
    assert.ok(!st.audioPlaying, '오디오 실제 멈춤');
    await page.evaluate(() => window.__ended());
    await page.waitForTimeout(250);
    st = await page.evaluate(() => window.__player.getState());
    assert.equal(st.curIdx, idxBefore, '일시정지 중엔 곡이 넘어가지 않음');
    assert.ok(st.paused, '여전히 일시정지');
    await page.click('#playBtn');                    // 이어서
    await page.waitForFunction(() => window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    st = await page.evaluate(() => window.__player.getState());
    assert.ok(!st.paused && st.playing, '이어서 재생');
    ok('⏸ 일시정지/이어서가 오디오 요소로 정확히 동작한다');

    // 8.25) 📞 전화 시뮬레이션: 밖에서(OS) 오디오를 멈추면 일시정지 상태로 전환, 자동으로 다시 살아나지 않는다
    await page.waitForFunction(() => window.__player.getState().audioPlaying, undefined, { timeout: 6000 });
    await page.evaluate(() => document.getElementById('audioEl').pause());   // 전화가 소리를 가져감
    await page.waitForFunction(() => window.__player.getState().paused, undefined, { timeout: 4000 });
    assert.ok(/전화/.test(await page.textContent('#status')), '전화 일시정지 안내: ' + await page.textContent('#status'));
    // 통화 중 화면을 다시 켜도(visibilitychange) 재생이 살아나면 안 됨
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(250);
    st = await page.evaluate(() => window.__player.getState());
    assert.ok(st.paused && !st.audioPlaying, '통화 중엔 계속 일시정지');
    await page.click('#playBtn');   // 통화 끝 → 이어서
    await page.waitForFunction(() => window.__player.getState().audioPlaying && !window.__player.getState().paused, undefined, { timeout: 6000 });
    ok('📞 전화가 오면 일시정지되고, 통화 중 다시 살아나지 않는다');

    // 8.3) 잠금화면 미디어 세션 등록
    const msTitle = await page.evaluate(() => (navigator.mediaSession && navigator.mediaSession.metadata) ? navigator.mediaSession.metadata.title : null);
    assert.ok(msTitle, '미디어 세션 제목: ' + msTitle);
    ok('잠금화면 미디어 세션이 등록된다');
    await page.click('#stopBtn');
  } else {
    console.log('SKIP - 로컬 abcjs 없음: 재생 엔진 검증 생략(UI 검증만 수행)');
  }

  // 8.7) 💾 플레이리스트 저장/불러오기/이어담기/삭제/영속
  await page.fill('#plName', '감상코스');
  await page.click('#plSaveBtn');
  let sets = await page.evaluate(() => window.__player.getSets());
  assert.deepEqual(sets, [{ name: '감상코스', n: 3 }], '3곡 저장');
  assert.ok(/'감상코스'.*저장/.test(await page.textContent('#status')), '저장 안내');
  // 비우고 📥 불러오기 → 복원
  await page.click('#clearBtn');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 0);
  await page.click('#plsets li:nth-child(1) button.pl-load');
  st = await page.evaluate(() => window.__player.getState());
  assert.deepEqual(st.titles, ['곡 하나', '곡 둘', '곡 셋'], '플레이리스트로 재생목록 복원');
  // 한 곡 빼고 ➕ 이어 담기 → 빠진 곡만 추가(중복 제외)
  await page.click('#plist li:nth-child(3) button[title="빼기"]');
  await page.click('#plsets li:nth-child(1) button.pl-add');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '빠졌던 1곡만 이어 담김');
  // 같은 이름 저장 = 덮어쓰기(목록 수 그대로)
  await page.fill('#plName', '감상코스');
  await page.click('#plSaveBtn');
  sets = await page.evaluate(() => window.__player.getSets());
  assert.equal(sets.length, 1, '같은 이름은 덮어쓰기');
  // 새 이름으로 하나 더
  await page.fill('#plName', '드라이브');
  await page.click('#plSaveBtn');
  sets = await page.evaluate(() => window.__player.getSets());
  assert.equal(sets.length, 2, '두 번째 플레이리스트');
  // 새로고침 후에도 유지
  await page.reload({ waitUntil: 'domcontentloaded' });
  sets = await page.evaluate(() => window.__player.getSets());
  assert.deepEqual(sets.map(s => s.name), ['감상코스', '드라이브'], '플레이리스트 영속');
  st = await page.evaluate(() => window.__player.getState());
  assert.equal(st.count, 3, '재생목록도 유지');
  // 삭제
  await page.click('#plsets li:nth-child(2) button.pl-del');
  sets = await page.evaluate(() => window.__player.getSets());
  assert.deepEqual(sets.map(s => s.name), ['감상코스'], '삭제');
  ok('💾 플레이리스트 저장·불러오기·이어담기·덮어쓰기·영속·삭제');

  // 8.5) 같은 음 슬러 → 붙임줄 정규화(재생 시 두 번 소리 안 나게)
  const tied = await page.evaluate(() =>
    window.__player.slurSameToTie('X:1\nK:C\n"C" (B2 B2) A2 B2 | (d2 d2) c2 |'));
  assert.ok(/\(B2- B2\)/.test(tied), '같은 음 슬러에 붙임줄 삽입: ' + tied.split('\n').pop());
  assert.ok(/\(d2- d2\)/.test(tied), '둘째 마디도 처리');
  ok('이음줄(같은 음 슬러)이 붙임줄로 정규화되어 한 번만 소리난다');

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
