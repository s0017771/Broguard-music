/*
 * 니혼고 랩 E2E 테스트 (Playwright)
 * 실행: NODE_PATH=/opt/node22/lib/node_modules node tests/nihongo.e2e.mjs
 * (전역 playwright + chromium 필요. 로컬 설치 시: npm i playwright 후 node tests/nihongo.e2e.mjs)
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = 'file://' + path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'nihongo.html');

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

/** 현재 문제를 읽어 정답을 클릭해 푼다 (훅 window.NIHONGO 사용) */
async function solveExercise(page, { wrong = false } = {}) {
  const ex = await page.evaluate(() => {
    const e = window.NIHONGO.exercise;
    return e && { type: e.type, correct: e.correct, answer: e.answer, options: e.options, pairs: e.pairs };
  });
  if (!ex) throw new Error('no current exercise');

  if (ex.type === 'choice' || ex.type === 'listen') {
    const target = wrong ? ex.options.find(o => o !== ex.correct) : ex.correct;
    const idx = ex.options.indexOf(target);
    await page.click(`#ex-area .opt[data-opt="${idx}"]`);
    await page.click('#action-btn'); // 확인
    await page.click('#action-btn'); // 계속
  } else if (ex.type === 'build') {
    const chars = wrong ? [...ex.answer].reverse() : [...ex.answer];
    for (const ch of chars) {
      const tiles = await page.$$('#build-tiles .tile:not(.used)');
      for (const t of tiles) {
        if ((await t.textContent()) === ch) { await t.click(); break; }
      }
    }
    await page.click('#action-btn');
    await page.click('#action-btn');
  } else if (ex.type === 'match') {
    for (const p of ex.pairs) {
      await page.click(`.opt[data-side="a"][data-pid="${p.id}"]`);
      await page.click(`.opt[data-side="b"][data-pid="${p.id}"]`);
    }
    await page.click('#action-btn'); // 계속 (매칭은 자동 완료)
  }
}

/** 세션이 끝날 때까지 정답으로 풀기 */
async function solveSession(page, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const inLesson = await page.evaluate(() => !!window.NIHONGO.session);
    if (!inLesson) return;
    await solveExercise(page);
  }
  throw new Error('lesson did not finish in ' + maxSteps + ' steps');
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => { failed++; console.log('  ❌ page JS error:', e.message); });
page.on('dialog', d => d.accept());

/* ── 1. 첫 로드: 경로 화면, 첫 레슨만 열림 ── */
console.log('\n[1] 첫 로드 · 잠금 상태');
await page.goto(APP + '?reset=1');
check('홈 화면 표시', await page.isVisible('#screen-home'));
check('유닛 7개 렌더링', (await page.$$('.unit')).length === 7);
check('첫 레슨만 열림(★ 1개)', (await page.$$('.node.next')).length === 1);
check('나머지 레슨 잠김', (await page.$$('.node:disabled')).length === 20);
check('스트릭 0으로 시작', (await page.textContent('#stat-streak .val')) === '0');
check('XP 0으로 시작', (await page.textContent('#stat-xp .val')) === '0');
check('하트 5개로 시작', (await page.textContent('#stat-hearts .val')) === '5');
check('복습 버튼은 아직 비활성', await page.isDisabled('#review-btn'));

/* ── 2. 레슨 전체 정답 완주 → 완료 화면·XP·스트릭 ── */
console.log('\n[2] 레슨 정답 완주');
await page.click('.node.next');
check('레슨 화면 진입', await page.isVisible('#screen-lesson'));
check('첫 문제 렌더링', await page.isVisible('#ex-title'));
await solveSession(page);
check('완료 화면 표시', await page.isVisible('#screen-done'));
check('완벽 보너스 +15 XP', (await page.textContent('#done-xp')) === '+15');
check('정확도 100%', (await page.textContent('#done-acc')) === '100%');
check('스트릭 🔥 1', (await page.textContent('#done-streak')).includes('1'));
await page.click('#done-btn');
check('홈 복귀 · XP 반영', (await page.textContent('#stat-xp .val')) === '15');
check('레슨1 완료(✓) 표시', (await page.$$('.node.done')).length === 1);
check('레슨2 열림', (await page.$$('.node.next')).length === 1);
check('일일 목표 진행', (await page.textContent('#goal-text')).startsWith('15 /'));

/* ── 3. 새로고침 후 진행 상황 유지 ── */
console.log('\n[3] 저장 · 새로고침 유지');
await page.goto(APP);
check('XP 유지', (await page.textContent('#stat-xp .val')) === '15');
check('스트릭 유지', (await page.textContent('#stat-streak .val')) === '1');
check('완료 레슨 유지', (await page.$$('.node.done')).length === 1);
check('SRS 항목 기록됨', await page.evaluate(() => Object.keys(window.NIHONGO.state.items).length >= 5));

/* ── 4. 오답 → 하트 감소, 틀린 문제 재출제 ── */
console.log('\n[4] 하트 · 오답 재출제');
await page.click('.node.next');
const q0 = await page.evaluate(() => window.NIHONGO.session.queue.length);
// 첫 choice 문제를 일부러 틀린다
await solveExercise(page, { wrong: true });
check('하트 4개로 감소', await page.evaluate(() => window.NIHONGO.state.hearts === 4));
check('틀린 문제 큐 끝에 재추가', await page.evaluate(q => window.NIHONGO.session.queue.length === q + 1, q0));
await solveSession(page);
check('오답 있어도 완주 가능(+10 XP)', (await page.textContent('#done-xp')) === '+10');
check('정확도 100% 미만', (await page.textContent('#done-acc')) !== '100%');
await page.click('#done-btn');

