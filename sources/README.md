# 원곡 대조용 공개 악보 원본 (`sources/`)

클래식 악보집을 편곡하는 세션이 원곡의 정확한 음을 확인할 수 있도록, 저작권이 끝난 악보의 **원본 파일을 그대로** 모아 둔 곳입니다. 편곡이나 수정은 하지 않았고, 파일 이름도 받은 그대로입니다. 이 브랜치(`claude/pd-sources`)는 참고 자료용이며 main에 머지하지 않습니다.

- 받은 날: 2026-11-21
- 받은 날: 2026-11-21 (바흐 13곡은 1차, BWV 147과 나머지 작곡가 10명은 2차)
- Mutopia의 `.ly`는 LilyPond 텍스트 악보이고 `.mid`는 같은 악보에서 만든 MIDI입니다. 여러 파일이 zip으로 제공된 곡은 압축을 풀어 두었습니다(내용은 동일).
- Mutopia에서는 PDF를 받지 않았습니다. IMSLP는 대부분 PDF(옛 판본 스캔)라서 PDF로 받았습니다. 5 MB가 넘는 파일은 받지 않았습니다.
- CC BY-SA 파일은 출처 표시와 같은 조건 공유가 필요합니다. 우리 악보집의 편곡은 음을 대조하는 데만 쓰고 이 파일을 복사해 넣지 않습니다.
- IMSLP 판본은 **편집자가 1962년 이전에 사망한 옛 판본**(브라이트코프 전집 등)이나 편집자가 CC로 공개한 판을 골랐습니다. 저작권이 남은 우르텍스트(헨레, 베렌라이터, 할레 헨델 전집 등)는 받지 않았습니다.
- PDF 스캔은 `tools/score2abc/`(Audiveris)로 ABC로 바꿔 대조할 수 있습니다.
## 바흐 (`sources/bach/`)

| # | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|
| 1 | 미뉴에트 G장조 BWV Anh. 114 (페촐트, 안나 막달레나 노트 1725) | Mutopia (원본: Bach-Gesellschaft) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75 | `01-minuet-g-anh114/` — https://www.mutopiaproject.org/ftp/BachJS/BWVAnh114/anna-magdalena-04/anna-magdalena-04.ly , .mid | Public Domain | 찾음 |
| 3 | 뮈제트 D장조 BWV Anh. 126 | Mutopia (원본: Bach-Gesellschaft) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79 | `03-musette-d-anh126/` — https://www.mutopiaproject.org/ftp/BachJS/BWVAnh126/anna-magdalena-22/anna-magdalena-22.ly , .mid | Public Domain | 찾음 |
| 4 | 작은 전주곡 C장조 BWV 939 | Mutopia (원본: Bach-Gesellschaft Band 36, Ernst Naumann 1890) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1593 | `04-little-prelude-c-bwv939/` — https://www.mutopiaproject.org/ftp/BachJS/BWV939/bwv-939/bwv-939.ly , .mid | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| 5 | 2성 인벤션 1번 C장조 BWV 772 | Mutopia (원본: Bach-Gesellschaft) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=40 | `05-invention-01-c-bwv772/` — https://www.mutopiaproject.org/ftp/BachJS/BWV772/bach-invention-01/bach-invention-01.ly , .mid | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| 6 | 2성 인벤션 8번 F장조 BWV 779 | Mutopia (원본: Bach-Gesellschaft) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=61 | `06-invention-08-f-bwv779/` — https://www.mutopiaproject.org/ftp/BachJS/BWV779/bach-invention-08/bach-invention-08.ly , .mid | Public Domain | 찾음 |
| 7 | 2성 인벤션 13번 A단조 BWV 784 | Mutopia (원본: Bach-Gesellschaft) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=59 | `07-invention-13-am-bwv784/` — https://www.mutopiaproject.org/ftp/BachJS/BWV784/bach-invention-13/bach-invention-13.ly , .mid | Public Domain | 찾음 |
| 8 | 평균율 1권 전주곡 1번 C장조 BWV 846 | Mutopia (원본: Unknown) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5 | `08-wtc1-prelude-01-c-bwv846/` — https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/wtk1-prelude1.ly , .mid | Public Domain | 찾음 (전주곡만) |
| 9 | 평균율 1권 전주곡 2번 C단조 BWV 847 | Mutopia (원본: Breitkopf & Hartel, 1866) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=550 | `09-wtc1-prelude-02-cm-bwv847/` — https://www.mutopiaproject.org/ftp/BachJS/BWV847/bwv847a/bwv847a.ly , .mid | Public Domain | 찾음 (전주곡만) |
| 10 | 프랑스 모음곡 5번 G장조 BWV 816 — 가보트 | Mutopia (원본: Unknown) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=99 | `10-french-suite-5-g-bwv816/` — https://www.mutopiaproject.org/ftp/BachJS/BWV816/french-suite-5/french-suite-5-lys.zip , french-suite-5-mids.zip (풀어 둠). 가보트는 `french-suite-5-lys/french-suite-5-gavotte.ly`, `french-suite-5-gavotte.mid` | Public Domain | 찾음 (모음곡 전체가 들어 있음) |
| 11 | 골드베르크 변주곡 BWV 988 — 아리아 | Mutopia (원본: Bach-Gesellschaft) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=979 | `11-goldberg-aria-bwv988/` — https://www.mutopiaproject.org/ftp/BachJS/BWV988/bwv-988-aria/bwv-988-aria.ly , .mid | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| 12 | 이탈리아 협주곡 BWV 971 — 1악장 | Mutopia (원본: Leipzig: Breitkopf & Härtel, 1853. Plate B.W. III.) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1826 | `12-italian-concerto-bwv971/` — https://www.mutopiaproject.org/ftp/BachJS/BWV971/piano/piano-lys.zip , piano-mids.zip (풀어 둠). 악보는 `piano-lys/piano.ly`(+ `piano.ily` 등 include 파일), 3악장이 모두 들어 있음(`\score` 3개). MIDI는 `piano.mid`, `piano-1.mid`, `piano-2.mid` | Creative Commons Attribution-ShareAlike 3.0 | 찾음 (전 악장) |
| 13 | 관현악 모음곡 3번 BWV 1068 — 아리아(Air) | Mutopia (원본: Bach-Gesellschaft), **현악 원편성 총보** | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=242 | `13-air-orchestral-suite-3-bwv1068/` — https://www.mutopiaproject.org/ftp/BachJS/BWV1068/bach-air/bach-air-lys.zip , bach-air-mids.zip (풀어 둠), bach-air-jlh-35.mid, bach-air-jlh-70.mid, bach-air-jlh-40-organ.mid. 음은 `bach-air-lys/bach-air-notes.ly`, 총보는 `bach-air-score.ly` | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| 14 | 칸타타 BWV 147 — 코랄 「Jesus bleibet meine Freude」 (6번 「Wohl mir」과 10번 「Jesus bleibet」) | IMSLP (Mutopia에는 없음) | https://imslp.org/wiki/Herz_und_Mund_und_Tat_und_Leben,_BWV_147_(Bach,_Johann_Sebastian) | `14-jesu-joy-bwv147/` — #563035 MuseScore 파일 `IMSLP563035-PMLP149942-BWV147-6-Choral.mscz` (압축된 MusicXML 계열이라 음을 텍스트로 읽을 수 있음), #563034 총보 PDF `IMSLP563034-PMLP149942-BWV147-6-Choral.pdf`. 편집 Vladimír Váša, 2018, 자필 악보(Mus. ms. Bach P 102)에서 옮김 | Creative Commons Attribution 4.0 | 찾음 (2차 작업에서 받음) |
| 15 | 토카타와 푸가 D단조 BWV 565 — 토카타 | Mutopia (원본: Bach-Gesellschaft Ausgabe, 1867), 오르간 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1780 | `15-toccata-fugue-dm-bwv565/` — https://www.mutopiaproject.org/ftp/BachJS/BWV565/ToccataFugue/ToccataFugue.ly , .mid | Public Domain | 찾음 (토카타와 푸가 전체, 앞부분이 토카타) |

