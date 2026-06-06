import { type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface Props {
  children: string
}

/** 代码块：深色背景 + 复制按钮。 */
function CodeBlock({ className, children, ...rest }: { className?: string; children?: ReactNode }) {
  const isBlock = className?.includes('language-')
  if (!isBlock) {
    return (
      <code
        className="rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-accent"
        {...rest}
      >
        {children}
      </code>
    )
  }
  return (
    <div className="group relative my-2">
      <pre className="overflow-x-auto rounded-md bg-elevated p-3 font-mono text-[12px] leading-relaxed text-fg">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </div>
  )
}

/** Markdown 渲染器：对齐设计系统 token，用于助手消息。 */
export function MarkdownContent({ children }: Props) {
  return (
    <div className="chat-markdown text-[13px] leading-relaxed text-fg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: CodeBlock as any,
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-2.5 text-[15px] font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-accent/40 pl-3 text-fg-soft">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-accent underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-edge bg-elevated px-2 py-1 text-left font-medium text-fg-soft">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-edge px-2 py-1">{children}</td>
          ),
          hr: () => <hr className="my-3 border-edge" />,
          strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
          em: ({ children }) => <em className="italic text-fg-soft">{children}</em>
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
