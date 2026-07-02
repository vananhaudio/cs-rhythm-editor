// ── CÔNG CỤ TẠO STRUM SCORE — Bước 1: vạch nhịp trên lời bài hát ───────────────
// Màn chia đôi: TRÊN = ảnh sheet (chỉ để nhìn vạch nhịp) · DƯỚI = lời + hợp âm
// (dán từ Hợp Âm Việt kiểu [C]lời), thầy bấm khe giữa các từ để cắm vạch nhịp.
// LÁT 1a: khung + xem ảnh sheet + dán & render lời-hợp âm.
// LÁT 1b: bấm khe cắm/xoá vạch nhịp, đánh số ô, tóm tắt hợp âm/ô, lưu localStorage.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StrumDraft } from './strumDrafts'
import { saveDraft } from './strumDrafts'
import { cseConfigured, searchImages, googleImagesUrl, type ImgResult } from './googleImageSearch'

const A = { accent: '#4F46E5', border: '#E4E4E7', sub: '#71717A', ink: '#27272A', bg: '#F4F4F5' }

// Một đoạn lời gắn 1 hợp âm (hoặc không) — hợp âm rơi vào ĐẦU đoạn text.
export interface ChordSeg { chord: string | null; text: string }
// Một TỪ (đơn vị vạch nhịp) — hợp âm chỉ gắn vào từ đầu của đoạn.
interface Tok { chord: string | null; word: string; line: number; gi: number }

// Bóc [Hợp âm] khỏi 1 dòng lời → mảng đoạn { chord, text }. Chord dính ĐẦU text sau nó.
export function parseChordLine(line: string): ChordSeg[] {
  const out: ChordSeg[] = []
  const re = /\[([^\]]+)\]/g
  let idx = 0, chord: string | null = null, m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    out.push({ chord, text: line.slice(idx, m.index) })
    chord = m[1].trim()
    idx = m.index + m[0].length
  }
  out.push({ chord, text: line.slice(idx) })
  return out.filter((s, i) => !(i === 0 && !s.chord && !s.text))
}

// Các dòng-đoạn → danh sách TỪ phẳng (đánh số toàn cục gi) để cắm vạch giữa các từ.
function tokenize(lines: ChordSeg[][]): Tok[] {
  const toks: Tok[] = []
  lines.forEach((segs, li) => {
    segs.forEach((seg) => {
      const words = seg.text.split(/\s+/).filter(Boolean)
      if (words.length === 0 && seg.chord) { toks.push({ chord: seg.chord, word: '', line: li, gi: 0 }); return }
      words.forEach((w, wi) => toks.push({ chord: wi === 0 ? seg.chord : null, word: w, line: li, gi: 0 }))
    })
  })
  toks.forEach((t, i) => (t.gi = i))
  return toks
}

const SAMPLE = `[C]Chúc mừng sinh nhật [G]bạn
Chúc mừng sinh [C]nhật
Chúc mừng [F]bạn [C]thân [G]mến
Chúc mừng sinh [C]nhật`

