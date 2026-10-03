import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createRhythmScroll } from '../rhythm-scroll/index.ts'
import type { RhythmScrollData, RhythmScrollSegment } from '../rhythm-scroll/index.ts'
import { parseChordLines } from './chordLines.ts'
import type { ChordLine } from './chordLines.ts'
import { BALL_LANE, BALL_RADIUS, ballPoint, buildReadingRows } from './ballPath.ts'
import type { ReadingRow } from './ballPath.ts'
import { contentShift } from './scrollModel.ts'
import type { ScrollLayout } from './scrollModel.ts'

/**
 * VIEWER lời + hợp âm cho người ĐỆM HÁT. Hoàn toàn bị điều khiển: không đồng hồ, không timer —
 * consumer đưa `measurePosition` vào, mọi trạng thái (ball, cuộn) đi ra từ `locate()` của lõi.
 *
 * Người chơi chỉ nhìn MỘT vùng: lời + hợp âm + bouncing ball nảy ngay trên dòng đang đọc.
 * Ball là chỉ dẫn đọc (segmentProgress → đi ngang, measureProgress → một cú nảy mỗi ô), KHÔNG phải karaoke:
 * không tô từng chữ, không chỉ phách 1/2/3/4, không khuông nhạc.
 */
export default function RhythmChordViewer({ text, data, measurePosition, reducedMotion = false }: {
  /** Văn bản lời + hợp âm chuẩn ([Am] chen trong lời). */
  text: string
  data: RhythmScrollData
  /** Vị trí liên tục theo ô nhịp; < 0 = chưa vào bài. */
  measurePosition: number
  reducedMotion?: boolean
}) {
  const scroll = useMemo(() => createRhythmScroll(data), [data])
  const lines = useMemo(() => parseChordLines(text), [text])
  const position = scroll.locate(measurePosition)

  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ScrollLayout & { viewportHeight: number; segmentRows: ReadingRow[][] }>({ segmentTops: [], contentHeight: 0, viewportHeight: 0, segmentRows: [] })

  // Đo vị trí THẬT của từng khối segment và từng chữ; đo lại khi khung hoặc nội dung đổi kích thước
  // (xoay máy, đổi cỡ chữ, font tải xong). Hình học chữ → đường đọc của ball, kể cả khi câu bị xuống hàng.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const measure = () => {
      const blocks = Array.from(content.querySelectorAll<HTMLElement>('[data-segment]'))
      // Nội dung đang bị dịch bằng transform; trừ đi gốc của chính nó để có toạ độ trong hệ nội dung.
      const origin = content.getBoundingClientRect()
      setLayout({
        segmentTops: blocks.map(block => block.offsetTop),
        contentHeight: content.offsetHeight,
        viewportHeight: viewport.clientHeight,
        segmentRows: blocks.map(block => buildReadingRows(
          Array.from(block.querySelectorAll<HTMLElement>('[data-word]')).map(word => {
            const box = word.getBoundingClientRect()
            return { left: box.left - origin.left, right: box.right - origin.left, top: box.top - origin.top }
          }),
        )),
      })
    }
    measure()
    document.fonts?.ready.then(measure).catch(() => {})
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(content)
    return () => observer.disconnect()
  }, [lines, data])

  const shift = contentShift(layout, position, layout.viewportHeight, reducedMotion)
  // Ball chỉ có khi đang ở segment CÓ LỜI; đoạn dạo/gian tấu, trước bài và hết bài thì ẩn.
  const ball = position.state === 'active' && data.segments[position.segmentIndex].line !== null
    ? ballPoint(layout.segmentRows[position.segmentIndex] ?? [], position.segmentProgress, position.measureProgress, !reducedMotion)
    : null

  return (
    <div style={S.root} data-state={position.state}>
      <div ref={viewportRef} style={S.viewport}>
        <div style={S.anchorMark} aria-hidden="true" />
        <div ref={contentRef} data-testid="scroll-content"
          style={{ ...S.content, transform: `translate3d(0, ${(-shift).toFixed(2)}px, 0)` }}>
          <SegmentBlocks segments={data.segments} lines={lines}
            active={position.state === 'ended' ? -1 : position.segmentIndex} />
          {ball && (
            <div data-testid="bounce-ball" data-row={ball.row} aria-hidden="true"
              style={{ ...S.ball, transform: `translate3d(${(ball.x - BALL_RADIUS).toFixed(2)}px, ${(ball.y - BALL_RADIUS).toFixed(2)}px, 0)` }} />
          )}
        </div>
      </div>
    </div>
  )
}

