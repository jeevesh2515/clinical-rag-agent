import React from 'react'
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { SafetyFlags } from '../types/api'

interface SafetyPanelProps {
  safety: SafetyFlags
  refusalReason: string | null
}

export const SafetyPanel: React.FC<SafetyPanelProps> = ({ safety, refusalReason }) => {
  const items = [
    { label: 'Medical Disclaimer', active: safety.medical_disclaimer, icon: ShieldCheck, color: 'text-medical-400', severity: 'safe' as const },
    { label: 'Consult Clinician', active: safety.consult_licensed_clinician, icon: ShieldCheck, color: 'text-emerald-400', severity: 'info' as const },
    { label: 'Requires Review', active: safety.requires_clinician_review, icon: ShieldAlert, color: 'text-amber-400', severity: 'warning' as const },
    { label: 'Unsupported Claims', active: safety.unsupported_claims_detected, icon: AlertTriangle, color: 'text-rose-400', severity: 'danger' as const },
    { label: 'Unsafe Request', active: safety.unsafe_request, icon: AlertTriangle, color: 'text-rose-400', severity: 'danger' as const },
    { label: 'Refusal Triggered', active: safety.refusal_triggered, icon: ShieldAlert, color: 'text-rose-400', severity: 'danger' as const },
    { label: 'Prompt Injection', active: safety.prompt_injection_detected, icon: AlertTriangle, color: 'text-rose-400', severity: 'danger' as const },
  ]

  const severityCounts = items.reduce((acc, item) => {
    if (item.active) acc[item.severity] = (acc[item.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const hasConcerns = (severityCounts.danger || 0) > 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Safety Flags
        </h3>
        <div className="flex items-center gap-2">
          {hasConcerns ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {severityCounts.danger} Concern{severityCounts.danger !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              All Clear
            </span>
          )}
        </div>
      </div>

      {/* Flags */}
      <div className="glass-panel p-3">
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.label}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
                item.active
                  ? item.severity === 'danger'
                    ? 'bg-rose-500/5'
                    : item.severity === 'warning'
                      ? 'bg-amber-500/5'
                      : 'bg-emerald-500/5'
                  : 'bg-white/[0.02]'
              )}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className={cn('w-3.5 h-3.5', item.active ? item.color : 'text-slate-600')} />
                <span className={cn('text-xs', item.active ? 'text-slate-200' : 'text-slate-500')}>
                  {item.label}
                </span>
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full',
                  item.active
                    ? item.severity === 'danger'
                      ? 'bg-rose-500/10 text-rose-400'
                      : item.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-500/10 text-slate-500'
                )}
              >
                {item.active ? 'Active' : 'OK'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Refusal Reason */}
      {refusalReason && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-semibold text-rose-300">Refusal Reason</span>
          </div>
          <p className="text-xs text-rose-300/80 leading-relaxed">{refusalReason}</p>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
        <span className={hasConcerns ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
          {hasConcerns ? 'Safety concerns detected' : 'All safety checks passed'}
        </span>
        <span className="text-slate-600">·</span>
        <span>{items.filter(i => i.active).length}/{items.length} flags active</span>
      </div>
    </div>
  )
}
