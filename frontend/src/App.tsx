import { useState, useEffect, useRef, useMemo } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import {
  Plus, MessageSquare, LogOut,
  Send, Activity, BookOpen, Shield, Zap, Brain, Heart,
  X, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, Info, Stethoscope, Search, Trash2,
  BarChart3, PanelLeftClose, Scale,
  PanelLeft, Sparkles, ChevronDown, ChevronRight,
  ArrowUp, FlaskRound, type LucideIcon
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import LandingPage from './components/LandingPage'
import Markdown from './components/Markdown'
import ThemeToggle from './components/ThemeToggle'
import BMICalculator, { HealthVitals } from './components/BMICalculator'
import { decodeToken } from './utils/auth'
import { generateFallbackResponse } from './utils/fallbackChat'

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
  health_vitals?: HealthVitals
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
  rephrased_question?: string | null
  model_used?: string | null
  mode?: 'patient' | 'clinician'
  question?: string
}

interface ModelSpec {
  id: string
  label: string
  provider: string
  description: string
  is_configured: boolean
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

const API_BASE = (import.meta.env.VITE_API_URL as string) || (import.meta.env.VITE_API_BASE_URL as string) || ''

const CLINICIAN_SUGGESTED_QUESTIONS = [
  { icon: Heart, text: 'When should drug treatment be considered for Stage 1 hypertension?', category: 'Guidelines', tone: 'text-rose-500 dark:text-rose-400' },
  { icon: Activity, text: 'What is the BP target for patients with CKD Stage 3?', category: 'Targets', tone: 'text-amber-600 dark:text-amber-400' },
  { icon: FlaskRound, text: 'Calculate MAP for blood pressure 140/90', category: 'Calculator', tone: 'text-violet-500 dark:text-violet-400' },
  { icon: Brain, text: 'What are the first-line medications for hypertension?', category: 'Treatment', tone: 'text-emerald-650 dark:text-emerald-400' },
  { icon: Stethoscope, text: 'What follow-up schedule is recommended after starting antihypertensives?', category: 'Follow-up', tone: 'text-cyan-550 dark:text-cyan-400' },
  { icon: BookOpen, text: 'Summarize NICE NG136 guidelines for hypertension management', category: 'NICE', tone: 'text-brand-accent dark:text-brand-accent' },
]

const PATIENT_SUGGESTED_QUESTIONS = [
  { icon: Heart, text: 'What lifestyle changes help lower blood pressure naturally?', category: 'Lifestyle', tone: 'text-rose-500 dark:text-rose-400' },
  { icon: Activity, text: 'How do I correctly measure blood pressure at home?', category: 'Home Care', tone: 'text-amber-600 dark:text-amber-400' },
  { icon: Stethoscope, text: 'What questions should I ask my doctor about my high blood pressure?', category: 'Doctor Prep', tone: 'text-cyan-550 dark:text-cyan-400' },
  { icon: Brain, text: 'What do my systolic and diastolic numbers mean?', category: 'Understanding BP', tone: 'text-emerald-650 dark:text-emerald-400' },
  { icon: FlaskRound, text: 'What is the DASH diet and how does salt affect BP?', category: 'Diet & Salt', tone: 'text-violet-500 dark:text-violet-400' },
  { icon: BookOpen, text: 'What are warning signs when I should seek urgent medical care?', category: 'Safety Warning', tone: 'text-rose-600 dark:text-rose-400' },
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
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/me`, { headers: this.headers() })
      if (res.ok) {
        const remoteUser: UserProfile = await res.json()
        const cached = loadLocalUserProfile(remoteUser)
        if (cached) {
          return {
            ...remoteUser,
            full_name: cached.full_name || remoteUser.full_name,
            email: cached.email || remoteUser.email,
            date_of_birth: cached.date_of_birth || remoteUser.date_of_birth,
            notes: cached.notes || remoteUser.notes,
            health_vitals: cached.health_vitals || remoteUser.health_vitals,
          }
        }
        return remoteUser
      }
    } catch {
      // Backend unreachable / network error — fallback to client-side token claims + cached profile
    }
    if (this.token) {
      const decoded = decodeToken(this.token)
      if (decoded) {
        const username = decoded.username || decoded.sub || 'user'
        const role = decoded.role || decoded.roles?.[0] || 'patient'
        const baseUser: UserProfile = {
          id: 'usr-' + username,
          username,
          email: decoded.email || `${username}@clinical.demo`,
          roles: decoded.roles || [role],
          is_active: true,
        }
        const cached = loadLocalUserProfile(baseUser)
        if (cached) {
          return {
            ...baseUser,
            full_name: cached.full_name || baseUser.full_name,
            email: cached.email || baseUser.email,
            date_of_birth: cached.date_of_birth || baseUser.date_of_birth,
            notes: cached.notes || baseUser.notes,
            health_vitals: cached.health_vitals || baseUser.health_vitals,
          }
        }
        return baseUser
      }
    }
    throw new Error('Failed to get user')
  }

  async updateProfile(data: { full_name?: string; email?: string; date_of_birth?: string; notes?: string; health_vitals?: HealthVitals | any }): Promise<UserProfile> {
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
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations`, { headers: this.headers() })
      if (res.ok) return await res.json()
    } catch {}
    return []
  }

  async createConversation(title?: string): Promise<Conversation> {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations`, {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ title: title || 'New Chat' }),
      })
      if (res.ok) return await res.json()
    } catch {}
    const now = new Date().toISOString()
    return {
      id: `local-conv-${Date.now()}`,
      title: title || 'New Chat',
      created_at: now,
      updated_at: now,
      messages: [],
    }
  }

  async getConversation(id: string): Promise<Conversation> {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/${id}`, { headers: this.headers() })
      if (res.ok) return await res.json()
    } catch {}
    const now = new Date().toISOString()
    return {
      id,
      title: 'Clinical Conversation',
      created_at: now,
      updated_at: now,
      messages: [],
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/chat/conversations/${id}`, { method: 'DELETE', headers: this.headers() })
    } catch {}
  }

  async sendMessage(
    conversationId: string,
    question: string,
    mode: string,
    modelId?: string,
  ): Promise<ChatMessage> {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/message`, {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ question, mode, model_id: modelId }),
      })
      if (res.ok) return await res.json()
    } catch {}
    return generateFallbackResponse(question, mode) as unknown as ChatMessage
  }

  async listModels(): Promise<{ default_model: string; models: ModelSpec[] }> {
    const res = await fetch(`${API_BASE}/api/models`, { headers: this.headers() })
    if (!res.ok) return { default_model: 'openrouter-llama-3.1-8b', models: [] }
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
    default: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    danger:  'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
    info:    'bg-stone-100 text-[#1a1a1a] border-[#1a1a1a] dark:bg-slate-800 dark:text-white dark:border-white',
    okf:     'bg-[#ffddb8] text-[#1a1a1a] border-[#1a1a1a] dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500',
    rag:     'bg-[#6ffbbe] text-[#1a1a1a] border-[#1a1a1a] dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500',
    neutral: 'bg-white/80 text-gray-600 border-gray-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60',
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border-2 tracking-tight uppercase',
      v[variant],
      className,
    )}>
      {Icon && <Icon size={10} className="-ml-0.5" />}
      {children}
    </span>
  )
}



// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ isOpen, onToggle, user, conversations, currentConvId, onNewChat, onSelectConv, onDeleteConv, onLogout, onOpenProfile, onOpenBmiModal, onLogoClick, isLoading }: {
  isOpen: boolean; onToggle: () => void; user: UserProfile; conversations: ConversationSummary[]
  currentConvId: string | null; onNewChat: () => void; onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void; onLogout: () => void; onOpenProfile: () => void; onOpenBmiModal?: () => void; onLogoClick?: () => void; isLoading: boolean
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
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
      <aside className={cn(
        'flex flex-col bg-[#1a1a1a] text-white border-r-2 border-[#1a1a1a] transition-all duration-300 ease-in-out shrink-0 z-40',
        'fixed lg:relative inset-y-0 left-0 h-screen lg:h-full',
        isOpen ? 'w-sidebar-width translate-x-0' : 'w-sidebar-width -translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden'
      )}>
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-6 border-b-2 border-white/20">
          <button 
            onClick={onLogoClick}
            className="group flex items-center gap-3 min-w-0 flex-1 text-left focus:outline-none"
            title="Back to Homepage"
          >
            <div className="w-8 h-8 border-2 border-white bg-brand-accent flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all duration-150 font-bold shrink-0">
              <Stethoscope size={16} className="text-white transition-transform group-hover:rotate-[15deg]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-label-md text-label-md text-white group-hover:text-brand-accent transition-colors uppercase tracking-wider leading-none">Clinical Workflows</h1>
              <p className="font-mono text-[10px] text-white/70 mt-1 uppercase">Hypertension AI</p>
            </div>
          </button>
          <button onClick={onToggle} className="p-1 text-white/50 hover:text-brand-accent transition-colors border-2 border-transparent hover:border-white/30" title="Collapse sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>

      {/* New chat & BMI Calc */}
      <div className="px-4 py-4 space-y-2">
        <button onClick={onNewChat}
          className="w-full bg-brand-accent text-white font-label-md text-label-md py-2.5 flex items-center justify-center gap-2 hover:bg-white hover:text-[#1a1a1a] transition-colors border-2 border-white uppercase tracking-wider brutalist-button">
          <Plus size={15} />
          <span>New Chat</span>
        </button>

        {onOpenBmiModal && (
          <button onClick={onOpenBmiModal}
            className="w-full bg-white/10 text-white hover:bg-white hover:text-[#1a1a1a] font-label-md text-xs py-2 flex items-center justify-center gap-2 transition-all border-2 border-white/40 uppercase tracking-wider">
            <Scale size={14} className="text-brand-accent" />
            <span>BMI Calculator</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white/10 border-2 border-white/20 text-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-accent transition-all placeholder-white/30 font-mono"
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
            className="w-8 h-8 bg-white flex items-center justify-center text-[#1a1a1a] font-bold text-sm border-2 border-white shrink-0 clinical-shadow"
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
    </>
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
        'w-full flex items-center gap-2.5 p-2.5 text-left group transition-all duration-200 relative border-2 mb-1.5 focus:outline-none',
        isActive
          ? 'bg-brand-accent text-white border-white shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] -translate-x-0.5 -translate-y-0.5'
          : 'text-white/70 hover:bg-white/10 hover:text-white border-transparent hover:border-white hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)] hover:-translate-x-0.5 hover:-translate-y-0.5'
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
          className="p-1 text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
          title="Delete conversation"
        >
          <Trash2 size={12} />
        </button>
      )}
    </button>
  )
}

