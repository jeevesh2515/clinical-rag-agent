import { useEffect, useRef, useState } from 'react'
import {
  X, Wind, Play, Pause, RotateCcw, Activity, Heart, Phone,
  ChevronRight, Check, Sparkles, Volume2, VolumeX,
} from 'lucide-react'
import { Button, cn, Pill } from '../ui/primitives'

// ─── Breathing techniques ────────────────────────────────────────────────────
type Technique = {
  id: string
  name: string
  short: string
  pattern: { inhale: number; hold1: number; exhale: number; hold2: number }
  whyItHelps: string
  bestFor: string
}

const TECHNIQUES: Technique[] = [
  {
    id: 'box',
    name: 'Box Breathing',
    short: '4 · 4 · 4 · 4',
    pattern: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
    whyItHelps: 'Used by Navy SEALs to stay calm under pressure. Balances sympathetic and parasympathetic response.',
    bestFor: 'General stress, before a BP reading',
  },
  {
    id: '478',
    name: '4-7-8 Calming',
    short: '4 · 7 · 8',
    pattern: { inhale: 4, hold1: 7, exhale: 8, hold2: 0 },
    whyItHelps: 'Dr. Andrew Weil\'s relaxation breath. The long exhale activates the vagus nerve and slows heart rate.',
    bestFor: 'Acute anxiety, pre-measurement nerves',
  },
  {
    id: 'resonance',
    name: 'Resonance Breathing',
    short: '5 · 5',
    pattern: { inhale: 5, hold1: 0, exhale: 5, hold2: 0 },
    whyItHelps: 'About 6 breaths/min — the frequency that maximizes heart rate variability (HRV).',
    bestFor: 'Daily practice, long-term HRV',
  },
  {
    id: 'coherent',
    name: 'Coherent Breath',
    short: '6 · 6',
    pattern: { inhale: 6, hold1: 0, exhale: 6, hold2: 0 },
    whyItHelps: 'Smooth, even breath at ~5 BPM. Linked to lower resting BP over weeks of practice.',
    bestFor: 'Daily practice, lowering baseline BP',
  },
]

