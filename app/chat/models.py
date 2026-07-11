
from pydantic import BaseModel, Field
from typing import Any, List, Optional
from datetime import datetime, timezone


class ChatMessage(BaseModel):
    id: str = Field(..., description="Unique identifier for the message")
    user_id: str = Field(..., description="ID of the user who sent the message")
    conversation_id: str = Field(..., description="ID of the conversation this message belongs to")
    role: str = Field(..., description="Role of the sender (user or assistant)")
    content: str = Field(..., description="Content of the message")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of the message")
    citations: Optional[List[dict[str, Any]]] = Field(None, description="Citations from the RAG system")
    tool_trace: Optional[List[dict[str, Any]]] = Field(None, description="Trace of tools used by the assistant")
    safety_flags: Optional[dict[str, Any]] = Field(None, description="Safety flags detected in the response")
    knowledge_path: Optional[dict[str, Any]] = Field(None, description="Knowledge routing path used by the agent")
    rephrased_question: Optional[str] = Field(None, description="Analyzed rephrased query")
    model_used: Optional[str] = Field(None, description="AI model used for generating the message")


class Conversation(BaseModel):
    id: str = Field(..., description="Unique identifier for the conversation")
    user_id: str = Field(..., description="ID of the user who owns this conversation")
    title: str = Field(..., description="Title of the conversation")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of conversation creation")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of last update")
    messages: List[ChatMessage] = Field(default_factory=list, description="List of messages in the conversation")

class ConversationSummary(BaseModel):
    id: str = Field(..., description="Unique identifier for the conversation")
    title: str = Field(..., description="Title of the conversation")
    updated_at: datetime = Field(..., description="Timestamp of last update")

class NewConversationRequest(BaseModel):
    title: Optional[str] = Field(None, description="Optional title for the new conversation")

class UpdateConversationRequest(BaseModel):
    title: Optional[str] = Field(None, description="New title for the conversation")