### 참고

- 1번 미뉴에트: 왼손 확인용입니다. Mutopia에는 같은 곡의 기타·트럼펫 편곡(id=102, 695, 258)과 현악 편곡(id=1619)도 있지만, 건반 원본인 id=75만 받았습니다.
- 13번 Air: 플루트·기타(id=1534), 트롬본 4중주(id=461) 편곡도 있지만 원편성 총보인 id=242를 골랐습니다.
- 14번 IMSLP의 #01405는 목록 분석에서 출판 정보가 "Bach-Gesellschaft Ausgabe"로 잡혔으나, 페이지 구조상 옆 항목 정보가 섞였을 수 있어 받을 때 한 번 더 확인해야 합니다.

## 모차르트 (`sources/mozart/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-minuet-g-k1/` | 미뉴에트 G장조 K.1 | IMSLP | https://imslp.org/wiki/Minuet_in_G_major%2C_K.1/1e_%28Mozart%2C_Wolfgang_Amadeus%29 | #56676 Complete Score ( Preview ) (0.55MB, 4 pp.) — IMSLP56676-PMLP116885-Mozart_Werke_Breitkopf_Serie_22_KV1.pdf | 편집 First edition Series XXII editors (exact editor not specified) Otto Goldschmidt (1829-1907) Joseph Joachim (1831-1907) Carl Reinecke (1824-1910) Ernst Rudorf | Public Domain | 찾음 |
| `02-minuet-f-k2/` | 미뉴에트 F장조 K.2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1770 | menuet_k2.ly, menuet_k2.mid | Leipzig | Public Domain | 찾음 |
| `03-twinkle-variations-k265/` | 「아, 어머님께 말씀드리죠」 변주곡 K.265 | IMSLP | https://imslp.org/wiki/12_Variations_on_%27Ah%2C_vous_dirai-je_maman%27%2C_K.265/300e_%28Mozart%2C_Wolfgang_Amadeus%29 | #24784 Complete Score (1.04MB, 8 pp.) — IMSLP24784-PMLP55775-Mozart_12_Variations_K.265.pdf | 편집 Series XXI editors (exact editor not specified) Otto Goldschmidt (1829-1907) Joseph Joachim (1831-1907) Carl Reinecke (1824-1910) Ernst Rudorff (1840-1916) P | Public Domain | 찾음 |
| `04-ave-verum-corpus-k618/` | 아베 베룸 코르푸스 K.618 | IMSLP | https://imslp.org/wiki/Ave_verum_corpus%2C_K.618_%28Mozart%2C_Wolfgang_Amadeus%29 | #78492 Complete Score (0.55MB, 2 pp.) — IMSLP78492-PMLP14118-Mozart_Werke_Breitkopf_Serie_03_KV618.pdf | 편집 Gustav Nottebohm (1817–1882); Mozarts Werke , Serie III, Bd.2, No.31 (pp.123-24) Leipzig: Breitkopf & Härtel , 1880. Plate W.A.M. 618. | Public Domain | 찾음 |
| `05-sonata-a-k331/` | 피아노 소나타 A장조 K.331 (주제, 미뉴에트, 터키 행진곡) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=614 | KV331_1_1_tema.ly, KV331_1_1_tema.mid | Breitkopf & Hartel, Leipzig | Public Domain | 찾음 |
| `05-sonata-a-k331/` | 피아노 소나타 A장조 K.331 (주제, 미뉴에트, 터키 행진곡) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=613 | KV331_2_1_menuetto.ly, KV331_2_1_menuetto.mid | Breitkopf & Hartel, Leipzig | Public Domain | 찾음 |
| `05-sonata-a-k331/` | 피아노 소나타 A장조 K.331 (주제, 미뉴에트, 터키 행진곡) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108 | KV331_3_RondoAllaTurca-lys.zip, KV331_3_RondoAllaTurca.mid | IMSLP | Public Domain | 찾음 |
| `06-fantasia-dm-k397/` | 환상곡 D단조 K.397 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2034 | Fantasia.ly, Fantasia.mid | 'Mozart Album | Public Domain | 찾음 |
| `07-eine-kleine-nachtmusik-k525/` | 아이네 클라이네 나흐트무지크 K.525 (현악 원편성) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2230 | MozartWA-KV525-lys.zip, MozartWA-KV525-mids.zip | Breitkopf & Härtel, 1883 | Public Domain | 찾음 |
| `07-eine-kleine-nachtmusik-k525/` | 아이네 클라이네 나흐트무지크 K.525 (현악 원편성) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=900 | eine-kleine-nachtmusik-mvt1-lys.zip, eine-kleine-nachtmusik-mvt1.mid | http | Public Domain | 찾음 |
| `08-sonata-c-k545/` | 피아노 소나타 C장조 K.545 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998 | K545-1.ly, K545-1.mid | IMSLP | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `08-sonata-c-k545/` | 피아노 소나타 C장조 K.545 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1007 | K545-2.ly, K545-2.mid | IMSLP | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `08-sonata-c-k545/` | 피아노 소나타 C장조 K.545 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1027 | K545-3.ly, K545-3.mid | IMSLP | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `09-symphony-40-k550/` | 교향곡 40번 G단조 K.550 | IMSLP | https://imslp.org/wiki/Symphony_No.40_in_G_minor%2C_K.550_%28Mozart%2C_Wolfgang_Amadeus%29 | #00072 Complete Score (4.35MB, 49 pp.) — IMSLP00072-Mozart_-_Symphony_No_40_in_G_minor,_K550.pdf | 편집 Series VIII editors (exact editor not specified) Gustav Nottebohm , Carl Reinecke , Paul Waldersee; Mozarts Werke , Serie VIII: Symphonien, Bd.3, No.40 (pp.1 | Public Domain | 찾음 |

