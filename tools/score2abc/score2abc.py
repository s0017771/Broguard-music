#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
score2abc — 악보 이미지/PDF를 ABC 악보로 자동 변환

  inbox/ 폴더에 악보(PDF, PNG, JPG ...)를 넣으면
  Audiveris(악보 인식) → xml2abc(MusicXML→ABC) → 자동 정리 순서로 처리해서
  output/ 폴더에 .abc 파일을 저장합니다.

사용법
  python score2abc.py           폴더를 계속 지켜보다가 새 악보가 들어오면 변환 (Ctrl+C로 종료)
  python score2abc.py --once    지금 inbox에 있는 악보만 변환하고 종료

필요한 것
  - Python 3.8 이상 (추가 설치 패키지 없음)
  - Audiveris 5.x (https://github.com/Audiveris/audiveris/releases)
  - 같은 폴더의 xml2abc.py (W.G. Vree, LGPL)
"""

import argparse
import importlib.util
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from collections import Counter
from fractions import Fraction
from pathlib import Path

# ============================================================
#  설정 — 필요하면 여기만 바꾸세요
# ============================================================

# Audiveris 실행 파일 위치. 비워두면 흔한 설치 위치에서 자동으로 찾습니다.
AUDIVERIS_PATH = r""

# 변환 결과에 템포 표시가 없을 때 넣을 기본 빠르기 (4분음표 기준, 1분에 몇 번)
DEFAULT_TEMPO = 80

# 한 줄에 넣을 마디 수
BARS_PER_LINE = 4

# 반복 기호(도돌이표)를 펼쳐서 처음부터 끝까지 순서대로 적을지 (True/False)
UNFOLD_REPEATS = False

# 악보 인식이 자주 잘못 읽는 장식 기호(스타카토, 악센트, 셈여림 등)를 지울지
REMOVE_DECORATIONS = True

# 코드 이름이 아닌 글자 메모(가사 조각이 잘못 들어간 경우가 많음)를 지울지
REMOVE_TEXT_NOTES = True

# 가사 줄(w:)을 지울지. 가사 인식은 틀리는 경우가 많아서 멜로디+코드만 쓸 때 편합니다.
REMOVE_LYRICS = False

# 성부가 여러 개로 인식되면 첫 번째 성부(맨 위 멜로디)만 남길지.
# 뮤직랩의 줄별 듣기·커서 4마디는 멜로디 한 줄짜리 악보에서만 동작합니다.
# 피아노 왼손까지 살리고 싶으면 False로 바꾸세요.
MELODY_ONLY = True

# 폴더를 몇 초마다 확인할지 (지켜보기 모드)
POLL_SECONDS = 5

# 한 악보를 인식하는 데 허용할 최대 시간(초)
AUDIVERIS_TIMEOUT = 900

# ============================================================

BASE_DIR = Path(__file__).resolve().parent
INBOX = BASE_DIR / "inbox"
OUTPUT = BASE_DIR / "output"
DONE = BASE_DIR / "done"
FAILED = BASE_DIR / "failed"
WORK = BASE_DIR / "work"

INPUT_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif"}

AUDIVERIS_CANDIDATES = [
    r"C:\Program Files\Audiveris\Audiveris.exe",
    r"C:\Program Files (x86)\Audiveris\Audiveris.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Audiveris\Audiveris.exe"),
    "/Applications/Audiveris.app/Contents/MacOS/Audiveris",
    "/opt/audiveris/bin/Audiveris",
]

CHORD_RE = re.compile(
    r"^[A-G](?:#|b|♯|♭)?"
    r"(?:maj|min|dim|aug|sus|add|m|M|\+|°|ø)?"
    r"[0-9]{0,2}"
    r"(?:(?:maj|min|dim|aug|sus|add|b|#|\+|-)?[0-9]{1,2})*"
    r"(?:/[A-G](?:#|b|♯|♭)?)?$"
)


def say(msg):
    print(msg, flush=True)


# ------------------------------------------------------------
#  준비
# ------------------------------------------------------------

def find_audiveris():
    if AUDIVERIS_PATH:
        p = Path(AUDIVERIS_PATH)
        return p if p.exists() else None
    for c in AUDIVERIS_CANDIDATES:
        if c and Path(c).exists():
            return Path(c)
    found = shutil.which("Audiveris") or shutil.which("audiveris")
    return Path(found) if found else None


def load_xml2abc():
    path = BASE_DIR / "xml2abc.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("xml2abc", str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def ensure_folders():
    for d in (INBOX, OUTPUT, DONE, FAILED, WORK):
        d.mkdir(exist_ok=True)


# ------------------------------------------------------------
#  1단계: Audiveris로 악보 인식 → MusicXML(.mxl)
# ------------------------------------------------------------

def run_audiveris(audiveris, src, job_dir):
    # 한글·공백이 섞인 파일 이름 문제를 피하려고 영문 임시 이름으로 복사해서 인식합니다.
    job_dir.mkdir(parents=True, exist_ok=True)
    tmp_input = job_dir / ("score" + src.suffix.lower())
    shutil.copy2(src, tmp_input)
    out_dir = job_dir / "omr"
    out_dir.mkdir(exist_ok=True)
    cmd = [str(audiveris), "-batch", "-export", "-output", str(out_dir), "--", str(tmp_input)]
    log_path = job_dir / "audiveris.log"
    with open(log_path, "w", encoding="utf-8", errors="replace") as log:
        try:
            subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT,
                           timeout=AUDIVERIS_TIMEOUT, check=False)
        except subprocess.TimeoutExpired:
            raise RuntimeError("악보 인식이 %d초 안에 끝나지 않았어요." % AUDIVERIS_TIMEOUT)
    mxls = sorted(out_dir.rglob("*.mxl"))
    if not mxls:
        raise RuntimeError("Audiveris가 MusicXML을 만들지 못했어요. 로그: %s" % log_path)
    return mxls


# ------------------------------------------------------------
#  2단계: xml2abc로 MusicXML → ABC
# ------------------------------------------------------------

def read_mxl(path):
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        root = None
        if "META-INF/container.xml" in names:
            m = re.search(rb'full-path="([^"]+)"', z.read("META-INF/container.xml"))
            if m:
                root = m.group(1).decode("utf-8")
        if not root:
            root = next(n for n in names
                        if not n.startswith("META") and n.lower().endswith((".xml", ".musicxml")))
        return z.read(root)


def to_abc(xml2abc, mxl_path):
    xml_bytes = read_mxl(mxl_path)
    abc, info = xml2abc.vertaal(xml_bytes, b=BARS_PER_LINE, u=1 if UNFOLD_REPEATS else 0, p="")
    if not abc.strip():
        raise RuntimeError("MusicXML을 ABC로 바꾸지 못했어요: %s" % info.strip())
    return abc


# ------------------------------------------------------------
#  3단계: 자동 정리
# ------------------------------------------------------------

FIELD_RE = re.compile(r"^[A-Za-z]:")


def split_quoted(line):
    """(is_quoted, text) 조각으로 나눕니다. 따옴표 안(코드·글자 메모)은 건드리지 않기 위해 씁니다."""
    parts, i = [], 0
    for m in re.finditer(r'"[^"]*"', line):
        if m.start() > i:
            parts.append((False, line[i:m.start()]))
        parts.append((True, m.group(0)))
        i = m.end()
    if i < len(line):
        parts.append((False, line[i:]))
    return parts


def split_comment(line):
    in_q = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_q = not in_q
        elif ch == "%" and not in_q:
            return line[:i], line[i:]
    return line, ""


def clean_quoted(q):
    """코드처럼 생긴 글자 메모는 코드로 되돌리고, 나머지 글자 메모는 설정에 따라 지웁니다."""
    inner = q[1:-1]
    if inner[:1] in "^_<>@":
        text = inner[1:].strip()
        if CHORD_RE.match(text):
            return '"%s"' % text
        return "" if REMOVE_TEXT_NOTES else q
    return q


def clean_music_line(line):
    body, comment = split_comment(line)
    out = []
    for quoted, seg in split_quoted(body):
        if quoted:
            out.append(clean_quoted(seg))
            continue
        seg = seg.replace("$", "")
        if REMOVE_DECORATIONS:
            seg = re.sub(r"![^!\s]*!", "", seg)
            seg = re.sub(r"\.(?=[\[\^_=A-Ga-gz(])", "", seg)
        out.append(seg)
    return ("".join(out) + comment).rstrip()


def note_units(body, unit):
    """한 마디 안 음표 길이의 합을 온음표 기준 분수로 돌려줍니다 (대략적인 검사용)."""
    s = re.sub(r'"[^"]*"', "", body)
    s = re.sub(r"![^!]*!", "", s)
    s = re.sub(r"\{[^}]*\}", "", s)
    s = re.sub(r"\[[A-Za-z]:[^\]]*\]", "", s)
    total = Fraction(0)
    tuplet_left, tuplet_factor = 0, Fraction(1)
    tok = re.compile(r"\((\d)(?::\d*)*(?::\d*)?|\[([^\]]*)\](\d*/*\d*)|[\^_=]*([A-Ga-gzxZX])[,']*(\d*/*\d*)")
    for m in tok.finditer(s):
        if m.group(1):
            n = int(m.group(1))
            q = {2: 3, 3: 2, 4: 3, 6: 2, 8: 3}.get(n, 2)
            tuplet_left, tuplet_factor = n, Fraction(q, n)
            continue
        if m.group(2) is not None:
            inner = re.match(r"[\^_=]*[A-Ga-g][,']*(\d*/*\d*)", m.group(2).strip())
            length = parse_len(inner.group(1) if inner else "") * parse_len(m.group(3))
        else:
            if m.group(4) in "ZX":
                return None
            length = parse_len(m.group(5))
        if tuplet_left:
            length *= tuplet_factor
            tuplet_left -= 1
        total += length * unit
    return total


def parse_len(s):
    if not s:
        return Fraction(1)
    if "/" in s:
        num, _, rest = s.partition("/")
        num = int(num) if num else 1
        slashes = 1 + rest.count("/")
        den_digits = rest.replace("/", "")
        den = int(den_digits) if den_digits else 2 ** slashes
        return Fraction(num, den)
    return Fraction(int(s))


def check_bars(music_lines, unit):
    bars = []
    for line in music_lines:
        body, _ = split_comment(line)
        body = re.sub(r"\[\d", "|", body)
        for chunk in re.split(r"\|+\]?|:\|+|\|:|::", body):
            if re.search(r"[A-Ga-gz]", re.sub(r'"[^"]*"', "", chunk)):
                bars.append(note_units(chunk, unit))
    lengths = [b for b in bars if b is not None]
    if len(lengths) < 3:
        return None, []
    expected = Counter(lengths[1:-1] or lengths).most_common(1)[0][0]
    odd = [i + 1 for i, b in enumerate(bars)
           if b is not None and b != expected and 0 < i < len(bars) - 1]
    return expected, odd


def group_by_voice(lines):
    groups, current = {}, "1"
    for line in lines:
        vid = voice_id(line)
        if vid:
            current = vid
            groups.setdefault(current, [])
            continue
        if line.strip() and not FIELD_RE.match(line) and not line.startswith("%"):
            groups.setdefault(current, []).append(line)
    return {k: v for k, v in groups.items() if v}


VOICE_RE = re.compile(r"^V:\s*(\S+)")
CHORD_SYMBOL_RE = re.compile(r'"[A-G][^"]*"')


def voice_id(line):
    m = VOICE_RE.match(line)
    return m.group(1) if m else None


def keep_melody_voice(header, music):
    """첫 번째 성부만 남기고 %%score 줄과 나머지 성부를 지웁니다. (남긴 머리말, 남긴 본문, 지운 성부 번호, 지운 줄)"""
    ids = []
    for line in header + music:
        vid = voice_id(line)
        if vid and vid not in ids:
            ids.append(vid)
    if len(ids) < 2:
        return header, music, [], []
    melody = ids[0]
    is_layout = lambda l: l.startswith(("%%score", "%%staves"))
    new_header = [h for h in header
                  if not is_layout(h) and voice_id(h) in (None, melody)]
    kept, dropped, current = [], [], melody
    for line in music:
        vid = voice_id(line)
        if vid:
            current = vid
        if is_layout(line):
            continue
        (kept if current == melody else dropped).append(line)
    return new_header, kept, ids[1:], dropped


def meter_from_length(total):
    if total.denominator in (1, 2, 4):
        return "%d/4" % (total * 4)
    return "%d/8" % (total * 8)


def tidy_abc(abc, title):
    lines = abc.replace("\r\n", "\n").split("\n")
    header, music = [], []
    in_header = True
    for line in lines:
        if in_header:
            header.append(line)
            if line.startswith("K:"):
                in_header = False
        else:
            music.append(line)

    header = [h for h in header if not h.startswith("I:linebreak")]
    for i, h in enumerate(header):
        if h.startswith("T:") and h[2:].strip() in ("", "Title", "score"):
            header[i] = "T:" + title
        if h.strip() == "K:none":
            header[i] = "K:C"
    if not any(h.startswith("T:") for h in header):
        header.insert(1, "T:" + title)
    if not any(h.startswith("Q:") for h in header):
        k = next(i for i, h in enumerate(header) if h.startswith("K:"))
        header.insert(k, "Q:1/4=%d" % DEFAULT_TEMPO)

    cleaned = []
    for line in music:
        if line.startswith(("w:", "W:")):
            if not REMOVE_LYRICS:
                cleaned.append(line.replace("$", ""))
        elif line.startswith("V:"):
            cleaned.append(re.sub(r'\s+s?nm="Voice"', "", line))
        elif FIELD_RE.match(line) or line.startswith("%"):
            cleaned.append(line)
        else:
            cleaned.append(clean_music_line(line))

    messages, notes = [], ["% score2abc 자동 변환본 — 원본 악보와 비교해서 확인하세요."]
    if MELODY_ONLY:
        header, cleaned, removed, dropped = keep_melody_voice(header, cleaned)
        if removed:
            msg = "멜로디 성부만 남겼어요 (지운 성부: %s)" % ", ".join(removed)
            notes.append("% " + msg)
            messages.append("[정리] " + msg)
            chords_kept = sum(len(CHORD_SYMBOL_RE.findall(l)) for l in cleaned if not FIELD_RE.match(l))
            chords_lost = sum(len(CHORD_SYMBOL_RE.findall(l)) for l in dropped if not FIELD_RE.match(l))
            if chords_lost and not chords_kept:
                warn = "코드 이름이 지운 성부에만 있었어요. MELODY_ONLY = False로 바꿔 다시 변환해 보세요."
                notes.append("% ?확인: " + warn)
                messages.append("[확인] " + warn)

    unit_line = next((h for h in header if h.startswith("L:")), "L:1/8")
    unit = Fraction(unit_line[2:].strip())
    voices = group_by_voice(cleaned)
    expected, odd = None, []
    for n, (vid, vlines) in enumerate(voices.items()):
        exp, bad = check_bars(vlines, unit)
        if n == 0:
            expected = exp
        label = "" if len(voices) == 1 else " (%s성부)" % vid
        odd += ["%d%s" % (b, label) for b in bad]

    for i, h in enumerate(header):
        if h.strip() in ("M:none", "M:") and expected:
            header[i] = "M:" + meter_from_length(expected)

    if odd:
        notes.append("% ?확인: 박자가 다른 마디 (첫 마디부터 센 번호): " + ", ".join(odd))
        messages.append("[확인] 박자가 다른 마디: " + ", ".join(odd))
    x = next((i for i, h in enumerate(header) if h.startswith("X:")), -1)
    header[x + 1:x + 1] = notes
    return "\n".join(header + cleaned).rstrip() + "\n", messages


# ------------------------------------------------------------
#  전체 흐름
# ------------------------------------------------------------

def safe_stem(name):
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip() or "score"


def unique_path(folder, stem, ext):
    p = folder / (stem + ext)
    n = 2
    while p.exists():
        p = folder / ("%s (%d)%s" % (stem, n, ext))
        n += 1
    return p


def process(src, audiveris, xml2abc):
    stem = safe_stem(src.stem)
    say("\n[시작] %s" % src.name)
    job_dir = WORK / ("%s_%d" % (time.strftime("%Y%m%d-%H%M%S"), os.getpid()))
    try:
        say("  1/3 악보 인식 중 (Audiveris, 수십 초~몇 분 걸려요)...")
        mxls = run_audiveris(audiveris, src, job_dir)
        results = []
        for idx, mxl in enumerate(mxls, 1):
            say("  2/3 ABC로 바꾸는 중...")
            abc = to_abc(xml2abc, mxl)
            suffix = "" if len(mxls) == 1 else " - %d" % idx
            say("  3/3 정리하는 중...")
            tidy, messages = tidy_abc(abc, stem + suffix)
            out = unique_path(OUTPUT, stem + suffix, ".abc")
            out.write_text(tidy, encoding="utf-8")
            results.append((out, messages))
        shutil.move(str(src), str(unique_path(DONE, stem, src.suffix)))
        for out, messages in results:
            say("  [완료] 저장: %s" % out)
            for m in messages:
                say("    " + m)
        shutil.rmtree(job_dir, ignore_errors=True)
        return True
    except Exception as e:
        say("  [실패] %s" % e)
        dest = unique_path(FAILED, stem, src.suffix)
        shutil.move(str(src), str(dest))
        log = job_dir / "audiveris.log"
        if log.exists():
            shutil.copy2(log, dest.with_suffix(".log"))
        (dest.with_suffix(".error.txt")).write_text(str(e), encoding="utf-8")
        say("    원본과 로그를 failed 폴더로 옮겼어요.")
        return False


def pending_files():
    return sorted(p for p in INBOX.iterdir()
                  if p.is_file() and p.suffix.lower() in INPUT_EXTS and not p.name.startswith("~"))


def is_stable(path, wait=1.0):
    try:
        a = path.stat().st_size
        time.sleep(wait)
        return a == path.stat().st_size and a > 0
    except FileNotFoundError:
        return False


def main():
    ap = argparse.ArgumentParser(description="악보 이미지/PDF → ABC 자동 변환")
    ap.add_argument("--once", action="store_true", help="지금 있는 악보만 변환하고 종료")
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    ensure_folders()
    audiveris = find_audiveris()
    if not audiveris:
        say("Audiveris를 찾지 못했어요. score2abc.py 위쪽의 AUDIVERIS_PATH에 설치 위치를 적어주세요.")
        return 1
    xml2abc = load_xml2abc()
    if not xml2abc:
        say("같은 폴더에 xml2abc.py가 없어요. score2abc.py와 같은 폴더에 넣어주세요.")
        return 1

    say("score2abc 준비 완료")
    say("  Audiveris : %s" % audiveris)
    say("  악보 넣는 곳: %s" % INBOX)
    say("  결과 저장  : %s" % OUTPUT)

    if args.once:
        files = pending_files()
        if not files:
            say("inbox 폴더가 비어 있어요.")
        ok = sum(process(f, audiveris, xml2abc) for f in files if is_stable(f, 0.2))
        say("\n완료: %d개 중 %d개 성공" % (len(files), ok))
        return 0

    say("\n폴더를 지켜보는 중... (끝내려면 Ctrl+C)")
    try:
        while True:
            for f in pending_files():
                if is_stable(f):
                    process(f, audiveris, xml2abc)
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        say("\n종료합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
