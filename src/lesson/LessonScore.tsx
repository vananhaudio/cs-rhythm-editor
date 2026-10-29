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

  // Cách khắc theo bề rộng KHUNG CHỨA (không phải cửa sổ): lúc xuất PDF khung được kéo về
  // khổ A4 nên bản nhạc phải khắc lại cho đủ ô mỗi dòng.
  // Đang chụp để lưu PDF: trang bị kéo về khổ giấy nên khung hẹp lại, nhưng ĐỪNG coi đó là
  // điện thoại — vẫn giữ đủ số ô nhịp mỗi dòng và cỡ 0.95. (Bản nhạc in ra to lên là nhờ ảnh
  // chụp hẹp được kéo cho vừa giấy, KHÔNG phải nhờ tăng display.scale: tăng scale làm bản
  // nhạc rộng quá khổ và bị cắt mất mép phải.)
  // Điện thoại: chọn theo ĐỘ ĐỌC được, không theo "càng nhiều ô càng tốt" — dọc 2 ô, ngang 3 ô,
  // cỡ nốt 1.1 (nhờ khung được lấy lại lề, cỡ lớn hơn mà vẫn không tràn).
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
    if (hasLyrics) return { rows: w < 560 ? 1 : Math.min(3, barsPerRow), scale: 1 }
    if (w < 560) return { rows: Math.min(2, barsPerRow), scale: 1.1 }
    return { rows: Math.min(3, barsPerRow), scale: 1.1 }
  }
  const hasLyrics = tex.includes('\\lyrics')
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
        // ~150px/ô ở cỡ 1: số ngón tay không dính đầu nốt; dọc 140% đọc từng ô một
        api.settings.display.barsPerRow = Math.max(1, Math.min(barsPerRow, Math.floor(w / (factor * (hasLyrics ? 392 : 150)))))   // bản có lời: ~392px/ô cho 8 âm tiết
      } else {
        const l = layoutFor(w)
        api.settings.display.scale = l.scale
        api.settings.display.barsPerRow = l.rows
      }
      api.updateSettings()
      api.render()
    } catch { /* */ }
  }

  // Định danh ổn định để nhớ vị trí đọc: đường dẫn bài + dấu vân tay nội dung bản nhạc (sửa nhạc thì vị trí cũ tự bỏ)
  const memoryKey = `${location.pathname}#${tex.split('').reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261).toString(36)}`

  return (
    <ZoomFrame onZoom={onZoom} enabled={zoomable} memoryKey={memoryKey}
               limitFactor={hasLyrics ? () => Math.max(1, (window.innerWidth - 20) / 392) : undefined}
               hint={zoomable ? 'Bản nhạc dài — bấm “Xem lớn” để đọc toàn màn hình.' : undefined}>
      <div className="lsn-score">
        {state === 'loading' && <div className="lsn-score-msg">Đang dựng bản nhạc…</div>}
        {state === 'error' && <div className="lsn-score-msg err">Chưa hiển thị được bản nhạc ({err})</div>}
        <div ref={hostRef} className="lsn-score-host" />
      </div>
    </ZoomFrame>
  )
}
