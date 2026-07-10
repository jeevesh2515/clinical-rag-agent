import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus, MessageSquare, LogOut, User,
  Send, Activity, BookOpen, Shield, Zap, Brain, Heart,
  X, Loader2, AlertCircle, CheckCircle2,
  FileText, ExternalLink, Info, Stethoscope, Search, Trash2,
  BarChart3, Network, Database, Copy, Check, PanelLeftClose,
  PanelLeft, Sparkles, ChevronDown, ChevronRight,
  Quote, ArrowUp, FlaskRound, type LucideIcon
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import LandingPage from './components/LandingPage'
import Markdown from './components/Markdown'
import ThemeToggle from './components/ThemeToggle'

// Permissive icon type — lucide props allow string | number for size, but we
// only ever pass numbers.
type IconType = LucideIcon

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
  { icon: Heart, text: 'When should drug treatment be considered for Stage 1 hypertension?', category: 'Guidelines', tone: 'text-rose-500' },
  { icon: Activity, text: 'What is the BP target for patients with CKD Stage 3?', category: 'Targets', tone: 'text-amber-500' },
  { icon: FlaskRound, text: 'Calculate MAP for blood pressure 140/90', category: 'Calculator', tone: 'text-violet-500' },
  { icon: Brain, text: 'What are the first-line medications for hypertension?', category: 'Treatment', tone: 'text-emerald-500' },
  { icon: Stethoscope, text: 'What follow-up schedule is recommended after starting antihypertensives?', category: 'Follow-up', tone: 'text-cyan-500' },
  { icon: BookOpen, text: 'Summarize NICE NG136 guidelines for hypertension management', category: 'NICE', tone: 'text-blue-500' },
]

const CASES = [
  { id: '', label: 'No case selected' },
  { id: 'htn-001', label: 'htn-001 — 55M Stage 1 HTN' },
  { id: 'htn-002', label: 'htn-002 — 68F HTN + CKD' },
  { id: 'htn-003', label: 'htn-003 — 32F HTN + Pregnancy' },
  { id: 'htn-004', label: 'htn-004 — 72M HTN + Diabetes' },
  { id: 'htn-005', label: 'htn-005 — 48M Resistant HTN' },
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

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

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
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

  async register(username: string, email: string, password: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ username, email, password }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Registration failed') }
    return res.json()
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

  async updateProfile(data: { full_name?: string; email?: string; date_of_birth?: string; notes?: string }): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/api/auth/users/me`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.detail || 'Failed to update profile')
    }
    return res.json()
  }

  async listUploads(): Promise<{ uploads: any[]; total: number }> {
    const res = await fetch(`${API_BASE}/api/uploads`, { headers: this.headers() })
    if (!res.ok) throw new Error('Failed to list uploads')
    return res.json()
  }

  async createUpload(file: File, category: string, userNote?: string): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)
    if (userNote) formData.append('user_note', userNote)
    
    // Note: Do not set Content-Type header manually when sending FormData,
    // browser will set it with the correct boundary parameters automatically.
    const headers = { ...this.headers() } as any
    delete headers['Content-Type']
    
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'POST',
      headers,
      body: formData
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.detail || 'Upload failed')
    }
    return res.json()
  }

  async deleteUpload(uploadId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: this.headers()
    })
    if (!res.ok) throw new Error('Failed to delete upload')
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

  async sendMessage(conversationId: string, question: string, mode: string, caseId?: string): Promise<ChatMessage> {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/message`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ question, mode, case_id: caseId }),
    })
    if (!res.ok) throw new Error('Failed to send message')
    return res.json()
  }
}

const api = new ApiClient()

// ─── Small Components ─────────────────────────────────────────────────────────

function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-6 h-6' }
  return <Loader2 className={cn('animate-spin', s[size], className)} />
}

