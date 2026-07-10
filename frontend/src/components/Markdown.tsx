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
    <h2 className="text-base font-bold text-gray-900 dark:text-white mt-5 mb-2 first:mt-0 tracking-tight border-b-2 border-[#1a1a1a] dark:border-white pb-1.5 uppercase">
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

  // Paragraphs
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-gray-800 dark:text-slate-200 my-2 first:mt-0 last:mb-0">
      {children}
    </p>
  ),

  // Inline formatting
  strong: ({ children }) => (
    <strong className="font-bold text-gray-900 dark:text-white bg-brand-accent/10 dark:bg-brand-accent/20 px-0.5">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-800 dark:text-slate-200">{children}</em>
  ),

  // Links — open externally, clinical source style
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-accent dark:text-brand-accent font-bold underline decoration-brand-accent/60 underline-offset-2 hover:bg-brand-accent hover:text-white hover:no-underline transition-all px-0.5"
    >
      {children}
    </a>
  ),

  // Inline code
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className="block text-xs font-mono text-gray-800 dark:text-slate-200 bg-transparent p-0 whitespace-pre">
          {children}
        </code>
      )
    }
    return (
      <code className="px-1.5 py-0.5 mx-0.5 text-[12px] font-mono bg-yellow-100 dark:bg-yellow-900/30 text-[#1a1a1a] dark:text-yellow-200 border-2 border-[#1a1a1a] dark:border-yellow-500/50 shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.3)] rounded-none">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 p-3 bg-[#1a1a1a] dark:bg-slate-900 text-white border-2 border-[#1a1a1a] dark:border-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] overflow-x-auto text-xs leading-relaxed rounded-none">
      {children}
    </pre>
  ),

  // Blockquote — for disclaimers / source notes
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-2 border-[#1a1a1a] dark:border-white p-3 bg-[#f0f0f0] dark:bg-slate-900 font-mono text-[12px] font-bold text-[#1a1a1a] dark:text-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] rounded-none">
      {children}
    </blockquote>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="my-2 pl-5 space-y-1 list-disc marker:text-brand-accent dark:marker:text-brand-accent text-sm text-gray-800 dark:text-slate-200 font-medium">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 pl-5 space-y-1 list-decimal marker:text-brand-accent dark:marker:text-brand-accent text-sm text-gray-800 dark:text-slate-200 font-medium">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Horizontal rule
  hr: () => <hr className="my-6 border-t-2 border-[#1a1a1a] dark:border-white" />,

  // Tables — core of the clinical response (brutalist style)
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto border-2 border-[#1a1a1a] dark:border-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
      <table className="w-full text-sm border-collapse bg-white dark:bg-slate-900">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#1a1a1a] dark:bg-white text-white dark:text-black">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b-2 border-[#1a1a1a] dark:border-white last:border-b-0 hover:bg-brand-accent/10 dark:hover:bg-brand-accent/20 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2.5 text-left font-bold text-white dark:text-black text-xs uppercase tracking-wider border-r-2 border-white/20 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 text-gray-800 dark:text-slate-200 align-top font-mono text-xs font-semibold">
      {children}
    </td>
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
