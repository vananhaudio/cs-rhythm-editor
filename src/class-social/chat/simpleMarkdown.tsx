// Markdown đơn giản cho thông điệp Broadcast — AN TOÀN: chỉ tạo phần tử React (không dangerouslySetInnerHTML, không HTML thô).
// Hỗ trợ: **đậm** · *nghiêng* / _nghiêng_ · `mã` · [chữ](liên kết) · URL trần · danh sách "- " / "* " / "• " · xuống dòng.
// Liên kết chỉ nhận https?:// hoặc đường dẫn nội bộ "/…"; mọi giao thức khác (javascript:, data:, …) hiển thị như chữ thường.
// Văn bản không có ký hiệu Markdown được dựng lại NGUYÊN VĂN (thông báo cũ không đổi).
import type { ReactNode } from 'react'

export type MdLinks = 'anchor' | 'text'   // 'text': dùng trong nút/thẻ bấm (không lồng <a> trong <button>)

export const safeHref = (raw: string): string | null => {
  const v = raw.trim()
  if (v.length === 0 || v.length > 500) return null
  if (/^\/(?![/\\])\S*$/.test(v)) return v
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(v)) return v
  return null
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>"'`)\]]+)|(\*[^*\s][^*\n]*?\*)|(\b_[^_\s][^_\n]*?_\b)/g

function link(href: string, label: ReactNode, key: string, mode: MdLinks): ReactNode {
  if (mode === 'text') return <span key={key} className="cs-md-link">{label}</span>
  const external = /^https?:/i.test(href)
  return <a key={key} className="cs-md-link" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>{label}</a>
}

export function renderInline(text: string, mode: MdLinks = 'anchor', depth = 0, keyBase = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const tok = m[0]
    const key = `${keyBase}${n++}`
    if (m[1]) out.push(<code key={key} className="cs-md-code">{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={key}>{depth < 2 ? renderInline(tok.slice(2, -2), mode, depth + 1, key + '.') : tok.slice(2, -2)}</strong>)
    else if (m[3]) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      const href = mm ? safeHref(mm[2]) : null
      if (mm && href) out.push(link(href, mm[1], key, mode)); else out.push(tok)
    } else if (m[4]) {
      const trail = /[.,;:!?]+$/.exec(tok)?.[0] ?? ''
      const url = trail ? tok.slice(0, -trail.length) : tok
      const href = safeHref(url)
      if (href) { out.push(link(href, url, key, mode)); if (trail) out.push(trail) } else out.push(tok)
    } else if (m[5]) out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    else if (m[6]) out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    last = i + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const BULLET = /^\s*(?:[-*•])\s+(.*)$/

// Khối: đoạn văn (giữ xuống dòng) và danh sách. Dùng <span> (hợp lệ trong <button>); CSS .cs-md-* quyết bố cục.
export function renderSimpleMarkdown(text: string, mode: MdLinks = 'anchor'): ReactNode {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let items: string[] = []
  const flushPara = () => {
    if (para.length === 0) return
    const k = `p${blocks.length}`
    blocks.push(<span key={k} className="cs-md-p">{para.map((l, i) => <span key={i}>{i > 0 && <br />}{renderInline(l, mode, 0, `${k}.${i}.`)}</span>)}</span>)
    para = []
  }
  const flushList = () => {
    if (items.length === 0) return
    const k = `l${blocks.length}`
    blocks.push(<span key={k} className="cs-md-ul">{items.map((l, i) => <span key={i} className="cs-md-li"><span aria-hidden="true" className="cs-md-dot">•</span><span>{renderInline(l, mode, 0, `${k}.${i}.`)}</span></span>)}</span>)
    items = []
  }
  for (const line of lines) {
    const b = BULLET.exec(line)
    if (b && b[1].trim() !== '') { flushPara(); items.push(b[1]); continue }
    flushList()
    if (line.trim() === '') { flushPara(); continue }
    para.push(line)
  }
  flushPara(); flushList()
  return blocks
}
