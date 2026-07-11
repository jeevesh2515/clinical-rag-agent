"""Alembic environment configuration — reads DB URL from app settings."""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Allow imports from the project root
_project_root = Path(__file__).resolve().parents[3]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# Alembic Config object
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ─── Import our app's metadata for autogenerate ───────────────────────────────
from app.db import Base  # noqa: E402

target_metadata = Base.metadata

# ─── URL resolution ────────────────────────���──────────────────────────────────
# Prefer the app's settings, falling back to the ini-file value.
# This way the same .env / DATABASE_URL env var drives both the app and
# Alembic, so there's only one place to configure.
from app.core.config import get_settings  # noqa: E402

try:
    settings = get_settings()
    db_url = settings.database_url
except Exception:
    db_url = config.get_main_option("sqlalchemy.url")

# ─── SQLite path workaround ───────────────────────────────────────────────────
# Ensure the parent directory of a file-based SQLite DB exists.
if db_url and db_url.startswith("sqlite:///"):
    _path_part = db_url.replace("sqlite:///", "", 1)
    _db_path = Path(_path_part)
    _db_path.parent.mkdir(parents=True, exist_ok=True)

# ─── Migration functions ──────────────────────────────────────────────────────


def run_migrations_offline() -> None:
    """Configure the context with just a URL (no engine needed)."""
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Create a temporary engine and run migrations."""
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = db_url
    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