## 베토벤 (`sources/beethoven/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-fur-elise-woo59/` | 엘리제를 위하여 WoO 59 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931 | fur_Elise_WoO59.ly, fur_Elise_WoO59.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `01-fur-elise-woo59/` | 엘리제를 위하여 WoO 59 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2059 | fur-elise-guitar-duo.ly, fur-elise-guitar-duo.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `02-sonatina-g-anh5/` | 소나티나 G장조 Anh.5-1 | IMSLP | https://imslp.org/wiki/2_Sonatinas_for_Piano%2C_Anh.5_%28Beethoven%2C_Ludwig_van%29 | #51816 1. Sonatina in G major ( Preview ) (0.20MB, 2 pp.) — IMSLP51816-PMLP96125-Beethoven_Werke_Breitkopf_Serie_16_No_160_Zwei_Leichte_Sonaten_No_1_in_G.pdf | Ludwig van Beethovens Werke , Serie 16: Sonaten für das Pianoforte (pp.183-88), No.160 Leipzig: Breitkopf und Härtel , n.d.[1862-90]. Plate B.160. | Public Domain | 찾음 |
| `04-sonata-19-gm-op49-1/` | 피아노 소나타 19번 G단조 Op.49-1 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=912 | LVB_Sonate_49no1_1.ly, LVB_Sonate_49no1_1.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `04-sonata-19-gm-op49-1/` | 피아노 소나타 19번 G단조 Op.49-1 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=913 | LVB_Sonate_49no1_2.ly, LVB_Sonate_49no1_2.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `05-sonata-20-g-op49-2/` | 피아노 소나타 20번 G장조 Op.49-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=776 | LVB_Sonate_49no2_1.ly, LVB_Sonate_49no2_1.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `05-sonata-20-g-op49-2/` | 피아노 소나타 20번 G장조 Op.49-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=777 | LVB_Sonate_49no2_2.ly, LVB_Sonate_49no2_2.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `06-sonata-25-g-op79/` | 피아노 소나타 25번 G장조 Op.79 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=955 | LVB_Sonate_79_1.ly, LVB_Sonate_79_1.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `06-sonata-25-g-op79/` | 피아노 소나타 25번 G장조 Op.79 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=956 | LVB_Sonate_79_2.ly, LVB_Sonate_79_2.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `06-sonata-25-g-op79/` | 피아노 소나타 25번 G장조 Op.79 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=957 | LVB_Sonate_79_3.ly, LVB_Sonate_79_3.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `07-sonata-08-pathetique-op13/` | 피아노 소나타 8번 「비창」 Op.13 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=299 | pathetique-1.ly, pathetique-1.mid | G. Schirmer, 1894 and Berners, 1908 | Public Domain | 찾음 |
| `07-sonata-08-pathetique-op13/` | 피아노 소나타 8번 「비창」 Op.13 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2064 | pathetique-2-guitar-duo.ly, pathetique-2-guitar-duo.mid | Berners, 1908 (edited by A. Winterberger); Peters, 1910 | Public Domain | 찾음 |
| `07-sonata-08-pathetique-op13/` | 피아노 소나타 8번 「비창」 Op.13 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295 | pathetique-2.ly, pathetique-2.mid | Berners, 1908 (edited by A. Winterberger); Peters, 1910 | Public Domain | 찾음 |
| `07-sonata-08-pathetique-op13/` | 피아노 소나타 8번 「비창」 Op.13 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=296 | pathetique-3.ly, pathetique-3.mid | Berners, 1908 (edited by A. Winterberger) | Public Domain | 찾음 |
| `08-sonata-14-moonlight-op27-2/` | 피아노 소나타 14번 「월광」 Op.27-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276 | moonlight-lys.zip, moonlight-mids.zip | Berners, 1908 (edited by A. Winterberger) | Creative Commons Attribution-ShareAlike 2.5 | 찾음 |
| `08-sonata-14-moonlight-op27-2/` | 피아노 소나타 14번 「월광」 Op.27-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2101 | moonlight-guitar-duo.ly, moonlight-guitar-duo.mid | Madrid | Public Domain | 찾음 |
| `09-sonata-17-tempest-op31-2/` | 피아노 소나타 17번 「템페스트」 Op.31-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1509 | LVB_Sonate_31no2_1.ly, LVB_Sonate_31no2_1.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `09-sonata-17-tempest-op31-2/` | 피아노 소나타 17번 「템페스트」 Op.31-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1510 | LVB_Sonate_31no2_2.ly, LVB_Sonate_31no2_2.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |
| `10-symphony-5-op67-mvt1/` | 교향곡 5번 Op.67 1악장 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=941 | Symphony5_1-lys.zip, Symphony5_1.mid | Breitkopf and Härtel (1862-1865) | Public Domain | 찾음 |
| `10-symphony-5-op67-mvt1/` | 교향곡 5번 Op.67 1악장 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2202 | sym5-1-guitar-duo.ly, sym5-1-guitar-duo.mid | Leipzig | Public Domain | 찾음 |
| `10-symphony-5-op67-mvt1/` | 교향곡 5번 Op.67 1악장 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=497 | beethoven_fifth_op67-lys.zip, beethoven_fifth_op67.mid | Augener's Edition | Public Domain | 찾음 |
| `11-minuet-woo82/` | 미뉴에트 E♭장조 WoO 82 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=904 | menuett_WoO82.ly, menuett_WoO82.mid | Breitkopf & Hartel (1862-1865) | Public Domain | 찾음 |

