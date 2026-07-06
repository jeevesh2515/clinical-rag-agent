import React, { useState, useEffect } from 'react'
import { Menu, X, LogOut, Settings, Plus, MessageSquare, Send, ChevronDown } from 'lucide-react'
import { useApi } from './hooks/useApi'
import type { QueryResponse } from './types/api'

// Types for authentication
interface User {
  id: string
  username: string
  email: string
  roles: string[]
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  citations?: any[]
  tool_trace?: any[]
}

export const AppNew: React.FC = () => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<'citations' | 'tools' | 'safety' | 'knowledge'>('citations')
  const [lastResponse, setLastResponse] = useState<QueryResponse | null>(null)

  const { query: queryAgent } = useApi()

  // Load conversations on mount
  useEffect(() => {
    if (isAuthenticated) {
      // TODO: Fetch conversations from backend
      // For now, we'll use mock data
      setConversations([
        { id: '1', title: 'Hypertension Management', updated_at: '2h ago' },
        { id: '2', title: 'CKD Follow-up Protocol', updated_at: '1d ago' },
      ])
    }
  }, [isAuthenticated])

  const handleNewConversation = () => {
    const newId = `conv-${Date.now()}`
    setCurrentConversationId(newId)
    setMessages([])
    setInputValue('')
  }

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id)
    // TODO: Load messages from backend
    setMessages([])
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await queryAgent(inputValue)
      if (response) {
        setLastResponse(response)
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: response.answer,
          timestamp: new Date().toISOString(),
          citations: response.citations,
          tool_trace: response.tool_trace,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    setConversations([])
    setMessages([])
    setCurrentConversationId(null)
  }

  if (!isAuthenticated) {
    return <AuthModal mode={authMode} setMode={setAuthMode} onAuthenticate={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel - Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              CW
            </div>
            {sidebarOpen && <span className="font-bold text-gray-900">Clinical Workflows</span>}
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {sidebarOpen && <span>New Chat</span>}
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
                currentConversationId === conv.id
                  ? 'bg-blue-100 text-blue-900 border-l-4 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {sidebarOpen ? (
                <>
                  <div className="font-medium truncate">{conv.title}</div>
                  <div className="text-xs text-gray-500">{conv.updated_at}</div>
                </>
              ) : (
                <MessageSquare size={20} />
              )}
            </button>
          ))}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              {currentUser?.username[0].toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{currentUser?.username}</div>
                <div className="text-xs text-gray-500">{currentUser?.roles[0]}</div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <LogOut size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Toggle Sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Center Panel - Chat */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        {currentConversationId && (
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {conversations.find((c) => c.id === currentConversationId)?.title || 'New Chat'}
            </h2>
            <div className="flex items-center gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>Patient Mode</option>
                <option>Clinician Mode</option>
              </select>
            </div>
          </div>
        )}

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Start a conversation</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md px-4 py-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask a clinical question..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Evidence & Context */}
      <div className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['citations', 'tools', 'safety', 'knowledge'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightPanelTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                rightPanelTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {rightPanelTab === 'citations' && (
            <div className="space-y-3">
              {lastResponse?.citations && lastResponse.citations.length > 0 ? (
                lastResponse.citations.map((citation, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="font-medium text-sm text-gray-900">{citation.title}</div>
                    <div className="text-xs text-gray-500 mt-1">Page {citation.page}</div>
                    <p className="text-xs text-gray-700 mt-2 line-clamp-3">{citation.quote}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No citations available</p>
              )}
            </div>
          )}

          {rightPanelTab === 'tools' && (
            <div className="space-y-3">
              {lastResponse?.tool_trace && lastResponse.tool_trace.length > 0 ? (
                lastResponse.tool_trace.map((tool, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="font-medium text-sm text-gray-900">{tool.name}</div>
                    <div className="text-xs text-gray-600 mt-2">
                      <pre className="overflow-auto">{JSON.stringify(tool, null, 2)}</pre>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No tools used</p>
              )}
            </div>
          )}

          {rightPanelTab === 'safety' && (
            <div className="space-y-3">
              {lastResponse?.safety ? (
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">Medical Disclaimer</p>
                    <p className="text-xs text-gray-600 mt-2">
                      This is educational information only and should not replace professional medical advice.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No safety flags</p>
              )}
            </div>
          )}

          {rightPanelTab === 'knowledge' && (
            <div className="space-y-3">
              {lastResponse?.knowledge_path ? (
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="font-medium text-sm text-gray-900">Knowledge Path</div>
                  <div className="text-xs text-gray-600 mt-2">
                    <p>Route: {lastResponse.knowledge_path}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No knowledge path available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Auth Modal Component
interface AuthModalProps {
  mode: 'login' | 'signup'
  setMode: (mode: 'login' | 'signup') => void
  onAuthenticate: () => void
}

const AuthModal: React.FC<AuthModalProps> = ({ mode, setMode, onAuthenticate }) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Call backend auth endpoints
    onAuthenticate()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold mx-auto mb-4">
            CW
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Workflows</h1>
          <p className="text-gray-600 text-sm mt-2">Evidence-Based Care Planning</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Enter your username"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Enter your email"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-blue-600 hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
