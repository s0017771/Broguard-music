// BKD 드럼 교실 E2E — 패드 렌더·키보드 타격·녹음·패턴 복사·미디 저장·레슨
// 실행: node tests/bkd-e2e.test.mjs
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
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
let fail = 0;
const ok = n => console.log('ok - ' + n);
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + e.message); };

await page.goto(`${base}/drum.html`, { waitUntil: 'domcontentloaded' });

await (async () => { try {
  const pads = await page.$$('#kit .pad');
  assert.equal(pads.length, 11, '11개 패드');
  const labels = await page.$$eval('#kit .pad .nm', els => els.map(e => e.textContent));
  ['스네어', '하이햇', '킥(베이스)', '라이드', '크래시'].forEach(n =>
    assert.ok(labels.some(l => l.includes(n.split('(')[0])), n + ' 패드'));
  const keys = await page.$$eval('#kit .pad .ky', els => els.map(e => e.textContent));
  assert.ok(keys.includes('S') && keys.includes('G·H') && keys.some(k => /Space/.test(k)), '새 키 라벨: ' + keys.join(','));
  // 가림 없음: 모든 패드가 킷 컨테이너 안에
  const fits = await page.evaluate(() => {
    const kit = document.getElementById('kit').getBoundingClientRect();
    return [...document.querySelectorAll('#kit .pad')].every(p => {
      const r = p.getBoundingClientRect();
      return r.left >= kit.left - 1 && r.right <= kit.right + 1 && r.top >= kit.top - 1 && r.bottom <= kit.bottom + 1;
    });
  });
  assert.ok(fits, '모든 패드가 화면 안(가림 없음)');
  ok('드럼 킷 11패드 + 새 키 라벨 + 가림 없음');
} catch (e) { bad('킷 렌더', e); } })();

await (async () => { try {
  // 키보드 타격: Space(킥)·H(스네어) → hit 클래스
  const flashed = await page.evaluate(() => new Promise(res => {
    const sn = document.getElementById('pad-snare'), kk = document.getElementById('pad-kick');
    let snHit = false, kkHit = false;
    const check = () => { if (snHit && kkHit) res(true); };
    new MutationObserver(() => { if (sn.classList.contains('hit')) { snHit = true; check(); } }).observe(sn, { attributes: true });
    new MutationObserver(() => { if (kk.classList.contains('hit')) { kkHit = true; check(); } }).observe(kk, { attributes: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    setTimeout(() => res(snHit && kkHit), 400);
  }));
  assert.ok(flashed, '킥(Space)·스네어(H) 시각 반응');
  ok('새 키맵 타격(Space=킥, H=스네어) 시각 반응');
} catch (e) { bad('키보드 타격', e); } })();

await (async () => { try {
  // 스피커 깨워두기: 체크박스 존재·기본 켜짐, 끄고 켜도 오류 없음
  assert.equal(await page.isChecked('#wakeOn'), true, '기본 켜짐');
  await page.uncheck('#wakeOn');
  await page.check('#wakeOn');
  ok('스피커 깨워두기 토글');
} catch (e) { bad('스피커 깨워두기', e); } })();

await (async () => { try {
  // 녹음: 시작 → 키 타격 3번(킥·스네어·킥) → 종료 → 패턴 복사
  await page.click('#btnRec');
  await page.evaluate(() => new Promise(res => {
    const seq = [' ', 'g', ' '];   // 킥, 스네어, 킥
    let i = 0;
    const iv = setInterval(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: seq[i], bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: seq[i], bubbles: true }));
      if (++i >= seq.length) { clearInterval(iv); res(); }
    }, 120);
  }));
  await page.click('#btnRec');
  await page.waitForFunction(() => /녹음됨/.test(document.getElementById('recStatus').textContent), undefined, { timeout: 3000 });
  assert.equal(await page.isEnabled('#btnCopyPattern'), true, '패턴 복사 활성화');
  await page.click('#btnCopyPattern');
  await page.waitForFunction(() => /복사됨/.test(document.getElementById('exportStatus').textContent), undefined, { timeout: 3000 });
  const st = await page.textContent('#exportStatus');
  assert.ok(/[ks]/.test(st) && /직접 입력/.test(st), '패턴 문자열 안내: ' + st);
  ok('녹음 → 스튜디오 패턴 복사');
} catch (e) { bad('녹음·패턴 복사', e); } })();

