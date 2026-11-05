// ── LessonScore — khuông nhạc + TAB cho tài liệu học ──
// Dùng lại hạ tầng notation sẵn có của dự án: alphaTab (@coderline/alphatab) + font Bravura
// ở public/font/, nạp nội dung bằng alphaTex (giống src/components/ScoreTabViewerAlpha.tsx).
// KHÔNG thêm thư viện notation mới. Nội dung nhạc đi vào từ props dưới dạng chuỗi alphaTex.
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import ZoomFrame from './ZoomFrame'
import ScoreShareLayer from './ScoreShareLayer'
import { ScoreShareSlot } from './scoreShareSlot'
import type { BarRange, ScoreKey } from '../share/shareNoteApi'
import { planExcerpt, planExcerptFocus, type ExcerptPlan } from '../share/scoreExcerpt'
import { rectsForBars, type BoundsLike } from './scoreShare'

interface Props {
  tex: string
  /** số ô nhịp mỗi dòng khi in / desktop */
  barsPerRow?: number
  /** cho phép mở chế độ xem lớn (mobile) */
  zoomable?: boolean
  /** Vị trí bản nhạc trong buổi (khối + đường dẫn) — chỉ dùng khi trang cấp ScoreShareSlot ("Khoanh để hỏi") */
  shareKey?: ScoreKey
  /** Chỉ vẽ trích đoạn (Share Note trên Feed): dải ô 1-based; số ô vẽ do planExcerpt giới hạn (≤ 4 ô, ≤ 2 dòng). Không dùng chung với shareKey. */
  excerpt?: BarRange
  /** Báo kế hoạch vẽ (đổi khi khổ đổi) — để thẻ ghi "hiện N ô đầu"; ô ngữ cảnh (trước/sau vùng khoanh) vẽ bình thường, chỉ vùng khoanh được tô */
  onExcerpt?: (plan: ExcerptPlan) => void
  /** 'focus' (V1.3, khung giáo trình trên Feed): chỉ các dòng chứa vùng khoanh; 'full' (mặc định, V1.1): thêm ≤ 2 ô ngữ cảnh mỗi phía. Đổi giá trị = khắc lại TRONG CÙNG renderer. */
  excerptContext?: 'focus' | 'full'
}

