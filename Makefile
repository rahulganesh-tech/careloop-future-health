.PHONY: help install seed test run-backend run-frontend dev docker-up docker-down

help:
	@echo "HealthPulse AI CareLoop - Future Health Challenge 2026"
	@echo "Available commands:"
	@echo "  make install      - Install backend and frontend dependencies"
	@echo "  make seed         - Re-seed database with exact baseline (Score: 64/100)"
	@echo "  make test         - Run 16 automated verification tests via pytest"
	@echo "  make run-backend  - Start FastAPI backend server on :8000"
	@echo "  make run-frontend - Start Next.js frontend dev server on :3000"
	@echo "  make dev          - Run both backend and frontend"
	@echo "  make docker-up    - Start full stack via docker-compose"
	@echo "  make docker-down  - Stop docker-compose services"

install:
	cd backend && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt
	cd frontend && npm install

seed:
	cd backend && ./venv/Scripts/python seed_data.py

test:
	cd backend && ./venv/Scripts/pytest -v tests/test_careloop.py

run-backend:
	cd backend && ./venv/Scripts/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

run-frontend:
	cd frontend && npm run dev -- -p 3000

docker-up:
	docker-compose up -d --build

docker-down:
	docker-compose down -v
