#!/usr/bin/env python3
"""Day 31 (post-review) — Patch docs/LOAD_TEST_RESULTS.md with measured numbers.

Reads:
  * docs/load-test-results/baseline-summary.json   (k6 --summary-export)
  * docs/load-test-results/burst-summary.json      (k6 --summary-export)
  * docs/load-test-results/<URL>-<TS>.metrics.json (capture_metrics.sh output)

Then patches the `| _TBD_ |` placeholders in docs/LOAD_TEST_RESULTS.md's
"Measured (Staging)" columns of both the Baseline and Burst tables with the
real values. Falls back to `_TBD_` when a metric is missing so the operator
can manually fill in gaps.
"""
from __future__ import annotations

import glob
import json
import re
import sys
from pathlib import Path

RESULTS_DIR = Path("docs/load-test-results")
DOC = Path("docs/LOAD_TEST_RESULTS.md")


def _load_latest(pattern: str) -> dict[str, object]:
    matches = sorted(glob.glob(str(RESULTS_DIR / pattern)))
    if not matches:
        return {}
    with open(matches[-1]) as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def _fmt_ms(ms: object) -> str:
    if ms is None or not isinstance(ms, (int, float)):
        return "_TBD_"
    return f"{ms / 1000:.1f}s" if ms > 1000 else f"{ms:.0f}ms"


def _fmt_pct(rate: object) -> str:
    if rate is None or not isinstance(rate, (int, float)):
        return "_TBD_"
    return f"{rate * 100:.2f}%"


def _k6_metric(summary: dict, name: str) -> object:
    """Return the value of a k6 metric from a --summary-export JSON."""
    metrics = summary.get("metrics", {}) if isinstance(summary, dict) else {}
    entry = metrics.get(name, {}) if isinstance(metrics, dict) else {}
    values = entry.get("values", {}) if isinstance(entry, dict) else {}
    return values


def main() -> int:
    baseline = _load_latest("baseline-summary.json")
    burst = _load_latest("burst-summary.json")
    metrics_files = sorted(glob.glob(str(RESULTS_DIR / "*.metrics.json")))
    metrics = {}
    if metrics_files:
        try:
            with open(metrics_files[-1]) as f:
                metrics = json.load(f)
        except json.JSONDecodeError:
            metrics = {}

    if not DOC.exists():
        print(f"ERROR: {DOC} not found", file=sys.stderr)
        return 1
    text = DOC.read_text()

    # ─── Baseline row patches ────────────────────────────────────────────────
    if baseline:
        bd = _k6_metric(baseline, "http_req_duration")
        bf = _k6_metric(baseline, "http_req_failed")
        bq = _k6_metric(baseline, "query_latency_ms")
        text = re.sub(
            r"(\| `http_req_duration p95` \| < 18s \| _n/a — local sandbox blocked_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_ms(bd.get("p(95)")),
            text,
        )
        text = re.sub(
            r"(\| `http_req_duration p99` \| < 30s \| _n/a_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_ms(bd.get("p(99)")),
            text,
        )
        text = re.sub(
            r"(\| `http_req_failed rate` \| < 0\.5% \| _n/a_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_pct(bf.get("rate")),
            text,
        )
        text = re.sub(
            r"(\| `query_latency_ms` \| p99 < 30s \| _n/a_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_ms(bq.get("p(99)")),
            text,
        )

    # ─── Burst row patches ───────────────────────────────────────────────────
    if burst:
        bd = _k6_metric(burst, "http_req_duration")
        bf = _k6_metric(burst, "http_req_failed")
        bq = _k6_metric(burst, "burst_latency_ms")
        bs = _k6_metric(burst, "queue_saturation")
        text = re.sub(
            r"(\| `http_req_duration p95` \| < 25s \| _n/a — local sandbox blocked_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_ms(bd.get("p(95)")),
            text,
        )
        text = re.sub(
            r"(\| `http_req_failed rate` \| < 1% \| _n/a_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_pct(bf.get("rate")),
            text,
        )
        text = re.sub(
            r"(\| `queue_saturation rate` \| < 5% \| _n/a_ \| )_TBD_",
            lambda m: m.group(1) + _fmt_pct(bs.get("rate")),
            text,
        )

    # ─── Cross-cutting: peak replicas (from HPA snapshot) ──────────────────
    peak = metrics.get("peak_replicas_hpa", "_TBD_")
    if peak in (None, "n/a", ""):
        peak = "_TBD_"
    text = re.sub(
        r"(\| Peak replica count \| ≥ 4 \| _n/a_ \| )_TBD_",
        lambda m: m.group(1) + str(peak),
        text,
    )

    DOC.write_text(text)
    patched = sum(1 for _ in re.finditer(r"\| [0-9.]+s? \|", text)) - sum(
        1 for _ in re.finditer(r"\|_TBD_\|", text)
    )
    print(f"Patched {patched} cells in {DOC}")
    if not baseline and not burst and not metrics:
        print("(no measurement files found; docs unchanged — operator must copy values manually)")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())