@echo off
rem Carsystem — Windows smoke launcher.
rem Ne trazi administratorska prava. Ako ti Windows nudi 'Run as administrator',
rem odbij: nijedna provera u ovom prolazu ne trazi povisena prava.
setlocal
chcp 65001 >nul

where node >nul 2>&1
if errorlevel 1 (
  echo Node nije pronadjen u PATH.
  echo Instaliraj zvanicni Windows x64 Node 24 LTS sa https://nodejs.org/ pa pokreni ponovo.
  exit /b 3
)

if /i "%~1"=="cleanup" (
  node "%~dp0cleanup.mjs"
  exit /b %errorlevel%
)

rem Dijagnostika PowerShell/DPAPI okruzenja. Nista ne menja na racunaru.
if /i "%~1"=="diagnose" (
  node --no-warnings "%~dp0diagnose.mjs"
  exit /b %errorlevel%
)

node --no-warnings "%~dp0run-smoke.mjs"
set RC=%errorlevel%
echo.
echo Izlazni kod: %RC%   (0=PASS, 4=INCOMPLETE, 1=FAIL, 2=pogresna platforma, 3=runtime)
pause
exit /b %RC%