## 비발디 (`sources/vivaldi/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-spring-rv269/` | 사계 「봄」 RV 269 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=301 | spring-lys.zip, spring-mids.zip | Performers' Facsimiles | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `02-summer-rv315/` | 사계 「여름」 RV 315 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=336 | summer-lys.zip, summer-mids.zip | Performers' Facsimiles | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `03-autumn-rv293/` | 사계 「가을」 RV 293 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=350 | autumn-lys.zip, autumn-mids.zip | Performers' Facsimiles | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `04-winter-rv297/` | 사계 「겨울」 RV 297 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=351 | winter-lys.zip, winter-mids.zip | Performers' Facsimiles | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |

## 헨델 (`sources/handel/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-sonatina-bb/` | 소나티나 B♭장조 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=98 | sonatina-in-b-flat-major.ly, sonatina-in-b-flat-major.mid | Handel's Werke (1859) | Public Domain | 찾음 |
| `02-suite-dm-hwv437-sarabande/` | 모음곡 D단조 HWV 437 — 사라반드 | IMSLP | https://imslp.org/wiki/Suite_in_D_minor%2C_HWV_437_%28Handel%2C_George_Frideric%29 | #402661 Complete Score (scan) ( Preview ) (0.33MB, 3 pp.) — IMSLP402661-PMLP126189-Handel,_Georg_Friedrich-Werke_2_13_HWV_437_scan.pdf | 편집 Friedrich Chrysander (1826–1901); Georg Friedrich Händels Werke . Band 2 Leipzig: Deutsche Händelgesellschaft , 1858. Plate H.W. 2. | Public Domain | 찾음 |
| `03-suite-e-hwv430-harmonious-blacksmith/` | 모음곡 E장조 HWV 430 — 「조화로운 대장장이」 | IMSLP | https://imslp.org/wiki/Suite_in_E_major%2C_HWV_430_%28Handel%2C_George_Frideric%29 | #397790 Complete Score (scan) ( Preview ) (0.78MB, 7 pp.) — IMSLP397790-PMLP29686-Handel,_Georg_Friedrich-Werke_2_05_HWV_430_scan.pdf | 편집 Friedrich Chrysander (1826-1901); Georg Friedrich Händels Werke . Band 2 Leipzig: Deutsche Händelgesellschaft , 1858. Plate H.W. 2. | Public Domain | 찾음 |
| `04-suite-gm-hwv432-passacaglia/` | 모음곡 G단조 HWV 432 — 파사칼리아 | IMSLP | https://imslp.org/wiki/Suite_in_G_minor%2C_HWV_432_%28Handel%2C_George_Frideric%29 | #397792 Complete Score (scan) ( Preview ) (0.94MB, 9 pp.) — IMSLP397792-PMLP29691-Handel,_Georg_Friedrich-Werke_2_07_HWV_432_scan.pdf | 편집 Friedrich Chrysander (1826–1901); Georg Friedrich Händels Werke . Band 2 Leipzig: Deutsche Händelgesellschaft , 1858. Plate H.W. 2. | Public Domain | 찾음 |
| `05-hallelujah-hwv56/` | 메시아 HWV 56 — 할렐루야 합창 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=459 | hallelujah-lys.zip, hallelujah-mids.zip | Unknown | Public Domain | 찾음 |
| `05-hallelujah-hwv56/` | 메시아 HWV 56 — 할렐루야 합창 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1732 | Messiah-lys.zip, Messiah-mids.zip | Leipzig, Friedrich Chrysander, Deutschen Handelgesellschaft edition, volume 45, 1902 | Creative Commons Attribution 3.0 | 찾음 |
| `06-royal-fireworks-rejouissance-hwv351/` | 왕궁의 불꽃놀이 HWV 351 — 레주이상스 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1864 | LaRej.ly, LaRej.mid | IMSLP | Public Domain | 찾음 |
| `07-serse-hwv40-ombra-mai-fu/` | 오페라 「세르세」 HWV 40 — 「옴브라 마이 푸」 | IMSLP | https://imslp.org/wiki/Serse%2C_HWV_40_%28Handel%2C_George_Frideric%29 | #146806 Complete Score (F major) (0.18MB, 3 pp.) — IMSLP146806-PMLP24130-Handel_-_Serse_-_Ombra_mai_fu_EnItVS_Sibley.1802.16201.pdf | 편집 Ebenezer Prout (1835–1909); Songs and Airs of G.F. Handel, Vol.I (pp.72-74) Boston: Oliver Ditson Co. , 1905. Plate ML-1090-3. | Public Domain | 찾음 |
| `08-rinaldo-hwv7-lascia-chio-pianga/` | 오페라 「리날도」 HWV 7a — 「울게 하소서」 | IMSLP | https://imslp.org/wiki/Rinaldo%2C_HWV_7a_%28Handel%2C_George_Frideric%29 | #146797 Complete Score (0.39MB, 6 pp.) — IMSLP146797-PMLP44810-Handel_-_Rinaldo_-_Cara_sposa_EnItVS_Sibley.1802.16201.pdf | 편집 Ebenezer Prout (1835–1909); Songs and Airs of G.F. Handel, Vol.I (pp.1-6) Boston: Oliver Ditson Co. , 1905. Plate ML-ML-1077-6. | Public Domain | 찾음 |

