@echo off
chcp 65001 >nul
rem 一键打包 EXE（产物在 dist\ ）
set PY=C:\Users\ruixu\.venvs\moduleresume\Scripts\python.exe
if not exist "%PY%" set PY=python
"%PY%" "%~dp0scripts\build_exe.py" %*
pause
