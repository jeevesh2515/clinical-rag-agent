export interface ChatMessage {
  id: string
  user_id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  citations?: Citation[]
  tool_trace?: ToolTraceItem[]
  safety_flags?: SafetyFlags
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  messages: ChatMessage[]
}

export interface ConversationSummary {
  id: string
  title: string
  updated_at: string
}

export interface Citation {
  source_id: string
  title: string
  page: number
  chunk_id: string
  quote: string
  source_url?: string
  source_version?: string
  source_type?: string
  retrieved_at?: string
  review_date?: string
  effective_date?: string
  license_notes?: string
}

export interface ToolTraceItem {
  name: string
  inputs: Record<string, any>
  outputs: Record<string, any>
  timestamp?: string
}

export interface SafetyFlags {
  medical_disclaimer: boolean
  unsupported_claims_detected: boolean
  refusal_reason?: string
}

export interface NewConversationRequest {
  title?: string
}

export interface UpdateConversationRequest {
  title?: string
}

export interface AddMessageRequest {
  question: string
  mode?: 'patient' | 'clinician'
  case_id?: string
  include_patient_education?: boolean
}
