'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { useCallback, useState } from 'react'

interface Props {
  initialHtml: string
  onChange: (html: string) => void
  placeholder?: string
}

function plainTextToHtml(text: string): string {
  // Split on blank lines to create paragraphs; single newlines become <br>
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const escaped = para
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      // Convert leading spaces and multi-space runs to &nbsp; so HTML doesn't collapse them
      const spaced = escaped
        .replace(/^ +/gm, (m) => Array.from({ length: m.length }, () => '&nbsp;').join(''))
        .replace(/ {2,}/g, (m) => Array.from({ length: m.length }, () => '&nbsp;').join(''))
      return '<p>' + spaced.split('\n').join('<br>') + '</p>'
    })
    .join('')
}

function Sep() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5 flex-shrink-0" />
}

function ToolbarBtn({ onMouseDown, active, title, children }: {
  onMouseDown: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onMouseDown() }}
      title={title}
      className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
        active ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

export function TaskDescriptionEditor({ initialHtml, onChange, placeholder }: Props) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  const isHtml = initialHtml.trim().startsWith('<')
  const content = isHtml ? initialHtml : plainTextToHtml(initialHtml)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'Add a description…' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-purple-600 underline' } }),
    ],
    content,
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  if (!editor) return null

  return (
    <div className="flex-1 flex flex-col min-h-0 border border-purple-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-400 ring-offset-0">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <span className="underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          {'\`'}
        </ToolbarBtn>

        <Sep />

        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          H1
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          H2
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          H3
        </ToolbarBtn>

        <Sep />

        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          {'≡'}
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          1.
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          {'“'}
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          {'</>'}
        </ToolbarBtn>

        <Sep />

        <ToolbarBtn
          onMouseDown={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              setShowLinkInput((p) => !p)
            }
          }}
          active={editor.isActive('link')}
          title="Link"
        >
          {'🔗'}
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule">
          {'—'}
        </ToolbarBtn>

        <Sep />

        <ToolbarBtn onMouseDown={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          {'⬅'}
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          {'↔'}
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          {'➡'}
        </ToolbarBtn>
      </div>

      {/* Link URL input */}
      {showLinkInput && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-purple-50 border-b border-purple-100">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setLink() }}
            placeholder="https://..."
            autoFocus
            className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button type="button" onClick={setLink} className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">Set</button>
          <button type="button" onClick={() => setShowLinkInput(false)} className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800">Cancel</button>
        </div>
      )}

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto prose prose-sm prose-slate max-w-none px-3 py-2 focus-within:outline-none"
        style={{ minHeight: '80px' }}
      />
    </div>
  )
}
