@echo off
setlocal

REM ---------------------------------------------------------------------------
REM  ulam :: setup.bat
REM
REM  Copies the source to a local-disk sandbox at %LOCALAPPDATA%\ulam-dev and
REM  installs npm dependencies there. This avoids the EPERM/EBADF errors npm
REM  hits when node_modules lives inside a Google Drive synced folder.
REM
REM  Source of truth stays on Drive. Each run.bat resyncs the sandbox so the
REM  dev server picks up edits made to the Drive copy.
REM
REM  Re-run setup.bat after any change to package.json / package-lock.json.
REM ---------------------------------------------------------------------------

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "SANDBOX=%LOCALAPPDATA%\ulam-dev"
set "NPM_CACHE=%LOCALAPPDATA%\ulam-dev-cache"

echo Project dir : %PROJECT_DIR%
echo Sandbox     : %SANDBOX%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [error] Node.js was not found in PATH.
  echo         Install Node 18+ from https://nodejs.org and re-run setup.bat.
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [error] npm was not found in PATH.
  exit /b 1
)

if not exist "%SANDBOX%" mkdir "%SANDBOX%"
if not exist "%NPM_CACHE%" mkdir "%NPM_CACHE%"

echo Mirroring source to sandbox...
robocopy "%PROJECT_DIR%" "%SANDBOX%" /MIR /NFL /NDL /NJH /NJS /NP /XD node_modules dist .git .vite >nul
REM Robocopy returns 0-7 for success variants and 8+ for real errors.
if errorlevel 8 (
  echo [error] robocopy mirror failed.
  exit /b 1
)

pushd "%SANDBOX%"
echo Installing dependencies (this can take a minute)...
call npm install --no-audit --no-fund --cache "%NPM_CACHE%"
if errorlevel 1 (
  popd
  echo.
  echo [error] npm install failed.
  exit /b 1
)
popd

echo.
echo Setup complete. Run run.bat to start the local dev server.
endlocal
