interface TiptapRendererProps {
  html: string
  className?: string
}

export function TiptapRenderer({ html, className }: TiptapRendererProps) {
  return (
    <div
      className={`prose prose-slate max-w-none ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
