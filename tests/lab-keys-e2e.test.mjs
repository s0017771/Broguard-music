// 연구소 조성 지원 E2E — Bm 등 조옮김 후 재분석이 되는지
// 실행: node tests/lab-keys-e2e.test.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
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

for (const LAB of ['lab.html', 'lab16.html', 'lab11.html']) {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/abcjs|ABCJS|cdnjs|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  try {
    await page.goto(`${base}/${LAB}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#abcInput');

    // autoArrange()는 abcjs 없이 원문 텍스트만으로 조성·코드 분석 → 샌드박스에서도 동작
    async function analyze(abc) {
      await page.fill('#abcInput', abc);
      await page.click('#arrangeBtn');
      await page.waitForFunction(() => {
        const s = document.getElementById('status').textContent;
        return /코드:|지원하지 않습니다|해석할 수 없습니다|지원하지 않/.test(s);
      }, undefined, { timeout: 4000 });
      return page.textContent('#status');
    }

    // 1) Bm — 사용자가 조옮김한 조성. 재분석이 성공하고 Bm 코드가 잡혀야 함
    const bm = 'X:1\nT:Bm 테스트\nM:4/4\nL:1/8\nK:Bm\n"Bm"B2c2 d2e2 | "F#m"f2e2 d2c2 | "G"B2A2 G2F2 | "Bm"B4 z4 |]';
    let st = await analyze(bm);
    assert.ok(!/지원하지 않/.test(st), 'Bm이 지원되어야 함: ' + st);
    assert.ok(/코드:/.test(st), 'Bm 재분석 성공(코드 추정): ' + st);
    assert.ok(/Bm/.test(st), '추정 코드에 Bm 포함: ' + st);
    ok(LAB + ': Bm 조성을 재분석할 수 있다(조옮김 후 기타 연습 가능)');

    // 2) 올림표 장조(A) — 지원
    const aMaj = 'X:1\nT:A 테스트\nM:4/4\nL:1/8\nK:A\n"A"A2B2 c2d2 | "E"e2d2 c2B2 | "D"A2G2 F2E2 | "A"A4 z4 |]';
    st = await analyze(aMaj);
    assert.ok(!/지원하지 않/.test(st) && /코드:/.test(st), 'A장조 지원: ' + st);
    ok('올림표 장조(A)도 재분석된다');

    // 3) 내림표 장조(Bb) — 지원
    const bb = 'X:1\nT:Bb 테스트\nM:4/4\nL:1/8\nK:Bb\n"Bb"B2c2 d2f2 | "F"c2B2 A2G2 | "Eb"e2d2 c2B2 | "Bb"B4 z4 |]';
    st = await analyze(bb);
    assert.ok(!/지원하지 않/.test(st) && /코드:/.test(st), 'Bb장조 지원: ' + st);
    ok('내림표 장조(Bb)도 재분석된다');

    // 4) 여전히 미지원 조성은 지원 목록을 안내(안전한 실패)
    const gbMin = 'X:1\nT:x\nM:4/4\nL:1/8\nK:Gbm\nc2c2 c2c2 |]';
    st = await analyze(gbMin);
    assert.ok(/지원하지 않/.test(st) && /지원 조성:/.test(st), '미지원 조성은 목록 안내: ' + st);
    ok('미지원 조성은 지원 조성 목록을 안내한다');

    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' | '));
    ok(LAB + ': JS 오류 없음');
  } catch (e) { bad(LAB + ' 조성 지원', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll lab-keys E2E passed');
