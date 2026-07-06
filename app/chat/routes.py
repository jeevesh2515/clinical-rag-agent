
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, List
from uuid import uuid4

from app.auth.routes import get_current_active_user
from app.auth.models import User
from app.chat.models import Conversation, ChatMessage, ConversationSummary, NewConversationRequest, UpdateConversationRequest
from app.chat.repository import chat_repository
from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.api.dependencies import get_agent
from app.models import QueryRequest, QueryResponse

router = APIRouter()

@router.post("/conversations", response_model=Conversation, status_code=status.HTTP_201_CREATED)
async def create_new_conversation(
    request: NewConversationRequest,
    current_user: User = Depends(get_current_active_user)
):
    conversation = chat_repository.create_conversation(current_user.id, request.title)
    return conversation

@router.get("/conversations", response_model=List[ConversationSummary])
async def list_user_conversations(current_user: User = Depends(get_current_active_user)):
    return chat_repository.list_conversations(current_user.id)

@router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_single_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user)
):
    conversation = chat_repository.get_conversation(conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation

@router.put("/conversations/{conversation_id}", response_model=Conversation)
async def update_conversation_title(
    conversation_id: str,
    request: UpdateConversationRequest,
    current_user: User = Depends(get_current_active_user)
):
    conversation = chat_repository.update_conversation_title(conversation_id, current_user.id, request.title or "Untitled")
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_single_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user)
):
    if not chat_repository.delete_conversation(conversation_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return

@router.post("/conversations/{conversation_id}/message", response_model=ChatMessage)
async def add_message_to_conversation(
    conversation_id: str,
    query_request: QueryRequest, # Re-using QueryRequest for the user's message content
    current_user: User = Depends(get_current_active_user),
    agent: ClinicalRAGAgent = Depends(get_agent)
):
    conversation = chat_repository.get_conversation(conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Add user's message to conversation
    user_message = ChatMessage(  # type: ignore[call-arg]
        id=str(uuid4()),
        user_id=current_user.id,
        conversation_id=conversation_id,
        role="user",
        content=query_request.question
    )
    chat_repository.add_message(conversation_id, current_user.id, user_message)

    # Invoke the RAG agent with the user's query
    agent_response: QueryResponse = agent.invoke(
        query_request.question,
        alpha=query_request.alpha or 0.55,
        top_k=query_request.top_k or 20,
        rerank_top_n=query_request.rerank_top_n or 6,
        mode=query_request.mode,
        case_id=query_request.case_id,
        include_patient_education=query_request.include_patient_education,
    )

    # Add agent's response to conversation
    citations_list: List[dict[str, Any]] = [
        c.model_dump() if hasattr(c, 'model_dump') else dict(c)  # type: ignore[arg-type]
        for c in (agent_response.citations or [])
    ]
    tool_trace_list: List[dict[str, Any]] = [
        t.model_dump() if hasattr(t, 'model_dump') else dict(t)  # type: ignore[arg-type]
        for t in (agent_response.tool_trace or [])
    ]
    safety_dict: dict[str, Any] = (
        agent_response.safety.model_dump()
        if hasattr(agent_response.safety, 'model_dump')
        else dict(agent_response.safety)
    )
    kp_dict: dict[str, Any] | None = (
        agent_response.knowledge_path.model_dump()
        if agent_response.knowledge_path and hasattr(agent_response.knowledge_path, 'model_dump')
        else None
    )
    agent_message = ChatMessage(
        id=str(uuid4()),
        user_id=current_user.id,
        conversation_id=conversation_id,
        role="assistant",
        content=agent_response.answer,
        citations=citations_list,
        tool_trace=tool_trace_list,
        safety_flags=safety_dict,
        knowledge_path=kp_dict,
    )
    chat_repository.add_message(conversation_id, current_user.id, agent_message)

    return agent_message
