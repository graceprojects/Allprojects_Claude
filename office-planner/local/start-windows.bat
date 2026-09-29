@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Планировщик офиса продаж: http://localhost:8080
where python >nul 2>nul && (start "" http://localhost:8080 & python -m http.server 8080 & goto :eof)
where py >nul 2>nul && (start "" http://localhost:8080 & py -m http.server 8080 & goto :eof)
where npx >nul 2>nul && (start "" http://localhost:8080 & npx --yes http-server -p 8080 -c-1 & goto :eof)
echo Python или Node.js не найдены. Откройте файл index.html двойным щелчком - всё работает и без сервера.
start "" index.html
pause
