import React, { useState } from 'react'
import { BookOpen, Wrench, Shield, Search, FileText, ListChecks, Target, ClipboardList, GitBranch, BookMarked } from 'lucide-react'
import { cn } from '../lib/utils'
import { StatusBadge } from './StatusBadge'
import { CitationsPanel } from './CitationsPanel'
import { ToolTracePanel } from './ToolTracePanel'
import { SafetyPanel } from './SafetyPanel'
import { RetrievalPanel } from './RetrievalPanel'
import type { QueryResponse } from '../types/api'

interface ClinicianPanelProps {
  response: QueryResponse
}

export const ClinicianPanel: React.FC<ClinicianPanelProps> = ({ response }) => {
  const [activeTab, setActiveTab] = useState<'citations' | 'tools' | 'safety' | 'retrieval'>('citations')

  const tabs = [
    { id: 'citations' as const, label: 'Citations', icon: BookOpen, count: response.citations.length },
    { id: 'tools' as const, label: 'Tools', icon: Wrench, count: response.tool_trace.length || response.tools_used.length },
    { id: 'safety' as const, label: 'Safety', icon: Shield },
    { id: 'retrieval' as const, label: 'Retrieval', icon: Search, count: response.retrieval.results.length },
  ]

  return (
    <div className="space-y-4">
      {/* Status badges */}
      <StatusBadge
        intent={response.intent}
        confidence={response.confidence}
        mode={response.mode}
        refusalTriggered={response.safety.refusal_triggered}
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all relative',
              activeTab === tab.id
                ? 'bg-white/[0.08] text-slate-200'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-400 font-mono ml-0.5">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'citations' && <CitationsPanel citations={response.citations} />}
        {activeTab === 'tools' && (
          <ToolTracePanel tools={response.tool_trace} toolsUsed={response.tools_used} />
        )}
        {activeTab === 'safety' && (
          <SafetyPanel safety={response.safety} refusalReason={response.refusal_reason} />
        )}
        {activeTab === 'retrieval' && <RetrievalPanel retrieval={response.retrieval} />}
      </div>

      {/* Knowledge Path (OKF vs RAG) */}
      {response.knowledge_path && (
        <div className="glass-panel p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3 h-3 text-purple-400" />
            Knowledge Route
          </h4>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full border',
              response.knowledge_path.path === 'okf'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : response.knowledge_path.path === 'okf_then_rag'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
            )}>
              {response.knowledge_path.path}
            </span>
            <span className="text-[10px] text-slate-500">{response.knowledge_path.reason}</span>
          </div>
          {response.knowledge_path.okf_concepts.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <BookMarked className="w-2.5 h-2.5" />
                OKF Concepts
              </span>
              <div className="flex flex-wrap gap-1">
                {response.knowledge_path.okf_concepts.map((concept, i) => (
                  <span key={i} className="text-[9px] font-mono text-purple-400/80 bg-purple-500/8 px-1.5 py-0.5 rounded border border-purple-500/15">
                    {concept.source_path}
                  </span>
                ))}
              </div>
            </div>
          )}
          {response.knowledge_path.rag_sources.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] text-slate-500">RAG Sources: {response.knowledge_path.rag_sources.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Clinical metadata */}
      <div className="glass-panel p-4 space-y-4">
        {/* Evidence Summary */}
        {response.evidence_summary && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-sky-400" />
              Evidence Summary
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              {response.evidence_summary}
            </p>
          </div>
        )}

        {/* Workflow Considerations */}
        {response.workflow_considerations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ListChecks className="w-3 h-3 text-medical-400" />
              Workflow Considerations
            </h4>
            <ul className="space-y-1.5">
              {response.workflow_considerations.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400 bg-white/[0.02] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-medical-400/60 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Care Gaps */}
        {response.care_gaps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-amber-400" />
              Care Gaps
            </h4>
            <ul className="space-y-1.5">
              {response.care_gaps.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-400/90 bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow-up Plan */}
        {response.follow_up_plan.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3 h-3 text-sky-400" />
              Follow-up Plan
            </h4>
            <ul className="space-y-1.5">
              {response.follow_up_plan.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400 bg-white/[0.02] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Claim Support */}
        {response.claim_support.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-medical-400" />
              Claim Support
            </h4>
            <div className="space-y-2">
              {response.claim_support.map((claim, i) => {
                const supportStyles: Record<string, string> = {
                  direct_guideline_support: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  inferred_workflow_suggestion: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  unsupported_claim: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                }
                const supportLabels: Record<string, string> = {
                  direct_guideline_support: 'Direct Guideline Support',
                  inferred_workflow_suggestion: 'Inferred Suggestion',
                  unsupported_claim: 'Unsupported',
                }
                return (
                  <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${supportStyles[claim.support_type] || supportStyles.unsupported_claim}`}>
                        {supportLabels[claim.support_type] || claim.support_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{claim.claim}</p>
                    {claim.rationale && (
                      <p className="text-[10px] text-slate-500 mt-1.5 italic">{claim.rationale}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between px-2">
        <span className="text-[10px] text-slate-500 font-medium">
          Confidence:{' '}
          <span className={cn(
            'font-mono',
            response.confidence === 'high' ? 'text-emerald-400' :
            response.confidence === 'medium' ? 'text-amber-400' :
            response.confidence === 'low' ? 'text-orange-400' : 'text-slate-500'
          )}>
            {response.confidence.charAt(0).toUpperCase() + response.confidence.slice(1)}
          </span>
        </span>
        {response.request_id && (
          <span className="text-[9px] text-slate-600 font-mono">ID: {response.request_id.slice(0, 8)}</span>
        )}
      </div>
    </div>
  )
}
