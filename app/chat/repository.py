"""Chat persistence layer backed by SQLite.

Replaces the previous in-memory ``ChatRepository`` (a Python ``dict``) so
conversations and messages survive process restarts.
"""

from __future__ import annotations

import json
from typing import List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.chat.models import Conversation, ConversationSummary, ChatMessage
from app.db import Conversation as OrmConversation
from app.db import Message as OrmMessage
from app.db import utcnow


def _msg_to_model(msg: OrmMessage) -> ChatMessage:
    """Map ORM Message row → Pydantic ``ChatMessage``."""
    return ChatMessage(
        id=msg.id,
        user_id=msg.user_id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        timestamp=msg.created_at,
        citations=json.loads(msg.citations_json) if msg.citations_json else None,
        tool_trace=json.loads(msg.tool_trace_json) if msg.tool_trace_json else None,
        safety_flags=json.loads(msg.safety_flags_json) if msg.safety_flags_json else None,
        knowledge_path=json.loads(msg.knowledge_path_json) if msg.knowledge_path_json else None,
        rephrased_question=msg.rephrased_question,
        model_used=msg.model_used,
    )


def _conv_to_model(conv: OrmConversation, messages: list[OrmMessage] | None = None) -> Conversation:
    return Conversation(
        id=conv.id,
        user_id=conv.user_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[_msg_to_model(m) for m in (messages or [])],
    )


class ChatRepository:
    """Persistence operations for conversations + messages."""

    def create_conversation(
        self, db: Session, user_id: str, title: Optional[str] = None
    ) -> Conversation:
        new_conv = OrmConversation(
            id=str(uuid4()),
            user_id=user_id,
            title=title or "New Chat",
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        return _conv_to_model(new_conv, [])

    def get_conversation(
        self, db: Session, conversation_id: str, user_id: str
    ) -> Optional[Conversation]:
        conv = (
            db.query(OrmConversation)
            .filter(OrmConversation.id == conversation_id)
            .one_or_none()
        )
        if not conv or conv.user_id != user_id:
            return None
        messages = (
            db.query(OrmMessage)
            .filter(OrmMessage.conversation_id == conversation_id)
            .order_by(OrmMessage.created_at.asc())
            .all()
        )
        return _conv_to_model(conv, messages)

    def list_conversations(self, db: Session, user_id: str) -> List[ConversationSummary]:
        rows = (
            db.query(OrmConversation)
            .filter(OrmConversation.user_id == user_id)
            .order_by(OrmConversation.updated_at.desc())
            .all()
        )
        return [
            ConversationSummary(id=row.id, title=row.title, updated_at=row.updated_at)
            for row in rows
        ]

    def add_message(
        self, db: Session, conversation_id: str, user_id: str, message: ChatMessage
    ) -> Optional[Conversation]:
        conv = (
            db.query(OrmConversation)
            .filter(OrmConversation.id == conversation_id)
            .one_or_none()
        )
        if not conv or conv.user_id != user_id:
            return None

        row = OrmMessage(
            id=message.id or str(uuid4()),
            conversation_id=conversation_id,
            user_id=user_id,
            role=message.role,
            content=message.content,
            citations_json=json.dumps(message.citations) if message.citations else None,
            tool_trace_json=json.dumps(message.tool_trace) if message.tool_trace else None,
            safety_flags_json=json.dumps(message.safety_flags) if message.safety_flags else None,
            knowledge_path_json=json.dumps(message.knowledge_path) if message.knowledge_path else None,
            rephrased_question=message.rephrased_question,
            model_used=message.model_used,
            created_at=message.timestamp or utcnow(),
        )
        db.add(row)
        conv.updated_at = utcnow()
        db.commit()
        db.refresh(conv)
        return self.get_conversation(db, conversation_id, user_id)

    def update_conversation_title(
        self, db: Session, conversation_id: str, user_id: str, new_title: str
    ) -> Optional[Conversation]:
        conv = (
            db.query(OrmConversation)
            .filter(OrmConversation.id == conversation_id)
            .one_or_none()
        )
        if not conv or conv.user_id != user_id:
            return None
        conv.title = new_title
        conv.updated_at = utcnow()
        db.commit()
        db.refresh(conv)
        return self.get_conversation(db, conversation_id, user_id)

    def delete_conversation(
        self, db: Session, conversation_id: str, user_id: str
    ) -> bool:
        conv = (
            db.query(OrmConversation)
            .filter(OrmConversation.id == conversation_id)
            .one_or_none()
        )
        if not conv or conv.user_id != user_id:
            return False
        db.delete(conv)
        db.commit()
        return True


# Module-level singleton — same shape as before so existing imports keep working.
chat_repository = ChatRepository()