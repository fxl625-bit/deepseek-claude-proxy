@echo off
REM DeepSeek Proxy Launcher - kills old instance and starts new one
taskkill /F /FI "WINDOWTITLE eq DeepSeek Proxy" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
start "" /B "C:\Users\yckj0094\.workbuddy\binaries\node\versions\22.22.2\node.exe" "F:\CODEX\deepseek-proxy\deepseek-proxy.mjs"
