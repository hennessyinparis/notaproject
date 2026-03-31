# Запуск «Нота» на Windows

## Что нужно установить один раз

1. **Docker Desktop** — https://docs.docker.com/desktop/install/windows-install/
   - После установки запусти Docker Desktop и дождись зелёного статуса
   - ВАЖНО: Если у тебя установлен PostgreSQL локально или в WSL — освободи порт 5432 или используй порт 5433

2. **Python 3.11+** — https://www.python.org/downloads/
   - При установке поставь галочку **"Add Python to PATH"**

3. **Node.js 20+** — https://nodejs.org/ (кнопка LTS)

4. **FFmpeg** — https://ffmpeg.org/download.html
   - Скачай zip для Windows, распакуй, добавь папку `bin` в PATH системы

---

## Первый запуск (один раз)

### Шаг 1: Настройка бэкенда

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Открой `.env` и измени порт с 5432 на **5433** (если есть конфликт):
```
DATABASE_URL=postgresql+asyncpg://nota_user:nota_pass@127.0.0.1:5433/nota_db
```

### Шаг 2: Запуск БД в Docker

```cmd
docker compose up db redis -d
```

### Шаг 3: Применение миграций

```cmd
docker compose run --rm migrate
```

### Шаг 4: Установка фронтенда

```cmd
cd frontend
npm install
```

---

## Запуск (каждый раз)

Тебе нужны **3 терминала**:

### Терминал 1 — Docker (БД)
```cmd
docker compose up db redis -d
```

### Терминал 2 — Бэкенд
```cmd
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```
Дождись: `Application startup complete`

### Терминал 3 — Фронтенд
```cmd
cd frontend
npm run dev
```
Дождись: `Local: http://localhost:5173`

### Открой в браузере
**http://localhost:5173**

---

## Остановка

- **Бэкенд и фронтенд**: `Ctrl+C` в их терминалах
- **Docker**: `docker compose down`

---

## Если что-то сломалось

### Полный сброс БД
```cmd
docker compose down -v
docker compose up db redis -d
docker compose run --rm migrate
```

### Переустановка зависимостей бэкенда
```cmd
cd backend
venv\Scripts\activate
pip install -r requirements.txt
```

### Переустановка зависимостей фронтенда
```cmd
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Возможные проблемы

**Порт 5432 занят** (ошибка "database nota_user does not exist"):
- Проверь: `netstat -ano | findstr 5432`
- Если занят — измени в `.env` порт на 5433, в `docker-compose.yml` порт на `5433:5432`

**Ошибка "password cannot be longer than 72 bytes"**:
- Уже исправлено в `app/core/security.py` (использует bcrypt напрямую)

**Ошибка "capture_output" при загрузке трека**:
- Уже исправлено в `app/services/audio_meta.py` (исправлен subprocess.run)

**FATAL "database nota_user does not exist" в логах Docker**:
- Это сообщение от healthcheck, не влияет на работу. Игнорируй его.

**Данные не сохраняются после `docker compose down -v`**:
- Флаг `-v` удаляет volume с данными. Используй `docker compose down` без `-v` чтобы сохранить данные.
