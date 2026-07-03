import { useState, useCallback } from 'react'
import type { QueryRequest, QueryResponse, HealthResponse, DocumentsResponse, SourcesResponse, EvalResult, CasesResponse } from '../types/api'

const API_BASE = '' // Uses Vite proxy to /api -> backend

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    setError(message)
    console.error('API Error:', err)
  }, [])

  const query = useCallback(async (payload: QueryRequest): Promise<QueryResponse | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        throw new Error(err.error?.message || `HTTP ${res.status}`)
      }
      const data: QueryResponse = await res.json()
      return data
    } catch (err) {
      handleError(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [handleError])

  const health = useCallback(async (): Promise<HealthResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/health`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const documents = useCallback(async (): Promise<DocumentsResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/documents`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const sources = useCallback(async (): Promise<SourcesResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/sources`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const runEval = useCallback(async (): Promise<EvalResult | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/eval/run`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        throw new Error(err.error?.message || `HTTP ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      handleError(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [handleError])

  const getEvalResults = useCallback(async (): Promise<EvalResult | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/eval/results`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const listCases = useCallback(async (): Promise<CasesResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/cases`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const ingest = useCallback(async (): Promise<{ documents: number; chunks: number; source_ids: string[]; manifest_id: string | null } | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_default_sources: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        throw new Error(err.error?.message || `HTTP ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      handleError(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [handleError])

  return { query, health, documents, sources, runEval, getEvalResults, listCases, ingest, loading, error }
}
