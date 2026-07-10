import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus, MessageSquare, LogOut,
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
  { icon: BookOpen, text: 'Summarize NICE NG136 guidelines for hypertension management', category: 'NICE', tone: 'text-brand-accent' },
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
    info:    'bg-stone-100 text-[#1a1a1a] border-[#1a1a1a] dark:bg-slate-800 dark:text-white dark:border-white',
    okf:     'bg-[#ffddb8] text-[#1a1a1a] border-[#1a1a1a] dark:bg-amber-955/40 dark:text-amber-200 dark:border-amber-500',
    rag:     'bg-[#6ffbbe] text-[#1a1a1a] border-[#1a1a1a] dark:bg-emerald-955/40 dark:text-emerald-200 dark:border-emerald-500',
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
      'flex flex-col h-full bg-[#1a1a1a] text-white border-r-2 border-[#1a1a1a] transition-all duration-300 ease-in-out shrink-0 z-10',
      isOpen ? 'w-sidebar-width' : 'w-0 overflow-hidden'
    )}>
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-6 border-b border-white/20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 bg-brand-accent flex items-center justify-center text-white border-2 border-white">
            <Stethoscope size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-label-md text-label-md text-white uppercase tracking-wider leading-none">Clinical Workflows</h1>
            <p className="font-mono text-[10px] text-white/70 mt-1 uppercase">Hypertension AI</p>
          </div>
        </div>
        <button onClick={onToggle} className="p-1 text-white/50 hover:text-brand-accent transition-colors border-2 border-transparent hover:border-white/30 rounded-none" title="Collapse sidebar">
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* New chat */}
      <div className="px-4 py-4">
        <button onClick={onNewChat}
          className="w-full bg-brand-accent text-white font-label-md text-label-md py-2.5 flex items-center justify-center gap-2 hover:bg-white hover:text-[#1a1a1a] transition-colors border-2 border-white uppercase tracking-wider brutalist-button border-transparent rounded-none">
          <Plus size={15} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white/10 border-2 border-white/20 text-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-accent transition-all placeholder-white/30 font-mono rounded-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scroll-premium px-4 py-2 space-y-1">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="text-white/50" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-white/20">
            <MessageSquare size={20} className="text-white/30 mx-auto mb-3" />
            <p className="text-white/50 text-[12px] font-medium">No conversations yet</p>
            <p className="text-white/40 text-[11px] mt-1">Start one to see it here</p>
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

      {/* Footer User card */}
      <div className="p-4 border-t-2 border-white/20 flex items-center justify-between bg-black">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onOpenProfile}
            className="w-8 h-8 bg-white flex items-center justify-center text-[#1a1a1a] font-bold text-sm border-2 border-white shrink-0"
            title="Edit Profile"
          >
            {getInitials(user.username)}
          </button>
          <div className="min-w-0">
            <p className="font-label-md text-label-md leading-tight text-white uppercase truncate">{user.username}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-brand-accent"></div>
              <p className="text-[10px] text-white/70 font-mono capitalize truncate">{user.roles[0] || 'patient'}</p>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="text-white/50 hover:text-brand-accent transition-colors shrink-0" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('py-1.5', className)}>
      <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono">{children}</p>
    </div>
  )
}

function ConvItem({ conv, isActive, hovered, onHover, onSelect, onDelete }: {
  conv: ConversationSummary; isActive: boolean; hovered: boolean
  onHover: (id: string | null) => void; onSelect: (id: string) => void; onDelete: (id: string) => void
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2.5 p-2 text-left group transition-all duration-300 relative border-2 rounded-none mb-1.5',
        isActive
          ? 'bg-brand-accent text-white border-[#1a1a1a] dark:border-white clinical-shadow'
          : 'text-white/70 hover:bg-white/10 hover:text-white border-transparent hover:border-white/20'
      )}
      onClick={() => onSelect(conv.id)}
      onMouseEnter={() => onHover(conv.id)}
      onMouseLeave={() => onHover(null)}
    >
      <MessageSquare size={13} className={cn('shrink-0', isActive ? 'text-white' : 'text-white/50')} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate leading-tight">{conv.title}</p>
        <p className={cn("text-[10px] mt-0.5 font-mono", isActive ? "text-white/80" : "text-white/50")}>
          {formatRelativeTime(conv.updated_at)}
        </p>
      </div>
      {(hovered || isActive) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
          className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
          title="Delete conversation"
        >
          <Trash2 size={12} />
        </button>
      )}
    </button>
  )
}