## 하이든 (`sources/haydn/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-sonata-g-hob16-27/` | 피아노 소나타 G장조 Hob. XVI:27 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=185 | hob-xvi-27-i-allegro-con-brio.ly, hob-xvi-27-i-allegro-con-brio.mid | C. F. Peters, 1880s | Public Domain | 찾음 |
| `02-sonata-eb-hob16-28/` | 피아노 소나타 E♭장조 Hob. XVI:28 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=210 | hob-xvi-28-i-allegro-moderato.ly, hob-xvi-28-i-allegro-moderato.mid | C. F. Peters, 1880s | Public Domain | 찾음 |
| `03-sonata-c-hob16-35/` | 피아노 소나타 C장조 Hob. XVI:35 | IMSLP | https://imslp.org/wiki/Keyboard_Sonata_in_C_major%2C_Hob.XVI%3A35_%28Haydn%2C_Joseph%29 | #472034 Complete Score (1.04MB, 10 pp.) — IMSLP472034-PMLP01715-266_IMSLP463088-PMLP751942-sonatas.pdf | 편집 Karl Päsler (1863–1942); Haydns Werke, Serie XIV : Klavierwerke: Sonaten , Bd.2 Leipzig: Breitkopf und Härtel , 1918. Plate J.H. XIV:35. | Public Domain | 찾음 |
| `04-sonata-d-hob16-37/` | 피아노 소나타 D장조 Hob. XVI:37 | IMSLP | https://imslp.org/wiki/Keyboard_Sonata_in_D_major%2C_Hob.XVI%3A37_%28Haydn%2C_Joseph%29 | #472036 Complete Score (0.90MB, 8 pp.) — IMSLP472036-PMLP01717-284_IMSLP463088-PMLP751942-sonatas.pdf | 편집 Karl Päsler (1863-1942); Haydns Werke, Serie XIV : Klavierwerke: Sonaten , Bd.2 Leipzig: Breitkopf und Härtel , 1918. Plate J.H. XIV:37. | Public Domain | 찾음 |
| `05-emperor-quartet-op76-3/` | 현악 4중주 「황제」 Op.76-3 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=385 | op76-n3-lys.zip, op76-n3-mids.zip | Kalmus | Public Domain | 찾음 |
| `06-austria-hymn/` | 오스트리아 국가(황제 찬가) 가곡판 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=522 | Austria.ly, Austria.mid | Book of Common Praise, 1908, number 280 | Public Domain | 찾음 |

## 슈베르트 (`sources/schubert/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-heidenroslein-d257/` | 들장미 D.257 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1555 | SchubertF-D257-Heidenroeslein.ly, SchubertF-D257-Heidenroeslein.mid | Breitkopf & Härtel (1884-1897) | Public Domain | 찾음 |
| `02-die-forelle-d550/` | 송어 D.550 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=502 | forelle-lys.zip, forelle.mid | C.F. Peters (Band I) | Public Domain | 찾음 |
| `03-wiegenlied-d498/` | 자장가 D.498 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1040 | schubert_wiegen_lied.ly, schubert_wiegen_lied.mid | Indiana Edu. Web | Public Domain | 찾음 |
| `04-an-die-musik-d547/` | 음악에 부쳐 D.547 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1001 | AnDieMusik.ly, AnDieMusik.mid | C.F. Peters (Band I) | Public Domain | 찾음 |
| `05-erlkonig-d328/` | 마왕 D.328 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1030 | Erlkoenig.ly, Erlkoenig.mid | C.F. Peters (Band I) | Public Domain | 찾음 |
| `06-ave-maria-d839/` | 아베 마리아 D.839 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1054 | SchubertF-D839_AveMaria.ly, SchubertF-D839_AveMaria.mid | C.F. Peters (Band I) | Public Domain | 찾음 |
| `07-moment-musical-3-d780/` | 악흥의 순간 3번 D.780 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023 | MomentsNo3.ly, MomentsNo3.mid | Sauer & Leidersdorf, Wien, 1827 | Public Domain | 찾음 |
| `08-impromptus-d899/` | 즉흥곡 D.899 (1~4번) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1192 | SchubertF-D899-1-Impromptu.ly, SchubertF-D899-1-Impromptu.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `08-impromptus-d899/` | 즉흥곡 D.899 (1~4번) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1551 | SchubertF-D899-2-Impromptu.ly, SchubertF-D899-2-Impromptu.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `08-impromptus-d899/` | 즉흥곡 D.899 (1~4번) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1193 | SchubertF-D899-3-Impromptu.ly, SchubertF-D899-3-Impromptu.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `08-impromptus-d899/` | 즉흥곡 D.899 (1~4번) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1552 | SchubertF-D899-4-Impromptu.ly, SchubertF-D899-4-Impromptu.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `09-impromptu-d935-2/` | 즉흥곡 A♭장조 D.935-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1195 | SchubertF-D935-2-Impromptu.ly, SchubertF-D935-2-Impromptu.mid | Breitkopf & Härtel, 1888 | Public Domain | 찾음 |
| `10-marche-militaire-d733/` | 군대 행진곡 D.733 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1545 | SchubertF-D733-1-TroisMarches.ly, SchubertF-D733-1-TroisMarches.mid | Breitkopf & Härtel | Public Domain | 찾음 |
| `12-symphony-8-unfinished-d759/` | 교향곡 8번 「미완성」 D.759 | IMSLP | https://imslp.org/wiki/Symphony_No.8%2C_D.759_%28Schubert%2C_Franz%29 | #310948 Complete Score (rehearsal letters, bar numbers) (2.96MB, 32 pp.) — IMSLP310948-PMLP05477-Schubert_Sinfonie_Nr._8_h-moll_Partitur_2.pdf | 편집 Johannes Brahms (1833–1897); Franz Schubert's Werke , Serie I, No.8 (pp.239-60) Leipzig: Breitkopf & Härtel , 1885. Plate F.S. 8. | Public Domain | 찾음 |

