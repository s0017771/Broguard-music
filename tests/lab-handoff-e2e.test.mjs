// 연구소 연동 E2E — 송메이커 시드 변화 · 가사 동반 · 4마디 듣기
// 실행: node tests/lab-handoff-e2e.test.mjs
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
const bad = (n, e) => { fail++; console.error('NOT OK - ' + n + '\n  ' + e.message); };

// 1) 송메이커: 시드를 바꾸면 곡(템포/코드)이 실제로 달라진다 + 연구소로 갈 때 가사 동반
{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(() => {}).catch(() => {});
  await page.goto(`${base}/songmaker.html`, { waitUntil: 'domcontentloaded' });
  async function design(seed) {
    await page.fill('#title', '테스트곡'); await page.selectOption('#genre', 'pop');
    await page.fill('#seed', String(seed)); await page.click('#btnPlan');
    await page.waitForSelector('#sections .sec');
    const summary = await page.textContent('#summary');
    const chords = await page.$$eval('#sections .sec .ch', els => els.map(e => e.textContent).join(' / '));
    return { summary, chords };
  }
  try {
    const a = await design(11), b = await design(777), c = await design(4242);
    const allSame = a.chords === b.chords && b.chords === c.chords;
    assert.ok(!allSame, '서로 다른 시드는 다른 코드 진행: \n  11:' + a.chords.slice(0, 60) + '\n  777:' + b.chords.slice(0, 60));
    const tempos = [a, b, c].map(x => (x.summary.match(/템포: (\d+)/) || [])[1]);
    assert.ok(new Set(tempos).size > 1, '시드마다 템포가 달라짐: ' + tempos.join(','));
    ok('시드 변경 → 곡이 실제로 바뀐다(코드·템포)');
  } catch (e) { bad('시드 변경 반영', e); }

  try {
    const opts = await page.$$eval('#genre option', els => els.map(o => o.value));
    assert.ok(opts.length >= 13, '장르 13종 이상: ' + opts.length);
    ['hiphop', 'rnb', 'citypop', 'jazz', 'lofi', 'folk', 'synthwave', 'acoustic'].forEach(k =>
      assert.ok(opts.includes(k), '보너스 장르 ' + k + ' 선택 가능'));
    ok('장르 드롭다운에 보너스 8종 추가됨(총 13)');
  } catch (e) { bad('보너스 장르 추가', e); }

  try {
    // 같은 시드, 다른 장르 → 멜로디(편곡 RH)가 달라진다
    async function melody(genre) {
      await page.fill('#seed', '55'); await page.selectOption('#genre', genre); await page.click('#btnPlan');
      await page.click('#btnArrange');
      await page.waitForFunction(() => /반주 완성/.test(document.getElementById('arrStatus').textContent), undefined, { timeout: 10000 });
      const abc = await page.inputValue('#arrAbc');
      return (abc.split('[V:RH]')[1] || '').split('[V:LH]')[0].replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim();
    }
    const mPop = await melody('pop'), mBallad = await melody('ballad');
    assert.notEqual(mPop, mBallad, '같은 시드라도 장르가 다르면 멜로디가 다름');
    ok('같은 시드 · 다른 장르 → 멜로디가 달라진다');
  } catch (e) { bad('장르별 멜로디 변화', e); }

  try {
    // 반주: 외부 ABC 파일 가져오기 → 플레이어·저장 활성화
    const abcFile = 'X:1\nT:가져온곡\nM:4/4\nL:1/8\nK:C\n"C"c2c2 c2c2 | "G"B2B2 B2B2 |]\n';
    await page.setInputFiles('#fileAbc', { name: 'test.abc', mimeType: 'text/plain', buffer: Buffer.from(abcFile) });
    await page.waitForFunction(() => /ABC 가져옴/.test(document.getElementById('arrStatus').textContent), undefined, { timeout: 5000 });
    assert.equal(await page.isEnabled('#btnSaveMidi'), true, '가져온 뒤 .mid 저장 활성화');
    assert.ok((await page.inputValue('#arrAbc')).includes('가져온곡'), 'arrAbc에 가져온 ABC 반영');
    ok('반주: ABC 가져오기 동작');
  } catch (e) { bad('ABC 가져오기', e); }

  try {
    // 여러 트랙 미디 가져오기 → 멜로디(최상성)만 깔끔히 추출(화음 아님, 여러 줄)
    const b64 = await page.evaluate(() => {
      const p = SongCore.planSong({ title: 'x', mood: 'bright', genre: 'pop', seed: 7 });
      const bytes = Producer.produce(p).bytes; let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s);
    });
    await page.setInputFiles('#fileMidi', { name: 'multi.mid', mimeType: 'audio/midi', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => /멜로디만 추출/.test(document.getElementById('arrStatus').textContent), undefined, { timeout: 5000 });
    const mel = await page.inputValue('#arrAbc');
    assert.ok(!/\[[A-Ga-g]/.test(mel), '가져온 멜로디는 단음(화음 없음)');
    const bodyLines = mel.split('\n').filter(l => l.trim() && !/^[A-Za-z]:/.test(l)).length;
    assert.ok(bodyLines >= 2, '여러 줄(줄별 재생 가능): ' + bodyLines);
    ok('반주: 여러 트랙 미디 → 멜로디만 깔끔 추출');
  } catch (e) { bad('미디 멜로디 추출', e); }

  try {
    // 가사 붙여넣고 → 멜로디 연구소로: window.open 가로채고 localStorage 확인
    await page.click('#btnArrange');
    await page.waitForFunction(() => /반주 완성/.test(document.getElementById('arrStatus').textContent), undefined, { timeout: 10000 });
    await page.fill('#lyricPaste', '[벌스]\n첫 줄 가사\n[코러스]\n후렴 가사입니다');
    await page.click('#btnApplyLyric');
    await page.evaluate(() => { window.open = () => null; });   // 새 창 억제
    await page.click('#btnMelodyLab');
    const stored = await page.evaluate(() => ({
      abc: localStorage.getItem('broguard_lab_abc'),
      ly: localStorage.getItem('broguard_lab_lyrics')
    }));
    assert.ok(stored.abc && /멜로디/.test(stored.abc), '멜로디 ABC 저장');
    assert.ok(stored.ly && stored.ly.includes('후렴 가사입니다') && stored.ly.includes('[코러스]'), '가사 동반 저장: ' + stored.ly);
    ok('연구소로 갈 때 가사가 함께 넘어간다');
  } catch (e) { bad('가사 동반 핸드오프', e); }
  try { assert.deepEqual(errors, []); ok('송메이커 JS 오류 없음'); } catch (e) { bad('송메이커 JS 오류', e); }
  await page.close();
}

// 2) 연구소: 넘어온 가사가 악보 아래 패널에 뜨고, 4마디 듣기가 오류 없이 동작
{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    // 4마디씩 2줄(줄별 재생 버튼 확인용)
    localStorage.setItem('broguard_lab_abc', 'X:1\nT:테스트 (멜로디)\nM:4/4\nL:1/8\nK:C\n"^1. 벌스""C"c2c2 c2c2 | "G"B2B2 B2B2 | "Am"A2A2 A2A2 | "F"F2F2 F2F2 |\n"^2. 코러스""C"c2c2 c2c2 | "G"G2G2 G2G2 | "Am"A2A2 A2A2 | "F"F2F2 F2F2 |]\n');
    localStorage.setItem('broguard_lab_lyrics', '[벌스]\n첫 줄 가사\n[코러스]\n후렴 가사입니다');
  });
  await page.goto(`${base}/lab.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#lyricsPanel', { state: 'visible', timeout: 5000 });
    assert.equal(await page.isVisible('#lyricOverlayBtn'), true, '가사 얹기 버튼 노출');
    ok('연구소: 가사 패널(가사 얹기 버튼) 표시');
  } catch (e) { bad('가사 패널', e); }
  try {
    // 버튼 존재 + 클릭해도 크래시 없이 안내가 뜬다.
    // (샌드박스는 abcjs CDN 차단 → "abcjs 못 불러옴" 안내 / 실제 PC는 "4마디" 재생 안내)
    assert.equal(await page.isVisible('#play4Btn'), true, '4마디 버튼 존재');
    await page.click('#play4Btn');
    await page.waitForFunction(() => /4마디|abcjs/.test(document.getElementById('status').textContent), undefined, { timeout: 6000 });
    const st = await page.textContent('#status');
    assert.ok(/4마디|abcjs/.test(st), '4마디 안내(또는 엔진 미로드 안내): ' + st);
    ok('연구소: 4마디만 듣기 버튼 안전 동작');
  } catch (e) { bad('4마디 듣기', e); }
  try {
    // 줄별 재생 버튼: 소스가 2줄(각 4마디)이므로 '▶ 1줄','▶ 2줄' 생성 (abcjs 없어도 버튼은 만들어짐)
    await page.waitForSelector('#linePlays', { state: 'visible', timeout: 5000 });
    const btns = await page.$$eval('#linePlays button', els => els.map(b => b.textContent.trim()));
    assert.ok(btns.includes('▶ 1줄') && btns.includes('▶ 2줄'), '줄별 버튼: ' + btns.join(','));
    await page.click('#linePlays button:nth-of-type(1)');
    ok('연구소: 줄별(4마디) 재생 버튼 생성·클릭 안전');
  } catch (e) { bad('줄별 재생 버튼', e); }
  try {
    // 가사 얹어 보기: abcjs 있으면 #lyricScore 표시, 없으면 상태 안내 — 크래시 없이
    assert.equal(await page.isVisible('#lyricOverlayBtn'), true, '가사 얹기 버튼 존재');
    await page.click('#lyricOverlayBtn');
    await page.waitForFunction(() => {
      const ls = document.getElementById('lyricScore');
      return (ls && ls.style.display !== 'none') || /abcjs/.test(document.getElementById('status').textContent);
    }, undefined, { timeout: 5000 });
    ok('연구소: 악보에 가사 얹어 보기 안전 동작');
  } catch (e) { bad('가사 얹어 보기', e); }
  try { assert.deepEqual(errors, []); ok('연구소 JS 오류 없음'); } catch (e) { bad('연구소 JS 오류', e); }
  await page.close();
}

// 3) 송메이커: 스튜디오에서 넘어온 설계도(plan) + 반주(MIDI) 자동 복원 → 가라오케가 그 반주 사용
{
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // 간단한 유효 MIDI(2음) 생성
  function vlq(v) { const a = [v & 0x7f]; v >>= 7; while (v > 0) { a.unshift((v & 0x7f) | 0x80); v >>= 7; } return a; }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function u16(v) { return [(v >>> 8) & 255, v & 255]; }
  function chunk(id, d) { const a = []; for (const ch of id) a.push(ch.charCodeAt(0)); return a.concat(u32(d.length), d); }
  let trk = [].concat(vlq(0), [0xc0, 40], vlq(0), [0x90, 72, 90], vlq(480), [0x80, 72, 0], vlq(0), [0x90, 76, 90], vlq(480), [0x80, 76, 0], vlq(0), [0xff, 0x2f, 0]);
  const midiBytes = chunk('MThd', u16(0).concat(u16(1), u16(480))).concat(chunk('MTrk', trk));
  const midiB64 = Buffer.from(midiBytes).toString('base64');
  await page.addInitScript(b64 => {
    localStorage.setItem('broguard_sm_plan', JSON.stringify({
      title: '스튜디오곡', theme: '', genre: '팝', genreKey: 'pop', mood: '밝음', moodKey: 'bright',
      key: 'C(장조)', minor: false, tempo: 110, meter: '4/4', drumStyle: '팝', energy: 0.7, seed: 7,
      sections: [
        { name: '인트로', bars: 4, chords: ['C', 'G', 'Am', 'F'], energy: 0.4 },
        { name: '벌스', bars: 8, chords: ['C', 'G', 'Am', 'F'], energy: 0.5 },
        { name: '코러스', bars: 8, chords: ['C', 'G', 'Am', 'F'], energy: 1.0 }
      ], totalBars: 20, estSec: 44
    }));
    localStorage.setItem('broguard_sm_midi', b64);
  }, midiB64);
  await page.goto(`${base}/songmaker.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#planCard', { state: 'visible', timeout: 5000 });
    const note = await page.textContent('#planNote');
    assert.ok(/스튜디오에서 넘어온/.test(note), '안내 문구: ' + note);
    assert.equal(await page.inputValue('#title'), '스튜디오곡', '제목 복원');
    assert.equal((await page.$$('#sections .sec')).length, 3, '섹션 복원');
    // 반주 수신: 상태 문구 + 플레이어 로드 + 저장 활성화
    const arrSt = await page.textContent('#arrStatus');
    assert.ok(/스튜디오 반주/.test(arrSt), '반주 불러옴: ' + arrSt);
    assert.equal(await page.isEnabled('#btnSaveMidi'), true, '.mid 저장 활성화');
    const cleared = await page.evaluate(() => localStorage.getItem('broguard_sm_plan') || localStorage.getItem('broguard_sm_midi'));
    assert.equal(cleared, null, '핸드오프 키 정리');
    ok('송메이커: 스튜디오 설계도+반주 자동 복원');
  } catch (e) { bad('스튜디오→송메이커 복원', e); }
  try {
    // 뮤직비디오 만들기 → 가라오케 반주가 스튜디오 MIDI(그 바이트)로 설정된다
    await page.click('#btnMv');
    await page.waitForFunction(() => document.getElementById('stage').style.display !== 'none', undefined, { timeout: 8000 });
    const usesStudio = await page.evaluate(async (expectLen) => {
      const src = document.getElementById('mvPlayer').getAttribute('src');
      if (!src) return 'no-src';
      const r = await fetch(src); const buf = await r.arrayBuffer();
      return buf.byteLength === expectLen ? 'match' : ('len:' + buf.byteLength);
    }, midiBytes.length);
    assert.equal(usesStudio, 'match', '가라오케 반주 = 스튜디오 MIDI: ' + usesStudio);
    ok('가라오케가 스튜디오 반주(악기 소리 그대로)로 재생 준비');
  } catch (e) { bad('가라오케 스튜디오 반주', e); }
  try { assert.deepEqual(errors, []); ok('송메이커(복원) JS 오류 없음'); } catch (e) { bad('복원 JS 오류', e); }
  await page.close();
}

await browser.close(); server.close();
console.log(fail ? `\n${fail}개 실패` : '\n연구소 연동 E2E 전체 통과');
process.exit(fail ? 1 : 0);
