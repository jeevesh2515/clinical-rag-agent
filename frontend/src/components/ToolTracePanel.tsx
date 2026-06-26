import React from 'react'
import { Wrench, ArrowRight, Cog, ArrowRightCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ToolTrace } from '../types/api'

interface ToolTracePanelProps {
  tools: ToolTrace[]
  toolsUsed: string[]
}

export const ToolTracePanel: React.FC<ToolTracePanelProps> = ({ tools, toolsUsed }) => {
  if (tools.length === 0 && toolsUsed.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
          <Cog className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">No tools were invoked for this request.</p>
        <p className="text-xs text-slate-600 mt-1">
          Tool traces appear when the agent uses calculator, case lookup, or other tools.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-violet-400" />
          Tool Trace
          <span className="text-[10px] font-mono text-slate-500 font-normal">({tools.length || toolsUsed.length})</span>
        </h3>
      </div>

      <div className="glass-panel p-4">
        {/* Detailed tool timeline */}
        {tools.length > 0 && (
          <div className="space-y-0">
            {tools.map((tool, i) => (
              <div
                key={i}
                className={cn(
                  'relative pl-7 pb-4',
                  i < tools.length - 1 && 'border-l border-white/[0.08]'
                )}
              >
                <div className={cn(
                  'timeline-dot',
                  'border-violet-500/40 bg-violet-500/15'
                )} />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-violet-300">{tool.name}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                    <span className="text-slate-400">Input:</span> {tool.input_summary}
                  </div>
                  <div className="text-[11px] text-slate-400 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                    <span className="text-slate-400">Output:</span> {tool.output_summary}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Simple tool list fallback */}
        {tools.length === 0 && toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {toolsUsed.map((tool) => (
              <span
                key={tool}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20 flex items-center gap-1.5"
              >
                <ArrowRightCircle className="w-3 h-3" />
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-600 text-center pt-1">
        Tool trace shows deterministic agent reasoning steps
      </div>
    </div>
  )
}
