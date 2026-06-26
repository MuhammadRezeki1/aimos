#!/usr/bin/env bash
# AIMOS ERD Generator (Linux/macOS/Git Bash)
# Usage:
#   cd backend/database/erd
#   chmod +x generate_erd.sh
#   ./generate_erd.sh
#   ./generate_erd.sh svg
#   ./generate_erd.sh --dbdiagram
#   ./generate_erd.sh --mermaid-live

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORMAT="${1:-png}"
DBML_FILE="$SCRIPT_DIR/aimos.dbml"
MMD_FILE="$SCRIPT_DIR/aimos.mmd"
OUT_FILE="$SCRIPT_DIR/aimos-erd.$FORMAT"

echo ""
echo "=== AIMOS ERD Generator ==="
echo ""

if [[ "${1:-}" == "--dbdiagram" ]]; then
  echo "[DBML] Buka https://dbdiagram.io/d dan import: $DBML_FILE"
  command -v xdg-open >/dev/null && xdg-open "https://dbdiagram.io/d" || open "https://dbdiagram.io/d" 2>/dev/null || true
  exit 0
fi

if [[ "${1:-}" == "--mermaid-live" ]]; then
  echo "[Mermaid] Buka https://mermaid.live dan paste isi: $MMD_FILE"
  command -v xdg-open >/dev/null && xdg-open "https://mermaid.live" || open "https://mermaid.live" 2>/dev/null || true
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js tidak ditemukan."
  echo ""
  echo "Rekomendasi tanpa install:"
  echo "  ./generate_erd.sh --dbdiagram"
  echo "  ./generate_erd.sh --mermaid-live"
  exit 1
fi

cd "$SCRIPT_DIR"
echo "[Mermaid CLI] Render aimos.mmd -> aimos-erd.$FORMAT"
npx --yes @mermaid-js/mermaid-cli -i aimos.mmd -o "aimos-erd.$FORMAT" -b transparent
echo "[OK] ERD tersimpan: $OUT_FILE"
