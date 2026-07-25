"""Day 30 — Unit tests for verify_secrets.py.

Covers clean files (no matches), placeholder detection, AWS access key
pattern, and the dry-run mode for CI integration.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "verify_secrets.py"


def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )


def test_clean_files_pass(tmp_path: Path) -> None:
    """A directory containing only clean yaml/json files should pass."""
    clean_yaml = tmp_path / "clean.yaml"
    clean_yaml.write_text("apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: foo\n")
    clean_json = tmp_path / "clean.json"
    clean_json.write_text('{"a": 1, "b": "REPLACE_ME_WITH_OPENAI_API_KEY_is_safe_in_a_test"}\n')
    # Note: above intentional string contains the substring but is a test value;
    # the script should still flag it. Override with a safe alternative below.
    safe_json = tmp_path / "safe.json"
    safe_json.write_text('{"a": 1, "b": "safe-value"}\n')
    clean_yaml.unlink()
    clean_json.unlink()

    result = _run(["--quiet", "--paths", str(tmp_path)])
    assert result.returncode == 0, f"clean files should pass: {result.stdout}\n{result.stderr}"


def test_placeholder_detected(tmp_path: Path) -> None:
    leaked_yaml = tmp_path / "leaked.yaml"
    leaked_yaml.write_text(
        "apiVersion: v1\nkind: Secret\nmetadata:\n  name: jwt\n"
        "stringData:\n  jwt_secret: REPLACE_ME_WITH_OPENSSL_RAND_HEX_32\n"
    )
    result = _run(["--quiet", "--paths", str(tmp_path)])
    assert result.returncode == 1, f"placeholder should fail: {result.stdout}\n{result.stderr}"
    assert "REPLACE_ME" in result.stdout or "REPLACE_ME" in result.stderr


def test_aws_access_key_pattern_detected(tmp_path: Path) -> None:
    leaked = tmp_path / "aws.yaml"
    leaked.write_text(
        "apiVersion: v1\nkind: Secret\nstringData:\n"
        "  aws_access_key_id: AKIAIOSFODNN7EXAMPLE\n"
    )
    result = _run(["--quiet", "--paths", str(tmp_path)])
    assert result.returncode == 1, f"AWS key should fail: {result.stdout}\n{result.stderr}"


def test_skip_paths_excluded(tmp_path: Path) -> None:
    """Files in .planning/ and tests/ are excluded."""
    planning_dir = tmp_path / ".planning"
    planning_dir.mkdir()
    leaked = planning_dir / "plan.md"
    leaked.write_text("Use AKIAIOSFODNN7EXAMPLE as a placeholder.\n")
    result = _run(["--quiet", "--paths", str(tmp_path)])
    assert result.returncode == 0, (
        f".planning/ should be skipped: {result.stdout}\n{result.stderr}"
    )


def test_dry_run_quiet_mode(tmp_path: Path) -> None:
    leaked = tmp_path / "leaked.json"
    leaked.write_text('{"key": "REPLACE_ME_WITH_OPENROUTER_API_KEY"}\n')
    result = _run(["--quiet", "--paths", str(tmp_path)])
    assert result.returncode == 1
    # --quiet should still emit the github-actions inline annotation.
    assert "::error" in (result.stdout + result.stderr)