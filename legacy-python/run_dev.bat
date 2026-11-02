@echo off
chcp 65001 >nul
rem 开发运行：启动本地服务并打开浏览器
set PY=C:\Users\ruixu\.venvs\moduleresume\Scripts\python.exe
if not exist "%PY%" set PY=python
"%PY%" "%~dp0run.py" %*
pause
