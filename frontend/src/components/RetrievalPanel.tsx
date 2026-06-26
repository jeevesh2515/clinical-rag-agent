import React, { useState } from 'react'
import { Search, SlidersHorizontal, BarChart3 } from 'lucide-react'
import { formatScore } from '../lib/utils'
import type { RetrievalTrace } from '../types/api'

interface RetrievalPanelProps {
  retrieval: RetrievalTrace
}

function ScoreBar({ value, maxValue, color }: { value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  return (
    <div className="score-bar w-16">
      <div
        className={`score-bar-fill ${color}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  )
}

export const RetrievalPanel: React.FC<RetrievalPanelProps> = ({ retrieval }) => {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? retrieval.results : retrieval.results.slice(0, 5)
  const maxScore = Math.max(
    ...retrieval.results.map((r) => Math.max(r.dense_score, r.sparse_score, r.hybrid_score, r.rerank_score)),
    0.001
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-sky-400" />
          Retrieval Trace
        </h3>
      </div>

      {/* Config summary */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] text-slate-500 uppercase tracking-wider">
          <SlidersHorizontal className="w-3 h-3" />
          Retrieval Configuration
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Alpha</div>
            <div className="text-sm font-mono font-semibold text-sky-400">{retrieval.alpha}</div>
            <div className="text-[9px] text-slate-600 mt-0.5">Dense/Sparse mix</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Top-K</div>
            <div className="text-sm font-mono font-semibold text-sky-400">{retrieval.top_k}</div>
            <div className="text-[9px] text-slate-600 mt-0.5">Initial candidates</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Rerank N</div>
            <div className="text-sm font-mono font-semibold text-sky-400">{retrieval.rerank_top_n}</div>
            <div className="text-[9px] text-slate-600 mt-0.5">Final candidates</div>
          </div>
        </div>
      </div>

      {/* Score table */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] text-slate-500 uppercase tracking-wider">
          <BarChart3 className="w-3 h-3" />
          Score Breakdown
        </div>

        {/* Header */}
        <div className="hidden sm:flex items-center gap-2 text-[9px] text-slate-600 uppercase tracking-wider px-2 pb-2 border-b border-white/[0.04] mb-2">
          <span className="flex-1">Chunk</span>
          <span className="w-16 text-right">Dense</span>
          <span className="w-16 text-right">Sparse</span>
          <span className="w-24 text-right">Hybrid</span>
          <span className="w-24 text-right">Rerank</span>
        </div>

        <div className="space-y-1">
          {displayed.map((result) => (
            <div
              key={result.chunk_id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 px-2 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex-1 text-[10px] font-mono text-slate-400 truncate">
                {result.chunk_id}
              </span>

              {/* Desktop: inline scores */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-16 text-right">
                  <div className="text-[10px] font-mono text-slate-500">{formatScore(result.dense_score)}</div>
                  <ScoreBar value={result.dense_score} maxValue={maxScore} color="bg-sky-500" />
                </div>
                <div className="w-16 text-right">
                  <div className="text-[10px] font-mono text-slate-500">{formatScore(result.sparse_score)}</div>
                  <ScoreBar value={result.sparse_score} maxValue={maxScore} color="bg-amber-500" />
                </div>
                <div className="w-24 text-right">
                  <div className="text-[10px] font-mono text-sky-400 font-semibold">{formatScore(result.hybrid_score)}</div>
                  <ScoreBar value={result.hybrid_score} maxValue={maxScore} color="bg-sky-400" />
                </div>
                <div className="w-24 text-right">
                  <div className="text-[10px] font-mono text-medical-400 font-semibold">{formatScore(result.rerank_score)}</div>
                  <ScoreBar value={result.rerank_score} maxValue={maxScore} color="bg-medical-400" />
                </div>
              </div>

              {/* Mobile: compact */}
              <div className="flex sm:hidden gap-3 text-[9px] text-slate-500">
                <span>D: {formatScore(result.dense_score)}</span>
                <span>S: {formatScore(result.sparse_score)}</span>
                <span className="text-sky-400 font-medium">H: {formatScore(result.hybrid_score)}</span>
                <span className="text-medical-400 font-medium">R: {formatScore(result.rerank_score)}</span>
              </div>
            </div>
          ))}
        </div>

        {retrieval.results.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 w-full py-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors border-t border-white/[0.04]"
          >
            {showAll ? 'Show Less' : `Show All ${retrieval.results.length} Results`}
          </button>
        )}
      </div>
    </div>
  )
}
