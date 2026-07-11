import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, ArrowRight, Stethoscope, ShieldCheck, Check } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { Button, Pill } from './ui/primitives'

const API_BASE = ''

const PERKS = [
  { title: 'Cited, never guessed', desc: 'Every answer is linked to a guideline source.' },
  { title: 'Safety-first routing', desc: 'Diagnosis, dosing, and emergency triage are refused upstream.' },
  { title: 'Calm by design', desc: 'Pressure Relief mode built in for stressful moments.' },
]

interface LoginPageProps {
  onLogin: (token: string) => Promise<void>
  onSwitchToSignup: () => void
  onBackToHome?: () => void
}

export default function LoginPage({ onLogin, onSwitchToSignup, onBackToHome }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
      })
      if (!res.ok) {
        let detail = 'Invalid username or password'
        try {
          const err = await res.json()
          detail = err.detail || detail
        } catch {
          detail = `Login failed: HTTP ${res.status}`
        }
        throw new Error(detail)
      }
      const data = await res.json()
      if (rememberMe) localStorage.setItem('cw_token', data.access_token)
      else sessionStorage.setItem('cw_token', data.access_token)
      await onLogin(data.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-white font-sans">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-ink-900" />
        <div className="absolute inset-0 bg-mesh-brand opacity-50" />
        <div className="absolute inset-0 bg-grid-soft-dark [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_60%)] opacity-30" />

        <div className="relative z-10 flex flex-col justify-between px-12 py-12 w-full">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2.5 group w-fit"
          >
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20 group-hover:bg-white/25 transition-all">
              <Stethoscope size={18} className="text-white" />
            </div>
            <span className="font-display text-base font-bold text-white tracking-tight">
              CardioCompass
            </span>
          </button>

          <div className="space-y-8 max-w-md">
            <div>
              <Pill variant="calm" icon={<ShieldCheck size={11} />} className="!bg-white/15 !text-white !border-white/30">
                Educational use · Not a substitute for clinical care
              </Pill>
              <h1 className="mt-5 font-display text-4xl xl:text-5xl font-bold text-white leading-[1.05] tracking-tight">
                Welcome back to calmer,
                <br />
                <span className="text-white/80">more confident care.</span>
              </h1>
              <p className="mt-4 text-white/80 leading-relaxed">
                Sign in to continue asking hypertension questions with cited, validated answers.
              </p>
            </div>

            <div className="space-y-3">
              {PERKS.map((p) => (
                <div key={p.title} className="flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-4">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <Check size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-white/70 mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/60">
            CardioCompass · Built on OKF + RAG hybrid retrieval.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between p-6 lg:p-8">
          <button
            onClick={onBackToHome}
            className="text-sm text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white transition-colors"
          >
            ← Back home
          </button>
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <div className="inline-flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Stethoscope size={16} className="text-white" />
                </div>
                <span className="font-display text-base font-bold text-ink-900 dark:text-white">CardioCompass</span>
              </div>
            </div>

            <h2 className="font-display text-2xl md:text-3xl font-bold text-ink-900 dark:text-white tracking-tight">
              Sign in
            </h2>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Continue your conversation with cited, grounded answers.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter your username"
                  className="input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-ink-700 dark:text-ink-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink-400 hover:text-ink-700 dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 dark:border-ink-600 dark:bg-ink-900"
                />
                <span className="text-sm text-ink-600 dark:text-ink-300">Keep me signed in</span>
              </label>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 animate-fade-up">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                iconRight={!isLoading && <ArrowRight size={16} />}
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-brand-500 hover:text-brand-600 font-semibold transition-colors"
              >
                Create one
              </button>
            </p>

            <div className="mt-6 p-3.5 rounded-xl bg-ink-50 dark:bg-ink-900/50 border border-ink-200/60 dark:border-ink-800">
              <p className="text-xs text-ink-500 dark:text-ink-400 text-center">
                Demo · register any username/email/password to get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
