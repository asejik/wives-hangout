#!/usr/bin/env bash
# Copies one or more files to the Windows clipboard from WSL, preserving UTF-8 characters.
# Usage: bash scripts/clip.sh supabase/migrations/001_registrations.sql [more files...]
set -euo pipefail
tmp="$(mktemp --suffix=.txt)"
trap 'rm -f "$tmp"' EXIT
for f in "$@"; do cat "$f"; printf '\n'; done > "$tmp"
powershell.exe -NoProfile -Command "Get-Content -Raw -Encoding UTF8 -LiteralPath '$(wslpath -w "$tmp")' | Set-Clipboard"
echo "Copied $(wc -l < "$tmp") lines to the clipboard: $*"