/** Tách riêng + memo: mỗi khung hình chỉ đổi transform và vị trí ball, cây lời không vẽ lại. */
const SegmentBlocks = memo(function SegmentBlocks({ segments, lines, active }: {
  segments: readonly RhythmScrollSegment[]
  lines: readonly ChordLine[]
  active: number
}) {
  return <>
    {segments.map((segment, index) => {
      const state = index === active ? 'active' : active >= 0 && index < active ? 'past' : 'ahead'
      const tone = state === 'active' ? 1 : state === 'past' ? 0.35 : 0.72
      if (segment.line === null) {
        // Đoạn không lời: chỉ một nhãn mảnh, KHÔNG dựng dòng lời giả.
        return (
          <div key={index} data-segment={index} data-kind="instrumental" data-state={state} style={{ ...S.instrumental, opacity: tone }}>
            ♪ {segment.label ?? 'Nhạc'} · {segment.measureCount} ô
          </div>
        )
      }
      const own = lines.slice(segment.line, segment.line + (segment.lineCount ?? 1)).filter(line => line.words.length)
      return (
        <div key={index} data-segment={index} data-kind="lyric" data-state={state} style={{ ...S.segment, opacity: tone }}>
          {segment.label && <div style={S.label}>{segment.label}</div>}
          {own.map(line => (
            <div key={line.index} data-line={line.index} style={S.line}>
              {line.words.map((word, at) => (
                <span key={at} data-word="" style={S.word}>
                  <span data-chord={word.chord ?? undefined} style={S.chord}>{word.chord ?? ' '}</span>
                  <span style={S.lyric}>{word.text}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )
    })}
  </>
})

/** prefers-reduced-motion của hệ điều hành; false khi môi trường không có matchMedia. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

const ACCENT = '#EA580C'
const S: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#0F1117', color: '#F1F5F9' },
  // Không transition vị trí: mỗi khung hình đặt thẳng toạ độ, nên xuống hàng/đổi segment không có cú bay chéo.
  ball: { position: 'absolute', left: 0, top: 0, width: BALL_RADIUS * 2, height: BALL_RADIUS * 2, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 10px rgba(234,88,12,.75)', pointerEvents: 'none', willChange: 'transform' },
  viewport: { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' },
  anchorMark: { position: 'absolute', left: 0, top: '38%', width: 4, height: 28, marginTop: -2, borderRadius: 2, background: ACCENT, opacity: 0.55, zIndex: 1 },
  content: { position: 'absolute', left: 0, right: 0, top: 0, padding: '0 16px 0 20px', textAlign: 'left', willChange: 'transform' },
  segment: { paddingBottom: 10, transition: 'opacity .25s' },
  instrumental: { paddingBottom: 18, fontSize: 14, color: '#94A3B8', fontStyle: 'italic', transition: 'opacity .25s' },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#60A5FA', textTransform: 'uppercase', marginBottom: 2 },
  line: { display: 'flex', flexWrap: 'wrap', columnGap: '0.32em' },
  word: { display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', paddingTop: BALL_LANE },
  chord: { fontSize: 'clamp(14px, 3.6vw, 18px)', fontWeight: 700, color: '#FBBF24', lineHeight: 1.25, minHeight: '1.25em', whiteSpace: 'pre' },
  lyric: { fontSize: 'clamp(19px, 5vw, 26px)', lineHeight: 1.3 },
}