function Pill({
  children, variant = 'default', className = '', icon: Icon
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'okf' | 'rag' | 'neutral'
  className?: string
  icon?: IconType
}) {
  const v: Record<string, string> = {
    default: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    danger:  'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
    info:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
    okf:     'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
    rag:     'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30',
    neutral: 'bg-white/80 text-gray-600 border-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700/60',
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border tracking-tight',
      v[variant],
      className,
    )}>
      {Icon && <Icon size={10} className="-ml-0.5" />}
      {children}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-gray-400" />}
    </button>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ isOpen, onToggle, user, conversations, currentConvId, onNewChat, onSelectConv, onDeleteConv, onLogout, onOpenProfile, isLoading }: {
  isOpen: boolean; onToggle: () => void; user: UserProfile; conversations: ConversationSummary[]
  currentConvId: string | null; onNewChat: () => void; onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void; onLogout: () => void; onOpenProfile: () => void; isLoading: boolean
}) {
  const [search, setSearch] = useState('')
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)
  const filtered = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))

  const now = new Date()
  const today = filtered.filter(c => new Date(c.updated_at).toDateString() === now.toDateString())
  const week = filtered.filter(c => {
    const d = now.getTime() - new Date(c.updated_at).getTime()
    return d > 86400000 && d < 7 * 86400000
  })
  const older = filtered.filter(c => now.getTime() - new Date(c.updated_at).getTime() >= 7 * 86400000)

  return (
    <aside className={cn(
      'flex flex-col h-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-r border-gray-200/80 dark:border-gray-800/80 transition-all duration-300 ease-in-out shrink-0',
      isOpen ? 'w-72' : 'w-0 overflow-hidden'
    )}>
      {/* Brand */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200/80 dark:border-gray-800/80">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
            <Stethoscope size={16} className="text-white" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-gray-950" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-900 dark:text-white font-semibold text-[13px] truncate tracking-tight">Clinical Workflows</p>
            <p className="text-gray-400 dark:text-gray-500 text-[11px] truncate">Hypertension AI</p>
          </div>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" title="Collapse sidebar">
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* New chat */}
      <div className="p-3">
        <button onClick={onNewChat}
          className="group flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98] px-4 py-2.5 text-[13px]">
          <Plus size={15} className="transition-transform group-hover:rotate-90 duration-300" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-1">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800/60 mx-auto mb-3 flex items-center justify-center">
              <MessageSquare size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-500 text-[12px] font-medium">No conversations yet</p>
            <p className="text-gray-400 dark:text-gray-600 text-[11px] mt-1">Start one to see it here</p>
          </div>
        ) : (
          <>
            {today.length > 0 && <SectionLabel>Today</SectionLabel>}
            {today.map(c => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
            {week.length > 0 && <SectionLabel className="mt-3">This Week</SectionLabel>}
            {week.map(c => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
            {older.length > 0 && <SectionLabel className="mt-3">Earlier</SectionLabel>}
            {older.map(c => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
          </>
        )}
      </div>

      {/* User card */}
      <div className="border-t-2 border-clinical-black p-3 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onOpenProfile}
            className="w-9 h-9 border-2 border-clinical-black bg-brand-accent flex items-center justify-center text-white text-xs font-bold shrink-0 hover:opacity-90 transition-all"
            title="Edit Profile"
          >
            {getInitials(user.username)}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white text-[13px] font-bold truncate uppercase">{user.username}</p>
            <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate capitalize flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {user.roles[0] || 'patient'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onOpenProfile} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" title="Edit Profile">
              <User size={14} />
            </button>
            <button onClick={onLogout} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Log out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-3 py-1.5', className)}>
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{children}</p>
    </div>
  )
}

function ConvItem({ conv, isActive, hovered, onHover, onSelect, onDelete }: {
  conv: ConversationSummary; isActive: boolean; hovered: boolean
  onHover: (id: string | null) => void; onSelect: (id: string) => void; onDelete: (id: string) => void
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg transition-all cursor-pointer px-3 py-2.5',
        isActive
          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200/80 dark:ring-blue-500/30'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/60'
      )}
      onClick={() => onSelect(conv.id)}
      onMouseEnter={() => onHover(conv.id)}
      onMouseLeave={() => onHover(null)}
    >
      <MessageSquare size={13} className={cn('shrink-0', isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400')} />
      <div className="flex-1 min-w-0 ml-2.5">
        <p className="text-[13px] font-medium truncate leading-tight">{conv.title}</p>
        <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          {formatRelativeTime(conv.updated_at)}
        </p>
      </div>
      {(hovered || isActive) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
          className="ml-1 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          title="Delete conversation"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Citation Card (collapsible) ──────────────────────────────────────────────

function CitationCard({ citation, defaultOpen = false }: { citation: Citation; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const org = citation.organization
  const year = citation.publication_year

  return (
    <div className="bg-white dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800/80 rounded-xl overflow-hidden hover:border-blue-300/60 dark:hover:border-blue-500/30 transition-colors">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-2.5 p-3 text-left"
      >
        <div className="mt-0.5 text-gray-400 shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">{citation.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
            <Pill variant={citation.source_type === 'okf' ? 'okf' : 'rag'} icon={citation.source_type === 'okf' ? Brain : Database}>
              {citation.source_type?.toUpperCase() || 'RAG'}
            </Pill>
            {org && <span className="text-[11px] text-gray-500 dark:text-gray-400">{org}</span>}
            {year && <span className="text-[11px] text-gray-400 dark:text-gray-500">· {year}</span>}
            {citation.page && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                <FileText size={10} /> p.{citation.page}
              </span>
            )}
          </div>
        </div>
      </button>
      {open && (citation.quote || citation.source_url || citation.chunk_id) && (
        <div className="border-t border-gray-100 dark:border-gray-800/80 p-3 space-y-2.5 bg-gray-50/50 dark:bg-gray-900/40">
          {citation.quote && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Quote size={10} /> Quoted
              </p>
              <blockquote className="border-l-2 border-blue-400/70 dark:border-blue-500/60 pl-2.5 text-[12px] italic text-gray-600 dark:text-gray-400 leading-relaxed">
                {citation.quote}
              </blockquote>
            </div>
          )}
          {citation.chunk_id && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-500 font-mono bg-white dark:bg-gray-950/60 rounded-md px-2 py-1.5 border border-gray-200/80 dark:border-gray-800/60">
              <Database size={11} className="shrink-0" />
              <span className="truncate flex-1">{citation.chunk_id}</span>
              <CopyButton text={citation.chunk_id} />
            </div>
          )}
          {citation.source_url && (
            <a href={citation.source_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
              <ExternalLink size={11} /> View source
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onCitationClick, mode }: {
  message: ChatMessage; onCitationClick: (c: Citation[]) => void; mode: 'patient' | 'clinician'
}) {
  const isUser = message.role === 'user'
  const isClinician = mode === 'clinician' && !isUser

  return (
    <div className={cn('flex gap-3 w-full group animate-fade-in', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm',
        isUser
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
          : isClinician
          ? 'bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 border border-slate-700 dark:border-slate-600'
          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
      )}>
        {isUser ? <User size={14} /> : <Stethoscope size={14} className="text-blue-600 dark:text-blue-400" />}
      </div>

      <div className={cn('flex flex-col gap-2 max-w-[78%]', isUser ? 'items-end' : 'items-start')}>
        {/* Name + time */}
        <div className={cn('flex items-center gap-2 px-1', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
            {isUser ? 'You' : isClinician ? 'Clinical Assistant' : 'Hypertension AI'}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Bubble */}
        <div className={cn(
          'rounded-2xl text-[13.5px] leading-relaxed shadow-sm overflow-hidden',
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm px-4 py-3 max-w-full'
            : isClinician
              ? 'bg-slate-50 dark:bg-slate-900/40 text-gray-900 dark:text-gray-100 border border-slate-200/80 dark:border-slate-700/60 rounded-tl-sm'
              : 'bg-white dark:bg-gray-900/80 text-gray-900 dark:text-gray-100 border border-gray-200/80 dark:border-gray-800/80 rounded-tl-sm'
        )}>
          <div className={cn(isUser ? 'whitespace-pre-wrap break-words' : 'px-4 py-3.5')}>
            {isUser ? (
              <span>{message.content}</span>
            ) : (
              <Markdown content={message.content} />
            )}
          </div>
        </div>

        {/* Action row (citations, tools, knowledge, disclaimer) */}
        {!isUser && (message.citations?.length || message.tool_trace?.length || message.knowledge_path?.path || message.safety_flags?.medical_disclaimer) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {message.citations && message.citations.length > 0 && (
              <button
                onClick={() => onCitationClick(message.citations!)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-900/60 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-500/40 rounded-lg text-[11px] text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-300 transition-all"
              >
                <BookOpen size={11} />
                <span className="font-semibold">{message.citations.length}</span>
                <span>source{message.citations.length !== 1 ? 's' : ''}</span>
              </button>
            )}
            {message.tool_trace && message.tool_trace.length > 0 && (
              <Pill variant="warning" icon={Zap}>
                {message.tool_trace.map(t => t.name).join(', ')}
              </Pill>
            )}
            {message.knowledge_path?.path && (
              <Pill variant={message.knowledge_path.path === 'okf' ? 'okf' : message.knowledge_path.path === 'okf_then_rag' ? 'okf' : 'rag'}
                    icon={message.knowledge_path.path === 'rag' ? Database : Brain}>
                {message.knowledge_path.path === 'okf' ? 'OKF' : message.knowledge_path.path === 'okf_then_rag' ? 'OKF + RAG' : 'RAG'}
              </Pill>
            )}
            {message.safety_flags?.medical_disclaimer && (
              <Pill variant="info" icon={Shield}>Disclaimer</Pill>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 shadow-sm">
        <Stethoscope size={14} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="bg-white dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Evidence Panel ──────────────────────────────────────────────────────────

type EvidenceTab = 'sources' | 'tools' | 'safety' | 'knowledge'

function EvidencePanel({ isOpen, onClose, citations, toolTrace, safetyFlags, knowledgePath }: {
  isOpen: boolean; onClose: () => void
  citations: Citation[]; toolTrace: ToolTrace[]
  safetyFlags: SafetyFlags | null; knowledgePath: KnowledgePath | null
}) {
  const [tab, setTab] = useState<EvidenceTab>('sources')

  const tabs: { id: EvidenceTab; label: string; icon: IconType; count: number }[] = useMemo(() => [
    { id: 'sources', label: 'Sources', icon: BookOpen, count: citations.length },
    { id: 'tools', label: 'Tools', icon: Zap, count: toolTrace.length },
    { id: 'safety', label: 'Safety', icon: Shield, count: safetyFlags ? 1 : 0 },
    { id: 'knowledge', label: 'Knowledge', icon: Network, count: knowledgePath?.okf_concepts?.length || 0 },
  ], [citations.length, toolTrace.length, safetyFlags, knowledgePath])

  return (
    <aside className={cn(
      'flex flex-col h-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-l border-gray-200/80 dark:border-gray-800/80 transition-all duration-300 ease-in-out shrink-0',
      isOpen ? 'w-96' : 'w-0 overflow-hidden'
    )}>
      {isOpen && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200/80 dark:border-gray-800/80">
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold text-[14px] tracking-tight">Evidence & Context</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Sources, tools, and safety for this answer</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" title="Close">
              <X size={15} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200/80 dark:border-gray-800/80 px-2 pt-2 gap-0.5 overflow-x-auto scrollbar-thin">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-semibold rounded-t-lg transition-all whitespace-nowrap',
                  tab === t.id
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-b-0 border-blue-200/80 dark:border-blue-500/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                )}
              >
                <t.icon size={12} />
                {t.label}
                {t.count > 0 && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    tab === t.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
            {tab === 'sources' && (
              citations.length === 0 ? (
                <EmptyEvidence icon={BookOpen} title="No citations yet" subtitle="Ask a clinical question to see source material" />
              ) : (
                citations.map((c, i) => <CitationCard key={i} citation={c} />)
              )
            )}
            {tab === 'tools' && (
              toolTrace.length === 0 ? (
                <EmptyEvidence icon={Zap} title="No tools used" subtitle="Tools will appear here if the agent called them" />
              ) : toolTrace.map((t, i) => (
                <div key={i} className="bg-white dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                      <Zap size={13} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-200">{t.name}</p>
                    {typeof t.duration_ms === 'number' && (
                      <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 font-mono">{t.duration_ms}ms</span>
                    )}
                  </div>
                  {(t.input_summary || t.inputs) && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Input</p>
                      <pre className="text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800/60 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                        {t.input_summary || JSON.stringify(t.inputs, null, 2)}
                      </pre>
                    </div>
                  )}
                  {(t.output_summary || t.output !== undefined) && (
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Output</p>
                      <pre className="text-[11.5px] leading-relaxed text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/80 dark:border-emerald-500/20 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                        {t.output_summary || JSON.stringify(t.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
            {tab === 'safety' && (
              <div className="space-y-3">
                <div className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border',
                  safetyFlags?.unsupported_claims_detected
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                )}>
                  {safetyFlags?.unsupported_claims_detected
                    ? <AlertCircle size={18} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    : <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn(
                      'text-[13px] font-semibold',
                      safetyFlags?.unsupported_claims_detected ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                    )}>
                      {safetyFlags?.unsupported_claims_detected ? 'Unsupported Claims Detected' : 'Claims Validated'}
                    </p>
                    <p className="text-[11.5px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                      {safetyFlags?.unsupported_claims_detected
                        ? 'Some claims could not be fully supported by indexed sources — treat as provisional.'
                        : 'All clinical claims are supported by indexed guideline sources.'}
                    </p>
                  </div>
                </div>
                {safetyFlags?.medical_disclaimer && (
                  <div className="flex items-start gap-3 p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                    <Info size={18} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">Medical Disclaimer</p>
                      <p className="text-[11.5px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                        Educational workflow support only — must not replace clinical judgment.
                      </p>
                    </div>
                  </div>
                )}
                {!safetyFlags && <EmptyEvidence icon={Shield} title="No safety data" />}
              </div>
            )}
            {tab === 'knowledge' && (
              <div className="space-y-3">
                {knowledgePath ? (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/30 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                          <Network size={13} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-200">Knowledge Path</p>
                        <Pill variant={knowledgePath.path === 'okf' ? 'okf' : 'rag'} className="ml-auto">
                          {knowledgePath.path?.toUpperCase() || 'RAG'}
                        </Pill>
                      </div>
                      {knowledgePath.reason && (
                        <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">{knowledgePath.reason}</p>
                      )}
                    </div>
                    {knowledgePath.okf_concepts && knowledgePath.okf_concepts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
                          OKF Concepts Matched
                        </p>
                        {knowledgePath.okf_concepts.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800/60 hover:border-blue-300/60 dark:hover:border-blue-500/30 rounded-lg mb-1.5 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                              <Brain size={12} className="text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-200 truncate">{c.title}</p>
                              <p className="text-[10.5px] text-gray-400 dark:text-gray-500 font-mono truncate">{c.source_path}</p>
                            </div>
                            <div className="shrink-0 w-16">
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
                              </div>
                              <p className="text-[10px] text-gray-500 dark:text-gray-500 text-right mt-1 font-mono">{Math.round(c.confidence * 100)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyEvidence icon={Network} title="No knowledge path" subtitle="Knowledge routing will appear here" />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

function EmptyEvidence({ icon: Icon, title, subtitle }: { icon: IconType; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800/60 mx-auto mb-3 flex items-center justify-center">
        <Icon size={20} className="text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-gray-700 dark:text-gray-300 text-[13px] font-medium">{title}</p>
      {subtitle && <p className="text-gray-400 dark:text-gray-500 text-[11px] mt-1 max-w-[200px] mx-auto">{subtitle}</p>}
    </div>
  )
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ onQuestionClick }: { onQuestionClick: (text: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col items-center justify-center min-h-full text-center px-6 py-12 max-w-3xl mx-auto">
        {/* Hero */}
        <div className="relative mb-7">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Sparkles size={32} className="text-white" />
          </div>
        </div>

        <h1 className="text-[28px] sm:text-[32px] font-bold text-gray-900 dark:text-white tracking-tight mb-3">
          How can I help you today?
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-[14px] leading-relaxed mb-10 max-w-lg">
          Evidence-based hypertension management assistant grounded in <span className="font-semibold text-gray-700 dark:text-gray-300">NICE</span>, <span className="font-semibold text-gray-700 dark:text-gray-300">ACC/AHA</span>, <span className="font-semibold text-gray-700 dark:text-gray-300">ESC/ESH</span>, and <span className="font-semibold text-gray-700 dark:text-gray-300">WHO</span> guidelines — with citations you can verify.
        </p>

        {/* Trust strip */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <Pill variant="info" icon={Shield}>Educational only — not medical advice</Pill>
          <Pill variant="success" icon={CheckCircle2}>Every claim cited</Pill>
          <Pill variant="okf" icon={Brain}>OKF + RAG hybrid</Pill>
        </div>

        {/* Suggested questions */}
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Try asking</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuestionClick(q.text)}
              className="group flex items-start gap-3 p-4 bg-white dark:bg-gray-900/60 hover:bg-blue-50/80 dark:hover:bg-blue-500/10 border border-gray-200/80 dark:border-gray-800/80 hover:border-blue-300 dark:hover:border-blue-500/40 rounded-xl text-left transition-all hover:shadow-md"
            >
              <div className={cn('w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform', q.tone)}>
                <q.icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-widest">{q.category}</p>
                <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-snug font-medium">{q.text}</p>
              </div>
              <ArrowUp size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 group-hover:-translate-y-0.5 transition-all rotate-45 shrink-0 mt-2" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Profile Modal ──────────────────────────────────────────────────────────

function ProfileModal({ isOpen, onClose, user, onUpdateUser, onChatAboutDoc }: {
  isOpen: boolean
  onClose: () => void
  user: UserProfile
  onUpdateUser: (updated: UserProfile) => void
  onChatAboutDoc: (filename: string) => void
}) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(user.date_of_birth || '')
  const [notes, setNotes] = useState(user.notes || '')
  const [email, setEmail] = useState(user.email || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Uploads state
  const [uploads, setUploads] = useState<any[]>([])
  const [isFetchingUploads, setIsFetchingUploads] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState<string>('other')
  const [uploadNote, setUploadNote] = useState<string>('')

  // Load uploads
  useEffect(() => {
    if (isOpen) {
      setIsFetchingUploads(true)
      api.listUploads()
        .then(data => setUploads(data.uploads))
        .catch(err => console.error(err))
        .finally(() => setIsFetchingUploads(false))
    }
  }, [isOpen])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    setIsSavingProfile(true)
    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        email,
        date_of_birth: dateOfBirth,
        notes
      })
      onUpdateUser(updated)
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploadError('')
    setIsUploading(true)
    try {
      const newUpload = await api.createUpload(selectedFile, uploadCategory, uploadNote)
      setUploads(prev => [newUpload, ...prev])
      setSelectedFile(null)
      setUploadNote('')
      // Clear file input
      const fileInput = document.getElementById('profile-file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteUpload = async (id: string) => {
    try {
      await api.deleteUpload(id)
      setUploads(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      alert('Failed to delete file')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinical-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white text-clinical-black border-4 border-clinical-black w-full max-w-4xl max-h-[90vh] flex flex-col neo-brutal-shadow relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-brand-accent text-white border-2 border-clinical-black flex items-center justify-center neo-brutal-shadow-sm font-bold z-10 hover:bg-brand-accent/80 active:translate-x-[1px] active:translate-y-[1px]"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="p-6 border-b-4 border-clinical-black bg-surface-container-low flex justify-between items-center">
          <div>
            <h2 className="text-xl font-headline-xl font-black uppercase tracking-tight">User Clinical Profile</h2>
            <p className="text-xs text-on-surface-variant font-bold font-code-sm uppercase">Manage details and personalized RAG knowledge base</p>
          </div>
          <span className="px-3 py-1 border-2 border-clinical-black font-code-sm font-bold text-xs uppercase tracking-wide bg-brand-accent text-white neo-brutal-shadow-sm">
            {user.roles[0] || 'patient'}
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Column 1: Profile Details */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider font-headline-lg border-b-2 border-clinical-black pb-1">
              Personal Information
            </h3>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider font-label-md mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 bg-white border-2 border-clinical-black text-xs font-bold font-code-sm focus:outline-none focus:border-brand-accent rounded-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider font-label-md mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 bg-white border-2 border-clinical-black text-xs font-bold font-code-sm focus:outline-none focus:border-brand-accent rounded-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider font-label-md mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-clinical-black text-xs font-bold font-code-sm focus:outline-none focus:border-brand-accent rounded-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider font-label-md mb-1">
                  Notes & Description (Clinical Details)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add details regarding symptoms, medication history, or notes for simulated consultation."
                  rows={4}
                  className="w-full px-3 py-2 bg-white border-2 border-clinical-black text-xs font-bold font-code-sm focus:outline-none focus:border-brand-accent rounded-none"
                />
              </div>

              {profileError && (
                <div className="p-3 bg-rose-50 border-2 border-rose-500 text-rose-700 text-xs font-bold uppercase flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 text-xs font-bold uppercase flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>Profile updated successfully</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="py-2.5 px-4 bg-brand-accent text-white font-bold border-2 border-clinical-black neo-brutal-shadow-sm neo-brutal-btn uppercase text-xs tracking-wider flex items-center gap-2"
              >
                {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Column 2: Document Ingestion */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider font-headline-lg border-b-2 border-clinical-black pb-1">
              Personal Documents (RAG)
            </h3>
            
            {/* Upload form */}
            <form onSubmit={handleUploadSubmit} className="p-4 border-2 border-clinical-black bg-stone-50 space-y-3">
              <span className="text-[10px] font-code-sm font-bold uppercase tracking-wider block text-on-surface-variant">
                Upload prescription / doctor notes / report (PDF or Image)
              </span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-clinical-black mb-1">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border-2 border-clinical-black text-[11px] font-bold focus:outline-none"
                  >
                    <option value="prescription">Prescription</option>
                    <option value="doctor_note">Doctor's Note</option>
                    <option value="lab_report">Lab Report</option>
                    <option value="image">Image</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-clinical-black mb-1">Select File</label>
                  <input
                    id="profile-file-input"
                    type="file"
                    onChange={handleFileChange}
                    accept="application/pdf,image/*"
                    required
                    className="w-full text-xs text-clinical-black border border-clinical-black/30 p-1 file:mr-2 file:py-1 file:px-2 file:border-2 file:border-clinical-black file:text-[10px] file:font-bold file:bg-white file:uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-clinical-black mb-1">User Note</label>
                <input
                  type="text"
                  value={uploadNote}
                  onChange={e => setUploadNote(e.target.value)}
                  placeholder="Optional brief description of the document"
                  className="w-full px-2 py-1.5 bg-white border-2 border-clinical-black text-[11px] font-bold focus:outline-none"
                />
              </div>

              {uploadError && (
                <div className="text-[10px] text-rose-600 font-bold uppercase">{uploadError}</div>
              )}

              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="w-full py-2 bg-clinical-black text-white font-bold border-2 border-clinical-black neo-brutal-btn text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : 'Ingest Document'}
              </button>
            </form>

            {/* List uploads */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-clinical-black tracking-wide">
                Ingested Files ({uploads.length})
              </h4>
              
              {isFetchingUploads ? (
                <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin" /></div>
              ) : uploads.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {uploads.map((up: any) => (
                    <div key={up.id} className="p-3 bg-white border-2 border-clinical-black flex items-start justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="px-1.5 py-0.5 bg-brand-accent/15 text-brand-accent border border-brand-accent/30 font-code-sm text-[9px] font-bold uppercase">
                            {up.category}
                          </span>
                          <span className="text-[9px] font-code-sm text-on-surface-variant font-semibold">
                            {up.kind} · {(up.size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <p className="text-xs font-bold truncate text-clinical-black" title={up.display_title || up.original_filename}>
                          {up.display_title || up.original_filename}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onChatAboutDoc(up.display_title || up.original_filename)}
                          className="p-1 border border-clinical-black hover:bg-brand-accent hover:text-white transition-colors"
                          title="Ask follow-up regarding this document"
                        >
                          <MessageSquare size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUpload(up.id)}
                          className="p-1 border border-clinical-black hover:bg-rose-500 hover:text-white transition-colors"
                          title="Delete document"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [page, setPage] = useState<'landing' | 'login' | 'signup'>('landing')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingConvs, setIsFetchingConvs] = useState(false)
  const [mode, setMode] = useState<'patient' | 'clinician'>('patient')
  const [caseId, setCaseId] = useState('')
  const [panelCitations, setPanelCitations] = useState<Citation[]>([])
  const [panelTools, setPanelTools] = useState<ToolTrace[]>([])
  const [panelSafety, setPanelSafety] = useState<SafetyFlags | null>(null)
  const [panelKnowledge, setPanelKnowledge] = useState<KnowledgePath | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  
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
        .then(u => {
          setUser(u)
          const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
          setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
        })
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

  const handleLogin = async (token: string) => {
    api.setToken(token)
    try {
      const u = await api.getCurrentUser()
      setUser(u)
      const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
      setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
    } catch {
      throw new Error('Failed to load user profile')
    }
  }

  const handleSignup = async (token: string) => {
    api.setToken(token)
    try {
      const u = await api.getCurrentUser()
      setUser(u)
      const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
      setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
    } catch {
      throw new Error('Failed to load user profile')
    }
  }

  const handleChatAboutDoc = (filename: string) => {
    setIsProfileModalOpen(false)
    const prompt = `Let's review the uploaded document: "${filename}". Can you summarize its key clinical details and check for any recommendations or care gaps?`
    setInputValue(prompt)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleLogout = () => {
    setUser(null); api.setToken(null); localStorage.removeItem('cw_token')
    setConversations([]); setMessages([]); setCurrentConvId(null)
    setPage('landing')
  }

  const handleNewChat = () => {
    setCurrentConvId(null); setMessages([]); setInputValue('')
    setPanelCitations([]); setPanelTools([]); setPanelSafety(null); setPanelKnowledge(null)
    setEvidencePanelOpen(false)
  }

  const handleSelectConv = async (id: string) => {
    setCurrentConvId(id)
    try {
      const conv = await api.getConversation(id)
      setMessages(conv.messages || [])
      const last = conv.messages?.[conv.messages.length - 1]
      if (last?.role === 'assistant') {
        setPanelCitations(last.citations || []); setPanelTools(last.tool_trace || [])
        setPanelSafety(last.safety_flags || null); setPanelKnowledge(last.knowledge_path || null)
      }
      setEvidencePanelOpen(true)
    } catch { setMessages([]) }
  }

  const handleDeleteConv = async (id: string) => {
    await api.deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
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
    setMessages(prev => [...prev, userMsg])

    try {
      let convId = currentConvId
      if (!convId) {
        const conv = await api.createConversation(question.slice(0, 60))
        convId = conv.id
        setCurrentConvId(convId)
        setConversations(prev => [{ id: conv.id, title: conv.title, updated_at: conv.updated_at }, ...prev])
      }
      const assistantMsg = await api.sendMessage(convId, question, mode, caseId || undefined)
      setMessages(prev => [...prev, assistantMsg])
      setPanelCitations(assistantMsg.citations || [])
      setPanelTools(assistantMsg.tool_trace || [])
      setPanelSafety(assistantMsg.safety_flags || null)
      setPanelKnowledge(assistantMsg.knowledge_path || null)
      if (assistantMsg.citations?.length || assistantMsg.tool_trace?.length) setEvidencePanelOpen(true)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c))
    } catch (err) {
      setMessages(prev => [...prev, {
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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)

  const currentConv = conversations.find(c => c.id === currentConvId)
  const canCollapseLeft = sidebarOpen
  const isClinicianMode = mode === 'clinician'

  if (!user) {
    if (page === 'landing') {
      return <LandingPage onLogin={() => setPage('login')} onRegister={() => setPage('signup')} />
    }
    if (page === 'login') {
      return <LoginPage onLogin={handleLogin} onSwitchToSignup={() => setPage('signup')} onBackToHome={() => setPage('landing')} />
    }
    return <SignupPage onSignup={handleSignup} onSwitchToLogin={() => setPage('login')} onBackToHome={() => setPage('landing')} />
  }

  return (
    <div className={cn(
      'flex h-screen overflow-hidden',
      isClinicianMode
        ? 'bg-stone-50 dark:bg-stone-950'
        : 'bg-stone-50 dark:bg-stone-950'
    )}>
      <Sidebar
        isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} user={user}
        conversations={conversations} currentConvId={currentConvId} onNewChat={handleNewChat}
        onSelectConv={handleSelectConv} onDeleteConv={handleDeleteConv} onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        isLoading={isFetchingConvs}
      />

      {/* Main Chat Area */}
      <main className="flex flex-col flex-1 min-w-0 relative">
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl shrink-0 z-10">
          {!canCollapseLeft && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="Open sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
              isClinicianMode
                ? 'bg-gradient-to-br from-slate-700 to-slate-900'
                : 'bg-gradient-to-br from-blue-500 to-blue-600'
            )}>
              <Stethoscope size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-[13.5px] truncate tracking-tight">
                {currentConv?.title || 'Clinical Workflows'}
              </h2>
              <p className="text-[10.5px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', isClinicianMode ? 'bg-slate-500' : 'bg-emerald-500 animate-pulse')} />
                {isClinicianMode ? 'Clinician mode · Workstation' : 'Patient mode · Hypertension AI'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <select
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              className="text-[12px] bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all max-w-[180px]"
            >
              {CASES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="flex bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 p-0.5 rounded-lg">
              {(['patient', 'clinician'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-3 py-1 text-[11.5px] font-semibold rounded-md transition-all capitalize',
                    mode === m
                      ? isClinicianMode
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-gray-900 shadow-sm dark:bg-blue-600 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={() => setEvidencePanelOpen(!evidencePanelOpen)}
              className={cn(
                'p-2 rounded-lg transition-all',
                evidencePanelOpen
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
              )}
              title={evidencePanelOpen ? 'Hide evidence' : 'Show evidence'}
            >
              <BarChart3 size={15} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <WelcomeScreen onQuestionClick={(text) => setInputValue(text)} />
          ) : (
            <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-4xl mx-auto">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  mode={mode}
                  onCitationClick={c => { setPanelCitations(c); setEvidencePanelOpen(true) }}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-4 sm:px-6 pb-4 pt-2 bg-stone-50 dark:bg-stone-950/90 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className={cn(
              'relative flex items-end gap-2 bg-white dark:bg-gray-900/80 border rounded-2xl p-2 transition-all shadow-sm',
              'border-gray-200 dark:border-gray-800',
              'focus-within:border-blue-400 dark:focus-within:border-blue-500/50',
              'focus-within:ring-4 focus-within:ring-blue-500/10',
            )}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isClinicianMode ? 'Ask a clinician-grade clinical question…' : 'Ask a clinical question about hypertension management…'}
                rows={1}
                className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-[14px] resize-none focus:outline-none leading-relaxed px-2 py-2 min-h-[36px] max-h-[200px]"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  'shrink-0 h-9 px-3 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all shadow-sm',
                  inputValue.trim() && !isLoading
                    ? isClinicianMode
                      ? 'bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                )}
              >
                {isLoading ? <Spinner size="sm" /> : (
                  <>
                    <Send size={13} />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2.5 px-1">
              <p className="text-[10.5px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Kbd>Enter</Kbd> send
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line
              </p>
              <p className="text-[10.5px] text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                <Shield size={10} /> Educational purposes only
              </p>
            </div>
          </div>
        </div>
      </main>

      <EvidencePanel
        isOpen={evidencePanelOpen}
        onClose={() => setEvidencePanelOpen(false)}
        citations={panelCitations}
        toolTrace={panelTools}
        safetyFlags={panelSafety}
        knowledgePath={panelKnowledge}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdateUser={(updated) => setUser(updated)}
        onChatAboutDoc={handleChatAboutDoc}
      />
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-mono text-gray-600 dark:text-gray-400 shadow-sm">
      {children}
    </kbd>
  )
}
