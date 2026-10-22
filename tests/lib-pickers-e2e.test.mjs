// 📚 악보집 불러오기(여러 랩) + 🔊 고음질 음색 E2E
// 실행: node tests/lib-pickers-e2e.test.mjs
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

const ABCJS_CANDIDATES = [
  join(root, 'node_modules/abcjs/dist/abcjs-basic-min.js'),
  '/tmp/claude-0/-home-user-Broguard-music/c040e24c-4a69-5b46-9c8e-25ca04c1bca0/scratchpad/node_modules/abcjs/dist/abcjs-basic-min.js'
];
const abcjsPath = ABCJS_CANDIDATES.find(existsSync);
const abcjsSrc = abcjsPath ? readFileSync(abcjsPath, 'utf8') : null;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failures++; console.error(`NOT OK - ${name}\n  ${e.message}`); }
}

const LIB = {
  entries: [
    { id: 'p1', title: '픽커곡', cat: 'K-가요', added: 2, abc: 'X:1\nT:픽커곡\nM:4/4\nL:1/8\nQ:1/4=100\nK:G\n"G" G2 A2 B2 d2 | "D" A4 F4 |' },
    { id: 'p2', title: '둘째곡', added: 1, abc: 'X:1\nT:둘째곡\nM:3/4\nL:1/8\nK:C\nC2 E2 G2 |' }
  ]
};

// 작은 유효 WAV — 피아노/기타 샘플 요청 대체용
const tinyWav = (() => {
  const sr = 8000, n = 400, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 5) * 6000), 44 + i * 2);
  return buf;
})();

async function openPage(file) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (abcjsSrc) await page.route(/abcjs.*\.js/, r => r.fulfill({ contentType: 'application/javascript', body: abcjsSrc }));
  let sfHits = 0;
  await page.route(/midi-js-soundfonts/, r => { sfHits++; r.fulfill({ contentType: 'audio/wav', body: tinyWav }); });
  await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(lib => localStorage.setItem('broguard_library', JSON.stringify(lib)), LIB);
  await page.reload({ waitUntil: 'domcontentloaded' });
  return { page, errors, sfHits: () => sfHits };
}

// ── 1) 악보집 픽커: 각 랩에서 곡 목록이 뜨고, 고르면 입력이 채워진다 ──
const PICKER_PAGES = [
  { file: 'tab.html', sel: '#libSel', target: '#abcIn', after: async p => {
      const out = await p.textContent('#tabOut');
      assert.ok(/픽커곡/.test(out), '선택 즉시 타브 변환: ' + out.slice(0, 40)); } },
  { file: 'merge.html', sel: '#libSel', target: '#abcIn' },
  { file: 'split.html', sel: '#libSel', target: '#abcIn', after: async p => {
      const mel = await p.inputValue('#melodyOut');
      assert.ok(mel.trim().length > 0, '선택 즉시 멜로디 분리됨'); } },
  { file: 'midi.html', sel: '#libSel', target: '#abcIn' },
  { file: 'lab16.html', sel: '#libSel', target: '#abcInput' },
  { file: 'lab11.html', sel: '#libSel', target: '#abcInput' }
];

for (const cfg of PICKER_PAGES) {
  const { page, errors } = await openPage(cfg.file);
  await check(`${cfg.file}: 악보집에서 불러오기`, async () => {
    const opts = await page.$$eval(cfg.sel + ' option', os => os.map(o => ({ v: o.value, t: o.textContent })));
    assert.equal(opts.length, 3, '자리표시 + 곡 2개: ' + JSON.stringify(opts));
    assert.ok(/픽커곡/.test(opts[1].t), '최근 저장 곡이 먼저');
    await page.selectOption(cfg.sel, 'p1');
    const val = await page.inputValue(cfg.target);
    assert.ok(val.includes('T:픽커곡'), '입력창에 악보 채워짐');
    if (cfg.after) await cfg.after(page);
    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' / '));
  });
  await page.close();
}

// interpolate: A/B 두 픽커
{
  const { page, errors } = await openPage('interpolate.html');
  await check('interpolate.html: 악보집에서 A·B 불러오기', async () => {
    await page.selectOption('#libSelA', 'p1');
    await page.selectOption('#libSelB', 'p2');
    assert.ok((await page.inputValue('#abcA')).includes('T:픽커곡'), 'A 채워짐');
    assert.ok((await page.inputValue('#abcB')).includes('T:둘째곡'), 'B 채워짐');
    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' / '));
  });
  await page.close();
}

// ── 2) 🔊 고음질: lab16 재생이 MusyngKite 음원을 먼저 쓰고, 끄면 기본 음원 ──
if (abcjsSrc) {
  const { page, errors } = await openPage('lab16.html');
  await check('lab16.html: 고음질 음원(MusyngKite) 기본 사용 + 끄기 지원', async () => {
    await page.waitForFunction(() => !!(window.ABCJS && window.ABCJS.synth), undefined, { timeout: 5000 });
    await page.evaluate(() => {
      window.__inits = [];
      window.AudioContext = function () { this.state = 'running'; this.resume = function () { return Promise.resolve(); }; };
      window.webkitAudioContext = window.AudioContext;
      ABCJS.synth.supportsAudio = function () { return true; };
      ABCJS.synth.CreateSynth = function () {
        return {
          init: function (o) { window.__inits.push({ sf: (o.options && o.options.soundFontUrl) || 'default' }); return Promise.resolve(); },
          prime: function () { return Promise.resolve(); },
          start: function () {}, stop: function () {}
        };
      };
    });
    await page.selectOption('#libSel', 'p1');
    await page.click('#playBtn');
    await page.waitForFunction(() => window.__inits && window.__inits.length > 0, undefined, { timeout: 5000 });
    let inits = await page.evaluate(() => window.__inits);
    assert.ok(/MusyngKite/.test(inits[0].sf), '고음질 음원 사용: ' + inits[0].sf);
    // 끄면(공용 스위치 broguard_hq_sound=0) 기본 음원
    await page.evaluate(() => { localStorage.setItem('broguard_hq_sound', '0'); window.__inits = []; });
    await page.click('#stopBtn').catch(() => {});
    await page.click('#playBtn');
    await page.waitForFunction(() => window.__inits && window.__inits.length > 0, undefined, { timeout: 5000 });
    inits = await page.evaluate(() => window.__inits);
    assert.equal(inits[0].sf, 'default', '끄면 기본 음원: ' + inits[0].sf);
    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' / '));
  });
  await page.close();
}

// ── 3) 🎹 ABC 피아노(piano.html): 건반을 누르면 진짜 피아노 샘플을 받아온다 ──
{
  const { page, errors, sfHits } = await openPage('piano.html');
  await check('piano.html: 건반 소리에 피아노 샘플 사용(요청 발생)', async () => {
    // 흰 건반에 pointerdown → noteOn → 샘플 미리 받기(prefetch) 요청 발생
    await page.dispatchEvent('.wkey', 'pointerdown');
    await page.waitForTimeout(700);
    assert.ok(sfHits() > 0, '피아노 샘플 요청 발생: ' + sfHits());
    assert.deepEqual(errors, [], 'JS 오류 없음: ' + errors.join(' / '));
  });
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n악보집 픽커·음색 E2E 전체 통과');
process.exit(failures ? 1 : 0);
