// Curated list of model options the user can choose from.
// The backend will respect `model_id` if the matching provider key is configured.

export type ModelProvider = 'cohere' | 'openai' | 'anthropic' | 'google'

export interface ModelOption {
  id: string
  label: string
  provider: ModelProvider
  description: string
  badge?: string
}

export const MODELS: ModelOption[] = [
  { id: 'cohere-command-a',    label: 'Cohere Command A',     provider: 'cohere',    description: 'Default · grounded, fast, long context',         badge: 'Default' },
  { id: 'cohere-command-r',    label: 'Cohere Command R+',    provider: 'cohere',    description: 'Retrieval-augmented generation, optimized for RAG' },
  { id: 'openai-gpt-4o',       label: 'OpenAI GPT-4o',        provider: 'openai',    description: 'OpenAI flagship, multimodal' },
  { id: 'openai-gpt-4o-mini',  label: 'OpenAI GPT-4o mini',   provider: 'openai',    description: 'Faster, cheaper, still strong' },
  { id: 'anthropic-claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Anthropic\'s best balance of speed and reasoning' },
  { id: 'anthropic-claude-3-haiku',     label: 'Claude 3 Haiku',    provider: 'anthropic', description: 'Fastest Anthropic model' },
  { id: 'google-gemini-1.5-pro',   label: 'Gemini 1.5 Pro',   provider: 'google',    description: 'Google\'s long-context model' },
  { id: 'google-gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'google',    description: 'Fast, cheap, very long context' },
]

export const DEFAULT_MODEL = MODELS[0].id

export function getModel(id: string | undefined | null): ModelOption {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}
