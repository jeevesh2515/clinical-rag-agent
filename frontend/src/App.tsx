import { useState, useEffect, useRef } from 'react'
import {
  Plus, MessageSquare, LogOut, User,
  Send, Activity, BookOpen, Shield, Zap, Brain, FlaskConical, Heart,
  X, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2,
  FileText, ExternalLink, Info, Stethoscope, Search, Trash2,
  BarChart3, Network, Database, Copy, Check, PanelLeftClose,
  PanelLeft, Sparkles
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  username: string
  email: string
  roles: string[]
  is_active: boolean
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
  { icon: Heart, text: 'When should drug treatment be considered for Stage 1 hypertension?', category: 'Guidelines' },
  { icon: Activity, text: 'What is the BP target for patients with CKD Stage 3?', category: 'Targets' },
  { icon: FlaskConical, text: 'Calculate MAP for blood pressure 140/90', category: 'Calculator' },
  { icon: Brain, text: 'What are the first-line medications for hypertension?', category: 'Treatment' },
  { icon: Stethoscope, text: 'What follow-up schedule is recommended after starting antihypertensives?', category: 'Follow-up' },
  { icon: BookOpen, text: 'Summarize NICE NG136 guidelines for hypertension management', category: 'NICE' },
]

const CASES = [
  { id: '', label: 'No case selected' },
  { id: 'htn-001', label: 'htn-001 \u2014 55M Stage 1 HTN' },
  { id: 'htn-002', label: 'htn-002 \u2014 68F HTN + CKD' },
  { id: 'htn-003', label: 'htn-003 \u2014 32F HTN + Pregnancy' },
  { id: 'htn-004', label: 'htn-004 \u2014 72M HTN + Diabetes' },
  { id: 'htn-005', label: 'htn-005 \u2014 48M Resistant HTN' },
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
  const s = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' }
  return <Loader2 className={cn('animate-spin', s[size], className)} />
}

