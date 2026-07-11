import { useState, useEffect, useRef } from 'react'
import {
  Plus, MessageSquare, LogOut,
  Send, Activity, BookOpen, Shield, Brain, Heart,
  X, AlertCircle, CheckCircle2,
  Stethoscope, Search, Trash2,
  PanelLeftClose,
  PanelLeft, Sparkles,
  ArrowUp, FlaskRound, Wind,
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import LandingPage from './components/LandingPage'
import Markdown from './components/Markdown'
import ThemeToggle from './components/ThemeToggle'
import PressureReliefModal from './components/relief/PressureReliefModal'
import { CitationCard } from './components/chat/CitationCard'
import { Button, Pill, Avatar, Kbd, cn } from './components/ui/primitives'
import { MODELS, DEFAULT_MODEL, getModel, type ModelOption } from './lib/models'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  username: string
  email: string
  roles: string[]
  is_active: boolean
  full_name?: string
  date_of_birth?: string
  notes?: string
}

interface Citation {
  source_id: string
  title: string
  page?: number
  chunk_id?: string
  quote?: string
  source_url?: string
  organization?: string
  publication_year?: number
  source_type?: string
  source_version?: string
  retrieved_at?: string
  review_date?: string
  effective_date?: string
  license_notes?: string
}

interface ToolTrace {
  name: string
  input_summary?: string
  output_summary?: string
  inputs?: Record<string, unknown>
  output?: unknown
  duration_ms?: number
}

interface SafetyFlags {
  medical_disclaimer?: boolean
  unsupported_claims_detected?: boolean
  refusal_reason?: string
}

interface KnowledgePath {
  path?: string
  reason?: string
  okf_concepts?: Array<{ source_path: string; title: string; confidence: number }>
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  citations?: Citation[]
  tool_trace?: ToolTrace[]
  safety_flags?: SafetyFlags
  knowledge_path?: KnowledgePath
}

interface ConversationSummary {
  id: string
  title: string
  updated_at: string
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages: ChatMessage[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string) || ''

const SUGGESTED_QUESTIONS = [
  { icon: Heart,        text: 'When should drug treatment be considered for Stage 1 hypertension?', category: 'Guidelines', tone: 'text-rose-500' },
  { icon: Activity,     text: 'What is the BP target for patients with CKD Stage 3?',            category: 'Targets',    tone: 'text-amber-500' },
  { icon: FlaskRound,   text: 'Calculate MAP for blood pressure 140/90',                       category: 'Calculator', tone: 'text-violet-500' },
  { icon: Brain,        text: 'What are the first-line medications for hypertension?',         category: 'Treatment',  tone: 'text-emerald-500' },
  { icon: Stethoscope,  text: 'What follow-up schedule is recommended after starting antihypertensives?', category: 'Follow-up', tone: 'text-cyan-500' },
  { icon: BookOpen,     text: 'Summarize NICE NG136 guidelines for hypertension management',  category: 'NICE',       tone: 'text-brand-500' },
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

// ─── API Client ───────────────────────────────────────────────────────────────

class ApiClient {
  private token: string | null = null
  setToken(token: string | null) { this.token = token }

  private headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' }
    if (this.token) h['Authorization'] = `Bearer ${this.token}`
    return h
  }

  async login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const form = new URLSearchParams({ username, password })
    const res = await fetch(`${API_BASE}/api/auth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Login failed') }
    return res.json()
  }

  async getCurrentUser(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/api/auth/users/me`, { headers: this.headers() })
    if (!res.ok) throw new Error('Failed to get user')
    return res.json()
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await fetch(`${API_BASE}/api/chat/conversations`, { headers: this.headers() })
    if (!res.ok) throw new Error('Failed to list conversations')
    return res.json()
  }