## 쇼팽 (`sources/chopin/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-prelude-op28-7/` | 전주곡 Op.28-7 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=470 | Chop-28-7-lys.zip, Chop-28-7.mid | Edition Peters | Public Domain | 찾음 |
| `02-prelude-op28-4/` | 전주곡 Op.28-4 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468 | Chop-28-4.ly, Chop-28-4.mid | Peters, 1879 | Public Domain | 찾음 |
| `02-prelude-op28-4/` | 전주곡 Op.28-4 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=921 | Chop-28-4a-lys.zip, Chop-28-4a.mid | Peters, Herrmann Scholtz, 1900b | Public Domain | 찾음 |
| `03-prelude-op28-20/` | 전주곡 Op.28-20 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472 | Chop-28-20.ly, Chop-28-20.mid | Edition Peters | Public Domain | 찾음 |
| `04-prelude-op28-15-raindrop/` | 전주곡 Op.28-15 「빗방울」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=471 | Chop-28-15-lys.zip, Chop-28-15.mid | Edition Peters | Public Domain | 찾음 |
| `05-waltz-op69-2/` | 왈츠 B단조 Op.69-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=511 | w10-h-moll-cfi.ly, w10-h-moll-cfi.mid | Peters, Herrmann Scholtz, 1900a | Public Domain | 찾음 |
| `06-nocturne-op9-2/` | 녹턴 E♭장조 Op.9-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590 | chopin_nocturne_op9_n2.ly, chopin_nocturne_op9_n2.mid | G. Schirmer, New York, 1881 | Creative Commons Attribution-ShareAlike 3.0 | 찾음 |
| `07-nocturne-em-op72-1/` | 녹턴 E단조 Op.72-1 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=509 | nocturne_in_e_minor.ly, nocturne_in_e_minor.mid | Schirmer, 1915 | Creative Commons Attribution-ShareAlike 4.0 | 찾음 |
| `08-minute-waltz-op64-1/` | 왈츠 「강아지」 Op.64-1 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483 | chopin_valse_op64_no1-lys.zip, chopin_valse_op64_no1.mid | Edition Peters | Public Domain | 찾음 |
| `09-fantaisie-impromptu-op66/` | 즉흥 환상곡 Op.66 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693 | chopin_fantaisie-impromptu.ly, chopin_fantaisie-impromptu.mid | Herrmann Scholtz (1845-1918) | Public Domain | 찾음 |
| `10-etude-op10-3/` | 에튀드 Op.10-3 「이별」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=914 | chp-10-01-lys.zip, chp-10-01.mid | Peters, Herrmann Scholtz, 1900b | Public Domain | 찾음 |
| `11-ballade-1-op23/` | 발라드 1번 Op.23 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959 | chopin-op23-ballade-1-lys.zip, chopin-op23-ballade-1.mid | Klindworth; Bote & Bock,n.d.[1880] | Creative Commons Attribution-ShareAlike 4.0 | 찾음 |
| `12-nocturne-csm-b49/` | 녹턴 C#단조 B.49 (유작) | IMSLP | https://imslp.org/wiki/Nocturne_in_C-sharp_minor%2C_B.49_%28Chopin%2C_Fr%C3%A9d%C3%A9ric%29 | #1005676 Complete Score (0.63MB, 3 pp.) — IMSLP1005676-PMLP3848-chopin_nocturne_c-sharp-minor_fe.pdf | 편집 Marceli Antoni Szulc (1818–1898) First edition; 3 Mazury i adagio , No.4 (pp.9-11) Leipzig: W. Benicke , 1875. Plate M. L. 18. | Public Domain | 찾음 |
| `13-waltz-am-b150/` | 왈츠 A단조 B.150 (유작) | IMSLP | https://imslp.org/wiki/Waltz_in_A_minor%2C_B.150_%28Chopin%2C_Fr%C3%A9d%C3%A9ric%29 | #968535 Complete Score (0.07MB, 2 pp.) — IMSLP968535-PMLP113759-Waltz_in_a_minor.pdf | 편집 Rain Zhang; Rain Zhang, 2025. | Creative Commons Zero 1.0 | 찾음 |
| `13-waltz-am-b150/` | 왈츠 A단조 B.150 (유작) | IMSLP | https://imslp.org/wiki/Waltz_in_A_minor%2C_B.150_%28Chopin%2C_Fr%C3%A9d%C3%A9ric%29 | #127863 Complete Score (0.09MB, 3 pp.) — IMSLP127863-WIMA.7bce-Chopin_Waltz_Aminor_posth.pdf | 편집 Pierre Gouin (b. 1947) - Contact; Montréal: Les Éditions Outremontaises, 2006. | Creative Commons Attribution-ShareAlike 4.0 | 찾음 |
| `14-mazurkas-op7/` | 마주르카 Op.7 (1번 B♭장조) | IMSLP | https://imslp.org/wiki/Mazurkas%2C_Op.7_%28Chopin%2C_Fr%C3%A9d%C3%A9ric%29 | #113860 Complete Score (0.83MB, 8 pp.) — IMSLP113860-PMLP02289-FChopin_Mazurkas,_Op.7_BH3.pdf | 편집 Series editors; Friedrich Chopin's Werke . Band III (pp.8-15) Leipzig: Breitkopf und Härtel , n.d. [1880] . Plate C. III. 5–9. | Public Domain | 찾음 |
| `14-mazurkas-op7/` | 마주르카 Op.7 (1번 B♭장조) | IMSLP | https://imslp.org/wiki/Mazurkas%2C_Op.7_%28Chopin%2C_Fr%C3%A9d%C3%A9ric%29 | #702839 Engraving files (LilyPond) (0.40MB, ? pp.) — IMSLP702839-PMLP2289-Frederic-Chopin-Five-Mazurkas-Op7.zip | 편집 Knute Snortum (b. 1960); Knute Snortum, 2021. | Creative Commons Attribution-ShareAlike 4.0 | 찾음 |
| `15-polonaise-op53/` | 폴로네즈 「영웅」 Op.53 | IMSLP | https://imslp.org/wiki/Polonaise_in_A-flat_major%2C_Op.53_%28Chopin%2C_Fr%C3%A9d%C3%A9ric%29 | #114194 Complete Score (1.23MB, 10 pp.) — IMSLP114194-PMLP02334-FChopin_Polonaise,_Op.53_BH5.pdf | 편집 Series editors; Friedrich Chopin's Werke . Band V Leipzig: Breitkopf und Härtel , n.d.[1878]. Plate C. V. 6. | Public Domain | 찾음 |

