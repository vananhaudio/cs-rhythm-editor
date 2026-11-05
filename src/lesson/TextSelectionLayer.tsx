// Contextual Share V2 — chọn VĂN BẢN giáo trình để hỏi / chia sẻ. Chọn bằng chọn văn bản TỰ NHIÊN của trình duyệt (desktop kéo chuột, cảm ứng nhấn giữ + kéo).
// • Thanh hành động CỐ ĐỊNH ở đáy màn hình (không bong bóng nổi: menu hệ thống của iOS nằm ngay trên vùng chọn sẽ đè bong bóng).
// • Vùng chọn phải nằm TRỌN trong MỘT lá văn bản (1–500 điểm mã, ≥ 4 ký tự không phải khoảng trắng). Vắt nhiều lá / ngoài lá / quá ngắn / quá dài ⇒ KHÔNG tự co:
//   báo rõ lý do, khoá nút, giữ nguyên vùng chọn của người dùng (docs §14). Chỉ làm tròn tới ranh giới ký tự trọn (grapheme) TRONG cùng lá.
// • Toạ độ = ĐIỂM MÃ (xem src/share/textAnchor.ts). Lá lấy từ dữ liệu giáo trình (không từ DOM); DOM chỉ cho offset UTF-16, và phải khớp chuỗi nguồn — lệch ⇒ outside.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { MessageCircleQuestion, X } from 'lucide-react'
import { classifyInLeaf, cpLen, leafTextAt, SELECTION_HINT, type SelectionVerdict, type TextAnchor } from '../share/textAnchor'

const leafOf = (n: Node | null): HTMLElement | null => {
  const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement)
  return (el?.closest('[data-tp]') as HTMLElement | null) ?? null
}
const parseTp = (tp: string): { section: number; path: string[] } | null => {
  const i = tp.indexOf(':'); const section = Number(tp.slice(0, i))
  return i > 0 && Number.isInteger(section) ? { section, path: tp.slice(i + 1).split('.') } : null
}

export default function TextSelectionLayer({ root, sections, onAsk }: { root: RefObject<HTMLElement | null>; sections: unknown; onAsk: (a: TextAnchor, quote: string) => void }) {
  const [v, setV] = useState<SelectionVerdict | null>(null)
  const pressing = useRef(false)
  const leafEl = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection(), el = root.current
      if (!sel || !el || sel.rangeCount === 0) return
      if (sel.isCollapsed) { if (!pressing.current) setV(null); return }          // bấm nút trên thanh làm mất vùng chọn trên iOS: giữ nguyên trong lúc bấm
      const r = sel.getRangeAt(0)
      if (!el.contains(r.commonAncestorContainer)) { if (!pressing.current) setV(null); return }   // vùng chọn ngoài giáo trình: không liên quan
      if (!r.toString().trim()) { setV(null); return }
      const a = leafOf(r.startContainer), b = leafOf(r.endContainer)
      if (!a && !b) { setV({ status: 'outside' }); return }
      if (a !== b || !a) { setV({ status: a && b ? 'multi' : 'outside' }); return }
      const id = parseTp(a.dataset.tp ?? '')
      const leaf = id ? leafTextAt(sections, id) : null
      if (!id || leaf === null) { setV({ status: 'outside' }); return }
      const pre = document.createRange(); pre.selectNodeContents(a); pre.setEnd(r.startContainer, r.startOffset)
      const u0 = pre.toString().length, u1 = u0 + r.toString().length
      if (leaf.slice(u0, u1) !== r.toString()) { setV({ status: 'outside' }); return }   // DOM ≠ chuỗi nguồn ⇒ không đoán
      leafEl.current = a
      setV(classifyInLeaf(id.section, id.path, leaf, u0, u1))
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [root, sections])

  const clear = useCallback(() => { try { document.getSelection()?.removeAllRanges() } catch { /* không có Selection */ } setV(null) }, [])
  const wholeLeaf = useCallback(() => {
    const el = leafEl.current, sel = document.getSelection()
    if (!el || !sel) return
    const rg = document.createRange(); rg.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rg)
  }, [])

  if (!v || v.status === 'empty') return null
  const ok = v.status === 'ok'
  const quote = ok ? (cpLen(v.text) > 90 ? Array.from(v.text).slice(0, 90).join('') + '…' : v.text) : ''
  const hold = () => { pressing.current = true; window.setTimeout(() => { pressing.current = false }, 700) }
  return (
    <div className="lsn-textbar no-print" role="region" aria-label="Hỏi về đoạn văn bản đã chọn" data-testid="text-share-bar" data-state={v.status}
      onPointerDown={hold} onMouseDown={e => e.preventDefault()}>
      <div className="lsn-textbar-in">
        {ok ? (
          <>
            <q className="lsn-textbar-q" data-testid="text-share-quote">{quote}</q>
            <div className="lsn-textbar-acts">
              <button type="button" className="lsn-share-btn is-primary" data-testid="text-share-ask" onClick={() => { onAsk(v.anchor, v.text); clear() }}>
                <MessageCircleQuestion size={15} aria-hidden="true" /> Hỏi / Chia sẻ
              </button>
              <button type="button" className="lsn-share-btn" onClick={wholeLeaf}>Cả đoạn</button>
              <button type="button" className="lsn-share-icon" aria-label="Bỏ chọn" onClick={clear}><X size={16} aria-hidden="true" /></button>
            </div>
          </>
        ) : (
          <>
            <p className="lsn-textbar-warn" role="status" data-testid="text-share-hint">{SELECTION_HINT[v.status as Exclude<SelectionVerdict['status'], 'ok' | 'empty'>]}</p>
            <div className="lsn-textbar-acts"><button type="button" className="lsn-share-btn" onClick={clear}>Bỏ chọn</button></div>
          </>
        )}
      </div>
    </div>
  )
}
