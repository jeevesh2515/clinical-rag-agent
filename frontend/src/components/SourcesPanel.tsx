import React from 'react'
import { ExternalLink, FileText, CheckCircle2, Circle, Hash, Building2, Calendar } from 'lucide-react'
import { cn } from '../lib/utils'
import type { SourceMetadata } from '../types/api'

interface SourcesPanelProps {
  sources: SourceMetadata[]
  indexedCount: number
  total: number
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources, indexedCount, total }) => {
  if (sources.length === 0) {
    return (
      <div className="glass-panel p-16 text-center">
        <FileText className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <p className="text-sm text-slate-500 mb-2">No sources registered yet.</p>
        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          Click <span className="text-medical-400 font-medium">Ingest Default Sources</span> to load
          NICE, WHO, and CDC hypertension guidelines.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="tag-medical">{total} registered</span>
        <span className="tag-medical">{indexedCount} indexed</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sources.map((source, i) => (
          <div
            key={source.source_id}
            className="glass-panel-glow p-5 animate-slide-up hover-lift"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  {source.indexed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-200">{source.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded">
                        {source.source_id}
                      </span>
                      <span className="text-[10px] text-slate-600">{source.source_type.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {source.organization && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-600" />
                      <span className="truncate">{source.organization}</span>
                    </div>
                  )}
                  {source.publication_year && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      <span>Published {source.publication_year}</span>
                    </div>
                  )}
                  {source.guideline_version && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Hash className="w-3.5 h-3.5 text-slate-600" />
                      <span>Version {source.guideline_version}</span>
                    </div>
                  )}
                  {source.domain && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                      <span className="truncate">{source.domain}</span>
                    </div>
                  )}
                </div>

                {source.last_ingested_at && (
                  <p className="text-[10px] text-slate-600">
                    Last ingested: {source.last_ingested_at}
                    {source.last_manifest_id ? ` · manifest ${source.last_manifest_id}` : ''}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span
                  className={cn(
                    'text-[10px] font-medium px-2.5 py-1 rounded-full border',
                    source.indexed
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-slate-500 bg-white/[0.03] border-white/[0.06]'
                  )}
                >
                  {source.indexed ? 'Indexed' : 'Not indexed'}
                </span>
                <span className="tag-medical">{source.chunk_count} chunks</span>
                {source.page_count != null && source.page_count > 0 && (
                  <span className="text-[10px] text-slate-500">{source.page_count} pages</span>
                )}
              </div>
            </div>

            {source.source_url && (
              <a
                href={source.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-[10px] text-medical-400 hover:text-medical-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View source document
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
