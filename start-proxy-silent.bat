@echo off
REM DeepSeek Proxy Launcher - kills old instance and starts new one
taskkill /F /FI "WINDOWTITLE eq DeepSeek Proxy" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
pushd "%~dp0"
start "" /B node "%~dp0deepseek-proxy.mjs"
popd
