@echo off
cd /d "%~dp0"
echo Stopping old NOVA servers on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul
echo Starting NOVA v2.1.0...
python app.py
pause
