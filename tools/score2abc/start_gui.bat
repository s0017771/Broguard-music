@echo off
chcp 65001 > nul
cd /d "%~dp0"
where py > /dev/null 2> nul
if %errorlevel%==0 (
  py -3 score2abc_gui.pyw
) else (
  python score2abc_gui.pyw
)
if errorlevel 1 pause
