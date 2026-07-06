
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import uuid4

from app.auth.routes import get_current_active_user
from app.auth.models import User
from app.chat.models import Conversation, ChatMessage, ConversationSummary, NewConversationRequest, UpdateConversationRequest
from app.chat.repository import chat_repository
from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.api.dependencies import get_agent
from app.models import QueryRequest, QueryResponse # Re-using QueryRequest for chat messages

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
    conversation = chat_repository.update_conversation_title(conversation_id, current_user.id, request.title)
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
    user_message = ChatMessage(
        id=str(uuid4()),
        user_id=current_user.id,
        conversation_id=conversation_id,
        role="user",
        content=query_request.question
    )
    chat_repository.add_message(conversation_id, current_user.id, user_message)

    # Invoke the RAG agent with the user's query
    # For simplicity, we're not passing full conversation history to the agent yet
    # This will be an enhancement for more context-aware responses
    agent_response: QueryResponse = agent.invoke(
        query_request.question,
        alpha=query_request.alpha,
        top_k=query_request.top_k,
        rerank_top_n=query_request.rerank_top_n,
        mode=query_request.mode,
        case_id=query_request.case_id,
        include_patient_education=query_request.include_patient_education,
        # request_id is handled by middleware, not directly passed here
    )

    # Add agent's response to conversation
    agent_message = ChatMessage(
        id=str(uuid4()),
        user_id=current_user.id,
        conversation_id=conversation_id,
        role="assistant",
        content=agent_response.answer,
        citations=[c.model_dump() if hasattr(c, 'model_dump') else c for c in (agent_response.citations or [])],
        tool_trace=[t.model_dump() if hasattr(t, 'model_dump') else t for t in (agent_response.tool_trace or [])],
        safety_flags=agent_response.safety.model_dump() if hasattr(agent_response.safety, 'model_dump') else agent_response.safety,
        knowledge_path=agent_response.knowledge_path.model_dump() if hasattr(agent_response, 'knowledge_path') and agent_response.knowledge_path and hasattr(agent_response.knowledge_path, 'model_dump') else (agent_response.knowledge_path if hasattr(agent_response, 'knowledge_path') else None)
    )
    chat_repository.add_message(conversation_id, current_user.id, agent_message)

    return agent_message