// ─── Citation Card (collapsible) ──────────────────────────────────────────────

function CitationCard({ citation, defaultOpen = false }: { citation: Citation; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const org = citation.organization
  const year = citation.publication_year

  return (
    <div className="bg-white dark:bg-gray-900/60 border-2 border-[#1a1a1a] dark:border-white overflow-hidden hover:border-brand-accent/60 dark:hover:border-brand-accent/30 transition-all rounded-none">
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
              <blockquote className="border-l-2 border-brand-accent/70 dark:border-brand-accent/60 pl-2.5 text-[12px] italic text-gray-600 dark:text-gray-400 leading-relaxed">
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
              className="inline-flex items-center gap-1 text-[12px] text-brand-accent dark:text-brand-accent hover:underline font-medium">
              <ExternalLink size={11} /> View source
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onCitationClick, mode, username }: {
  message: ChatMessage; onCitationClick: (c: Citation[]) => void; mode: 'patient' | 'clinician'; username: string
}) {
  const isUser = message.role === 'user'
  const isClinician = mode === 'clinician' && !isUser

  return (
    <div className={cn('flex gap-4 animate-message w-full mb-8', isUser ? 'flex-row' : 'flex-row')}>
      {/* Avatar */}
      {isUser ? (
        <div className="w-10 h-10 bg-[#1a1a1a] dark:bg-white text-white dark:text-black flex-shrink-0 flex items-center justify-center font-bold text-lg border-2 border-[#1a1a1a] dark:border-white clinical-shadow">
          {username.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div className="w-10 h-10 bg-brand-accent border-2 border-[#1a1a1a] dark:border-white flex-shrink-0 flex items-center justify-center clinical-shadow">
          <span className="material-symbols-outlined text-white text-[24px]">auto_awesome</span>
        </div>
      )}

      {/* Content Panel */}
      {isUser ? (
        <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-5 clinical-shadow relative">
          <div className="absolute -top-3 left-4 bg-brand-accent text-white px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white font-label-md text-xs uppercase tracking-wider">
            {username}
          </div>
          <div className="font-body-md text-body-md text-[#1a1a1a] dark:text-white leading-relaxed mt-2 text-[16px] whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-6 clinical-shadow relative">
          <div className="absolute -top-3 left-4 bg-[#1a1a1a] dark:bg-white text-white dark:text-black px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white font-label-md text-xs uppercase tracking-wider">
            {isClinician ? 'Clinical Assistant' : 'Hypertension AI'}
          </div>
          <div className="font-body-md text-body-md text-[#1a1a1a] dark:text-white leading-relaxed space-y-5 mt-2">
            <Markdown content={message.content} />

            {/* Action Row & Badges */}
            {(message.citations?.length || message.knowledge_path?.path || message.safety_flags?.medical_disclaimer) && (
              <div className="flex items-center gap-3 mt-6 pt-6 border-t-2 border-[#1a1a1a] dark:border-white/20">
                {message.citations && message.citations.length > 0 && (
                  <button
                    onClick={() => onCitationClick(message.citations!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-2 border-[#1a1a1a] dark:border-white clinical-shadow uppercase font-code-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">menu_book</span>
                    <span>{message.citations.length} source{message.citations.length !== 1 ? 's' : ''}</span>
                  </button>
                )}
                {message.knowledge_path?.path && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand-accent text-white border-2 border-[#1a1a1a] dark:border-white clinical-shadow uppercase font-code-sm">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>{message.knowledge_path.path === 'rag' ? 'RAG' : 'OKF'}</span>
                  </span>
                )}
                {message.safety_flags?.medical_disclaimer && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#f0f0f0] dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-2 border-[#1a1a1a] dark:border-white clinical-shadow uppercase font-code-sm opacity-low">
                    <span className="material-symbols-outlined text-[16px]">security</span>
                    <span>Disclaimer</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-4 animate-fade-in mb-4">
      <div className="w-10 h-10 bg-brand-accent border-2 border-[#1a1a1a] dark:border-white flex-shrink-0 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        <Sparkles size={20} className="text-white" />
      </div>
      <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white p-5 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] rounded-none relative">
        <div className="absolute -top-3 left-4 bg-[#1a1a1a] text-white px-2 py-0.5 border-2 border-[#1a1a1a] font-label-md text-xs uppercase tracking-wider">Hypertension AI</div>
        <div className="flex items-center gap-1.5 mt-2">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2.5 h-2.5 bg-brand-accent dark:bg-white rounded-none border border-clinical-black dark:border-transparent animate-bounce" style={{ animationDelay: `${d}ms` }} />
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
  const [lisinoprilDosage, setLisinoprilDosage] = useState(20)

  const tabs: { id: EvidenceTab; label: string; icon: IconType; count: number }[] = useMemo(() => [
    { id: 'sources', label: 'Sources', icon: BookOpen, count: citations.length },
    { id: 'tools', label: 'Tools', icon: Zap, count: toolTrace.length },
    { id: 'safety', label: 'Safety', icon: Shield, count: safetyFlags ? 1 : 0 },
    { id: 'knowledge', label: 'Knowledge', icon: Network, count: knowledgePath?.okf_concepts?.length || 0 },
  ], [citations.length, toolTrace.length, safetyFlags, knowledgePath])

  return (
    <aside className={cn(
      'flex flex-col h-full bg-white dark:bg-gray-950 border-l-2 border-[#1a1a1a] dark:border-white transition-all duration-300 ease-in-out shrink-0',
      isOpen ? 'w-96' : 'w-0 overflow-hidden'
    )}>
      {isOpen && (
        <>
          {/* Header */}
          <div className="px-6 py-6 border-b-2 border-[#1a1a1a] dark:border-white bg-brand-accent text-white transition-colors">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-headline-md text-headline-md font-bold uppercase tracking-wide">Evidence & Context</h3>
              <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-all rounded-none border-2 border-transparent hover:border-white/30" title="Close">
                <X size={16} />
              </button>
            </div>
            <p className="font-code-sm text-xs font-bold uppercase opacity-low">Sources, tools, and safety</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-[#1a1a1a] dark:border-white/20 bg-[#f0f0f0] dark:bg-slate-950 p-0 overflow-x-auto scrollbar-thin">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap rounded-none border-b-4',
                  tab === t.id
                    ? 'text-[#1a1a1a] dark:text-white border-[#1a1a1a] dark:border-white bg-white dark:bg-slate-900 border-t-2'
                    : 'text-[#1a1a1a]/60 dark:text-white/60 hover:text-[#1a1a1a] dark:hover:text-white hover:bg-white dark:hover:bg-slate-900 border-transparent border-t-2 border-t-transparent'
                )}
              >
                <t.icon size={14} />
                <span className="uppercase tracking-wider text-xs font-headline-md">{t.label}</span>
                {t.count > 0 && (
                  <span className={cn(
                    'px-1.5 py-0.5 text-[10px] font-bold border rounded-none',
                    tab === t.id
                      ? 'bg-brand-accent text-white border-[#1a1a1a] dark:border-white'
                      : 'bg-white dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-[#1a1a1a]/20 dark:border-white/20'
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 bg-[#fafafa] dark:bg-gray-950">
            {tab === 'sources' && (
              <>
                {/* Titration Sandbox */}
                <div className="bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white clinical-shadow p-5 space-y-6 mb-6">
                  <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] dark:border-white/20 pb-2">
                    <h3 className="font-headline-md text-sm uppercase text-[#1a1a1a] dark:text-white">Titration Sandbox</h3>
                    <span className="material-symbols-outlined text-brand-accent">monitoring</span>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between font-code-sm text-[10px] uppercase font-bold text-[#1a1a1a] dark:text-white">
                        <span>Lisinopril Dosage</span>
                        <span className="text-brand-accent">{lisinoprilDosage}mg</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="40"
                        step="10"
                        value={lisinoprilDosage}
                        onChange={e => setLisinoprilDosage(Number(e.target.value))}
                        className="w-full h-2 bg-[#f0f0f0] dark:bg-slate-800 appearance-none border-2 border-[#1a1a1a] dark:border-white accent-brand-accent cursor-pointer rounded-none"
                      />
                    </div>
                    <div className="p-4 bg-[#1a1a1a] dark:bg-slate-950 text-white space-y-2 border border-transparent dark:border-white/10">
                      <p className="font-label-md text-[10px] uppercase tracking-widest opacity-70">Predicted Outcome</p>
                      <div className="flex items-end gap-1.5 h-16 pt-2">
                        <div className="flex-1 bg-brand-accent/30 border-t-2 border-brand-accent" style={{ height: '100%' }}></div>
                        <div className="flex-1 bg-brand-accent/40 border-t-2 border-brand-accent" style={{ height: `${Math.max(30, 100 - (lisinoprilDosage / 40) * 20)}%` }}></div>
                        <div className="flex-1 bg-brand-accent/60 border-t-2 border-brand-accent" style={{ height: `${Math.max(25, 100 - (lisinoprilDosage / 40) * 45)}%` }}></div>
                        <div className="flex-1 bg-brand-accent border-t-2 border-brand-accent animate-pulse" style={{ height: `${Math.max(20, 100 - (lisinoprilDosage / 40) * 60)}%` }}></div>
                      </div>
                      <div className="flex justify-between font-code-sm text-[12px] font-bold">
                        <span>{145 - Math.round((lisinoprilDosage / 40) * 19)}/{92 - Math.round((lisinoprilDosage / 40) * 12)}</span>
                        <span className="text-brand-accent">BP Target Goal</span>
                      </div>
                    </div>
                  </div>
                </div>

                {citations.length === 0 ? (
                  <EmptyEvidence icon={BookOpen} title="No citations yet" subtitle="Ask a clinical question to see source material" />
                ) : (
                  citations.map((c, i) => <CitationCard key={i} citation={c} />)
                )}
              </>
            )}
            {tab === 'tools' && (
              toolTrace.length === 0 ? (
                <EmptyEvidence icon={Zap} title="No tools used" subtitle="Tools will appear here if the agent called them" />
              ) : toolTrace.map((t, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900/60 border-2 border-[#1a1a1a] dark:border-white p-3.5 space-y-2.5 rounded-none">
                  <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center border border-[#1a1a1a]/10 dark:border-white/10 rounded-none">
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
                        <pre className="text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950/60 border-2 border-[#1a1a1a] dark:border-white p-2.5 overflow-x-auto whitespace-pre-wrap break-all rounded-none">
                        {t.input_summary || JSON.stringify(t.inputs, null, 2)}
                      </pre>
                    </div>
                  )}
                  {(t.output_summary || t.output !== undefined) && (
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Output</p>
                        <pre className="text-[11.5px] leading-relaxed text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/5 border-2 border-emerald-200 dark:border-emerald-500/20 p-2.5 overflow-x-auto whitespace-pre-wrap break-all rounded-none">
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
                    'flex items-start gap-3 p-3.5 border-2 border-[#1a1a1a] dark:border-white rounded-none',
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
                  <div className="flex items-start gap-3 p-3.5 bg-stone-50 dark:bg-slate-900 border border-[#1a1a1a]/20 dark:border-white/20 rounded-none">
                    <Info size={18} className="text-brand-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold text-brand-accent">Medical Disclaimer</p>
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
                    <div className="bg-stone-50 dark:bg-slate-900 border border-[#1a1a1a]/20 dark:border-white/20 rounded-none p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-brand-accent/20 flex items-center justify-center border border-[#1a1a1a]/10 dark:border-white/10 rounded-none">
                          <Network size={13} className="text-brand-accent" />
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
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1 font-mono">
                          OKF Concepts Matched
                        </p>
                        {knowledgePath.okf_concepts.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-gray-900/60 border-2 border-[#1a1a1a] dark:border-white hover:border-brand-accent/60 dark:hover:border-brand-accent/30 rounded-none mb-1.5 transition-all"
                          >
                            <div className="w-7 h-7 bg-brand-accent/10 flex items-center justify-center shrink-0 border-2 border-[#1a1a1a]/20 dark:border-white/20 rounded-none">
                              <Brain size={12} className="text-brand-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-200 truncate">{c.title}</p>
                              <p className="text-[10.5px] text-gray-400 dark:text-gray-500 font-mono truncate">{c.source_path}</p>
                            </div>
                            <div className="shrink-0 w-16">
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-none overflow-hidden">
                                <div className="h-full bg-brand-accent rounded-none transition-all" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
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
      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800/60 mx-auto mb-3 flex items-center justify-center border-2 border-[#1a1a1a] dark:border-white rounded-none">
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
    <div className="flex-1 overflow-y-auto scroll-premium">
      <div className="flex flex-col items-center justify-center min-h-full text-center px-6 py-12 max-w-3xl mx-auto">
        {/* Hero */}
        <div className="relative mb-8">
          <div className="w-16 h-16 bg-brand-accent flex items-center justify-center text-white border-2 border-clinical-black dark:border-white clinical-shadow">
            <Sparkles size={28} className="text-white" />
          </div>
        </div>

        <h1 className="font-headline-xl text-3xl font-black text-clinical-black dark:text-white uppercase mb-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuestionClick(q.text)}
              className="group flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white hover:bg-stone-50 dark:hover:bg-slate-800 text-left transition-all shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none rounded-none"
            >
              <div className={cn('w-9 h-9 border-2 border-clinical-black dark:border-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform bg-stone-100 dark:bg-slate-800 rounded-none', q.tone)}>
                <q.icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-widest leading-none">{q.category}</p>
                <p className="text-[13px] text-clinical-black dark:text-white leading-snug font-bold font-headline-md mt-1">{q.text}</p>
              </div>
              <ArrowUp size={13} className="text-gray-400 dark:text-gray-500 group-hover:text-brand-accent group-hover:-translate-y-0.5 transition-all rotate-45 shrink-0 mt-1" />
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

// ─── Respiratory Rhythm Shader ────────────────────────────────────────────────
function BreathingShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return

    let animationFrameId: number

    const resizeCanvas = () => {
      const w = canvas.clientWidth || window.innerWidth
      const h = canvas.clientHeight || window.innerHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    const ro = new ResizeObserver(() => resizeCanvas())
    ro.observe(canvas)
    resizeCanvas()

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;

      void main() {
          vec2 uv = v_texCoord;
          float breath = sin(u_time * 0.25) * 0.5 + 0.5;
          
          vec3 colorA = vec3(0.95, 0.98, 1.0);
          vec3 colorB = vec3(0.85, 0.92, 0.95);
          
          vec3 baseColor = mix(colorA, colorB, uv.y + breath * 0.1);
          
          float dist = distance(uv, vec2(0.5, 0.5));
          float pulse = exp(-dist * (2.0 - breath * 0.5));
          
          vec3 finalColor = mix(baseColor, vec3(1.0), pulse * 0.05);
          
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      return shader
    }

    const prog = gl.createProgram()
    if (!prog) return

    const vertexShader = compileShader(gl.VERTEX_SHADER, vs)
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fs)
    if (!vertexShader || !fragmentShader) return

    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes = gl.getUniformLocation(prog, 'u_resolution')

    const render = (time: number) => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        resizeCanvas()
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
      if (uTime) gl.uniform1f(uTime, time * 0.001)
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="absolute inset-0 w-full h-full -z-10 pointer-events-none transition-opacity duration-1000">
      <canvas ref={canvasRef} className="block w-full h-full" />
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
  const [isReliefMode, setIsReliefMode] = useState(false)

  const toggleReliefMode = () => {
    const next = !isReliefMode
    setIsReliefMode(next)
    if (next) {
      document.body.classList.add('relief-mode')
    } else {
      document.body.classList.remove('relief-mode')
    }
  }
  
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
      'flex h-screen overflow-hidden relative',
      isClinicianMode
        ? 'bg-stone-50 dark:bg-stone-950'
        : 'bg-stone-50 dark:bg-stone-950'
    )}>
      {isReliefMode && <BreathingShader />}

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
        <header className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1a1a1a] dark:border-white bg-white dark:bg-gray-950 shrink-0 z-10">
          {!canCollapseLeft && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all rounded-none border-2 border-transparent hover:border-[#1a1a1a] dark:hover:border-white"
              title="Open sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            <div className={cn(
              'w-7 h-7 flex items-center justify-center shrink-0 border-2 border-[#1a1a1a] dark:border-white rounded-none',
              isClinicianMode
                ? 'bg-slate-900'
                : 'bg-brand-accent'
            )}>
              <Stethoscope size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-[13.5px] truncate tracking-tight">
                {currentConv?.title || 'Clinical Workflows'}
              </h2>
              <p className="text-[10.5px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-none', isClinicianMode ? 'bg-slate-500' : 'bg-brand-accent animate-pulse')} />
                {isClinicianMode ? 'Clinician mode · Workstation' : 'Patient mode · Hypertension AI'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Pressure Relief Toggle */}
            <button 
              onClick={toggleReliefMode}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#1a1a1a] dark:border-white transition-all font-semibold rounded-none text-[11px] uppercase tracking-wider",
                isReliefMode 
                  ? "bg-[#008080] text-white border-teal-600 shadow-none" 
                  : "bg-white dark:bg-slate-900 text-[#1a1a1a] dark:text-white shadow-[2px_2px_0px_0px_#1a1a1a] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              )}
            >
              <span className="material-symbols-outlined text-[15px]">{isReliefMode ? 'spa' : 'air'}</span>
              <span>{isReliefMode ? 'Breathing…' : 'Pressure Relief'}</span>
            </button>

            <ThemeToggle />
            <select
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              className="text-[12px] bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white text-gray-700 dark:text-gray-300 rounded-none px-2.5 py-1.5 focus:outline-none transition-all max-w-[180px] shadow-[2px_2px_0px_0px_#1a1a1a] dark:shadow-[2px_2px_0px_0px_#ffffff] font-bold uppercase"
            >
              {CASES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="flex border-2 border-[#1a1a1a] dark:border-white p-0 bg-[#f0f0f0] dark:bg-slate-800 rounded-none shadow-[2px_2px_0px_0px_#1a1a1a] dark:shadow-[2px_2px_0px_0px_#ffffff]">
              {(['patient', 'clinician'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-3 py-1.5 text-[11.5px] font-bold transition-all uppercase',
                    mode === m
                      ? isClinicianMode
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-none'
                        : 'bg-brand-accent text-white shadow-none'
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
                'p-2 rounded-none border-2 border-[#1a1a1a] dark:border-white transition-all',
                evidencePanelOpen
                  ? 'bg-brand-accent text-white shadow-none'
                  : 'bg-white dark:bg-slate-900 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shadow-[2px_2px_0px_0px_#1a1a1a] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
              )}
              title={evidencePanelOpen ? 'Hide evidence' : 'Show evidence'}
            >
              <BarChart3 size={15} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scroll-premium">
          {messages.length === 0 ? (
            <WelcomeScreen onQuestionClick={(text) => setInputValue(text)} />
          ) : (
            <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-4xl mx-auto">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  mode={mode}
                  username={user?.username || 'You'}
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
              'relative flex items-end gap-2 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white p-2 transition-all rounded-none',
              'shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]',
            )}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isClinicianMode ? 'ASK A CLINICIAN-GRADE CLINICAL QUESTION…' : 'ASK A CLINICAL QUESTION ABOUT HYPERTENSION MANAGEMENT…'}
                rows={1}
                className="flex-1 bg-transparent text-[#1a1a1a] dark:text-white placeholder-[#1a1a1a]/50 dark:placeholder-white/50 text-[14px] font-bold uppercase tracking-wide resize-none focus:outline-none focus:ring-0 leading-relaxed px-2 py-2 min-h-[36px] max-h-[200px]"
              />
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="text-[#1a1a1a] dark:text-white hover:bg-brand-accent hover:text-white dark:hover:bg-brand-accent transition-colors p-2 border-2 border-transparent hover:border-[#1a1a1a] dark:hover:border-white rounded-none shrink-0"
                title="Upload documents"
              >
                <span className="material-symbols-outlined text-[22px]">add_circle</span>
              </button>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  'shrink-0 h-9 px-4 rounded-none font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border-2 border-clinical-black dark:border-white',
                  inputValue.trim() && !isLoading
                    ? 'shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none bg-[#1a1a1a] hover:bg-brand-accent dark:bg-brand-accent dark:hover:bg-white dark:hover:text-black text-white'
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
