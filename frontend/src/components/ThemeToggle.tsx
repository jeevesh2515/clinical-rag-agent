import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <div className="flex border-2 border-clinical-black bg-white p-0.5 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
      <button
        type="button"
        onClick={() => theme !== 'light' && toggle()}
        className={`p-1.5 transition-all focus:outline-none ${
          theme === 'light'
            ? 'bg-brand-accent text-white border border-clinical-black shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] font-bold'
            : 'text-clinical-black hover:bg-stone-100'
        }`}
        title="Light Mode"
      >
        <Sun size={14} className="stroke-[2.5]" />
      </button>
      <button
        type="button"
        onClick={() => theme !== 'dark' && toggle()}
        className={`p-1.5 transition-all focus:outline-none ${
          theme === 'dark'
            ? 'bg-brand-accent text-white border border-clinical-black shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] font-bold'
            : 'text-clinical-black hover:bg-stone-100'
        }`}
        title="Dark Mode"
      >
        <Moon size={14} className="stroke-[2.5]" />
      </button>
    </div>
  )
}
