#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
RUN_DIR="$PROJECT_DIR/.run"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[error] Command '$1' not found in PATH" >&2
    exit 1
  fi
}

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

start_bg() {
  local name="$1"
  local cwd="$2"
  local cmd="$3"
  local pid_file="$RUN_DIR/${name}.pid"
  local log_file="$LOG_DIR/${name}.log"

  if [[ -f "$pid_file" ]]; then
    local old_pid
    old_pid="$(cat "$pid_file")"
    if [[ -n "$old_pid" ]] && is_running "$old_pid"; then
      echo "[skip] $name is already running (pid=$old_pid)"
      return
    fi
    rm -f "$pid_file"
  fi

  echo "[start] $name -> $cmd"
  (
    cd "$cwd"
    nohup bash -lc "$cmd" >> "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  sleep 1
  local new_pid
  new_pid="$(cat "$pid_file")"
  if is_running "$new_pid"; then
    echo "[ok] $name started (pid=$new_pid), log: $log_file"
  else
    echo "[error] Failed to start $name. Check log: $log_file" >&2
    exit 1
  fi
}

require_cmd docker
require_cmd bash
require_cmd nohup

echo "[1/3] Starting database: docker compose up -d db redis"
cd "$PROJECT_DIR"
docker compose up -d db redis

if [[ -x "$PROJECT_DIR/backend/venv/bin/python" ]]; then
  BACKEND_CMD='source venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000'
elif [[ -x "$PROJECT_DIR/backend/venv/Scripts/python.exe" ]]; then
  BACKEND_CMD='venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000'
else
  BACKEND_CMD='python -m uvicorn app.main:app --reload --port 8000'
fi

echo "[2/3] Starting backend"
start_bg "backend" "$PROJECT_DIR/backend" "$BACKEND_CMD"

echo "[3/3] Starting frontend"
start_bg "frontend" "$PROJECT_DIR/frontend" "npm run dev"

echo
echo "Done. Useful commands:"
echo "  ./scripts/status.sh"
echo "  ./scripts/logs.sh            # both logs"
echo "  ./scripts/logs.sh backend    # backend log only"
echo "  ./scripts/stop-all.sh"
