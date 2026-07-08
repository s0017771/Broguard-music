// 오디오→MIDI 변환기 E2E — 실제 브라우저(Chromium)에서 audio.html 동작 확인
// 생성한 WAV(사인파 멜로디)를 파일 입력에 주입 → 디코드 → 오프라인 채보 → ABC 확인
// 실행: node tests/audio-e2e.test.mjs
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

// 16-bit PCM WAV 생성 (C4 E4 G4 c5, 각 0.5초, 44100Hz)
function makeWav(freqs, sr, noteDur) {
  const perNote = Math.floor(sr * noteDur);
  const nSamples = perNote * freqs.length;
  const buf = Buffer.alloc(44 + nSamples * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + nSamples * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(nSamples * 2, 40);
  let off = 44;
  freqs.forEach((f) => {
    for (let i = 0; i < perNote; i++) {
      const v = Math.sin(2 * Math.PI * f * i / sr) * 0.6;
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, v * 32767)), off); off += 2;
    }
  });
  return buf;
}
const HZ = { C4: 261.63, E4: 329.63, G4: 392.00, C5: 523.25 };
const wav = makeWav([HZ.C4, HZ.E4, HZ.G4, HZ.C5], 44100, 0.5);

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failures++; console.error(`NOT OK - ${name}\n  ${e.message}`); }
}
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${base}/audio.html`, { waitUntil: 'domcontentloaded' });

await check('WAV 파일 주입 → 디코드 후 분석 버튼 활성화', async () => {
  await page.setInputFiles('#audioFile', { name: 'melody.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => !document.getElementById('btnGo').disabled, undefined, { timeout: 8000 });
  const st = await page.textContent('#status');
  assert.ok(/불러옴/.test(st), '불러옴 안내: ' + st);
});

await check('오프라인 분석 → 도미솔높은도(C E G c)가 ABC로 나온다', async () => {
  await page.fill('#tempo', '120');
  await page.click('#btnGo');
  await page.waitForFunction(() => document.getElementById('abcOut').value.includes('K:C'), undefined, { timeout: 8000 });
  const abc = await page.inputValue('#abcOut');
  const body = abc.split('K:C\n')[1] || '';
  // C4=C, E4=E, G4=G, C5=c 가 순서대로 등장
  assert.ok(/C\d?\s+E\d?\s+G\d?\s+c\d?/.test(body.replace(/\|/g, ' ')), '멜로디 음이름 순서: ' + body);
  assert.ok(abc.trim().endsWith('|]'));
});

await check('결과 버튼(재생·복사·.abc·.mid·연구소·드럼)이 활성화된다', async () => {
  for (const id of ['btnPlay', 'btnCopy', 'btnSaveAbc', 'btnSaveMidi', 'btnToLab', 'btnToDrum']) {
    assert.equal(await page.isEnabled('#' + id), true, id + ' 활성화');
  }
});

await check('.mid 저장 버튼이 표준 MIDI 파일을 다운로드한다', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveMidi'),
  ]);
  const bytes = readFileSync(await download.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
});

await check('악보 연구소로 보내기 → 새 창에 ABC가 실려 열린다', async () => {
  const [popup] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 5000 }),
    page.click('#btnToLab'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForFunction(() => {
    const t = document.getElementById('abcInput');
    return t && t.value.includes('K:C');
  }, undefined, { timeout: 5000 });
  const loaded = await popup.inputValue('#abcInput');
  assert.ok(loaded.includes('K:C'), '넘어온 ABC: ' + loaded.slice(0, 40));
  await popup.close();
});

await check('AI 모드 전환 후 분석 → 오프라인 폴백까지 오류 없이 동작', async () => {
  // 오프라인 환경(CDN 차단)에서는 Basic Pitch 로드 실패 → 오프라인 단선율로 자동 대체
  await page.click('#chipAI');
  await page.click('#btnGo');
  await page.waitForFunction(() => {
    const s = document.getElementById('status').textContent;
    return /완료|대체|실패/.test(s);
  }, undefined, { timeout: 15000 });
  const abc = await page.inputValue('#abcOut');
  assert.ok(abc.includes('K:C'), 'AI 실패해도 결과 ABC 존재(폴백)');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n오디오→MIDI E2E 전체 통과');
process.exit(failures ? 1 : 0);
