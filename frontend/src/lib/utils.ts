export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatScore(value: number): string {
  return value.toFixed(3)
}

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    case 'medium':
      return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    case 'low':
      return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    default:
      return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function getIntentColor(intent: string): string {
  switch (intent) {
    case 'guideline_question':
      return 'text-sky-400 bg-sky-400/10 border-sky-400/20'
    case 'workflow_question':
      return 'text-medical-400 bg-medical-400/10 border-medical-400/20'
    case 'calculator_question':
      return 'text-violet-400 bg-violet-400/10 border-violet-400/20'
    case 'unsafe_medical_advice_request':
      return 'text-rose-400 bg-rose-400/10 border-rose-400/20'
    case 'insufficient_evidence':
      return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    case 'out_of_domain':
      return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
    default:
      return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function getIntentLabel(intent: string): string {
  switch (intent) {
    case 'guideline_question':
      return 'Guideline Question'
    case 'workflow_question':
      return 'Workflow Question'
    case 'calculator_question':
      return 'Calculator'
    case 'unsafe_medical_advice_request':
      return 'Unsafe Request'
    case 'insufficient_evidence':
      return 'Insufficient Evidence'
    case 'out_of_domain':
      return 'Out of Domain'
    default:
      return intent
  }
}
