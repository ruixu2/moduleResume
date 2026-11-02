@echo off
chcp 65001 >nul
rem 一键打包 EXE（产物在 dist\ ，需要 Node.js 18+）
node "%~dp0scripts\build_exe.js" %*
pause
