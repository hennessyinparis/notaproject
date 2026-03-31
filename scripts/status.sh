#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
RUN_DIR="$PROJECT_DIR/.run"

show_one() {
  local name="$1"
  local pid_file="$RUN_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "$name: running (pid=$pid)"
    else
      echo "$name: stale pid file (pid=$pid)"
    fi
  else
    echo "$name: stopped"
  fi
}

show_one frontend
show_one backend

echo "docker:"
cd "$PROJECT_DIR"
docker compose ps
