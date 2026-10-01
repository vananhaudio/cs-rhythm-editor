// ── LessonScore — khuông nhạc + TAB cho tài liệu học ──
// Dùng lại hạ tầng notation sẵn có của dự án: alphaTab (@coderline/alphatab) + font Bravura
// ở public/font/, nạp nội dung bằng alphaTex (giống src/components/ScoreTabViewerAlpha.tsx).
// KHÔNG thêm thư viện notation mới. Nội dung nhạc đi vào từ props dưới dạng chuỗi alphaTex.
import { useEffect, useRef, useState } from 'react'
import ZoomFrame from './ZoomFrame'

interface Props {
  tex: string
  /** số ô nhịp mỗi dòng khi in / desktop */
  barsPerRow?: number
  /** cho phép mở chế độ xem lớn (mobile) */
  zoomable?: boolean
}

export default function LessonScore({ tex, barsPerRow = 4, zoomable = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null)
  const moRef = useRef<MutationObserver | null>(null)
  const bigRef = useRef(false)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [err, setErr] = useState('')

  // Số ô nhịp mỗi dòng theo bề rộng KHUNG CHỨA (không phải cửa sổ): lúc xuất PDF
  // khung được kéo về khổ A4 nên bản nhạc phải khắc lại cho đủ ô mỗi dòng.
  const narrowNow = () => (hostRef.current?.clientWidth ?? window.innerWidth) < 620
  // Đang chụp để lưu PDF: trang bị kéo về khổ giấy nên khung hẹp lại, nhưng ĐỪNG
  // coi đó là điện thoại — vẫn giữ đủ số ô nhịp mỗi dòng. (Bản nhạc in ra to lên là
  // nhờ ảnh chụp hẹp được kéo cho vừa giấy, KHÔNG phải nhờ tăng display.scale: tăng
  // scale làm bản nhạc rộng quá khổ và bị cắt mất mép phải.)
  const printingNow = () => !!document.querySelector('.lsn-paper.is-printing')
  const restScale = () => (!printingNow() && narrowNow() ? 1 : 0.95)
  const restRows = () => (printingNow() ? barsPerRow : narrowNow() ? Math.min(2, barsPerRow) : barsPerRow)
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640
  const rows = narrow ? Math.min(2, barsPerRow) : barsPerRow

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
        s.display.scale = narrow ? 1 : 0.95
        s.display.barsPerRow = rows
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

        const hideAttribution = () => {
          hostRef.current?.querySelectorAll<SVGTextElement>('text').forEach(t => {
            if (t.textContent && t.textContent.includes('alphaTab')) t.style.display = 'none'
          })
        }
        const mo = new MutationObserver(hideAttribution)
        mo.observe(hostRef.current, { childList: true, subtree: true })
        moRef.current = mo

        api.postRenderFinished.on(() => { if (!dead) { hideAttribution(); setState('ready') } })
        api.error.on((e: unknown) => { if (!dead) { setState('error'); setErr((e as Error)?.message ?? String(e)) } })
        api.tex(tex)
      } catch (e) {
        if (!dead) { setState('error'); setErr((e as Error).message ?? String(e)) }
      }
    })()
    return () => { dead = true; moRef.current?.disconnect(); try { apiRef.current?.destroy() } catch { /* */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (apiRef.current) { try { apiRef.current.tex(tex) } catch { /* */ } } }, [tex])

  // Khung đổi bề rộng (xoay máy, hoặc lúc tạo PDF) → khắc lại với số ô nhịp phù hợp
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    // Khắc lại khi BỀ RỘNG KHUNG đổi, kể cả khi số ô nhịp không đổi: alphaTab dàn nốt
    // theo bề ngang lúc khắc, giữ nguyên bản khắc cũ trong khung hẹp hơn là bản nhạc
    // thò ra ngoài mép phải và lúc chụp PDF sẽ bị cắt cụt.
    let applied = `${host.clientWidth}/${rows}/${0.95}`
    const ro = new ResizeObserver(() => {
      if (bigRef.current) return                    // đang xem toàn màn hình: giữ nguyên cách khắc
      const want = restRows(), wantScale = restScale(), w = host.clientWidth
      const api = apiRef.current
      if (!api || `${w}/${want}/${wantScale}` === applied) return
      applied = `${w}/${want}/${wantScale}`
      try {
        api.settings.display.barsPerRow = want
        api.settings.display.scale = wantScale
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
    if (!api) return
    const w = hostRef.current?.clientWidth || window.innerWidth
    try {
      if (big) {
        api.settings.display.scale = factor
        api.settings.display.barsPerRow = Math.max(1, Math.floor(w / (factor * 250)))
      } else {
        api.settings.display.scale = restScale()
        api.settings.display.barsPerRow = restRows()
      }
      api.updateSettings()
      api.render()
    } catch { /* */ }
  }

  return (
    <ZoomFrame onZoom={onZoom} enabled={zoomable}
               hint={zoomable ? 'Bản nhạc dài — bấm “Xem lớn” để đọc toàn màn hình.' : undefined}>
      <div className="lsn-score">
        {state === 'loading' && <div className="lsn-score-msg">Đang dựng bản nhạc…</div>}
        {state === 'error' && <div className="lsn-score-msg err">Chưa hiển thị được bản nhạc ({err})</div>}
        <div ref={hostRef} className="lsn-score-host" />
      </div>
    </ZoomFrame>
  )
}
