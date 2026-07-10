import { useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Stethoscope, Heart, Activity, Shield, Brain } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

const API_BASE = ''

const FEATURES = [
  { icon: Heart, text: 'Evidence-based guidelines', color: 'text-rose-600' },
  { icon: Activity, text: 'Hypertension management', color: 'text-emerald-600' },
  { icon: Shield, text: 'Safety-first AI', color: 'text-brand-accent' },
  { icon: Brain, text: 'RAG + OKF retrieval', color: 'text-violet-600' },
]

interface SignupPageProps {
  onSignup: (token: string) => Promise<void>
  onSwitchToLogin: () => void
}

export default function SignupPage({ onSignup, onSwitchToLogin }: SignupPageProps) {
  const { theme } = useTheme()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<'patient' | 'clinician'>('patient')

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    match: password && confirmPassword && password === confirmPassword,
  }

  const strength = Object.values(passwordChecks).filter(Boolean).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][strength]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Registration failed')
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
    <div className="min-h-screen flex bg-background text-on-surface font-body-md">
      {/* Left - Brand Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-container-low border-r-4 border-clinical-black bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:24px_24px] [background-position:center] justify-center items-center">
        <div className="relative flex flex-col justify-center px-16 py-16 w-full max-w-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 border-2 border-clinical-black bg-brand-accent flex items-center justify-center text-white neo-brutal-shadow-sm font-bold">
              <Stethoscope size={22} className="text-white" />
            </div>
            <span className="text-clinical-black font-headline-md text-headline-md font-bold tracking-tight uppercase">Clinical Workflows</span>
          </div>
          
          <h1 className="font-headline-xl text-[48px] font-black text-clinical-black leading-tight uppercase mb-6">
            Start Your<br />Clinical Journey
          </h1>
          
          <p className="font-body-md text-headline-md text-on-surface-variant leading-relaxed mb-12 border-l-4 border-outline-variant pl-6">
            Create an account to access the precision clinical hybrid retrieval engine with grounded guidelines.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-white border-2 border-clinical-black neo-brutal-shadow-sm">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <f.icon size={20} className={f.color} />
                </div>
                <span className="text-clinical-black font-bold text-xs uppercase tracking-wide">{f.text}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-16">
            <p className="text-on-surface-variant font-code-sm text-[10px] uppercase font-bold">For educational purposes only. Not for clinical use.</p>
          </div>
        </div>
      </div>

      {/* Right - Form Side */}
      <div className="flex-grow flex flex-col justify-center items-center p-8 bg-white overflow-y-auto">
        <div className="absolute top-4 right-4 flex items-center justify-end gap-3">
          <span className="text-xs text-clinical-black font-code-sm font-bold uppercase">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
          <div className="border-2 border-clinical-black p-0.5 bg-white">
            <ThemeToggle />
          </div>
        </div>

        <div className="w-full max-w-md border-4 border-clinical-black p-8 bg-white my-8 neo-brutal-shadow">
          <div className="mb-6">
            <h2 className="font-headline-xl text-headline-xl font-black text-clinical-black uppercase">Create Account</h2>
            <p className="text-on-surface-variant text-xs font-bold font-code-sm uppercase mt-1">Get started with a custom clinical account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1.5">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`py-2 px-3 border-2 border-clinical-black font-code-sm font-bold uppercase text-xs transition-all ${
                    role === 'patient'
                      ? 'bg-brand-accent text-white neo-brutal-shadow-sm'
                      : 'bg-white text-clinical-black'
                  }`}
                >
                  Patient
                </button>
                <button
                  type="button"
                  onClick={() => setRole('clinician')}
                  className={`py-2 px-3 border-2 border-clinical-black font-code-sm font-bold uppercase text-xs transition-all ${
                    role === 'clinician'
                      ? 'bg-brand-accent text-white neo-brutal-shadow-sm'
                      : 'bg-white text-clinical-black'
                  }`}
                >
                  Clinician
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                placeholder="Choose a username"
                className="w-full px-4 py-2.5 bg-white border-2 border-clinical-black text-clinical-black placeholder-clinical-black/40 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full px-4 py-2.5 bg-white border-2 border-clinical-black text-clinical-black placeholder-clinical-black/40 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Create a password"
                  className="w-full px-4 py-2.5 pr-12 bg-white border-2 border-clinical-black text-clinical-black placeholder-clinical-black/40 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-black/60 hover:text-clinical-black transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat your password"
                  className="w-full px-4 py-2.5 pr-12 bg-white border-2 border-clinical-black text-clinical-black placeholder-clinical-black/40 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-black/60 hover:text-clinical-black transition-colors"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {password && (
              <div className="p-3 bg-stone-50 border-2 border-clinical-black space-y-2">
                <div className="flex items-center justify-between text-xs font-bold font-code-sm uppercase">
                  <span>Strength: {strengthLabel}</span>
                  <div className="w-24 h-2 bg-stone-200 border border-clinical-black flex">
                    <div className={`h-full ${strengthColor}`} style={{ width: `${(strength / 5) * 100}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-code-sm uppercase font-bold text-clinical-black/70">
                  <div className="flex items-center gap-1">
                    {passwordChecks.length ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black" />}
                    <span>Min 8 chars</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordChecks.upper ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black" />}
                    <span>1 Upper</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordChecks.lower ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black" />}
                    <span>1 Lower</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {passwordChecks.number ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black" />}
                    <span>1 Number</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border-2 border-rose-500 text-rose-700 font-bold text-xs uppercase animate-fade-in-up">
                <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-brand-accent text-white font-headline-md border-2 border-clinical-black neo-brutal-shadow neo-brutal-btn uppercase font-bold tracking-wider hover:bg-brand-accent/90 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Registering&hellip;</>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-bold text-on-surface-variant font-code-sm uppercase">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="font-bold text-brand-accent hover:underline hover:text-brand-accent/80 transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