/** Trích đoạn: alphaTab chừa ~50px dưới dòng nhạc cuối (lề + dòng bản quyền đã ẩn). Đo bằng điểm ảnh (03/11, Chrome + WebKit, 2 bản nhạc, 2 khổ): nét mực cuối
 *  luôn ≤ đáy realBounds của dòng cuối ⇒ cắt khung ở max(real, visual) + 6px không mất lời / TAB / ký hiệu. Chỉ chạm khung chứa, không đổi cách khắc. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trimExcerptBottom(api: any, host: HTMLElement | null) {
  const sys = api?.renderer?.boundsLookup?.staffSystems
  if (!host || !sys?.length) return
  const last = sys[sys.length - 1]
  const real = last.realBounds.y + last.realBounds.h
  const visual = last.visualBounds ? last.visualBounds.y + last.visualBounds.h : 0
  host.style.height = `${Math.ceil(Math.max(real, visual)) + 6}px`
  host.style.overflow = 'hidden'
}

export default function LessonScore({ tex, barsPerRow = 4, zoomable = true, shareKey, excerpt, onExcerpt, excerptContext = 'full' }: Props) {
  const ctxModeRef = useRef(excerptContext); ctxModeRef.current = excerptContext   // eslint-disable-line react-hooks/refs -- chỉ đọc trong callback khắc
  const share = useContext(ScoreShareSlot)
  const [tick, setTick] = useState(0)   // tăng sau MỖI lần alphaTab khắc xong → lớp khoanh tính lại vùng tô
  // Lớp khoanh cần api + khung qua STATE (không đọc ref lúc render)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shareApi, setShareApi] = useState<any>(null)
  const [shareHost, setShareHost] = useState<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null)
  const moRef = useRef<MutationObserver | null>(null)
  const bigRef = useRef(false)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [err, setErr] = useState('')
  const [focus, setFocus] = useState<BarRange | null>(null)   // trích đoạn: vùng khoanh đang vẽ (để tô)
  const focusRef = useRef<HTMLDivElement>(null)
  const [focusBoxes, setFocusBoxes] = useState<Array<{ left: number; top: number; width: number; height: number; key: string }>>([])

  // Cách khắc theo bề rộng KHUNG CHỨA (không phải cửa sổ): lúc xuất PDF khung được kéo về
  // khổ A4 nên bản nhạc phải khắc lại cho đủ ô mỗi dòng.
  // Đang chụp để lưu PDF: trang bị kéo về khổ giấy nên khung hẹp lại, nhưng ĐỪNG coi đó là
  // điện thoại — vẫn giữ đủ số ô nhịp mỗi dòng và cỡ 0.95. (Bản nhạc in ra to lên là nhờ ảnh
  // chụp hẹp được kéo cho vừa giấy, KHÔNG phải nhờ tăng display.scale: tăng scale làm bản
  // nhạc rộng quá khổ và bị cắt mất mép phải.)
  // Điện thoại: chọn theo ĐỘ ĐỌC được, không theo "càng nhiều ô càng tốt" — dọc 2 ô, ngang 3 ô,
  // cỡ nốt 1.1 (nhờ khung được lấy lại lề, cỡ lớn hơn mà vẫn không tràn).
  const PHONE_PAD = 8     // lề trái/phải trong SVG trên điện thoại (mặc định alphaTab 35)
const LYRIC_BAR = 395     // px/ô nhịp ở cỡ 1 cho ô 8 âm tiết — dưới mức này lời hát chồng nhau
  const printingNow = () => !!document.querySelector('.lsn-paper.is-printing')
  const layoutFor = (w: number) => {
    if (printingNow()) return { rows: barsPerRow, scale: 0.95 }
    // Chỉ ĐIỆN THOẠI (cạnh ngắn màn hình < 500px, dọc hoặc ngang). Máy tính bảng / desktop giữ cách cũ.
    const phone = Math.min(window.innerWidth, window.innerHeight) < 500
    if (!phone) return w < 620 ? { rows: Math.min(2, barsPerRow), scale: 1 } : { rows: barsPerRow, scale: 0.95 }
    // Bản có LỜI: lời hát cỡ 12×scale px mà alphaTab xếp khoảng cách theo nốt, không theo bề rộng chữ —
    // âm tiết dài ("Đường" ~40px) cạnh nhau bị chồng. Đo trên Buổi 04: cỡ 1.1 chồng 11/83 cặp (dọc);
    // cỡ 1.0 còn 1/83 (hở -0.6px). Nên bản có lời dùng cỡ 1.0: dọc 1 ô/dòng, ngang 3 ô/dòng.
    // (Không đổi effectFont: nó dùng chung cho hợp âm và ký hiệu khác.)
    // Máy hẹp (360px) thì co cỡ theo bề rộng: bề rộng/cỡ phải ≥ LYRIC_BAR (đo: 382/1.0 chồng 1 cặp, 402 thì hở)
    if (hasLyrics) return { rows: w < 560 ? 1 : Math.min(3, barsPerRow), scale: Math.min(1.05, Math.round((w + 54) / LYRIC_BAR * 100) / 100) }
    if (w < 560) return { rows: Math.min(2, barsPerRow), scale: 1.1 }
    return { rows: Math.min(3, barsPerRow), scale: 1.1 }
  }
  const hasLyrics = tex.includes('\\lyrics')
  // Trích đoạn: startBar/barCount (alphaTab 1.8.3, 1-based; số ô in ra và chỉ số boundsLookup giữ số gốc). Dải hỏng → false (không vẽ cả bản nhạc).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyExcerpt = (st: any, rows: number): boolean => {
    if (!excerpt) return true
    // ≤ 2 dòng khuông (EXCERPT_MAX_ROWS) ở mọi khổ: đo 04/11 — 3 dòng trên iPhone cao ~976px (> màn hình 844), 2 dòng ~480px
    const plan = ctxModeRef.current === 'focus' ? planExcerptFocus(excerpt, rows) : planExcerpt(excerpt, rows)
    if (!plan) return false
    st.display.startBar = plan.start; st.display.barCount = plan.count
    setFocus({ from: plan.focusFrom, to: plan.focusTo })
    onExcerpt?.(plan)
    return true
  }
  const hostWidth = () => hostRef.current?.clientWidth || window.innerWidth

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const at = await import('@coderline/alphatab')
        const { AlphaTabApi, Settings, LayoutMode, StaveProfile, LogLevel, NotationElement, ScrollMode } = at
        if (dead || !hostRef.current) return

        const s = new Settings()
        s.core.logLevel = LogLevel.None
        s.core.useWorkers = false
        // BẮT BUỘC: tắt lazy-render — nếu bật, alphaTab chỉ vẽ phần đang lọt màn hình
        // ⇒ bản in A4 và ảnh chụp ra khuông TRỐNG.
        s.core.enableLazyLoading = false
        s.core.fontDirectory = '/font/'
        // BẮT BUỘC: tắt tự cuộn của alphaTab (mặc định Continuous) — mỗi bản nhạc khắc xong tự kéo trang tới
        // ô nhịp đầu của nó ⇒ trang có nhiều bản nhạc bị trôi xuống bản cuối (lỗi "mở buổi bị đưa xuống đáy" 01/10).
        // Giáo án không dùng player/cursor; người học tự cuộn.
        if (ScrollMode) s.player.scrollMode = ScrollMode.Off
        s.display.layoutMode = LayoutMode.Page        // tự xuống dòng → không tràn ngang
        // Bản nhạc tự khai \staff {score} (chỉ khuông, không TAB — vd bài để học viên TỰ
        // chọn vị trí) thì tôn trọng nó; còn lại mặc định khuông + TAB.
        s.display.staveProfile = tex.includes('\\staff') ? StaveProfile.Default : StaveProfile.ScoreTab
        const first = layoutFor(hostWidth())
        s.display.scale = first.scale
        s.display.barsPerRow = first.rows
        if (!applyExcerpt(s, first.rows)) { setState('error'); setErr('Đoạn nhạc không hợp lệ'); return }
        // alphaTab chừa mặc định 35px mỗi bên TRONG SVG ⇒ khuông hẹp hơn khung 70px. Điện thoại: lề trái/phải nhỏ lại
        // (khóa Sol/số nhịp vẫn có chỗ riêng bên trong khuông). Bản in/PDF và máy tính giữ nguyên.
        if (!printingNow() && Math.min(window.innerWidth, window.innerHeight) < 500) s.display.padding = [PHONE_PAD, 35]
        // alphaTab tô bè phụ (bè Bass) bằng màu xám mờ — in ra giấy gần như không
        // thấy. Kéo về đúng màu đen của bè chính.
        s.display.resources.secondaryGlyphColor = s.display.resources.mainGlyphColor
        // Ẩn chữ thừa — tiêu đề/nhịp độ do tài liệu tự trình bày
        const hide = [
          NotationElement.ScoreTitle, NotationElement.ScoreSubTitle, NotationElement.ScoreArtist,
          NotationElement.ScoreAlbum, NotationElement.ScoreWords, NotationElement.ScoreMusic,
          NotationElement.ScoreWordsAndMusic, NotationElement.ScoreCopyright,
          NotationElement.GuitarTuning, NotationElement.TrackNames, NotationElement.EffectDynamics,
        ]
        for (const el of hide) if (el !== undefined) s.notation.elements.set(el, false)

        const api = new AlphaTabApi(hostRef.current, s)
        apiRef.current = api
        setShareApi(api)

        const hideAttribution = () => {
          hostRef.current?.querySelectorAll<SVGTextElement>('text').forEach(t => {
            if (t.textContent && t.textContent.includes('alphaTab')) t.style.display = 'none'
          })
        }
        const mo = new MutationObserver(hideAttribution)
        mo.observe(hostRef.current, { childList: true, subtree: true })
        moRef.current = mo

        api.postRenderFinished.on(() => {
          if (dead) return
          hideAttribution()
          // Trích đoạn nằm ngoài bản nhạc hiện tại → không có ô nào: báo lỗi nhẹ thay vì khung trống
          if (excerpt && !(api.renderer?.boundsLookup?.staffSystems?.length)) { setState('error'); setErr('Không có đoạn nhạc này'); return }
          if (excerpt) trimExcerptBottom(api, hostRef.current)
          setState('ready'); setTick(t => t + 1)
        })
        api.error.on((e: unknown) => { if (!dead) { setState('error'); setErr((e as Error)?.message ?? String(e)) } })
        api.tex(tex)
      } catch (e) {
        if (!dead) { setState('error'); setErr((e as Error).message ?? String(e)) }
      }
    })()
    return () => { dead = true; moRef.current?.disconnect(); try { apiRef.current?.destroy() } catch { /* */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đổi chế độ ngữ cảnh ("Xem đầy đủ" ↔ "Thu gọn"): khắc lại bằng CHÍNH api đang có (không dựng renderer mới); lần đầu do effect khởi tạo lo
  const lastCtx = useRef(excerptContext)
  useEffect(() => {
    if (lastCtx.current === excerptContext) return
    lastCtx.current = excerptContext
    const api = apiRef.current, host = hostRef.current
    if (!api || !excerpt || !host) return
    try {
      const { rows } = layoutFor(host.clientWidth || window.innerWidth)
      applyExcerpt(api.settings, rows)
      api.updateSettings(); api.render()
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excerptContext])

  useEffect(() => { if (apiRef.current) { try { apiRef.current.tex(tex) } catch { /* */ } } }, [tex])

  // Trích đoạn: tô riêng vùng khoanh (ô ngữ cảnh để nguyên). Toạ độ boundsLookup gốc = góc trên-trái .at-surface (SVG có thể bị CSS co → hệ số k).
  useEffect(() => {
    const ov = focusRef.current, host = hostRef.current, api = apiRef.current
    const surface = host?.querySelector('.at-surface') as HTMLElement | null
    if (!excerpt || !focus || !ov || !surface || !api) { setFocusBoxes([]); return }
    const sr = surface.getBoundingClientRect(), or = ov.getBoundingClientRect()
    const svg = surface.querySelector('svg'), w = svg ? parseFloat(svg.getAttribute('width') || '') : NaN
    const k = svg && w > 0 ? svg.getBoundingClientRect().width / w : 1
    const kk = Number.isFinite(k) && k > 0 ? k : 1
    const rects = rectsForBars((api.renderer?.boundsLookup ?? null) as BoundsLike | null, focus.from - 1, focus.to - 1)
    setFocusBoxes(rects.map(r => ({ left: sr.left - or.left + r.x * kk, top: sr.top - or.top + r.y * kk, width: r.w * kk, height: r.h * kk, key: `${r.first}-${r.last}` })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, focus?.from, focus?.to, excerpt])

  // Khung đổi bề rộng (xoay máy, hoặc lúc tạo PDF) → khắc lại với số ô nhịp phù hợp
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    // Khắc lại khi BỀ RỘNG KHUNG đổi, kể cả khi số ô nhịp không đổi: alphaTab dàn nốt
    // theo bề ngang lúc khắc, giữ nguyên bản khắc cũ trong khung hẹp hơn là bản nhạc
    // thò ra ngoài mép phải và lúc chụp PDF sẽ bị cắt cụt.
    let applied = `${host.clientWidth}/${layoutFor(host.clientWidth || window.innerWidth).rows}/${layoutFor(host.clientWidth || window.innerWidth).scale}`
    const ro = new ResizeObserver(() => {
      if (bigRef.current) return                    // đang xem toàn màn hình: giữ nguyên cách khắc
      const w = host.clientWidth
      const { rows: want, scale: wantScale } = layoutFor(w || window.innerWidth)
      const api = apiRef.current
      if (!api || `${w}/${want}/${wantScale}` === applied) return
      applied = `${w}/${want}/${wantScale}`
      try {
        api.settings.display.barsPerRow = want
        api.settings.display.scale = wantScale
        applyExcerpt(api.settings, want)
        api.updateSettings()
        api.render()
      } catch { /* */ }
    })
    ro.observe(host)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barsPerRow])

  // Xem toàn màn hình: KHẮC LẠI bản nhạc theo hệ số phóng, số ô nhịp mỗi dòng tính
  // theo bề ngang thật của khung — máy tính vẫn 3–4 ô/dòng, điện thoại còn 1 ô.
  // (Đừng phóng bằng CSS: alphaTab đo bề ngang khung để dàn nốt, phóng xong nốt dồn cục.)
  const onZoom = (big: boolean, factor: number) => {
    bigRef.current = big
    const api = apiRef.current
    const host = hostRef.current
    if (!api || !host) return
    const w = host.clientWidth || window.innerWidth
    try {
      if (big) {
        // Bản có LỜI: mỗi ô nhịp cần ~370 đơn vị bề ngang cho 8 âm tiết (đo ở Buổi 04). Phóng to thì bề rộng
        // khuông = factor × 370px — rộng hơn màn hình thì để vùng Xem lớn cuộn ngang, KHÔNG ép khuông vào
        // viewport (ép là lời chồng nhau). Cỡ nốt giữ đúng bằng factor.
        if (hasLyrics) {
          const vw = (host.parentElement?.parentElement?.clientWidth || window.innerWidth) - 20
          const wide = Math.max(vw, Math.ceil(factor * LYRIC_BAR))
          host.style.width = factor > 1 ? `${wide}px` : ''
          if (factor <= 1) { api.settings.display.scale = layoutFor(vw).scale; api.settings.display.barsPerRow = layoutFor(vw).rows; api.updateSettings(); api.render(); return }
          api.settings.display.barsPerRow = Math.max(1, Math.min(barsPerRow, Math.floor(wide / (factor * LYRIC_BAR))))
        } else {
          // ~150px/ô ở cỡ 1: số ngón tay không dính đầu nốt; dọc 140% đọc từng ô một
          api.settings.display.barsPerRow = Math.max(1, Math.min(barsPerRow, Math.floor(w / (factor * 150))))
        }
        api.settings.display.scale = factor
      } else {
        host.style.width = ''
        const l = layoutFor(host.clientWidth || window.innerWidth)
        api.settings.display.scale = l.scale
        api.settings.display.barsPerRow = l.rows
      }
      api.updateSettings()
      api.render()
    } catch { /* */ }
  }

  // Định danh ổn định để nhớ vị trí đọc: đường dẫn bài + dấu vân tay nội dung bản nhạc (sửa nhạc thì vị trí cũ tự bỏ)
  const memoryKey = `${location.pathname}#${tex.split('').reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261).toString(36)}`

  const hostCallback = useCallback((el: HTMLDivElement | null) => { hostRef.current = el; setShareHost(el) }, [])
  return (
    <ZoomFrame onZoom={onZoom} enabled={zoomable} memoryKey={memoryKey}
               hint={zoomable ? 'Bản nhạc dài — bấm “Xem lớn” để đọc toàn màn hình.' : undefined}>
      <div className="lsn-score">
        {state === 'loading' && <div className="lsn-score-msg">Đang dựng bản nhạc…</div>}
        {state === 'error' && <div className="lsn-score-msg err">Chưa hiển thị được bản nhạc ({err})</div>}
        {share && shareKey
          ? <ScoreShareLayer api={shareApi} host={shareHost} tick={tick} tex={tex} shareKey={shareKey}><div ref={hostCallback} className="lsn-score-host" /></ScoreShareLayer>
          : <div ref={hostRef} className="lsn-score-host" />}
        {excerpt && <div ref={focusRef} className="lsn-excerpt-focus" aria-hidden="true">
          {focusBoxes.map(b => <div key={b.key} className="lsn-excerpt-hl" style={{ left: b.left, top: b.top, width: b.width, height: b.height }} />)}
        </div>}
      </div>
    </ZoomFrame>
  )
}