await (async () => { try {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#btnSaveMidi')
  ]);
  const bytes = readFileSync(await dl.path());
  assert.equal(bytes.slice(0, 4).toString(), 'MThd', 'MIDI 헤더');
  ok('.mid 저장');
} catch (e) { bad('.mid 저장', e); } })();

await (async () => { try {
  // 레슨: 시범 시작 → 가이드 불(guide 클래스) 켜짐 → 정지
  await page.selectOption('#lessonSel', '0');
  await page.click('#btnLesson');
  await page.waitForFunction(() => document.querySelectorAll('#kit .pad.guide').length > 0, undefined, { timeout: 4000 });
  const hint = await page.textContent('#lessonHint');
  assert.ok(/킥/.test(hint), '레슨 힌트: ' + hint);
  await page.click('#btnLessonStop');
  await page.waitForFunction(() => document.querySelectorAll('#kit .pad.guide').length === 0, undefined, { timeout: 2000 });
  ok('레슨 시범(가이드 불) 시작·정지');
} catch (e) { bad('레슨', e); } })();

await (async () => { try {
  // 레슨 ① 10종 + 노래 레슨 10곡 목록
  const lessons = await page.$$eval('#lessonSel option', els => els.length);
  assert.equal(lessons, 10, '기본 비트 10종: ' + lessons);
  const songs = await page.$$eval('#songSel option', els => els.map(o => o.textContent));
  assert.equal(songs.length, 10, 'PD곡 10곡: ' + songs.length);
  assert.ok(songs.some(s => /작은별/.test(s)) && songs.some(s => /캐논/.test(s)), '곡 목록: ' + songs.join(','));
  ok('레슨 10종 + 노래 10곡 목록');
} catch (e) { bad('레슨/노래 목록', e); } })();

await (async () => { try {
  // 노래 연습: 시작 → 드럼 가이드 불 → 정지
  await page.selectOption('#songSel', '0');
  await page.click('#btnSong');
  await page.waitForFunction(() => document.querySelectorAll('#kit .pad.guide').length > 0, undefined, { timeout: 5000 });
  const st = await page.textContent('#songStatus');
  assert.ok(/작은별/.test(st), '노래 상태: ' + st);
  await page.click('#btnSongStop');
  await page.waitForFunction(() => document.querySelectorAll('#kit .pad.guide').length === 0, undefined, { timeout: 2000 });
  ok('노래 연습(멜로디 루프 + 드럼 가이드) 시작·정지');
} catch (e) { bad('노래 연습', e); } })();

await (async () => { try {
  // 내 곡 불러오기: 간단한 .mid 업로드 → 목록에 추가
  function vlq(v) { const a = [v & 0x7f]; v >>= 7; while (v > 0) { a.unshift((v & 0x7f) | 0x80); v >>= 7; } return a; }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function u16(v) { return [(v >>> 8) & 255, v & 255]; }
  function chunk(id, d) { const a = []; for (const ch of id) a.push(ch.charCodeAt(0)); return a.concat(u32(d.length), d); }
  let trk = [].concat(vlq(0), [0xff, 0x51, 3, 0x07, 0xa1, 0x20]);
  trk = trk.concat(vlq(0), [0x90, 60, 90], vlq(480), [0x80, 60, 0]);
  trk = trk.concat(vlq(0), [0x90, 64, 90], vlq(480), [0x80, 64, 0]);
  trk = trk.concat(vlq(0), [0xff, 0x2f, 0]);
  const midiBytes = Buffer.from(chunk('MThd', u16(0).concat(u16(1), u16(480))).concat(chunk('MTrk', trk)));
  await page.setInputFiles('#songFile', { name: 'mysong.mid', mimeType: 'audio/midi', buffer: midiBytes });
  await page.waitForFunction(() => /불러옴/.test(document.getElementById('songStatus').textContent), undefined, { timeout: 3000 });
  const opts = await page.$$eval('#songSel option', els => els.map(o => o.textContent));
  assert.ok(opts.some(t => t.includes('mysong')), '내 곡 목록 추가: ' + opts.join(','));
  ok('내 곡(.mid) 불러오기 → 연습 목록 추가');
} catch (e) { bad('내 곡 불러오기', e); } })();

await (async () => { try { assert.deepEqual(errors, []); ok('심각한 JS 오류 없음'); } catch (e) { bad('JS 오류', e); } })();

await browser.close(); server.close();
console.log(fail ? `\n${fail}개 실패` : '\nBKD 드럼 교실 E2E 전체 통과');
process.exit(fail ? 1 : 0);
