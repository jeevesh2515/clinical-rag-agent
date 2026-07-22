import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <div className="flex items-center gap-1 border-2 border-clinical-black dark:border-white bg-white dark:bg-slate-900 p-1 rounded-full shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
      <button
        type="button"
        onClick={() => theme !== 'light' && toggle()}
        className={`p-1.5 rounded-full transition-all focus:outline-none ${
          theme === 'light'
            ? 'bg-brand-accent text-white shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] font-bold scale-105'
            : 'text-clinical-black dark:text-white hover:bg-stone-100 dark:hover:bg-slate-800'
        }`}
        title="Light Mode"
      >
        <Sun size={14} className="stroke-[2.5]" />
      </button>
      <button
        type="button"
        onClick={() => theme !== 'dark' && toggle()}
        className={`p-1.5 rounded-full transition-all focus:outline-none ${
          theme === 'dark'
            ? 'bg-brand-accent text-white shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)] font-bold scale-105'
            : 'text-clinical-black dark:text-white hover:bg-stone-100 dark:hover:bg-slate-800'
        }`}
        title="Dark Mode"
      >
        <Moon size={14} className="stroke-[2.5]" />
      </button>
    </div>
  )
}
