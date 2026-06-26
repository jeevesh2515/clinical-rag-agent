import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, User, Bot, Heart, Copy, Check, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'
import { StatusBadge } from './StatusBadge'
import { PatientPanel } from './PatientPanel'
import { ClinicianPanel } from './ClinicianPanel'
import { ModeSelector } from './ModeSelector'
import { CaseSelector } from './CaseSelector'
import { useApi } from '../hooks/useApi'
import type { QueryResponse, QueryRequest } from '../types/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: QueryResponse
  timestamp: Date
}

const PATIENT_SUGGESTIONS = [
  'What does high blood pressure mean?',
  'How often should I check my blood pressure at home?',
  'What lifestyle changes can help lower my blood pressure?',
  'What should I ask my doctor about my hypertension?',
]

const CLINICIAN_SUGGESTIONS = [
  'What are the NICE NG136 threshold recommendations for stage 2 hypertension?',
  'What follow-up workflow should be prepared after a BP review?',
  'Calculate BMI for 82 kg and 1.75 m.',
  'When should drug treatment be considered for stage 1 hypertension?',
]

interface QueryInterfaceProps {
  mode: 'patient' | 'clinician'
  onModeChange: (mode: 'patient' | 'clinician') => void
}

export const QueryInterface: React.FC<QueryInterfaceProps> = ({ mode, onModeChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [caseId, setCaseId] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { query, loading, error } = useApi()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestedQuestions = mode === 'patient' ? PATIENT_SUGGESTIONS : CLINICIAN_SUGGESTIONS

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSelectedMessage(null)

    const payload: QueryRequest = {
      question: userMsg.content,
      mode,
      case_id: caseId,
      include_patient_education: mode === 'patient',
    }

    const response = await query(payload)

    if (response) {
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setSelectedMessage(assistantMsg)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main chat area */}
        <div className="lg:col-span-2 space-y-5">
          {/* Controls bar */}
          <div className="glass-panel p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <ModeSelector value={mode} onChange={onModeChange} />
            <div className="w-px h-6 bg-white/10 hidden sm:block" />
            <CaseSelector value={caseId} onChange={setCaseId} />
            <div className="flex-1" />
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setSelectedMessage(null) }}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-white/[0.04]"
              >
                Clear chat
              </button>
            )}
          </div>

          {/* Chat messages */}
          <div className="glass-panel min-h-[500px] flex flex-col">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-6">
                <div className={cn(
                  'w-20 h-20 rounded-2xl flex items-center justify-center mb-6 relative',
                  mode === 'patient' ? 'bg-medical-500/10' : 'bg-violet-500/10'
                )}>
                  <div className={cn(
                    'absolute inset-0 rounded-2xl blur-xl opacity-30',
                    mode === 'patient' ? 'bg-medical-500' : 'bg-violet-500'
                  )} />
                  {mode === 'patient' ? (
                    <Heart className="w-9 h-9 text-medical-400 relative" />
                  ) : (
                    <Bot className="w-9 h-9 text-violet-400 relative" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {mode === 'patient' ? 'Ask about your health' : 'Ask a clinical workflow question'}
                </h3>
                <p className="text-sm text-slate-500 mb-8 max-w-md leading-relaxed">
                  {mode === 'patient'
                    ? 'Learn about your condition, understand your care, and prepare for your next visit. All responses include sources and are reviewed for safety.'
                    : 'Try asking about hypertension guidelines, care workflows, or use the calculator. All responses include citations and safety checks.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="text-left px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] 
                        hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-sm text-slate-300
                        leading-snug hover-lift"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <div className="flex-1 overflow-y-auto max-h-[540px] scrollbar-thin p-5 space-y-5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'animate-fade-in-up',
                      msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl p-4 relative group',
                        msg.role === 'user'
                          ? mode === 'patient'
                            ? 'chat-bubble-user'
                            : 'chat-bubble-clinician'
                          : 'chat-bubble-assistant'
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          {msg.role === 'user' ? (
                            <div className={cn(
                              'w-6 h-6 rounded-lg flex items-center justify-center',
                              mode === 'patient' ? 'bg-medical-500/20' : 'bg-violet-500/20'
                            )}>
                              <User className={cn('w-3.5 h-3.5', mode === 'patient' ? 'text-medical-400' : 'text-violet-400')} />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-lg bg-medical-500/15 flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-medical-400" />
                            </div>
                          )}
                          <span className="text-xs font-medium text-slate-400">
                            {msg.role === 'user' ? 'You' : 'ClinicalRAG'}
                          </span>
                          <span className="text-[10px] text-slate-600">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300"
                          >
                            {copiedId === msg.id
                              ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                              : <Copy className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>

                      {/* Status badges */}
                      {msg.response && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <StatusBadge
                            intent={msg.response.intent}
                            confidence={msg.response.confidence}
                            mode={msg.response.mode}
                            refusalTriggered={msg.response.safety.refusal_triggered}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="chat-bubble-assistant">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="thinking-dot" />
                          <div className="thinking-dot" />
                          <div className="thinking-dot" />
                        </div>
                        <span className="text-sm text-slate-400 ml-1">
                          {mode === 'patient' ? 'Preparing your answer...' : 'Analyzing...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mx-5 mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm animate-scale-in">
                <span className="font-semibold">Error: </span>
                {error}
              </div>
            )}

            {/* Input */}
            <div className="p-4 pt-0">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === 'patient'
                      ? 'Ask about your health in plain language...'
                      : 'Ask a clinical workflow question...'
                  }
                  className={cn(
                    'w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pl-4 pr-14 py-3.5',
                    'text-sm text-slate-200 placeholder:text-slate-500',
                    'focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                    mode === 'patient'
                      ? 'focus:ring-medical-500/30'
                      : 'focus:ring-violet-500/30'
                  )}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className={cn(
                    'absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg',
                    'flex items-center justify-center transition-all',
                    mode === 'patient'
                      ? 'bg-medical-500/20 hover:bg-medical-500/30 text-medical-400'
                      : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-400',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
              <p className="mt-2 text-[10px] text-slate-600 text-center">
                Responses are grounded in clinical guidelines. Always consult a licensed clinician.
              </p>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-1">
          {selectedMessage?.response ? (
            mode === 'patient' ? (
              <PatientPanel response={selectedMessage.response} />
            ) : (
              <ClinicianPanel response={selectedMessage.response} />
            )
          ) : (
            <div className="glass-panel p-8 text-center sticky top-20">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 relative',
                mode === 'patient' ? 'bg-medical-500/10' : 'bg-violet-500/10'
              )}>
                <div className={cn(
                  'absolute inset-0 rounded-2xl blur-lg opacity-20',
                  mode === 'patient' ? 'bg-medical-500' : 'bg-violet-500'
                )} />
                {mode === 'patient' ? (
                  <Heart className="w-7 h-7 text-medical-400 relative" />
                ) : (
                  <Bot className="w-7 h-7 text-violet-400 relative" />
                )}
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                {mode === 'patient'
                  ? 'Ask a question to see personalized health information, sources, and safety guidance.'
                  : 'Ask a question to see detailed response metadata, citations, and safety checks.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
