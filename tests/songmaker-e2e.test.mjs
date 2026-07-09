// 송메이커 E2E — 실제 브라우저(Chromium)에서 songmaker.html 동작 확인
// 설계 → 프롬프트 복사 → 가사 붙여넣기 적용 (설치 없이 경로)
// 실행: node tests/songmaker-e2e.test.mjs
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
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failures++; console.error(`NOT OK - ${name}\n  ${e.message}`); }
}
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${base}/songmaker.html`, { waitUntil: 'domcontentloaded' });

await check('곡 설계 → 설계도 카드와 섹션이 렌더된다', async () => {
  await page.fill('#title', '여름밤의 약속');
  await page.fill('#theme', '바닷가, 첫사랑');
  await page.selectOption('#genre', 'pop');
  await page.fill('#seed', '7');
  await page.click('#btnPlan');
  await page.waitForSelector('#sections .sec');
  const secs = await page.$$('#sections .sec');
  assert.ok(secs.length >= 6, '섹션 여러 개');
  const pills = await page.textContent('#summary');
  assert.ok(/템포/.test(pills) && /BPM/.test(pills), '요약 표시');
});

await check('가사 프롬프트 복사 → 클립보드에 제목·구성이 담긴다', async () => {
  await page.click('#btnCopyPrompt');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.includes('여름밤의 약속'), '제목 포함');
  assert.ok(clip.includes('코러스'), '구성 포함');
  assert.ok(/한국어/.test(clip), '작사 지시 포함');
});

await check('가사 붙여넣기 → 적용하면 섹션별로 렌더된다', async () => {
  const pasted = '[벌스]\n바닷가 그 여름을 떠올리면\n네 목소리가 들려와\n[코러스]\n약속했잖아 우리\n이 노래처럼 오래';
  await page.fill('#lyricPaste', pasted);
  await page.click('#btnApplyLyric');
  await page.waitForSelector('#lyrics .lyric-sec');
  const names = await page.$$eval('#lyrics .lyric-sec h3', els => els.map(e => e.textContent));
  assert.deepEqual(names, ['벌스', '코러스']);
  const body = await page.textContent('#lyrics');
  assert.ok(body.includes('바닷가 그 여름') && body.includes('약속했잖아'), '가사 본문 표시');
  assert.ok(/적용했습니다/.test(await page.textContent('#lyricStatus')));
});

await check('오프라인 초안 넣기도 동작한다', async () => {
  await page.click('#btnDraft');
  await page.waitForFunction(() => /초안/.test(document.getElementById('lyricStatus').textContent), undefined, { timeout: 4000 });
  const blocks = await page.$$('#lyrics .lyric-sec');
  assert.ok(blocks.length >= 6, '섹션마다 초안');
});

await check('반주 만들기 → 멜로디+베이스+드럼 MIDI가 생성된다', async () => {
  await page.click('#btnArrange');
  await page.waitForFunction(() => /반주 완성/.test(document.getElementById('arrStatus').textContent), undefined, { timeout: 10000 });
  const st = await page.textContent('#arrStatus');
  assert.ok(/멜로디\+베이스/.test(st) && /드럼/.test(st), '반주 요약: ' + st);
  assert.equal(await page.isEnabled('#btnSaveMidi'), true, '.mid 저장 활성화');
  const abc = await page.inputValue('#arrAbc');
  assert.ok(abc.includes('[V:RH]') && abc.includes('[V:LH]'), '편곡 ABC(멀티보이스)');
});

await check('.mid 저장 버튼이 표준 MIDI 파일을 내려준다', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveMidi'),
  ]);
  const bytes = readFileSync(await download.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  assert.ok(bytes.length > 500, '실제 곡 크기: ' + bytes.length);
});

await check('멜로디만 .abc 저장 → 베이스·V:LH 없는 단선율 악보', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnMelodyAbc'),
  ]);
  const abc = readFileSync(await download.path(), 'utf8');
  assert.ok(abc.includes('(멜로디)'), '멜로디 제목');
  assert.ok(!/%%score/.test(abc) && !/\[V:LH\]/.test(abc), '멀티보이스 아님(편집 쉬움)');
  assert.ok(/"\^/.test(abc), '섹션 주석 포함');
});

await check('뮤직비디오 만들기 → 커버 그려지고 가사 첫 줄이 표시된다', async () => {
  // 가사 붙여넣어 두면 그 가사로
  await page.fill('#lyricPaste', '[벌스]\n거울 속 흰머리 하나 늘어도\n[코러스]\n어깨 펴고 화이팅');
  await page.click('#btnApplyLyric');
  await page.click('#btnMv');
  await page.waitForFunction(() => document.getElementById('stage').style.display !== 'none', undefined, { timeout: 8000 });
  // 커버 캔버스가 비어있지 않다(픽셀 존재)
  const painted = await page.evaluate(() => {
    const cv = document.getElementById('cover');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let nonzero = 0; for (let i = 0; i < d.length; i += 400) if (d[i] || d[i + 1] || d[i + 2]) nonzero++;
    return nonzero;
  });
  assert.ok(painted > 50, '커버가 실제로 그려짐: ' + painted);
  const kline = await page.textContent('#kLine');
  assert.ok(kline.trim().length > 0, '가라오케 첫 줄 표시: ' + kline);
  assert.equal(await page.textContent('#kTitle'), '여름밤의 약속');
});

await check('커버 PNG 저장 버튼이 이미지를 내려준다', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveCover'),
  ]);
  const bytes = readFileSync(await download.path());
  assert.equal(bytes.slice(1, 4).toString(), 'PNG', 'PNG 시그니처');
});

await check('가사+스타일 복사 → 송 생성 AI용 브리프가 클립보드에 담긴다', async () => {
  await page.click('#btnCopyBrief');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.includes('[Style]') && clip.includes('[Lyrics]'), '스타일·가사 섹션');
  assert.ok(/BPM/.test(clip) && /korean vocal/i.test(clip), '스타일 태그');
  assert.ok(!/[가-힣]/.test(clip.split('\n')[0]), '[Style] 줄은 영어(한글 없음)');
  assert.ok(clip.includes('[Verse]') || clip.includes('[Chorus]'), '영어 섹션 태그');
});

await check('완성 노래(오디오) 가져오기 → 재생 버튼 활성화', async () => {
  // 짧은 WAV 생성(사인 1초)
  const sr = 22050, n = sr, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 330 * i / sr) * 12000), 44 + i * 2);
  await page.setInputFiles('#vocalFile', { name: 'song.wav', mimeType: 'audio/wav', buffer: buf });
  await page.waitForFunction(() => !document.getElementById('btnVocalPlay').disabled, undefined, { timeout: 5000 });
  const st = await page.textContent('#vocalStatus');
  assert.ok(/불러옴/.test(st), '노래 불러옴 안내: ' + st);
  const hasSrc = await page.evaluate(() => (document.getElementById('vocalAudio').src || '').indexOf('blob:') === 0);
  assert.ok(hasSrc, '오디오 blob src 설정');
});

await check('심각한 JS 오류가 없다', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(failures ? `\n${failures}개 실패` : '\n송메이커 E2E 전체 통과');
process.exit(failures ? 1 : 0);
