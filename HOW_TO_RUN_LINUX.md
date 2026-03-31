# Запуск «Нота» на Linux (Red OS / Ubuntu / Debian)

## Что нужно установить один раз

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nodejs npm python3.11 python3.11-venv ffmpeg
sudo usermod -aG docker $USER
newgrp docker
```

### Red OS / Fedora
```bash
sudo dnf install -y docker docker-compose-plugin nodejs npm python3.11 ffmpeg
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

## Запуск (каждый раз)

### Терминал 1 — База данных
```bash
docker compose up db redis
```
Подожди: `database system is ready to accept connections`
Не закрывай.

### Терминал 2 — Бэкенд
Открой новый терминал:
```bash
cd backend
```
Первый раз:
```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
```
Каждый следующий раз:
```bash
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

### Терминал 3 — Фронтенд
Открой новый терминал:
```bash
cd frontend
npm install   # только первый раз
npm run dev
```

## Открыть сайт
**http://localhost:5173**
