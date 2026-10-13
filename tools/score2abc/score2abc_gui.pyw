#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
score2abc 창 프로그램 — 버튼으로 악보를 골라 ABC 또는 MXL로 변환합니다.

더블클릭으로 실행하세요 (Windows). 창이 안 뜨면 start_gui.bat를 실행하면
오류 메시지를 볼 수 있습니다.
"""

import json
import os
import queue
import subprocess
import sys
import threading
from pathlib import Path

import tkinter as tk
import tkinter.font as tkfont
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

sys.path.insert(0, str(Path(__file__).resolve().parent))
import score2abc as core  # noqa: E402

SETTINGS_PATH = core.BASE_DIR / "score2abc_gui.json"
FILETYPES = [("악보 파일", "*.pdf *.png *.jpg *.jpeg *.tif *.tiff *.bmp *.gif"), ("모든 파일", "*.*")]


def load_settings():
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def open_folder(path):
    path = str(path)
    if os.name == "nt":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.run(["open", path], check=False)
    else:
        subprocess.run(["xdg-open", path], check=False)


class App:
    def __init__(self, root):
        self.root = root
        self.files = []
        self.queue = queue.Queue()
        self.worker = None
        s = load_settings()
        if s.get("audiveris_path"):
            core.AUDIVERIS_PATH = s["audiveris_path"]
        self.audiveris = core.find_audiveris()
        self.xml2abc = core.load_xml2abc()

        self.mode = tk.StringVar(value=s.get("mode", core.SAVE_AS))
        self.melody_only = tk.BooleanVar(value=s.get("melody_only", core.MELODY_ONLY))
        self.remove_lyrics = tk.BooleanVar(value=s.get("remove_lyrics", core.REMOVE_LYRICS))
        self.tempo = tk.IntVar(value=s.get("tempo", core.DEFAULT_TEMPO))
        self.out_dir = tk.StringVar(value=s.get("out_dir", str(core.OUTPUT)))
        self.status = tk.StringVar(value="악보 파일을 추가하고 '변환 시작'을 누르세요.")

        root.title("score2abc — 악보 변환기")
        root.minsize(620, 600)
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.build()
        self.on_mode_change()
        self.update_audiveris_label()
        self.root.after(100, self.poll)

    # ---------- 화면 ----------
    def build(self):
        pad = {"padx": 10, "pady": 6}
        main = ttk.Frame(self.root, padding=12)
        main.pack(fill="both", expand=True)

        ttk.Label(main, text="악보 사진·PDF → ABC / MXL 변환기", style="Title.TLabel").pack(anchor="w")
        ttk.Label(main, text="악보를 고르고, 만들 형식을 정한 다음, '변환 시작'을 누르세요.").pack(anchor="w", pady=(0, 8))

        box1 = ttk.LabelFrame(main, text=" 1. 변환할 악보 ")
        box1.pack(fill="x", **pad)
        btns = ttk.Frame(box1)
        btns.pack(fill="x", padx=8, pady=(6, 2))
        self.add_btn = ttk.Button(btns, text="악보 파일 추가…", command=self.add_files_dialog)
        self.add_btn.pack(side="left")
        self.remove_btn = ttk.Button(btns, text="선택 빼기", command=self.remove_selected)
        self.remove_btn.pack(side="left", padx=6)
        self.clear_btn = ttk.Button(btns, text="모두 비우기", command=self.clear_files)
        self.clear_btn.pack(side="left")
        lst = ttk.Frame(box1)
        lst.pack(fill="x", padx=8, pady=(2, 8))
        self.listbox = tk.Listbox(lst, height=5, selectmode="extended", activestyle="none")
        self.listbox.pack(side="left", fill="x", expand=True)
        sb = ttk.Scrollbar(lst, orient="vertical", command=self.listbox.yview)
        sb.pack(side="right", fill="y")
        self.listbox.config(yscrollcommand=sb.set)

        box2 = ttk.LabelFrame(main, text=" 2. 무엇으로 만들까요? ")
        box2.pack(fill="x", **pad)
        self.radio_abc = ttk.Radiobutton(
            box2, text="ABC 악보 — 뮤직랩에 바로 붙여넣기 (자동 정리·박자 검사 포함)",
            variable=self.mode, value="abc", command=self.on_mode_change)
        self.radio_abc.pack(anchor="w", padx=8, pady=(6, 0))
        opts = ttk.Frame(box2)
        opts.pack(anchor="w", padx=34, pady=(2, 4))
        self.chk_melody = ttk.Checkbutton(opts, text="멜로디 성부만 남기기", variable=self.melody_only)
        self.chk_melody.pack(side="left")
        self.chk_lyrics = ttk.Checkbutton(opts, text="가사 지우기", variable=self.remove_lyrics)
        self.chk_lyrics.pack(side="left", padx=12)
        ttk.Label(opts, text="템포 없을 때 빠르기").pack(side="left")
        self.spin_tempo = ttk.Spinbox(opts, from_=30, to=240, width=5, textvariable=self.tempo)
        self.spin_tempo.pack(side="left", padx=(4, 0))
        self.radio_mxl = ttk.Radiobutton(
            box2, text="MXL 파일까지만 — EasyABC에서 직접 고치기 (사진처럼 인식이 어려운 악보에 추천)",
            variable=self.mode, value="mxl", command=self.on_mode_change)
        self.radio_mxl.pack(anchor="w", padx=8, pady=(2, 8))

        box3 = ttk.LabelFrame(main, text=" 3. 저장할 곳 ")
        box3.pack(fill="x", **pad)
        row = ttk.Frame(box3)
        row.pack(fill="x", padx=8, pady=8)
        ttk.Entry(row, textvariable=self.out_dir, state="readonly").pack(side="left", fill="x", expand=True)
        self.out_btn = ttk.Button(row, text="바꾸기…", command=self.choose_out_dir)
        self.out_btn.pack(side="left", padx=6)
        ttk.Button(row, text="폴더 열기", command=lambda: open_folder(self.ensure_out_dir())).pack(side="left")

        run = ttk.Frame(main)
        run.pack(fill="x", **pad)
        self.start_btn = ttk.Button(run, text="▶  변환 시작", style="Big.TButton", command=self.start)
        self.start_btn.pack(side="left")
        self.progress = ttk.Progressbar(run, mode="determinate")
        self.progress.pack(side="left", fill="x", expand=True, padx=10)
        ttk.Label(main, textvariable=self.status).pack(anchor="w", padx=10)

        bottom = ttk.Frame(main)
        bottom.pack(side="bottom", fill="x", padx=10, pady=(2, 0))
        self.aud_label = ttk.Label(bottom, foreground="#555")
        self.aud_label.pack(side="left")
        ttk.Button(bottom, text="Audiveris 위치 지정…", command=self.choose_audiveris).pack(side="right")

        self.log = ScrolledText(main, height=11, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True, padx=10, pady=(4, 6))

    def update_audiveris_label(self):
        if self.audiveris:
            self.aud_label.config(text="Audiveris: %s" % self.audiveris, foreground="#555")
        else:
            self.aud_label.config(text="Audiveris를 찾지 못했어요. 오른쪽 버튼으로 위치를 지정해 주세요.",
                                  foreground="#b00020")

    def on_mode_change(self):
        state = "normal" if self.mode.get() == "abc" else "disabled"
        for w in (self.chk_melody, self.chk_lyrics, self.spin_tempo):
            w.config(state=state)

    def write_log(self, text):
        self.log.config(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.config(state="disabled")

    # ---------- 파일 ----------
    def add_files(self, paths):
        for p in paths:
            p = Path(p)
            if p.suffix.lower() in core.INPUT_EXTS and p not in self.files:
                self.files.append(p)
                self.listbox.insert("end", p.name)
        self.status.set("악보 %d개 준비됨" % len(self.files))

    def add_files_dialog(self):
        paths = filedialog.askopenfilenames(title="변환할 악보 고르기", filetypes=FILETYPES)
        self.add_files(paths)

    def remove_selected(self):
        for i in reversed(self.listbox.curselection()):
            self.listbox.delete(i)
            del self.files[i]
        self.status.set("악보 %d개 준비됨" % len(self.files))

    def clear_files(self):
        self.listbox.delete(0, "end")
        self.files.clear()
        self.status.set("악보 파일을 추가하고 '변환 시작'을 누르세요.")

    def choose_out_dir(self):
        d = filedialog.askdirectory(title="결과를 저장할 폴더", initialdir=self.out_dir.get())
        if d:
            self.out_dir.set(d)

    def ensure_out_dir(self):
        d = Path(self.out_dir.get())
        d.mkdir(parents=True, exist_ok=True)
        return d

    def choose_audiveris(self):
        f = filedialog.askopenfilename(title="Audiveris 실행 파일 고르기 (예: Audiveris.exe)")
        if f:
            core.AUDIVERIS_PATH = f
            self.audiveris = core.find_audiveris()
            self.update_audiveris_label()
            self.save_settings()

    # ---------- 변환 ----------
    def set_busy(self, busy):
        state = "disabled" if busy else "normal"
        for w in (self.start_btn, self.add_btn, self.remove_btn, self.clear_btn, self.out_btn,
                  self.radio_abc, self.radio_mxl):
            w.config(state=state)
        if busy:
            for w in (self.chk_melody, self.chk_lyrics, self.spin_tempo):
                w.config(state="disabled")
        else:
            self.on_mode_change()

    def start(self):
        if not self.files:
            messagebox.showinfo("악보가 없어요", "먼저 '악보 파일 추가…'로 변환할 악보를 골라 주세요.")
            return
        if not self.audiveris:
            messagebox.showwarning("Audiveris가 필요해요", "Audiveris를 찾지 못했어요.\n'Audiveris 위치 지정…'으로 설치 위치를 알려 주세요.")
            return
        mode = self.mode.get()
        if mode == "abc" and not self.xml2abc:
            messagebox.showwarning("xml2abc.py가 없어요", "프로그램 폴더에 xml2abc.py가 있어야 ABC로 바꿀 수 있어요.")
            return
        try:
            tempo = int(self.tempo.get())
        except (tk.TclError, ValueError):
            tempo = core.DEFAULT_TEMPO
        core.MELODY_ONLY = bool(self.melody_only.get())
        core.REMOVE_LYRICS = bool(self.remove_lyrics.get())
        core.DEFAULT_TEMPO = tempo
        core.ensure_folders()
        out_dir = self.ensure_out_dir()
        self.save_settings()

        files = list(self.files)
        self.progress.config(maximum=len(files), value=0)
        self.set_busy(True)
        self.status.set("변환 중… (악보 한 장에 수십 초~몇 분)")
        self.write_log("=" * 40)
        self.worker = threading.Thread(target=self.run_jobs, args=(files, mode, out_dir), daemon=True)
        self.worker.start()

    def run_jobs(self, files, mode, out_dir):
        ok = 0
        for i, src in enumerate(files, 1):
            self.queue.put(("log", "[시작] %s" % src.name))
            try:
                results = core.convert_file(src, self.audiveris, self.xml2abc, out_dir, mode,
                                            log=lambda m: self.queue.put(("log", m)))
            except core.ConversionError as e:
                self.queue.put(("log", "  [실패] %s" % e))
                if e.log_path and e.log_path.exists():
                    dest = core.unique_path(out_dir, core.safe_stem(src.stem) + " - 오류 기록", ".log")
                    try:
                        dest.write_bytes(e.log_path.read_bytes())
                        self.queue.put(("log", "    오류 기록을 저장했어요: %s" % dest.name))
                    except OSError:
                        pass
            else:
                ok += 1
                for out, messages in results:
                    self.queue.put(("log", "  [완료] %s" % out.name))
                    for m in messages:
                        self.queue.put(("log", "    " + m))
                self.queue.put(("converted", src))
            self.queue.put(("progress", i))
        self.queue.put(("done", ok, len(files)))

    def poll(self):
        try:
            while True:
                item = self.queue.get_nowait()
                kind = item[0]
                if kind == "log":
                    self.write_log(item[1])
                elif kind == "progress":
                    self.progress.config(value=item[1])
                elif kind == "converted":
                    if item[1] in self.files:
                        i = self.files.index(item[1])
                        self.files.pop(i)
                        self.listbox.delete(i)
                elif kind == "done":
                    ok, total = item[1], item[2]
                    self.set_busy(False)
                    msg = "완료: %d개 중 %d개 성공" % (total, ok)
                    if ok < total:
                        msg += " — 실패한 악보는 목록에 남겨 두었어요"
                    self.status.set(msg)
                    self.write_log(msg)
                    self.root.bell()
        except queue.Empty:
            pass
        self.root.after(100, self.poll)

    # ---------- 설정 ----------
    def save_settings(self):
        data = {
            "mode": self.mode.get(),
            "melody_only": bool(self.melody_only.get()),
            "remove_lyrics": bool(self.remove_lyrics.get()),
            "tempo": self.tempo.get() if str(self.tempo.get()).isdigit() else core.DEFAULT_TEMPO,
            "out_dir": self.out_dir.get(),
            "audiveris_path": core.AUDIVERIS_PATH,
        }
        try:
            SETTINGS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            pass

    def on_close(self):
        if self.worker and self.worker.is_alive():
            if not messagebox.askyesno("변환 중이에요", "아직 변환 중이에요. 그래도 닫을까요?"):
                return
        self.save_settings()
        self.root.destroy()


def setup_fonts(root):
    families = set(tkfont.families(root))
    for fam in ("Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans CJK KR", "NanumGothic"):
        if fam in families:
            for name in ("TkDefaultFont", "TkTextFont", "TkMenuFont", "TkHeadingFont"):
                tkfont.nametofont(name).configure(family=fam, size=10)
            break
    style = ttk.Style(root)
    base = tkfont.nametofont("TkDefaultFont").actual("family")
    style.configure("Title.TLabel", font=(base, 15, "bold"))
    style.configure("Big.TButton", font=(base, 11, "bold"), padding=(14, 6))


def main():
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    root = tk.Tk()
    setup_fonts(root)
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