// ─── Soft ambient sound (Web Audio API) ──────────────────────────────────────
function useAmbientAudio(active: boolean, on: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    if (!active || !on) {
      if (nodesRef.current) {
        nodesRef.current.stop()
        nodesRef.current = null
      }
      return
    }
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext)
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      // Soft pad: two detuned sine oscillators + LFO
      const master = ctx.createGain()
      master.gain.value = 0
      master.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5)
      master.connect(ctx.destination)

      const lpf = ctx.createBiquadFilter()
      lpf.type = 'lowpass'
      lpf.frequency.value = 700
      lpf.connect(master)

      const o1 = ctx.createOscillator()
      o1.type = 'sine'
      o1.frequency.value = 110 // A2
      o1.detune.value = -4
      o1.connect(lpf)

      const o2 = ctx.createOscillator()
      o2.type = 'sine'
      o2.frequency.value = 165 // ~E3
      o2.detune.value = 4
      const g2 = ctx.createGain()
      g2.gain.value = 0.4
      o2.connect(g2).connect(lpf)

      // LFO for slow movement
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.12
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 4
      lfo.connect(lfoGain).connect(o1.detune)

      o1.start()
      o2.start()
      lfo.start()

      nodesRef.current = {
        stop: () => {
          try {
            master.gain.cancelScheduledValues(ctx.currentTime)
            master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
            setTimeout(() => {
              try { o1.stop(); o2.stop(); lfo.stop(); ctx.close() } catch { /* */ }
            }, 700)
          } catch { /* */ }
        },
      }
    } catch { /* audio not available */ }

    return () => {
      if (nodesRef.current) {
        nodesRef.current.stop()
        nodesRef.current = null
      }
    }
  }, [active, on])

  // Resume on first user gesture (autoplay policy)
  useEffect(() => {
    const resume = () => { ctxRef.current?.resume().catch(() => undefined) }
    if (active && on) {
      window.addEventListener('click', resume, { once: true })
      window.addEventListener('keydown', resume, { once: true })
    }
    return () => {
      window.removeEventListener('click', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [active, on])
}

// ─── Breathing animation hook ────────────────────────────────────────────────
type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2' | 'idle'

function useBreathingCycle(
  pattern: Technique['pattern'],
  running: boolean,
  onPhaseChange?: (p: Phase) => void,
  onCycle?: (n: number) => void
) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [cycle, setCycle] = useState(0)
  const tickRef = useRef<number | null>(null)
  const lastChangeRef = useRef<number>(0)

  useEffect(() => {
    if (!running) {
      setPhase('idle')
      setSecondsLeft(0)
      if (tickRef.current) {
        cancelAnimationFrame(tickRef.current)
        tickRef.current = null
      }
      return
    }

    const sequence: Array<[Phase, number]> = (
      [
        ['inhale', pattern.inhale],
        ['hold1', pattern.hold1],
        ['exhale', pattern.exhale],
        ['hold2', pattern.hold2],
      ] as Array<[Phase, number]>
    ).filter(([, d]) => d > 0)

    let seqIdx = 0
    let phaseStart = performance.now()

    const startPhase = (idx: number) => {
      seqIdx = idx % sequence.length
      if (seqIdx === 0) {
        setCycle((c) => {
          const next = c + 1
          onCycle?.(next)
          return next
        })
      }
      const [p, dur] = sequence[seqIdx]
      setPhase(p)
      setSecondsLeft(dur)
      onPhaseChange?.(p)
      phaseStart = performance.now()
      lastChangeRef.current = phaseStart
    }

    startPhase(0)

    const loop = (t: number) => {
      const [, dur] = sequence[seqIdx]
      const elapsed = (t - phaseStart) / 1000
      const remaining = Math.max(0, dur - elapsed)
      setSecondsLeft(remaining)
      if (elapsed >= dur) {
        startPhase(seqIdx + 1)
      }
      tickRef.current = requestAnimationFrame(loop)
    }
    tickRef.current = requestAnimationFrame(loop)

    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current)
    }
  }, [running, pattern.inhale, pattern.hold1, pattern.exhale, pattern.hold2])

  return { phase, secondsLeft, cycle, reset: () => setCycle(0) }
}

// ─── BP quick-log (local only) ───────────────────────────────────────────────
type BPLog = { id: string; systolic: number; diastolic: number; at: string; note?: string }

function loadLogs(): BPLog[] {
  try {
    const raw = localStorage.getItem('cw_bp_logs')
    return raw ? (JSON.parse(raw) as BPLog[]) : []
  } catch { return [] }
}
function saveLogs(logs: BPLog[]) {
  try { localStorage.setItem('cw_bp_logs', JSON.stringify(logs)) } catch { /* */ }
}

// ─── Main Modal ──────────────────────────────────────────────────────────────
export interface PressureReliefModalProps {
  open: boolean
  onClose: () => void
}

type View = 'choose' | 'breathe' | 'bp'

