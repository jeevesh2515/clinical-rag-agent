#!/usr/bin/env python3
"""Day 30 — CI guard: fail the build if secret placeholders leak into repo.

Runs in pre-commit + CI. Scans .yaml, .yml, .json, .env*, .tf, and
.kubernetes/ manifests for forbidden placeholder strings like:

  REPLACE_ME_WITH_OPENSSL_RAND_HEX_32
  REPLACE_ME_WITH_OPENAI_API_KEY
  REPLACE_ME_WITH_OPENROUTER_API_KEY
  REPLACE_ME_WITH_COHERE_API_KEY
  change-me-in-production-...
  TODO_REPLACE_ME
  AKIA...       (AWS access key id pattern)

Exit 0 if clean, exit 1 if any placeholder is found. Output is in
github-actions format so the failure shows up as an inline annotation.

Usage:
    python3 scripts/verify_secrets.py [--quiet] [--paths k8s api]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Patterns that indicate an unrotated placeholder / leaked credential.
FORBIDDEN_PATTERNS: tuple[tuple[str, str], ...] = (
    # Self-documenting REPLACE_ME markers we introduced for secret templates.
    (r"REPLACE_ME_WITH_OPENSSL_RAND_HEX_32", "JWT secret placeholder"),
    (r"REPLACE_ME_WITH_OPENAI_API_KEY", "OpenAI key placeholder"),
    (r"REPLACE_ME_WITH_OPENROUTER_API_KEY", "OpenRouter key placeholder"),
    (r"REPLACE_ME_WITH_COHERE_API_KEY", "Cohere key placeholder"),
    (r"REPLACE_ME_WITH_NEON_DATABASE_URL", "Neon DB URL placeholder"),
    (r"REPLACE_ME_WITH_LANGSMITH_API_KEY", "LangSmith key placeholder"),
    (r"REPLACE_ME_WITH_SENTRY_DSN", "Sentry DSN placeholder"),
    (r"change-me-in-production", "Old change-me placeholder"),
    (r"TODO_REPLACE_ME", "TODO replace-me placeholder"),
    # AWS access key ID pattern (always 20 uppercase chars).
    (r"AKIA[0-9A-Z]{16}", "Possible AWS access key id"),
    # Generic-looking private keys
    (r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----", "Inline private key"),
)

# File extensions to scan.
SCAN_EXTENSIONS = {".yaml", ".yml", ".json", ".env", ".tf", ".ini", ".conf", ".toml"}

# Paths that may legitimately contain "secret-like" strings in templates
# (e.g. the secret template itself uses these markers by design).
SKIP_PATH_PARTS = (
    ".git/",
    "node_modules/",
    "frontend/dist/",
    "frontend/node_modules/",
    "data/source_documents/",
    "scripts/verify_secrets.py",  # this file references the patterns
    ".planning/",
    "tests/",
    "README.md",
)


def iter_files(root: Path, extra_paths: list[str]) -> list[Path]:
    """Yield files that should be scanned for placeholder strings."""
    roots: list[Path] = []
    if extra_paths:
        for p in extra_paths:
            candidate = (root / p).resolve()
            if candidate.exists():
                roots.append(candidate)
    else:
        roots.append(root.resolve())
    out: list[Path] = []
    for r in roots:
        if r.is_file():
            out.append(r)
            continue
        for path in r.rglob("*"):
            if not path.is_file():
                continue
            if any(part in str(path) for part in SKIP_PATH_PARTS):
                continue
            if path.suffix.lower() in SCAN_EXTENSIONS:
                out.append(path)
    return out


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (line_no, pattern_desc, line) for every match in file."""
    matches: list[tuple[int, str, str]] = []
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return matches
    for pattern, desc in FORBIDDEN_PATTERNS:
        regex = re.compile(pattern)
        for idx, line in enumerate(content.splitlines(), start=1):
            if regex.search(line):
                matches.append((idx, desc, line.strip()[:200]))
    return matches


def main() -> int:
    parser = argparse.ArgumentParser(description="CI guard for secret placeholders.")
    parser.add_argument("--quiet", action="store_true", help="Only print on failures.")
    parser.add_argument(
        "--paths",
        nargs="+",
        default=None,
        help="Optional list of paths to scan (defaults to project root).",
    )
    args = parser.parse_args()

    root = Path.cwd()
    files = iter_files(root, args.paths or [])
    total = 0
    for f in files:
        hits = scan_file(f)
        if not hits:
            continue
        total += len(hits)
        try:
            rel = f.relative_to(root)
        except ValueError:
            # File is outside the project root (e.g. a tmp_path under /tmp).
            # Use the absolute path so the GitHub Actions annotation still
            # points at the offending file.
            rel = f
        for line_no, desc, line in hits:
            # GitHub Actions inline annotation format.
            print(f"::error file={rel},line={line_no}:: {desc}: {line}")
    if total == 0:
        if not args.quiet:
            print(f"verify_secrets: scanned {len(files)} files — clean.")
        return 0
    print(f"\nverify_secrets: {total} placeholder(s) detected across {len(files)} files.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())