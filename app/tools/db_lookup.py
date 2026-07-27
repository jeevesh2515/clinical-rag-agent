from sqlalchemy import create_engine, text

from app.core.config import Settings


# Demo workflow-reference rows are seeded once per process. Pre-existing
# keys are intentionally ignored on both SQLite ("INSERT OR IGNORE") and
# PostgreSQL ("ON CONFLICT DO NOTHING") so the function is safe to call
# repeatedly across test isolation cycles without violating PK constraints.
_WORKFLOW_ROWS: list[tuple[str, str]] = [
    (
        "hypertension_follow_up",
        "Book a blood pressure review within 4 weeks after medication changes in this demo workflow.",
    ),
    (
        "community_referral",
        "Offer community lifestyle support referral when lifestyle counselling is documented.",
    ),
]


def _insert_workflow_reference(conn) -> None:
    """Issue a dialect-aware idempotent INSERT for the demo workflow rows.

    Only SQLite and PostgreSQL are supported (the project's two production
    backends). Any other dialect triggers an explicit error rather than
    silently using a syntax it doesn't understand.

    Values are passed as named bind parameters so the SQL string can be
    reused verbatim across both dialects (no f-string interpolation,
    no duplicate literals — the original ``text()`` literal had the row
    values pasted twice, which is what produced the SQLite syntax error).
    """
    dialect = conn.dialect.name
    params = {
        "k1": _WORKFLOW_ROWS[0][0],
        "v1": _WORKFLOW_ROWS[0][1],
        "k2": _WORKFLOW_ROWS[1][0],
        "v2": _WORKFLOW_ROWS[1][1],
    }
    if dialect == "sqlite":
        # SQLite: INSERT OR IGNORE silently skips any key that already exists.
        conn.execute(
            text(
                "INSERT OR IGNORE INTO workflow_reference(key, value) "
                "VALUES (:k1, :v1), (:k2, :v2)"
            ),
            params,
        )
        return
    if dialect == "postgresql":
        # PostgreSQL: ON CONFLICT on the primary key means "skip if already
        # present".
        conn.execute(
            text(
                "INSERT INTO workflow_reference(key, value) "
                "VALUES (:k1, :v1), (:k2, :v2) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            params,
        )
        return
    raise NotImplementedError(
        f"ensure_demo_db: unsupported SQL dialect '{dialect}'. "
        "Only 'sqlite' and 'postgresql' are supported by Clinical Workflows."
    )


def ensure_demo_db(settings: Settings) -> None:
    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS workflow_reference (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
        )
        _insert_workflow_reference(conn)


def lookup_workflow_reference(settings: Settings, query: str) -> str | None:
    ensure_demo_db(settings)
    engine = create_engine(settings.database_url)
    key = "community_referral" if "community" in query.lower() else "hypertension_follow_up"
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT value FROM workflow_reference WHERE key = :key"),
            {"key": key},
        ).fetchone()
    return row[0] if row else None
