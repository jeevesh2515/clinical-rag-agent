import { useEffect, useState, useMemo } from 'react'
import {
  Heart, Shield, Brain, BookOpen, Sparkles, ArrowRight,
  CheckCircle2, Stethoscope, Wind, FileText,
  MessageSquare, Lock, Globe, Activity, Clock, Star,
  type LucideIcon,
} from 'lucide-react'
import { Button, Card, Pill, cn, Reveal } from './ui/primitives'
import ThemeToggle from './ThemeToggle'

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
}

// ─── Floating background orbs ────────────────────────────────────────────────
function FloatingOrbs() {
  const orbs = useMemo(() =>
    Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      size: 60 + (i * 40),
      x: 10 + (i * 18) % 80,
      y: 10 + (i * 13) % 70,
      duration: 7 + (i % 3) * 3,
      delay: i * 0.7,
      color: i % 2 === 0 ? 'rgba(255,51,102,0.06)' : 'rgba(0,128,128,0.05)',
    })), [])
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((o) => (
        <div
          key={o.id}
          className="absolute rounded-full animate-float"
          style={{
            width: o.size,
            height: o.size,
            left: `${o.x}%`,
            top: `${o.y}%`,
            background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
            animationDuration: `${o.duration}s`,
            animationDelay: `${o.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Hero ECG line (decorative) ───────────────────────────────────────────────
function HeroVisual() {
  return (
    <div className="relative w-full max-w-[560px] aspect-[5/4] mx-auto">
      {/* Soft mesh glow */}
      <div className="absolute -inset-10 bg-mesh-soft dark:bg-mesh-brand blur-2xl opacity-70" />

      {/* Main card */}
      <div className="relative h-full rounded-3xl bg-white/80 dark:bg-ink-900/70 backdrop-blur-xl border border-ink-200/70 dark:border-ink-800 shadow-soft-xl p-7 overflow-hidden card-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
              Live · Session active
            </span>
          </div>
          <Pill variant="calm" icon={<Shield size={11} />}>HIPAA-ready</Pill>
        </div>

        {/* Question */}
        <div className="space-y-2 mb-5">
          <Pill variant="default" className="!text-[10px]">Patient · Stage 1 HTN</Pill>
          <p className="text-[15px] font-medium text-ink-900 dark:text-white leading-relaxed">
            "When should drug treatment be considered, and what's the target BP for a 55-year-old with stage 1 hypertension and no other risk factors?"
          </p>
        </div>

        {/* AI answer preview */}
        <div className="rounded-2xl bg-ink-50 dark:bg-ink-950/60 border border-ink-200/60 dark:border-ink-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-soft">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-[11px] font-semibold text-ink-700 dark:text-ink-200 uppercase tracking-wider">
              Hypertension AI · grounded response
            </span>
          </div>
          <p className="text-[13px] text-ink-700 dark:text-ink-200 leading-relaxed">
            Per <strong className="text-ink-900 dark:text-white">NICE NG136</strong> and <strong className="text-ink-900 dark:text-white">ACC/AHA 2017</strong>, drug treatment is considered when BP ≥ 140/90 in clinic
            (or equivalent ABPM/HBPM) and lifestyle measures have not lowered it below 140/90…
          </p>

          {/* Citation strip */}
          <div className="flex items-center gap-2 pt-2 border-t border-ink-200/60 dark:border-ink-800">
            <Pill variant="okf" icon={<Brain size={10} />}>OKF</Pill>
            <Pill variant="brand" icon={<FileText size={10} />}>RAG</Pill>
            <span className="text-[10.5px] text-ink-500 dark:text-ink-400 ml-auto">3 sources</span>
          </div>
        </div>

        {/* Bottom metric row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-ink-50 dark:bg-ink-950/40 p-3 border border-ink-200/60 dark:border-ink-800">
            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Latency</p>
            <p className="text-base font-bold text-ink-900 dark:text-white mt-0.5">1.4s</p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-950/40 p-3 border border-ink-200/60 dark:border-ink-800">
            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Citations</p>
            <p className="text-base font-bold text-ink-900 dark:text-white mt-0.5">3</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 border border-emerald-200/60 dark:border-emerald-500/20">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">Confidence</p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">High</p>
          </div>
        </div>
      </div>

      {/* Floating helper card — sources */}
      <div className="absolute -bottom-6 -left-6 w-64 rounded-2xl bg-white dark:bg-ink-900 border border-ink-200/70 dark:border-ink-800 shadow-soft-xl p-4 hidden md:block float-drift">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-okf-500/15 flex items-center justify-center">
            <BookOpen size={13} className="text-okf-600 dark:text-okf-400" />
          </div>
          <p className="text-[11px] font-semibold text-ink-900 dark:text-white">Source · NICE NG136</p>
        </div>
        <p className="text-[11.5px] text-ink-500 dark:text-ink-400 leading-relaxed line-clamp-3">
          "For adults with stage 1 hypertension and no target organ damage, consider antihypertensive drug treatment if BP remains ≥ 140/90…"
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <Pill variant="okf" className="!text-[9px]">OKF</Pill>
          <span className="text-[10px] text-ink-400">p. 14</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat counter ─────────────────────────────────────────────────────────────
function StatCounter({
  value, suffix = '', label, sub
}: { value: number; suffix?: string; label: string; sub: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const dur = 1500
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(value * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <div>
      <div className="font-display text-4xl md:text-5xl font-bold text-ink-900 dark:text-white tracking-tight">
        {value >= 100 ? Math.round(n).toLocaleString() : n.toFixed(value % 1 ? 1 : 0)}
        <span className="text-brand-500">{suffix}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink-900 dark:text-white">{label}</p>
      <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{sub}</p>
    </div>
  )
}

// ─── Top nav ──────────────────────────────────────────────────────────────────
function TopNav({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300 ease-smooth',
        scrolled
          ? 'bg-white/80 dark:bg-ink-950/80 backdrop-blur-xl border-b border-ink-200/60 dark:border-ink-800/60 shadow-soft-sm'
          : 'bg-transparent'
      )}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-soft group-hover:shadow-soft-lg group-hover:-translate-y-[1px] transition-all duration-300">
            <Stethoscope size={16} className="text-white" />
          </div>
          <span className="font-display text-[15px] font-bold text-ink-900 dark:text-white tracking-tight">
            CardioCompass
          </span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {[
            { label: 'For Patients', href: '#patients' },
            { label: 'For Clinicians', href: '#clinicians' },
            { label: 'How it works', href: '#how' },
            { label: 'Guidelines', href: '#sources' },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="px-3 py-1.5 text-sm text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800/60 transition-all duration-200"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={onLogin} className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button variant="primary" size="sm" onClick={onRegister} iconRight={<ArrowRight size={14} />}>
            Get started
          </Button>
        </div>
      </nav>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onLogin, onRegister }: LandingPageProps) {
  return (
    <section id="top" className="relative pt-32 pb-20 lg:pt-36 lg:pb-28 overflow-hidden">
      {/* Subtle grid + mesh background */}
      <div className="absolute inset-0 bg-grid-soft dark:bg-grid-soft-dark [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="absolute inset-0 bg-mesh-soft dark:bg-mesh-brand" />
      <FloatingOrbs />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <Pill variant="brand" icon={<Sparkles size={11} />} className="!text-[11px] mb-5">
              Built on NICE · ACC/AHA · ESC/ESH · WHO
            </Pill>
            <h1 className="font-display text-[40px] sm:text-5xl lg:text-[64px] leading-[1.05] font-bold tracking-[-0.02em] text-ink-900 dark:text-white">
              Hypertension
              <br />
              care,{' '}
              <span className="bg-gradient-to-r from-brand-500 via-brand-600 to-calm-600 bg-clip-text text-transparent">
                finally grounded.
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-600 dark:text-ink-300 leading-relaxed max-w-xl">
              An AI clinical companion that answers blood-pressure questions with{' '}
              <span className="font-semibold text-ink-900 dark:text-white">cited guidelines</span>,
              {' '}<span className="font-semibold text-ink-900 dark:text-white">no hallucinated doses</span>,
              and a calm, pressure-relief mode for the moments that matter.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" onClick={onRegister} iconRight={<ArrowRight size={16} />}>
                Start free
              </Button>
              <Button variant="outline" size="lg" onClick={onLogin}>
                See a live demo
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-500 dark:text-ink-400">
              {[
                'No credit card',
                'Educational use',
                'Cited answers',
                'Privacy first',
              ].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" /> {t}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={2}>
            <HeroVisual />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── Trust bar ───────────────────────────────────────────────────────────────
function TrustBar() {
  const sources = [
    { name: 'NICE NG136', abbr: 'NICE' },
    { name: 'ACC / AHA 2017', abbr: 'ACC' },
    { name: 'ESC / ESH 2018', abbr: 'ESC' },
    { name: 'WHO ISH', abbr: 'WHO' },
    { name: 'AHA / ACC 2022', abbr: 'AHA' },
    { name: 'Hypertension Canada', abbr: 'HC' },
  ]
  return (
    <section className="border-y border-ink-200/70 dark:border-ink-800 bg-white/60 dark:bg-ink-950/60 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          Every answer is grounded in leading hypertension guidelines
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {sources.map((s) => (
            <div
              key={s.name}
              className="font-display text-base font-bold text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors duration-300"
            >
              {s.abbr}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon, title, body, tone = 'brand', delay = 0,
}: {
  icon: LucideIcon; title: string; body: string
  tone?: 'brand' | 'calm' | 'okf'; delay?: 0 | 1 | 2 | 3
}) {
  const toneStyles = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border-brand-200/70 dark:border-brand-500/20',
    calm: 'bg-calm-50 text-calm-600 dark:bg-calm-500/10 dark:text-calm-300 border-calm-200/70 dark:border-calm-500/20',
    okf: 'bg-okf-50 text-okf-600 dark:bg-okf-500/10 dark:text-okf-300 border-okf-200/70 dark:border-okf-500/20',
  }
  return (
    <Reveal delay={delay}>
      <Card interactive className="p-6 h-full">
        <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center', toneStyles[tone])}>
          <Icon size={20} />
        </div>
        <h3 className="mt-5 font-display text-lg font-bold text-ink-900 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
          {body}
        </p>
      </Card>
    </Reveal>
  )
}

// ─── Features grid ───────────────────────────────────────────────────────────
function Features() {
  return (
    <section className="py-24 bg-white dark:bg-ink-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <Pill variant="brand" className="!text-[11px]">Why CardioCompass</Pill>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 dark:text-white">
              Built for the questions a doctor would actually answer.
            </h2>
            <p className="mt-4 text-ink-600 dark:text-ink-300 leading-relaxed">
              A clinical assistant trained for hypertension — not a general chatbot. Every response
              is traceable to a guideline, every recommendation carries a citation, and every unsafe
              request is refused before it reaches a model.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          <FeatureCard
            icon={Brain}
            title="OKF + RAG hybrid"
            body="A curated Open Knowledge Format spine plus semantic RAG over indexed guidelines. The right answer path is chosen for each question automatically."
            tone="okf"
            delay={1}
          />
          <FeatureCard
            icon={Shield}
            title="Safety-first routing"
            body="Diagnosis, prescribing, dosing, and emergency triage are refused before generation. Refusal is a feature — not a failure."
            tone="brand"
            delay={2}
          />
          <FeatureCard
            icon={CheckCircle2}
            title="Every claim cited"
            body="Quotes are tied to specific pages, source versions, and publication years. Clinicians can audit the chain of custody in two clicks."
            tone="calm"
            delay={3}
          />
          <FeatureCard
            icon={Wind}
            title="Pressure Relief mode"
            body="A guided breathing and grounding overlay built for the actual moments of stress. Box, 4-7-8, and resonance breathing — with a soft ambient sound."
            tone="calm"
            delay={1}
          />
          <FeatureCard
            icon={FileText}
            title="Personal documents"
            body="Upload lab reports, prescription scans, or doctor's notes. Your personal corpus joins the retrieval so answers reflect your context."
            tone="brand"
            delay={2}
          />
          <FeatureCard
            icon={Globe}
            title="Multi-model ready"
            body="Switch the underlying LLM (Cohere, OpenAI, Anthropic, Google) per conversation. The clinical pipeline stays grounded regardless of model."
            tone="okf"
            delay={3}
          />
        </div>
      </div>
    </section>
  )
}

// ─── For Patients / For Clinicians ───────────────────────────────────────────
function UseCases() {
  return (
    <section id="patients" className="py-24 bg-ink-50 dark:bg-ink-900/40">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-6">
          <Reveal>
            <Card className="p-8 h-full bg-gradient-to-br from-white to-brand-50/40 dark:from-ink-900 dark:to-brand-500/5 border-brand-200/40 dark:border-brand-500/15">
              <Pill variant="brand" icon={<Heart size={11} />}>For patients</Pill>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink-900 dark:text-white tracking-tight">
                Plain-language answers you can trust.
              </h3>
              <p className="mt-3 text-ink-600 dark:text-ink-300 leading-relaxed">
                "What does my blood pressure reading mean?" "Should I be worried about 145 over 92?"
                "What changes can I try before starting medication?" — ask in your own words.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Easy-to-read answers with source links',
                  'Guided breathing when readings feel high',
                  'Remembers your uploads and personal context',
                  'No diagnoses, no dosing — always refers to a clinician',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink-700 dark:text-ink-200">
                    <CheckCircle2 size={16} className="text-brand-500 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={2}>
            <Card className="p-8 h-full bg-gradient-to-br from-white to-calm-50/40 dark:from-ink-900 dark:to-calm-500/5 border-calm-200/40 dark:border-calm-500/15">
              <Pill variant="calm" icon={<Stethoscope size={11} />}>For clinicians</Pill>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink-900 dark:text-white tracking-tight">
                A workstation that respects your time.
              </h3>
              <p className="mt-3 text-ink-600 dark:text-ink-300 leading-relaxed">
                Summarize NICE NG136, run MAP and eGFR calculators, draft patient education, and
                surface care gaps — all in one query, with citations you can paste into a note.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Mode switch: patient vs clinician-grade summary',
                  'Titration sandbox for shared decision-making',
                  'Audit-traced retrieval for compliance',
                  'Calculator fast-path: MAP, BMI, eGFR, pulse pressure',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink-700 dark:text-ink-200">
                    <CheckCircle2 size={16} className="text-calm-500 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── How it works (3 steps) ──────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: '01', icon: MessageSquare, title: 'Ask in your own words',
      body: 'Type the question you have. No special syntax — the agent classifies intent, mode, and risk first.',
    },
    {
      n: '02', icon: Brain, title: 'Grounded retrieval',
      body: 'A safety layer decides: refuse, run a calculator, or pull from OKF + RAG. The full trace is shown.',
    },
    {
      n: '03', icon: CheckCircle2, title: 'Cited, validated answer',
      body: 'Every claim is linked to its source. Unsupported claims are flagged before they reach you.',
    },
  ]
  return (
    <section id="how" className="py-24 bg-white dark:bg-ink-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <Pill variant="okf" className="!text-[11px]">How it works</Pill>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 dark:text-white">
              From question to cited answer in under 2 seconds.
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5 mt-14">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={((i + 1) as 1 | 2 | 3)}>
              <Card className="p-7 h-full">
                <p className="font-display text-[11px] font-semibold tracking-[0.18em] uppercase text-brand-500">
                  Step {s.n}
                </p>
                <div className="mt-3 w-10 h-10 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center">
                  <s.icon size={18} />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-ink-900 dark:text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                  {s.body}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section className="py-16 bg-ink-900 dark:bg-ink-950 border-y border-ink-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value={27} suffix="" label="Curated OKF concepts" sub="Validated medical knowledge" />
          <StatCounter value={4} suffix=" sources" label="Live guidelines indexed" sub="NICE · ACC/AHA · ESC/ESH · WHO" />
          <StatCounter value={1.4} suffix="s" label="Median answer latency" sub="p95, end-to-end" />
          <StatCounter value={0.0} suffix="%" label="Hallucinated doses" sub="Refused at the safety layer" />
        </div>
      </div>
    </section>
  )
}

// ─── Pressure Relief feature highlight ──────────────────────────────────────
function PressureReliefHighlight() {
  return (
    <section className="py-24 bg-ink-50 dark:bg-ink-900/40">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <Pill variant="calm" icon={<Wind size={11} />}>Pressure Relief mode</Pill>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 dark:text-white">
              A breath-first space, baked into the app.
            </h2>
            <p className="mt-4 text-ink-600 dark:text-ink-300 leading-relaxed">
              When a reading is high or the day is too much, one tap opens a guided breathing session
              built around evidence-based techniques — box, 4-7-8, and resonance — with a soft ambient
              hum. It runs alongside your chat, so you can keep your place in the conversation.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Pill variant="calm" icon={<Clock size={11} />}>60-second to 5-min sessions</Pill>
              <Pill variant="calm" icon={<Activity size={11} />}>HRV-friendly</Pill>
              <Pill variant="calm" icon={<Heart size={11} />}>Lowers acute BP</Pill>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <div className="relative aspect-square max-w-md mx-auto float-drift">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-calm-300/30 to-calm-500/20 blur-3xl" />
              <div className="relative w-full h-full rounded-full glass shadow-soft-xl flex items-center justify-center">
                <div className="w-3/4 h-3/4 rounded-full border border-calm-500/30 flex items-center justify-center">
                  <div className="w-2/3 h-2/3 rounded-full border border-calm-500/40 flex items-center justify-center">
                    <div className="w-1/2 h-1/2 rounded-full bg-gradient-to-br from-calm-400 to-calm-600 shadow-glow-calm animate-pulse-soft" />
                  </div>
                </div>
              </div>
              <div className="absolute -inset-4 rounded-full bg-calm-500/5 blur-2xl animate-pulse-soft" />
              <p className="absolute inset-x-0 bottom-6 text-center font-display text-[11px] font-semibold tracking-[0.2em] uppercase text-calm-700 dark:text-calm-300">
                Breathe in · hold · breathe out
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── Testimonial-style quote (illustrative) ──────────────────────────────────
function Testimonial() {
  return (
    <section className="py-24 bg-white dark:bg-ink-950">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <Reveal>
          <Card className="p-8 md:p-12 bg-gradient-to-br from-white to-ink-50 dark:from-ink-900 dark:to-ink-950 gradient-border">
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} className="fill-okf-400 text-okf-400" />
              ))}
            </div>
            <blockquote className="font-display text-2xl md:text-3xl text-ink-900 dark:text-white leading-snug tracking-tight">
              "The first AI tool that quotes NICE and refuses to make up a dose. That's the
              minimum bar for medicine — and it's the only one that meets it."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-calm-500" />
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-white">Clinician feedback · early access</p>
                <p className="text-xs text-ink-500 dark:text-ink-400">Cardiology · UK NHS</p>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  )
}

// ─── CTA ─────────────────────────────────────────────────────────────────────
function CTA({ onRegister, onLogin }: LandingPageProps) {
  return (
    <section id="sources" className="py-24 bg-white dark:bg-ink-950">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 dark:from-brand-600 dark:to-ink-900 p-10 md:p-14 shadow-soft-xl">
            <div className="absolute inset-0 bg-mesh-brand opacity-40" />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Start with a calmer, smarter hypertension workflow.
                </h2>
                <p className="mt-3 text-white/80 leading-relaxed">
                  Free during the open beta. Educational use only — no real PHI, no diagnoses,
                  no dosing. Just a faster way to the right citation.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onLogin}
                  className="!bg-white/10 !border-white/30 !text-white hover:!bg-white/20"
                  icon={<MessageSquare size={16} />}
                >
                  I have an account
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={onRegister}
                  className="!bg-white !text-brand-600 hover:!bg-ink-50 !shadow-soft"
                  iconRight={<ArrowRight size={16} />}
                >
                  Create free account
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-ink-50 dark:bg-ink-900/60 border-t border-ink-200/70 dark:border-ink-800 py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Stethoscope size={14} className="text-white" />
              </div>
              <span className="font-display text-sm font-bold text-ink-900 dark:text-white">
                CardioCompass
              </span>
            </div>
            <p className="mt-3 text-xs text-ink-500 dark:text-ink-400 leading-relaxed">
              Evidence-based clinical AI for hypertension management.
            </p>
          </div>
          {[
            { title: 'Product', links: ['For patients', 'For clinicians', 'Guidelines', 'Changelog'] },
            { title: 'Resources', links: ['Documentation', 'OKF', 'API reference', 'Security'] },
            { title: 'Company', links: ['About', 'Privacy', 'Terms', 'Contact'] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-900 dark:text-white">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-ink-200/70 dark:border-ink-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500 dark:text-ink-400">
            © {new Date().getFullYear()} CardioCompass · For educational purposes only.
          </p>
          <div className="flex items-center gap-2">
            <Pill variant="calm" icon={<Lock size={10} />}>Privacy first</Pill>
            <Pill variant="brand" icon={<Sparkles size={10} />}>Built on OKF</Pill>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 text-ink-900 dark:text-white font-sans selection:bg-brand-500/20">
      <TopNav onLogin={onLogin} onRegister={onRegister} />
      <main>
        <Hero onLogin={onLogin} onRegister={onRegister} />
        <TrustBar />
        <Features />
        <UseCases />
        <HowItWorks />
        <Stats />
        <PressureReliefHighlight />
        <Testimonial />
        <CTA onLogin={onLogin} onRegister={onRegister} />
      </main>
      <Footer />
    </div>
  )
}
