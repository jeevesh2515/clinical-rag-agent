import React from 'react'
import { X, UserRound } from 'lucide-react'
import { cn } from '../lib/utils'

interface CaseSelectorProps {
  value: string | null
  onChange: (caseId: string | null) => void
}

const SYNTHETIC_CASES = [
  { id: 'htn-001', name: 'Stage 1 HTN — On Amlodipine', age: 55, bp: '142/88', status: 'Male, BP not at target, no ACEi/ARB' },
  { id: 'htn-002', name: 'HTN + CKD — On Lisinopril', age: 68, bp: '150/90', status: 'Female, eGFR 45, BP above CKD target' },
  { id: 'htn-003', name: 'HTN + Pregnancy — On Labetalol', age: 32, bp: '135/85', status: 'Female, 28wk pregnant, closer monitoring needed' },
  { id: 'htn-004', name: 'HTN + Diabetes — On Metformin', age: 72, bp: '138/86', status: 'Male, A1c 8.2%, BP not at DM target' },
  { id: 'htn-005', name: 'Resistant HTN — On 3 Agents', age: 48, bp: '152/94', status: 'Male, resistant, needs secondary workup' },
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