function Badge({ children, variant = 'default', className = '' }: {
  children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'okf' | 'rag'; className?: string
}) {
  const v = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    danger: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    info: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    okf: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
    rag: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
  }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold', v[variant], className)}>{children}</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-400" />}
    </button>
  )
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: (user: UserProfile, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setIsLoading(true)
    try {
      if (mode === 'signup') await api.register(username, email, password)
      const { access_token } = await api.login(username, password)
      api.setToken(access_token)
      localStorage.setItem('cw_token', access_token)
      const user = await api.getCurrentUser()
      onAuth(user, access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl dark:bg-blue-500/10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl dark:bg-teal-500/10" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 shadow-lg shadow-blue-500/20 mb-4">
            <Stethoscope size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Clinical Workflows</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Evidence-Based Hypertension Care Planning</p>
        </div>
        <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 shadow-xl dark:shadow-2xl">
          <div className="flex bg-gray-100 dark:bg-gray-900/60 rounded-xl p-1 mb-6">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={cn('flex-1 py-2 text-sm font-semibold rounded-lg transition-all',
                  mode === m ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="Enter your username" />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="name@example.com" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                <AlertCircle size={14} className="text-red-500 dark:text-red-400 shrink-0" />
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button type="submit" disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
              {isLoading ? <><Spinner size="sm" /> {mode === 'login' ? 'Signing in\u2026' : 'Creating account\u2026'}</> : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-600 dark:text-blue-300 text-center">
              <Info size={12} className="inline mr-1" />
              Demo: Register with any username/email/password to get started
            </p>
          </div>
        </div>
        <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-6">For educational purposes only. Not for clinical use.</p>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ isOpen, onToggle, user, conversations, currentConvId, onNewChat, onSelectConv, onDeleteConv, onLogout, isLoading }: {
  isOpen: boolean; onToggle: () => void; user: UserProfile; conversations: ConversationSummary[]
  currentConvId: string | null; onNewChat: () => void; onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void; onLogout: () => void; isLoading: boolean
}) {
  const [search, setSearch] = useState('')
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)
  const filtered = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))

  const now = new Date()
  const today = filtered.filter(c => {
    const d = new Date(c.updated_at)
    return d.toDateString() === now.toDateString()
  })
  const week = filtered.filter(c => {
    const d = now.getTime() - new Date(c.updated_at).getTime()
    return d > 86400000 && d < 7 * 86400000
  })
  const older = filtered.filter(c =>
    now.getTime() - new Date(c.updated_at).getTime() >= 7 * 86400000
  )

  return (
    <aside className={cn(
      'flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out shrink-0',
      isOpen ? 'w-72' : 'w-0 overflow-hidden'
    )}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center shrink-0">
            <Stethoscope size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">Clinical Workflows</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">Hypertension AI</p>
          </div>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ml-2">
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="p-3">
        <button onClick={onNewChat}
          className="flex items-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-sm px-4 py-2.5 text-sm">
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations\u2026"
            className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-500 text-xs">No conversations yet</p>
          </div>
        ) : (
          <>
            {today.length > 0 && (
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Today</p>
              </div>
            )}
            {today.map(c => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
            {week.length > 0 && (
              <div className="px-2 py-1.5 mt-2">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">This Week</p>
              </div>
            )}
            {week.map(c => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
            {older.length > 0 && (
              <div className="px-2 py-1.5 mt-2">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Earlier</p>
              </div>
            )}
            {older.map(c => (
              <ConvItem key={c.id} conv={c} isActive={c.id === currentConvId}
                hovered={hoveredConv === c.id} onHover={setHoveredConv}
                onSelect={onSelectConv} onDelete={onDeleteConv} />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {getInitials(user.username)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{user.username}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs truncate capitalize">{user.roles[0] || 'patient'}</p>
          </div>
          <button onClick={onLogout} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function ConvItem({ conv, isActive, hovered, onHover, onSelect, onDelete }: {
  conv: ConversationSummary; isActive: boolean; hovered: boolean
  onHover: (id: string | null) => void; onSelect: (id: string) => void; onDelete: (id: string) => void
}) {
  return (
    <div
      className={cn('group relative flex items-center rounded-lg transition-all cursor-pointer px-3 py-2',
        isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-300')}
      onClick={() => onSelect(conv.id)} onMouseEnter={() => onHover(conv.id)} onMouseLeave={() => onHover(null)}>
      <MessageSquare size={14} className={cn('shrink-0', isActive ? 'text-blue-500' : 'text-gray-400')} />
      <div className="flex-1 min-w-0 ml-2.5">
        <p className="text-sm font-medium truncate leading-tight">{conv.title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatRelativeTime(conv.updated_at)}</p>
      </div>
      {hovered && (
        <button onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
          className="ml-1 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Message Component ────────────────────────────────────────────────────────

function MessageBubble({ message, onCitationClick }: { message: ChatMessage; onCitationClick: (c: Citation[]) => void }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-4 w-full group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white text-xs font-bold' : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700')}>
        {isUser ? <User size={14} /> : <Stethoscope size={14} className="text-blue-600 dark:text-blue-400" />}
      </div>
      <div className={cn('flex flex-col gap-1.5 max-w-[70%]', isUser ? 'items-end' : 'items-start')}>
        <div className={cn('px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-2xl rounded-tr-sm'
            : 'bg-white dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50 rounded-2xl rounded-tl-sm shadow-sm')}>
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        {!isUser && (message.citations?.length || message.tool_trace?.length || message.knowledge_path?.path) && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {message.citations && message.citations.length > 0 && (
              <button onClick={() => onCitationClick(message.citations!)}
                className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700/50 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all">
                <BookOpen size={11} /><span>{message.citations.length} source{message.citations.length !== 1 ? 's' : ''}</span>
              </button>
            )}
            {message.tool_trace && message.tool_trace.length > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-lg text-xs text-gray-500">
                <Zap size={11} className="text-amber-500" /><span>{message.tool_trace.map(t => t.name).join(', ')}</span>
              </div>
            )}
            {message.knowledge_path?.path && (
              <Badge variant={message.knowledge_path.path === 'okf' ? 'okf' : 'rag'}>
                {message.knowledge_path.path === 'okf' ? '\u2B21 OKF' : message.knowledge_path.path === 'okf_then_rag' ? '\u2B21 OKF+RAG' : '\u25C6 RAG'}
              </Badge>
            )}
            {message.safety_flags?.medical_disclaimer && (
              <Badge variant="warning"><Shield size={10} className="mr-1" /> Disclaimer</Badge>
            )}
          </div>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ─── Evidence Panel ───────────────────────────────────────────────────────────

function EvidencePanel({ isOpen, onClose, citations, toolTrace, safetyFlags, knowledgePath }: {
  isOpen: boolean; onClose: () => void; citations: Citation[]; toolTrace: ToolTrace[]
  safetyFlags: SafetyFlags | null; knowledgePath: KnowledgePath | null
}) {
  const [tab, setTab] = useState<'citations' | 'tools' | 'safety' | 'knowledge'>('citations')
  const tabs = [
    { id: 'citations' as const, label: 'Sources', icon: BookOpen, count: citations.length },
    { id: 'tools' as const, label: 'Tools', icon: Zap, count: toolTrace.length },
    { id: 'safety' as const, label: 'Safety', icon: Shield, count: safetyFlags?.unsupported_claims_detected ? 1 : 0 },
    { id: 'knowledge' as const, label: 'Knowledge', icon: Network, count: knowledgePath?.okf_concepts?.length || 0 },
  ]
  return (
    <aside className={cn(
      'flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out shrink-0',
      isOpen ? 'w-80' : 'w-0 overflow-hidden'
    )}>
      {isOpen && (
        <>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Evidence &amp; Context</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={15} /></button>
          </div>
          <div className="flex border-b border-gray-200 dark:border-gray-800 px-2 pt-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all',
                  tab === t.id ? 'text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-800/60 border border-b-0 border-gray-200 dark:border-gray-700/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
                <t.icon size={12} />{t.label}
                {t.count > 0 && <span className="ml-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">{t.count}</span>}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tab === 'citations' && (
              citations.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-500 text-sm">No citations yet</p>
                  <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Ask a clinical question to see sources</p>
                </div>
              ) : citations.map((c, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-gray-900 dark:text-gray-200 text-xs font-semibold leading-tight">{c.title}</p>
                    <Badge variant={c.source_type === 'okf' ? 'okf' : 'rag'} className="shrink-0">{c.source_type?.toUpperCase() || 'RAG'}</Badge>
                  </div>
                  {c.quote && (
                    <blockquote className="border-l-2 border-blue-500/50 pl-2 text-gray-500 dark:text-gray-400 text-xs italic leading-relaxed">
                      &ldquo;{c.quote}&rdquo;
                    </blockquote>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-500">
                    {c.page && <span className="flex items-center gap-1"><FileText size={10} /> p.{c.page}</span>}
                    {c.organization && <span>{c.organization}</span>}
                    {c.publication_year && <span>{c.publication_year}</span>}
                  </div>
                  {c.source_url && (
                    <a href={c.source_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors">
                      <ExternalLink size={10} /> View source
                    </a>
                  )}
                  {c.chunk_id && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500 font-mono">
                      <Database size={10} /><span className="truncate">{c.chunk_id}</span><CopyButton text={c.chunk_id} />
                    </div>
                  )}
                </div>
              ))
            )}
            {tab === 'tools' && (
              toolTrace.length === 0 ? (
                <div className="text-center py-12"><Zap size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-500 text-sm">No tools used</p></div>
              ) : toolTrace.map((t, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center"><Zap size={12} className="text-amber-600 dark:text-amber-400" /></div>
                    <p className="text-gray-900 dark:text-gray-200 text-xs font-semibold">{t.name}</p>
                    {t.duration_ms && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{t.duration_ms}ms</span>}
                  </div>
                  {(t.input_summary || t.inputs) && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1 font-semibold uppercase tracking-wider">Input</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900/60 rounded-lg p-2">{t.input_summary || JSON.stringify(t.inputs)}</p>
                    </div>
                  )}
                  {(t.output_summary || t.output !== undefined) && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1 font-semibold uppercase tracking-wider">Output</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-900/60 rounded-lg p-2">{t.output_summary || JSON.stringify(t.output)}</p>
                    </div>
                  )}
                </div>
              ))
            )}
            {tab === 'safety' && (
              <div className="space-y-3">
                <div className={cn('flex items-start gap-3 p-3 rounded-xl border', safetyFlags?.unsupported_claims_detected ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20')}>
                  {safetyFlags?.unsupported_claims_detected ? <AlertCircle size={16} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn('text-sm font-semibold', safetyFlags?.unsupported_claims_detected ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>
                      {safetyFlags?.unsupported_claims_detected ? 'Unsupported Claims Detected' : 'Claims Validated'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{safetyFlags?.unsupported_claims_detected ? 'Some claims could not be fully supported by indexed sources.' : 'All clinical claims are supported by indexed guideline sources.'}</p>
                  </div>
                </div>
                {safetyFlags?.medical_disclaimer && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                    <Info size={16} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Medical Disclaimer</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This information is for educational workflow support only and must not replace clinical judgment.</p>
                    </div>
                  </div>
                )}
                {!safetyFlags && <div className="text-center py-8"><Shield size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-500 text-sm">No safety data</p></div>}
              </div>
            )}
            {tab === 'knowledge' && (
              <div className="space-y-3">
                {knowledgePath ? (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Network size={14} className="text-violet-500 dark:text-violet-400" />
                        <p className="text-gray-900 dark:text-gray-200 text-xs font-semibold">Knowledge Path</p>
                        <Badge variant={knowledgePath.path === 'okf' ? 'okf' : 'rag'} className="ml-auto">{knowledgePath.path?.toUpperCase() || 'RAG'}</Badge>
                      </div>
                      {knowledgePath.reason && <p className="text-xs text-gray-500 dark:text-gray-400">{knowledgePath.reason}</p>}
                    </div>
                    {knowledgePath.okf_concepts && knowledgePath.okf_concepts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-2">OKF Concepts Matched</p>
                        {knowledgePath.okf_concepts.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/30 rounded-lg mb-1.5">
                            <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0"><Brain size={11} className="text-violet-600 dark:text-violet-400" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 dark:text-gray-200 text-xs font-medium truncate">{c.title}</p>
                              <p className="text-gray-400 dark:text-gray-500 text-[10px] font-mono truncate">{c.source_path}</p>
                            </div>
                            <div className="shrink-0">
                              <div className="w-8 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${c.confidence * 100}%` }} />
                              </div>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-0.5">{Math.round(c.confidence * 100)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : <div className="text-center py-12"><Network size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-500 text-sm">No knowledge path data</p></div>}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ onQuestionClick }: { onQuestionClick: (text: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col items-center justify-center min-h-full text-center px-6 py-16 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-teal-100 dark:from-blue-500/20 dark:to-teal-500/20 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center mb-6">
          <Sparkles size={28} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">How can I help you today?</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-10 max-w-md">
          Evidence-based hypertension management assistant powered by NICE, WHO, and CDC guidelines with RAG + OKF retrieval.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => onQuestionClick(q.text)}
              className="flex items-start gap-3 p-3.5 bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-500/30 rounded-xl text-left transition-all group">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-all">
                <q.icon size={13} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wider">{q.category}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{q.text}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('cw_token')
    if (savedToken) {
      api.setToken(savedToken)
      api.getCurrentUser().then(u => setUser(u)).catch(() => localStorage.removeItem('cw_token'))
    }
  }, [])

  useEffect(() => {
    if (user) {
      setIsFetchingConvs(true)
      api.listConversations().then(setConversations).catch(() => {}).finally(() => setIsFetchingConvs(false))
    }
  }, [user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  const handleAuth = (u: UserProfile, t: string) => { setUser(u); api.setToken(t) }

  const handleLogout = () => {
    setUser(null); api.setToken(null); localStorage.removeItem('cw_token')
    setConversations([]); setMessages([]); setCurrentConvId(null)
  }

  const handleNewChat = () => {
    setCurrentConvId(null); setMessages([]); setInputValue('')
    setPanelCitations([]); setPanelTools([]); setPanelSafety(null); setPanelKnowledge(null)
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
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    setIsLoading(true)
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: question, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    try {
      let convId = currentConvId
      if (!convId) {
        const conv = await api.createConversation(question.slice(0, 50))
        convId = conv.id; setCurrentConvId(convId)
        setConversations(prev => [{ id: conv.id, title: conv.title, updated_at: conv.updated_at }, ...prev])
      }
      const assistantMsg = await api.sendMessage(convId, question, mode, caseId || undefined)
      setMessages(prev => [...prev, assistantMsg])
      setPanelCitations(assistantMsg.citations || []); setPanelTools(assistantMsg.tool_trace || [])
      setPanelSafety(assistantMsg.safety_flags || null); setPanelKnowledge(assistantMsg.knowledge_path || null)
      if (assistantMsg.citations?.length || assistantMsg.tool_trace?.length) setEvidencePanelOpen(true)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c))
    } catch (err) {
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`, timestamp: new Date().toISOString() }])
    } finally { setIsLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px' }
  }

  const currentConv = conversations.find(c => c.id === currentConvId)

  if (!user) return <AuthScreen onAuth={handleAuth} />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} user={user}
        conversations={conversations} currentConvId={currentConvId} onNewChat={handleNewChat}
        onSelectConv={handleSelectConv} onDeleteConv={handleDeleteConv} onLogout={handleLogout} isLoading={isFetchingConvs} />

      {/* Main Chat Area */}
      <main className="flex flex-col flex-1 min-w-0 bg-white dark:bg-gray-950">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 backdrop-blur-sm shrink-0">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <PanelLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-sm truncate">
              {currentConv?.title || 'Clinical Workflows'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={caseId} onChange={e => setCaseId(e.target.value)}
              className="text-xs bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all">
              {CASES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="flex bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 p-0.5 rounded-lg">
              {(['patient', 'clinician'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn('px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize', mode === m ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={() => setEvidencePanelOpen(!evidencePanelOpen)}
              className={cn('p-1.5 rounded-lg transition-all', evidencePanelOpen ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')}>
              <BarChart3 size={16} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen onQuestionClick={(text) => setInputValue(text)} />
          ) : (
            <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} onCitationClick={c => { setPanelCitations(c); setEvidencePanelOpen(true) }} />
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                    <Stethoscope size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 bg-white dark:bg-gray-950 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-3 focus-within:border-blue-400 dark:focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all shadow-sm">
              <textarea ref={textareaRef} value={inputValue} onChange={handleInput} onKeyDown={handleKeyDown}
                placeholder="Ask a clinical question about hypertension management\u2026" rows={1}
                className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-[200px] py-0.5" />
              <button onClick={handleSend} disabled={!inputValue.trim() || isLoading}
                className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-sm disabled:shadow-none">
                {isLoading ? <Spinner size="sm" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-2">
              Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-mono">Enter</kbd> to send \u00B7 <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line \u00B7 For educational purposes only
            </p>
          </div>
        </div>
      </main>

      <EvidencePanel isOpen={evidencePanelOpen} onClose={() => setEvidencePanelOpen(false)}
        citations={panelCitations} toolTrace={panelTools} safetyFlags={panelSafety} knowledgePath={panelKnowledge} />
    </div>
  )
}
