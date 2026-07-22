import { useEffect, useState, useRef } from 'react'
import { Stethoscope } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
  currentUser?: any
  onGoToDashboard?: () => void
  onShowProfile?: () => void
}

function AnimatedCounter({ 
  target, 
  duration = 1500, 
  decimals = 0, 
  prefix = '', 
  suffix = '',
  startValue = 0
}: { 
  target: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  startValue?: number
}) {
  const [count, setCount] = useState(startValue)
  const elementRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true
        let startTimestamp: number | null = null
        const step = (timestamp: number) => {
          if (!startTimestamp) startTimestamp = timestamp
          const progress = Math.min((timestamp - startTimestamp) / duration, 1)
          const easeProgress = 1 - Math.pow(1 - progress, 3) // Cubic ease-out
          setCount(startValue + easeProgress * (target - startValue))
          if (progress < 1) {
            window.requestAnimationFrame(step)
          }
        }
        window.requestAnimationFrame(step)
      }
    }, { threshold: 0.1 })

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [target, duration, startValue])

  return (
    <div ref={elementRef} className="font-headline-xl text-[72px] font-black leading-none">
      {prefix}{count.toFixed(decimals)}{suffix}
    </div>
  )
}

export default function LandingPage({ onLogin, onRegister, currentUser, onGoToDashboard, onShowProfile }: LandingPageProps) {
  const [activeSection, setActiveSection] = useState('hero')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)

  // Track scroll position for progress bar and scroll-driven animation tickers
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      
      setScrollProgress(progress)
      setScrollOffset(scrollTop)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scrollspy to sync navbar links with components
  useEffect(() => {
    const handleScrollspy = () => {
      const sections = ['hero', 'retrieval', 'safety', 'provenance', 'demo']
      const scrollPosition = window.scrollY + 140 // offset for navbar height + buffer

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const top = element.offsetTop
          const height = element.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScrollspy)
    handleScrollspy()
    return () => window.removeEventListener('scroll', handleScrollspy)
  }, [])


  // Scroll-Linked Animations (Smooth Direct-Scroll coupled transitions)
  useEffect(() => {
    const handleScrollAnimation = () => {
      const revealElements = document.querySelectorAll(
        '.reveal-on-scroll, .reveal-left, .reveal-right, .reveal-bottom'
      )
      const viewportHeight = window.innerHeight

      revealElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        const rect = htmlEl.getBoundingClientRect()
        const elementTop = rect.top
        
        // startReveal: element enters the bottom of the viewport
        const startReveal = viewportHeight
        // endReveal: element is 50% into the viewport from the bottom (middle of screen)
        const endReveal = viewportHeight * 0.50
        
        let progress = 0
        if (elementTop < startReveal) {
          progress = (startReveal - elementTop) / (startReveal - endReveal)
          progress = Math.max(0, Math.min(1, progress))
        }

        // Apply smooth linear mapping
        const easeProgress = progress

        htmlEl.style.transition = 'none'
        htmlEl.style.opacity = `${easeProgress}`
        
        if (htmlEl.classList.contains('reveal-left')) {
          const shift = (1 - easeProgress) * -40
          htmlEl.style.transform = `translate3d(${shift}px, 0px, 0px)`
        } else if (htmlEl.classList.contains('reveal-right')) {
          const shift = (1 - easeProgress) * 40
          htmlEl.style.transform = `translate3d(${shift}px, 0px, 0px)`
        } else {
          // reveal-bottom or reveal-on-scroll
          const shift = (1 - easeProgress) * 30
          htmlEl.style.transform = `translate3d(0px, ${shift}px, 0px)`
        }
      })
    }

    window.addEventListener('scroll', handleScrollAnimation, { passive: true })
    handleScrollAnimation() // Initial execution

    return () => window.removeEventListener('scroll', handleScrollAnimation)
  }, [])

  // Parallax Mouse Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const parallaxElements = document.querySelectorAll('.parallax-element')
      const x = (window.innerWidth - e.pageX * 2) / 100
      const y = (window.innerHeight - e.pageY * 2) / 100

      parallaxElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        const speedAttr = htmlEl.getAttribute('data-speed')
        const speed = speedAttr ? parseFloat(speedAttr) : 0.05
        htmlEl.style.transform = `translate(${x * speed * 20}px, ${y * speed * 20}px)`
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="bg-white dark:bg-slate-950 text-clinical-black dark:text-white font-body-md selection:bg-brand-accent selection:text-white min-h-screen flex flex-col transition-colors duration-300">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-clinical-black dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="flex justify-between items-center px-gutter py-3 max-w-screen-2xl mx-auto w-full">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex items-center gap-3 text-left focus:outline-none"
            title="Back to Top"
          >
            <div className="w-8 h-8 border-2 border-clinical-black dark:border-white bg-brand-accent flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all duration-150 font-bold shrink-0">
              <Stethoscope size={16} className="text-white transition-transform group-hover:rotate-[15deg]" />
            </div>
            <span className="font-headline-md text-headline-md font-bold text-clinical-black dark:text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight">Clinical Workflows</span>
          </button>
          <div className="hidden md:!flex items-center gap-8">
            <a
              href="#retrieval"
              className={`font-label-md text-label-md transition-all py-1 border-b-2 ${
                activeSection === 'retrieval'
                  ? 'text-primary dark:text-white font-bold border-primary dark:border-white'
                  : 'text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-white border-transparent'
              }`}
            >
              Retrieval
            </a>
            <a
              href="#safety"
              className={`font-label-md text-label-md transition-all py-1 border-b-2 ${
                activeSection === 'safety'
                  ? 'text-primary dark:text-white font-bold border-primary dark:border-white'
                  : 'text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-white border-transparent'
              }`}
            >
              Safety
            </a>
            <a
              href="#provenance"
              className={`font-label-md text-label-md transition-all py-1 border-b-2 ${
                activeSection === 'provenance'
                  ? 'text-primary dark:text-white font-bold border-primary dark:border-white'
                  : 'text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-white border-transparent'
              }`}
            >
              Provenance
            </a>
            <a
              href="#demo"
              className={`font-label-md text-label-md transition-all py-1 border-b-2 ${
                activeSection === 'demo'
                  ? 'text-primary dark:text-white font-bold border-primary dark:border-white'
                  : 'text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-white border-transparent'
              }`}
            >
              Demo
            </a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {currentUser ? (
              <>
                <button 
                  onClick={onGoToDashboard} 
                  className="px-4 py-2 font-label-md text-label-md border-2 border-clinical-black dark:border-white bg-white dark:bg-slate-900 text-clinical-black dark:text-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 font-bold uppercase tracking-wider"
                  title="Go to dashboard workstation"
                >
                  Dashboard
                </button>
                <button 
                  onClick={onShowProfile} 
                  className="px-4 py-2 font-label-md text-label-md bg-brand-accent text-white border-2 border-clinical-black dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-brand-accent/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 uppercase tracking-wider font-bold"
                  title="View your user profile"
                >
                  Profile ({currentUser.username})
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={onLogin} 
                  className="px-4 py-2 font-label-md text-label-md border-2 border-clinical-black dark:border-white bg-white dark:bg-slate-900 text-clinical-black dark:text-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150"
                >
                  Login
                </button>
                <button 
                  onClick={onRegister} 
                  className="px-4 py-2 font-label-md text-label-md bg-clinical-black dark:bg-brand-accent text-white border-2 border-clinical-black dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-clinical-black/90 dark:hover:bg-brand-accent/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
        {/* Scroll Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-100 dark:bg-slate-900 overflow-hidden">
          <div 
            className="h-full bg-brand-accent"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </nav>

      <main className="pt-16 flex-grow">
        {/* Hero Section */}
        <section id="hero" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-gutter py-20 bg-[radial-gradient(#1a1a1a_0.75px,transparent_0.75px)] dark:bg-[radial-gradient(#ffffff_0.75px,transparent_0.75px)] [background-size:24px_24px] [background-position:center] transition-colors duration-300">
          <div className="relative z-10 max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 parallax-element" data-speed="0.05">
              <div className="inline-block px-3 py-1 bg-brand-accent text-white font-code-sm text-code-sm uppercase tracking-widest neo-brutal-shadow-sm font-bold">
                Precision Hypertension RAG
              </div>
              <h1 className="font-headline-xl text-[64px] leading-tight font-black text-clinical-black dark:text-white uppercase">
                Clinical Precision.<br />
                <span className="text-brand-accent">Engineered</span> For Care.
              </h1>
              <p className="font-body-md text-headline-md text-on-surface-variant dark:text-slate-400 max-w-lg border-l-4 border-outline-variant dark:border-slate-700 pl-6">
                The definitive operating system for high-stakes medical AI. Deploy hybrid retrieval architectures with absolute safety guardrails and immutable provenance.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <button 
                  onClick={currentUser ? onGoToDashboard : onLogin}
                  className="group relative px-8 py-4 bg-clinical-black dark:bg-brand-accent text-white font-headline-md border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-clinical-black/90 dark:hover:bg-brand-accent/90 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 flex items-center gap-2 overflow-hidden"
                >
                  <span className="relative z-10 uppercase font-bold tracking-wide">
                    {currentUser ? 'Return to Workstation' : 'Initialize Interface'}
                  </span>
                  <span className="material-symbols-outlined relative z-10 transition-transform group-hover:translate-x-1">terminal</span>
                </button>
                <button 
                  onClick={() => window.open('https://github.com/jeevesh2515/clinical-rag-agent', '_blank')}
                  className="px-8 py-4 bg-white dark:bg-slate-900 text-clinical-black dark:text-white border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 uppercase font-bold tracking-wide"
                >
                  View Whitepaper
                </button>
              </div>
            </div>
            
            <div className="relative parallax-element" data-speed="-0.03">
              {/* CORE_ENGINE_V3 Visual Block */}
              <div className="relative w-full aspect-square border-2 border-clinical-black dark:border-white bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl neo-brutal-shadow dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8 scanline-effect overflow-hidden">
                <div className="tipped-label dark:border-white dark:text-white" style={{ right: '48px' }}>CORE_ENGINE_V3_LIVE</div>
                <div className="h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="w-12 h-1 bg-brand-accent"></div>
                      <div className="font-code-sm text-[10px] text-on-surface-variant dark:text-slate-400">Uptime: 99.9999%</div>
                      <div className="font-code-sm text-[10px] text-on-surface-variant dark:text-slate-400">Lat: 24ms</div>
                    </div>
                    <div className="text-right">
                      <span className="material-symbols-outlined text-brand-accent animate-pulse">monitoring</span>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center py-8">
                    <div className="relative w-48 h-48 border-4 border-clinical-black dark:border-white flex items-center justify-center">
                      <div className="absolute inset-2 border border-clinical-black/20 dark:border-white/20 animate-spin-slow"></div>
                      <div className="absolute inset-6 border-2 border-brand-accent/40 animate-spin-slower-reverse"></div>
                      <span className="material-symbols-outlined text-6xl text-clinical-black dark:text-white" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border-2 border-clinical-black dark:border-slate-700 bg-white dark:bg-slate-950">
                      <div className="text-[10px] font-code-sm text-outline dark:text-slate-400 uppercase">Neural Integrity</div>
                      <div className="text-xl font-headline-md font-black">98.4%</div>
                    </div>
                    <div className="p-3 border-2 border-clinical-black dark:border-slate-700 bg-brand-accent text-white">
                      <div className="text-[10px] font-code-sm text-white/70 uppercase">Throughput</div>
                      <div className="text-xl font-headline-md font-black">1.2GB/s</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-12 h-12 border-2 border-clinical-black dark:border-white bg-tertiary-fixed-dim dark:bg-slate-800 neo-brutal-shadow-sm dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] flex items-center justify-center z-20">
                <span className="material-symbols-outlined text-clinical-black dark:text-white">shield</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-16 bg-surface-container-low dark:bg-slate-900/50 border-t-2 border-clinical-black dark:border-slate-800 px-gutter transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 reveal-on-scroll">
              <h2 className="font-headline-xl text-headline-xl font-black uppercase text-clinical-black dark:text-white tracking-tighter">Clinical Components</h2>
              <div className="w-24 h-2 bg-brand-accent mt-4"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Hybrid Retrieval */}
              <div id="retrieval" className="md:col-span-8 relative p-8 overflow-hidden bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#ffffff] hover:translate-x-1 hover:translate-y-1 transition-all reveal-left" style={{ transitionDelay: '100ms' }}>
                <div className="tipped-label dark:bg-white dark:text-slate-950 dark:border-white">V3_RETRIEVAL</div>
                <div className="flex flex-col md:flex-row gap-8 min-w-0">
                  <div className="flex-1 space-y-4">
                    <span className="material-symbols-outlined text-4xl text-brand-accent">layers</span>
                    <h3 className="font-headline-lg text-headline-lg font-black uppercase text-clinical-black dark:text-white">Hybrid Retrieval</h3>
                    <p className="text-on-surface-variant dark:text-slate-300 font-body-md">Seamlessly merge vector-based semantic search with deterministic clinical coding (ICD-11, SNOMED CT) for zero-hallucination patient context extraction.</p>
                    <div className="flex gap-2 pt-4">
                      <span className="px-2 py-1 bg-surface-container-highest dark:bg-slate-950 border border-clinical-black dark:border-slate-700 font-code-sm text-body-sm text-clinical-black dark:text-white">SNOMED_MAP</span>
                      <span className="px-2 py-1 bg-surface-container-highest dark:bg-slate-950 border border-clinical-black dark:border-slate-700 font-code-sm text-body-sm text-clinical-black dark:text-white">VECTOR_V4</span>
                    </div>
                  </div>
                  <div className="w-72 h-72 bg-surface-container dark:bg-slate-950 rounded-sm border-2 border-clinical-black dark:border-slate-700 overflow-hidden relative shrink-0 group">
                    <div className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 mix-blend-color bg-blue-500/40 dark:bg-orange-500/60"></div>
                    <img 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                      alt="Technical illustration representing Hybrid Retrieval" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHfzT8ed21I3l9fZvTedw9-x6BODLmDa9b-Zmi9N-jl_xgCe_6CvtWX9iRWCZyyfEPrVweqsbs77CaZoFgsOVs1iRet9TCx1j1Zj4NiqD7-8_gnB3qYzmoWRWW-SA-tYgu6hJBT5ba62hYuXA-czO52G1W3vFc1SAm-iaJSuEe-VwlyKgN2EAeKxw-apbjFW5M0BYBWiAiWUqFcqYuXGPzbxvOy3OK34N7IwINDMOi_UuNxbCtEyYt"
                    />
                  </div>
                </div>
              </div>

              {/* OKF Spine */}
              <div className="md:col-span-4 group p-8 bg-tertiary-fixed dark:bg-amber-950/20 border-2 border-clinical-black dark:border-amber-500/45 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#f59e0b] hover:translate-x-1 hover:translate-y-1 transition-all reveal-right" style={{ transitionDelay: '200ms' }}>
                <div className="tipped-label dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500">OKF_CORE</div>
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-4xl text-clinical-black dark:text-amber-400">verified</span>
                  <h3 className="font-headline-lg text-headline-lg font-black uppercase text-clinical-black dark:text-white">OKF Spine</h3>
                  <p className="text-on-surface-variant dark:text-slate-300 font-body-md">The Open Knowledge Framework ensures that every decision made by the system is tethered to validated medical literature.</p>
                </div>
              </div>

              {/* Safety Guardrails */}
              <div id="safety" className="md:col-span-4 group p-8 bg-secondary-fixed dark:bg-emerald-950/20 border-2 border-clinical-black dark:border-emerald-500/45 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#10b981] hover:translate-x-1 hover:translate-y-1 transition-all reveal-left" style={{ transitionDelay: '300ms' }}>
                <div className="tipped-label dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-500">SAFETY_V1</div>
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-4xl text-clinical-black dark:text-emerald-400">security</span>
                  <h3 className="font-headline-lg text-headline-lg font-black uppercase text-clinical-black dark:text-white">Safety Guardrails</h3>
                  <p className="text-on-surface-variant dark:text-slate-300 font-body-md">Multi-layer verification protocols that prevent off-label advice and maintain strict clinical boundaries.</p>
                </div>
              </div>

              {/* Full Provenance */}
              <div id="provenance" className="md:col-span-4 group p-8 bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-clinical-black dark:border-indigo-500/45 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#6366f1] hover:translate-x-1 hover:translate-y-1 transition-all reveal-bottom" style={{ transitionDelay: '400ms' }}>
                <div className="tipped-label bg-indigo-600 dark:bg-indigo-500 text-white dark:text-slate-950 border-indigo-600 dark:border-indigo-500">AUDIT_TRACE</div>
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-4xl text-indigo-600 dark:text-indigo-400">menu_book</span>
                  <h3 className="font-headline-lg text-headline-lg font-black uppercase text-clinical-black dark:text-white">Full Provenance</h3>
                  <p className="text-on-surface-variant dark:text-slate-300 font-body-md">Complete chain of custody for every data point used in the clinical inference process.</p>
                </div>
              </div>

              {/* Real-Time Audit */}
              <div className="md:col-span-4 group p-8 bg-clinical-black dark:bg-slate-900 text-white border-2 border-clinical-black dark:border-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#ffffff] hover:translate-x-1 hover:translate-y-1 transition-all reveal-right" style={{ transitionDelay: '500ms' }}>
                <div className="tipped-label bg-white dark:bg-white text-clinical-black dark:text-slate-950 dark:border-white">LIVE_SYNC</div>
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-4xl text-brand-accent">radar</span>
                  <h3 className="font-headline-lg text-headline-lg font-black uppercase text-white">Real-Time Audit</h3>
                  <p className="text-surface-variant dark:text-slate-300 font-body-md">Streaming monitoring of model drift and logic deviations with instant clinician alerting.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Clinical BMI Teaser Section */}
        <section id="bmi-teaser" className="py-16 bg-white dark:bg-slate-950 border-t-2 border-clinical-black dark:border-slate-800 px-gutter">
          <div className="max-w-4xl mx-auto">
            <div className="bg-[#fafafa] dark:bg-slate-900 border-4 border-clinical-black dark:border-white p-6 sm:p-10 clinical-shadow relative overflow-hidden">
              <div className="tipped-label dark:border-white dark:text-white" style={{ right: '24px' }}>CLINICAL_TOOL</div>
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-4 max-w-xl text-left">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-brand-accent inline-block"></span>
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-accent font-code-sm">Cardiovascular Health Feature</span>
                  </div>

                  <h3 className="font-headline-xl text-2xl sm:text-3xl font-black uppercase text-clinical-black dark:text-white tracking-tight leading-tight">
                    Clinical BMI & Hypertension Risk Assessor
                  </h3>

                  <p className="text-on-surface-variant dark:text-slate-300 font-body-md text-sm sm:text-base leading-relaxed">
                    Track your Body Mass Index against official WHO categories and discover how weight management directly impacts your systolic blood pressure & ACC/AHA hypertension risk. Save your health vitals securely to your private profile.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-xs font-bold uppercase font-code-sm">
                      WHO BMI Categories
                    </span>
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-xs font-bold uppercase font-code-sm">
                      SBP Impact (-1 mmHg/kg)
                    </span>
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-slate-700 text-xs font-bold uppercase font-code-sm">
                      Private Vitals Sync
                    </span>
                  </div>
                </div>

                <div className="w-full md:w-auto shrink-0 flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-950 border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] text-center space-y-4">
                  <div className="w-14 h-14 bg-brand-accent text-white flex items-center justify-center border-2 border-clinical-black dark:border-white font-bold shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <span className="material-symbols-outlined text-3xl">scale</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block font-code-sm">Free Health Tool</span>
                    <span className="text-base font-black uppercase text-clinical-black dark:text-white font-headline-md">Measure Your BMI</span>
                  </div>

                  <button
                    onClick={currentUser ? onGoToDashboard : onRegister}
                    className="w-full px-6 py-3 bg-brand-accent text-white font-headline-md text-xs font-bold uppercase tracking-wider border-2 border-clinical-black dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    <span>{currentUser ? 'Open Calculator in App' : 'Sign Up to Calculate BMI'}</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Initialize Interface Section */}
        <section id="demo" className="py-32 bg-white dark:bg-slate-950 relative overflow-hidden border-y-4 border-clinical-black dark:border-slate-800 transition-colors duration-300">
          <div className="relative z-10 max-w-4xl mx-auto text-center px-gutter">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 border-4 border-clinical-black dark:border-white flex items-center justify-center bg-white dark:bg-slate-900 neo-brutal-shadow dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] rotate-12">
                <span className="material-symbols-outlined text-4xl text-brand-accent" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
              </div>
            </div>
            <h2 className="font-headline-xl text-[48px] font-black uppercase text-clinical-black dark:text-white mb-6">Experience the Protocol</h2>
            <p className="font-body-md text-headline-md text-on-surface-variant dark:text-slate-400 mb-12">
              Enter the sandbox to test the Hybrid Retrieval engine against anonymized clinical datasets in real-time. Full HIPAA compliance simulated.
            </p>
            <button 
              onClick={onLogin}
              className="group relative px-12 py-6 bg-brand-accent text-white font-headline-lg border-4 border-clinical-black dark:border-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none dark:hover:shadow-none hover:bg-brand-accent/90 active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all duration-150 flex items-center gap-4 mx-auto overflow-hidden"
            >
              <span className="relative z-10 uppercase tracking-widest font-bold">Launch Fidelity Simulator</span>
              <span className="material-symbols-outlined relative z-10 group-hover:translate-x-2 transition-transform">arrow_forward_ios</span>
            </button>
          </div>
        </section>

        {/* Scroll-Linked Horizontal Marquee Divider */}
        <div className="w-full overflow-hidden border-b-4 border-clinical-black dark:border-slate-800 bg-brand-accent py-5 text-white uppercase font-headline-xl tracking-widest text-xl select-none z-10 relative">
          <div 
            className="flex whitespace-nowrap gap-16"
            style={{ transform: `translate3d(-${scrollOffset * 0.4}px, 0px, 0px)` }}
          >
            {Array(10).fill("CLINICAL RAG • OKF SPINE • ZERO HALLUCINATION • HIPAA COMPLIANT • CORE ENGINE V3").map((text, i) => (
              <span key={i} className="flex-shrink-0 font-bold">{text}</span>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 border-b-4 border-clinical-black dark:border-slate-800 transition-colors duration-300">
          <div className="p-16 border-r-2 border-clinical-black dark:border-slate-850 flex flex-col items-center justify-center text-center space-y-4">
            <AnimatedCounter target={0.0} decimals={1} suffix="%" startValue={5.0} />
            <div className="font-headline-md text-headline-md uppercase font-bold text-clinical-black dark:text-white">Hallucination Rate</div>
            <p className="font-body-sm text-on-surface-variant dark:text-slate-400">Validated via Peer-Review Benchmarks</p>
          </div>
          <div className="p-16 border-r-2 border-clinical-black dark:border-slate-850 bg-clinical-black dark:bg-slate-900 text-white flex flex-col items-center justify-center text-center space-y-4">
            <AnimatedCounter target={400} decimals={0} suffix="ms" startValue={100} />
            <div className="font-headline-md text-headline-md uppercase font-bold">Inference Latency</div>
            <p className="font-body-sm text-surface-variant dark:text-slate-400">At 95th percentile system-wide</p>
          </div>
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <AnimatedCounter target={1.2} decimals={1} suffix="M+" startValue={0.0} />
            <div className="font-headline-md text-headline-md uppercase font-bold text-clinical-black dark:text-white">Cases Evaluated</div>
            <p className="font-body-sm text-on-surface-variant dark:text-slate-400">Across 14 tertiary care networks</p>
          </div>
        </section>
        {/* Next Step Section */}
        <section className="py-24 bg-stone-50 dark:bg-slate-900 border-b-4 border-clinical-black dark:border-slate-800 px-gutter relative overflow-hidden transition-colors duration-300">
          <div className="max-w-4xl mx-auto text-center space-y-6 reveal-bottom">
            <h3 className="font-headline-xl text-[40px] font-black uppercase text-clinical-black dark:text-white">Ready for the Next Step?</h3>
            <p className="text-on-surface-variant dark:text-slate-400 font-body-md max-w-lg mx-auto leading-relaxed border-l-4 border-brand-accent pl-6 text-left md:text-center md:border-l-0 md:pl-0">
              Audit results verified. Select an action below to authenticate and enter the clinical dashboard or scroll back to review the guidelines.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-6">
              <button 
                onClick={onLogin}
                className="px-8 py-4 bg-brand-accent text-white font-headline-md border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_#ffffff] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-brand-accent/90 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 uppercase font-bold tracking-wide"
              >
                Sign In to Dashboard
              </button>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-white dark:bg-slate-950 text-clinical-black dark:text-white border-2 border-clinical-black dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 uppercase font-bold tracking-wide flex items-center gap-2"
              >
                <span>Scroll to Top</span>
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-high dark:bg-slate-900 border-t-2 border-clinical-black dark:border-slate-800 py-20 px-gutter transition-colors duration-300">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 w-full">
          <div className="space-y-6 lg:col-span-1">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="group flex items-center gap-3 text-left focus:outline-none"
              title="Back to Top"
            >
              <div className="w-8 h-8 border-2 border-clinical-black dark:border-white bg-brand-accent flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all duration-150 font-bold shrink-0">
                <Stethoscope size={16} className="text-white transition-transform group-hover:rotate-[15deg]" />
              </div>
              <span className="font-headline-md text-headline-md font-bold text-clinical-black dark:text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight">Clinical Workflows</span>
            </button>
            <p className="font-body-sm text-on-surface-variant dark:text-slate-400">
              Advancing patient outcomes through deterministic artificial intelligence. Engineered for professionals, by professionals.
            </p>
            <div className="font-code-sm text-[10px] text-brand-accent border border-brand-accent inline-block px-2 py-1 font-bold">
              HIPAA COMPLIANT STACK
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="font-label-md text-label-md font-bold uppercase tracking-widest text-clinical-black dark:text-white">Documentation</h4>
            <ul className="space-y-3 font-body-sm text-on-surface-variant dark:text-slate-400">
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">API Reference</a></li>
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">System Architecture</a></li>
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">OKF Documentation</a></li>
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">Security Whitepaper</a></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-label-md text-label-md font-bold uppercase tracking-widest text-clinical-black dark:text-white">Legal</h4>
            <ul className="space-y-3 font-body-sm text-on-surface-variant dark:text-slate-400">
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">Privacy Policy</a></li>
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">Terms of Service</a></li>
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">GDPR Compliance</a></li>
              <li><a className="hover:text-brand-accent hover:underline transition-all" href="#">Ethics Statement</a></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-label-md text-label-md font-bold uppercase tracking-widest text-clinical-black dark:text-white">Connect</h4>
            <div className="flex gap-4">
              <button 
                onClick={() => window.open('https://github.com/jeevesh2515/clinical-rag-agent', '_blank')}
                className="w-10 h-10 border-2 border-clinical-black dark:border-slate-800 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all bg-white dark:bg-slate-900 text-clinical-black dark:text-white"
              >
                <span className="material-symbols-outlined text-clinical-black dark:text-white">link</span>
              </button>
              <button 
                onClick={() => window.open('mailto:info@example.com')}
                className="w-10 h-10 border-2 border-clinical-black dark:border-slate-800 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all bg-white dark:bg-slate-900 text-clinical-black dark:text-white"
              >
                <span className="material-symbols-outlined text-clinical-black dark:text-white">alternate_email</span>
              </button>
              <button 
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="w-10 h-10 border-2 border-clinical-black dark:border-slate-800 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:hover:shadow-none hover:bg-stone-100 dark:hover:bg-slate-850 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all bg-white dark:bg-slate-900 text-clinical-black dark:text-white"
              >
                <span className="material-symbols-outlined text-clinical-black dark:text-white">share</span>
              </button>
            </div>
            <div className="pt-4">
              <p className="font-code-sm text-[10px] text-outline-variant">© 2024 Clinical Workflows AI.<br />Engineered in California.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