## 슈만 (`sources/schumann/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-album-jugend-melodie-op68-1/` | 어린이를 위한 앨범 Op.68-1 「멜로디」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=647 | schumann-op68-01-melodie.ly, schumann-op68-01-melodie.mid | Peters | Creative Commons Attribution-ShareAlike 2.5 | 찾음 |
| `02-album-jugend-soldatenmarsch-op68-2/` | 어린이를 위한 앨범 Op.68-2 「병정 행진곡」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=650 | schumann-op68-02-marche-militaire.ly, schumann-op68-02-marche-militaire.mid | Peters | Creative Commons Attribution-ShareAlike 2.5 | 찾음 |
| `03-album-jugend-wilder-reiter-op68-8/` | 어린이를 위한 앨범 Op.68-8 「거친 기사」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=655 | schumann-op68-08-cavalier-sauvage.ly, schumann-op68-08-cavalier-sauvage.mid | Peters | Creative Commons Attribution-ShareAlike 2.5 | 찾음 |
| `04-album-jugend-frohlicher-landmann-op68-10/` | 어린이를 위한 앨범 Op.68-10 「즐거운 농부」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=659 | schumann-op68-10-gai-laboureur.ly, schumann-op68-10-gai-laboureur.mid | Peters | Creative Commons Attribution-ShareAlike 2.5 | 찾음 |
| `05-kinderszenen-von-fremden-landern-op15-1/` | 어린이 정경 Op.15-1 「미지의 나라」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=354 | SchumannOp15No01.ly, SchumannOp15No01.mid | Leichte Stucke, 1900 | Public Domain | 찾음 |
| `06-kinderszenen-traumerei-op15-7/` | 어린이 정경 Op.15-7 「트로이메라이」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504 | SchumannOp15No07.ly, SchumannOp15No07.mid | Leichte Stucke, 1900 | Public Domain | 찾음 |
| `07-widmung-op25-1/` | 헌정 Op.25-1 (가곡) | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=588 | schumann-widmung.ly, schumann-widmung.mid | The University Society, 1909 | Public Domain | 찾음 |
| `08-arabeske-op18/` | 아라베스크 Op.18 | IMSLP | https://imslp.org/wiki/Arabeske%2C_Op.18_%28Schumann%2C_Robert%29 | #00709 Complete Score ( Preview ) (0.44MB, 6 pp.) — IMSLP00709-Schumann_-_Arabeske,_Op_18.pdf | 편집 Clara Schumann (1819–1896); Robert Schumanns Werke , Serie VII: Für Pianoforte zu zwei Händen Leipzig: Breitkopf & Härtel , 1887. Plate R.S. 56. | Public Domain | 찾음 |

## 브람스 (`sources/brahms/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-wiegenlied-op49-4/` | 자장가 Op.49-4 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1037 | Wiegenlied-lys.zip, Wiegenlied-mids.zip | Indiana University | Public Domain | 찾음 |
| `02-waltz-op39-15/` | 왈츠 A♭장조 Op.39-15 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=794 | waltz-op39-15.ly, waltz-op39-15.mid | Ed. R. Joseffy | Public Domain | 찾음 |
| `03-hungarian-dances-woo1/` | 헝가리 무곡 WoO 1 (5번) 피아노 독주판 | IMSLP | https://imslp.org/wiki/21_Hungarian_Dances_%28Piano%29%2C_WoO_1_%28Brahms%2C_Johannes%29 | #463304 Complete Score (2.96MB, 42 pp.) — IMSLP463304-PMLP16016-Brahms_danze_ungheresi_Vol_1.pdf | 편집 Sigismondo Cesi (1869–1936); Milan: Ricordi , n.d. Plate E.R. 99. | Public Domain | 찾음 |
| `04-intermezzi-op117/` | 인터메조 Op.117 (1번) | IMSLP | https://imslp.org/wiki/3_Intermezzi%2C_Op.117_%28Brahms%2C_Johannes%29 | #01515 Intermezzo No.1 (0.14MB, 3 pp.) — IMSLP01515-Brahms_intermezzi_op117_1.pdf | 편집 Eusebius Mandyczewski (1857–1929); Sämtliche Werke , Band 14: Kleinere Klavierwerke Leipzig: Breitkopf & Härtel , 1926-27. Plate J.B. 65. | Public Domain | 찾음 |
| `05-intermezzo-op118-2/` | 인터메조 A장조 Op.118-2 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=535 | intermezzo.ly, intermezzo.mid | N. Simrock, 1892 | Public Domain | 찾음 |
| `06-rhapsodies-op79/` | 랩소디 Op.79 (2번) | IMSLP | https://imslp.org/wiki/2_Rhapsodies%2C_Op.79_%28Brahms%2C_Johannes%29 | #16651 Rhapsody No.2 (0.34MB, 7 pp.) — IMSLP16651-Brahms_Op.79_No.2.pdf | 편집 Eusebius Mandyczewski (1857–1929); Sämtliche Werke , Band 14: Kleinere Klavierwerke Leipzig: Breitkopf & Härtel , 1926-27. Plate J.B. 63. | Public Domain | 찾음 |

## 차이코프스키 (`sources/tchaikovsky/`)

