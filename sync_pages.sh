#!/usr/bin/env bash
# Push status.json/board.json to GitHub Pages only if changed. No LLM.
# Also runs collect_revenue.py once per day after 10:30 KST (blog morning report).
cd "$(dirname "$0")" || exit 1
exec 9>/tmp/ai-office-sync.lock; flock -n 9 || exit 0

# Daily blog revenue collect (after blog bot morning report ~08:xx; we wait until 10:30)
STAMP="logs/revenue-collected.date"
mkdir -p logs
TODAY=$(TZ=Asia/Seoul date +%F)
HOUR_MIN=$(TZ=Asia/Seoul date +%H%M)
if [[ "$HOUR_MIN" -ge 1030 ]] && [[ "$(cat "$STAMP" 2>/dev/null)" != "$TODAY" ]]; then
  if python3 collect_revenue.py >>logs/revenue.log 2>&1; then
    echo "$TODAY" > "$STAMP"
  fi
fi

git add status.json board.json
git diff --cached --quiet && exit 0
git commit -qm "sync status $(date '+%F %T')" && git push -q origin main
