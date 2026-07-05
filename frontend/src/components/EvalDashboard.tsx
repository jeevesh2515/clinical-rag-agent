import React, { useEffect, useState } from 'react'
import { BarChart3, Play, Loader2, AlertCircle, CheckCircle2, XCircle, TrendingUp, Clock, Database, Shield, Wrench, FileText, MessageSquare, Activity } from 'lucide-react'
import { cn } from '../lib/utils'
import { useApi } from '../hooks/useApi'

const DATASET_ICONS: Record<string, React.ElementType> = {
  guideline_questions: FileText,
  workflow_cases: Activity,
  refusals: Shield,
  prompt_injection: AlertCircle,
  insufficient_evidence: MessageSquare,
  tool_routing: Wrench,
}

const DATASET_LABELS: Record<string, string> = {
  guideline_questions: 'Guideline Questions',
  workflow_cases: 'Workflow Cases',
  refusals: 'Refusals',
  prompt_injection: 'Prompt Injection',
  insufficient_evidence: 'Insufficient Evidence',
  tool_routing: 'Tool Routing',
}

interface MetricData {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}

interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  threshold?: number
}

function MetricCard({ label, value, icon: Icon, color, threshold }: MetricCardProps) {
  return (
    <div className="glass-panel p-4 hover-lift transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${color.replace('text', 'bg').replace(/\d{3}/, '500/15')} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div className={`text-2xl font-bold font-mono ${color} mb-0.5`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      {threshold !== undefined && (
        <div className="text-[9px] text-slate-600 mt-0.5">Threshold: {(threshold * 100).toFixed(0)}%</div>
      )}
    </div>
  )
}

