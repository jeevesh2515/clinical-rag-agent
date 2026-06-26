import React from 'react'
import { Activity, Shield, Stethoscope, BookOpen, Database, Search, ChevronRight, ArrowRight } from 'lucide-react'

const features = [
  {
    icon: Stethoscope,
    accent: 'medical',
    title: 'Dual Mode',
    desc: 'Patient & clinician modes with tailored responses, safety boundaries, and appropriate language',
  },
  {
    icon: Shield,
    accent: 'emerald',
    title: 'Safety First',
    desc: 'Deterministic refusal guardrails for unsafe medical, diagnosis, and prescribing requests',
  },
  {
    icon: Database,
    accent: 'sky',
    title: 'Hybrid Search',
    desc: 'Dense + BM25 retrieval with Cohere reranking for clinically relevant results',
  },
  {
    icon: BookOpen,
    accent: 'amber',
    title: 'Grounded Citations',
    desc: 'Every clinical claim traced to guideline sources with exact supporting quotes',
  },
  {
    icon: Search,
    accent: 'violet',
    title: 'Tool Trace',
    desc: 'Full visibility into agent reasoning, calculator use, and case lookup decisions',
  },
  {
    icon: Activity,
    accent: 'rose',
    title: 'Evaluated',
    desc: 'RAGAS-compatible quality metrics with deterministic local proxies for CI',
  },
]

const stats = [
  { value: '6', label: 'Intent Classes', color: 'text-medical-400' },
  { value: '7', label: 'Safety Flags', color: 'text-emerald-400' },
  { value: '3', label: 'Claim Types', color: 'text-sky-400' },
  { value: '49+', label: 'Tests Passing', color: 'text-violet-400' },
]

export const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 mesh-gradient animate-mesh-shift" />
      <div className="absolute inset-0 dot-grid-bg opacity-60" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-[12%] w-2.5 h-2.5 rounded-full bg-medical-400/25 animate-float" />
        <div className="absolute top-32 right-[18%] w-2 h-2 rounded-full bg-sky-400/20 animate-float-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-56 left-[28%] w-3 h-3 rounded-full bg-medical-500/15 animate-float-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-48 right-[12%] w-2 h-2 rounded-full bg-violet-400/20 animate-float" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-24 left-[8%] w-1.5 h-1.5 rounded-full bg-sky-400/15 animate-float-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[35%] right-[32%] w-2.5 h-2.5 rounded-full bg-medical-500/15 animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[60%] left-[45%] w-1.5 h-1.5 rounded-full bg-emerald-400/20 animate-float-slow" style={{ animationDelay: '2.5s' }} />
      </div>

      {/* Radial spotlights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-medical-500/8 rounded-full blur-[150px] animate-breath" />
      <div className="absolute top-[-8%] right-[-8%] w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[400px] bg-violet-500/5 rounded-full blur-[100px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-medical-500/10 border border-medical-500/20 text-medical-400 text-sm mb-8 animate-fade-in">
            <div className="w-1.5 h-1.5 rounded-full bg-medical-400 animate-pulse-glow" />
            <span className="font-medium">Production-Grade Agentic RAG for Healthcare</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight mb-6 animate-fade-in-up">
            <span className="text-white">Clinical</span>
            <span className="text-gradient-animate">RAG</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            A safety-first agentic assistant for clinical workflows. Hybrid retrieval,
            grounded citations, and deterministic safety guardrails purpose-built for
            healthcare AI demonstrations.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => {
                const el = document.getElementById('mode-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-medical-500/15 hover:bg-medical-500/20
                text-medical-400 border border-medical-500/20 text-sm font-medium transition-all hover-lift"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('stats-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08]
                text-slate-300 border border-white/[0.08] text-sm font-medium transition-all hover-lift"
            >
              System Stats
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stats bar */}
          <div id="stats-section" className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            {stats.map((stat) => (
              <div key={stat.label} className="glass-panel p-4 text-center hover-lift">
                <div className={`text-3xl font-bold font-mono ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {features.map((feature, i) => {
              const Icon = feature.icon
              const accentColors: Record<string, { bg: string; text: string; ring: string }> = {
                medical: { bg: 'bg-medical-500/15', text: 'text-medical-400', ring: 'ring-medical-500/30' },
                emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
                sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', ring: 'ring-sky-500/30' },
                amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
                violet: { bg: 'bg-violet-500/15', text: 'text-violet-400', ring: 'ring-violet-500/30' },
                rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', ring: 'ring-rose-500/30' },
              }
              const colors = accentColors[feature.accent] || accentColors.medical

              return (
                <div
                  key={feature.title}
                  className={`glass-panel-glow p-4 text-left animate-slide-up stagger-${i + 1} hover-lift`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{feature.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Scroll indicator */}
          <div className="mt-14 flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em]">Explore</span>
            <div className="w-5 h-8 rounded-full border border-slate-700/60 flex justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-medical-400/60 animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
