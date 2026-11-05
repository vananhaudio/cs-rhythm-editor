// Khung soạn "Hỏi / Chia sẻ" một đoạn bản nhạc (Share Note V1). Lời nhắn → tạo THAM CHIẾU (share_note_create, idempotent theo khoá
// của lần soạn này) → gửi bạn qua Chat bằng ShareToFriendSheet (Universal Share) HOẶC đăng lên Feed. Không tạo ảnh/PDF/bản sao nhạc.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { barRangeText, createShareNote, createShareText, newClientKey, publishShareNote, publishShareText, type BarRange, type ScoreKey } from './shareNoteApi'
import type { TextAnchor } from './textAnchor'
import { shareNoteRef } from './shareRef'

const ShareToFriendSheet = lazy(() => import('./ShareToFriendSheet'))
const FONT = `'Be Vietnam Pro',system-ui,sans-serif`
const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,10,16,.62)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT } as const,
  card: { width: 'min(100%, 440px)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#16161a', borderRadius: '18px 18px 0 0', padding: '16px 16px max(16px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,.3)' } as const,
  opt: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', minHeight: 56, padding: '10px 14px', border: '1px solid #e0e0e6', borderRadius: 14, background: '#f6f6f8', color: '#16161a', textAlign: 'left', cursor: 'pointer', fontFamily: FONT } as const,
  ghost: { minHeight: 40, border: '1px solid #d8d8de', borderRadius: 12, background: '#fff', color: '#16161a', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: '0 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } as const,
}
export const NOTE_MAX = 500

export default function ShareNoteComposer({ sessionId, sessionLabel, score, bars, text: textSel, onClose }: {
  sessionId: string
  /** "Buổi 04 · Tên buổi" — chỉ để người học thấy mình đang hỏi về đâu */
  sessionLabel: string
  /** Hỏi về Ô NHỊP (V1) */
  score?: ScoreKey
  bars?: BarRange
  /** Hỏi về VÙNG VĂN BẢN (V2): neo (điểm mã) + trích chỉ để HIỆN cho người soạn (không gửi lên server — server tự cắt từ giáo trình) */
  text?: { anchor: TextAnchor; quote: string }
  onClose: () => void
}) {
  const isText = !!textSel
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'edit' | 'busy' | 'friends' | 'posted'>('edit')
  const [error, setError] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const clientKey = useRef(newClientKey())                    // MỘT lần soạn = MỘT note dù bấm lại / thử lại
  const busyRef = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { taRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'busy') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const note = text.trim()
  const title = isText ? sessionLabel : `${sessionLabel} · ${bars ? barRangeText(bars) : ''}`
  const ensure = async (): Promise<string | null> => {
    if (noteId) return noteId
    const r = textSel
      ? await createShareText({ sessionId, anchor: textSel.anchor, note, clientKey: clientKey.current })
      : await createShareNote({ sessionId, score: score as ScoreKey, bars: bars as BarRange, note, clientKey: clientKey.current })
    if (!r.ok) { setError(r.message); return null }
    setNoteId(r.id)
    return r.id
  }
  const run = async (kind: 'friends' | 'feed') => {
    if (busyRef.current || !note) return
    busyRef.current = true; setPhase('busy'); setError(null)
    try {
      const id = await ensure()
      if (!id) { setPhase('edit'); return }
      if (kind === 'friends') { setPhase('friends'); return }
      const p = isText ? await publishShareText(id) : await publishShareNote(id)
      if (!p.ok) { setError(p.message); setPhase('edit'); return }
      setPhase('posted')
    } finally { busyRef.current = false }
  }

  if (phase === 'friends' && noteId) {
    return <Suspense fallback={null}><ShareToFriendSheet target={shareNoteRef(noteId)} title={`${title} — ${note}`} onClose={onClose} /></Suspense>
  }
  return (
    <div style={S.overlay} onMouseDown={e => { if (e.target === e.currentTarget && phase !== 'busy') onClose() }}>
      <div style={S.card} role="dialog" aria-modal="true" aria-label={isText ? 'Hỏi về đoạn văn bản' : 'Hỏi về đoạn nhạc'}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{isText ? 'Hỏi về đoạn văn bản' : 'Hỏi về đoạn nhạc'}</div>
          <button type="button" onClick={onClose} disabled={phase === 'busy'} style={{ ...S.ghost, minHeight: 36 }}>Đóng</button>
        </div>
        <div style={{ fontSize: 13.5, color: '#5b5b66', marginBottom: 10, overflowWrap: 'anywhere' }}>{title}</div>
        {textSel && <blockquote data-testid="composer-quote" style={{ margin: '0 0 10px', padding: '8px 12px', borderLeft: '3px solid #EA580C', background: '#fff7f0', borderRadius: 8, fontSize: 14, lineHeight: 1.45, color: '#16161a', overflowWrap: 'anywhere' }}>{textSel.quote}</blockquote>}
        {phase === 'posted' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p role="status" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Đã đăng lên Feed</p>
            <p style={{ margin: 0, fontSize: 13.5, color: '#5b5b66' }}>{isText ? 'Bạn cùng lớp mở bài đăng sẽ thấy đúng đoạn giáo trình này và có thể bình luận.' : 'Bạn cùng lớp mở bài đăng sẽ thấy đúng đoạn nhạc này và có thể bình luận.'}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/me" style={S.ghost}>Xem trên Trang chủ</a>
              <button type="button" onClick={() => setPhase('friends')} style={S.ghost}>Gửi thêm cho bạn bè</button>
              <button type="button" onClick={onClose} style={S.ghost}>Xong</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="share-note-text" style={{ fontSize: 14, fontWeight: 700 }}>Câu hỏi / ghi chú</label>
            <textarea id="share-note-text" ref={taRef} value={text} maxLength={NOTE_MAX} rows={3} disabled={phase === 'busy' || !!noteId}
              onChange={e => setText(e.target.value)} placeholder="Ví dụ: Ô này em bấm hợp âm chưa tròn tiếng, thầy xem giúp em"
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 84, borderRadius: 12, border: '1px solid #d8d8de', padding: '10px 12px', fontSize: 16, fontFamily: FONT, resize: 'vertical' }} />
            <div style={{ fontSize: 12, color: '#8a8a94', textAlign: 'right' }}>{text.length}/{NOTE_MAX}</div>
            <button type="button" disabled={!note || phase === 'busy'} onClick={() => void run('friends')} style={{ ...S.opt, opacity: !note || phase === 'busy' ? 0.55 : 1 }}>
              <span style={{ fontSize: 15.5, fontWeight: 800 }}>Gửi cho bạn bè</span>
              <span style={{ fontSize: 13, color: '#5b5b66' }}>Gửi riêng qua Trò chuyện — người nhận mở đúng đoạn này</span>
            </button>
            <button type="button" disabled={!note || phase === 'busy'} onClick={() => void run('feed')} style={{ ...S.opt, opacity: !note || phase === 'busy' ? 0.55 : 1 }}>
              <span style={{ fontSize: 15.5, fontWeight: 800 }}>Đăng lên Feed</span>
              <span style={{ fontSize: 13, color: '#5b5b66' }}>Bạn cùng lớp có quyền xem giáo trình sẽ mở được đoạn này</span>
            </button>
            {phase === 'busy' && <p role="status" style={{ margin: '4px 0 0', fontSize: 13.5, color: '#5b5b66' }}>Đang xử lý…</p>}
            {error && <p role="alert" style={{ margin: '4px 0 0', fontSize: 14, color: '#b42318' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
