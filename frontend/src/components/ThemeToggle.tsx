import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl
                 text-ink-500 hover:text-ink-900 hover:bg-ink-100
                 dark:text-ink-400 dark:hover:text-white dark:hover:bg-ink-800/60
                 transition-all duration-250 ease-smooth
                 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-300
                 focus-visible:ring-offset-white dark:focus-visible:ring-offset-ink-950
                 active:scale-95"
    >
      <Sun size={16} className={`absolute transition-all duration-300 ${isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
      <Moon size={16} className={`absolute transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} />
    </button>
  )
}
