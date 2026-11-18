#!/usr/bin/env bash
set -u

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "Stopping Sajha Cafe services..."

# Stop containers and the Compose network, but keep the MySQL volume/data.
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose -f "$project_dir/docker-compose.yml" down --remove-orphans --timeout 10 || true
fi

is_project_process() {
  local pid="$1"
  local cwd
  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
  [[ "$cwd" == "$project_dir"/* ]]
}

stop_pid() {
  local pid="$1"
  is_project_process "$pid" || return 0
  kill -TERM "$pid" 2>/dev/null || true
}

# Catch locally started Node/Nest/Next processes, including processes whose
# command line only contains a relative entrypoint and whose cwd is in this repo.
while read -r pid; do
  [[ "$pid" =~ ^[0-9]+$ ]] && stop_pid "$pid"
done < <(pgrep -f "$project_dir/(backend|frontend|print-bridge)/" 2>/dev/null || true)

# Also catch local processes started with relative commands, but only on the
# ports owned by this project. The cwd check prevents stopping unrelated apps.
for port in "${BACKEND_PORT:-3000}" "${FRONTEND_PORT:-3001}" "${PRINT_BRIDGE_PORT:-17891}"; do
  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] && stop_pid "$pid"
  done < <(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
done

sleep 1

# Escalate only project processes that ignored SIGTERM.
while read -r pid; do
  [[ "$pid" =~ ^[0-9]+$ ]] || continue
  if is_project_process "$pid"; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
done < <(pgrep -f "$project_dir/(backend|frontend|print-bridge)/" 2>/dev/null || true)

echo "Sajha Cafe services stopped."
