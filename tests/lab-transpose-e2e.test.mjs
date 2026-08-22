// 연구소 조옮김 회귀 테스트 — 같은음 슬러(→붙임줄 '-' 삽입)가 있는 곡을 조옮김해도
// "Cannot read properties of null" 없이 성공해야 한다.
// 버그 원인: transposeBy가 원본 input.value를 strTranspose에 넘겼는데, visualObj의 문자 위치는
//   slurSameToTie로 '-'가 삽입된 '정규화' 문자열 기준이라 오프셋이 어긋나 abcjs가 크래시.
// 수정: 정규화 문자열(lastRenderedAbc)을 strTranspose에 넘긴다.
// 실행: node tests/lab-transpose-e2e.test.mjs   (로컬 abcjs가 있어야 실제 검증; 없으면 스킵)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = dirname(dirname(fileURLToPath(import.meta.url)));

// 로컬 abcjs 찾기(스크래치패드 node_modules 등). 없으면 스킵.
const ABCJS_CANDIDATES = [
  join(root, 'node_modules/abcjs/dist/abcjs-basic-min.js'),
  '/tmp/claude-0/-home-user-Broguard-music/c040e24c-4a69-5b46-9c8e-25ca04c1bca0/scratchpad/node_modules/abcjs/dist/abcjs-basic-min.js'
];
const abcjsPath = ABCJS_CANDIDATES.find(existsSync);
if (!abcjsPath) {
  console.log('SKIP - 로컬 abcjs를 찾을 수 없어 조옮김 E2E를 건너뜁니다(코드 수정은 반영됨).');
  process.exit(0);
}
const abcjsSrc = readFileSync(abcjsPath, 'utf8');

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

// CDN abcjs 요청을 로컬 파일로 대체(샌드박스는 CDN 차단)
async function newLabPage(LAB) {
  const page = await browser.newPage();
  await page.route(/abcjs.*\.js/, r => r.fulfill({ contentType: 'application/javascript', body: abcjsSrc }));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/${LAB}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.ABCJS !== 'undefined' && typeof ABCJS.strTranspose === 'function', undefined, { timeout: 8000 });
  return { page, errors };
}

for (const LAB of ['lab.html', 'lab16.html', 'lab11.html']) {
  const { page, errors } = await newLabPage(LAB);
  try {
    // 같은음을 괄호 슬러로 이은 Bm 곡 — slurSameToTie가 '-'를 삽입해 길이가 달라진다
    const bm = [
      'X:1', 'T:슬러 조옮김 테스트', 'M:4/4', 'L:1/8', 'Q:1/4=80', 'K:Bm',
      '"F#m" (B2 B2) A2 B2 | "Bm" (d2 d2) c2 B2 | "G" (G2 G2) A2 B2 | "D" d8 |]'
    ].join('\n');
    await page.fill('#abcInput', bm);
    await page.click('#transDownBtn'); // ♭ -1
    await page.waitForFunction(() => /반음 내림|조옮김 실패|실패/.test(document.getElementById('status').textContent), undefined, { timeout: 6000 });
    const st = await page.textContent('#status');
    assert.ok(!/실패|null/.test(st), '조옮김이 실패하지 않아야 함: ' + st);
    assert.ok(/반음 내림/.test(st), '반음 내림 성공: ' + st);

    // 결과 ABC: 조표·코드가 실제로 내려갔는지(Bm -1 → Bbm, F#m→Fm, G→Gb/F#... 코드 이동 확인)
    const out = await page.inputValue('#abcInput');
    assert.ok(/K:\s*(A#m|Bbm)/.test(out), 'Bm 반음 내림 → 조표 이동(A#m/Bbm): ' + out.split('\n').find(l => /^K:/.test(l)));
    assert.ok(!/"F#m"/.test(out), '코드도 함께 이동(F#m 사라짐)');
    ok(LAB + ': 슬러 있는 곡도 조옮김 성공(null 크래시 없음)');

    // 한 번 더(누적) — 두 번째 조옮김도 안전
    await page.click('#transDownBtn');
    await page.waitForFunction(() => /반음 내림|실패/.test(document.getElementById('status').textContent), undefined, { timeout: 6000 });
    const st2 = await page.textContent('#status');
    assert.ok(/반음 내림/.test(st2) && !/실패|null/.test(st2), '연속 조옮김도 안전: ' + st2);
    ok(LAB + ': 연속 조옮김도 안전');

    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' | '));
    ok(LAB + ': JS 오류 없음');
  } catch (e) { bad(LAB + ' 조옮김', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll lab-transpose E2E passed');
