import { useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Stethoscope, Heart, Activity, Shield, Brain } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

const API_BASE = ''

const FEATURES = [
  { icon: Heart, text: 'Evidence-based guidelines', color: 'text-rose-600 dark:text-rose-400' },
  { icon: Activity, text: 'Hypertension management', color: 'text-emerald-600 dark:text-emerald-400' },
  { icon: Shield, text: 'Safety-first AI', color: 'text-brand-accent' },
  { icon: Brain, text: 'RAG + OKF retrieval', color: 'text-violet-600 dark:text-violet-400' },
]

interface UserProfile {
  id: string
  username: string
  email: string
  full_name?: string
  date_of_birth?: string
  notes?: string
  roles?: string[]
}

interface SignupPageProps {
  onSignup: (token: string) => Promise<void>
  onSwitchToLogin: () => void
  onBackToHome?: () => void
  currentUser?: UserProfile | null
  onShowProfile?: () => void
  onGoToDashboard?: () => void
  onLogout?: () => void
}

export default function SignupPage({ 
  onSignup, 
  onSwitchToLogin, 
  onBackToHome, 
  currentUser, 
  onShowProfile, 
  onGoToDashboard, 
  onLogout 
}: SignupPageProps) {
  const { theme } = useTheme()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<'patient' | 'clinician' | 'admin' | 'care_coordinator'>('patient')

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
        let detail = 'Registration failed'
        try {
          const err = await res.json()
          detail = err.detail || detail
        } catch {
          detail = `Registration failed: HTTP ${res.status} ${res.statusText || ''}`
        }
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
    <div className="min-h-screen flex bg-white dark:bg-slate-950 text-clinical-black dark:text-white font-body-md transition-colors duration-300">
      {/* Left - Brand Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-container-low dark:bg-slate-900 border-r-4 border-clinical-black dark:border-slate-800 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_0.75px,transparent_0.75px)] [background-size:24px_24px] [background-position:center] justify-center items-center transition-colors duration-300">
        <div className="relative flex flex-col justify-center px-16 py-16 w-full max-w-xl">
          <button 
            onClick={onBackToHome}
            className="group flex items-center gap-4 mb-8 text-left focus:outline-none w-fit transition-all duration-150"
          >
            <div className="w-12 h-12 border-2 border-clinical-black dark:border-white bg-brand-accent flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all duration-150 font-bold">
              <Stethoscope size={22} className="text-white transition-transform group-hover:rotate-[15deg]" />
            </div>
            <span className="text-clinical-black dark:text-white group-hover:text-brand-accent transition-colors font-headline-md text-headline-md font-bold tracking-tight uppercase">Clinical Workflows</span>
          </button>
          
          <h1 className="font-headline-xl text-[48px] font-black text-clinical-black dark:text-white leading-tight uppercase mb-6">
            Start Your<br />Clinical Journey
          </h1>
          
          <p className="font-body-md text-headline-md text-on-surface-variant dark:text-slate-400 leading-relaxed mb-12 border-l-4 border-outline-variant dark:border-slate-700 pl-6 hover:border-brand-accent dark:hover:border-brand-accent hover:text-clinical-black dark:hover:text-white transition-all duration-300">
            Create an account to access the precision clinical hybrid retrieval engine with grounded guidelines.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="group/item flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,51,102,1)] hover:border-brand-accent dark:hover:border-brand-accent transition-all duration-200 cursor-pointer">
                <div className="w-8 h-8 flex items-center justify-center shrink-0 group-hover/item:scale-110 transition-transform">
                  <f.icon size={20} className={f.color} />
                </div>
                <span className="text-clinical-black dark:text-white font-bold text-xs uppercase tracking-wide group-hover/item:text-brand-accent transition-colors">{f.text}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-16">
            <p className="text-on-surface-variant dark:text-slate-500 font-code-sm text-[10px] uppercase font-bold">For educational purposes only. Not for clinical use.</p>
          </div>
        </div>
      </div>

      {/* Right - Form Side */}
      <div className="flex-grow flex flex-col justify-center items-center p-8 bg-white dark:bg-slate-950 overflow-y-auto transition-colors duration-300 relative pt-20">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white text-xs font-bold font-code-sm uppercase shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none transition-all"
          >
            ← Back to Home
          </button>
          <div className="flex items-center gap-3">
            {currentUser && (
              <button
                onClick={onShowProfile}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-accent text-white border-2 border-clinical-black dark:border-white text-xs font-bold font-code-sm uppercase shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none transition-all mr-2"
              >
                Profile
              </button>
            )}
            <span className="text-xs text-clinical-black dark:text-white font-code-sm font-bold uppercase select-none">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="w-full max-w-md border-4 border-clinical-black dark:border-white p-8 bg-white dark:bg-slate-900 my-8 neo-brutal-shadow dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] transition-colors duration-300">
          {currentUser ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 border-2 border-clinical-black dark:border-white bg-brand-accent flex items-center justify-center text-white mx-auto shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] font-bold">
                <Stethoscope size={30} className="text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="font-headline-xl text-headline-xl font-black uppercase text-clinical-black dark:text-white">
                  Already Signed In
                </h3>
                <p className="text-sm font-bold text-on-surface-variant dark:text-slate-400 font-code-sm uppercase">
                  You are logged in as <span className="text-brand-accent">{currentUser.username}</span>
                </p>
              </div>
              <div className="flex flex-col gap-4 pt-2">
                <button
                  onClick={onGoToDashboard}
                  className="w-full py-4 bg-clinical-black dark:bg-brand-accent text-white font-headline-md border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-clinical-black/90 dark:hover:bg-brand-accent/90 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 uppercase font-bold tracking-wide"
                >
                  Return to Dashboard
                </button>
                <button
                  onClick={onShowProfile}
                  className="w-full py-4 bg-white dark:bg-slate-900 text-clinical-black dark:text-white border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-855 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 uppercase font-bold tracking-wide"
                >
                  Open Profile
                </button>
                <button
                  onClick={onLogout}
                  className="w-full py-2.5 text-xs text-rose-500 hover:text-rose-600 font-bold font-code-sm uppercase tracking-wider transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-headline-xl text-headline-xl font-black text-clinical-black dark:text-white uppercase">Create Account</h2>
                <p className="text-on-surface-variant dark:text-slate-400 text-xs font-bold font-code-sm uppercase mt-1">Get started with a custom clinical account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black dark:text-white mb-1.5">
                    Account Scope / Role
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-clinical-black dark:text-white text-xs font-bold font-code-sm uppercase rounded-none focus:outline-none focus:border-brand-accent focus:ring-0"
                  >
                    <option value="patient">Patient (Normal User)</option>
                    <option value="clinician">Clinician (Medical Staff)</option>
                    <option value="admin">Administrator (System Control)</option>
                    <option value="care_coordinator">Care Coordinator (Operations)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black dark:text-white mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    placeholder="Choose a username"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-clinical-black dark:text-white placeholder-clinical-black/40 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black dark:text-white mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-clinical-black dark:text-white placeholder-clinical-black/40 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black dark:text-white mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Create a password"
                      className="w-full px-4 py-2.5 pr-12 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-clinical-black dark:text-white placeholder-clinical-black/40 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-black/60 dark:text-slate-400 hover:text-clinical-black dark:hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-label-md font-bold uppercase tracking-wider text-clinical-black dark:text-white mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat your password"
                      className="w-full px-4 py-2.5 pr-12 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-clinical-black dark:text-white placeholder-clinical-black/40 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-brand-accent font-code-sm font-bold rounded-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-black/60 dark:text-slate-400 hover:text-clinical-black dark:hover:text-white transition-colors"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {password && (
                  <div className="p-3 bg-stone-50 dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold font-code-sm uppercase">
                      <span>Strength: {strengthLabel}</span>
                      <div className="w-24 h-2 bg-stone-200 dark:bg-slate-800 border border-clinical-black dark:border-slate-700 flex">
                        <div className={`h-full ${strengthColor}`} style={{ width: `${(strength / 5) * 100}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-code-sm uppercase font-bold text-clinical-black/70 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        {passwordChecks.length ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black dark:border-slate-700" />}
                        <span>Min 8 chars</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {passwordChecks.upper ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black dark:border-slate-700" />}
                        <span>1 Upper</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {passwordChecks.lower ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black dark:border-slate-700" />}
                        <span>1 Lower</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {passwordChecks.number ? <CheckCircle2 size={10} className="text-emerald-600" /> : <div className="w-2 h-2 border border-clinical-black dark:border-slate-700" />}
                        <span>1 Number</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-955/30 border-2 border-rose-500 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase animate-fade-in-up">
                    <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-brand-accent text-white font-headline-md border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-brand-accent/90 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={16} className="animate-spin" /> Registering&hellip;</>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs font-bold text-on-surface-variant dark:text-slate-400 font-code-sm uppercase">
                Already have an account?{' '}
                <button
                  onClick={onSwitchToLogin}
                  className="font-bold text-brand-accent hover:underline hover:text-brand-accent/80 transition-colors"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