/* ── 5. 하트 소진 → 실패 화면 ── */
console.log('\n[5] 하트 소진');
await page.evaluate(() => { window.NIHONGO.state.hearts = 1; });
await page.click('.node.next');
await solveExercise(page, { wrong: true }); // 하트 0
check('하트 0', await page.evaluate(() => window.NIHONGO.state.hearts === 0));
check('실패 화면 표시', await page.isVisible('#screen-fail'));
await page.click('#fail-btn');
check('홈 복귀', await page.isVisible('#screen-home'));
check('하트 0이면 레슨 시작 시 실패 화면', await (async () => {
  await page.click('.node.next');
  return page.isVisible('#screen-fail');
})());
await page.click('#fail-btn');

/* ── 6. 복습(SRS) → 완주 시 하트 +1 ── */
console.log('\n[6] 간격 반복 복습');
check('복습 버튼 활성화됨', !(await page.isDisabled('#review-btn')));
await page.click('#review-btn');
check('복습 세션 진입', await page.evaluate(() => window.NIHONGO.session?.mode === 'review'));
const heartsBefore = await page.evaluate(() => window.NIHONGO.state.hearts);
await solveSession(page);
check('복습 완료 화면', (await page.textContent('#done-title')) === '복습 완료!');
check('하트 +1 회복', await page.evaluate(h => window.NIHONGO.state.hearts === h + 1, heartsBefore));
check('복습 XP +5', (await page.textContent('#done-xp')) === '+5');
await page.click('#done-btn');

/* ── 7. 유닛 1 전체 완료 → 유닛 2 잠금 해제 ── */
console.log('\n[7] 유닛 진행 · 잠금 해제');
await page.evaluate(() => { window.NIHONGO.state.hearts = 5; });
for (let l = 0; l < 3; l++) {
  const already = await page.evaluate(i => !!window.NIHONGO.state.done['u1-' + i], l);
  if (already) continue;
  await page.click('.node.next');
  await solveSession(page);
  await page.click('#done-btn');
}
check('유닛1 레슨 3개 모두 완료', await page.evaluate(() =>
  ['u1-0', 'u1-1', 'u1-2'].every(k => window.NIHONGO.state.done[k])));
check('유닛2 잠금 해제', await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.node')].find(n => n.dataset.unit === '1' && n.dataset.lesson === '0');
  return btn && !btn.disabled;
}));
check('유닛3은 아직 잠김', await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.node')].find(n => n.dataset.unit === '2' && n.dataset.lesson === '0');
  return btn && btn.disabled;
}));

/* ── 8. 단어 유닛(조립 문제 포함)도 완주 가능한지 — 유닛 5 인사말 강제 진입 ── */
console.log('\n[8] 단어 유닛 · 조립 문제');
await page.evaluate(() => {
  const st = window.NIHONGO.state;
  ['u2', 'u3', 'u4'].forEach(u => { for (let i = 0; i < 3; i++) st.done[u + '-' + i] = true; });
  localStorage.setItem('nihongo-v1', JSON.stringify(st));
});
await page.goto(APP);
await page.evaluate(() => { window.NIHONGO.state.hearts = 5; });
await page.click('.node[data-unit="4"][data-lesson="0"]');
const hasBuild = await page.evaluate(() => window.NIHONGO.session.queue.some(e => e.type === 'build'));
check('조립(build) 문제 포함', hasBuild);
const hasMatch = await page.evaluate(() => window.NIHONGO.session.queue.some(e => e.type === 'match'));
check('짝 맞추기 문제 포함', hasMatch);
await solveSession(page);
check('단어 레슨 완주', await page.isVisible('#screen-done'));

/* ── 9. 스트릭 로직: 어제 공부 → 오늘 완료 시 +1 ── */
console.log('\n[9] 스트릭 계산');
await page.evaluate(() => {
  const st = window.NIHONGO.state;
  st.lastStudy = window.NIHONGO.today(-1); st.streak = 3;
  localStorage.setItem('nihongo-v1', JSON.stringify(st));
});
await page.goto(APP);
check('어제까지 3일 스트릭 표시', (await page.textContent('#stat-streak .val')) === '3');
await page.click('.node.next');
await solveSession(page);
check('오늘 공부로 스트릭 4', (await page.textContent('#done-streak')).includes('4'));
// 끊긴 스트릭: 이틀 전이 마지막이면 0으로 표시
await page.evaluate(() => {
  const st = window.NIHONGO.state;
  st.lastStudy = window.NIHONGO.today(-2); st.streak = 9;
  localStorage.setItem('nihongo-v1', JSON.stringify(st));
});
await page.goto(APP);
check('이틀 쉬면 스트릭 0 표시', (await page.textContent('#stat-streak .val')) === '0');

await browser.close();
console.log(`\n═══ 결과: ${passed} 통과, ${failed} 실패 ═══`);
process.exit(failed ? 1 : 0);
