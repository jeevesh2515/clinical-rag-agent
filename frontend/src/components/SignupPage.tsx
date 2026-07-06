import { useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Stethoscope, Heart, Activity, Shield, Brain } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

const API_BASE = ''

const FEATURES = [
  { icon: Heart, text: 'Evidence-based guidelines', color: 'text-rose-400' },
  { icon: Activity, text: 'Hypertension management', color: 'text-emerald-400' },
  { icon: Shield, text: 'Safety-first AI', color: 'text-blue-400' },
  { icon: Brain, text: 'RAG + OKF retrieval', color: 'text-violet-400' },
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
        body: JSON.stringify({ username, email, password }),
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
    <div className="min-h-screen flex">
      {/* Left - Brand Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-breath" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl animate-float" />
        </div>
        <div className="relative flex flex-col justify-center px-16 py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Stethoscope size={22} className="text-white" />
            </div>
            <span className="text-white text-xl font-bold tracking-tight">Clinical Workflows</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Start Your<br />Clinical Journey
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-12 max-w-md">
            Create an account to access evidence-based hypertension management tools.
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
        <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
          <div className="w-full max-w-sm py-8">
            {/* Mobile logo */}
            <div className="lg:hidden flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 shadow-lg shadow-blue-500/20 flex items-center justify-center mb-3">
                <Stethoscope size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Clinical Workflows</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create your account</p>
            </div>

            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create an account</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Get started with your free account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
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
                    minLength={8}
                    placeholder="Create a strong password"
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
                {password && (
                  <div className="mt-2 space-y-1.5 animate-fade-in-up">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= strength ? strengthColor : 'bg-gray-200 dark:bg-gray-700'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${strength >= 4 ? 'text-emerald-500' : strength >= 2 ? 'text-amber-500' : 'text-red-500'}`}>
                      {strengthLabel}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <CheckItem ok={passwordChecks.length} text="8+ characters" />
                      <CheckItem ok={passwordChecks.upper} text="Uppercase" />
                      <CheckItem ok={passwordChecks.lower} text="Lowercase" />
                      <CheckItem ok={passwordChecks.number} text="Number" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat your password"
                    className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-1.5 mt-1.5 animate-fade-in-up">
                    {password === confirmPassword ? (
                      <><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-xs text-emerald-500">Passwords match</span></>
                    ) : (
                      <><AlertCircle size={12} className="text-red-500" /><span className="text-xs text-red-500">Passwords do not match</span></>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl animate-fade-in-up">
                  <AlertCircle size={15} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || (password !== confirmPassword && confirmPassword.length > 0)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating account&hellip;</>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
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

function CheckItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1 ${ok ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
      {ok ? <CheckCircle2 size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-current" />}
      <span className="text-xs">{text}</span>
    </div>
  )
}
