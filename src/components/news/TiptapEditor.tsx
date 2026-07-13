'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Image from '@tiptap/extension-image'
import { Node } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'

const ClearFloat = Node.create({
  name: 'clearFloat',
  group: 'block',
  atom: true,
  parseHTML() { return [{ tag: 'div[data-clear-float]' }] },
  renderHTML() { return ['div', { 'data-clear-float': '', style: 'clear:both;height:0;line-height:0;font-size:0' }] },
  addNodeView() {
    return () => {
      const dom = document.createElement('div')
      dom.setAttribute('data-clear-float', '')
      dom.style.cssText = 'clear:both;height:0;line-height:0;font-size:0'
      return { dom }
    }
  },
})

function applyContainerStyle(el: HTMLElement, attrs: Record<string, unknown>) {
  el.style.cssText = containerStyleStr((attrs.float as string) ?? 'none') + ';position:relative;line-height:0'
}

function applyImgStyle(img: HTMLImageElement, attrs: Record<string, unknown>) {
  img.className = 'rounded-xl'
  img.style.width = attrs.width ? `${attrs.width}px` : '100%'
  img.style.maxWidth = '100%'
  img.style.display = 'block'
  img.style.cursor = 'pointer'
}

function containerStyleStr(float: string | null) {
  if (!float || float === 'none') return 'display:block;overflow:hidden;margin:0.75rem 0'
  const left = float === 'left'
  return `float:${float};overflow:hidden;max-width:45%;margin:${left ? '0 1.5rem 0.75rem 0' : '0 0 0.75rem 1.5rem'}`
}

// Extends Image with `float` + `width` attributes and a NodeView for click-select + resize
const ImageWithFloat = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      float: {
        default: 'none',
        // stored on img as data-float; float itself goes on wrapper div in renderHTML
        renderHTML: (attrs) => ({ 'data-float': attrs.float ?? 'none' }),
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-float') ?? 'none',
      },
      width: {
        default: null,
        renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {},
        parseHTML: (el) => (el as HTMLImageElement).getAttribute('width') ?? null,
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const { 'data-float': float, width, src, alt, title } = HTMLAttributes
    const imgAttrs: Record<string, unknown> = { src, class: 'rounded-xl', style: 'display:block;width:100%;max-width:100%', 'data-float': float }
    if (alt) imgAttrs.alt = alt
    if (title) imgAttrs.title = title
    if (width) imgAttrs.width = width
    return ['div', { style: containerStyleStr(float as string) }, ['img', imgAttrs]]
  },

  addNodeView() {
    return ({ node, getPos, editor: tiptapEditor }) => {
      const container = document.createElement('div')
      applyContainerStyle(container, node.attrs)

      const img = document.createElement('img')
      img.src = node.attrs.src ?? ''
      if (node.attrs.alt) img.alt = node.attrs.alt
      applyImgStyle(img, node.attrs)

      // Resize handle
      const handle = document.createElement('div')
      handle.style.cssText = 'position:absolute;bottom:6px;right:6px;width:14px;height:14px;background:#7c3aed;border-radius:3px;cursor:se-resize;opacity:0;transition:opacity 0.15s;z-index:10'
      handle.title = 'Drag to resize'

      container.addEventListener('mouseenter', () => { handle.style.opacity = '1' })
      container.addEventListener('mouseleave', () => { handle.style.opacity = '0' })

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const startX = e.clientX
        const startWidth = img.offsetWidth

        const onMove = (ev: MouseEvent) => {
          img.style.width = `${Math.max(80, startWidth + ev.clientX - startX)}px`
        }
        const onUp = (ev: MouseEvent) => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          const newWidth = Math.max(80, startWidth + ev.clientX - startX)
          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (pos !== undefined) {
            tiptapEditor.chain().setNodeSelection(pos).updateAttributes('image', { width: newWidth }).run()
          }
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })

      img.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos !== undefined) tiptapEditor.commands.setNodeSelection(pos)
      })

      container.appendChild(img)
      container.appendChild(handle)

      return {
        dom: container,
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false
          img.src = updatedNode.attrs.src ?? ''
          if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt
          applyContainerStyle(container, updatedNode.attrs)
          applyImgStyle(img, updatedNode.attrs)
          return true
        },
        selectNode() {
          img.style.outline = '3px solid #7c3aed'
          img.style.outlineOffset = '2px'
          handle.style.opacity = '1'
        },
        deselectNode() {
          img.style.outline = ''
          img.style.outlineOffset = ''
          handle.style.opacity = '0'
        },
      }
    }
  },
})

