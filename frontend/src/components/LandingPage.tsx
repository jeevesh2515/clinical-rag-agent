import { useEffect, useState, useRef } from 'react'
import ThemeToggle from './ThemeToggle'

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
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

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [canReveal, setCanReveal] = useState(true)
  const [activeSection, setActiveSection] = useState('hero')

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

  // Track scroll position to trigger reveal only after 40% scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = document.documentElement.clientHeight
      const maxScroll = scrollHeight - clientHeight
      
      // If page is not scrollable (e.g. huge screen), allow reveal immediately
      if (maxScroll <= 0) {
        setCanReveal(true)
        return
      }

      const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 100
      if (scrollPercent >= 10 || scrollTop > 80) {
        setCanReveal(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll Reveal Observer
  useEffect(() => {
    if (!canReveal) return

    const revealElements = document.querySelectorAll('.reveal-on-scroll, .reveal-left, .reveal-right, .reveal-bottom')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active')
          }
        })
      },
      { threshold: 0.02 }
    )

    revealElements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [canReveal])

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
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">medical_services</span>
            </div>
            <span className="font-headline-md text-headline-md font-bold text-primary dark:text-white">Clinical Workflows</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
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
            <button 
              onClick={onLogin} 
              className="px-4 py-2 font-label-md text-label-md border-2 border-primary dark:border-white neo-brutal-btn hover:bg-stone-100 dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900 text-clinical-black dark:text-white"
            >
              Login
            </button>
            <button 
              onClick={onRegister} 
              className="px-4 py-2 font-label-md text-label-md bg-primary dark:bg-brand-accent text-white border-2 border-primary dark:border-white neo-brutal-shadow dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] neo-brutal-btn"
            >
              Register
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-16 flex-grow">
        {/* Hero Section */}
        <section id="hero" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-gutter py-20 bg-[radial-gradient(#1a1a1a_0.75px,transparent_0.75px)] dark:bg-[radial-gradient(#ffffff_0.75px,transparent_0.75px)] [background-size:24px_24px] [background-position:center] transition-colors duration-300">
          <div className="relative z-10 max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 parallax-element" data-speed="0.05">
              <div className="inline-block px-3 py-1 bg-brand-accent text-white font-code-sm text-code-sm uppercase tracking-widest neo-brutal-shadow-sm font-bold">
                Enterprise Grade V3.0
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
                  onClick={onLogin}
                  className="group relative px-8 py-4 bg-primary dark:bg-brand-accent text-white font-headline-md border-2 border-primary dark:border-white neo-brutal-shadow dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] neo-brutal-btn flex items-center gap-2 overflow-hidden"
                >
                  <span className="relative z-10 uppercase font-bold tracking-wide">Initialize Interface</span>
                  <span className="material-symbols-outlined relative z-10 transition-transform group-hover:translate-x-1">terminal</span>
                </button>
                <button 
                  onClick={() => window.open('https://github.com', '_blank')}
                  className="px-8 py-4 bg-white dark:bg-slate-900 text-primary dark:text-white border-2 border-primary dark:border-white neo-brutal-shadow dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] neo-brutal-btn uppercase font-bold tracking-wide"
                >
                  View Whitepaper
                </button>
              </div>
            </div>
            
            <div className="relative parallax-element" data-speed="-0.03">
              {/* CORE_ENGINE_V3 Visual Block */}
              <div className="relative w-full aspect-square border-2 border-clinical-black dark:border-white bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl neo-brutal-shadow dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8 scanline-effect overflow-hidden">
                <div className="tipped-label dark:border-white dark:text-white">CORE_ENGINE_V3_LIVE</div>
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
        <section className="py-24 bg-surface-container-low dark:bg-slate-900/50 border-t-2 border-clinical-black dark:border-slate-800 px-gutter transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 reveal-on-scroll">
              <h2 className="font-headline-xl text-headline-xl font-black uppercase text-clinical-black dark:text-white tracking-tighter">Clinical Components</h2>
              <div className="w-24 h-2 bg-brand-accent mt-4"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Hybrid Retrieval */}
              <div id="retrieval" className="md:col-span-8 group relative p-8 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#ffffff] hover:translate-x-1 hover:translate-y-1 transition-all reveal-left" style={{ transitionDelay: '100ms' }}>
                <div className="tipped-label dark:bg-white dark:text-slate-950 dark:border-white">V3_RETRIEVAL</div>
                <div className="flex flex-col md:flex-row gap-8 h-full">
                  <div className="flex-1 space-y-4">
                    <span className="material-symbols-outlined text-4xl text-brand-accent">layers</span>
                    <h3 className="font-headline-lg text-headline-lg font-black uppercase text-clinical-black dark:text-white">Hybrid Retrieval</h3>
                    <p className="text-on-surface-variant dark:text-slate-300 font-body-md">Seamlessly merge vector-based semantic search with deterministic clinical coding (ICD-11, SNOMED CT) for zero-hallucination patient context extraction.</p>
                    <div className="flex gap-2 pt-4">
                      <span className="px-2 py-1 bg-surface-container-highest dark:bg-slate-950 border border-clinical-black dark:border-slate-700 font-code-sm text-body-sm text-clinical-black dark:text-white">SNOMED_MAP</span>
                      <span className="px-2 py-1 bg-surface-container-highest dark:bg-slate-950 border border-clinical-black dark:border-slate-700 font-code-sm text-body-sm text-clinical-black dark:text-white">VECTOR_V4</span>
                    </div>
                  </div>
                  <div className="w-full md:w-1/3 bg-surface-container dark:bg-slate-950 rounded-sm border-2 border-clinical-black dark:border-slate-700 overflow-hidden relative">
                    <img 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 dark:invert dark:opacity-85 dark:contrast-125 dark:brightness-95 transition-all duration-500" 
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
              <div id="safety" className="md:col-span-4 group p-8 bg-secondary-fixed dark:bg-rose-950/20 border-2 border-clinical-black dark:border-rose-500/45 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#f43f5e] hover:translate-x-1 hover:translate-y-1 transition-all reveal-left" style={{ transitionDelay: '300ms' }}>
                <div className="tipped-label dark:bg-rose-500 dark:text-slate-950 dark:border-rose-500">SAFETY_V1</div>
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-4xl text-clinical-black dark:text-rose-450">security</span>
                  <h3 className="font-headline-lg text-headline-lg font-black uppercase text-clinical-black dark:text-white">Safety Guardrails</h3>
                  <p className="text-on-surface-variant dark:text-slate-300 font-body-md">Multi-layer verification protocols that prevent off-label advice and maintain strict clinical boundaries.</p>
                </div>
              </div>

              {/* Full Provenance */}
              <div id="provenance" className="md:col-span-4 group p-8 bg-white dark:bg-slate-900 border-2 border-clinical-black dark:border-sky-500/45 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] dark:shadow-[6px_6px_0px_0px_#0EA5E9] hover:translate-x-1 hover:translate-y-1 transition-all reveal-bottom" style={{ transitionDelay: '400ms' }}>
                <div className="tipped-label dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500">AUDIT_TRACE</div>
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-4xl text-brand-accent dark:text-sky-400">menu_book</span>
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
              className="group relative px-12 py-6 bg-brand-accent text-white font-headline-lg border-4 border-clinical-black dark:border-white neo-brutal-shadow dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] neo-brutal-btn flex items-center gap-4 mx-auto overflow-hidden"
            >
              <span className="relative z-10 uppercase tracking-widest font-bold">Launch Fidelity Simulator</span>
              <span className="material-symbols-outlined relative z-10 group-hover:translate-x-2 transition-transform">arrow_forward_ios</span>
            </button>
          </div>
        </section>

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
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-high dark:bg-slate-900 border-t-2 border-clinical-black dark:border-slate-800 py-20 px-gutter transition-colors duration-300">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 w-full">
          <div className="space-y-6 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-primary"></div>
              <span className="font-headline-md text-headline-md font-bold text-primary dark:text-white">Clinical Workflows</span>
            </div>
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
                onClick={() => window.open('https://github.com', '_blank')}
                className="w-10 h-10 border-2 border-clinical-black dark:border-slate-800 flex items-center justify-center neo-brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white dark:bg-slate-950 text-clinical-black dark:text-white"
              >
                <span className="material-symbols-outlined text-clinical-black dark:text-white">link</span>
              </button>
              <button 
                onClick={() => window.open('mailto:info@example.com')}
                className="w-10 h-10 border-2 border-clinical-black dark:border-slate-800 flex items-center justify-center neo-brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white dark:bg-slate-955 text-clinical-black dark:text-white"
              >
                <span className="material-symbols-outlined text-clinical-black dark:text-white">alternate_email</span>
              </button>
              <button 
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="w-10 h-10 border-2 border-clinical-black dark:border-slate-800 flex items-center justify-center neo-brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white dark:bg-slate-955 text-clinical-black dark:text-white"
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
