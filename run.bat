@echo off
setlocal

REM ---------------------------------------------------------------------------
REM  ulam :: run.bat
REM
REM  Mirrors the latest source from Drive into the local sandbox, then starts
REM  the Vite dev server. Run setup.bat first on a new machine.
REM
REM  The dev server runs from %LOCALAPPDATA%\ulam-dev with HMR over local
REM  files. To pick up edits to source on Drive, stop the server (Ctrl+C) and
REM  re-run run.bat.
REM ---------------------------------------------------------------------------

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "SANDBOX=%LOCALAPPDATA%\ulam-dev"

if not exist "%SANDBOX%\node_modules" (
  echo Sandbox not initialised. Run setup.bat first.
  exit /b 1
)

echo Resyncing source to sandbox...
robocopy "%PROJECT_DIR%" "%SANDBOX%" /MIR /NFL /NDL /NJH /NJS /NP /XD node_modules dist .git .vite >nul
if errorlevel 8 (
  echo [error] robocopy resync failed.
  exit /b 1
)

pushd "%SANDBOX%"
call npm run dev
popd
endlocal
