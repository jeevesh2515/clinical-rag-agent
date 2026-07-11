/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand
        brand: {
          50:  '#fff1f4',
          100: '#ffe1e8',
          200: '#ffc6d3',
          300: '#ff9bb1',
          400: '#ff6188',
          500: '#ff3366', // ← primary brand-accent
          600: '#ed1448',
          700: '#c80a3a',
          800: '#a40d33',
          900: '#88122f',
        },
        // Calming teal — for relief/calm
        calm: {
          50:  '#effbfb',
          100: '#d6f5f5',
          200: '#aeeaeb',
          300: '#79dadb',
          400: '#3fc3c5',
          500: '#008080', // ← relief-accent
          600: '#006b6b',
          700: '#005555',
          800: '#054545',
          900: '#093a3a',
        },
        // Warm amber for OKF / highlighted
        okf: {
          50:  '#fff8ed',
          100: '#ffefd4',
          200: '#ffdba8',
          300: '#ffc071',
          400: '#ffa14a',
          500: '#f98026',
          600: '#dc5b15',
          700: '#b64214',
          800: '#923618',
          900: '#782f18',
        },
        // Clinical neutrals — softer than pure black/white
        ink: {
          50:  '#f7f8fa',
          100: '#eef0f4',
          200: '#dde2ea',
          300: '#c1c8d4',
          400: '#9aa3b5',
          500: '#6c7689',
          600: '#4d5667',
          700: '#363d4b',
          800: '#212733',
          900: '#13171f',
          950: '#0a0d12',
        },
        // Backwards-compatible legacy aliases (so we don't break anything mid-refactor)
        'brand-accent': '#ff3366',
        'relief-accent': '#008080',
        'clinical-black': '#13171f',
      },
      boxShadow: {
        // Subtle, layered shadows — not the harsh brutalist 4px hard offset
        'soft-sm': '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)',
        'soft':    '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'soft-lg': '0 18px 38px -12px rgba(15, 23, 42, 0.18), 0 8px 16px -8px rgba(15, 23, 42, 0.08)',
        'soft-xl': '0 30px 60px -20px rgba(15, 23, 42, 0.20), 0 12px 24px -12px rgba(15, 23, 42, 0.10)',
        'ring-brand': '0 0 0 4px rgba(255, 51, 102, 0.15)',
        'ring-calm':  '0 0 0 4px rgba(0, 128, 128, 0.15)',
        // Glow used by the pressure-relief mode
        'glow-calm':  '0 0 40px rgba(0, 128, 128, 0.18), 0 0 80px rgba(0, 128, 128, 0.08)',
        'glow-brand': '0 0 40px rgba(255, 51, 102, 0.18), 0 0 80px rgba(255, 51, 102, 0.08)',
      },
      backgroundImage: {
        'grid-soft': "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
        'grid-soft-dark': "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        'mesh-brand': 'radial-gradient(at 20% 0%, rgba(255,51,102,0.08) 0px, transparent 50%), radial-gradient(at 80% 100%, rgba(0,128,128,0.08) 0px, transparent 50%)',
        'mesh-soft':  'radial-gradient(at 0% 0%, rgba(255,51,102,0.05) 0px, transparent 40%), radial-gradient(at 100% 100%, rgba(0,128,128,0.05) 0px, transparent 40%)',
      },
      backgroundSize: {
        'grid-lg': '32px 32px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
        '450': '450ms',
      },
      keyframes: {
        'fade-in':    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-up':    { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-down':  { '0%': { opacity: '0', transform: 'translateY(-12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in':   { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        'heartbeat':  { '0%, 100%': { transform: 'scale(1)' }, '15%': { transform: 'scale(1.08)' }, '30%': { transform: 'scale(1)' }, '45%': { transform: 'scale(1.06)' } },
        'shimmer':    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'float':      { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'breath-in':  { '0%': { transform: 'scale(0.6)', opacity: '0.4' }, '40%, 100%': { transform: 'scale(1.2)', opacity: '1' } },
        'breath-hold':{ '0%, 100%': { transform: 'scale(1.2)', opacity: '1' } },
        'breath-out': { '0%': { transform: 'scale(1.2)', opacity: '1' }, '50%, 100%': { transform: 'scale(0.6)', opacity: '0.4' } },
        'ring-pulse': { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        'spin-slow':  { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in':   'fade-in 250ms ease-out forwards',
        'fade-up':   'fade-up 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-down': 'fade-down 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'scale-in':  'scale-in 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-soft':'pulse-soft 2.4s ease-in-out infinite',
        'heartbeat': 'heartbeat 1.2s ease-in-out infinite',
        'shimmer':   'shimmer 2.4s linear infinite',
        'float':     'float 6s ease-in-out infinite',
        'breath-in':  'breath-in 4s ease-in-out forwards',
        'breath-hold':'breath-hold 7s linear forwards',
        'breath-out': 'breath-out 8s ease-in-out forwards',
        'ring-pulse': 'ring-pulse 2.2s ease-out infinite',
        'spin-slow':  'spin-slow 12s linear infinite',
      },
    },
  },
  plugins: [],
}
