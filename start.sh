#!/bin/sh
set -e
cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
cd /app/web
exec node server.js
