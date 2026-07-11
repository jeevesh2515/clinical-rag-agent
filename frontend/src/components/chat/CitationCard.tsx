import { useState } from 'react'
import { Brain, FileText, ChevronDown, ChevronUp, Copy, Check, Calendar, Building2, Globe } from 'lucide-react'
import { cn, Pill } from '../ui/primitives'

interface Citation {
  source_id: string
  title: string
  page?: number
  chunk_id?: string
  quote?: string
  source_url?: string
  organization?: string
  publication_year?: number
  source_type?: string
  source_version?: string
  retrieved_at?: string
  review_date?: string
  effective_date?: string
  license_notes?: string
}

export function CitationCard({ citation, defaultOpen = true, index }: { citation: Citation; defaultOpen?: boolean; index?: number }) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)
  const isOkf = citation.source_type === 'okf'

  const onCopy = async () => {
    await navigator.clipboard.writeText(citation.quote || citation.title)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-300 card-glow',
      'border-ink-200/60 dark:border-ink-800',
      'bg-white dark:bg-ink-900/60',
      'hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-soft',
    )}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-50/60 dark:hover:bg-ink-900/60 transition-colors"
      >
        {typeof index === 'number' && (
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
            isOkf
              ? 'bg-okf-500/10 text-okf-700 dark:text-okf-300'
              : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
          )}>
            {index + 1}
          </div>
        )}
        <Pill variant={isOkf ? 'okf' : 'brand'} icon={isOkf ? <Brain size={10} /> : <FileText size={10} />}>
          {isOkf ? 'OKF' : 'RAG'}
        </Pill>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">
            {citation.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
            {citation.organization && <span className="truncate">{citation.organization}</span>}
            {citation.publication_year && <span>· {citation.publication_year}</span>}
            {citation.page && <span>· p. {citation.page}</span>}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-ink-400 shrink-0" /> : <ChevronDown size={16} className="text-ink-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ink-200/40 dark:border-ink-800/40">
          {citation.quote && (
            <div className="relative mt-3 pl-4 border-l-2 border-brand-500/60">
              <p className="text-[13px] leading-relaxed text-ink-700 dark:text-ink-200 italic">
                "{citation.quote}"
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {citation.organization && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300">
                <Building2 size={10} /> {citation.organization}
              </span>
            )}
            {citation.publication_year && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300">
                <Calendar size={10} /> {citation.publication_year}
              </span>
            )}
            {citation.source_version && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300">
                v {citation.source_version}
              </span>
            )}
            {citation.effective_date && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Effective {citation.effective_date}
              </span>
            )}
            {citation.review_date && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Review {citation.review_date}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10.5px] font-mono text-ink-400 truncate">
              {citation.source_id}{citation.chunk_id ? ` · ${citation.chunk_id}` : ''}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              >
                {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy quote'}
              </button>
              {citation.source_url && (
                <a
                  href={citation.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                >
                  <Globe size={11} /> View source
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
