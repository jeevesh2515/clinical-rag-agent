import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeSanitize from 'rehype-sanitize'
import type { Components } from 'react-markdown'

/**
 * Soft-modern markdown renderer for clinical answers.
 * No hard borders, no harsh shadows. Calm and readable.
 */

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-ink-900 dark:text-white mt-5 mb-2 first:mt-0 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-ink-900 dark:text-white mt-5 mb-2 first:mt-0 tracking-tight border-b border-ink-200 dark:border-ink-800 pb-1.5">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100 mt-4 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-3 mb-1 first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-[14.5px] leading-[1.7] text-ink-800 dark:text-ink-100 my-2 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-ink-800 dark:text-ink-200">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-500 hover:text-brand-600 font-medium underline decoration-brand-500/30 hover:decoration-brand-500/60 underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className="block text-xs font-mono text-ink-100 bg-transparent p-0 whitespace-pre">
          {children}
        </code>
      )
    }
    return (
      <code className="px-1.5 py-0.5 mx-0.5 text-[12px] font-mono bg-ink-100 dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 p-3.5 rounded-xl bg-ink-900 text-ink-100 overflow-x-auto text-xs leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-brand-500/60 pl-4 py-1 bg-brand-50/50 dark:bg-brand-500/5 text-[13px] text-ink-700 dark:text-ink-200 rounded-r-lg">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="my-2 pl-5 space-y-1.5 list-disc marker:text-brand-500 dark:marker:text-brand-400 text-[14.5px] text-ink-800 dark:text-ink-100">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 pl-5 space-y-1.5 list-decimal marker:text-brand-500 dark:marker:text-brand-400 text-[14.5px] text-ink-800 dark:text-ink-100">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
  hr: () => <hr className="my-6 border-ink-200 dark:border-ink-800" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-ink-100 dark:bg-ink-800/60 text-ink-900 dark:text-white">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-ink-200 dark:border-ink-800 last:border-b-0 hover:bg-ink-50 dark:hover:bg-ink-900/40 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-r border-ink-200 dark:border-ink-700 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 text-ink-800 dark:text-ink-200 align-top text-[13px]">
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
