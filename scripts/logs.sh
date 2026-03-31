#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

case "${1:-all}" in
  backend)
    tail -f "$LOG_DIR/backend.log"
    ;;
  frontend)
    tail -f "$LOG_DIR/frontend.log"
    ;;
  all)
    touch "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
    tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all]" >&2
    exit 1
    ;;
esac

