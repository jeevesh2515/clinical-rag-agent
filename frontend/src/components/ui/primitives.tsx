import { useEffect, useState, useRef, type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes, forwardRef } from 'react'

// ─── Class name helper ────────────────────────────────────────────────────────
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

// ─── Reveal-on-scroll (intersection observer) ────────────────────────────────
export function Reveal({
  children,
  className = '',
  delay = 0,
  as: As = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: 0 | 1 | 2 | 3 | 4 | 5
  as?: keyof JSX.IntrinsicElements
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = document.getElementById(`reveal-${Math.random()}`)
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <As
      id={`reveal-${Math.random()}`}
      className={cn('reveal', visible && 'is-visible', delay > 0 && `reveal-delay-${delay}`, className)}
    >
      {children}
    </As>
  )
}

// ─── Button (with real hover + overlay effect) ────────────────────────────────
type ButtonVariant = 'primary' | 'calm' | 'outline' | 'ghost' | 'subtle' | 'icon'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const sizeMap: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-2xl',
}

const variantMap: Record<Exclude<ButtonVariant, 'icon'>, string> = {
  primary:
    'bg-brand-500 text-white shadow-soft hover:bg-brand-600 hover:shadow-soft-lg hover:-translate-y-[1px] ' +
    'focus-visible:ring-brand-500/40',
  calm:
    'bg-calm-500 text-white shadow-soft hover:bg-calm-600 hover:shadow-soft-lg hover:-translate-y-[1px] ' +
    'focus-visible:ring-calm-500/40',
  outline:
    'bg-white text-ink-900 border border-ink-200 shadow-soft-sm ' +
    'hover:bg-ink-50 hover:border-ink-300 hover:shadow-soft ' +
    'dark:bg-ink-900 dark:text-white dark:border-ink-700 dark:hover:bg-ink-800 dark:hover:border-ink-600 ' +
    'focus-visible:ring-ink-300',
  ghost:
    'bg-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900 ' +
    'dark:text-ink-300 dark:hover:bg-ink-800/60 dark:hover:text-white ' +
    'focus-visible:ring-ink-300',
  subtle:
    'bg-ink-100 text-ink-700 hover:bg-ink-200 ' +
    'dark:bg-ink-800/60 dark:text-ink-200 dark:hover:bg-ink-800 ' +
    'focus-visible:ring-ink-300',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, loading, icon, iconRight, disabled, fullWidth, ...rest },
  ref
) {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setMousePos({ x, y })
  }

  if (variant === 'icon') {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-ink-100',
          'dark:text-ink-400 dark:hover:text-white dark:hover:bg-ink-800/60',
          'transition-all duration-250 ease-smooth',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-300 focus-visible:ring-offset-white',
          'dark:focus-visible:ring-offset-ink-950',
          'active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          className
        )}
        {...rest}
      >
        {icon ?? children}
      </button>
    )
  }
  return (
    <button
      ref={(node) => { btnRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node }}
      disabled={disabled || loading}
      onMouseMove={handleMouseMove}
      className={cn(
        'inline-flex items-center justify-center font-medium tracking-tight',
        'transition-all duration-250 ease-smooth btn-overlay btn-shimmer',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:focus-visible:ring-offset-ink-950',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        sizeMap[size],
        variantMap[variant],
        variant === 'ghost' && 'btn-overlay-dark',
        fullWidth && 'w-full',
        className
      )}
      style={{ '--mouse-x': `${mousePos.x}%`, '--mouse-y': `${mousePos.y}%` } as React.CSSProperties}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
      {iconRight}
    </button>
  )
})

// ─── Pill (badge) ────────────────────────────────────────────────────────────
type PillVariant = 'default' | 'brand' | 'calm' | 'okf' | 'success' | 'warning' | 'danger' | 'info'

export function Pill({
  children,
  variant = 'default',
  className = '',
  icon,
}: {
  children: ReactNode
  variant?: PillVariant
  className?: string
  icon?: ReactNode
}) {
  return (
    <span className={cn(`pill-${variant}`, className)}>
      {icon}
      {children}
    </span>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({
  children,
  className = '',
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-ink-900/60 border border-ink-200/70 dark:border-ink-800',
        'rounded-2xl shadow-soft-sm',
        interactive &&
          'card-glow transition-all duration-300 ease-smooth hover:shadow-soft-lg ' +
            'hover:border-ink-300/80 dark:hover:border-ink-700 cursor-pointer',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

// ─── Soft fade-in wrapper ────────────────────────────────────────────────────
export function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div
      className={cn('animate-fade-up', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ─── Section header (used across landing / chat) ─────────────────────────────
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400',
        className
      )}
    >
      {children}
    </p>
  )
}

// ─── Avatar bubble (initials) ────────────────────────────────────────────────
export function Avatar({
  name,
  size = 32,
  className = '',
  tone = 'ink',
}: {
  name: string
  size?: number
  className?: string
  tone?: 'ink' | 'brand' | 'calm'
}) {
  const initials = (name || '?')
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const toneClass = {
    ink: 'bg-ink-900 text-white dark:bg-white dark:text-ink-900',
    brand: 'bg-brand-500 text-white',
    calm: 'bg-calm-500 text-white',
  }[tone]

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold shrink-0',
        'shadow-soft-sm',
        toneClass,
        className
      )}
    >
      {initials}
    </div>
  )
}

// ─── Kbd ─────────────────────────────────────────────────────────────────────
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-md bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-[10px] font-mono text-ink-600 dark:text-ink-300 shadow-soft-sm">
      {children}
    </kbd>
  )
}

// ─── External link (re-export with type) ─────────────────────────────────────
export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  external?: boolean
}
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { className = '', children, external, ...rest },
  ref
) {
  return (
    <a
      ref={ref}
      className={cn(
        'text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white',
        'transition-colors duration-200',
        className
      )}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
    </a>
  )
})
