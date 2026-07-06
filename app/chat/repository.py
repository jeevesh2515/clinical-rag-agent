
from typing import Dict, List, Optional
from uuid import uuid4
from datetime import datetime

from app.chat.models import Conversation, ChatMessage, ConversationSummary

class ChatRepository:
    def __init__(self):
        self.conversations: Dict[str, Conversation] = {}

    def create_conversation(self, user_id: str, title: Optional[str] = None) -> Conversation:
        conversation_id = str(uuid4())
        new_conversation = Conversation(
            id=conversation_id,
            user_id=user_id,
            title=title if title else f"New Chat {len(self.conversations) + 1}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            messages=[]
        )
        self.conversations[conversation_id] = new_conversation
        return new_conversation

    def get_conversation(self, conversation_id: str, user_id: str) -> Optional[Conversation]:
        conversation = self.conversations.get(conversation_id)
        if conversation and conversation.user_id == user_id:
            return conversation
        return None

    def list_conversations(self, user_id: str) -> List[ConversationSummary]:
        return [
            ConversationSummary(id=conv.id, title=conv.title, updated_at=conv.updated_at)
            for conv in self.conversations.values()
            if conv.user_id == user_id
        ]

    def add_message(self, conversation_id: str, user_id: str, message: ChatMessage) -> Optional[Conversation]:
        conversation = self.get_conversation(conversation_id, user_id)
        if conversation:
            conversation.messages.append(message)
            conversation.updated_at = datetime.utcnow()
            return conversation
        return None

    def update_conversation_title(self, conversation_id: str, user_id: str, new_title: str) -> Optional[Conversation]:
        conversation = self.get_conversation(conversation_id, user_id)
        if conversation:
            conversation.title = new_title
            conversation.updated_at = datetime.utcnow()
            return conversation
        return None

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        conversation = self.get_conversation(conversation_id, user_id)
        if conversation:
            del self.conversations[conversation_id]
            return True
        return False

# Global instance for dependency injection
chat_repository = ChatRepository()
