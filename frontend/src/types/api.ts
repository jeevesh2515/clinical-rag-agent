export type QueryMode = 'patient' | 'clinician'

export type QueryIntentLabel =
  | 'guideline_question'
  | 'workflow_question'
  | 'calculator_question'
  | 'unsafe_medical_advice_request'
  | 'insufficient_evidence'
  | 'out_of_domain'

export type ClaimSupportType =
  | 'direct_guideline_support'
  | 'inferred_workflow_suggestion'
  | 'unsupported_claim'

export type ConfidenceLabel = 'high' | 'medium' | 'low' | 'none'

export interface Citation {
  source_id: string
  title: string
  source_url: string
  page: number
  chunk_id: string
  quote: string
  publication_year: number | null
  organization: string
  source_type: string
  source_version: string | null
  retrieved_at: string | null
  review_date: string | null
  effective_date: string | null
  license_notes: string | null
}

export interface RetrievalResultModel {
  chunk_id: string
  dense_score: number
  sparse_score: number
  hybrid_score: number
  rerank_score: number
}

export interface RetrievalTrace {
  alpha: number
  top_k: number
  rerank_top_n: number
  results: RetrievalResultModel[]
}

export interface SafetyFlags {
  medical_disclaimer: boolean
  consult_licensed_clinician: boolean
  requires_clinician_review: boolean
  unsupported_claims_detected: boolean
  unsafe_request: boolean
  refusal_triggered: boolean
  prompt_injection_detected: boolean
}

export interface ToolTrace {
  name: string
  input_summary: string
  output_summary: string
}

export interface ClaimSupport {
  claim: string
  support_type: ClaimSupportType
  citation_chunk_ids: string[]
  rationale: string
}

export interface QueryRequest {
  question: string
  mode: QueryMode
  case_id?: string | null
  include_patient_education?: boolean
  alpha?: number | null
  top_k?: number | null
  rerank_top_n?: number | null
}

export interface OKFConceptRef {
  source_path: string
  title: string
  confidence: number
  citation_url: string
  source_type: 'okf' | 'rag'
}

export interface KnowledgePathInfo {
  path: string
  reason: string
  okf_concepts: OKFConceptRef[]
  rag_sources: string[]
}

export interface QueryResponse {
  answer: string
  citations: Citation[]
  retrieval: RetrievalTrace
  tools_used: string[]
  safety: SafetyFlags
  mode: QueryMode
  intent: QueryIntentLabel
  refusal_reason: string | null
  evidence_summary: string | null
  workflow_considerations: string[]
  care_gaps: string[]
  follow_up_plan: string[]
  patient_education_draft: string | null
  claim_support: ClaimSupport[]
  confidence: ConfidenceLabel
  tool_trace: ToolTrace[]
  knowledge_path: KnowledgePathInfo | null
  request_id: string | null
  graph_route: string | null
}

export interface HealthResponse {
  status: string
  documents: number
  chunks: number
  request_id: string | null
}

export interface DocumentInfo {
  source_id: string
  title: string
  chunk_count: number
}

export interface DocumentsResponse {
  documents: DocumentInfo[]
}

export interface SourceMetadata {
  source_id: string
  title: string
  source_url: string
  domain: string
  source_type: string
  publication_year: number | null
  guideline_version: string | null
  organization: string
  indexed: boolean
  chunk_count: number
  page_count: number | null
  content_hash: string | null
  last_ingested_at: string | null
  last_manifest_id: string | null
  review_date: string | null
  effective_date: string | null
  license_notes: string | null
}

export interface SourcesResponse {
  sources: SourceMetadata[]
  total: number
  indexed_count: number
}

export interface EvalMetric {
  [key: string]: number
}

export interface EvalDatasetResult {
  dataset_size: number
  latency_seconds: number
  avg_latency_per_query: number
  metrics: EvalMetric
  ragas_scores: EvalMetric
  thresholds: EvalMetric
  passed_thresholds: Record<string, boolean>
  rows: unknown[]
}

export interface EvalAggregate {
  metrics: EvalMetric
  thresholds: EvalMetric
  passed_thresholds: Record<string, boolean>
  all_passed: boolean
}

export interface EvalResult {
  status: string
  results: unknown
}

export interface CaseInfo {
  case_id: string
  age: number
  sex: string
  summary: string
  conditions: string[]
}

export interface CasesResponse {
  cases: CaseInfo[]
  total: number
}
