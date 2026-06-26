import React, { useState, useMemo } from 'react'
import { Activity, Scale, Ruler, Weight, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import { calculateBMI, getBMICategory, BMI_RANGES } from '../lib/bmi'

export const BMICalculator: React.FC = () => {
  const [isMetric, setIsMetric] = useState(true)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')

  const totalHeightInches = isMetric
    ? 0
    : (parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0)

  const heightValue = isMetric ? parseFloat(height) : totalHeightInches
  const weightValue = parseFloat(weight)

  const result = useMemo(() => {
    const bmi = calculateBMI(heightValue, weightValue, isMetric)
    if (bmi === null) return null
    return getBMICategory(bmi)
  }, [heightValue, weightValue, isMetric])

  const gaugePercent = result ? Math.min((result.bmi / 40) * 100, 100) : 0

  const handleReset = () => {
    setHeight('')
    setWeight('')
    setHeightFt('')
    setHeightIn('')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="glass-panel-glow p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-medical-500/20 to-medical-600/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-medical-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">BMI Calculator</h2>
              <p className="text-xs text-slate-500">Body Mass Index estimator</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] transition-all border border-white/[0.06]"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
        </div>

        {/* Unit Toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6">
          <button
            onClick={() => setIsMetric(true)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              isMetric
                ? 'bg-medical-500/15 text-medical-400 border border-medical-500/20 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Scale className="w-3.5 h-3.5" />
            Metric
          </button>
          <button
            onClick={() => setIsMetric(false)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              !isMetric
                ? 'bg-medical-500/15 text-medical-400 border border-medical-500/20 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Weight className="w-3.5 h-3.5" />
            Imperial
          </button>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {isMetric ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Ruler className="w-3 h-3" />
                Height (cm)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 175"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-medical-500/40 focus:ring-1 focus:ring-medical-500/20 transition-all"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Ruler className="w-3 h-3" />
                  Feet
                </label>
                <input
                  type="number"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  placeholder="5"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-medical-500/40 focus:ring-1 focus:ring-medical-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                  Inches
                </label>
                <input
                  type="number"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                  placeholder="9"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-medical-500/40 focus:ring-1 focus:ring-medical-500/20 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Weight className="w-3 h-3" />
              Weight ({isMetric ? 'kg' : 'lbs'})
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={isMetric ? 'e.g. 70' : 'e.g. 154'}
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-medical-500/40 focus:ring-1 focus:ring-medical-500/20 transition-all"
            />
          </div>
        </div>

        {/* Results */}
        {result ? (
          <div className="space-y-6 animate-fade-in">
            {/* BMI Display */}
            <div className="text-center py-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Your BMI</p>
              <p className={cn('text-5xl sm:text-6xl font-bold font-mono tracking-tight', result.color)}>
                {result.bmi}
              </p>
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full text-xs font-medium border',
                result.category === 'underweight' && 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                result.category === 'healthy' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                result.category === 'overweight' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                result.category === 'obese' && 'bg-rose-500/10 text-rose-400 border-rose-500/20',
              )}>
                <Activity className="w-3 h-3" />
                {result.range}
              </div>
            </div>

            {/* Visual Gauge */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
                <span>0</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>50</span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden bg-white/[0.06]">
                <div
                  className="absolute inset-0 flex"
                  style={{ clipPath: `inset(0 ${100 - gaugePercent}% 0 0)` }}
                >
                  <div className="flex-1 bg-sky-400" />
                  <div className="flex-1 bg-emerald-400" />
                  <div className="flex-1 bg-amber-400" />
                  <div className="flex-1 bg-rose-400" />
                </div>
                {/* Marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-surface-950 shadow-lg transition-all duration-500"
                  style={{ left: `calc(${gaugePercent}% - 8px)` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                <span>Underweight</span>
                <span>Healthy</span>
                <span>Overweight</span>
                <span>Obese</span>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-medical-400" />
                Recommendations
              </h4>
              <div className="space-y-1.5">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                      result.category === 'underweight' && 'bg-sky-400',
                      result.category === 'healthy' && 'bg-emerald-400',
                      result.category === 'overweight' && 'bg-amber-400',
                      result.category === 'obese' && 'bg-rose-400',
                    )} />
                    <span className="text-xs text-slate-400 leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reference Table */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.06]">
                <h4 className="text-xs font-semibold text-slate-300">BMI Categories</h4>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {BMI_RANGES.map((range) => (
                  <div
                    key={range.category}
                    className={cn(
                      'flex items-center justify-between px-4 py-2.5 text-xs transition-colors',
                      result.category === range.category ? 'bg-white/[0.04]' : ''
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn('w-2 h-2 rounded-full', range.barColor)} />
                      <span className={cn('font-medium', range.color)}>{range.label}</span>
                    </div>
                    <span className="text-slate-500">
                      {range.min} – {range.max === 50 ? '50+' : range.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300/70 leading-relaxed">
                BMI is a screening tool, not a diagnostic measure. It does not account for
                muscle mass, bone density, body composition, or ethnic differences. Always
                consult a healthcare provider for a complete health assessment.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4 border border-white/[0.06]">
              <Scale className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500 mb-1">Enter your height and weight</p>
            <p className="text-[10px] text-slate-600">
              Your BMI and health category will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
