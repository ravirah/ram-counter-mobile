@echo off
echo Killing any existing node processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting bhagwan-backend...
echo Admin Login: use ADMIN_USERNAME / ADMIN_PASSWORD env vars
echo API: http://localhost:3000
cd /d C:\wamp64\www\ravir\jay_shriram\bhagwan-backend
node server.js
