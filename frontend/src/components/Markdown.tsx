import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeSanitize from 'rehype-sanitize'
import type { Components } from 'react-markdown'

/**
 * Clinical markdown renderer — clean, readable, production-grade.
 * Uses standard Tailwind palette that maps to the project's design tokens.
 */

export interface Citation {
  chunk_id?: string
  source_id: string
  title: string
  organization?: string
  source_type?: string
  [key: string]: any
}

interface MarkdownProps {
  content: string
  className?: string
  citations?: Citation[]
  onCitationClick?: (index: number) => void
}

function formatCitationsInText(text: string, citations?: Citation[]): string {
  if (!citations || citations.length === 0) return text
  
  // Regex to match bracket citations like [nice-ng136:p12:c001]
  const pattern = /\[([\w:-]+)\]/g
  
  return text.replace(pattern, (match, chunkId) => {
    const idx = citations.findIndex(c => 
      c.chunk_id === chunkId || 
      chunkId === `chunk_${citations.indexOf(c)}` ||
      chunkId === String(citations.indexOf(c)) ||
      chunkId === String(citations.indexOf(c) + 1)
    )
    if (idx !== -1) {
      return `[[${idx + 1}](#citation-${idx})`
    }
    return match
  })
}

export function Markdown({ content, className = '', citations, onCitationClick }: MarkdownProps) {
  const formattedContent = formatCitationsInText(content, citations)

  const mdComponents: Components = {
    h1: ({ children }) => (
      <h1 className="text-lg font-bold text-[#1a1a1a] dark:text-white mt-5 mb-2 first:mt-0 tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-bold text-[#1a1a1a] dark:text-white mt-5 mb-2 first:mt-0 tracking-tight border-b border-gray-200 dark:border-slate-700 pb-1.5">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-4 mb-1.5 first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mt-3 mb-1 first:mt-0">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-[14.5px] leading-[1.7] text-gray-800 dark:text-slate-200 my-2 first:mt-0 last:mb-0">
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-[#1a1a1a] dark:text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-700 dark:text-slate-300">{children}</em>
    ),
    a: ({ href, children }) => {
      if (href?.startsWith('#citation-')) {
        const index = parseInt(href.substring(10), 10)
        return (
          <sup className="align-super text-[10px] font-black leading-none mx-0.5">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (onCitationClick) {
                  onCitationClick(index)
                }
              }}
              className="inline-flex items-center justify-center bg-brand-accent/15 hover:bg-brand-accent/25 text-brand-accent border border-brand-accent/30 rounded-sm px-1 py-0 h-4 min-w-4 text-[9px] font-black font-code-sm uppercase select-none transition-colors align-middle cursor-pointer"
              title="Jump to source citation"
            >
              {children}
            </button>
          </sup>
        )
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent hover:text-brand-accent/80 font-medium underline decoration-brand-accent/30 hover:decoration-brand-accent/60 underline-offset-2 transition-colors"
        >
          {children}
        </a>
      )
    },
    code: ({ className, children }) => {
      const isBlock = className?.startsWith('language-')
      if (isBlock) {
        return (
          <code className="block text-xs font-mono text-slate-200 bg-transparent p-0 whitespace-pre">
            {children}
          </code>
        )
      }
      return (
        <code className="px-1.5 py-0.5 mx-0.5 text-[12px] font-mono bg-gray-100 dark:bg-slate-800 text-[#1a1a1a] dark:text-slate-200 rounded-md">
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="my-3 p-3.5 rounded-xl bg-[#1a1a1a] text-slate-200 overflow-x-auto text-xs leading-relaxed">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-brand-accent/60 pl-4 py-1 bg-brand-accent/5 dark:bg-brand-accent/5 text-[13px] text-gray-700 dark:text-slate-300 rounded-r-lg">
        {children}
      </blockquote>
    ),
    ul: ({ children }) => (
      <ul className="my-2 pl-5 space-y-1.5 list-disc marker:text-brand-accent dark:marker:text-brand-accent text-[14.5px] text-gray-800 dark:text-slate-200">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 pl-5 space-y-1.5 list-decimal marker:text-brand-accent dark:marker:text-brand-accent text-[14.5px] text-gray-800 dark:text-slate-200">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
    hr: () => <hr className="my-6 border-gray-200 dark:border-slate-700" />,
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-100 dark:bg-slate-800/60 text-[#1a1a1a] dark:text-white">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-gray-200 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-r border-gray-200 dark:border-slate-700 last:border-r-0">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2.5 text-gray-800 dark:text-slate-300 align-top text-[13px]">
        {children}
      </td>
    ),
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize]]}
        components={mdComponents}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  )
}

export default Markdown
