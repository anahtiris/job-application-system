#!/usr/bin/env bash
# Sets up the Job Application System for local development:
# - creates the Python virtualenv and installs backend deps
# - installs frontend deps
# - seeds .env and the personal data files from their .example counterparts
set -euo pipefail

cd "$(dirname "$0")"

command -v python3 >/dev/null 2>&1 || { echo "python3 is required but not found. Install Python 3.11+ and retry." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not found. Install Node.js 18+ and retry." >&2; exit 1; }

echo "==> Setting up Job Application System"

if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

echo "Installing backend dependencies..."
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r app/backend/requirements.txt -q

echo "Installing frontend dependencies..."
(cd app/frontend && npm install)

copy_if_missing() {
  local src="$1" dest="$2"
  if [ ! -f "$dest" ] && [ -f "$src" ]; then
    cp "$src" "$dest"
    echo "Created $dest from $(basename "$src")"
  fi
}

copy_if_missing ".env.example" ".env"
copy_if_missing "data/persona.example.md" "data/persona.md"
copy_if_missing "data/skills.example.json" "data/skills.json"
copy_if_missing "data/career_goal.example.md" "data/career_goal.md"

echo ""
echo "==> Setup complete."
echo ""
echo "Next steps:"
echo "  1. Start the backend:  cd app/backend && source ../../.venv/bin/activate && uvicorn main:app --reload"
echo "  2. Start the frontend: cd app/frontend && npm run dev"
echo "  3. Open http://localhost:3000 and follow 'First-time setup' in the README."
echo ""
echo "Optional, for PDF export:"
echo "  brew install --cask libreoffice && brew install poppler"
