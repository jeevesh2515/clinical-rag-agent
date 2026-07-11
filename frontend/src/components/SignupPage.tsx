import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, ArrowRight, Stethoscope, Check } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { Button, cn } from './ui/primitives'

const API_BASE = ''

interface SignupPageProps {
  onSignup: (token: string) => Promise<void>
  onSwitchToLogin: () => void
  onBackToHome?: () => void
}

const ROLES = [
  { id: 'patient',           label: 'Patient',          desc: 'Personal questions and guidance' },
  { id: 'clinician',         label: 'Clinician',        desc: 'Care-team summaries and citations' },
  { id: 'care_coordinator',  label: 'Care coordinator', desc: 'Operations and follow-ups' },
  { id: 'admin',             label: 'Admin',            desc: 'System and audit control' },
] as const

export default function SignupPage({ onSignup, onSwitchToLogin, onBackToHome }: SignupPageProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<typeof ROLES[number]['id']>('patient')

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    match: password && confirmPassword && password === confirmPassword,
  }
  const strength = Object.values(passwordChecks).filter(Boolean).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role }),
      })
      if (!res.ok) {
        let detail = 'Registration failed'
        try { const err = await res.json(); detail = err.detail || detail } catch { /* */ }
        throw new Error(detail)
      }
      const loginRes = await fetch(`${API_BASE}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
      })
      if (!loginRes.ok) throw new Error('Account created but sign-in failed. Please try logging in.')
      const data = await loginRes.json()
      localStorage.setItem('cw_token', data.access_token)
      await onSignup(data.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-white font-sans">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-calm-500 via-calm-600 to-ink-900" />
        <div className="absolute inset-0 bg-mesh-brand opacity-50" />
        <div className="absolute inset-0 bg-grid-soft-dark [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_60%)] opacity-30" />

        <div className="relative z-10 flex flex-col justify-between px-12 py-12 w-full">
          <button onClick={onBackToHome} className="flex items-center gap-2.5 group w-fit">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20 group-hover:bg-white/25 transition-all">
              <Stethoscope size={18} className="text-white" />
            </div>
            <span className="font-display text-base font-bold text-white tracking-tight">CardioCompass</span>
          </button>

          <div className="space-y-8 max-w-md">
            <div>
              <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-[1.05] tracking-tight">
                Start your
                <br />
                <span className="text-white/80">clinical journey.</span>
              </h1>
              <p className="mt-4 text-white/80 leading-relaxed">
                Create an account to access grounded hypertension answers with citations you can verify.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                'Cited answers, no hallucinated doses',
                'OKF + RAG hybrid retrieval',
                'Pressure Relief mode for acute stress',
                'Personal documents and case context',
              ].map((b) => (
                <div key={b} className="flex items-center gap-3 text-white/85">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                  <span className="text-sm">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/60">Educational use only · Not a substitute for clinical care.</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col overflow-y-auto">
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
            <h2 className="font-display text-2xl md:text-3xl font-bold text-ink-900 dark:text-white tracking-tight">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Free during the open beta. Educational use only.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {/* Role selector */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-2">
                  I am a&hellip;
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const selected = r.id === role
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setRole(r.id)}
                        className={cn(
                          'text-left p-3 rounded-xl border transition-all duration-200',
                          selected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500/50'
                            : 'border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900/50'
                        )}
                      >
                        <p className={cn('text-sm font-semibold', selected ? 'text-brand-700 dark:text-brand-300' : 'text-ink-900 dark:text-white')}>
                          {r.label}
                        </p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">{r.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Choose a username"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
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
                {password && (
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          strength >= i * 1.25
                            ? strength >= 4
                              ? 'bg-emerald-500'
                              : strength >= 3
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                            : 'bg-ink-200 dark:bg-ink-800'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-300 mb-1.5">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat your password"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink-400 hover:text-ink-700 dark:hover:text-white transition-colors"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

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
                {isLoading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-brand-500 hover:text-brand-600 font-semibold transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