  async createConversation(title?: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/api/chat/conversations`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ title: title || 'New Chat' }),
    })
    if (!res.ok) throw new Error('Failed to create conversation')
    return res.json()
  }

  async getConversation(id: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${id}`, { headers: this.headers() })
    if (!res.ok) throw new Error('Failed to get conversation')
    return res.json()
  }

  async deleteConversation(id: string): Promise<void> {
    await fetch(`${API_BASE}/api/chat/conversations/${id}`, { method: 'DELETE', headers: this.headers() })
  }

  async sendMessage(
    conversationId: string,
    question: string,
    mode: string,
    caseId?: string,
    modelId?: string
  ): Promise<ChatMessage> {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/message`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ question, mode, case_id: caseId, model_id: modelId }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.detail || 'Failed to send message')
    }
    return res.json()
  }

  async listModels(): Promise<{ models: ModelOption[]; active: string }> {
    // Optional endpoint — falls back to static list if unavailable
    try {
      const res = await fetch(`${API_BASE}/api/models`, { headers: this.headers() })
      if (res.ok) return res.json()
    } catch { /* */ }
    return { models: MODELS, active: DEFAULT_MODEL }
  }
}

const api = new ApiClient()

// ─── Tiny UI helpers ──────────────────────────────────────────────────────────

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return <span className={cn('inline-block border-2 border-current border-t-transparent rounded-full animate-spin', s)} />
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  isOpen, onToggle, user, conversations, currentConvId, onNewChat, onSelectConv, onDeleteConv, onLogout, isLoading,
}: {
  isOpen: boolean; onToggle: () => void; user: UserProfile; conversations: ConversationSummary[]
  currentConvId: string | null; onNewChat: () => void; onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void; onLogout: () => void; isLoading: boolean
}) {
  const [search, setSearch] = useState('')
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)
  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))

  const now = new Date()
  const today = filtered.filter((c) => new Date(c.updated_at).toDateString() === now.toDateString())
  const week = filtered.filter((c) => {
    const d = now.getTime() - new Date(c.updated_at).getTime()
    return d > 86400000 && d < 7 * 86400000
  })
  const older = filtered.filter((c) => now.getTime() - new Date(c.updated_at).getTime() >= 7 * 86400000)

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white/80 dark:bg-ink-950/80 backdrop-blur-xl border-r border-ink-200/60 dark:border-ink-800',
        'transition-all duration-300 ease-smooth shrink-0 z-10',
        isOpen ? 'w-[280px]' : 'w-0 overflow-hidden'
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-ink-200/60 dark:border-ink-800">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-soft">
            <Stethoscope size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-bold text-ink-900 dark:text-white tracking-tight leading-none">
              CardioCompass
            </h1>
            <p className="font-mono text-[10px] text-ink-500 dark:text-ink-400 mt-1 leading-none">
              Hypertension AI
            </p>
          </div>
        </div>
        <Button variant="icon" onClick={onToggle} title="Collapse sidebar" aria-label="Collapse sidebar">
          <PanelLeftClose size={16} />
        </Button>
      </div>

      {/* New chat */}
      <div className="px-3 py-3">
        <Button
          variant="primary"
          fullWidth
          onClick={onNewChat}
          icon={<Plus size={16} />}
          className="!justify-start"
        >
          New chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-ink-50 dark:bg-ink-900/60 border border-ink-200/60 dark:border-ink-800 text-ink-900 dark:text-white pl-9 pr-3 py-2 text-sm rounded-xl focus:outline-none focus:border-brand-500/40 focus:bg-white dark:focus:bg-ink-900 transition-all placeholder:text-ink-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-premium px-2 py-1">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare size={18} className="text-ink-300 dark:text-ink-700 mx-auto mb-2.5" />
            <p className="text-ink-500 text-xs">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {today.length > 0 && <SectionLabel>Today</SectionLabel>}
            {today.map((c) => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
            {week.length > 0 && <SectionLabel>This week</SectionLabel>}
            {week.map((c) => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
            {older.length > 0 && <SectionLabel>Earlier</SectionLabel>}
            {older.map((c) => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
          </div>
        )}
      </div>

      {/* Footer user card */}
      <div className="p-3 border-t border-ink-200/60 dark:border-ink-800">
        <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50 dark:hover:bg-ink-900/60 transition-colors">
          <Avatar name={user.username} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{user.username}</p>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 capitalize">{user.roles[0] || 'patient'}</p>
          </div>
          <Button variant="icon" onClick={onLogout} title="Sign out" aria-label="Sign out">
            <LogOut size={15} />
          </Button>
        </div>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-ink-500">
      {children}
    </p>
  )
}

function ConvItem({ conv, isActive, hovered, onHover, onSelect, onDelete }: {
  conv: ConversationSummary; isActive: boolean; hovered: boolean
  onHover: (id: string | null) => void; onSelect: (id: string) => void; onDelete: (id: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(conv.id)}
      onMouseEnter={() => onHover(conv.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200',
        isActive
          ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
          : 'text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-900/60'
      )}
    >
      <MessageSquare size={14} className={cn('shrink-0', isActive ? 'text-brand-500' : 'text-ink-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate leading-tight">{conv.title}</p>
        <p className={cn('text-[10.5px] mt-0.5', isActive ? 'text-brand-600/70 dark:text-brand-300/70' : 'text-ink-400')}>
          {formatRelativeTime(conv.updated_at)}
        </p>
      </div>
      {(hovered || isActive) && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
          className="p-1 rounded-md text-ink-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      )}
    </button>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onCitationClick, username, index }: {
  message: ChatMessage; onCitationClick: (c: Citation[]) => void; username: string; index?: number
}) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn('flex gap-3 md:gap-4 w-full animate-fade-up')}
      style={{ animationDelay: `${(index || 0) * 60}ms` }}
    >
      {isUser ? (
        <>
          <Avatar name={username} size={36} tone="ink" className="mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink-700 dark:text-ink-200 mb-1.5">{username}</p>
            <div className="rounded-2xl rounded-tl-md bg-ink-100 dark:bg-ink-800/60 px-4 py-3 text-[15px] text-ink-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-soft shrink-0 mt-1">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink-700 dark:text-ink-200 mb-1.5">Hypertension AI</p>
            <div className="rounded-2xl rounded-tl-md bg-white dark:bg-ink-900/60 border border-ink-200/60 dark:border-ink-800 px-5 py-4 shadow-soft-sm">
              <Markdown content={message.content} />
              {(message.citations?.length || message.knowledge_path?.path || message.safety_flags?.medical_disclaimer) && (
                <div className="mt-5 pt-4 border-t border-ink-200/60 dark:border-ink-800 flex flex-wrap items-center gap-2">
                  {message.citations && message.citations.length > 0 && (
                    <button
                      onClick={() => onCitationClick(message.citations!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-700 hover:shadow-soft-sm hover:-translate-y-[0.5px] transition-all duration-200 active:scale-95"
                    >
                      <BookOpen size={12} />
                      {message.citations.length} source{message.citations.length !== 1 ? 's' : ''}
                    </button>
                  )}
                  {message.knowledge_path?.path && (
                    <Pill variant={message.knowledge_path.path === 'okf' ? 'okf' : 'brand'}>
                      {message.knowledge_path.path === 'okf' ? 'OKF' : 'RAG'}
                    </Pill>
                  )}
                  {message.safety_flags?.unsupported_claims_detected && (
                    <Pill variant="warning" icon={<AlertCircle size={10} />}>Unverified claims</Pill>
                  )}
                  {message.safety_flags?.medical_disclaimer && (
                    <Pill variant="default" icon={<Shield size={10} />}>Educational only</Pill>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 md:gap-4 w-full animate-fade-up">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-soft shrink-0 mt-1">
        <Sparkles size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-ink-700 dark:text-ink-200 mb-1.5">Hypertension AI</p>
        <div className="rounded-2xl rounded-tl-md bg-white dark:bg-ink-900/60 border border-ink-200/60 dark:border-ink-800 px-5 py-4 inline-flex items-center gap-1.5">
          {[0, 150, 300].map((d) => (
            <div
              key={d}
              className="w-2 h-2 rounded-full bg-brand-500/70 animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Welcome screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ onQuestionClick, onOpenRelief }: { onQuestionClick: (text: string) => void; onOpenRelief: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto scroll-premium">
      <div className="flex flex-col items-center justify-center min-h-full text-center px-6 py-12 max-w-3xl mx-auto">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-brand-500/20 blur-2xl rounded-full" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-soft-lg">
            <Stethoscope size={26} className="text-white" />
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-900 dark:text-white tracking-tight">
          How can I help with your blood pressure today?
        </h1>
        <p className="mt-3 text-[15px] text-ink-500 dark:text-ink-400 leading-relaxed max-w-lg">
          Grounded in{' '}
          <span className="font-semibold text-ink-700 dark:text-ink-200">NICE</span>,{' '}
          <span className="font-semibold text-ink-700 dark:text-ink-200">ACC/AHA</span>,{' '}
          <span className="font-semibold text-ink-700 dark:text-ink-200">ESC/ESH</span> &{' '}
          <span className="font-semibold text-ink-700 dark:text-ink-200">WHO</span> guidelines.
          Every claim is cited. No hallucinated doses.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Pill variant="success" icon={<CheckCircle2 size={11} />}>Cited answers</Pill>
          <Pill variant="info" icon={<Shield size={11} />}>Educational only</Pill>
          <Pill variant="okf" icon={<Brain size={11} />}>OKF + RAG hybrid</Pill>
        </div>

        {/* Pressure relief CTA */}
        <button
          onClick={onOpenRelief}
          className="mt-6 group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-calm-50 hover:bg-calm-100 dark:bg-calm-500/10 dark:hover:bg-calm-500/15 border border-calm-200/60 dark:border-calm-500/30 transition-all duration-300 hover:shadow-soft hover:-translate-y-[1px]"
        >
          <div className="w-8 h-8 rounded-lg bg-calm-500/15 flex items-center justify-center">
            <Wind size={15} className="text-calm-600 dark:text-calm-300" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-calm-800 dark:text-calm-200">Feeling tense? Try Pressure Relief</p>
            <p className="text-[11px] text-calm-700/80 dark:text-calm-300/70">Guided breathing · 1–5 min · lower acute BP</p>
          </div>
          <ArrowUp size={14} className="text-calm-600 dark:text-calm-300 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500 mt-10 mb-3">Try asking</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuestionClick(q.text)}
              className="group flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-ink-900/60 border border-ink-200/60 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-soft text-left transition-all duration-250"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-ink-100 dark:bg-ink-800', q.tone)}>
                <q.icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider leading-none">{q.category}</p>
                <p className="text-[13px] text-ink-900 dark:text-white leading-snug font-medium mt-1">{q.text}</p>
              </div>
              <ArrowUp size={13} className="text-ink-400 group-hover:text-brand-500 group-hover:-translate-y-0.5 transition-all rotate-45 shrink-0 mt-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Model selector ──────────────────────────────────────────────────────────

function ModelSelector({ value, onChange, models }: {
  value: string; onChange: (id: string) => void; models: ModelOption[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = getModel(value)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800/60 transition-colors"
        title="Switch model"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="hidden md:inline">{current.label}</span>
        <span className="md:hidden">{current.label.split(' ')[0]}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 shadow-soft-xl p-2 z-50 animate-fade-up">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
            Choose model
          </p>
          <div className="max-h-80 overflow-y-auto scroll-premium">
            {models.map((m) => {
              const selected = m.id === value
              return (
                <button
                  key={m.id}
                  onClick={() => { onChange(m.id); setOpen(false) }}
                  className={cn(
                    'w-full text-left p-2.5 rounded-xl transition-colors',
                    selected ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-semibold', selected ? 'text-brand-700 dark:text-brand-300' : 'text-ink-900 dark:text-white')}>
                      {m.label}
                    </p>
                    {m.badge && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-calm-50 text-calm-700 dark:bg-calm-500/15 dark:text-calm-300">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-500 dark:text-ink-400 mt-0.5">{m.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [page, setPage] = useState<'landing' | 'login' | 'signup'>('landing')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingConvs, setIsFetchingConvs] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [panelCitations, setPanelCitations] = useState<Citation[]>([])
  const [reliefOpen, setReliefOpen] = useState(false)
  const [modelId, setModelId] = useState<string>(() => {
    try { return localStorage.getItem('cw_model') || DEFAULT_MODEL } catch { return DEFAULT_MODEL }
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize composer
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [inputValue])

  useEffect(() => {
    const savedToken = localStorage.getItem('cw_token')
    if (savedToken) {
      api.setToken(savedToken)
      api.getCurrentUser()
        .then(setUser)
        .catch(() => localStorage.removeItem('cw_token'))
    }
  }, [])

  useEffect(() => {
    if (user) {
      setIsFetchingConvs(true)
      api.listConversations().then(setConversations).catch(() => {}).finally(() => setIsFetchingConvs(false))
    }
  }, [user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  useEffect(() => {
    try { localStorage.setItem('cw_model', modelId) } catch { /* */ }
  }, [modelId])

  const handleLogin = async (token: string) => {
    api.setToken(token)
    const u = await api.getCurrentUser()
    setUser(u)
  }
  const handleSignup = async (token: string) => {
    api.setToken(token)
    const u = await api.getCurrentUser()
    setUser(u)
  }

  const handleLogout = () => {
    setUser(null); api.setToken(null); localStorage.removeItem('cw_token')
    setConversations([]); setMessages([]); setCurrentConvId(null)
    setPage('landing')
  }

  const handleNewChat = () => {
    setCurrentConvId(null); setMessages([]); setInputValue('')
    setPanelCitations([]); setEvidenceOpen(false)
  }

  const handleSelectConv = async (id: string) => {
    setCurrentConvId(id)
    try {
      const conv = await api.getConversation(id)
      setMessages(conv.messages || [])
      const last = conv.messages?.[conv.messages.length - 1]
      if (last?.role === 'assistant') setPanelCitations(last.citations || [])
      setEvidenceOpen(true)
    } catch { setMessages([]) }
  }

  const handleDeleteConv = async (id: string) => {
    await api.deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (currentConvId === id) { setCurrentConvId(null); setMessages([]) }
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    const question = inputValue.trim()
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      let convId = currentConvId
      if (!convId) {
        const conv = await api.createConversation(question.slice(0, 60))
        convId = conv.id
        setCurrentConvId(convId)
        setConversations((prev) => [{ id: conv.id, title: conv.title, updated_at: conv.updated_at }, ...prev])
      }
      const assistantMsg = await api.sendMessage(convId, question, 'patient', undefined, modelId)
      setMessages((prev) => [...prev, assistantMsg])
      setPanelCitations(assistantMsg.citations || [])
      if (assistantMsg.citations?.length) setEvidenceOpen(true)
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c))
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `**Something went wrong.** ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentConv = conversations.find((c) => c.id === currentConvId)

  if (!user) {
    if (page === 'landing') return <LandingPage onLogin={() => setPage('login')} onRegister={() => setPage('signup')} />
    if (page === 'login') return <LoginPage onLogin={handleLogin} onSwitchToSignup={() => setPage('signup')} onBackToHome={() => setPage('landing')} />
    return <SignupPage onSignup={handleSignup} onSwitchToLogin={() => setPage('login')} onBackToHome={() => setPage('landing')} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-ink-950">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        user={user}
        conversations={conversations}
        currentConvId={currentConvId}
        onNewChat={handleNewChat}
        onSelectConv={handleSelectConv}
        onDeleteConv={handleDeleteConv}
        onLogout={handleLogout}
        isLoading={isFetchingConvs}
      />

      {/* Main chat area */}
      <main className="flex flex-col flex-1 min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-ink-200/60 dark:border-ink-800 bg-white/80 dark:bg-ink-950/80 backdrop-blur-xl shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!sidebarOpen && (
              <Button variant="icon" onClick={() => setSidebarOpen(true)} title="Open sidebar">
                <PanelLeft size={16} />
              </Button>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-sm md:text-base font-bold text-ink-900 dark:text-white truncate">
                {currentConv?.title || 'New conversation'}
              </h2>
              <p className="text-[11px] text-ink-500 dark:text-ink-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {getModel(modelId).label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReliefOpen(true)}
              icon={<Wind size={14} />}
              className="!text-calm-600 dark:!text-calm-300 hover:!bg-calm-50 dark:hover:!bg-calm-500/10 breathe-glow"
            >
              <span className="hidden sm:inline">Pressure Relief</span>
            </Button>
            <ModelSelector value={modelId} onChange={setModelId} models={MODELS} />
            <ThemeToggle />
            <Button
              variant={evidenceOpen ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setEvidenceOpen(!evidenceOpen)}
              icon={<BookOpen size={14} />}
            >
              <span className="hidden md:inline">{panelCitations.length} source{panelCitations.length !== 1 ? 's' : ''}</span>
              <span className="md:hidden">Sources</span>
            </Button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scroll-premium">
          {messages.length === 0 ? (
            <WelcomeScreen onQuestionClick={(text) => setInputValue(text)} onOpenRelief={() => setReliefOpen(true)} />
          ) : (
            <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-10 space-y-6 sm:space-y-8 max-w-3xl mx-auto pb-32">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  username={user?.username || 'You'}
                  index={i}
                  onCitationClick={(c) => { setPanelCitations(c); setEvidenceOpen(true) }}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Floating Pressure Relief button (only when there are messages) */}
        {messages.length > 0 && (
          <button
            onClick={() => setReliefOpen(true)}
            className="absolute right-4 sm:right-6 bottom-28 z-20 group inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/95 dark:bg-ink-900/95 backdrop-blur-xl border border-calm-200/60 dark:border-calm-500/30 shadow-soft-lg hover:shadow-glow-calm hover:-translate-y-[2px] transition-all duration-300 breathe-glow"
            title="Pressure Relief"
          >
            <span className="relative w-6 h-6 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-calm-500/20 animate-ping" />
              <span className="absolute inset-1.5 rounded-full bg-calm-500/30 animate-ping" style={{ animationDelay: '1s' }} />
              <Wind size={16} className="relative text-calm-600 dark:text-calm-300" />
            </span>
            <div className="text-left">
              <span className="text-xs font-bold text-calm-700 dark:text-calm-200 block leading-tight">Breathe</span>
              <span className="text-[9px] text-calm-500 dark:text-calm-400 block leading-tight">1 min relief</span>
            </div>
          </button>
        )}

        {/* Composer */}
        <div className="px-4 sm:px-6 md:px-10 pt-3 pb-5 bg-gradient-to-t from-ink-50 via-ink-50/90 to-transparent dark:from-ink-950 dark:via-ink-950/90 z-30">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-2xl bg-white dark:bg-ink-900 border border-ink-200/60 dark:border-ink-800 shadow-soft transition-all duration-250 focus-within:border-brand-500/40 focus-within:shadow-soft-lg">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a clinical question about hypertension…"
                rows={1}
                className="block w-full bg-transparent text-[15px] text-ink-900 dark:text-white placeholder:text-ink-400 leading-relaxed resize-none focus:outline-none px-4 py-3.5 pr-24 max-h-40 scroll-premium"
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReliefOpen(true)}
                  className="!p-2 !text-calm-600 dark:!text-calm-300 hover:!bg-calm-50 dark:hover:!bg-calm-500/10"
                  title="Pressure Relief"
                >
                  <Wind size={16} />
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="!p-2.5 !rounded-xl"
                  title="Send (Enter)"
                  aria-label="Send"
                >
                  {isLoading ? <Spinner size="sm" /> : <Send size={15} />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5 px-1">
              <p className="text-[10.5px] text-ink-500 dark:text-ink-400 flex items-center gap-1.5">
                <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for new line
              </p>
              <Pill variant="default" icon={<Shield size={10} />}>Educational purposes only</Pill>
            </div>
          </div>
        </div>
      </main>

      {/* Evidence panel */}
      <EvidenceDrawer
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        citations={panelCitations}
      />

      {/* Pressure Relief modal */}
      <PressureReliefModal open={reliefOpen} onClose={() => setReliefOpen(false)} />
    </div>
  )
}

// ─── Evidence Drawer ─────────────────────────────────────────────────────────

function EvidenceDrawer({ open, onClose, citations }: {
  open: boolean; onClose: () => void; citations: Citation[]
}) {
  if (!open) return null
  return (
    <>
      <div
        className="fixed inset-0 bg-ink-900/30 backdrop-blur-sm z-30 animate-fade-in"
        onClick={onClose}
        aria-label="Close evidence"
      />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-ink-950 border-l border-ink-200/60 dark:border-ink-800 z-40 flex flex-col animate-fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200/60 dark:border-ink-800">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900 dark:text-white">Sources & evidence</h3>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">
              {citations.length} citation{citations.length !== 1 ? 's' : ''} from this conversation
            </p>
          </div>
          <Button variant="icon" onClick={onClose} title="Close" aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-premium p-4 space-y-3">
          {citations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-ink-100 dark:bg-ink-900 mx-auto mb-3 flex items-center justify-center">
                <BookOpen size={18} className="text-ink-400" />
              </div>
              <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">No sources yet</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">Ask a question and the citations will appear here.</p>
            </div>
          ) : (
            citations.map((c, i) => <CitationCard key={i} citation={c} index={i} />)
          )}
        </div>
      </aside>
    </>
  )
}
