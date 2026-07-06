import React, { useState } from 'react'
import {
  Activity,
  MessageSquare,
  BarChart3,
  FileText,
  Github,
  Shield,
  Database,
  Loader2,
  ChevronRight,
  Menu,
  X,
  Scale,
} from 'lucide-react'
import { Analytics } from '@vercel/analytics/react'
import { cn } from './lib/utils'
import { useApi } from './hooks/useApi'
import { HeroSection } from './components/HeroSection'
import { QueryInterface } from './components/QueryInterface'
import { EvalDashboard } from './components/EvalDashboard'
import { ModeSelector } from './components/ModeSelector'
import { BMICalculator } from './components/BMICalculator'
import { SourcesPanel } from './components/SourcesPanel'
import type { SourceMetadata } from './types/api'

type Tab = 'home' | 'query' | 'eval' | 'docs' | 'bmi'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [mode, setMode] = useState<'patient' | 'clinician'>('patient')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [health, setHealth] = useState<{ status: string; documents: number; chunks: number } | null>(null)
  const [sources, setSources] = useState<SourceMetadata[]>([])
  const [sourcesMeta, setSourcesMeta] = useState({ total: 0, indexedCount: 0 })
  const { health: checkHealth, sources: getSources, ingest, loading } = useApi()

  const refreshSources = React.useCallback(async () => {
    const data = await getSources()
    if (data) {
      setSources(data.sources)
      setSourcesMeta({ total: data.total, indexedCount: data.indexed_count })
    }
  }, [getSources])

  React.useEffect(() => {
    checkHealth().then((h) => {
      if (h) setHealth(h)
    })
    refreshSources()
  }, [checkHealth, refreshSources])

  const handleIngest = async () => {
    const result = await ingest()
    if (result) {
      const h = await checkHealth()
      if (h) setHealth(h)
      await refreshSources()
    }
  }

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Overview', icon: Activity },
    { id: 'query', label: 'Query Assistant', icon: MessageSquare },
    { id: 'eval', label: 'Evaluation', icon: BarChart3 },
    { id: 'docs', label: 'Sources', icon: FileText },
    { id: 'bmi', label: 'BMI Calc', icon: Scale },
  ]

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <button
                onClick={() => { setActiveTab('home'); setMobileNavOpen(false) }}
                className="flex items-center gap-2"
              >
                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-medical-500/20 to-medical-600/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-medical-400" />
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-medical-400/30 animate-ping-slow" />
                </div>
                <span className="text-sm font-bold text-white">
                  Clinical<span className="text-medical-400">RAG</span>
                </span>
              </button>

              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      activeTab === item.id
                        ? 'bg-medical-500/12 text-medical-300 shadow-sm'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {health && (
                <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3 h-3" />
                    {health.documents} docs
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>{health.chunks} chunks</span>
                </div>
              )}
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Github className="w-4 h-4" />
              </a>
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden text-slate-500 hover:text-slate-300 transition-colors"
              >
                {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden border-b border-white/[0.06] bg-surface-950/95 backdrop-blur-xl animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileNavOpen(false) }}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === item.id
                    ? 'bg-medical-500/12 text-medical-300'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="relative">
        <div className="fixed inset-0 dot-grid-bg pointer-events-none opacity-40" />

        <div className="animate-fade-in" key={activeTab}>
          {activeTab === 'home' && (
            <>
              <HeroSection />

              {/* Mode Selection */}
              <div id="mode-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Choose Your Experience</h2>
                  <p className="text-sm text-slate-500 max-w-xl mx-auto">
                    Select the mode that fits your needs. Patient mode provides plain-language
                    education. Clinician mode delivers evidence-based workflow support.
                  </p>
                </div>
                <ModeSelector value={mode} onChange={setMode} variant="prominent" />

                {/* Mode-specific CTA */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setActiveTab('query')}
                    className={cn(
                      'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all hover-lift',
                      mode === 'patient'
                        ? 'bg-medical-500/15 hover:bg-medical-500/20 text-medical-400 border border-medical-500/20'
                        : 'bg-violet-500/15 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20'
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                    {mode === 'patient' ? 'Start Asking About Your Health' : 'Start Clinical Query'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* System Status Dashboard */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="glass-panel-glow p-5 animate-slide-up stagger-1 hover-lift">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Database className="w-4 h-4 text-sky-400" />
                        System Status
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          health?.status === 'ok' ? 'bg-emerald-400 animate-pulse-glow' : 'bg-amber-400'
                        )} />
                        <span className={cn(
                          'text-[10px] font-medium',
                          health?.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'
                        )}>
                          {health?.status === 'ok' ? 'Online' : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                        <span className="text-xs text-slate-500">Status</span>
                        <span className="text-xs text-emerald-400 font-medium">
                          {health?.status === 'ok' ? 'Healthy' : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                        <span className="text-xs text-slate-500">Documents Indexed</span>
                        <span className="text-xs text-slate-300 font-mono font-medium">{health?.documents ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                        <span className="text-xs text-slate-500">Chunks Retrieved</span>
                        <span className="text-xs text-slate-300 font-mono font-medium">{health?.chunks ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel-glow p-5 animate-slide-up stagger-2 hover-lift">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        Safety Features
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Refusal Guardrails', color: 'emerald' },
                        { label: 'Citation Validation', color: 'emerald' },
                        { label: 'Claim Support Labels', color: 'emerald' },
                        { label: 'Prompt Injection Detection', color: 'emerald' },
                        { label: 'Clinical Disclaimer', color: 'emerald' },
                      ].map(({ label, color }) => (
                        <div key={label} className="flex items-center gap-2.5 py-1.5">
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            color === 'emerald' ? 'bg-emerald-400/70' : 'bg-amber-400/70'
                          )} />
                          <span className="text-xs text-slate-400">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel-glow p-5 animate-slide-up stagger-3 hover-lift">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-medical-400" />
                        Indexed Sources
                      </h3>
                      <button
                        onClick={handleIngest}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-medical-500/10
                          text-medical-400 hover:bg-medical-500/20 transition-all disabled:opacity-40 border border-medical-500/15"
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                        {loading ? 'Ingesting...' : 'Ingest'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                      {sources.filter((s) => s.indexed).length === 0 ? (
                        <div className="py-6 text-center">
                          <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                          <p className="text-xs text-slate-500">Click <span className="text-medical-400 font-medium">Ingest</span> to load default NICE, WHO, and CDC sources.</p>
                        </div>
                      ) : (
                        sources.filter((s) => s.indexed).map((source) => (
                          <div key={source.source_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                            <span className="text-xs text-slate-400 truncate max-w-[180px]">{source.title || source.source_id}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{source.chunk_count} chunks</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Start Guide */}
                <div className="mt-8 glass-panel-glow p-6 animate-slide-up stagger-4">
                  <h3 className="text-base font-semibold text-white mb-1">Quick Start Guide</h3>
                  <p className="text-xs text-slate-500 mb-5">Four steps to explore the ClinicalRAG system</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        step: '01',
                        title: 'Ingest Guidelines',
                        desc: 'Load NICE, WHO, and CDC hypertension sources into the retrieval index',
                        action: 'Ingest Sources',
                        onClick: handleIngest,
                        color: 'sky',
                      },
                      {
                        step: '02',
                        title: 'Ask a Question',
                        desc: mode === 'patient' ? 'Learn about your health in plain language' : 'Try a guideline or workflow question',
                        action: 'Open Query',
                        onClick: () => setActiveTab('query'),
                        color: 'medical',
                      },
                      {
                        step: '03',
                        title: 'Test Safety',
                        desc: 'Try an unsafe request to see deterministic refusal behavior in action',
                        action: 'Try Refusal',
                        onClick: () => setActiveTab('query'),
                        color: 'rose',
                      },
                      {
                        step: '04',
                        title: 'Run Evaluation',
                        desc: 'Check quality metrics against the golden question set',
                        action: 'View Eval',
                        onClick: () => setActiveTab('eval'),
                        color: 'emerald',
                      },
                    ].map((item) => {
                      const colorClasses: Record<string, string> = {
                        sky: 'text-sky-400 border-sky-500/20 hover:bg-sky-500/10',
                        medical: 'text-medical-400 border-medical-500/20 hover:bg-medical-500/10',
                        rose: 'text-rose-400 border-rose-500/20 hover:bg-rose-500/10',
                        emerald: 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10',
                      }
                      return (
                        <button
                          key={item.step}
                          onClick={item.onClick}
                          className="group text-left glass-panel-hover p-4 relative overflow-hidden"
                        >
                          <div className="text-[10px] text-medical-400 font-mono font-medium mb-2">{item.step}</div>
                          <h4 className="text-sm font-semibold text-slate-200 mb-1.5">{item.title}</h4>
                          <p className="text-xs text-slate-500 mb-4 leading-relaxed">{item.desc}</p>
                          <div className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-medium transition-colors px-2.5 py-1 rounded-lg border',
                            colorClasses[item.color],
                            'bg-transparent'
                          )}>
                            {item.action}
                            <ChevronRight className="w-3 h-3" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'query' && <QueryInterface mode={mode} onModeChange={setMode} />}
          {activeTab === 'eval' && <EvalDashboard />}
          {activeTab === 'bmi' && <BMICalculator />}
          {activeTab === 'docs' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-medical-400" />
                    Source Registry
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Registered clinical guideline sources with ingestion and indexing metadata
                  </p>
                </div>
                <button
                  onClick={handleIngest}
                  disabled={loading}
                  className="btn-primary-medical text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {loading ? 'Ingesting...' : 'Ingest Default Sources'}
                </button>
              </div>
              <SourcesPanel
                sources={sources}
                indexedCount={sourcesMeta.indexedCount}
                total={sourcesMeta.total}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-medical-500/15 to-medical-600/5 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-medical-400" />
              </div>
              <p className="text-xs text-slate-600">
                ClinicalRAG — Educational demonstration. Not for clinical decision support.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  health?.status === 'ok' ? 'bg-emerald-400/60 animate-pulse-glow' : 'bg-amber-400/60'
                )} />
                <span className="text-[10px] text-slate-500">
                  Backend {health?.status === 'ok' ? 'Connected' : 'Offline'}
                </span>
              </div>
              <span className="text-[10px] text-slate-700 font-mono">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
      <Analytics />
    </div>
  )
}
