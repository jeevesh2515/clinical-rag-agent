import React from 'react'
import { User, Stethoscope, Heart } from 'lucide-react'
import { cn } from '../lib/utils'

interface ModeSelectorProps {
  value: 'patient' | 'clinician'
  onChange: (mode: 'patient' | 'clinician') => void
  variant?: 'compact' | 'prominent'
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ value, onChange, variant = 'compact' }) => {
  if (variant === 'prominent') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {/* Patient Card */}
        <button
          onClick={() => onChange('patient')}
          className={cn(
            'relative p-6 rounded-xl border text-left transition-all duration-300 group',
            value === 'patient'
              ? 'bg-medical-500/10 border-medical-500/30 ring-2 ring-medical-500/20'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
          )}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
              value === 'patient' ? 'bg-medical-500/20 scale-110' : 'bg-white/[0.05]'
            )}>
              <Heart className={cn('w-6 h-6', value === 'patient' ? 'text-medical-400' : 'text-slate-500')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={cn(
                  'text-base font-semibold',
                  value === 'patient' ? 'text-medical-300' : 'text-slate-300'
                )}>
                  Patient Mode
                </h3>
                {value === 'patient' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-medical-500/20 text-medical-300 border border-medical-500/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Plain-language explanations about your health. Learn about conditions, understand test results, and prepare for clinical visits.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.06]">Educational</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.06]">Visit Prep</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.06]">Plain Language</span>
              </div>
            </div>
          </div>
        </button>

        {/* Clinician Card */}
        <button
          onClick={() => onChange('clinician')}
          className={cn(
            'relative p-6 rounded-xl border text-left transition-all duration-300 group',
            value === 'clinician'
              ? 'bg-violet-500/10 border-violet-500/30 ring-2 ring-violet-500/20'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
          )}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
              value === 'clinician' ? 'bg-violet-500/20 scale-110' : 'bg-white/[0.05]'
            )}>
              <Stethoscope className={cn('w-6 h-6', value === 'clinician' ? 'text-violet-400' : 'text-slate-500')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={cn(
                  'text-base font-semibold',
                  value === 'clinician' ? 'text-violet-300' : 'text-slate-300'
                )}>
                  Clinician Mode
                </h3>
                {value === 'clinician' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Evidence-based workflow support for care teams. Guideline lookups, care gap analysis, and follow-up planning with full citations.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.06]">Evidence Lookup</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.06]">Care Gaps</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.06]">Full Citations</span>
              </div>
            </div>
          </div>
        </button>
      </div>
    )
  }

  // Compact variant (used in the query interface)
  return (
    <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
      <button
        onClick={() => onChange('patient')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          value === 'patient'
            ? 'bg-medical-500/20 text-medical-300 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        )}
      >
        <User className="w-3.5 h-3.5" />
        Patient
      </button>
      <button
        onClick={() => onChange('clinician')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          value === 'clinician'
            ? 'bg-violet-500/20 text-violet-300 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        )}
      >
        <Stethoscope className="w-3.5 h-3.5" />
        Clinician
      </button>
    </div>
  )
}
