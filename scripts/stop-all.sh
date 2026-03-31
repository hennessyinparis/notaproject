#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
RUN_DIR="$PROJECT_DIR/.run"

stop_pid_file() {
  local name="$1"
  local pid_file="$RUN_DIR/${name}.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "[skip] $name was not started by script"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    echo "[skip] $name pid is empty"
    return
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "[stop] $name (pid=$pid)"
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    echo "[ok] $name stopped"
  else
    echo "[skip] $name is already stopped"
  fi

  rm -f "$pid_file"
}

stop_pid_file "frontend"
stop_pid_file "backend"

echo "[stop] Database (docker compose down)"
cd "$PROJECT_DIR"
docker compose down

echo "Done."
