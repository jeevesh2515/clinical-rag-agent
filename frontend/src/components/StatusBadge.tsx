import React from 'react'
import { cn, getConfidenceColor, getIntentColor, getIntentLabel } from '../lib/utils'

interface StatusBadgeProps {
  intent: string
  confidence: string
  mode: string
  refusalTriggered: boolean
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  intent,
  confidence,
  mode,
  refusalTriggered,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', getIntentColor(intent))}>
        {getIntentLabel(intent)}
      </span>
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', getConfidenceColor(confidence))}>
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
      </span>
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
        mode === 'clinician'
          ? 'text-violet-400 bg-violet-400/10 border-violet-400/20'
          : 'text-medical-400 bg-medical-400/10 border-medical-400/20'
      )}>
        {mode === 'clinician' ? 'Clinician' : 'Patient'}
      </span>
      {refusalTriggered && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border text-rose-400 bg-rose-400/10 border-rose-400/20">
          Refused
        </span>
      )}
    </div>
  )
}