export default function PressureReliefModal({ open, onClose }: PressureReliefModalProps) {
  const [view, setView] = useState<View>('choose')
  const [technique, setTechnique] = useState<Technique>(TECHNIQUES[0])
  const [running, setRunning] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [targetCycles, setTargetCycles] = useState(8)
  const [bpLogs, setBpLogs] = useState<BPLog[]>([])
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')

  useEffect(() => {
    if (open) {
      setBpLogs(loadLogs())
      setView('choose')
      setRunning(false)
    }
  }, [open])

  const { phase, secondsLeft, cycle, reset } = useBreathingCycle(
    technique.pattern,
    running,
    undefined,
    (n) => {
      if (n >= targetCycles) setRunning(false)
    }
  )
  useAmbientAudio(open && view === 'breathe' && running, soundOn)

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const start = () => { reset(); setRunning(true) }
  const stop = () => setRunning(false)

  // Save BP log
  const logBP = () => {
    const s = Number(sys); const d = Number(dia)
    if (!s || !d) return
    const entry: BPLog = { id: String(Date.now()), systolic: s, diastolic: d, at: new Date().toISOString() }
    const next = [entry, ...bpLogs].slice(0, 30)
    setBpLogs(next); saveLogs(next)
    setSys(''); setDia('')
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center relief-backdrop animate-fade-in p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Floating ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="relief-particle"
            style={{
              left: `${(i * 5.5 + 2) % 100}%`,
              animationDuration: `${10 + (i % 5) * 3}s`,
              animationDelay: `${i * 0.4}s`,
              opacity: 0.4,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 dark:bg-ink-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-soft-xl animate-scale-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 dark:text-ink-300 dark:hover:text-white dark:hover:bg-ink-800/60 transition-all active:scale-95"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-5 text-center">
          <Pill variant="calm" icon={<Wind size={11} />} className="mx-auto">
            Pressure Relief
          </Pill>
          <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold text-ink-900 dark:text-white tracking-tight">
            Take a breath.
          </h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300 max-w-md mx-auto">
            A 1-5 minute calming session grounded in clinical breathing research.
            Helps lower acute sympathetic activation before a reading — or anytime.
          </p>
        </div>

        {/* Choose view */}
        {view === 'choose' && (
          <div className="px-6 sm:px-8 pb-8 space-y-6 animate-fade-up">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">
                Choose a technique
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TECHNIQUES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTechnique(t); setView('breathe') }}
                    className="group text-left p-4 rounded-2xl border border-ink-200/60 dark:border-ink-800 bg-white dark:bg-ink-900/60 hover:border-calm-500/60 hover:shadow-soft hover:-translate-y-[1px] transition-all duration-300 card-glow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-ink-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-calm-700 dark:text-calm-300 font-semibold mt-0.5">
                          {t.short}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-ink-400 group-hover:text-calm-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="mt-2 text-xs text-ink-500 dark:text-ink-400 leading-relaxed">
                      {t.whyItHelps}
                    </p>
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      Best for: {t.bestFor}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-ink-200/60 dark:border-ink-800 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">
                Quick actions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setView('bp')}
                  className="text-left p-4 rounded-2xl border border-ink-200/60 dark:border-ink-800 hover:border-brand-500/40 hover:shadow-soft transition-all card-glow"
                >
                  <Activity size={16} className="text-brand-500" />
                  <p className="mt-2 text-sm font-bold text-ink-900 dark:text-white">Log BP</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">Quick reading log</p>
                </button>
                <a
                  href="tel:999"
                  className="text-left p-4 rounded-2xl border border-ink-200/60 dark:border-ink-800 hover:border-rose-500/40 hover:shadow-soft transition-all card-glow block"
                >
                  <Phone size={16} className="text-rose-500" />
                  <p className="mt-2 text-sm font-bold text-ink-900 dark:text-white">Emergency</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">Call 999 / 911 / 112</p>
                </a>
                <a
                  href="https://www.nhs.uk/conditions/high-blood-pressure-hypertension/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left p-4 rounded-2xl border border-ink-200/60 dark:border-ink-800 hover:border-calm-500/40 hover:shadow-soft transition-all card-glow block"
                >
                  <Heart size={16} className="text-calm-500" />
                  <p className="mt-2 text-sm font-bold text-ink-900 dark:text-white">Read more</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">NHS hypertension guide</p>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Breathe view */}
        {view === 'breathe' && (
          <div className="px-6 sm:px-8 pb-8 space-y-6 animate-fade-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Now practicing</p>
                <p className="font-display text-lg font-bold text-ink-900 dark:text-white">
                  {technique.name}{' '}
                  <span className="text-calm-600 dark:text-calm-300 text-sm font-semibold ml-1">{technique.short}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSoundOn(!soundOn)}
                  className="p-2 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100 dark:text-ink-300 dark:hover:text-white dark:hover:bg-ink-800 transition-all active:scale-95"
                  title={soundOn ? 'Mute ambient sound' : 'Enable ambient sound'}
                >
                  {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  onClick={() => setView('choose')}
                  className="text-xs text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  ← Change technique
                </button>
              </div>
            </div>

            {/* The breath circle */}
            <div className="relative mx-auto" style={{ height: 320 }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <BreathCircle phase={phase} running={running} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="font-display text-2xl md:text-3xl font-bold text-white drop-shadow-lg tracking-tight">
                  {running ? phaseLabel(phase) : 'Ready?'}
                </p>
                {running && (
                  <p className="mt-1 font-display text-5xl font-bold text-white/90 tabular-nums drop-shadow-lg">
                    {Math.ceil(secondsLeft)}
                  </p>
                )}
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] font-semibold text-white/80">
                  {cycle} / {targetCycles} cycles
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {!running ? (
                <Button variant="calm" size="lg" onClick={start} icon={<Play size={16} />}>
                  {cycle > 0 ? 'Resume' : 'Begin'}
                </Button>
              ) : (
                <Button variant="calm" size="lg" onClick={stop} icon={<Pause size={16} />}>
                  Pause
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={() => { stop(); reset() }}
                icon={<RotateCcw size={16} />}
              >
                Reset
              </Button>
            </div>

            {/* Cycle target */}
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs text-ink-500 dark:text-ink-400">Cycles:</p>
              {[4, 6, 8, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => { setTargetCycles(n); if (cycle >= n) reset() }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95',
                    targetCycles === n
                      ? 'bg-calm-500 text-white shadow-soft'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="text-center max-w-lg mx-auto">
              <p className="text-xs text-ink-500 dark:text-ink-400 leading-relaxed">
                {technique.whyItHelps}
              </p>
            </div>
          </div>
        )}

        {/* BP log view */}
        {view === 'bp' && (
          <div className="px-6 sm:px-8 pb-8 space-y-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Quick log</p>
                <p className="font-display text-lg font-bold text-ink-900 dark:text-white">
                  Blood pressure reading
                </p>
              </div>
              <button
                onClick={() => setView('choose')}
                className="text-xs text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                ← Back
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">Systolic</label>
                <input
                  type="number"
                  value={sys}
                  onChange={(e) => setSys(e.target.value)}
                  placeholder="120"
                  className="input text-center text-2xl font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">Diastolic</label>
                <input
                  type="number"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  placeholder="80"
                  className="input text-center text-2xl font-bold tabular-nums"
                />
              </div>
            </div>

            {sys && dia && (
              <BpInterpretation sys={Number(sys)} dia={Number(dia)} />
            )}

            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={logBP}
              disabled={!sys || !dia}
              icon={<Check size={16} />}
            >
              Save reading
            </Button>

            {bpLogs.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">
                  Recent readings
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scroll-premium">
                  {bpLogs.slice(0, 8).map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-ink-200/60 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700 transition-colors card-glow"
                    >
                      <div>
                        <p className="font-display text-base font-bold text-ink-900 dark:text-white tabular-nums">
                          {l.systolic}<span className="text-ink-400">/</span>{l.diastolic}
                          <span className="ml-2 text-xs text-ink-500 dark:text-ink-400">mmHg</span>
                        </p>
                        <p className="text-[11px] text-ink-400 mt-0.5">
                          {new Date(l.at).toLocaleString()}
                        </p>
                      </div>
                      <BpCategoryPill sys={l.systolic} dia={l.diastolic} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer note */}
        <div className="px-8 py-4 border-t border-ink-200/40 dark:border-ink-800/60 flex items-center justify-between text-[11px] text-ink-500 dark:text-ink-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-calm-500" /> For wellness only · not a medical device
          </span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function phaseLabel(p: Phase): string {
  switch (p) {
    case 'inhale': return 'Breathe in'
    case 'hold1':  return 'Hold'
    case 'exhale': return 'Breathe out'
    case 'hold2':  return 'Rest'
    default:       return 'Ready'
  }
}

function BreathCircle({ phase, running }: { phase: Phase; running: boolean }) {
  const scale =
    !running ? 0.7 :
    phase === 'inhale' ? 1.2 :
    phase === 'hold1'  ? 1.2 :
    phase === 'exhale' ? 0.7 :
    phase === 'hold2'  ? 0.7 : 0.7

  const glowIntensity = !running ? '0 0 40px rgba(0,200,200,0.15)' :
    phase === 'inhale' ? '0 0 100px rgba(0,200,200,0.45)' :
    phase === 'hold1' ? '0 0 100px rgba(0,200,200,0.45)' :
    '0 0 60px rgba(0,200,200,0.25)'

  return (
    <>
      <div
        className="rounded-full transition-all ease-smooth"
        style={{
          width: 260, height: 260,
          transform: `scale(${scale})`,
          transitionDuration: phase === 'inhale' ? '4000ms' : phase === 'exhale' ? '8000ms' : '7000ms',
          background: 'radial-gradient(circle at 50% 50%, rgba(120,230,230,0.65) 0%, rgba(0,180,180,0.35) 50%, transparent 80%)',
          boxShadow: `${glowIntensity}, inset 0 0 60px rgba(0,200,200,0.2)`,
        }}
      />
      {running && (
        <>
          <div className="absolute w-[260px] h-[260px] rounded-full border border-calm-300/40 animate-ring-pulse" />
          <div className="absolute w-[260px] h-[260px] rounded-full border border-calm-300/30 animate-ring-pulse" style={{ animationDelay: '1.1s' }} />
        </>
      )}
    </>
  )
}

function BpInterpretation({ sys, dia }: { sys: number; dia: number }) {
  const cat = bpCategory(sys, dia)
  return (
    <div className={cn(
      'p-4 rounded-2xl border',
      cat.tone === 'calm'  && 'bg-calm-50 dark:bg-calm-500/10 border-calm-200 dark:border-calm-500/30',
      cat.tone === 'okf'   && 'bg-okf-50 dark:bg-okf-500/10 border-okf-200 dark:border-okf-500/30',
      cat.tone === 'brand' && 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30',
      cat.tone === 'danger' && 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
    )}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Reading interpretation</p>
      <p className="mt-1.5 text-sm font-bold text-ink-900 dark:text-white">{cat.label}</p>
      <p className="mt-1 text-xs text-ink-600 dark:text-ink-300 leading-relaxed">{cat.desc}</p>
    </div>
  )
}

function BpCategoryPill({ sys, dia }: { sys: number; dia: number }) {
  const c = bpCategory(sys, dia)
  const toneMap = {
    calm: 'pill-calm',
    okf: 'pill-okf',
    brand: 'pill-brand',
    danger: 'pill-danger',
  } as const
  return <span className={toneMap[c.tone]}>{c.label}</span>
}

function bpCategory(sys: number, dia: number): { label: string; desc: string; tone: 'calm' | 'okf' | 'brand' | 'danger' } {
  if (sys >= 180 || dia >= 120) {
    return {
      label: 'Hypertensive crisis',
      desc: 'This is a hypertensive crisis. Wait 1-2 minutes and re-check. If still this high with chest pain, vision changes, or shortness of breath, call emergency services now.',
      tone: 'danger',
    }
  }
  if (sys >= 140 || dia >= 90) {
    return {
      label: 'Stage 2 hypertension',
      desc: 'Per NICE NG136 / ACC-AHA, this is Stage 2. Rest for 5 minutes, re-check, and follow up with your clinician. Lifestyle changes plus medication are usually indicated.',
      tone: 'brand',
    }
  }
  if (sys >= 130 || dia >= 80) {
    return {
      label: 'Stage 1 / Elevated',
      desc: 'Lifestyle modification is the first-line recommendation. Re-check in a week and consider a clinician visit if it persists.',
      tone: 'okf',
    }
  }
  if (sys < 90 || dia < 60) {
    return {
      label: 'Low',
      desc: 'Reading is on the low side. If you feel dizzy or faint, sit down, hydrate, and re-check. Otherwise this can be normal for you.',
      tone: 'okf',
    }
  }
  return {
    label: 'Normal',
    desc: 'Within the normal range per most guidelines. Continue your current routine and re-check periodically.',
    tone: 'calm',
  }
}
