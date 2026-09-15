// 연구소 '🎸 코드 반주' 켜기/끄기 E2E — 체크박스가 abcjs 신디사이저의 chordsOff 옵션으로 전달되는지
// 실행: node tests/lab-chordacc-e2e.test.mjs   (로컬 abcjs가 있어야 실제 검증; 없으면 스킵)
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
if (!abcjsPath) {
  console.log('SKIP - 로컬 abcjs를 찾을 수 없어 코드 반주 E2E를 건너뜁니다(코드 수정은 반영됨).');
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

for (const LAB of ['lab.html', 'lab16.html', 'lab11.html']) {
  const page = await browser.newPage();
  await page.route(/abcjs.*\.js/, r => r.fulfill({ contentType: 'application/javascript', body: abcjsSrc }));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${base}/${LAB}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.ABCJS !== 'undefined', undefined, { timeout: 8000 });

    // 1) 체크박스 존재 + 기본 켬
    assert.ok(await page.$('#chordAccChk'), '코드 반주 체크박스 존재');
    assert.equal(await page.isChecked('#chordAccChk'), true, '기본값: 켬');

    // 신디를 스텁으로 바꿔 init에 전달되는 chordsOff만 캡처(실제 오디오 없이)
    await page.evaluate(() => {
      window.__chordsOffSeen = [];
      window.AudioContext = function () { this.state = 'running'; this.resume = function () { return Promise.resolve(); }; };
      window.webkitAudioContext = window.AudioContext;
      ABCJS.synth.supportsAudio = function () { return true; };
      ABCJS.synth.CreateSynth = function () {
        return {
          init: function (o) { window.__chordsOffSeen.push(!!(o.options && o.options.chordsOff)); return Promise.resolve(); },
          prime: function () { return Promise.resolve(); },
          start: function () {}, stop: function () {}
        };
      };
      ABCJS.TimingCallbacks = function () { this.start = function () {}; this.stop = function () {}; };
    });

    // 코드가 붙은 곡 입력 → 렌더 대기
    await page.fill('#abcInput', 'X:1\nT:acc\nM:4/4\nL:1/8\nK:C\n"C" C2 E2 G2 c2 | "G" G,2 B,2 D2 G2 |]');
    await page.waitForSelector('#score svg', { timeout: 6000 });

    // 2) 켬 상태로 재생 → chordsOff=false 전달
    await page.click('#playBtn');
    await page.waitForFunction(() => window.__chordsOffSeen.length >= 1, undefined, { timeout: 5000 });
    let seen = await page.evaluate(() => window.__chordsOffSeen);
    assert.equal(seen[seen.length - 1], false, '켬 → chordsOff:false(반주 있음)');
    ok(LAB + ': 켬 상태 재생은 코드 반주 포함');

    // 3) 재생 중 체크 해제 → 즉시 다시 재생되며 chordsOff=true 전달
    await page.uncheck('#chordAccChk');
    await page.waitForFunction(() => window.__chordsOffSeen.length >= 2, undefined, { timeout: 5000 });
    seen = await page.evaluate(() => window.__chordsOffSeen);
    assert.equal(seen[seen.length - 1], true, '끔 → chordsOff:true(멜로디·베이스만)');
    ok(LAB + ': 재생 중 끄면 즉시 반주 없이 다시 재생');

    // 4) 다시 켜면 반주 복귀
    await page.check('#chordAccChk');
    await page.waitForFunction(() => window.__chordsOffSeen.length >= 3, undefined, { timeout: 5000 });
    seen = await page.evaluate(() => window.__chordsOffSeen);
    assert.equal(seen[seen.length - 1], false, '다시 켬 → chordsOff:false');
    ok(LAB + ': 다시 켜면 코드 반주 복귀');

    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' | '));
    ok(LAB + ': JS 오류 없음');
  } catch (e) { bad(LAB + ' 코드 반주 토글', e); }
  await page.close();
}

await browser.close();
server.close();
if (fail) { console.error(`\n${fail} test(s) failed`); process.exit(1); }
console.log('\nAll lab-chordacc E2E passed');
