#!/usr/bin/env python3
"""Manage kanban cards in board.json.

Usage:
  python3 update_board.py add <column> <worker_id> <title> [--link URL]
  python3 update_board.py move <card_id> <column>
  python3 update_board.py done <card_id>
  python3 update_board.py remove <card_id>
  python3 update_board.py list
Columns: todo | doing | review | done
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BOARD_PATH = ROOT / "board.json"
KST = timezone(timedelta(hours=9))
COLS = ("todo", "doing", "review", "done")


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S+09:00")


def load() -> dict:
    with BOARD_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def save(data: dict) -> None:
    data["updated_at"] = now_kst()
    with BOARD_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_card(data: dict, card_id: str):
    for col, cards in data.get("columns", {}).items():
        for i, c in enumerate(cards):
            if c.get("id") == card_id:
                return col, i, c
    return None, None, None


def cmd_list(data: dict) -> None:
    labels = {"todo": "할 일", "doing": "진행 중", "review": "검토 대기", "done": "완료"}
    for col in COLS:
        cards = data.get("columns", {}).get(col, [])
        print(f"\n[{labels[col]}] ({len(cards)})")
        for c in cards:
            samp = " *" if c.get("sample") else ""
            link = f" → {c['link']}" if c.get("link") else ""
            print(f"  {c['id']:10} [{c.get('worker','')}] {c.get('title','')}{link}{samp}")


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add")
    a.add_argument("column", choices=COLS)
    a.add_argument("worker")
    a.add_argument("title")
    a.add_argument("--link", default="")
    a.add_argument("--sample", action="store_true")

    m = sub.add_parser("move")
    m.add_argument("card_id")
    m.add_argument("column", choices=COLS)

    d = sub.add_parser("done")
    d.add_argument("card_id")

    r = sub.add_parser("remove")
    r.add_argument("card_id")

    sub.add_parser("list")

    args = p.parse_args()
    data = load()
    data.setdefault("columns", {c: [] for c in COLS})
    for c in COLS:
        data["columns"].setdefault(c, [])

    if args.cmd == "list":
        cmd_list(data)
        return 0

    if args.cmd == "add":
        card = {
            "id": "c-" + uuid.uuid4().hex[:8],
            "title": args.title,
            "worker": args.worker,
            "link": args.link,
        }
        if args.sample:
            card["sample"] = True
        data["columns"][args.column].append(card)
        save(data)
        print(f"added {card['id']} → {args.column}")
        return 0

    if args.cmd == "move" or args.cmd == "done":
        col = "done" if args.cmd == "done" else args.column
        old, idx, card = find_card(data, args.card_id)
        if card is None:
            print(f"card not found: {args.card_id}", file=sys.stderr)
            return 1
        data["columns"][old].pop(idx)
        data["columns"][col].append(card)
        save(data)
        print(f"{args.card_id}: {old} → {col}")
        return 0

    if args.cmd == "remove":
        old, idx, card = find_card(data, args.card_id)
        if card is None:
            print(f"card not found: {args.card_id}", file=sys.stderr)
            return 1
        data["columns"][old].pop(idx)
        save(data)
        print(f"removed {args.card_id}")
        return 0

    return 1


def _maybe_sync():
    import os, subprocess
    if os.environ.get("AI_OFFICE_SYNC") == "1":
        subprocess.Popen([os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_pages.sh")])


if __name__ == "__main__":
    rc = main()
    if rc == 0:
        _maybe_sync()
    raise SystemExit(rc)
