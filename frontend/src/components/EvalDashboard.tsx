import React, { useEffect, useState } from 'react'
import { BarChart3, Play, Loader2, AlertCircle, CheckCircle2, XCircle, TrendingUp, Clock } from 'lucide-react'
import { cn } from '../lib/utils'
import { useApi } from '../hooks/useApi'

interface MetricCard {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  format?: 'number' | 'percent'
}

function MetricCard({ label, value, icon: Icon, color }: MetricCard) {
  return (
    <div className="glass-panel p-4 hover-lift transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${color.replace('text', 'bg').replace(/\d{3}/, '500/15')} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div className={`text-2xl font-bold font-mono ${color} mb-0.5`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

interface BarChartProps {
  data: { label: string; value: number; color: string }[]
  maxValue?: number
}

function BarChart({ data, maxValue }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 0.01)
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{item.label}</span>
            <span className={cn('font-mono font-medium', item.color)}>
              {(item.value * 100).toFixed(0)}%
            </span>
          </div>
          <div className="score-bar">
            <div
              className={`score-bar-fill ${item.color.replace('text', 'bg')}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export const EvalDashboard: React.FC = () => {
  const { runEval, getEvalResults, loading } = useApi()
  const [results, setResults] = useState<Record<string, unknown> | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    getEvalResults().then((data) => {
      if (data?.status === 'ok' && data.results) {
        setResults(data.results as Record<string, unknown>)
      }
    })
  }, [getEvalResults])

  const handleRun = async () => {
    const data = await runEval()
    if (data && data.results) {
      setResults(data.results as Record<string, unknown>)
      setHasRun(true)
      setShowRaw(false)
    }
  }

  // Parse expected metric keys from results
  const metrics = results ? extractMetrics(results) : []
  const chartData = results ? extractChartData(results) : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Evaluation Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            RAGAS-compatible quality metrics and regression testing for clinical answers
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="btn-primary-emerald text-xs"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Running...' : 'Run Evaluation'}
        </button>
      </div>

      {!results && !hasRun && (
        /* Empty state */
        <div className="glass-panel p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-5">
            <BarChart3 className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 mb-2">No evaluation results available.</p>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Run the evaluation suite against the golden question set to see quality metrics,
            refusal correctness, tool routing accuracy, and more.
          </p>
          <button
            onClick={handleRun}
            disabled={loading}
            className="mt-6 btn-primary-emerald"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Evaluation Suite
          </button>
        </div>
      )}

      {results && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Metric Cards */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((m, i) => (
                <MetricCard key={i} {...m} />
              ))}
            </div>
          )}

          {/* Chart Area */}
          {chartData.length > 0 && (
            <div className="glass-panel p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Quality Metrics
              </h3>
              <BarChart data={chartData} />
            </div>
          )}

          {/* Summary stats */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Results Summary
            </h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Status: <span className="text-emerald-400 font-medium">{results.status as string || 'Unknown'}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <BarChart3 className="w-4 h-4 text-medical-400" />
                <span>Metrics: <span className="text-slate-300 font-mono font-medium">{metrics.length}</span></span>
              </div>
            </div>
          </div>

          {/* Raw JSON toggle */}
          <div className="glass-panel overflow-hidden">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between px-6 py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors border-b border-white/[0.06]"
            >
              <span>Raw Evaluation Data</span>
              <span className="font-mono">{showRaw ? 'Hide' : 'Show'}</span>
            </button>
            {showRaw && (
              <div className="p-6 animate-fade-in">
                <pre className="text-xs text-slate-400 font-mono overflow-x-auto scrollbar-thin max-h-96">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function extractMetrics(results: Record<string, unknown>): MetricCard[] {
  const metrics: MetricCard[] = []
  const seen = new Set<string>()

  // Walk the results object looking for numeric metrics
  const walk = (obj: Record<string, unknown>, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const label = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'number' && !seen.has(label)) {
        seen.add(label)
        const isPercent = value >= 0 && value <= 1
        const color = value >= 0.8
          ? 'text-emerald-400'
          : value >= 0.6
            ? 'text-amber-400'
            : 'text-rose-400'
        const icon = value >= 0.8
          ? CheckCircle2
          : value >= 0.6
            ? AlertCircle
            : XCircle

        metrics.push({
          label: formatLabel(key),
          value: isPercent ? `${(value * 100).toFixed(1)}%` : value,
          icon,
          color,
        })
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, label)
      }
    }
  }

  walk(results)
  return metrics.slice(0, 8)
}

function extractChartData(results: Record<string, unknown>): { label: string; value: number; color: string }[] {
  const data: { label: string; value: number; color: string }[] = []

  const walk = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number' && value >= 0 && value <= 1) {
        const color = value >= 0.8
          ? 'text-emerald-400'
          : value >= 0.6
            ? 'text-amber-400'
            : 'text-rose-400'
        data.push({ label: formatLabel(key), value, color })
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        walk(value as Record<string, unknown>)
      }
    }
  }

  walk(results)
  return data.slice(0, 10)
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
