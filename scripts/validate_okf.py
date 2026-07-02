#!/usr/bin/env python3
"""Validate OKF bundle: frontmatter `type` field + [[wikilink]] resolution."""

import re
import sys
from pathlib import Path

import yaml

WIKILINK_PATTERN = re.compile(r"\[\[([\w/\-]+)(?:#([\w\-]+))?\]\]")
OKF_ROOT = Path(__file__).resolve().parent.parent / "hypertension-okf"
INDEX_PATH = OKF_ROOT / "INDEX.md"


def main() -> int:
    errors: list[str] = []

    if not OKF_ROOT.exists():
        print(f"OKF root not found: {OKF_ROOT}")
        return 1

    md_files = sorted(OKF_ROOT.rglob("*.md"))

    if not md_files:
        print("No markdown files found in OKF bundle")
        return 1

    known_paths: set[str] = set()
    for f in md_files:
        rel = f.relative_to(OKF_ROOT)
        known_paths.add(str(rel))
        known_paths.add(str(rel.with_suffix("")))

    for f in md_files:
        rel = f.relative_to(OKF_ROOT)
        raw = f.read_text(encoding="utf-8")

        lines = raw.splitlines()
        if not lines or lines[0].strip() != "---":
            if f.name != "INDEX.md":
                errors.append(f"{rel}: missing YAML frontmatter (no --- delimiter)")
            continue

        end = -1
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                end = i
                break
        if end < 0:
            errors.append(f"{rel}: unclosed YAML frontmatter")
            continue

        fm_block = "\n".join(lines[1:end])
        try:
            fm = yaml.safe_load(fm_block) or {}
        except yaml.YAMLError as e:
            errors.append(f"{rel}: YAML parse error: {e}")
            continue

        if "type" not in fm:
            errors.append(f"{rel}: missing required 'type' field in frontmatter")

        if not isinstance(fm.get("type"), str) or not fm["type"].strip():
            errors.append(f"{rel}: 'type' field must be a non-empty string")

        if f.name != "INDEX.md":
            body = "\n".join(lines[end + 1:])
            links = WIKILINK_PATTERN.findall(body)
            for link_target, _ in links:
                link_path = link_target + ".md"
                link_no_ext = link_target
                resolved = False
                for p in [link_path, link_no_ext]:
                    candidates = [
                        OKF_ROOT / p,
                        OKF_ROOT / f"{link_target}/INDEX.md",
                    ]
                    for candidate in candidates:
                        try:
                            candidate.relative_to(OKF_ROOT)
                        except ValueError:
                            continue
                        if candidate.exists():
                            resolved = True
                            break
                    if resolved:
                        break
                if not resolved:
                    errors.append(
                        f"{rel}: unresolved wikilink [[{link_target}]] "
                        f"(not found in OKF bundle)"
                    )

    if errors:
        print(f"OKF validation: {len(errors)} error(s)")
        for err in errors:
            print(f"  ✗ {err}")
        return 1
    else:
        print(f"OKF validation: {len(list(md_files))} files, 0 errors")
        return 0


if __name__ == "__main__":
    sys.exit(main())