interface TiptapEditorProps {
  content?: Record<string, unknown>
  onChange?: (json: Record<string, unknown>, html: string) => void
  placeholder?: string
  minHeight?: string
  disabled?: boolean
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        active
          ? 'bg-purple-100 text-purple-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-1" />
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export function TiptapEditor({ content, onChange, placeholder, minHeight = '320px', disabled }: TiptapEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      Placeholder.configure({ placeholder: placeholder ?? 'Write your article content here...' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-purple-600 underline' } }),
      ImageWithFloat.configure({ inline: false, allowBase64: false }),
      ClearFloat,
    ],
    content: content && Object.keys(content).length > 0 ? content : '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'focus:outline-none after:block after:clear-both after:content-[""]',
        style: `padding: 1.5rem 2rem; min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as Record<string, unknown>, editor.getHTML())
    },
  })

  // Keep content in sync if parent changes it (e.g. after load)
  useEffect(() => {
    if (!editor || !content || Object.keys(content).length === 0) return
    const current = editor.getJSON()
    if (JSON.stringify(current) !== JSON.stringify(content)) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

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

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/news/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url }).run()
      }
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="border border-slate-200 rounded-xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <span className="underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          H1
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          H2
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          H3
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          ≡
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          1.
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          &ldquo;
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          {'</>'}
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              setShowLinkInput(!showLinkInput)
            }
          }}
          active={editor.isActive('link')}
          title="Link"
        >
          🔗
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule" active={false}>
          —
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingImage || !!disabled}
          title="Insert image"
          active={false}
        >
          {uploadingImage ? '⏳' : '🖼️'}
        </ToolbarBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <Divider />

        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          ⬅
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          ↔
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          ➡
        </ToolbarBtn>
      </div>

      {/* Link input popover */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border-b border-purple-100">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setLink() }}
            placeholder="https://..."
            autoFocus
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button type="button" onClick={setLink} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Set
          </button>
          <button type="button" onClick={() => setShowLinkInput(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">
            Cancel
          </button>
        </div>
      )}

      {/* Image float controls — shown when an image is selected */}
      {editor.isActive('image') && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
          <span className="text-xs text-slate-400 mr-1">Image wrap:</span>
          <ToolbarBtn
            onClick={() => editor.chain().focus().updateAttributes('image', { float: 'left' }).run()}
            active={editor.getAttributes('image').float === 'left'}
            title="Float left — text wraps right"
          >
            ◧
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().updateAttributes('image', { float: 'none' }).run()}
            active={!editor.getAttributes('image').float || editor.getAttributes('image').float === 'none'}
            title="No wrap — full width"
          >
            ▣
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().updateAttributes('image', { float: 'right' }).run()}
            active={editor.getAttributes('image').float === 'right'}
            title="Float right — text wraps left"
          >
            ◨
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            onClick={() => {
              const { selection, schema } = editor.state
              const pos = selection.from + (selection as { node?: { nodeSize: number } }).node!.nodeSize
              editor.chain()
                .insertContentAt(pos, [
                  { type: 'clearFloat' },
                  { type: 'paragraph' },
                ])
                .setTextSelection(pos + 2)
                .focus()
                .run()
            }}
            active={false}
            title="Start new paragraph below (clear float)"
          >
            ↵ below
          </ToolbarBtn>
        </div>
      )}

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-slate max-w-none"
      />
    </div>
  )
}