// Sửa lời xong, dời VẠCH theo TỪ (không theo số thứ tự) — so khớp từ cũ↔mới bằng LCS.
// Vạch c = ranh giới TRƯỚC từ cũ thứ c → tìm từ cũ ≥ c còn khớp ở bản mới, đặt vạch trước nó.
export function remapCuts(oldWords: string[], newWords: string[], cuts: Set<number>): Set<number> {
  const n = oldWords.length, m = newWords.length
  if (cuts.size === 0 || n === 0 || m === 0) return new Set<number>()
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = oldWords[i] === newWords[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const o2n = new Array<number>(n).fill(-1)
  let i = 0, j = 0
  while (i < n && j < m) {
    if (oldWords[i] === newWords[j]) { o2n[i] = j; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  const out = new Set<number>()
  for (const c of cuts) {
    let k = c
    while (k < n && o2n[k] === -1) k++          // từ cũ tại vạch bị xoá → bám từ khớp kế tiếp
    if (k < n && o2n[k] > 0) out.add(o2n[k])    // vạch về đầu bài (0) thì bỏ (Ô1 cố định sẵn)
  }
  return out
}

// Màn hẹp (điện thoại) < 1024px — khớp breakpoint app (MobileStudentPortal)
function useNarrow() {
  const [n, setN] = useState(typeof window !== 'undefined' && window.innerWidth < 1024)
  useEffect(() => {
    const on = () => setN(window.innerWidth < 1024)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return n
}

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

export default function StrumBuilder({ draft, onBack }: { draft: StrumDraft; onBack: () => void }) {
  const narrow = useNarrow()
  const [title, setTitle] = useState(draft.title)
  const [sheetUrl, setSheetUrl] = useState(draft.sheet_url ?? '')
  const [zoom, setZoom] = useState(1)
  const [meter, setMeter] = useState(draft.meter)
  const [raw, setRaw] = useState(draft.raw_lyric)
  const [editing, setEditing] = useState(draft.raw_lyric.trim().length === 0)
  const [cuts, setCuts] = useState<Set<number>>(() => new Set(draft.cuts))
  const [status, setStatus] = useState<SaveStatus>('saved')
  // Tìm ảnh sheet
  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState<ImgResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(!!draft.sheet_url)   // chưa có ảnh → thu gọn, nhường chỗ cho vạch nhịp

  const doSearch = async () => {
    const q = searchQ.trim(); if (!q) return
    if (!cseConfigured) { window.open(googleImagesUrl(q), '_blank'); return }   // không có API → Enter cũng mở tab Google Ảnh
    setSheetOpen(true); setSearching(true); setSearchErr(null)
    try { setResults(await searchImages(q)) }
    catch (e: any) { setSearchErr(e?.message || 'Lỗi tìm ảnh'); setResults([]) }
    finally { setSearching(false) }
  }
  const pickImage = (url: string) => { setSheetUrl(url); setResults(null); setZoom(1) }

  const lines = useMemo(() => raw.split('\n').map(parseChordLine), [raw])
  const tokens = useMemo(() => tokenize(lines), [lines])
  const hasLyric = raw.trim().length > 0

  // Lời thay đổi (sửa/thêm/bớt chữ) → dời vạch bám theo TỪ, không để trượt sai chỗ
  const wordsRef = useRef<string[]>(tokens.map((t) => t.word))
  useEffect(() => {
    const oldW = wordsRef.current
    const newW = tokens.map((t) => t.word)
    const same = oldW.length === newW.length && oldW.every((w, k) => w === newW[k])
    if (!same) setCuts((prev) => remapCuts(oldW, newW, prev))
    wordsRef.current = newW
  }, [tokens])

  // Ảnh chụp trạng thái đã lưu (để biết "chưa lưu")
  const snap = () => JSON.stringify({ title, sheetUrl, meter, raw, cuts: [...cuts] })
  const savedRef = useRef(JSON.stringify({ title: draft.title, sheetUrl: draft.sheet_url ?? '', meter: draft.meter, raw: draft.raw_lyric, cuts: draft.cuts }))

  const persist = async () => {
    setStatus('saving')
    try {
      await saveDraft(draft.id, { title: title.trim() || 'Bài chưa đặt tên', sheet_url: sheetUrl || null, meter, raw_lyric: raw, cuts: [...cuts] })
      savedRef.current = snap(); setStatus('saved')
    } catch { setStatus('error') }
  }

  // Tự lưu sau 1.2s ngừng thao tác
  useEffect(() => {
    if (snap() === savedRef.current) return
    setStatus('dirty')
    const h = setTimeout(persist, 1200)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, sheetUrl, meter, raw, cuts])

  const handleBack = async () => {
    if (snap() !== savedRef.current) await persist()
    onBack()
  }

  // Số ô cho từng từ (ô 1 bắt đầu ở từ đầu; mỗi vạch → +1 ô)
  const barOf = useMemo(() => {
    const arr: number[] = []; let b = 1
    tokens.forEach((t, i) => { if (i > 0 && cuts.has(i)) b++; arr[i] = b })
    return arr
  }, [tokens, cuts])
  const totalBars = tokens.length ? barOf[tokens.length - 1] : 0

  // Tóm tắt hợp âm mỗi ô
  const barSummary = useMemo(() => {
    const map = new Map<number, string[]>()
    tokens.forEach((t, i) => { const n = barOf[i]; if (!map.has(n)) map.set(n, []); if (t.chord) map.get(n)!.push(t.chord) })
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [tokens, barOf])

  const toggleCut = (gi: number) => setCuts((prev) => { const n = new Set(prev); n.has(gi) ? n.delete(gi) : n.add(gi); return n })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: A.bg, fontFamily: 'Inter, system-ui, sans-serif', color: A.ink }}>
      {/* Thanh công cụ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderBottom: `1px solid ${A.border}`, flexWrap: 'wrap' }}>
        <button onClick={handleBack}
          style={{ background: 'none', border: `1px solid ${A.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: A.sub, cursor: 'pointer', whiteSpace: 'nowrap' }}>← Bài của tôi</button>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bài…"
          style={{ flex: 1, minWidth: 120, maxWidth: 340, padding: '7px 10px', borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: SAVE_UI[status].color, whiteSpace: 'nowrap' }}>{SAVE_UI[status].label}</span>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, fontWeight: 700, color: A.sub }}>Nhịp</label>
        <select value={meter} onChange={(e) => setMeter(+e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 13, fontFamily: 'inherit' }}>
          <option value={2}>2/4</option>
          <option value={3}>3/4</option>
          <option value={4}>4/4</option>
        </select>
      </div>

      {/* NỬA TRÊN — sheet tham chiếu (thu gọn được để nhường chỗ cho vạch nhịp) */}
      <div style={{ flex: sheetOpen ? (narrow ? '0 0 32vh' : 1) : '0 0 auto', minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: `2px solid ${A.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FAFAFA', borderBottom: sheetOpen ? `1px solid ${A.border}` : 'none', flexWrap: 'wrap' }}>
          <button onClick={() => setSheetOpen((v) => !v)} title={sheetOpen ? 'Thu gọn sheet' : 'Mở sheet'} style={{ ...zbtn, fontSize: 12 }}>{sheetOpen ? '▾' : '▸'}</button>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', color: '#A1A1AA', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Sheet tham chiếu</span>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
            placeholder="Tìm sheet: tên bài…"
            style={{ flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 13, fontFamily: 'inherit' }} />
          {cseConfigured
            ? <button onClick={doSearch} disabled={searching} style={{ ...ghost, background: A.accent, color: '#fff', border: 'none', opacity: searching ? .6 : 1 }}>{searching ? '⏳' : '🔍 Tìm'}</button>
            : <a href={googleImagesUrl(searchQ || title)} target="_blank" rel="noreferrer" style={{ ...ghost, textDecoration: 'none', display: 'inline-block' }}>Google Ảnh ↗</a>}
          <button onClick={() => setShowPaste((v) => !v)} title="Dán link ảnh thủ công" style={zbtn}>🔗</button>
          {sheetUrl && !results && <>
            <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} style={zbtn}>−</button>
            <span style={{ fontSize: 12, color: A.sub, minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} style={zbtn}>+</button>
          </>}
        </div>

        {showPaste && (
          <div style={{ padding: '8px 14px', background: '#FAFAFA', borderBottom: `1px solid ${A.border}` }}>
            <input value={sheetUrl} onChange={(e) => { setSheetUrl(e.target.value.trim()); if (e.target.value.trim()) setSheetOpen(true) }} placeholder="Dán link ảnh sheet (…​.jpg/.png)"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        )}

        {sheetOpen && <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#3F3F46' }}>
          {results
            ? (searchErr
                ? <div style={{ color: '#FCA5A5', fontSize: 13.5, textAlign: 'center', padding: 24, lineHeight: 1.7 }}>{searchErr}</div>
                : results.length === 0
                  ? <div style={{ color: '#A1A1AA', fontSize: 13.5, textAlign: 'center', padding: 24 }}>Không tìm thấy ảnh. Thử từ khoá khác.</div>
                  : <div style={{ display: 'grid', gridTemplateColumns: `repeat(${narrow ? 3 : 5}, 1fr)`, gap: 6, padding: 8 }}>
                      {results.map((r, i) => (
                        <img key={i} src={r.thumb} alt={r.title} title={r.title} onClick={() => pickImage(r.url)}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, cursor: 'pointer', background: '#52525B' }} />
                      ))}
                    </div>)
            : sheetUrl
              ? <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
                  <img src={sheetUrl} alt="sheet" style={{ width: `${zoom * 100}%`, maxWidth: 'none', display: 'block' }} />
                </div>
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A1A1AA', fontSize: 14, textAlign: 'center', lineHeight: 1.7, padding: 16 }}>
                  {cseConfigured ? 'Gõ tên bài rồi bấm 🔍 Tìm để chọn sheet.' : 'Bấm 🔗 dán link ảnh, hoặc “Google Ảnh ↗” để tìm rồi dán.'}<br />Sheet chỉ để nhìn canh nhịp.
                </div>}
        </div>}
      </div>

      {/* NỬA DƯỚI — lời + hợp âm + vạch nhịp */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', background: '#FAFAFA', borderBottom: `1px solid ${A.border}` }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#A1A1AA', textTransform: 'uppercase' }}>Lời &amp; hợp âm</span>
          {!editing && <span style={{ fontSize: 12, color: A.sub }}>Bấm khe giữa các chữ để cắm/xoá vạch nhịp │</span>}
          <div style={{ flex: 1 }} />
          {!editing && cuts.size > 0 && <button onClick={() => setCuts(new Set())} style={ghost}>Xoá hết vạch</button>}
          {!editing && <button onClick={() => setRaw(SAMPLE)} style={ghost}>Dán mẫu</button>}
          <button onClick={() => setEditing((v) => !v)} style={ghost}>{editing ? '✓ Xong, vạch nhịp' : '✎ Sửa lời'}</button>
        </div>

        {editing
          ? <div style={{ flex: 1, minHeight: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: A.sub }}>Dán lời-hợp âm kiểu Hợp Âm Việt: <code style={{ background: '#EEE', padding: '1px 5px', borderRadius: 4 }}>[C]Chúc mừng [G]sinh nhật</code></div>
              <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={SAMPLE}
                style={{ flex: 1, minHeight: 0, resize: 'none', padding: 12, borderRadius: 10, border: `1px solid ${A.border}`, fontSize: 14, fontFamily: 'ui-monospace, Menlo, monospace', lineHeight: 1.7, boxSizing: 'border-box' }} />
            </div>
          : <>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: narrow ? '16px 12px' : '22px 24px' }}>
                {!hasLyric
                  ? <div style={{ color: A.sub, fontSize: 14 }}>Chưa có lời. Bấm <b>✎ Sửa lời</b> để dán.</div>
                  : lines.map((_, li) => {
                      const lineToks = tokens.filter((t) => t.line === li)
                      if (lineToks.length === 0) return <div key={li} style={{ height: 16 }} />   // dòng trống → cách câu
                      return (
                        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 }}>
                          {lineToks.map((t) => (
                            <span key={t.gi} style={{ display: 'inline-flex', alignItems: 'stretch' }}>
                              <Boundary gi={t.gi} active={t.gi === 0 || cuts.has(t.gi)} fixed={t.gi === 0} num={barOf[t.gi]} onToggle={toggleCut} big={narrow} />
                              <span style={{ display: 'inline-flex', flexDirection: 'column', whiteSpace: 'pre', padding: '0 2px' }}>
                                <span style={{ height: 18, fontSize: narrow ? 14 : 13, fontWeight: 800, color: A.accent, lineHeight: '18px' }}>{t.chord ?? ''}</span>
                                <span style={{ fontSize: narrow ? 20 : 18, lineHeight: narrow ? '30px' : '26px' }}>{t.word}</span>
                              </span>
                            </span>
                          ))}
                        </div>
                      )
                    })}
              </div>
              {/* Tóm tắt ô */}
              {hasLyric && (
                <div style={{ borderTop: `1px solid ${A.border}`, background: '#fff', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, overflowX: 'auto' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: A.ink, whiteSpace: 'nowrap' }}>{totalBars} ô · nhịp {meter}/4</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {barSummary.map(([n, chords]) => (
                      <span key={n} style={{ whiteSpace: 'nowrap', fontSize: 12.5, color: A.sub, border: `1px solid ${A.border}`, borderRadius: 7, padding: '3px 9px' }}>
                        <b style={{ color: A.accent }}>Ô{n}</b> {chords.length ? chords.join(' ') : '—'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>}
      </div>
    </div>
  )
}

// Khe giữa 2 từ — bấm để cắm/xoá vạch nhịp. active=đang có vạch; fixed=vạch mở đầu (Ô1, không xoá).
function Boundary({ gi, active, fixed, num, onToggle, big }: { gi: number; active: boolean; fixed: boolean; num: number; onToggle: (gi: number) => void; big?: boolean }) {
  return (
    <span onClick={fixed ? undefined : () => onToggle(gi)} title={fixed ? 'Đầu bài' : 'Bấm để cắm/xoá vạch nhịp'}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', cursor: fixed ? 'default' : 'pointer', padding: big ? '0 9px' : '0 4px', userSelect: 'none' }}>
      <span style={{ height: 18, fontSize: big ? 11 : 10, fontWeight: 800, color: active ? A.accent : 'transparent', lineHeight: '18px' }}>{active ? num : ''}</span>
      <span style={{ width: active ? 3 : 2, flex: 1, minHeight: big ? 30 : 26, borderRadius: 2, background: active ? A.accent : '#E7E7EA' }} />
    </span>
  )
}

const SAVE_UI: Record<SaveStatus, { label: string; color: string }> = {
  saved: { label: '✓ Đã lưu', color: '#16A34A' },
  dirty: { label: '• Chưa lưu', color: '#A1A1AA' },
  saving: { label: '⏳ Đang lưu…', color: '#D97706' },
  error: { label: '⚠ Lỗi lưu', color: '#DC2626' },
}

const zbtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: `1px solid ${A.border}`, background: '#fff', fontSize: 16, fontWeight: 700, color: A.ink, cursor: 'pointer', lineHeight: 1 }
const ghost: React.CSSProperties = { background: 'none', border: `1px solid ${A.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: A.sub, cursor: 'pointer' }
