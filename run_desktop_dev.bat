@echo off
setlocal
set "MODULERESUME_DATA=%~dp0data"
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Electron is missing. Run npm install in this project first.
  pause
  exit /b 1
)
start "" /D "%~dp0" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
