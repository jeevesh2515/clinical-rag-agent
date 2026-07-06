import { useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, Stethoscope, Heart, Activity, Shield, Brain } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

const API_BASE = ''

const FEATURES = [
  { icon: Heart, text: 'Evidence-based guidelines', color: 'text-rose-400' },
  { icon: Activity, text: 'Hypertension management', color: 'text-emerald-400' },
  { icon: Shield, text: 'Safety-first AI', color: 'text-blue-400' },
  { icon: Brain, text: 'RAG + OKF retrieval', color: 'text-violet-400' },
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
    <div className="min-h-screen flex">
      {/* Left - Brand Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-breath" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl animate-float" />
        </div>
        <div className="relative flex flex-col justify-center px-16 py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Stethoscope size={22} className="text-white" />
            </div>
            <span className="text-white text-xl font-bold tracking-tight">Clinical Workflows</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Evidence-Based<br />Care Planning
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-12 max-w-md">
            Hybrid retrieval, grounded citations, and safety-first AI for hypertension management.
          </p>
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <f.icon size={16} className={f.color} />
                </div>
                <span className="text-blue-100 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-16">
            <p className="text-blue-300/60 text-xs">For educational purposes only. Not for clinical use.</p>
          </div>
        </div>
      </div>

      {/* Right - Form Side */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 shadow-lg shadow-blue-500/20 flex items-center justify-center mb-3">
                <Stethoscope size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Clinical Workflows</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to your account</p>
            </div>

            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome back</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500/50"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                </label>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl animate-fade-in-up">
                  <AlertCircle size={15} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Signing in&hellip;</>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
              >
                Create one
              </button>
            </p>

            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-600 dark:text-blue-300 text-center">
                Demo: Register with any username/email/password to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


