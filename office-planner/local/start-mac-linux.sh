#!/bin/sh
# Планировщик офиса продаж: запуск на http://localhost:8080
cd "$(dirname "$0")"
URL=http://localhost:8080
( sleep 1; (command -v open >/dev/null && open $URL) || (command -v xdg-open >/dev/null && xdg-open $URL) ) &
if command -v python3 >/dev/null; then exec python3 -m http.server 8080
elif command -v npx >/dev/null; then exec npx --yes http-server -p 8080 -c-1
else echo "Нет python3 или Node.js — откройте index.html в браузере напрямую."; fi
