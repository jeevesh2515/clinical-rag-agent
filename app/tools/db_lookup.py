from sqlalchemy import create_engine, text

from app.core.config import Settings


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
        conn.execute(
            text(
                """
                INSERT OR IGNORE INTO workflow_reference(key, value)
                VALUES
                ('hypertension_follow_up', 'Book a blood pressure review within 4 weeks after medication changes in this demo workflow.'),
                ('community_referral', 'Offer community lifestyle support referral when lifestyle counselling is documented.')
                """
            )
        )


def lookup_workflow_reference(settings: Settings, query: str) -> str | None:
    ensure_demo_db(settings)
    engine = create_engine(settings.database_url)
    key = "community_referral" if "community" in query.lower() else "hypertension_follow_up"
    with engine.begin() as conn:
        row = conn.execute(text("SELECT value FROM workflow_reference WHERE key = :key"), {"key": key}).fetchone()
    return row[0] if row else None
