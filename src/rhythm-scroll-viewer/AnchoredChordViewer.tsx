import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { anchorTextIssues, createAnchoredScroll } from './anchored.ts'
import type { MeasureAnchor, RhythmScrollAnchoredData } from './anchored.ts'
import { BALL_LANE, BALL_RADIUS, assignReadingRows, ballBetweenAnchors } from './ballPath.ts'
import type { PathPoint, ReadingRow } from './ballPath.ts'
import { parseChordLines } from './chordLines.ts'
import type { ChordLine } from './chordLines.ts'
import { LOOKAHEAD_ANCHOR, rowPlayhead } from './scrollModel.ts'

interface Geometry {
  rows: ReadingRow[]
  /** "dòng:chữ" → điểm neo trên đường đọc (mép trái của chữ; "hết dòng" = mép phải chữ cuối). */
  points: Map<string, PathPoint>
  viewportHeight: number
}

const keyOf = (anchor: MeasureAnchor) => `${anchor.line}:${anchor.token}`

/**
 * VIEWER thử nghiệm chạy bằng NEO VẠCH NHỊP THẬT. Bị điều khiển hoàn toàn bởi `measurePosition`.
 * Ball đi từ chữ neo của ô hiện tại tới chữ neo của ô kế theo đường đọc và nảy đúng MỘT lần mỗi ô.
 * Không karaoke, không phách 1/2/3/4. Các dòng vẽ theo thứ tự văn bản (prototype: bài chạy thẳng một lượt).
 */
export default function AnchoredChordViewer({ text, lines: givenLines, data, measurePosition, labels, reducedMotion = false, showAnchors = false, activeChord = null }: {
  text: string
  /** Dòng đã dựng sẵn (production: từ tokenizer của Hợp âm chuẩn hóa, nhãn "1."/"ĐK:" đã tách khỏi chữ). Vắng → tách `text`. */
  lines?: ChordLine[]
  data: RhythmScrollAnchoredData
  measurePosition: number
  /** Nhãn đoạn theo dòng (chỉ trình bày). */
  labels?: Record<number, string>
  reducedMotion?: boolean
  /** Soi: hiện vạch "|" nhỏ tại mỗi chữ neo. */
  showAnchors?: boolean
  /** Hợp âm đang vang trên timeline (dòng + chữ mang hợp âm đó) — chỉ để sáng lên, không ảnh hưởng ball. */
  activeChord?: { line: number; token: number } | null
}) {
  const scroll = useMemo(() => createAnchoredScroll(data), [data])
  const lines = useMemo(() => givenLines ?? parseChordLines(text), [givenLines, text])
  const issues = useMemo(() => anchorTextIssues(data, lines.map(line => line.words.length)), [data, lines])
  const anchorKeys = useMemo(() => new Set((data.pickup ? [data.pickup] : []).concat(data.measures).map(keyOf)), [data])
  const position = scroll.locate(measurePosition)

  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<Geometry>({ rows: [], points: new Map(), viewportHeight: 0 })

  // Đo hộp của TỪNG CHỮ → các hàng nhìn thấy + điểm neo. Đo lại khi đổi kích thước hoặc font tải xong.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const measure = () => {
      const origin = content.getBoundingClientRect()
      const words = Array.from(content.querySelectorAll<HTMLElement>('[data-word]'))
      const boxes = words.map(word => {
        const box = word.getBoundingClientRect()
        return { left: box.left - origin.left, right: box.right - origin.left, top: box.top - origin.top }
      })
      const { rows, rowOf } = assignReadingRows(boxes)
      const points = new Map<string, PathPoint>()
      words.forEach((word, index) => {
        const [line, token] = (word.dataset.word ?? '').split(':').map(Number)
        points.set(`${line}:${token}`, { row: rowOf[index], x: boxes[index].left })
        // "Hết dòng" (token = số chữ của dòng) = mép phải chữ cuối. Chữ kế tiếp trong cùng dòng, nếu có,
        // sẽ ghi đè khoá này bằng mép trái của chính nó ở vòng lặp sau.
        points.set(`${line}:${token + 1}`, { row: rowOf[index], x: boxes[index].right })
      })
      setGeometry({ rows, points, viewportHeight: viewport.clientHeight })
    }
    measure()
    document.fonts?.ready.then(measure).catch(() => {})
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(content)
    return () => observer.disconnect()
  }, [lines, data])

  const from = position.current.line === null ? undefined : geometry.points.get(keyOf(position.current))
  const to = position.next.line === null ? from : geometry.points.get(keyOf(position.next))
  const ball = position.state === 'active' && from && to
    ? ballBetweenAnchors(geometry.rows, from, to, position.measureProgress, !reducedMotion)
    : null

  // Cuộn bám theo BALL (tức theo neo thật): ball đi hết một hàng thì nội dung trôi vừa tới hàng kế, nên hàng
  // đang đọc luôn ở quanh điểm neo 38% của khung và phía dưới là lời sắp tới. Chưa có ball (trước bài, hết bài,
  // ô không lời) thì đứng ở neo hiện tại.
  const playhead = rowPlayhead(geometry.rows, ball ? { row: ball.row, x: ball.x } : from ?? null, reducedMotion)
  const shift = playhead - geometry.viewportHeight * LOOKAHEAD_ANCHOR

  return (
    <div style={S.root} data-state={position.state} data-measure={position.measureIndex}>
      {issues.length > 0 && <div role="alert" style={S.issue}>Neo không khớp lời: {issues[0]}</div>}
      <div ref={viewportRef} style={S.viewport}>
        <div style={S.anchorMark} aria-hidden="true" />
        <div ref={contentRef} data-testid="scroll-content"
          style={{ ...S.content, transform: `translate3d(0, ${(-shift).toFixed(2)}px, 0)` }}>
          <Lines lines={lines} labels={labels} anchorKeys={showAnchors ? anchorKeys : null}
            activeChord={activeChord ? `${activeChord.line}:${activeChord.token}` : null}
            activeFrom={position.state === 'ended' ? -1 : position.current.line ?? -1}
            activeTo={position.state === 'ended' ? -1 : position.next.line ?? position.current.line ?? -1} />
          {ball && (
            <div data-testid="bounce-ball" data-row={ball.row} aria-hidden="true"
              style={{ ...S.ball, transform: `translate3d(${(ball.x - BALL_RADIUS).toFixed(2)}px, ${(ball.y - BALL_RADIUS).toFixed(2)}px, 0)` }} />
          )}
        </div>
      </div>
    </div>
  )
}

