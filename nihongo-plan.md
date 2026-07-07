# 니혼고 랩 (nihongo.html) — 나만의 일본어 공부 앱 개발 계획

## 1. 듀오링고 작동 방식 조사 요약

듀오링고의 핵심은 **"매일 짧은 레슨 하나"라는 습관을 게임 메커니즘으로 강제하는 것**이다.
조사에서 확인한 핵심 구조:

### 학습 구조
- **경로(Path)**: 유닛 → 레슨 순서로 한 줄로 이어진 학습 경로. 앞 레슨을 끝내야 다음이 열림.
- **레슨**: 8~18문제의 짧은 세션. 문제 유형은 객관식, 짝 맞추기, 빈칸 채우기, 받아쓰기, 번역, 단어 조립(타일) 등.
- **일본어 코스 특징**: 히라가나를 가장 먼저 도입. 문자 모양↔소리↔뜻을 잇는 객관식/매칭/스펠링 연습을 반복.

### 게임화(동기부여) 장치
- **XP**: 레슨을 끝내면 즉시 경험치 지급. 보상이 행동 직후에 옴.
- **스트릭(연속 학습일)**: 하루라도 공부하면 🔥 +1. 참여율을 크게 올리는 핵심 장치.
- **하트(생명)**: 실수하면 하트가 깎임. 다 잃으면 레슨 중단 → 적당한 긴장감. 복습으로 회복 가능.
- **일일 목표**: 하루 XP 목표를 정하고 진행 바로 표시.
- **간격 반복(SRS)**: 각 단어/문자의 기억 강도를 추적해 "잊기 직전"에 다시 출제.

## 2. 목표와 범위

이 저장소의 다른 도구들과 똑같이 **서버·설치·계정이 필요 없는 단일 HTML 파일 로컬 앱**으로 만든다.
브라우저에서 열면 바로 되고, 진행 상황은 `localStorage`에 저장된다. UI는 한국어, 학습 대상은 일본어.

### 1차 구현 (이번에 완성할 것)
| 기능 | 내용 |
|---|---|
| 학습 경로 | 7개 유닛(히라가나 4 + 인사말 + 숫자 + 음식), 유닛당 3레슨, 순차 잠금 해제 |
| 문제 유형 5종 | ① 문자→읽기 객관식 ② 읽기→문자 객관식 ③ 짝 맞추기 ④ 단어 조립(타일) ⑤ 듣기(TTS) |
| XP | 레슨당 기본 10XP + 무실수 보너스 5XP, 일일 목표 진행 바 |
| 스트릭 | 날짜 기반 연속 학습일 계산 (어제 공부했으면 +1, 끊기면 1로 리셋) |
| 하트 | 5개, 오답당 -1, 0이면 레슨 실패. 30분당 1개 자동 회복 + 복습 완료 시 +1 |
| 간격 반복 복습 | 문항별 기억 강도(0~5)와 복습 예정 시각 추적, "복습하기"에서 약한 것부터 출제 |
| 저장 | 모든 진행 상황 localStorage 저장, 새로고침/재방문에도 유지 |
| 듣기 | Web Speech API(ja-JP TTS). 미지원 브라우저에서는 자동으로 다른 유형으로 대체 |

### 나중에 확장할 수 있는 것 (이번 범위 밖)
- 가타카나·한자 유닛, 문장 번역 문제, 리그/랭킹, 스트릭 프리즈, 필기(따라 쓰기) 연습

## 3. 화면 설계
1. **홈(경로) 화면** — 상단: 🔥스트릭 · ⚡XP · ❤️하트, 일일 목표 바 / 본문: 유닛별 레슨 동그라미 경로 / 하단: 복습하기 버튼
2. **레슨 화면** — 상단: 나가기 X · 진행 바 · 하트 / 중앙: 문제 / 하단: 확인 버튼 → 정답(초록)/오답(빨강) 피드백 배너
3. **완료 화면** — 획득 XP, 정확도, 스트릭 갱신 표시
4. **실패 화면** — 하트 소진 시. 복습으로 하트 회복 유도

## 4. 데이터 설계
- 학습 항목: `{id, jp, read(로마자), ko(뜻)}` — 히라가나 46자 + 단어 약 25개 내장
- 저장 상태(`localStorage["nihongo-v1"]`): `{xp, streak, lastStudy, hearts, heartsAt, xpToday, xpTodayDate, dailyGoal, done(레슨 완료 맵), items(문항별 SRS 상태)}`
- SRS 간격: 강도 1→10분, 2→1일, 3→3일, 4→7일, 5→30일. 오답 시 강도 -2 (최소 0)

## 5. 개발·테스트 순서
1. 계획 문서 작성 (이 파일) ✅
2. `nihongo.html` 구현 — 데이터 → 상태/저장 → 경로 화면 → 문제 5종 → 하트/XP/스트릭 → SRS 복습
3. `index.html`에 앱 링크 추가
4. **Playwright 자동 E2E 테스트** (`tests/nihongo.e2e.mjs`)
   - 첫 로드: 경로 화면, 첫 레슨만 열림
   - 레슨 전체를 정답으로 완주 → 완료 화면·XP·스트릭 확인
   - 새로고침 후 진행 상황 유지 확인
   - 오답 → 하트 감소, 하트 소진 → 실패 화면
   - 유닛 1의 레슨 3개 완료 → 유닛 2 잠금 해제
   - 복습 모드 진입·완주 → 하트 +1
5. 테스트가 전부 통과할 때까지 수정 반복 → 커밋·푸시

## 참고 자료
- [Duolingo 101: How to learn a language on Duolingo](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)
- [How we invented a new way to teach Japanese (Duolingo Blog)](https://blog.duolingo.com/how-we-invented-a-new-way-to-teach-one-of-the-most-difficult-languages-to-learn/)
- [A new tool for learning to read Japanese on Duolingo](https://blog.duolingo.com/learning-to-read-japanese-characters/)
- [Duolingo Gamification Strategy: A Full Case Study](https://trophy.so/blog/duolingo-gamification-case-study)
- [The Psychology Behind Duolingo's Streak Feature](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature)
- [Duolingo Wiki: Japanese](https://duolingo.fandom.com/wiki/Japanese)
