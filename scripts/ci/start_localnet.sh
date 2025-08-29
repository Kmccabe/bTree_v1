
#!/usr/bin/env bash
set -euo pipefail

echo "Installing AlgoKit CLI (pip)"
python -m pip install --upgrade pip
python -m pip install --user algokit

# Ensure ~/.local/bin is in PATH
export PATH="$HOME/.local/bin:$PATH"

echo "AlgoKit version:"
algokit --version || true

echo "Starting LocalNet via AlgoKit (Docker)"
algokit localnet start

echo "Waiting for algod (4001) and indexer (8980) to be ready..."
TIMEOUT=120
WAITED=0
until curl -sS http://localhost:4001/health > /dev/null 2>&1; do
  sleep 2
  WAITED=$((WAITED+2))
  if [ $WAITED -ge $TIMEOUT ]; then
    echo "Timed out waiting for algod"
    docker ps -a
    exit 1
  fi
done
WAITED=0
until curl -sS http://localhost:8980/health > /dev/null 2>&1; do
  sleep 2
  WAITED=$((WAITED+2))
  if [ $WAITED -ge $TIMEOUT ]; then
    echo "Timed out waiting for indexer"
    docker ps -a
    exit 1
  fi
done

echo "LocalNet is up."