| 폴더 | 곡 | 사이트 | 곡 페이지 | 받은 파일 | 원본 판본 | 라이선스 (페이지 표기 그대로) | 상태 |
|---|---|---|---|---|---|---|---|
| `01-album-young-morning-prayer-op39-1/` | 어린이 앨범 Op.39-1 「아침 기도」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2032 | 01MorningPrayer.ly, 01MorningPrayer.mid | Schirmer, 1904 | Public Domain | 찾음 |
| `02-album-young-wooden-soldiers-op39-5/` | 어린이 앨범 Op.39-5 「나무 병정의 행진」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1806 | 05MarchOfTheWoodenSoldiers.ly, 05MarchOfTheWoodenSoldiers.mid | Schirmer, 1904 | Public Domain | 찾음 |
| `03-album-young-old-french-song-op39-16/` | 어린이 앨범 Op.39-16 「옛 프랑스 노래」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080 | 16OldFrenchSong.ly, 16OldFrenchSong.mid | Schirmer, 1904 | Public Domain | 찾음 |
| `04-seasons-january-op37a-1/` | 사계 Op.37a 「1월」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1171 | Tschaikowsky-op37.1.ly, Tschaikowsky-op37.1.mid | Rob. Forberg, Leipzig | Public Domain | 찾음 |
| `05-seasons-february-op37a-2/` | 사계 Op.37a 「2월」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1398 | Tschaikowsky-op37.2.ly, Tschaikowsky-op37.2.mid | Rob. Forberg, Leipzig | Public Domain | 찾음 |
| `06-seasons-op37a/` | 사계 Op.37a (6월 「뱃노래」, 10월 「가을의 노래」 등) | IMSLP | https://imslp.org/wiki/The_Seasons%2C_Op.37a_%28Tchaikovsky%2C_Pyotr%29 | #321831 6. June: Barcarolle (0.56MB, 8 pp.) — IMSLP321831-SIBLEY1802.22725.5aa1-39087012739183score.pdf | 편집 William Scharfenberg (1819–1895); New York: Schirmer , 1891. Plate 9524. | Public Domain | 찾음 |
| `08-seasons-august-op37a-8/` | 사계 Op.37a 「8월」 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=803 | Tschaikowsky-op37.8.ly, Tschaikowsky-op37.8.mid | Rob. Forberg, Leipzig | Public Domain | 찾음 |
| `09-nutcracker-suite-op71a/` | 호두까기 인형 모음곡 Op.71a (사탕 요정의 춤, 꽃의 왈츠) | IMSLP | https://imslp.org/wiki/The_Nutcracker_%28suite%29%2C_Op.71a_%28Tchaikovsky%2C_Pyotr%29 | #57455 Complete Score (2.13MB, 42 pp.) — IMSLP57455-PMLP03607-Tchaikovsky_op71_The_Nutcracker_Suite_(pf_43p).pdf | 편집 Carl Deis (1883–1960); 편곡 Anton Strelezki (1859–1906), as Stepan Esipoff; New York: G. Schirmer , 1922. Plate LMC 1447. | Public Domain | 찾음 |
| `11-6-pieces-op51/` | 6개의 소품 Op.51 (6번 「감상적인 왈츠」) | IMSLP | https://imslp.org/wiki/6_Pieces%2C_Op.51_%28Tchaikovsky%2C_Pyotr%29 | #57351 5. Romance 6. Valse sentimentale (0.92MB, 11 pp.) — IMSLP57351-PMLP19422-Tchaikovsky_op51n5,6_Six_Piano_Pieces.pdf | Moscow: P. Jurgenson , n.d.(1882). Plate 5323-5324. | Public Domain | 찾음 |
| `12-swan-lake-neapolitan-op20/` | 백조의 호수 Op.20 — 나폴리 춤 | Mutopia | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=896 | dansenapolitaine.ly, dansenapolitaine.mid | New arrangement | Public Domain | 찾음 |
| `13-12-pieces-op40/` | 12개의 소품 Op.40 (2번 「슬픈 노래」) | IMSLP | https://imslp.org/wiki/12_Pieces%2C_Op.40_%28Tchaikovsky%2C_Pyotr%29 | #34847 Nos.2, 6, 9-10 (0.64MB, 13 pp.) — IMSLP34847-PMLP45130-Tchaikovsky_op40_12_Pieces_(excerpts).pdf | Unidentified Publisher , n.d. | Public Domain | 찾음 |

## 찾지 못했거나 일부러 뺀 곡

곡 목록은 `classical/catalog.json`에 아직 없어서(10명 모두 `planned`, 곡 비어 있음), 연습곡으로 자주 쓰이는 곡과 대표곡을 골라 받았습니다. 작곡 세션에서 목록을 정하면 빠진 곡을 다시 찾아 받으면 됩니다.

| 작곡가 | 곡 | 이유 |
|---|---|---|
| 모차르트 | 레퀴엠 K.626 「라크리모사」 | IMSLP의 옛 전집 총보가 6.85~17MB로 5MB 초과. 오일렌부르크판(블루메, 1975년 사망)은 저작권이 남음 |
| 모차르트 | 「반짝반짝 작은 별」 변주곡 K.265 — Mutopia판 | Mutopia에는 기타 2중주 편곡만 있어 빼고, IMSLP의 모차르트 전집판을 받음 |
| 모차르트 | 아베 베룸 코르푸스 — Mutopia판 | Mutopia에는 라이네케의 남성 4부 합창 편곡만 있어 빼고, IMSLP의 모차르트 전집판을 받음 |
| 베토벤 | 「환희의 송가」(교향곡 9번 4악장) | Mutopia에는 찬송가 편곡만 있고, 교향곡 총보는 5MB를 훨씬 넘음 |
| 헨델 | 수상 음악 HWV 348–350 | 자이페르트판(1948년 사망)은 12.7MB로 5MB 초과. 할레 헨델 전집판(레들리히, 1968년 사망)은 한국 기준 보호 중이라 뺌 |
| 헨델 | 왕궁의 불꽃놀이 — Mutopia판 | 트럼펫·오르간 편곡이라 뺌 |
| 헨델 | 「옴브라 마이 푸」, 「울게 하소서」 | 오페라 총보는 7~23MB라서 대신 프라우트가 편집한 성악·피아노판(1905)을 받음 |
| 하이든 | 교향곡 94번 「놀람」 | PD 총보가 5.1~5.8MB로 5MB를 살짝 넘음. 필요하면 제한을 풀고 #494069(페터스, 5.5MB)를 받으면 됨 |
| 슈베르트 | 「세레나데」 D.957-4 | 슈베르트 전집 「백조의 노래」가 6.29MB로 5MB 초과(리스트 편곡판만 작음) |
| 차이코프스키 | 사계 「10월」 등 6월 외의 달 | 전곡 PDF가 5.1~12MB. 6월만 낱장으로 받음(Mutopia에 1·2·8월 있음) |
| 차이코프스키 | 호두까기 인형 | 관현악 총보는 10MB 이상이라, 에시포프(스트렐레츠키) 피아노 독주 편곡판(실머 1922)을 받음 — **원곡이 아니라 편곡**임에 주의 |
| 차이코프스키 | 백조의 호수 「정경」 | 총보가 수십~수백 MB. Mutopia의 「나폴리 춤」은 트럼펫 편곡이라 뺌 |
| 비발디 | 사계 외 곡 | Mutopia에 사계 4곡만 받음(독주 바이올린+현악, 원편성) |