/** Memo: mỗi khung hình chỉ đổi transform và vị trí ball; cây lời chỉ vẽ lại khi đổi dòng đang hát. */
const Lines = memo(function Lines({ lines, labels, anchorKeys, activeFrom, activeTo, activeChord }: {
  lines: readonly ChordLine[]
  labels?: Record<number, string>
  anchorKeys: Set<string> | null
  activeFrom: number
  activeTo: number
  activeChord: string | null
}) {
  return <>
    {lines.filter(line => line.words.length).map(line => {
      const state = line.index >= activeFrom && line.index <= activeTo ? 'active' : activeFrom >= 0 && line.index < activeFrom ? 'past' : 'ahead'
      return (
        <div key={line.index} data-line={line.index} data-state={state}
          style={{ ...S.lineBlock, opacity: state === 'active' ? 1 : state === 'past' ? 0.35 : 0.72 }}>
          {labels?.[line.index] && <div style={S.label}>{labels[line.index]}</div>}
          <div style={S.line}>
            {line.words.map((word, token) => (
              <span key={token} data-word={`${line.index}:${token}`} style={S.word}>
                {anchorKeys?.has(`${line.index}:${token}`) && <span data-anchor-mark="" aria-hidden="true" style={S.barMark} />}
                <span data-chord={word.chord ?? undefined} data-active-chord={activeChord === `${line.index}:${token}` ? '' : undefined}
                  style={activeChord === `${line.index}:${token}` ? S.chordActive : S.chord}>{word.chord ?? ' '}</span>
                <span style={S.lyric}>{word.text}</span>
              </span>
            ))}
          </div>
        </div>
      )
    })}
  </>
})

const ACCENT = '#EA580C'
/** Bề ngang tối đa của cột đọc (px) — giá trị thử đầu tiên; hẹp để mắt không phải quay xa khi sang dòng. */
export const READING_COLUMN_MAX = 640
const S: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#0F1117', color: '#F1F5F9' },
  issue: { padding: '6px 16px', background: '#7F1D1D', color: '#FECACA', fontSize: 12 },
  viewport: { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' },
  anchorMark: { position: 'absolute', left: 0, top: '38%', width: 4, height: 28, marginTop: -2, borderRadius: 2, background: ACCENT, opacity: 0.55, zIndex: 1 },
  // CỘT ĐỌC gọn, nằm giữa khung: cả cột được canh giữa (left/right 0 + margin auto), chữ bên trong vẫn căn trái.
  // Màn hẹp hơn READING_COLUMN_MAX thì cột chiếm hết bề ngang, chỉ còn lề 20/16px.
  content: { position: 'absolute', left: 0, right: 0, top: 0, width: '100%', maxWidth: READING_COLUMN_MAX, marginInline: 'auto', boxSizing: 'border-box', padding: '0 16px 0 20px', textAlign: 'left', willChange: 'transform' },
  // Không transition vị trí: mỗi khung hình đặt thẳng toạ độ, nên xuống hàng/sang dòng không có cú bay chéo.
  ball: { position: 'absolute', left: 0, top: 0, width: BALL_RADIUS * 2, height: BALL_RADIUS * 2, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 10px rgba(234,88,12,.75)', pointerEvents: 'none', willChange: 'transform' },
  lineBlock: { paddingBottom: 10, transition: 'opacity .25s' },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#60A5FA', textTransform: 'uppercase', marginTop: 6 },
  line: { display: 'flex', flexWrap: 'wrap', columnGap: '0.32em' },
  word: { position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', paddingTop: BALL_LANE },
  barMark: { position: 'absolute', left: -4, top: BALL_LANE - 2, bottom: 2, width: 1, background: '#38BDF8', opacity: 0.7 },
  chord: { fontSize: 'clamp(14px, 3.6vw, 18px)', fontWeight: 700, color: '#FBBF24', lineHeight: 1.25, minHeight: '1.25em', whiteSpace: 'pre' },
  chordActive: { fontSize: 'clamp(14px, 3.6vw, 18px)', fontWeight: 800, color: '#0F1117', background: '#FBBF24', borderRadius: 4, padding: '0 5px', marginLeft: -5, lineHeight: 1.25, minHeight: '1.25em', whiteSpace: 'pre' },
  lyric: { fontSize: 'clamp(19px, 5vw, 26px)', lineHeight: 1.3 },
}
