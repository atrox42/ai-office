#!/usr/bin/env python3
"""Update a worker's status in status.json.

Usage:
  python3 update_status.py <worker_id> <idle|working|error> [task...]
  python3 update_status.py planner working 바이럴 릴스 분석 중
  python3 update_status.py --list
  python3 update_status.py --channel youtube shorts=3 posts=1
  python3 update_status.py --revenue youtube=12000 coupang=3500
  python3 update_status.py --free-jobs +1
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATUS_PATH = ROOT / "status.json"
KST = timezone(timedelta(hours=9))
VALID = {"idle", "working", "error"}


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S+09:00")


def load() -> dict:
    with STATUS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def save(data: dict) -> None:
    data["updated_at"] = now_kst()
    with STATUS_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--list":
        data = load()
        for wid, w in data.get("workers", {}).items():
            print(f"{wid:18} {w.get('status','?'):8} {w.get('name','')} | {w.get('task','')}")
        return 0

    if len(sys.argv) >= 2 and sys.argv[1] == "--channel":
        # --channel youtube shorts=3 posts=1
        data = load()
        if len(sys.argv) < 3:
            print("usage: --channel <id> [shorts=N] [posts=N]", file=sys.stderr)
            return 1
        cid = sys.argv[2]
        ch = data.setdefault("channels", {}).setdefault(cid, {"label": cid, "shorts_today": 0, "posts_today": 0})
        for arg in sys.argv[3:]:
            if "=" in arg:
                k, v = arg.split("=", 1)
                if k in ("shorts", "shorts_today"):
                    ch["shorts_today"] = int(v)
                elif k in ("posts", "posts_today"):
                    ch["posts_today"] = int(v)
        save(data)
        print(f"channel {cid}: shorts={ch['shorts_today']} posts={ch['posts_today']}")
        return 0

    if len(sys.argv) >= 2 and sys.argv[1] == "--revenue":
        data = load()
        rev = data.setdefault("revenue", {})
        for arg in sys.argv[2:]:
            if "=" in arg:
                k, v = arg.split("=", 1)
                rev[k] = int(v) if v.lstrip("-").isdigit() else v
        save(data)
        print("revenue:", rev)
        return 0

    if len(sys.argv) >= 2 and sys.argv[1] == "--free-jobs":
        data = load()
        arg = sys.argv[2] if len(sys.argv) > 2 else "+1"
        cur = int(data.get("free_model_jobs_today", 0))
        if arg.startswith("+"):
            data["free_model_jobs_today"] = cur + int(arg[1:] or "1")
        else:
            data["free_model_jobs_today"] = int(arg)
        save(data)
        print("free_model_jobs_today:", data["free_model_jobs_today"])
        return 0

    parser = argparse.ArgumentParser(description="Update worker status")
    parser.add_argument("worker_id")
    parser.add_argument("status", choices=sorted(VALID))
    parser.add_argument("task", nargs="*", default=[])
    args = parser.parse_args()

    data = load()
    workers = data.get("workers", {})
    if args.worker_id not in workers:
        print(f"unknown worker: {args.worker_id}", file=sys.stderr)
        print("known:", ", ".join(workers.keys()), file=sys.stderr)
        return 1

    w = workers[args.worker_id]
    w["status"] = args.status
    w["task"] = " ".join(args.task) if args.task else ("" if args.status == "idle" else w.get("task", ""))
    w["updated_at"] = now_kst()
    if args.status == "idle":
        w["task"] = ""
    save(data)
    print(f"{args.worker_id} → {args.status}" + (f" | {w['task']}" if w["task"] else ""))
    return 0


def _maybe_sync():
    import os, subprocess
    if os.environ.get("AI_OFFICE_SYNC") == "1":
        subprocess.Popen([os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_pages.sh")])


if __name__ == "__main__":
    rc = main()
    if rc == 0:
        _maybe_sync()
    raise SystemExit(rc)
