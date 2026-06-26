import React, { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Building2, Calendar } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Citation } from '../types/api'

interface CitationsPanelProps {
  citations: Citation[]
}

export const CitationsPanel: React.FC<CitationsPanelProps> = ({ citations }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (citations.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">No citations available for this response.</p>
        <p className="text-xs text-slate-600 mt-1">Citations appear when the response uses retrieved guideline evidence.</p>
      </div>
    )
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-medical-400" />
          Citations
          <span className="text-[10px] font-mono text-slate-500 font-normal">({citations.length})</span>
        </h3>
      </div>

      {citations.map((citation, index) => {
        const isExpanded = expanded.has(citation.chunk_id)
        return (
          <div
            key={citation.chunk_id}
            className={cn(
              'glass-panel transition-all duration-200',
              isExpanded && 'bg-white/[0.05]'
            )}
          >
            <button
              onClick={() => toggle(citation.chunk_id)}
              className="w-full flex items-start justify-between gap-3 text-left p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded font-medium">
                    #{index + 1}
                  </span>
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {citation.title}
                  </span>
                  {citation.organization && (
                    <span className="text-[9px] text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded-full truncate hidden sm:inline">
                      {citation.organization}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-2.5 h-2.5" />
                    {citation.source_id}
                  </span>
                  <span>Page {citation.page}</span>
                  {citation.publication_year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {citation.publication_year}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 mt-0.5">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 animate-fade-in">
                <div className="border-t border-white/[0.06] pt-3">
                  <blockquote className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-medical-500/30 pl-3">
                    &ldquo;{citation.quote}&rdquo;
                  </blockquote>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <span className="bg-white/[0.04] px-2 py-0.5 rounded font-mono">{citation.source_id}</span>
                    <span className="bg-white/[0.04] px-2 py-0.5 rounded font-mono">Chunk: {citation.chunk_id}</span>
                    {citation.organization && (
                      <span className="bg-white/[0.04] px-2 py-0.5 rounded">{citation.organization}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="text-[10px] text-slate-600 text-center pt-1">
        Citations reference specific chunks from the retrieval index
      </div>
    </div>
  )
}
