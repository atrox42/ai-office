#!/usr/bin/env bash
# Push status.json/board.json to GitHub Pages only if changed. No LLM.
cd "$(dirname "$0")" || exit 1
exec 9>/tmp/ai-office-sync.lock; flock -n 9 || exit 0
git add status.json board.json
git diff --cached --quiet && exit 0
git commit -qm "sync status $(date '+%F %T')" && git push -q origin main
