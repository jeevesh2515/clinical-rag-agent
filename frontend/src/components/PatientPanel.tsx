import React from 'react'
import { Heart, ShieldCheck, AlertTriangle, User, BookOpen, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import type { QueryResponse } from '../types/api'

interface PatientPanelProps {
  response: QueryResponse
}

export const PatientPanel: React.FC<PatientPanelProps> = ({ response }) => {
  const hasSafetyConcerns =
    response.safety.unsafe_request ||
    response.safety.refusal_triggered ||
    response.safety.unsupported_claims_detected

  const safetyStatus = hasSafetyConcerns
    ? 'needs-attention'
    : response.safety.consult_licensed_clinician
      ? 'consult-doctor'
      : 'safe'

  const safetyConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; title: string; message: string }> = {
    safe: {
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      title: 'Information Reviewed',
      message: 'This information is for educational purposes. Always discuss with your healthcare provider.',
    },
    'consult-doctor': {
      icon: User,
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
      border: 'border-sky-400/20',
      title: 'Share With Your Doctor',
      message: 'This information can help you prepare for your next visit. Please discuss these points with your healthcare provider.',
    },
    'needs-attention': {
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
      title: 'Important Note',
      message: 'This response has been carefully reviewed. For any health concerns, please contact your healthcare provider.',
    },
  }

  const safety = safetyConfig[safetyStatus]
  const SafetyIcon = safety.icon

  return (
    <div className="space-y-5">
      {/* Safety Check */}
      <div className={cn('p-5 rounded-xl border', safety.bg, safety.border)}>
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', safety.bg)}>
            <SafetyIcon className={cn('w-5 h-5', safety.color)} />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold mb-1', safety.color)}>{safety.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{safety.message}</p>
          </div>
        </div>
      </div>

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/15">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-[10px] font-semibold text-rose-300 uppercase tracking-wider">Medical Disclaimer</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          This information is for educational purposes only and does not replace professional medical advice,
          diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider.
        </p>
      </div>

      {/* Citations */}
      {response.citations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-medical-400" />
            Sources Used
          </h3>
          <div className="space-y-2">
            {response.citations.map((citation, index) => (
              <div key={citation.chunk_id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-slate-500 bg-white/[0.05] px-1.5 py-0.5 rounded">
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium text-slate-300">{citation.title}</span>
                </div>
                <blockquote className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-medical-500/25 pl-3">
                  &ldquo;{citation.quote}&rdquo;
                </blockquote>
                {citation.organization && (
                  <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                    <Info className="w-2.5 h-2.5" />
                    From {citation.organization}
                    {citation.publication_year && `, published ${citation.publication_year}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patient Education Draft */}
      {response.patient_education_draft && (
        <div className="p-5 rounded-xl bg-medical-500/5 border border-medical-500/15">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-medical-500/15 flex items-center justify-center">
              <Heart className="w-4 h-4 text-medical-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-medical-300">What This Means for You</h3>
              <p className="text-[10px] text-slate-500">Education draft — review required</p>
            </div>
          </div>
          <div className="text-xs text-slate-300 leading-relaxed space-y-2">
            {response.patient_education_draft.split('\n').filter(Boolean).length > 1
              ? response.patient_education_draft.split('\n').filter(Boolean).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))
              : <p>{response.patient_education_draft}</p>
            }
          </div>
          <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <p className="text-[10px] text-amber-400/80 leading-relaxed">
              <span className="font-semibold">Review Required:</span> This draft is intended for your clinician to review before sharing.
            </p>
          </div>
        </div>
      )}

      {/* Confidence indicator */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Confidence:</span>
          <span
            className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full border',
              response.confidence === 'high'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : response.confidence === 'medium'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : response.confidence === 'low'
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
            )}
          >
            {response.confidence.charAt(0).toUpperCase() + response.confidence.slice(1)}
          </span>
        </div>
        {response.request_id && (
          <span className="text-[9px] text-slate-600 font-mono">ID: {response.request_id.slice(0, 8)}</span>
        )}
      </div>
    </div>
  )
}
