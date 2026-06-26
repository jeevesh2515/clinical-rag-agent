import React from 'react'
import { X, UserRound } from 'lucide-react'
import { cn } from '../lib/utils'

interface CaseSelectorProps {
  value: string | null
  onChange: (caseId: string | null) => void
}

const SYNTHETIC_CASES = [
  { id: 'htn-001', name: 'Hypertension — Newly Diagnosed', age: 52, bp: '152/94', status: 'New diagnosis, no target organ damage' },
  { id: 'htn-002', name: 'Hypertension — On Treatment', age: 64, bp: '138/86', status: 'On ACE-I, needs medication review' },
  { id: 'htn-003', name: 'Hypertension — Resistant', age: 58, bp: '164/98', status: 'On 3 medications, poor control' },
  { id: 'htn-004', name: 'Hypertension + Diabetes', age: 47, bp: '146/92', status: 'Type 2 DM, CKD stage 2' },
  { id: 'htn-005', name: 'Hypertension — Elderly', age: 78, bp: '158/82', status: 'Isolated systolic, frailty considerations' },
]

export const CaseSelector: React.FC<CaseSelectorProps> = ({ value, onChange }) => {
  const selectedCase = SYNTHETIC_CASES.find((c) => c.id === value)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 hidden sm:inline">Case:</span>
      <div className="relative">
        {selectedCase ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-medical-500/10 border border-medical-500/20">
            <div className="flex items-center gap-2">
              <UserRound className="w-3.5 h-3.5 text-medical-400" />
              <span className="text-xs text-medical-300 font-medium">{selectedCase.name}</span>
              <span className="text-[10px] text-slate-500 font-mono">{selectedCase.age}y</span>
              <span className="text-[10px] text-amber-400 font-mono">{selectedCase.bp}</span>
            </div>
            <button
              onClick={() => onChange(null)}
              className="ml-1 text-medical-400 hover:text-medical-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <select
            value=""
            onChange={(e) => onChange(e.target.value || null)}
            className={cn(
              'appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg',
              'pl-3 pr-8 py-1.5 text-xs text-slate-300',
              'focus:outline-none focus:ring-2 focus:ring-medical-500/30',
              'cursor-pointer min-w-[140px]'
            )}
          >
            <option value="">Select case...</option>
            {SYNTHETIC_CASES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.bp}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
