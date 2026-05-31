import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlock from '@tiptap/extension-code-block'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { useEffect, useState, useRef } from 'react'

const T = {
  bg: '#FFFFFF', surface: '#F7F7F8', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  danger: '#DC2626', toolbarBg: '#FAFAFA',
}

function TB({ onClick, active = false, disabled = false, title, children, danger = false }: {
  onClick: () => void; active?: boolean; disabled?: boolean
  title: string; children: React.ReactNode; danger?: boolean
}) {
  return (
    <button type="button" onMouseDown={e => { e.preventDefault(); onClick() }} disabled={disabled} title={title}
      style={{
        border: 'none', borderRadius: 5, padding: '4px 6px', cursor: disabled ? 'default' : 'pointer',
        background: active ? T.accentLight : 'transparent',
        color: disabled ? T.text3 : danger ? T.danger : active ? T.accent : T.text2,
        fontSize: 13, fontFamily: 'inherit', fontWeight: active ? 600 : 400,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 28, height: 28, lineHeight: 1,
      }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = T.surface }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

const SEP = <div style={{ width: 1, background: T.border, margin: '4px 2px', alignSelf: 'stretch' }} />

const TEXT_COLORS = ['#18181B','#DC2626','#D97706','#16A34A','#2563EB','#7C3AED','#DB2777','#6B7280']
const HIGHLIGHT_COLORS = ['#FEF08A','#BBF7D0','#BFDBFE','#F5D0FE','#FED7AA','#FECACA']

function ColorPicker({ onColor, onHighlight }: { onColor: (c: string) => void; onHighlight: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
        style={{ border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', background: open ? T.accentLight : 'transparent', color: T.text2, fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 2, height: 28 }}
        title="Màu chữ & nền highlight">
        <span style={{ fontSize: 14, textDecoration: 'underline', textDecorationColor: '#F59E0B' }}>A</span>
        <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 190 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Màu chữ</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {TEXT_COLORS.map(c => (
              <button key={c} type="button" onMouseDown={e => { e.preventDefault(); onColor(c); setOpen(false) }}
                style={{ width: 22, height: 22, borderRadius: 4, background: c, border: `1.5px solid ${T.border}`, cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nền highlight</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c} type="button" onMouseDown={e => { e.preventDefault(); onHighlight(c); setOpen(false) }}
                style={{ width: 22, height: 22, borderRadius: 4, background: c, border: `1.5px solid ${T.border}`, cursor: 'pointer' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InsertDialog({ type, onClose, onConfirm }: {
  type: 'image' | 'link' | 'youtube' | 'table' | null
  onClose: () => void
  onConfirm: (data: Record<string, string>) => void
}) {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [text, setText] = useState('')
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  if (!type) return null

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13,
    color: T.text1, fontFamily: 'inherit', outline: 'none', background: T.surface, marginBottom: 10,
  }
  const titles: Record<string, string> = { image: '🖼 Chèn hình ảnh', link: '🔗 Chèn liên kết', youtube: '▶ Nhúng video YouTube', table: '⊞ Chèn bảng' }

  const doConfirm = () => {
    if (type === 'image') onConfirm({ src: url, alt })
    else if (type === 'link') onConfirm({ href: url, text })
    else if (type === 'youtube') onConfirm({ src: url })
    else if (type === 'table') onConfirm({ rows, cols })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: T.bg, borderRadius: 12, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: T.text1 }}>{titles[type]}</div>

        {type === 'image' && (<>
          <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>URL hình ảnh</div>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/image.jpg" style={inputStyle} onKeyDown={e => e.key === 'Enter' && doConfirm()} />
          <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>Mô tả ảnh (alt text)</div>
          <input value={alt} onChange={e => setAlt(e.target.value)} placeholder="Mô tả hình ảnh..." style={inputStyle} />
        </>)}

        {type === 'link' && (<>
          <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>URL liên kết</div>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" style={inputStyle} onKeyDown={e => e.key === 'Enter' && doConfirm()} />
          <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>Tên hiển thị (bỏ trống = giữ nguyên text đang chọn)</div>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Tên liên kết..." style={inputStyle} />
        </>)}

        {type === 'youtube' && (<>
          <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>URL video YouTube</div>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={inputStyle} onKeyDown={e => e.key === 'Enter' && doConfirm()} />
        </>)}

        {type === 'table' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>Số hàng</div>
              <input type="number" min="1" max="20" value={rows} onChange={e => setRows(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.text2, marginBottom: 5 }}>Số cột</div>
              <input type="number" min="1" max="10" value={cols} onChange={e => setCols(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose}
            style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 16px', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: T.text2 }}>Huỷ</button>
          <button type="button" onClick={doConfirm}
            style={{ border: 'none', borderRadius: 7, padding: '7px 20px', background: T.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Chèn</button>
        </div>
      </div>
    </div>
  )
}

export default function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [dialog, setDialog] = useState<'image' | 'link' | 'youtube' | 'table' | null>(null)
  const [wordCount, setWordCount] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Image.configure({ inline: false, allowBase64: true }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Placeholder.configure({ placeholder: 'Bắt đầu soạn nội dung bài học...' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlock,
      HorizontalRule,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
      setWordCount(editor.getText().trim().split(/\s+/).filter(Boolean).length)
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value]) // eslint-disable-line

  useEffect(() => {
    if (editor) setWordCount(editor.getText().trim().split(/\s+/).filter(Boolean).length)
  }, [editor])

  const handleDialog = (data: Record<string, string>) => {
    if (!editor) return
    if (dialog === 'image') {
      editor.chain().focus().setImage({ src: data.src, alt: data.alt }).run()
    } else if (dialog === 'link') {
      if (data.text) {
        editor.chain().focus().insertContent(`<a href="${data.href}">${data.text}</a>`).run()
      } else {
        editor.chain().focus().setLink({ href: data.href }).run()
      }
    } else if (dialog === 'youtube') {
      editor.chain().focus().setYoutubeVideo({ src: data.src }).run()
    } else if (dialog === 'table') {
      editor.chain().focus().insertTable({ rows: parseInt(data.rows), cols: parseInt(data.cols), withHeaderRow: true }).run()
    }
  }

  if (!editor) return null

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* TOOLBAR */}
      <div style={{ background: T.toolbarBg, borderBottom: `1px solid ${T.border}`, padding: '5px 8px', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', userSelect: 'none' }}>

        {/* Block type */}
        <select
          value={
            editor.isActive('heading', { level: 1 }) ? '1'
            : editor.isActive('heading', { level: 2 }) ? '2'
            : editor.isActive('heading', { level: 3 }) ? '3'
            : editor.isActive('codeBlock') ? 'code'
            : 'p'
          }
          onChange={e => {
            const v = e.target.value
            if (v === 'p') editor.chain().focus().setParagraph().run()
            else if (v === 'code') editor.chain().focus().toggleCodeBlock().run()
            else editor.chain().focus().toggleHeading({ level: parseInt(v) as 1|2|3 }).run()
          }}
          style={{ border: `1px solid ${T.border}`, borderRadius: 5, padding: '3px 6px', fontSize: 12, fontFamily: 'inherit', background: T.bg, color: T.text1, cursor: 'pointer', height: 28, outline: 'none' }}>
          <option value="p">Đoạn văn</option>
          <option value="1">Tiêu đề 1</option>
          <option value="2">Tiêu đề 2</option>
          <option value="3">Tiêu đề 3</option>
          <option value="code">Code block</option>
        </select>

        {SEP}

        <TB onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="In đậm (Ctrl+B)"><b style={{ fontSize: 14 }}>B</b></TB>
        <TB onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="In nghiêng (Ctrl+I)"><i style={{ fontSize: 14 }}>I</i></TB>
        <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Gạch chân (Ctrl+U)"><u style={{ fontSize: 14 }}>U</u></TB>
        <TB onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Gạch ngang"><s style={{ fontSize: 14 }}>S</s></TB>
        <TB onClick={() => editor.chain().focus().toggleCode().run()}      active={editor.isActive('code')}      title="Code inline"><code style={{ fontSize: 12 }}>{`</>`}</code></TB>

        <ColorPicker
          onColor={c => editor.chain().focus().setColor(c).run()}
          onHighlight={c => editor.chain().focus().toggleHighlight({ color: c }).run()}
        />

        {SEP}

        <TB onClick={() => editor.chain().focus().setTextAlign('left').run()}    active={editor.isActive({ textAlign: 'left' })}    title="Căn trái">⬛L</TB>
        <TB onClick={() => editor.chain().focus().setTextAlign('center').run()}  active={editor.isActive({ textAlign: 'center' })}  title="Căn giữa">⬛C</TB>
        <TB onClick={() => editor.chain().focus().setTextAlign('right').run()}   active={editor.isActive({ textAlign: 'right' })}   title="Căn phải">⬛R</TB>
        <TB onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Căn đều">⬛J</TB>

        {SEP}

        <TB onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Danh sách •">• ≡</TB>
        <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Danh sách số">1≡</TB>
        <TB onClick={() => editor.chain().focus().toggleTaskList().run()}    active={editor.isActive('taskList')}    title="Checkbox list">☑</TB>
        <TB onClick={() => editor.chain().focus().toggleBlockquote().run()}  active={editor.isActive('blockquote')}  title="Trích dẫn">❝</TB>

        {SEP}

        <TB onClick={() => setDialog('link')} active={editor.isActive('link')} title="Chèn / sửa link">🔗</TB>
        {editor.isActive('link') && (
          <TB onClick={() => editor.chain().focus().unsetLink().run()} title="Gỡ link" danger>✕🔗</TB>
        )}
        <TB onClick={() => setDialog('image')} title="Chèn hình ảnh">🖼</TB>
        <TB onClick={() => setDialog('youtube')} title="Nhúng video YouTube">▶️</TB>
        <TB onClick={() => setDialog('table')} title="Chèn bảng">⊞</TB>
        <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Đường kẻ ngang">—</TB>

        {/* Table controls — chỉ hiện khi con trỏ đang trong table */}
        {editor.isActive('table') && (<>
          {SEP}
          <span style={{ fontSize: 10, color: T.text3, padding: '0 4px' }}>Bảng:</span>
          <TB onClick={() => editor.chain().focus().addColumnBefore().run()} title="Thêm cột trước">+◀C</TB>
          <TB onClick={() => editor.chain().focus().addColumnAfter().run()}  title="Thêm cột sau">+C▶</TB>
          <TB onClick={() => editor.chain().focus().addRowBefore().run()}    title="Thêm hàng trước">+▲R</TB>
          <TB onClick={() => editor.chain().focus().addRowAfter().run()}     title="Thêm hàng sau">+R▼</TB>
          <TB onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle header" active={false}>H</TB>
          <TB onClick={() => editor.chain().focus().deleteColumn().run()} title="Xoá cột" danger>-C</TB>
          <TB onClick={() => editor.chain().focus().deleteRow().run()}    title="Xoá hàng" danger>-R</TB>
          <TB onClick={() => editor.chain().focus().deleteTable().run()}  title="Xoá bảng" danger>✕⊞</TB>
        </>)}

        <div style={{ flex: 1 }} />

        <TB onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác (Ctrl+Z)">↩</TB>
        <TB onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại (Ctrl+Y)">↪</TB>
      </div>

      {/* EDITOR CONTENT */}
      <EditorContent editor={editor} style={{ flex: 1, minHeight: 220 }} />

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: '5px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.toolbarBg }}>
        <span style={{ fontSize: 11, color: T.text3 }}>{wordCount} từ</span>
        <span style={{ fontSize: 11, color: T.text3 }}>Ctrl+Z hoàn tác · Kéo thả ảnh vào editor để chèn</span>
      </div>

      {/* DIALOG */}
      <InsertDialog type={dialog} onClose={() => setDialog(null)} onConfirm={handleDialog} />

      {/* EDITOR CSS */}
      <style>{`
        .ProseMirror { padding: 16px 20px; min-height: 220px; outline: none; font-size: 14px; line-height: 1.85; color: ${T.text1}; font-family: inherit; }
        .ProseMirror > * + * { margin-top: 0.75em; }
        .ProseMirror p { margin: 0; }
        .ProseMirror h1 { font-size: 22px; font-weight: 700; margin: 20px 0 6px; }
        .ProseMirror h2 { font-size: 18px; font-weight: 700; margin: 16px 0 5px; }
        .ProseMirror h3 { font-size: 15px; font-weight: 600; margin: 14px 0 4px; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 22px; }
        .ProseMirror li + li { margin-top: 4px; }
        .ProseMirror blockquote { border-left: 3px solid ${T.accent}; margin: 12px 0; padding: 8px 14px; background: ${T.accentLight}; border-radius: 0 6px 6px 0; color: ${T.text2}; }
        .ProseMirror code { background: #F4F4F5; padding: 2px 5px; border-radius: 4px; font-size: 12.5px; font-family: monospace; color: #DC2626; }
        .ProseMirror pre { background: #1E1E2E; color: #CDD6F4; padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
        .ProseMirror pre code { background: none; color: inherit; font-size: 13px; padding: 0; }
        .ProseMirror hr { border: none; border-top: 1.5px solid ${T.border}; margin: 18px 0; }
        .ProseMirror img { max-width: 100%; border-radius: 8px; display: block; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }
        .ProseMirror img.ProseMirror-selectednode { border-color: ${T.accent}; }
        .ProseMirror iframe { border-radius: 10px; max-width: 100%; }
        .ProseMirror a { color: ${T.accent}; text-decoration: underline; cursor: pointer; }
        .ProseMirror table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .ProseMirror th { background: #F4F4F5; font-weight: 600; padding: 8px 12px; text-align: left; border: 1px solid ${T.border}; font-size: 13px; }
        .ProseMirror td { padding: 7px 12px; border: 1px solid ${T.border}; font-size: 13px; vertical-align: top; min-width: 60px; }
        .ProseMirror td.selectedCell, .ProseMirror th.selectedCell { background: ${T.accentLight}; }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
        .ProseMirror ul[data-type="taskList"] li input[type="checkbox"] { margin-top: 3px; cursor: pointer; accent-color: ${T.accent}; width: 15px; height: 15px; flex-shrink: 0; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: ${T.text3}; float: left; pointer-events: none; height: 0; }
      `}</style>
    </div>
  )
}
