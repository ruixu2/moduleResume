@echo off
chcp 65001 >nul
rem 开发运行：启动本地服务并打开浏览器（需要 Node.js 18+）
node "%~dp0run.js" %*
pause
