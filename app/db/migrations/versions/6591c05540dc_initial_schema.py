"""initial schema

Revision ID: 6591c05540dc
Revises: 
Create Date: 2026-07-11 17:53:02.708051

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6591c05540dc'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the durable account, conversation, message, and upload schema.

    ``create_all`` supported early demo deployments. The guards let those
    deployments become Alembic-managed without deleting existing user data.
    """
    existing = sa.inspect(op.get_bind()).get_table_names()
    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("username", sa.String(length=64), nullable=False, unique=True),
            sa.Column("email", sa.String(length=255), nullable=False, unique=True),
            sa.Column("hashed_password", sa.String(length=255), nullable=False),
            sa.Column("roles_json", sa.String(length=255), nullable=False, server_default="[]"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("full_name", sa.String(length=255)),
            sa.Column("primary_role", sa.String(length=32), nullable=False, server_default="patient"),
            sa.Column("date_of_birth", sa.String(length=10)),
            sa.Column("notes", sa.Text()),
            sa.Column("health_vitals_json", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index("ix_users_username", "users", ["username"])
        op.create_index("ix_users_email", "users", ["email"])
    if "conversations" not in existing:
        op.create_table(
            "conversations",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index("ix_conversations_user_id", "conversations", ["user_id"])
    if "messages" not in existing:
        op.create_table(
            "messages",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("conversation_id", sa.String(length=64), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("role", sa.String(length=16), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("citations_json", sa.Text()),
            sa.Column("tool_trace_json", sa.Text()),
            sa.Column("safety_flags_json", sa.Text()),
            sa.Column("knowledge_path_json", sa.Text()),
            sa.Column("rephrased_question", sa.Text()),
            sa.Column("model_used", sa.String(length=128)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
        op.create_index("ix_messages_user_id", "messages", ["user_id"])
        op.create_index("ix_messages_created_at", "messages", ["created_at"])
    if "uploads" not in existing:
        op.create_table(
            "uploads",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("category", sa.String(length=32), nullable=False, server_default="other"),
            sa.Column("kind", sa.String(length=16), nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("storage_path", sa.String(length=512), nullable=False),
            sa.Column("mime_type", sa.String(length=128), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("user_note", sa.Text()),
            sa.Column("extracted_text", sa.Text()),
            sa.Column("display_title", sa.String(length=255), nullable=False),
            sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index("ix_uploads_user_id", "uploads", ["user_id"])


def downgrade() -> None:
    """Drop only tables created by this initial schema revision."""
    op.drop_table("uploads")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("users")
