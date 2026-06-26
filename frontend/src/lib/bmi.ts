export interface BMIResult {
  bmi: number
  category: BMICategory
  color: string
  range: string
  recommendations: string[]
}

export type BMICategory = 'underweight' | 'healthy' | 'overweight' | 'obese'

export const BMI_RANGES = [
  { min: 0, max: 18.5, category: 'underweight' as BMICategory, label: 'Underweight', color: 'text-sky-400', barColor: 'bg-sky-400' },
  { min: 18.5, max: 25, category: 'healthy' as BMICategory, label: 'Healthy', color: 'text-emerald-400', barColor: 'bg-emerald-400' },
  { min: 25, max: 30, category: 'overweight' as BMICategory, label: 'Overweight', color: 'text-amber-400', barColor: 'bg-amber-400' },
  { min: 30, max: 50, category: 'obese' as BMICategory, label: 'Obese', color: 'text-rose-400', barColor: 'bg-rose-400' },
]

const RECOMMENDATIONS: Record<BMICategory, string[]> = {
  underweight: [
    'Consult a healthcare provider to identify underlying causes',
    'Consider nutrient-dense foods to support healthy weight gain',
    'Incorporate strength training to build muscle mass',
    'Track your calorie intake to ensure sufficient nutrition',
  ],
  healthy: [
    'Maintain your current lifestyle with balanced nutrition',
    'Stay active with at least 150 minutes of moderate exercise per week',
    'Continue regular health screenings and check-ups',
    'Keep a consistent sleep schedule of 7-9 hours per night',
  ],
  overweight: [
    'Consider a modest calorie reduction of 300-500 calories per day',
    'Incorporate 30-60 minutes of moderate activity most days',
    'Focus on whole foods: vegetables, lean proteins, and fiber',
    'Track your portions and consider consulting a dietitian',
  ],
  obese: [
    'Consult a healthcare provider for a personalized plan',
    'Aim for 200-300 minutes of moderate activity per week',
    'Focus on sustainable dietary changes rather than fad diets',
    'Consider behavioral counseling or structured weight management programs',
  ],
}

export function getBMICategory(bmi: number): BMIResult {
  const range = BMI_RANGES.find((r) => bmi >= r.min && bmi < r.max) ?? BMI_RANGES[3]
  return {
    bmi: Math.round(bmi * 10) / 10,
    category: range.category,
    color: range.color,
    range: range.label,
    recommendations: RECOMMENDATIONS[range.category],
  }
}

export function calculateBMI(height: number, weight: number, isMetric: boolean): number | null {
  if (!height || !weight || height <= 0 || weight <= 0) return null
  if (isMetric) {
    const heightInM = height / 100
    return weight / (heightInM * heightInM)
  } else {
    return (weight / (height * height)) * 703
  }
}
