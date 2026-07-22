import { useState, useEffect } from 'react'
import { Scale, Check, Sparkles } from 'lucide-react'

export interface HealthVitals {
  height_cm: number
  weight_kg: number
  height_ft?: number
  height_in?: number
  weight_lbs?: number
  unit_system: 'metric' | 'imperial'
  bmi: number
  category: string
  updated_at: string
}

interface BMICalculatorProps {
  user?: any
  onSaveVitals?: (vitals: HealthVitals) => void
  className?: string
}

export default function BMICalculator({ user, onSaveVitals, className = '' }: BMICalculatorProps) {
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric')
  
  // Metric
  const [heightCm, setHeightCm] = useState<number>(170)
  const [weightKg, setWeightKg] = useState<number>(70)
  
  // Imperial
  const [heightFt, setHeightFt] = useState<number>(5)
  const [heightIn, setHeightIn] = useState<number>(7)
  const [weightLbs, setWeightLbs] = useState<number>(154)

  const [savedSuccess, setSavedSuccess] = useState(false)

  // Load existing vitals if available
  useEffect(() => {
    if (user) {
      const storageKey = `cw_storage_${(user.id || user.email || 'user').replace(/[^a-zA-Z0-9_-]/g, '_')}_vitals`
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed: HealthVitals = JSON.parse(raw)
          if (parsed.unit_system) setUnitSystem(parsed.unit_system)
          if (parsed.height_cm) setHeightCm(parsed.height_cm)
          if (parsed.weight_kg) setWeightKg(parsed.weight_kg)
          if (parsed.height_ft) setHeightFt(parsed.height_ft)
          if (parsed.height_in) setHeightIn(parsed.height_in)
          if (parsed.weight_lbs) setWeightLbs(parsed.weight_lbs)
        }
      } catch {}
    }
  }, [user])

  // Calculate BMI
  let computedBmi = 0
  if (unitSystem === 'metric') {
    const heightMeters = heightCm / 100
    if (heightMeters > 0) {
      computedBmi = Number((weightKg / (heightMeters * heightMeters)).toFixed(1))
    }
  } else {
    const totalInches = (heightFt * 12) + heightIn
    if (totalInches > 0) {
      computedBmi = Number((703 * (weightLbs / (totalInches * totalInches))).toFixed(1))
    }
  }

  // Determine WHO Category & HTN Risk
  const getBMIDetails = (bmi: number) => {
    if (bmi < 18.5) {
      return {
        category: 'Underweight',
        color: 'bg-blue-600 text-white',
        borderColor: 'border-blue-600',
        badge: 'Nutritional Risk',
        description: 'Below optimal weight. Ensure adequate caloric & protein intake.',
        sbpImpact: 'Low HTN risk, monitor for hypotension.',
        gaugePercent: Math.min(Math.max((bmi / 40) * 100, 10), 100)
      }
    } else if (bmi >= 18.5 && bmi < 25.0) {
      return {
        category: 'Normal Weight',
        color: 'bg-emerald-600 text-white',
        borderColor: 'border-emerald-600',
        badge: 'Optimal Category',
        description: 'Healthy weight range. Lowest baseline risk for cardiovascular disease.',
        sbpImpact: 'Baseline optimal BP expected.',
        gaugePercent: Math.min(Math.max((bmi / 40) * 100, 20), 100)
      }
    } else if (bmi >= 25.0 && bmi < 30.0) {
      return {
        category: 'Overweight',
        color: 'bg-amber-500 text-white',
        borderColor: 'border-amber-500',
        badge: 'Increased Risk',
        description: 'Above optimal weight. Modest increase in hypertension risk.',
        sbpImpact: 'Losing 5kg can reduce SBP by ~5 mmHg.',
        gaugePercent: Math.min(Math.max((bmi / 40) * 100, 45), 100)
      }
    } else if (bmi >= 30.0 && bmi < 35.0) {
      return {
        category: 'Obesity Class I',
        color: 'bg-orange-600 text-white',
        borderColor: 'border-orange-600',
        badge: 'High Risk',
        description: 'Moderate obesity. DASH diet & physical activity recommended.',
        sbpImpact: 'Significant HTN contribution (+8–12 mmHg SBP).',
        gaugePercent: Math.min(Math.max((bmi / 40) * 100, 70), 100)
      }
    } else if (bmi >= 35.0 && bmi < 40.0) {
      return {
        category: 'Obesity Class II',
        color: 'bg-red-600 text-white',
        borderColor: 'border-red-600',
        badge: 'Very High Risk',
        description: 'Severe obesity. High risk of comorbid hypertension & diabetes.',
        sbpImpact: 'Targeted lifestyle + clinical pharmacotherapy indicated.',
        gaugePercent: Math.min(Math.max((bmi / 40) * 100, 85), 100)
      }
    } else {
      return {
        category: 'Obesity Class III',
        color: 'bg-rose-700 text-white',
        borderColor: 'border-rose-700',
        badge: 'Extremely High Risk',
        description: 'Very severe obesity. Comprehensive medical consultation advised.',
        sbpImpact: 'High SBP impact; weight loss yields major BP drop.',
        gaugePercent: 100
      }
    }
  }

  const details = getBMIDetails(computedBmi)

  const handleSave = () => {
    const vitals: HealthVitals = {
      height_cm: heightCm,
      weight_kg: weightKg,
      height_ft: heightFt,
      height_in: heightIn,
      weight_lbs: weightLbs,
      unit_system: unitSystem,
      bmi: computedBmi,
      category: details.category,
      updated_at: new Date().toISOString()
    }

    if (user) {
      const storageKey = `cw_storage_${(user.id || user.email || 'user').replace(/[^a-zA-Z0-9_-]/g, '_')}_vitals`
      localStorage.setItem(storageKey, JSON.stringify(vitals))
    }

    if (onSaveVitals) {
      onSaveVitals(vitals)
    }

    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border-4 border-[#1a1a1a] dark:border-white p-4 sm:p-6 clinical-shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] dark:border-white pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-accent text-white flex items-center justify-center border-2 border-[#1a1a1a] dark:border-white font-bold">
            <Scale size={18} />
          </div>
          <div>
            <h3 className="font-headline-md text-sm sm:text-base uppercase font-bold text-[#1a1a1a] dark:text-white">
              Clinical BMI & Cardiovascular Risk Calculator
            </h3>
            <p className="text-[10px] text-[#1a1a1a]/60 dark:text-white/60 uppercase font-bold tracking-wider font-code-sm">
              WHO BMI Categories & Antihypertensive Impact Assessment
            </p>
          </div>
        </div>

        {/* Unit Selector Buttons */}
        <div className="flex border-2 border-[#1a1a1a] dark:border-white bg-[#f0f0f0] dark:bg-slate-800 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setUnitSystem('metric')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
              unitSystem === 'metric'
                ? 'bg-brand-accent text-white border border-[#1a1a1a]'
                : 'text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
            }`}
          >
            Metric (cm/kg)
          </button>
          <button
            type="button"
            onClick={() => setUnitSystem('imperial')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
              unitSystem === 'imperial'
                ? 'bg-brand-accent text-white border border-[#1a1a1a]'
                : 'text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
            }`}
          >
            Imperial (ft/in/lbs)
          </button>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Height Controls */}
        <div className="space-y-3 bg-[#fafafa] dark:bg-slate-950 p-3 sm:p-4 border-2 border-[#1a1a1a] dark:border-white">
          <div className="flex justify-between items-center text-xs font-bold uppercase font-code-sm text-[#1a1a1a] dark:text-white">
            <span>Height</span>
            <span className="text-brand-accent">
              {unitSystem === 'metric' ? `${heightCm} cm` : `${heightFt} ft ${heightIn} in`}
            </span>
          </div>

          {unitSystem === 'metric' ? (
            <div className="space-y-2">
              <input
                type="range"
                min="100"
                max="220"
                value={heightCm}
                onChange={e => setHeightCm(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-slate-800 appearance-none border border-[#1a1a1a] dark:border-white accent-brand-accent cursor-pointer"
              />
              <input
                type="number"
                min="100"
                max="220"
                value={heightCm}
                onChange={e => setHeightCm(Number(e.target.value))}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-2 text-[#1a1a1a] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Feet</label>
                <input
                  type="number"
                  min="3"
                  max="7"
                  value={heightFt}
                  onChange={e => setHeightFt(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-2 text-[#1a1a1a] dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Inches</label>
                <input
                  type="number"
                  min="0"
                  max="11"
                  value={heightIn}
                  onChange={e => setHeightIn(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-2 text-[#1a1a1a] dark:text-white focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Weight Controls */}
        <div className="space-y-3 bg-[#fafafa] dark:bg-slate-950 p-3 sm:p-4 border-2 border-[#1a1a1a] dark:border-white">
          <div className="flex justify-between items-center text-xs font-bold uppercase font-code-sm text-[#1a1a1a] dark:text-white">
            <span>Weight</span>
            <span className="text-brand-accent">
              {unitSystem === 'metric' ? `${weightKg} kg` : `${weightLbs} lbs`}
            </span>
          </div>

          {unitSystem === 'metric' ? (
            <div className="space-y-2">
              <input
                type="range"
                min="30"
                max="180"
                value={weightKg}
                onChange={e => setWeightKg(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-slate-800 appearance-none border border-[#1a1a1a] dark:border-white accent-brand-accent cursor-pointer"
              />
              <input
                type="number"
                min="30"
                max="180"
                value={weightKg}
                onChange={e => setWeightKg(Number(e.target.value))}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-2 text-[#1a1a1a] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="range"
                min="66"
                max="400"
                value={weightLbs}
                onChange={e => setWeightLbs(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-slate-800 appearance-none border border-[#1a1a1a] dark:border-white accent-brand-accent cursor-pointer"
              />
              <input
                type="number"
                min="66"
                max="400"
                value={weightLbs}
                onChange={e => setWeightLbs(Number(e.target.value))}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border-2 border-[#1a1a1a] dark:border-white p-2 text-[#1a1a1a] dark:text-white focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Results Display */}
      <div className="bg-[#1a1a1a] dark:bg-slate-950 text-white p-4 sm:p-5 border-2 border-[#1a1a1a] dark:border-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Body Mass Index (BMI)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-headline-xl">{computedBmi}</span>
              <span className="text-xs font-bold text-gray-400 font-code-sm">kg/m²</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">WHO Classification</span>
            <span className={`inline-block px-3 py-1 text-xs font-black uppercase border-2 border-white tracking-wider ${details.color}`}>
              {details.category}
            </span>
          </div>
        </div>

        {/* Visual BMI Range Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px] font-bold uppercase text-gray-400 font-code-sm">
            <span>Underweight (&lt;18.5)</span>
            <span>Normal (18.5-24.9)</span>
            <span>Overweight (25-29.9)</span>
            <span>Obese (&ge;30)</span>
          </div>
          <div className="w-full h-3 bg-slate-800 border border-white/40 overflow-hidden relative flex">
            <div className="h-full bg-blue-500 w-[18.5%]"></div>
            <div className="h-full bg-emerald-500 w-[26.5%]"></div>
            <div className="h-full bg-amber-500 w-[25%]"></div>
            <div className="h-full bg-red-600 w-[30%]"></div>
            {/* Pointer Pin */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white border border-black shadow-lg transition-all duration-300"
              style={{ left: `${Math.min(Math.max((computedBmi / 40) * 100, 2), 98)}%` }}
            />
          </div>
        </div>

        {/* Hypertension & Clinical Assessment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-code-sm border-t border-white/10">
          <div>
            <span className="text-gray-400 uppercase font-bold block text-[10px]">Clinical Description:</span>
            <p className="text-white font-medium mt-0.5">{details.description}</p>
          </div>
          <div>
            <span className="text-brand-accent uppercase font-bold block text-[10px]">Hypertension Guidelines Impact:</span>
            <p className="text-teal-300 font-medium mt-0.5">{details.sbpImpact}</p>
          </div>
        </div>
      </div>

      {/* Save Button for Logged In User */}
      {user && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white font-headline-md border-2 border-[#1a1a1a] dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all text-xs font-bold uppercase tracking-wider"
          >
            {savedSuccess ? (
              <>
                <Check size={14} className="text-emerald-300" />
                <span>Health Vitals Saved to Profile!</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Save Vitals to My Profile</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