interface BarChartProps {
  data: { label: string; value: number; color: string; threshold?: number }[]
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
          {item.threshold !== undefined && (
            <div className="flex justify-between text-[9px] text-slate-600">
              <span>Threshold: {(item.threshold * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface DatasetCardProps {
  name: string
  data: Record<string, unknown>
}

function DatasetCard({ name, data }: DatasetCardProps) {
  const Icon = DATASET_ICONS[name] || Database
  const label = DATASET_LABELS[name] || name.replace(/_/g, ' ')
  const metrics = data.metrics as Record<string, number> | undefined
  const passed = data.passed_thresholds as Record<string, boolean> | undefined
  const datasetSize = data.dataset_size as number | undefined
  const latency = data.latency_seconds as number | undefined

  if (!metrics) return null

  const entries = Object.entries(metrics).filter(([, v]) => typeof v === 'number')
  const passedCount = passed ? Object.values(passed).filter(Boolean).length : 0
  const totalCount = passed ? Object.keys(passed).length : 0

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-200">{label}</h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {datasetSize !== undefined && <span>{datasetSize} queries</span>}
          {latency !== undefined && <span>{latency.toFixed(1)}s</span>}
          {totalCount > 0 && (
            <span className={cn(
              'font-medium',
              passedCount === totalCount ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {passedCount}/{totalCount} passed
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {entries.map(([key, value]) => {
          const isPercent = value >= 0 && value <= 1
          const threshold = METRIC_THRESHOLDS_MAP[key]
          const passedMetric = passed?.[key]
          const color = passedMetric === false
            ? 'text-rose-400'
            : value >= 0.8
              ? 'text-emerald-400'
              : value >= 0.6
                ? 'text-amber-400'
                : 'text-rose-400'
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{formatLabel(key)}</span>
              <div className="flex items-center gap-2">
                {threshold !== undefined && (
                  <span className="text-slate-600">≥{(threshold * 100).toFixed(0)}%</span>
                )}
                <span className={cn('font-mono font-medium', color)}>
                  {isPercent ? `${(value * 100).toFixed(1)}%` : value}
                </span>
                {passedMetric !== undefined && (
                  passedMetric
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    : <XCircle className="w-3 h-3 text-rose-500" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const METRIC_THRESHOLDS_MAP: Record<string, number> = {
  refusal_correctness: 0.95,
  refusal_precision: 0.95,
  tool_selection_accuracy: 0.90,
  intent_accuracy: 0.90,
  citation_presence_rate: 0.95,
  care_gap_detection_rate: 0.80,
  prompt_injection_detection_rate: 0.95,
  refusal_message_quality: 0.95,
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

  // Parse result structure
  const aggregate = (results?.aggregate as Record<string, unknown>) || {}
  const datasets = (results?.datasets as Record<string, unknown>) || {}
  const datasetEntries = Object.entries(datasets)
  const aggregateMetrics = extractMetrics(aggregate)
  const aggregateChartData = extractChartData(aggregate)
  const allPassed = (aggregate.all_passed as boolean) ?? false
  const hasAggregateMetrics = aggregate.metrics != null

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
            Multi-dataset deterministic metrics with CI quality gates for clinical answers
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
            Run the evaluation suite across all 6 datasets to see quality metrics,
            refusal correctness, tool routing accuracy, citation presence, and more.
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
          {/* Overall Status Banner */}
          {hasAggregateMetrics && (
            <div className={cn(
              'glass-panel p-5 border-l-4',
              allPassed ? 'border-l-emerald-500' : 'border-l-rose-500'
            )}>
              <div className="flex items-center gap-3">
                {allPassed
                  ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  : <XCircle className="w-6 h-6 text-rose-400" />
                }
                <div>
                  <div className={cn(
                    'text-sm font-semibold',
                    allPassed ? 'text-emerald-400' : 'text-rose-400'
                  )}>
                    {allPassed ? 'All Quality Gates Passed' : 'Some Quality Gates Failed'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {allPassed
                      ? 'All evaluation metrics meet their CI thresholds.'
                      : 'One or more metrics are below their required thresholds. Check individual dataset results.'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Aggregate Metric Cards */}
          {aggregateMetrics.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Aggregate Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {aggregateMetrics.map((m, i) => {
                  const thresholdKey = Object.keys(METRIC_THRESHOLDS_MAP).find(
                    k => formatLabel(k) === m.label
                  )
                  const threshold = thresholdKey ? METRIC_THRESHOLDS_MAP[thresholdKey] : undefined
                  return <MetricCard key={i} {...m} threshold={threshold} />
                })}
              </div>
            </div>
          )}

          {/* Aggregate Chart */}
          {aggregateChartData.length > 0 && (
            <div className="glass-panel p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Quality Metrics
              </h3>
              <BarChart data={aggregateChartData.map(d => {
                const thresholdKey = Object.keys(METRIC_THRESHOLDS_MAP).find(
                  k => formatLabel(k) === d.label
                )
                return { ...d, threshold: thresholdKey ? METRIC_THRESHOLDS_MAP[thresholdKey] : undefined }
              })} />
            </div>
          )}

          {/* Per-Dataset Cards */}
          {datasetEntries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                Per-Dataset Results
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {datasetEntries.map(([name, data]) => (
                  <DatasetCard key={name} name={name} data={data as Record<string, unknown>} />
                ))}
              </div>
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
                <CheckCircle2 className={cn('w-4 h-4', allPassed ? 'text-emerald-400' : 'text-rose-400')} />
                <span>Status: <span className={cn('font-medium', allPassed ? 'text-emerald-400' : 'text-rose-400')}>{allPassed ? 'PASSED' : 'FAILED'}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <BarChart3 className="w-4 h-4 text-medical-400" />
                <span>Datasets: <span className="text-slate-300 font-mono font-medium">{datasetEntries.length}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Database className="w-4 h-4 text-sky-400" />
                <span>Metrics: <span className="text-slate-300 font-mono font-medium">{aggregateMetrics.length}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Activity className="w-4 h-4 text-violet-400" />
                <span>Mode: <span className="text-slate-300 font-mono font-medium">{results.mode as string}</span></span>
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

function extractMetrics(results: Record<string, unknown>): MetricData[] {
  const metrics: MetricData[] = []
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
