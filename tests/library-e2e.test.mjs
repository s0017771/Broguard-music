// 내 악보집 E2E — 추가·가나다 색인·검색·영속성·백업(브라우저)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const url = 'file://' + join(root, 'library.html');
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('ok - ' + m); };
const bad = (m, e) => { fail++; console.log('NOT OK - ' + m + ' :: ' + (e && e.message || e)); };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ acceptDownloads: true });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(url);
await p.evaluate(() => localStorage.removeItem('broguard_library'));
await p.reload();

async function add(title, abc) {
  await p.fill('#title', title); await p.fill('#abc', abc);
  await p.click('#btnSave'); await p.waitForTimeout(120);
}

try {
  await add('학교종', 'X:1\nK:C\nGGA A|GGE2|');
  await add('나비야', 'X:1\nK:C\nGEE2|FDD2|');
  await add('가을', 'X:1\nK:C\nCDEF|G2G2|');
  await add('Amazing Grace', 'X:1\nK:C\nG2 c2|');
  const titles = await p.$$eval('.entry-title', els => els.map(e => e.textContent));
  // 가나다 → 영문 순서: 가을, 나비야, 학교종, Amazing Grace
  if (JSON.stringify(titles) === JSON.stringify(['가을', '나비야', '학교종', 'Amazing Grace'])) ok('가나다→영문 정렬 목록');
  else bad('정렬 목록', new Error(JSON.stringify(titles)));

  const idx = await p.$$eval('#indexBar a[data-jump]', els => els.map(e => e.textContent));
  if (['ㄱ', 'ㄴ', 'ㅎ', 'A'].every(k => idx.includes(k))) ok('색인 바(ㄱ·ㄴ·ㅎ·A)'); else bad('색인 바', new Error(idx.join(',')));

  const count = await p.$eval('#count', e => e.textContent);
  if (/4곡/.test(count)) ok('곡 수 표시'); else bad('곡 수', new Error(count));

  // 검색
  await p.fill('#search', '나비'); await p.waitForTimeout(120);
  const s = await p.$$eval('.entry-title', els => els.map(e => e.textContent));
  if (JSON.stringify(s) === JSON.stringify(['나비야'])) ok('제목 검색'); else bad('검색', new Error(JSON.stringify(s)));
  await p.fill('#search', ''); await p.waitForTimeout(80);

  // 영속성: 리로드 후에도 유지
  await p.reload(); await p.waitForTimeout(150);
  const after = await p.$$eval('.entry-title', els => els.length);
  if (after === 4) ok('새로고침 후 영속(localStorage)'); else bad('영속성', new Error('개수 ' + after));

  // 삭제 (먼저 항목을 펼쳐 버튼을 보이게)
  await p.click('.entry[data-id] .entry-head');
  await p.waitForTimeout(120);
  p.once('dialog', d => d.accept());
  await p.click('.entry.open button[data-act="del"]');
  await p.waitForTimeout(150);
  const left = await p.$$eval('.entry-title', els => els.length);
  if (left === 3) ok('삭제'); else bad('삭제', new Error('남은 ' + left));

  // 백업 내보내기
  const dl = p.waitForEvent('download', { timeout: 8000 });
  await p.click('#btnExport');
  const file = await dl;
  if (/\.json$/.test(file.suggestedFilename()) || file.suggestedFilename()) ok('백업 내보내기(JSON 다운로드)'); else bad('백업', new Error('no download'));

  // 분류: 저장 시 선택한 분류가 배지로, 필터가 동작
  await p.selectOption('#cat', '클래식');
  await add('소나타', 'X:1\nK:C\nCEGc|');
  const cats = await p.$$eval('#catBar button', els => els.map(e => e.textContent.trim()));
  if (cats.some(c => /전체/.test(c)) && cats.some(c => /클래식/.test(c))) ok('분류 필터 칩'); else bad('분류 칩', new Error(cats.join('|')));
  await p.click('#catBar button[data-cat="클래식"]'); await p.waitForTimeout(120);
  const only = await p.$$eval('.entry-title', els => els.map(e => e.textContent));
  if (JSON.stringify(only) === JSON.stringify(['소나타'])) ok('분류로 필터'); else bad('분류 필터', new Error(JSON.stringify(only)));
  await p.click('#catBar button[data-cat=""]'); await p.waitForTimeout(80);

  if (!errs.length) ok('심각한 JS 오류 없음'); else bad('JS 오류', new Error(errs.slice(0, 2).join(' | ')));
} catch (e) { bad('E2E', e); }

await b.close();
console.log(fail ? ('\n' + fail + '개 실패') : '\n내 악보집 E2E 전체 통과');
process.exit(fail ? 1 : 0);