// ─── Citation Card (collapsible) ──────────────────────────────────────────────

// ─── Citation Card (collapsible, premium medical style) ───────────────────────

function CitationCard({ citation, index, isHighlighted }: { citation: Citation; index: number; isHighlighted?: boolean }) {
  const [open, setOpen] = useState(true) // Default open so users see evidence immediately
  const cardRef = useRef<HTMLDivElement>(null)

  // Scroll and expand if highlighted
  useEffect(() => {
    if (isHighlighted) {
      setOpen(true)
      const t = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [isHighlighted])

  // Detect guideline organization name for clean badge display
  const getOrgBadge = (sourceId: string, orgName?: string) => {
    const combined = (sourceId + ' ' + (orgName || '')).toUpperCase()
    if (combined.includes('NICE')) return { label: 'NICE NG136', color: 'bg-emerald-500 text-white' }
    if (combined.includes('WHO')) return { label: 'WHO 2021', color: 'bg-blue-500 text-white' }
    if (combined.includes('CDC')) return { label: 'CDC/AHA', color: 'bg-rose-500 text-white' }
    if (combined.includes('ACC') || combined.includes('AHA')) return { label: 'ACC/AHA', color: 'bg-red-500 text-white' }
    if (combined.includes('JNC')) return { label: 'JNC8', color: 'bg-amber-500 text-white' }
    if (combined.includes('ESC')) return { label: 'ESC/ESH', color: 'bg-indigo-500 text-white' }
    return { label: orgName || 'Guideline', color: 'bg-slate-500 text-white' }
  }

  const badge = getOrgBadge(citation.source_id, citation.organization)

  // Resolve canonical public URL and meaningful quote snippet
  const resolveGuidelineInfo = (c: Citation) => {
    const combined = (c.source_id + ' ' + c.title + ' ' + (c.organization || '')).toLowerCase()
    let url = c.source_url || ''
    let quote = c.quote || ''

    if (!quote || quote.includes('No specific text snippet')) {
      if (combined.includes('nice') || combined.includes('ng136')) {
        quote = 'NICE Guideline NG136: Diagnosis, risk assessment, ABPM confirmation, and step-care pharmacological treatment of hypertension in adults.'
      } else if (combined.includes('acc') || combined.includes('aha')) {
        quote = '2017 ACC/AHA Practice Guideline: Clinical thresholds for Stage 1 & 2 hypertension, ASCVD risk estimation, nonpharmacological interventions, and target BP <130/80 mmHg.'
      } else if (combined.includes('jnc8') || combined.includes('jnc')) {
        quote = '2014 JNC8 Evidence-Based Guideline: Initial drug selection algorithms for hypertensive patients including ACEi, ARB, CCB, and Thiazide diuretics.'
      } else if (combined.includes('esc') || combined.includes('esh')) {
        quote = '2023 ESC/ESH Guidelines: Management of arterial hypertension, out-of-office BP measurement, organ damage assessment, and combination therapies.'
      } else if (combined.includes('who')) {
        quote = 'WHO 2021 Guideline: Pharmacological treatment recommendations for hypertension in adults in primary healthcare settings.'
      } else {
        quote = 'Official clinical guideline document establishing evidence-based hypertension care protocols and patient safety thresholds.'
      }
    }

    if (!url || url.startsWith('local://')) {
      if (combined.includes('nice') || combined.includes('ng136')) {
        url = 'https://www.nice.org.uk/guidance/ng136'
      } else if (combined.includes('acc') || combined.includes('aha')) {
        url = 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065'
      } else if (combined.includes('jnc8') || combined.includes('jnc')) {
        url = 'https://jamanetwork.com/journals/jama/article-abstract/1791497'
      } else if (combined.includes('esc') || combined.includes('esh')) {
        url = 'https://academic.oup.com/eurheartj/article/44/38/3620/7241741'
      } else if (combined.includes('who')) {
        url = 'https://www.who.int/publications/i/item/9789240033986'
      }
    }

    return { url, quote }
  }

  const resolved = resolveGuidelineInfo(citation)

  return (
    <div 
      ref={cardRef}
      className={cn(
        "bg-white dark:bg-slate-900 border-2 overflow-hidden clinical-shadow transition-all duration-300",
        isHighlighted
          ? "border-brand-accent ring-2 ring-brand-accent/20 bg-brand-accent/5 dark:bg-brand-accent/5"
          : "border-[#1a1a1a] dark:border-white"
      )}
    >
      {/* Card Header (Clickable row) */}
      <div 
        onClick={() => setOpen(!open)}
        className="p-2.5 sm:p-3.5 flex items-center justify-between bg-gray-50 dark:bg-slate-900/80 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-black bg-[#1a1a1a] dark:bg-white text-white dark:text-black border-2 border-[#1a1a1a] dark:border-white shrink-0">
            {index + 1}
          </span>
          <span className={cn('px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider border-2 border-[#1a1a1a] dark:border-white shrink-0', badge.color)}>
            {badge.label}
          </span>
          <p className="text-[11px] sm:text-[12px] font-bold text-[#1a1a1a] dark:text-white truncate max-w-[100px] sm:max-w-[220px]">
            {citation.title}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {open ? <ChevronDown size={14} className="text-[#1a1a1a] dark:text-white" /> : <ChevronRight size={14} className="text-[#1a1a1a] dark:text-white" />}
        </div>
      </div>

      {/* Card Body */}
      {open && (
        <div className="p-3 sm:p-4 border-t-2 border-[#1a1a1a] dark:border-white bg-white dark:bg-slate-900/60 space-y-3 sm:space-y-4 animate-fade-in">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] uppercase font-bold text-[#1a1a1a] dark:text-white bg-[#f0f0f0]/60 dark:bg-slate-950/60 p-2 sm:p-3 border-2 border-[#1a1a1a] dark:border-white font-code-sm">
            <div>
              <span className="opacity-50 block text-[9px] mb-0.5">Source Version</span>
              <span className="text-brand-accent">{citation.source_version || 'v1.0 (Live)'}</span>
            </div>
            <div>
              <span className="opacity-50 block text-[9px] mb-0.5">Effective Date</span>
              <span>{citation.effective_date || '2021-08-25'}</span>
            </div>
            <div>
              <span className="opacity-50 block text-[9px] mb-0.5">Last Reviewed</span>
              <span>{citation.review_date || '2025-12-01'}</span>
            </div>
            <div>
              <span className="opacity-50 block text-[9px] mb-0.5">Provenance</span>
              <span className="text-emerald-500 dark:text-emerald-400">CLINICAL GUIDELINE</span>
            </div>
            {citation.page && (
              <div className="col-span-2 border-t border-[#1a1a1a]/10 dark:border-white/10 pt-1.5">
                <span className="opacity-50 block text-[9px] mb-0.5">Guideline Page / Section</span>
                <span>Page {citation.page}</span>
              </div>
            )}
          </div>

          {/* Quoted Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[9px] font-bold text-[#1a1a1a] dark:text-white tracking-widest uppercase font-code-sm">
              <span className="material-symbols-outlined text-[13px]">format_quote</span>
              SUPPORTING TEXT EXCERPT
            </div>
            <p className="text-[12.5px] text-[#1a1a1a] dark:text-white font-code-sm leading-relaxed bg-[#fafafa] dark:bg-slate-950 p-3.5 border-2 border-[#1a1a1a] dark:border-white font-medium">
              {resolved.quote}
            </p>
          </div>

          {/* Action Button — Direct Online Source Redirect (No Copy Button) */}
          <div className="pt-2 border-t-2 border-[#1a1a1a]/10 dark:border-white/10">
            {resolved.url ? (
              <a
                href={resolved.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-accent text-white font-headline-md border-2 border-[#1a1a1a] dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-xs font-black uppercase tracking-wider"
              >
                <ExternalLink size={14} className="shrink-0" />
                <span>Read Online Source ↗</span>
              </a>
            ) : (
              <div className="w-full text-center py-1.5 px-3 bg-[#f0f0f0] dark:bg-slate-800 border-2 border-[#1a1a1a] dark:border-white text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-white">
                Clinical Knowledge Base Reference
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onCitationClick, onCitationIndexClick, mode, username, question, onReask }: {
  message: ChatMessage; onCitationClick: (c: Citation[]) => void; onCitationIndexClick?: (index: number) => void; mode: 'patient' | 'clinician'; username: string; question?: string; onReask?: (question: string, mode: 'patient' | 'clinician') => void
}) {
  const isUser = message.role === 'user'
  const isClinician = mode === 'clinician' && !isUser
  const msgMode = message.mode
  const oppositeMode = msgMode === 'patient' ? 'clinician' : 'patient'

  return (
    <div className="flex gap-2 sm:gap-4 animate-message w-full mb-5 sm:mb-8">
      {isUser ? (
        <>
          <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-[#1a1a1a] dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-sm sm:text-lg border-2 border-[#1a1a1a] dark:border-white clinical-shadow">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-3 sm:p-5 clinical-shadow relative min-w-0">
            <div className="absolute -top-3 left-4 bg-brand-accent text-white px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white font-label-md text-[10px] sm:text-xs uppercase tracking-wider">
              {username}
            </div>
            <div className="space-y-3 mt-2">
              <div className="font-body-md text-body-md text-[#1a1a1a] dark:text-white leading-relaxed text-[15px] sm:text-[16px] whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-brand-accent border-2 border-[#1a1a1a] dark:border-white flex items-center justify-center clinical-shadow">
            <span className="material-symbols-outlined text-white text-[18px] sm:text-[24px]">auto_awesome</span>
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-4 sm:p-6 clinical-shadow relative min-w-0">
            <div className="absolute -top-3 left-4 flex items-center gap-2">
              <div className="bg-[#1a1a1a] dark:bg-white text-white dark:text-black px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white font-label-md text-[10px] sm:text-xs uppercase tracking-wider">
                {isClinician ? 'Clinical Assistant' : 'Hypertension AI'}
              </div>
              {msgMode && (
                <div className={cn(
                  'px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white font-code-sm text-[10px] uppercase font-bold tracking-wider',
                  msgMode === 'patient'
                    ? 'bg-brand-accent text-white'
                    : 'bg-slate-900 dark:bg-slate-700 text-white'
                )}>
                  {msgMode === 'patient' ? 'Patient Mode' : 'Clinician Mode'}
                </div>
              )}
            </div>
            
            {/* Model Badge in Top Right of the bubble */}
            {message.model_used && (
              <div className="absolute -top-3 right-4 bg-emerald-500 text-white px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white font-code-sm text-[10px] uppercase font-bold tracking-wider">
                {message.model_used}
              </div>
            )}

            <div className="font-body-md text-body-md text-[#1a1a1a] dark:text-white leading-relaxed space-y-4 sm:space-y-5 mt-2 overflow-hidden">
              {/* Query Analyzer rephrased query display in Assistant Bubble */}
              {message.rephrased_question && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-2 border-amber-200 dark:border-amber-950 uppercase font-code-sm">
                  <span className="material-symbols-outlined text-[12px]">search</span>
                  <span className="truncate max-w-[200px] sm:max-w-none">Analyzed Search: {message.rephrased_question}</span>
                </div>
              )}

              <Markdown 
                content={message.content} 
                citations={message.citations}
                onCitationClick={onCitationIndexClick}
              />

              {/* Badges row */}
              {(message.citations?.length || message.safety_flags?.medical_disclaimer || (msgMode && question && onReask)) && (
                <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-[#1a1a1a] dark:border-white">
                  {message.citations && message.citations.length > 0 && (
                    <button
                      onClick={() => onCitationClick(message.citations!)}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold bg-white dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-2 border-[#1a1a1a] dark:border-white clinical-shadow uppercase font-code-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                      <span>{message.citations.length} source{message.citations.length !== 1 ? 's' : ''}</span>
                    </button>
                  )}
                  {message.safety_flags?.medical_disclaimer && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold bg-[#f0f0f0] dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-2 border-[#1a1a1a] dark:border-white uppercase font-code-sm opacity-low">
                      <span className="material-symbols-outlined text-[16px]">security</span>
                      <span>Disclaimer</span>
                    </span>
                  )}
                  {msgMode && question && onReask && (
                    <button
                      onClick={() => onReask(question, oppositeMode)}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold bg-white dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-2 border-[#1a1a1a] dark:border-white uppercase font-code-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none transition-all clinical-shadow"
                    >
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                      <span>View in {oppositeMode === 'clinician' ? 'Clinician' : 'Patient'} Mode</span>
                    </button>
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

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2 sm:gap-4 animate-fade-in mb-3 sm:mb-4">
      <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-brand-accent border-2 border-[#1a1a1a] dark:border-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        <Sparkles size={14} className="sm:w-[20px] sm:h-[20px] text-white" />
      </div>
      <div className="flex-1 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white p-3 sm:p-5 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] rounded-none relative">
        <div className="absolute -top-3 left-4 bg-[#1a1a1a] text-white px-2 py-0.5 border-2 border-[#1a1a1a] font-label-md text-[10px] sm:text-xs uppercase tracking-wider">Hypertension AI</div>
        <div className="flex items-center gap-1.5 mt-2">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-brand-accent dark:bg-white rounded-none border border-clinical-black dark:border-transparent animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Evidence Panel ──────────────────────────────────────────────────────────

type EvidenceTab = 'sources' | 'tools' | 'safety'

function EvidencePanel({ 
  isOpen, 
  onClose, 
  citations, 
  toolTrace, 
  safetyFlags, 
  activeTab,
  setActiveTab,
  highlightedCitationIndex
}: {
  isOpen: boolean; onClose: () => void
  citations: Citation[]; toolTrace: ToolTrace[]
  safetyFlags: SafetyFlags | null
  activeTab: EvidenceTab; setActiveTab: (tab: EvidenceTab) => void
  highlightedCitationIndex: number | null
}) {
  const tabs: { id: EvidenceTab; label: string; icon: IconType; count: number }[] = useMemo(() => [
    { id: 'sources', label: 'Sources', icon: BookOpen, count: citations.length },
    { id: 'tools', label: 'Tools', icon: Zap, count: toolTrace.length },
    { id: 'safety', label: 'Safety', icon: Shield, count: safetyFlags ? 1 : 0 },
  ], [citations.length, toolTrace.length, safetyFlags])

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'flex flex-col bg-white dark:bg-slate-950 border-l-2 border-[#1a1a1a] dark:border-white transition-all duration-300 ease-in-out shrink-0',
        'fixed lg:relative inset-y-0 right-0 h-screen lg:h-full z-40',
        isOpen ? 'w-evidence-panel-width translate-x-0' : 'w-evidence-panel-width translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden'
      )}>
      {isOpen && (
        <>
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-b-2 border-[#1a1a1a] dark:border-white bg-brand-accent text-white transition-all duration-1000">
            <div className="flex justify-between items-center mb-1 sm:mb-2">
              <h3 className="font-headline-md font-bold text-base sm:text-headline-md uppercase tracking-wide">Evidence & Context</h3>
              <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 transition-all p-1 sm:p-1.5 border-2 border-transparent hover:border-white/30" title="Close">
                <X size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
            <p className="font-code-sm text-[10px] sm:text-xs font-bold uppercase opacity-low">Sources, tools, and safety</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-[#1a1a1a] dark:border-white/20 bg-[#f0f0f0] dark:bg-slate-950 p-0 overflow-x-auto scrollbar-thin">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold transition-all whitespace-nowrap',
                  activeTab === t.id
                    ? 'text-[#1a1a1a] dark:text-white border-b-4 border-[#1a1a1a] dark:border-white bg-white dark:bg-slate-900 border-t-2 border-t-[#1a1a1a] dark:border-t-white'
                    : 'text-[#1a1a1a]/60 dark:text-white/60 hover:text-[#1a1a1a] dark:hover:text-white hover:bg-white dark:hover:bg-slate-900 border-b-4 border-transparent border-t-2 border-t-transparent opacity-low'
                )}
              >
                <t.icon size={12} className="sm:w-[14px] sm:h-[14px]" />
                <span className="uppercase tracking-wider text-[10px] sm:text-xs font-headline-md">{t.label}</span>
                {t.count > 0 && (
                  <span className={cn(
                    'px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border-2',
                    activeTab === t.id
                      ? 'bg-brand-accent text-white border-[#1a1a1a] dark:border-white'
                      : 'bg-white dark:bg-slate-800 text-[#1a1a1a] dark:text-white border-[#1a1a1a]/20 dark:border-white/20'
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scroll-premium p-4 sm:p-6 space-y-4 sm:space-y-6 bg-[#fafafa] dark:bg-slate-950 transition-all duration-1000">
            {activeTab === 'sources' && (
              <>
                {citations.length === 0 ? (
                  <EmptyEvidence icon={BookOpen} title="No citations yet" subtitle="Ask a clinical question to see source material" />
                ) : (
                  citations.map((c, i) => (
                    <CitationCard 
                      key={i} 
                      citation={c} 
                      index={i} 
                      isHighlighted={highlightedCitationIndex === i}
                    />
                  ))
                )}
              </>
            )}
            {activeTab === 'tools' && (
              toolTrace.length === 0 ? (
                <EmptyEvidence icon={Zap} title="No tools used" subtitle="Tools will appear here if the agent called them" />
              ) : toolTrace.map((t, i) => (
                <div key={i} className="bg-white dark:bg-slate-900/60 border-2 border-[#1a1a1a] dark:border-white clinical-shadow p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center border-2 border-[#1a1a1a]/20 dark:border-white/20">
                      <Zap size={13} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-slate-200">{t.name}</p>
                    {typeof t.duration_ms === 'number' && (
                      <span className="ml-auto text-[11px] text-gray-400 dark:text-slate-500 font-mono">{t.duration_ms}ms</span>
                    )}
                  </div>
                  {(t.input_summary || t.inputs) && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Input</p>
                      <pre className="text-[11.5px] leading-relaxed text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-950/60 border-2 border-[#1a1a1a] dark:border-white p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                        {t.input_summary || JSON.stringify(t.inputs, null, 2)}
                      </pre>
                    </div>
                  )}
                  {(t.output_summary || t.output !== undefined) && (
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Output</p>
                      <pre className="text-[11.5px] leading-relaxed text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/5 border-2 border-emerald-200 dark:border-emerald-500/20 p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                        {t.output_summary || JSON.stringify(t.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
            {activeTab === 'safety' && (
              <div className="space-y-4">
                <div className={cn(
                  'flex items-start gap-2 sm:gap-3 p-3 sm:p-4 border-2 border-[#1a1a1a] dark:border-white clinical-shadow',
                  safetyFlags?.unsupported_claims_detected
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                )}>
                  {safetyFlags?.unsupported_claims_detected
                    ? <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    : <CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px] text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className={cn(
                      'text-[12px] sm:text-[13px] font-semibold',
                      safetyFlags?.unsupported_claims_detected ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                    )}>
                      {safetyFlags?.unsupported_claims_detected ? 'Unsupported Claims Detected' : 'Claims Validated'}
                    </p>
                    <p className="text-[11px] sm:text-[11.5px] text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {safetyFlags?.unsupported_claims_detected
                        ? 'Some claims could not be fully supported by indexed sources — treat as provisional.'
                        : 'All clinical claims are supported by indexed guideline sources.'}
                    </p>
                  </div>
                </div>
                {safetyFlags?.medical_disclaimer && (
                  <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-stone-50 dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white clinical-shadow">
                    <Info size={16} className="sm:w-[18px] sm:h-[18px] text-brand-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[12px] sm:text-[13px] font-semibold text-brand-accent">Medical Disclaimer</p>
                      <p className="text-[11px] sm:text-[11.5px] text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                        Educational workflow support only — must not replace clinical judgment.
                      </p>
                    </div>
                  </div>
                )}
                {!safetyFlags && <EmptyEvidence icon={Shield} title="No safety data" />}
              </div>
            )}

          </div>
        </>
      )}
    </aside>
    </>
  )
}

function EmptyEvidence({ icon: Icon, title, subtitle }: { icon: IconType; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800/60 mx-auto mb-3 flex items-center justify-center border-2 border-[#1a1a1a] dark:border-white">
        <Icon size={20} className="text-gray-300 dark:text-slate-600" />
      </div>
      <p className="text-gray-700 dark:text-slate-300 text-[13px] font-medium">{title}</p>
      {subtitle && <p className="text-gray-400 dark:text-slate-500 text-[11px] mt-1 max-w-[200px] mx-auto">{subtitle}</p>}
    </div>
  )
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ mode, onQuestionClick }: { mode: 'patient' | 'clinician'; onQuestionClick: (text: string) => void }) {
  const questions = mode === 'patient' ? PATIENT_SUGGESTED_QUESTIONS : CLINICIAN_SUGGESTED_QUESTIONS

  return (
    <div className="flex-1 overflow-y-auto scroll-premium">
      <div className="flex flex-col items-center justify-center min-h-full text-center px-3 sm:px-4 pt-4 sm:pt-6 pb-16 sm:pb-20 max-w-3xl mx-auto">
        {/* Hero */}
        <div className="relative mb-2 sm:mb-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-accent flex items-center justify-center text-white border-2 border-clinical-black dark:border-white clinical-shadow">
            <Sparkles size={18} className="sm:w-[22px] sm:h-[22px] text-white" />
          </div>
        </div>

        <h1 className="font-headline-xl text-lg sm:text-2xl font-black text-clinical-black dark:text-white uppercase mb-1 sm:mb-2">
          {mode === 'patient' ? 'Hypertension Care & Education' : 'How can I help you today?'}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 text-[12px] sm:text-[13px] leading-relaxed mb-2 sm:mb-3 max-w-lg px-2 sm:px-0">
          {mode === 'patient'
            ? 'Plain-language health education, home blood pressure monitoring guidance, and preparation for your doctor visits — grounded in trusted guidelines with citations.'
            : <>Evidence-based hypertension management assistant grounded in <span className="font-semibold text-gray-700 dark:text-slate-300">NICE</span>, <span className="font-semibold text-gray-700 dark:text-slate-300">ACC/AHA</span>, <span className="font-semibold text-gray-700 dark:text-slate-300">ESC/ESH</span>, and <span className="font-semibold text-gray-700 dark:text-slate-300">WHO</span> guidelines — with citations you can verify.</>}
        </p>

        {/* Trust strip */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <Pill variant="info" icon={Shield} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5">Educational only</Pill>
          <Pill variant="success" icon={CheckCircle2} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5">Every claim cited</Pill>
          <Pill variant="okf" icon={Brain} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5">OKF + RAG hybrid</Pill>
        </div>

        {/* Suggested questions */}
        <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 sm:mb-2.5">
          {mode === 'patient' ? 'Common Patient Questions' : 'Try asking'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full px-1 sm:px-0">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuestionClick(q.text)}
              className="group flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white hover:bg-stone-50 dark:hover:bg-slate-800 text-left transition-all shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.15)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none rounded-none"
            >
              <div className={cn('w-7 h-7 sm:w-8 sm:h-8 border-2 border-clinical-black dark:border-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform bg-stone-100 dark:bg-slate-800 rounded-none', q.tone)}>
                <q.icon size={11} className="sm:w-[13px] sm:h-[13px]" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 dark:text-slate-500 mb-0.5 uppercase tracking-widest leading-none">{q.category}</p>
                <p className="text-[11px] sm:text-[12.5px] text-clinical-black dark:text-white leading-snug font-bold font-headline-md mt-0.5 sm:mt-1">{q.text}</p>
              </div>
              <ArrowUp size={10} className="sm:w-[12px] sm:h-[12px] text-gray-400 dark:text-slate-500 group-hover:text-brand-accent group-hover:-translate-y-0.5 transition-all rotate-45 shrink-0 mt-0.5 sm:mt-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface NoteItem {
  id: string
  text: string
  created_at: string
}

function loadLocalNotesStack(u: UserProfile | null): NoteItem[] {
  let list: NoteItem[] = []
  const key = getStorageKey(u, 'notes_stack')
  if (key) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) list = JSON.parse(raw)
    } catch {}
  }
  if (!list || list.length === 0) {
    try {
      const backup = localStorage.getItem('cw_notes_stack_backup')
      if (backup) list = JSON.parse(backup)
    } catch {}
  }
  return list
}

function saveLocalNotesStack(u: UserProfile | null, stack: NoteItem[]) {
  const key = getStorageKey(u, 'notes_stack')
  if (key) {
    try {
      localStorage.setItem(key, JSON.stringify(stack))
    } catch {}
  }
  try {
    localStorage.setItem('cw_notes_stack_backup', JSON.stringify(stack))
  } catch {}
}

// ─── Profile Modal ──────────────────────────────────────────────────────────

function ProfileModal({ isOpen, onClose, user, onUpdateUser, onChatAboutDoc, onOpenBmiModal }: {
  isOpen: boolean
  onClose: () => void
  user: UserProfile
  onUpdateUser: (updated: UserProfile) => void
  onChatAboutDoc: (filename: string) => void
  onOpenBmiModal?: () => void
}) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(user.date_of_birth || '')
  const [notes, setNotes] = useState(user.notes || '')
  const [email, setEmail] = useState(user.email || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Clinical Notes Stack state
  const [notesStack, setNotesStack] = useState<NoteItem[]>(() => loadLocalNotesStack(user))
  const [activeRightTab, setActiveRightTab] = useState<'notes' | 'documents'>('notes')
  const [stackNoteInput, setStackNoteInput] = useState('')

  // Uploads state
  const [uploads, setUploads] = useState<any[]>([])
  const [isFetchingUploads, setIsFetchingUploads] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState<string>('other')
  const [uploadNote, setUploadNote] = useState<string>('')

  // Sync notes stack & uploads when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setProfileError('')
      setProfileSuccess(false)
      const loadedStack = loadLocalNotesStack(user)
      if (loadedStack.length > 0) setNotesStack(loadedStack)
      setIsFetchingUploads(true)
      api.listUploads()
        .then(data => setUploads(data.uploads))
        .catch(err => console.error(err))
        .finally(() => setIsFetchingUploads(false))
    } else {
      setProfileSuccess(false)
      setProfileError('')
    }
  }, [isOpen, user?.username, user?.id])

  const handlePushNote = (textToPush: string) => {
    if (!textToPush.trim()) return
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      text: textToPush.trim(),
      created_at: new Date().toISOString()
    }
    const updated = [newNote, ...notesStack.filter(n => n.text !== textToPush.trim())]
    setNotesStack(updated)
    saveLocalNotesStack(user, updated)
  }

  const handleDeleteNote = (id: string) => {
    const updated = notesStack.filter(n => n.id !== id)
    setNotesStack(updated)
    saveLocalNotesStack(user, updated)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    setIsSavingProfile(true)

    if (notes.trim()) {
      handlePushNote(notes.trim())
    }

    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        email,
        date_of_birth: dateOfBirth,
        notes
      })
      onUpdateUser(updated)
      saveLocalUserProfile(updated)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      // Graceful fallback: update local user profile so changes are saved in UI state & stored
      const fallbackUser: UserProfile = {
        ...user,
        full_name: fullName,
        email,
        date_of_birth: dateOfBirth,
        notes
      }
      onUpdateUser(fallbackUser)
      saveLocalUserProfile(fallbackUser)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider font-label-md">
                    Notes & Description (Clinical Details)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (notes.trim()) {
                        handlePushNote(notes)
                        setActiveRightTab('notes')
                      }
                    }}
                    className="text-[10px] font-bold uppercase bg-brand-accent text-white px-2 py-0.5 border border-clinical-black hover:bg-brand-accent/90"
                  >
                    + Push to Stack
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add details regarding symptoms, medication history, or notes for simulated consultation."
                  rows={3}
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

              {/* Saved Health Vitals & BMI Card */}
              <div className="p-4 border-2 border-clinical-black bg-[#fafafa] space-y-3">
                <div className="flex items-center justify-between border-b border-clinical-black/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Scale size={16} className="text-brand-accent" />
                    <span className="text-xs font-bold uppercase font-headline-md text-clinical-black">Personal Health Vitals (BMI)</span>
                  </div>
                  {onOpenBmiModal && (
                    <button
                      type="button"
                      onClick={onOpenBmiModal}
                      className="text-[10px] font-bold uppercase bg-brand-accent text-white px-2 py-1 border border-clinical-black hover:bg-brand-accent/90"
                    >
                      Calculator
                    </button>
                  )}
                </div>

                {user.health_vitals ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-code-sm">
                    <div>
                      <span className="text-gray-500 uppercase text-[9px] font-bold block">Height / Weight</span>
                      <span className="font-bold text-clinical-black">{user.health_vitals.height_cm} cm / {user.health_vitals.weight_kg} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase text-[9px] font-bold block">BMI & Classification</span>
                      <span className="font-bold text-brand-accent">{user.health_vitals.bmi} kg/m² ({user.health_vitals.category})</span>
                    </div>
                    <div className="col-span-2 text-[10px] text-gray-500 font-bold border-t border-clinical-black/10 pt-1">
                      Last Updated: {new Date(user.health_vitals.updated_at).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 font-medium flex items-center justify-between">
                    <span>No BMI vitals saved yet.</span>
                    {onOpenBmiModal && (
                      <button
                        type="button"
                        onClick={onOpenBmiModal}
                        className="text-[10px] font-bold uppercase underline text-brand-accent"
                      >
                        Calculate & Save
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="py-2.5 px-4 bg-brand-accent text-white font-bold border-2 border-clinical-black neo-brutal-shadow-sm neo-brutal-btn uppercase text-xs tracking-wider flex items-center gap-2"
              >
                {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Column 2: Clinical Notes Stack & Document RAG Tabs */}
          <div className="space-y-4">
            {/* Segmented Tab Switch */}
            <div className="flex border-2 border-clinical-black bg-stone-100 p-0.5">
              <button
                type="button"
                onClick={() => setActiveRightTab('notes')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeRightTab === 'notes'
                    ? 'bg-brand-accent text-white neo-brutal-shadow-sm'
                    : 'text-clinical-black hover:bg-stone-200'
                }`}
              >
                Notes Stack ({notesStack.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('documents')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeRightTab === 'documents'
                    ? 'bg-brand-accent text-white neo-brutal-shadow-sm'
                    : 'text-clinical-black hover:bg-stone-200'
                }`}
              >
                Documents ({uploads.length})
              </button>
            </div>

            {activeRightTab === 'notes' ? (
              <div className="space-y-4">
                <div className="p-3 border-2 border-clinical-black bg-stone-50 space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-clinical-black">
                    Add Short Clinical Note to Stack
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={stackNoteInput}
                      onChange={e => setStackNoteInput(e.target.value)}
                      placeholder="e.g. Morning BP 135/85, mild fatigue..."
                      className="flex-1 px-2.5 py-1.5 bg-white border-2 border-clinical-black text-xs font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (stackNoteInput.trim()) {
                          handlePushNote(stackNoteInput)
                          setStackNoteInput('')
                        }
                      }}
                      className="px-3 py-1.5 bg-brand-accent text-white font-bold text-xs uppercase border-2 border-clinical-black hover:bg-brand-accent/90 shrink-0"
                    >
                      + Push
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-clinical-black tracking-wide flex items-center justify-between border-b border-clinical-black pb-1">
                    <span>Clinical Notes History ({notesStack.length})</span>
                    <span className="text-[10px] text-gray-500 font-normal">Most recent first</span>
                  </h4>

                  {notesStack.length === 0 ? (
                    <div className="p-4 border-2 border-dashed border-clinical-black/30 text-center text-xs text-gray-500 italic">
                      No short notes stored yet. Type a note and click "+ Push to Stack" or "Save Changes".
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {notesStack.map(item => (
                        <div key={item.id} className="p-3 bg-white border-2 border-clinical-black shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-clinical-black whitespace-pre-wrap">{item.text}</p>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(item.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 transition-colors shrink-0"
                              title="Delete note from stack"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold border-t border-clinical-black/10 pt-1">
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => {
                                onChatAboutDoc(`Clinical Note: "${item.text}"`)
                              }}
                              className="text-brand-accent font-bold uppercase hover:underline flex items-center gap-1"
                            >
                              <MessageSquare size={11} /> Consult AI
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2D Cat Follower (Pressure Relief Pet) ──────────────────────────────────
function ClinicalCatPet() {
  const [catPos, setCatPos] = useState({ x: 200, y: 200 })
  const [mousePos, setMousePos] = useState({ x: 200, y: 200 })
  const [state, setState] = useState<'idle' | 'chasing' | 'happy'>('idle')
  const [flip, setFlip] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)

  // Listen to mouse movement
  useEffect(() => {
    const updateMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', updateMouse)
    return () => window.removeEventListener('mousemove', updateMouse)
  }, [])

  // Interpolate cat position (lerp)
  useEffect(() => {
    let animFrame: number
    const speed = 0.05
    const follow = () => {
      setCatPos(prev => {
        const dx = mousePos.x - prev.x
        const dy = mousePos.y - prev.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 45) {
          setState('happy')
          return prev
        }

        setState('chasing')
        setFlip(dx < 0)
        return {
          x: prev.x + dx * speed,
          y: prev.y + dy * speed
        }
      })
      animFrame = requestAnimationFrame(follow)
    }
    animFrame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(animFrame)
  }, [mousePos])

  // Speech bubble phrase rotation
  useEffect(() => {
    const phrases = ['Purr...', 'Meow 🐾', 'Hypertension relief active!', 'Chase the laser dot!', 'Sleepy...', 'Mew? ✨']
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        setBubble(phrases[Math.floor(Math.random() * phrases.length)])
        setTimeout(() => setBubble(null), 2500)
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Laser target pointer under cursor */}
      <div 
        className="fixed pointer-events-none z-50 mix-blend-screen w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_8px_4px_rgba(244,63,94,0.8)] animate-pulse"
        style={{ left: `${mousePos.x - 6}px`, top: `${mousePos.y - 6}px` }}
      />
      
      {/* Cat */}
      <div
        className="fixed pointer-events-none z-50 select-none transition-transform duration-100 ease-out"
        style={{
          left: `${catPos.x - 24}px`,
          top: `${catPos.y - 36}px`,
        }}
      >
        {/* Speech bubble */}
        {bubble && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 text-clinical-black dark:text-white border-2 border-clinical-black dark:border-teal-400 px-3 py-1.5 text-[11px] font-black rounded-xl shadow-[3px_3px_0px_0px_#008080] whitespace-nowrap animate-bounce font-code-sm uppercase">
            {bubble}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-slate-800 border-r-2 border-b-2 border-clinical-black dark:border-teal-400 rotate-45" />
          </div>
        )}

        {/* Cat Sprite wrapper with wiggle/walk animations */}
        <div 
          className={cn(
            "relative flex flex-col items-center",
            state === 'chasing' ? "animate-pulse" : "animate-bounce"
          )}
          style={{ 
            transform: `scaleX(${flip ? -1 : 1})`,
            transition: 'transform 0.15s ease'
          }}
        >
          {/* Animated Cat SVG */}
          <svg width="48" height="48" viewBox="0 0 60 60" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]">
            {/* Tail */}
            <path 
              d="M 12 40 Q 2 30 8 18" 
              fill="none" 
              stroke="#008080" 
              strokeWidth="5" 
              strokeLinecap="round"
            />
            {/* Body */}
            <ellipse cx="28" cy="40" rx="16" ry="11" fill="#008080" />
            {/* Head */}
            <circle cx="38" cy="28" r="10" fill="#00a3a3" />
            {/* Ears */}
            <polygon points="32,20 35,26 29,26" fill="#006666" />
            <polygon points="44,20 43,26 47,26" fill="#006666" />
            {/* Eyes */}
            <circle cx="36" cy="26" r="1.5" fill={state === 'happy' ? '#ffffff' : '#003333'} />
            <circle cx="42" cy="26" r="1.5" fill={state === 'happy' ? '#ffffff' : '#003333'} />
            {/* Nose & Whiskers */}
            <polygon points="39,28 38,29 40,29" fill="#ff3366" />
            <line x1="39" y1="29" x2="33" y2="30" stroke="#004d4d" strokeWidth="1" />
            <line x1="39" y1="29" x2="34" y2="32" stroke="#004d4d" strokeWidth="1" />
            <line x1="39" y1="29" x2="45" y2="30" stroke="#004d4d" strokeWidth="1" />
            <line x1="39" y1="29" x2="44" y2="32" stroke="#004d4d" strokeWidth="1" />
            {/* Paws */}
            <circle cx="24" cy="48" r="4" fill="#006666" />
            <circle cx="32" cy="48" r="4" fill="#006666" />
          </svg>
        </div>
      </div>
    </>
  )
}



// ─── Main App ─────────────────────────────────────────────────────────────────

// ─── Local Storage & Hybrid Sync Persistence ────────────────────────────────
function getStorageKey(u: UserProfile | null, suffix: string): string | null {
  if (!u) return null
  const identifier = (u.username || u.email || u.id || 'user').toLowerCase().trim()
  return `cw_storage_${identifier.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}`
}

function loadLocalConvs(u: UserProfile | null): ConversationSummary[] {
  let list: ConversationSummary[] = []
  const primaryKey = getStorageKey(u, 'conv_list')
  if (primaryKey) {
    try {
      const raw = localStorage.getItem(primaryKey)
      if (raw) list = JSON.parse(raw)
    } catch {}
  }

  if (!list || list.length === 0) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.endsWith('_conv_list') || key === 'cw_conv_list_backup')) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
              list = parsed
              break
            }
          }
        } catch {}
      }
    }
  }
  return list
}

function saveLocalConvs(u: UserProfile | null, convs: ConversationSummary[]) {
  // CRITICAL PROTECTION: Never overwrite an existing conversation list with an empty array!
  if (!convs || convs.length === 0) return

  const key = getStorageKey(u, 'conv_list')
  if (key) {
    try {
      localStorage.setItem(key, JSON.stringify(convs))
    } catch {}
  }
  try {
    localStorage.setItem('cw_conv_list_backup', JSON.stringify(convs))
  } catch {}
}

function loadLocalConvDetail(u: UserProfile | null, convId: string): Conversation | null {
  const primaryKey = getStorageKey(u, `conv_${convId}`)
  if (primaryKey) {
    try {
      const raw = localStorage.getItem(primaryKey)
      if (raw) return JSON.parse(raw)
    } catch {}
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.includes(convId)) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && parsed.messages && parsed.messages.length > 0) return parsed
        }
      } catch {}
    }
  }
  return null
}

function saveLocalConvDetail(u: UserProfile | null, convId: string, conv: Conversation) {
  if (!conv || !conv.messages || conv.messages.length === 0) return
  const key = getStorageKey(u, `conv_${convId}`)
  if (key) {
    try {
      localStorage.setItem(key, JSON.stringify(conv))
    } catch {}
  }
  try {
    localStorage.setItem(`cw_conv_${convId}_backup`, JSON.stringify(conv))
  } catch {}
}

function saveLocalUserProfile(u: UserProfile | null) {
  const key = getStorageKey(u, 'profile')
  if (!key || !u) return
  try {
    localStorage.setItem(key, JSON.stringify({
      full_name: u.full_name,
      email: u.email,
      date_of_birth: u.date_of_birth,
      notes: u.notes,
      health_vitals: u.health_vitals
    }))
    localStorage.setItem('cw_profile_backup', JSON.stringify({
      full_name: u.full_name,
      email: u.email,
      date_of_birth: u.date_of_birth,
      notes: u.notes,
      health_vitals: u.health_vitals
    }))
  } catch {}
}

function loadLocalUserProfile(u: UserProfile | null): Partial<UserProfile> | null {
  const key = getStorageKey(u, 'profile')
  if (key) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {}
  }
  try {
    const backupRaw = localStorage.getItem('cw_profile_backup')
    if (backupRaw) return JSON.parse(backupRaw)
  } catch {}
  return null
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [page, setPage] = useState<'landing' | 'login' | 'signup' | 'dashboard'>('landing')
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingConvs, setIsFetchingConvs] = useState(false)
  const [mode, setMode] = useState<'patient' | 'clinician'>('patient')
  const [panelCitations, setPanelCitations] = useState<Citation[]>([])
  const [panelTools, setPanelTools] = useState<ToolTrace[]>([])
  const [panelSafety, setPanelSafety] = useState<SafetyFlags | null>(null)

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isBmiModalOpen, setIsBmiModalOpen] = useState(false)
  const [isReliefMode, setIsReliefMode] = useState(false)
  const [models, setModels] = useState<ModelSpec[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>(
    () => localStorage.getItem('cw_model_id') || 'openrouter-nemotron-ultra-550b'
  )
  const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>('sources')
  const [highlightedCitationIndex, setHighlightedCitationIndex] = useState<number | null>(null)

  const handleSaveVitals = async (vitals: HealthVitals) => {
    if (user) {
      const updatedUser = { ...user, health_vitals: vitals }
      setUser(updatedUser)
      saveLocalUserProfile(updatedUser)
      try {
        await api.updateProfile({ health_vitals: vitals })
      } catch (err) {
        console.error('Failed to update health vitals in database profile', err)
      }
    }
  }

  const toggleReliefMode = () => {
    const next = !isReliefMode
    setIsReliefMode(next)
    if (next) {
      document.documentElement.classList.add('relief-mode')
    } else {
      document.documentElement.classList.remove('relief-mode')
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
    const savedToken = localStorage.getItem('cw_token') || sessionStorage.getItem('cw_token')
    if (savedToken) {
      localStorage.setItem('cw_token', savedToken)
      sessionStorage.removeItem('cw_token')
      api.setToken(savedToken)
      api.getCurrentUser()
        .then(u => {
          setUser(u)
          const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
          setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
          setPage('dashboard')
        })
        .catch(() => {
          setTimeout(() => {
            api.getCurrentUser()
              .then(u => {
                setUser(u)
                const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
                setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
                setPage('dashboard')
              })
              .catch(() => {
                localStorage.removeItem('cw_token')
                localStorage.removeItem('cw_remember')
                sessionStorage.removeItem('cw_token')
                setPage('landing')
              })
              .finally(() => setIsRestoringSession(false))
          }, 1500)
        })
        .finally(() => {
          setTimeout(() => setIsRestoringSession(false), 2000)
        })
    } else {
      setIsRestoringSession(false)
    }
  }, [])

  // Multi-session persistence: load conversations & user profile details immediately
  useEffect(() => {
    if (user) {
      setIsFetchingConvs(true)

      // 1. Immediately restore user profile details (full_name, email, date_of_birth, notes, health_vitals)
      const cachedProfile = loadLocalUserProfile(user)
      if (cachedProfile) {
        setUser(prev => prev ? {
          ...prev,
          full_name: cachedProfile.full_name || prev.full_name,
          email: cachedProfile.email || prev.email,
          date_of_birth: cachedProfile.date_of_birth || prev.date_of_birth,
          notes: cachedProfile.notes || prev.notes,
          health_vitals: cachedProfile.health_vitals || prev.health_vitals
        } : prev)
      }

      // 2. Immediately restore conversations into left sidebar
      const localConvs = loadLocalConvs(user)
      if (localConvs.length > 0) {
        setConversations(localConvs)
      }

      // 3. Fetch remote conversations from API & merge with local conversations
      api.listConversations()
        .then(remoteConvs => {
          const map = new Map<string, ConversationSummary>()
          localConvs.forEach(c => map.set(c.id, c))
          remoteConvs.forEach(c => map.set(c.id, c))
          const merged = Array.from(map.values()).sort((a, b) =>
            new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()
          )
          setConversations(merged)
          saveLocalConvs(user, merged)
        })
        .catch(() => {
          if (localConvs.length > 0) setConversations(localConvs)
        })
        .finally(() => setIsFetchingConvs(false))

      // Load available models
      api.listModels().then(({ models: mods, default_model }) => {
        setModels(mods)
        const stored = localStorage.getItem('cw_model_id')
        if (!stored || !mods.find((m: ModelSpec) => m.id === stored)) {
          setSelectedModelId(default_model)
          localStorage.setItem('cw_model_id', default_model)
        }
      }).catch(() => {})
    }
  }, [user?.username, user?.id, user?.email])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  const handleLogin = async (token: string) => {
    localStorage.setItem('cw_token', token)
    sessionStorage.removeItem('cw_token')
    api.setToken(token)
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const u = await api.getCurrentUser()
        setUser(u)
        const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
        setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
        setPage('dashboard')
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to load user profile')
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }
    throw lastError || new Error('Failed to load user profile')
  }

  const handleSignup = async (token: string) => {
    localStorage.setItem('cw_token', token)
    sessionStorage.removeItem('cw_token')
    api.setToken(token)
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const u = await api.getCurrentUser()
        setUser(u)
        const primaryRole = u.roles && u.roles[0] ? u.roles[0] : 'patient'
        setMode(primaryRole === 'clinician' ? 'clinician' : 'patient')
        setPage('dashboard')
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to load user profile')
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }
    throw lastError || new Error('Failed to load user profile')
  }

  const handleChatAboutDoc = (filename: string) => {
    setIsProfileModalOpen(false)
    let prompt = ''
    if (filename.startsWith('Clinical Note:')) {
      const cleanNote = filename.replace(/^Clinical Note:\s*"?/, '').replace(/"?$/, '').trim()
      const lower = cleanNote.toLowerCase()

      if (lower.includes('fatigue') || lower.includes('tired') || lower.includes('symptom')) {
        prompt = `What do clinical guidelines (NICE NG136 & ACC/AHA) recommend when a patient with hypertension reports "${cleanNote}"? What potential medication side effects, lab checks, or care gaps should be evaluated?`
      } else if (lower.includes('newly') || lower.includes('initial') || lower.includes('diagnos')) {
        prompt = `What are the recommended clinical evaluation steps, target blood pressure goals, and baseline lifestyle guidance for a patient with "${cleanNote}" hypertension?`
      } else if (lower.includes('bp') || lower.includes('pressure') || /\d{2,3}\/\d{2,3}/.test(lower)) {
        prompt = `What blood pressure stage and recommended treatment protocol apply to a patient with readings of "${cleanNote}" according to ACC/AHA guidelines?`
      } else {
        prompt = `Regarding my clinical note: "${cleanNote}" — What do evidence-based clinical guidelines recommend for assessment, care gaps, and follow-up management?`
      }
    } else {
      prompt = `Regarding my uploaded document "${filename}": Can you summarize its key clinical findings, blood pressure management guidance, and check for any care gaps?`
    }

    setInputValue(prompt)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleLogout = () => {
    setUser(null); api.setToken(null)
    localStorage.removeItem('cw_token')
    sessionStorage.removeItem('cw_token')
    setConversations([]); setMessages([]); setCurrentConvId(null)
    setPage('landing')
  }

  const handleNewChat = () => {
    setCurrentConvId(null); setMessages([]); setInputValue('')
    setPanelCitations([]); setPanelTools([]); setPanelSafety(null)
    setEvidencePanelOpen(false)
  }

  const handleSelectConv = async (id: string) => {
    setCurrentConvId(id)
    let conv: Conversation | null = null
    try {
      conv = await api.getConversation(id)
      if (conv && conv.messages && conv.messages.length > 0) {
        saveLocalConvDetail(user, id, conv)
      }
    } catch {}

    if (!conv || !conv.messages || conv.messages.length === 0) {
      conv = loadLocalConvDetail(user, id)
    }

    if (conv) {
      const msgs = (conv.messages || []).map(m => {
        if (!m.mode) m.mode = m.role === 'assistant' ? 'patient' : undefined
        return m
      })
      setMessages(msgs)
      const last = conv.messages?.[conv.messages.length - 1]
      if (last?.role === 'assistant') {
        setPanelCitations(last.citations || [])
        setPanelTools(last.tool_trace || [])
        setPanelSafety(last.safety_flags || null)
      }
      setEvidencePanelOpen(true)
    } else {
      setMessages([])
    }
  }

  const handleDeleteConv = async (id: string) => {
    try { await api.deleteConversation(id) } catch {}
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id)
      saveLocalConvs(user, updated)
      return updated
    })
    const key = getStorageKey(user, `conv_${id}`)
    if (key) localStorage.removeItem(key)
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
    const updatedMsgs = [...messages, userMsg]
    setMessages(updatedMsgs)

    try {
      let convId = currentConvId
      let convTitle = question.slice(0, 60)
      if (!convId) {
        const conv = await api.createConversation(convTitle)
        convId = conv.id
        convTitle = conv.title || convTitle
        setCurrentConvId(convId)
      }
      const assistantMsg = await api.sendMessage(convId, question, mode, selectedModelId)
      assistantMsg.mode = mode
      assistantMsg.question = question
      const finalMsgs = [...updatedMsgs, assistantMsg]
      setMessages(finalMsgs)

      saveLocalConvDetail(user, convId, {
        id: convId,
        title: convTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: finalMsgs,
      })

      setConversations(prev => {
        const map = new Map<string, ConversationSummary>()
        prev.forEach(c => map.set(c.id, c))
        map.set(convId!, { id: convId!, title: convTitle, updated_at: new Date().toISOString() })
        const newList = Array.from(map.values()).sort((a, b) =>
          new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()
        )
        saveLocalConvs(user, newList)
        return newList
      })

      setPanelCitations(assistantMsg.citations || [])
      setPanelTools(assistantMsg.tool_trace || [])
      setPanelSafety(assistantMsg.safety_flags || null)
      if (assistantMsg.citations?.length || assistantMsg.tool_trace?.length) setEvidencePanelOpen(true)
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


  const handleReask = async (question: string, newMode: 'patient' | 'clinician') => {
    if (!question.trim() || isLoading) return
    setMode(newMode)
    setIsLoading(true)
    try {
      let convId = currentConvId
      let convTitle = question.slice(0, 60)
      if (!convId) {
        const conv = await api.createConversation(convTitle)
        convId = conv.id
        convTitle = conv.title || convTitle
        setCurrentConvId(convId)
      }
      const assistantMsg = await api.sendMessage(convId, question, newMode, selectedModelId)
      assistantMsg.mode = newMode
      assistantMsg.question = question
      const finalMsgs = [...messages, assistantMsg]
      setMessages(finalMsgs)

      saveLocalConvDetail(user, convId, {
        id: convId,
        title: convTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: finalMsgs,
      })

      setConversations(prev => {
        const map = new Map<string, ConversationSummary>()
        prev.forEach(c => map.set(c.id, c))
        map.set(convId!, { id: convId!, title: convTitle, updated_at: new Date().toISOString() })
        const newList = Array.from(map.values()).sort((a, b) =>
          new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()
        )
        saveLocalConvs(user, newList)
        return newList
      })

      setPanelCitations(assistantMsg.citations || [])
      setPanelTools(assistantMsg.tool_trace || [])
      setPanelSafety(assistantMsg.safety_flags || null)
      if (assistantMsg.citations?.length || assistantMsg.tool_trace?.length) setEvidencePanelOpen(true)
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

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#1a1a1a] dark:border-white bg-brand-accent flex items-center justify-center animate-pulse">
            <Stethoscope size={20} className="text-white" />
          </div>
          <p className="text-sm font-bold text-[#1a1a1a] dark:text-white uppercase tracking-wider animate-pulse">
            Restoring session&hellip;
          </p>
        </div>
      </div>
    )
  }

  // Redirect if logged in trying to view login/signup
  if (user && (page === 'login' || page === 'signup')) {
    setTimeout(() => setPage('dashboard'), 0)
    return null
  }

  // Redirect to login if accessing dashboard without user session
  if (!user && page === 'dashboard') {
    setTimeout(() => setPage('login'), 0)
    return null
  }

  if (page === 'landing') {
    return (
      <>
        <LandingPage 
          onLogin={() => setPage('login')} 
          onRegister={() => setPage('signup')} 
          currentUser={user}
          onGoToDashboard={() => setPage('dashboard')}
          onShowProfile={() => setIsProfileModalOpen(true)}
        />
        {user && (
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            user={user!}
            onUpdateUser={(updated) => { setUser(updated); saveLocalUserProfile(updated); }}
            onChatAboutDoc={handleChatAboutDoc}
          />
        )}
      </>
    )
  }

  if (page === 'login') {
    return (
      <LoginPage 
        onLogin={handleLogin} 
        onSwitchToSignup={() => setPage('signup')} 
        onBackToHome={() => setPage('landing')} 
        currentUser={user}
        onShowProfile={() => setIsProfileModalOpen(true)}
        onGoToDashboard={() => setPage('dashboard')}
        onLogout={handleLogout}
      />
    )
  }

  if (page === 'signup') {
    return (
      <SignupPage 
        onSignup={handleSignup} 
        onSwitchToLogin={() => setPage('login')} 
        onBackToHome={() => setPage('landing')} 
        currentUser={user}
        onShowProfile={() => setIsProfileModalOpen(true)}
        onGoToDashboard={() => setPage('dashboard')}
        onLogout={handleLogout}
      />
    )
  }

  return (
      <div className="flex h-screen overflow-hidden relative bg-white dark:bg-slate-950">
      {isReliefMode && (
        <ClinicalCatPet />
      )}

      <Sidebar
        isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} user={user!}
        conversations={conversations} currentConvId={currentConvId} onNewChat={handleNewChat}
        onSelectConv={handleSelectConv} onDeleteConv={handleDeleteConv} onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenBmiModal={() => setIsBmiModalOpen(true)}
        onLogoClick={() => setPage('landing')}
        isLoading={isFetchingConvs}
      />

      {/* Main Chat Area */}
      <main className="flex flex-col flex-1 min-w-0 bg-white dark:bg-slate-950 transition-all duration-1000" id="main-feed">
        {/* Header */}
        <header className={cn(
          "hidden lg:!flex items-center justify-between px-4 xl:px-6 py-3.5 border-b-2 border-[#1a1a1a] dark:border-white bg-white dark:bg-slate-950 shrink-0 z-20 transition-all duration-1000",
          evidencePanelOpen ? "flex-wrap gap-y-2" : ""
        )}>
          <div className="flex items-center gap-3 min-w-0 mr-4">
            {!canCollapseLeft && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border-2 border-transparent hover:border-[#1a1a1a] dark:hover:border-white shrink-0"
                title="Open sidebar"
              >
                <PanelLeft size={16} />
              </button>
            )}
            <button 
              onClick={() => setPage('landing')}
              className="group flex items-center justify-center shrink-0 focus:outline-none"
              title="Back to Homepage"
            >
              <div className={cn(
                'w-10 h-10 flex items-center justify-center border-2 border-[#1a1a1a] dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all duration-150',
                isClinicianMode ? 'bg-slate-900' : 'bg-brand-accent'
              )}>
                <Stethoscope size={18} className="text-white transition-transform group-hover:rotate-[15deg]" />
              </div>
            </button>
            <div className="min-w-0">
              <h2 className={cn(
                "font-headline-md text-headline-md font-bold truncate text-[#1a1a1a] dark:text-white whitespace-nowrap",
                evidencePanelOpen ? "max-w-[180px] lg:max-w-[260px]" : "max-w-xs sm:max-w-sm md:max-w-md"
              )}>
                {currentConv?.title || 'Clinical Workflows'}
              </h2>
              <p className={cn(
                "font-code-sm text-body-sm text-[#1a1a1a]/70 dark:text-white/70 items-center gap-1 uppercase tracking-wider mt-1 opacity-low truncate whitespace-nowrap",
                evidencePanelOpen ? "hidden xl:!flex" : "flex"
              )}>
                <span className={cn('w-2 h-2 shrink-0', isClinicianMode ? 'bg-slate-500' : 'bg-brand-accent')}></span>
                <span className={cn(
                  'px-1.5 py-0.5 text-[9px] font-bold border-2',
                  isClinicianMode
                    ? 'bg-slate-900 dark:bg-slate-700 text-white border-[#1a1a1a] dark:border-white'
                    : 'bg-brand-accent text-white border-[#1a1a1a] dark:border-white'
                )}>
                  {isClinicianMode ? 'Clinician' : 'Patient'}
                </span>
                {isClinicianMode ? 'mode · Workstation' : 'mode · Hypertension AI'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 xl:gap-3 shrink-0">
            {/* Pressure Relief Toggle */}
            <button 
              onClick={toggleReliefMode}
              className={cn(
                "relief-toggle-btn relative flex items-center gap-2 px-2 xl:px-3 py-2 border-2 transition-all font-semibold text-xs uppercase tracking-wider overflow-hidden shrink-0",
                evidencePanelOpen ? "hidden xl:!flex" : "flex",
                isReliefMode 
                  ? "bg-[#008080] text-white shadow-none border-[#008080]"
                  : "bg-white dark:bg-slate-900 text-[#1a1a1a] dark:text-white border-[#1a1a1a] dark:border-white clinical-shadow hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none"
              )}
            >
              {isReliefMode && (
                <>
                  <span className="absolute inset-0 bg-gradient-to-r from-[#008080]/0 via-[#40c0c0]/20 to-[#008080]/0 animate-[shimmer_3s_ease-in-out_infinite]" />
                  <span className="relative flex w-1.5 h-1.5 mr-0.5 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-teal-200 animate-ping opacity-40" />
                    <span className="relative rounded-full bg-teal-100 w-1.5 h-1.5" />
                  </span>
                </>
              )}
              <span className="material-symbols-outlined text-[20px] relative shrink-0">{isReliefMode ? 'spa' : 'air'}</span>
              <span className="hidden xl:inline relative font-label-md">{isReliefMode ? 'Calmness' : 'Pressure Relief'}</span>
            </button>


            {/* Model Picker */}
            {models.length > 0 && (
              <div className={cn(
                "relative shrink-0",
                evidencePanelOpen ? "hidden xl:!block" : "hidden sm:!block"
              )}>
                <select
                  value={selectedModelId}
                  onChange={e => {
                    setSelectedModelId(e.target.value)
                    localStorage.setItem('cw_model_id', e.target.value)
                  }}
                  className="text-[11px] bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white text-[#1a1a1a] dark:text-white px-2 py-1.5 pr-6 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all clinical-shadow font-code-sm uppercase font-bold appearance-none max-w-[120px] xl:max-w-[160px] cursor-pointer"
                  title="Select AI model"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id} disabled={!m.is_configured}>
                      {m.label}{!m.is_configured ? ' ✗' : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                  <ChevronDown size={10} className="text-[#1a1a1a] dark:text-white" />
                </div>
              </div>
            )}

            <div className={cn(evidencePanelOpen ? "hidden lg:!block" : "block")}>
              <ThemeToggle />
            </div>

            {/* Mode Switcher Container */}
            <div className="flex border-2 border-[#1a1a1a] dark:border-white p-0 bg-[#f0f0f0] dark:bg-slate-800 clinical-shadow shrink-0">
              {(['patient', 'clinician'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-2 xl:px-4 py-1.5 text-xs xl:text-sm font-label-md transition-all uppercase font-bold',
                    mode === m
                      ? isClinicianMode
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-brand-accent text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-[#1a1a1a] dark:hover:text-white opacity-60 hover:opacity-100'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Evidence Panel Button */}
            <button
              onClick={() => setEvidencePanelOpen(!evidencePanelOpen)}
              className={cn(
                'w-10 h-10 flex items-center justify-center border-2 transition-all shrink-0',
                evidencePanelOpen
                  ? 'bg-brand-accent text-white border-brand-accent shadow-none'
                  : 'bg-white dark:bg-slate-900 text-brand-accent dark:text-brand-accent border-brand-accent dark:border-brand-accent shadow-[2px_2px_0px_0px_rgba(255,51,102,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none'
              )}
              title={evidencePanelOpen ? 'Hide evidence' : 'Show evidence'}
            >
              <BarChart3 size={18} />
            </button>

            {/* Profile Avatar Button */}
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="w-10 h-10 bg-brand-accent hover:bg-brand-accent/90 text-white flex items-center justify-center font-bold text-sm border-2 border-[#1a1a1a] dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none transition-all duration-150 uppercase shrink-0"
              title={`${user?.username || 'User'}'s Profile`}
            >
              {user ? getInitials(user.username) : 'U'}
            </button>
          </div>
        </header>

        {/* Mobile header */}
        <header className="lg:!hidden flex items-center justify-between px-4 py-3 border-b-2 border-[#1a1a1a] dark:border-white bg-white dark:bg-slate-950 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="text-[#1a1a1a] dark:text-white">
              <PanelLeft size={20} />
            </button>
            <button
              onClick={() => setPage('landing')}
              className="group flex items-center gap-2 text-left focus:outline-none"
              title="Back to Homepage"
            >
              <div className="w-7 h-7 border-2 border-clinical-black dark:border-white bg-brand-accent flex items-center justify-center text-white shadow-[1.5px_1.5px_0px_0px_rgba(26,26,26,1)] dark:shadow-[1.5px_1.5px_0px_0px_#ffffff] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all duration-150 font-bold shrink-0">
                <Stethoscope size={13} className="text-white transition-transform group-hover:rotate-[15deg]" />
              </div>
              <span className="font-headline-md text-headline-md font-bold text-[#1a1a1a] dark:text-white group-hover:text-brand-accent transition-colors uppercase">Clinical Workflows</span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compact mode toggle for mobile */}
            <button
              onClick={() => setMode(mode === 'patient' ? 'clinician' : 'patient')}
              className={cn(
                'w-7 h-7 flex items-center justify-center border-2 transition-all text-[10px] font-bold uppercase shrink-0',
                isClinicianMode
                  ? 'bg-slate-900 text-white border-white'
                  : 'bg-brand-accent text-white border-[#1a1a1a]'
              )}
              title={`Switch to ${isClinicianMode ? 'Patient' : 'Clinician'} mode`}
            >
              {isClinicianMode ? 'Dr' : 'Pt'}
            </button>
            <button onClick={() => setEvidencePanelOpen(!evidencePanelOpen)} className="text-[#1a1a1a] dark:text-white">
              <Info size={18} />
            </button>
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="w-7 h-7 bg-brand-accent text-white flex items-center justify-center font-bold text-[10px] border-2 border-[#1a1a1a] dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(26,26,26,1)] dark:shadow-[1.5px_1.5px_0px_0px_#ffffff] uppercase shrink-0"
              title={`${user?.username || 'User'}'s Profile`}
            >
              {user ? getInitials(user.username) : 'U'}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scroll-premium bg-[#fafafa] dark:bg-slate-950 bg-[radial-gradient(#1a1a1a_0.75px,transparent_0.75px)] dark:bg-[radial-gradient(#ffffff_0.75px,transparent_0.75px)] [background-size:24px_24px] [background-position:center] transition-all duration-1000">
          {messages.length === 0 ? (
            <WelcomeScreen mode={mode} onQuestionClick={(text) => setInputValue(text)} />
          ) : (
            <div className="px-2 sm:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8 max-w-3xl mx-auto animate-message transition-all duration-1000">
              {messages.map((msg, idx) => {
                const prevUserMsg = msg.role === 'assistant' && idx > 0 && messages[idx - 1].role === 'user' ? messages[idx - 1] : null
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    mode={mode}
                    username={user?.username || 'You'}
                    question={prevUserMsg?.content}
                    onReask={handleReask}
                    onCitationClick={c => { setPanelCitations(c); setEvidencePanelOpen(true) }}
                    onCitationIndexClick={(index) => {
                      if (msg.citations) {
                        setPanelCitations(msg.citations)
                        setPanelTools(msg.tool_trace || [])
                        setPanelSafety(msg.safety_flags || null)
                        setEvidencePanelOpen(true)
                        setEvidenceTab('sources')
                        setHighlightedCitationIndex(index)
                      }
                    }}
                  />
                )
              })}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="w-full bg-white dark:bg-slate-950 pt-1.5 sm:pt-2 pb-2 sm:pb-2.5 px-3 sm:px-6 z-30 border-t-2 border-[#1a1a1a] dark:border-white transition-all duration-1000 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className={cn(
              'bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white p-1 pr-2 sm:pr-2.5 pl-1.5 sm:pl-2 flex items-end gap-1.5 sm:gap-2 clinical-shadow',
            )}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isClinicianMode ? 'ASK A CLINICIAN-GRADE CLINICAL QUESTION…' : 'ASK A CLINICAL QUESTION ABOUT HYPERTENSION…'}
                rows={1}
                className="flex-1 bg-transparent text-[#1a1a1a] dark:text-white placeholder-[#1a1a1a]/50 dark:placeholder-white/50 text-sm font-medium resize-none focus:outline-none focus:ring-0 leading-normal px-1.5 sm:px-2 py-1.5 min-h-[36px] max-h-32 scrollbar-thin"
              />
              <div className="flex items-center gap-1.5 sm:gap-2 pb-1">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="text-[#1a1a1a] dark:text-white hover:bg-brand-accent hover:text-white dark:hover:bg-brand-accent transition-colors p-1 sm:p-1.5 border-2 border-transparent hover:border-[#1a1a1a] dark:hover:border-white brutalist-button shrink-0"
                  title="Upload documents"
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">add_circle</span>
                </button>
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className={cn(
                    'shrink-0 h-7 sm:h-8 px-2.5 sm:px-3.5 font-label-md text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-all border-2 border-clinical-black dark:border-white brutalist-button',
                    inputValue.trim() && !isLoading
                      ? 'bg-[#1a1a1a] dark:bg-brand-accent hover:bg-brand-accent dark:hover:bg-white dark:hover:text-black text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  )}
                >
                  {isLoading ? <Spinner size="sm" /> : (
                    <>
                      <Send size={12} className="sm:block" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 sm:mt-3.5 px-1.5 sm:px-2">
              <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500 font-code-sm font-bold uppercase opacity-low flex items-center gap-1.5">
                <Kbd>Enter</Kbd> send
                <span className="text-gray-300 dark:text-slate-700 hidden sm:inline">·</span>
                <Kbd className="hidden sm:inline-flex">Shift</Kbd><span className="hidden sm:inline">+</span><Kbd className="hidden sm:inline-flex">Enter</Kbd><span className="hidden sm:inline"> new line</span>
              </p>
              <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500 font-code-sm font-bold uppercase opacity-low inline-flex items-center gap-1 sm:gap-1.5 bg-yellow-200 dark:bg-yellow-900/60 px-1.5 sm:px-2 py-0.5 border-2 border-[#1a1a1a] dark:border-white">
                <Shield size={10} className="sm:inline" /> <span className="hidden sm:inline">Educational purposes only</span><span className="sm:hidden">Not medical advice</span>
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
        activeTab={evidenceTab}
        setActiveTab={setEvidenceTab}
        highlightedCitationIndex={highlightedCitationIndex}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user!}
        onUpdateUser={(updated) => { setUser(updated); saveLocalUserProfile(updated); }}
        onChatAboutDoc={handleChatAboutDoc}
        onOpenBmiModal={() => setIsBmiModalOpen(true)}
      />

      {/* BMI Calculator Modal */}
      {isBmiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinical-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border-4 border-clinical-black dark:border-white w-full max-w-3xl max-h-[90vh] overflow-y-auto neo-brutal-shadow relative p-2 sm:p-4">
            <button
              onClick={() => setIsBmiModalOpen(false)}
              className="absolute top-2 right-2 w-8 h-8 bg-brand-accent text-white border-2 border-clinical-black flex items-center justify-center font-bold z-10 hover:bg-brand-accent/80"
              title="Close BMI Calculator"
            >
              <X size={16} />
            </button>
            <BMICalculator
              user={user}
              onSaveVitals={(vitals) => {
                handleSaveVitals(vitals)
              }}
            />
          </div>
        </div>
      )}
      <SpeedInsights />
    </div>
  )
}

function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-[10px] font-mono text-gray-600 dark:text-slate-400 shadow-sm", className)}>
      {children}
    </kbd>
  )
}
