#!/usr/bin/env python3
"""Pull blog AdPost estimate from blog-insights into ai-office status.

Reads the latest /workspace/blog-insights/YYYY-MM-DD.md, extracts
'예상수익 N원' (commas allowed), then:

  python3 update_status.py --revenue blog=N youtube=0

--revenue only patches the keys you pass, so coupang/other are left alone.
If no 예상수익 line is found, leaves blog unchanged and exits 0.
No LLM.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INSIGHTS = Path("/workspace/blog-insights")
REVENUE_RE = re.compile(r"예상수익\s*([0-9][0-9,]*)\s*원")


def latest_report() -> Path | None:
    if not INSIGHTS.is_dir():
        return None
    files = sorted(INSIGHTS.glob("????-??-??.md"))
    return files[-1] if files else None


def extract_won(text: str) -> int | None:
    amounts = [int(m.group(1).replace(",", "")) for m in REVENUE_RE.finditer(text)]
    if not amounts:
        return None
    return sum(amounts)


def main() -> int:
    path = latest_report()
    if path is None:
        print("no blog-insights YYYY-MM-DD.md found; leaving revenue unchanged", file=sys.stderr)
        return 0

    text = path.read_text(encoding="utf-8")
    won = extract_won(text)
    if won is None:
        print(f"{path.name}: no '예상수익 N원' found; keeping previous blog revenue", file=sys.stderr)
        return 0

    cmd = [
        sys.executable,
        str(ROOT / "update_status.py"),
        "--revenue",
        f"blog={won}",
        "youtube=0",
        "note=블로그자동",
    ]
    print(f"{path.name}: 예상수익 {won}원 →", " ".join(cmd[2:]))
    proc = subprocess.run(cmd, cwd=str(ROOT))
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
