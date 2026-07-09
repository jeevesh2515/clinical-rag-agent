import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeSanitize from 'rehype-sanitize'
import type { Components } from 'react-markdown'

/**
 * Clinical-grade markdown renderer.
 * Strict schema (sanitize) but covers tables, headers, lists, inline code,
 * blockquotes — everything the OKF / RAG answers actually need.
 */

const mdComponents: Components = {
  // Headings — clinical hierarchy
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2 first:mt-0 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-gray-900 dark:text-white mt-5 mb-2 first:mt-0 tracking-tight border-b border-gray-200/60 dark:border-gray-700/60 pb-1.5">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1 first:mt-0">
      {children}
    </h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 my-2 first:mt-0 last:mb-0">
      {children}
    </p>
  ),

  // Inline formatting
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-800 dark:text-gray-200">{children}</em>
  ),

  // Links — open externally, clinical source style
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300/60 dark:decoration-blue-500/40 underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),

  // Inline code
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className="block text-xs font-mono text-gray-800 dark:text-gray-200 bg-transparent p-0 whitespace-pre">
          {children}
        </code>
      )
    }
    return (
      <code className="px-1.5 py-0.5 mx-0.5 text-[12px] font-mono bg-gray-100 dark:bg-gray-800 text-rose-600 dark:text-rose-300 rounded border border-gray-200 dark:border-gray-700/60">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-x-auto text-xs leading-relaxed">
      {children}
    </pre>
  ),

  // Blockquote — for disclaimers / source notes
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-3 border-l-2 border-blue-400/70 dark:border-blue-500/60 text-gray-600 dark:text-gray-400 italic">
      {children}
    </blockquote>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="my-2 pl-5 space-y-1 list-disc marker:text-gray-400 dark:marker:text-gray-500 text-sm text-gray-800 dark:text-gray-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 pl-5 space-y-1 list-decimal marker:text-gray-400 dark:marker:text-gray-500 text-sm text-gray-800 dark:text-gray-200">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Horizontal rule
  hr: () => <hr className="my-4 border-gray-200/80 dark:border-gray-700/80" />,

  // Tables — core of the clinical response
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700/60 shadow-sm">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/60">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 text-[11px] uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-800 dark:text-gray-200 align-top">{children}</td>
  ),
}

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize]]}
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default Markdown
