import { useState, useCallback } from 'react'
import type { Conversation, ConversationSummary, ChatMessage } from '../types/chat'

const API_BASE = 'http://localhost:8000'

export const useChat = (token: string | null) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }

  const createConversation = useCallback(
    async (title?: string): Promise<Conversation | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/chat/conversations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ title }),
        })
        if (!response.ok) throw new Error('Failed to create conversation')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create conversation')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  const listConversations = useCallback(async (): Promise<ConversationSummary[]> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/chat/conversations`, {
        headers,
      })
      if (!response.ok) throw new Error('Failed to list conversations')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list conversations')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [token])

  const getConversation = useCallback(
    async (conversationId: string): Promise<Conversation | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
          headers,
        })
        if (!response.ok) throw new Error('Failed to get conversation')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get conversation')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  const updateConversationTitle = useCallback(
    async (conversationId: string, title: string): Promise<Conversation | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ title }),
        })
        if (!response.ok) throw new Error('Failed to update conversation')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update conversation')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
          method: 'DELETE',
          headers,
        })
        if (!response.ok) throw new Error('Failed to delete conversation')
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete conversation')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  const addMessage = useCallback(
    async (conversationId: string, question: string, mode?: string, caseId?: string): Promise<ChatMessage | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}/message`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            question,
            mode: mode || 'patient',
            case_id: caseId,
            include_patient_education: false,
          }),
        })
        if (!response.ok) throw new Error('Failed to add message')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add message')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  return {
    isLoading,
    error,
    createConversation,
    listConversations,
    getConversation,
    updateConversationTitle,
    deleteConversation,
    addMessage,
  }
}
