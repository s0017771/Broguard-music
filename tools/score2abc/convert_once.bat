@echo off
chcp 65001 > nul
cd /d "%~dp0"
where py > nul 2> nul
if %errorlevel%==0 (
  py -3 score2abc.py --once
) else (
  python score2abc.py --once
)
pause
