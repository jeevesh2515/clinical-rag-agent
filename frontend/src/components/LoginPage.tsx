import { useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, Stethoscope, Heart, Activity, Shield, Brain } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

const API_BASE = ''

const FEATURES = [
  { icon: Heart, text: 'Evidence-based guidelines', color: 'text-rose-600' },
  { icon: Activity, text: 'Hypertension management', color: 'text-emerald-600' },
  { icon: Shield, text: 'Safety-first AI', color: 'text-brand-accent' },
  { icon: Brain, text: 'RAG + OKF retrieval', color: 'text-violet-600' },
]

interface LoginPageProps {
  onLogin: (token: string) => Promise<void>
  onSwitchToSignup: () => void
}

export default function LoginPage({ onLogin, onSwitchToSignup }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const { theme } = useTheme()

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
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Invalid username or password')
      }
      const data = await res.json()
      if (rememberMe) {
        localStorage.setItem('cw_token', data.access_token)
      } else {
        sessionStorage.setItem('cw_token', data.access_token)
      }
      await onLogin(data.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
            Evidence-Based<br />Care Planning
          </h1>
          
          <p className="font-body-md text-headline-md text-on-surface-variant leading-relaxed mb-12 border-l-4 border-outline-variant pl-6">
            Hybrid retrieval, grounded citations, and safety-first AI for hypertension management.
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
      <div className="flex-grow flex flex-col justify-center items-center p-8 bg-white">
        <div className="absolute top-4 right-4 flex items-center justify-end gap-3 z-20">
          <span className="text-xs text-clinical-black font-code-sm font-bold uppercase select-none">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md border-4 border-clinical-black p-8 bg-white neo-brutal-shadow">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-12 h-12 border-2 border-clinical-black bg-brand-accent flex items-center justify-center text-white mb-3">
              <Stethoscope size={22} className="text-white" />
            </div>
            <h1 className="font-headline-md text-headline-lg font-black text-clinical-black uppercase">Clinical Workflows</h1>
            <p className="text-on-surface-variant text-xs font-bold font-code-sm uppercase mt-1">Sign in to your account</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="font-headline-xl text-headline-xl font-black text-clinical-black uppercase">Welcome back</h2>
            <p className="text-on-surface-variant text-xs font-bold font-code-sm uppercase mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-white border-2 border-clinical-black text-clinical-black placeholder-clinical-black/40 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 bg-white border-2 border-clinical-black text-clinical-black placeholder-clinical-black/40 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-none border-2 border-clinical-black text-brand-accent focus:ring-0"
                />
                <span className="text-xs font-bold text-clinical-black uppercase font-code-sm">Remember me</span>
              </label>
            </div>

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
                <><Loader2 size={16} className="animate-spin" /> Signing in&hellip;</>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-bold text-on-surface-variant font-code-sm uppercase">
            Don&apos;t have an account?{' '}
            <button
              onClick={onSwitchToSignup}
              className="font-bold text-brand-accent hover:underline hover:text-brand-accent/80 transition-colors"
            >
              Create one
            </button>
          </p>

          <div className="mt-6 p-3 bg-white border-2 border-clinical-black text-xs font-bold font-code-sm text-center">
            <p className="text-clinical-black">
              Demo: Register with any username/email/password to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
