// Bộ vẽ khung video 9:16 của Play Scroll (chuyển từ spike đã được Owner nghiệm thu; KHÔNG thiết kế lại).
// Dùng NGUYÊN timeline / script / engine neo / đường bóng của Play Scroll: không có beat engine thứ hai.
// Tất cả thông tin bài (tên, tác giả, Band, người biên tập) do người gọi truyền vào từ dữ liệu thật; ở đây không có chuỗi mẫu.
import { buildChordTimeline, locateBeat } from '../chordTimeline.ts'
import type { ChordTimeline, TimelineMeter } from '../chordTimeline.ts'
import { buildPerformanceScript } from '../performanceScript.ts'
import type { ChordAnchors } from '../chordAnchors.ts'
import { BALL_LANE, BALL_RADIUS, assignReadingRows, ballBetweenAnchors } from '../../rhythm-scroll-viewer/ballPath.ts'
import type { PathPoint } from '../../rhythm-scroll-viewer/ballPath.ts'
import { createAnchoredScroll } from '../../rhythm-scroll-viewer/anchored.ts'
import type { RhythmScrollAnchoredData } from '../../rhythm-scroll-viewer/anchored.ts'

export const VIDEO_W = 1080
export const VIDEO_H = 1920
/**
 * Vùng an toàn cho giao diện TikTok — MỘT chỗ chỉnh tập trung (px của khung 1080×1920).
 * Đây là ƯỚC LƯỢNG BẢO THỦ (thanh trên, mô tả/tên người đăng ở dưới, cột nút bên phải), không phải chuẩn cố định.
 */
export const VIDEO_SAFE = { top: 230, bottom: 470, left: 64, right: 150 } as const

const ORANGE = '#EA580C'
const SUB = '#8E8E93'
const S_BALL = 2.6   // phóng từ đơn vị viewer (BALL_LANE=34, BALL_RADIUS=7) sang px video
const PAD = 28       // đệm trong vùng an toàn: chữ không chạm mép
export const BRAND_FOOTER = 'Lớp Guitar Thầy Văn Anh'

export type VideoSong = {
  title: string
  composer: string | null
  text: string
  anchors: ChordAnchors
  meter: TimelineMeter
  bpm: number
  bandName: string | null
  editorName: string | null
}

export type VideoRenderer = {
  readonly timeline: ChordTimeline
  readonly bpm: number
  readonly width: number
  readonly height: number
  /** Vẽ một khung tại `beat` (phách tuyệt đối trên timeline); `seconds` chỉ để làm mượt cuộn. */
  draw(beat: number, seconds: number): void
}

/** "Band X · Biên tập: Y" — chỉ phần có dữ liệu thật (cùng quy tắc dòng ghi công trên web). */
export function videoCreditLine(song: { bandName: string | null; editorName: string | null }): string {
  const band = song.bandName?.trim()
  const editor = song.editorName?.trim()
  return [band ? (/^band\b/i.test(band) ? band : `Band ${band}`) : null, editor ? `Biên tập: ${editor}` : null].filter(Boolean).join(' · ')
}

export function createVideoRenderer(song: VideoSong, canvas: HTMLCanvasElement, options: { scale?: number; showSafe?: boolean; onBall?: (info: { seconds: number; x: number; y: number; row: number }) => void } = {}): VideoRenderer {
  const k = options.scale ?? 1
  const W = VIDEO_W, H = VIDEO_H, SAFE = VIDEO_SAFE
  canvas.width = Math.round(W * k)
  canvas.height = Math.round(H * k)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Thiết bị không vẽ được canvas 2D.')
  const timeline = buildChordTimeline(song.text, song.anchors, song.meter)
  const script = buildPerformanceScript(song.text, song.anchors)
  const boxL = SAFE.left + PAD, boxR = W - SAFE.right - PAD, boxW = boxR - boxL
  const font = (weight: number, px: number) => `${weight} ${Math.round(px * k)}px -apple-system, "SF Pro Text", system-ui, sans-serif`

  const anchoredData: RhythmScrollAnchoredData = {
    version: 2, prototype: true, songId: 'video', lyricsHash: 'video', meter: song.meter,
    ...(script.anchors.pickup ? { pickup: script.anchors.pickup } : {}), measures: script.anchors.measures,
    provenance: { sourceType: 'manual', sourceHash: 'video', generator: 'chord-library-version', generatedAt: '1970-01-01T00:00:00.000Z' },
  }
  const anchored = createAnchoredScroll(anchoredData)

  // Bố cục lời: mỗi dòng ảo → các hàng wrap theo bề ngang vùng an toàn. Mỗi hàng: làn bóng → hợp âm → lời.
  const LANE = BALL_LANE * S_BALL
  const CHORD_H = 64, LYRIC_BASE = LANE + CHORD_H + 66, ROW_H = LYRIC_BASE + 60
  type Cell = { text: string; chord: string | null; x: number; line: number; token: number }
  type Row = { cells: Cell[]; y: number; line: number }
  const rows: Row[] = []
  const flat: { left: number; right: number; top: number }[] = []   // thứ tự đọc, đơn vị viewer (÷S_BALL)
  const flatKey: string[] = []
  let y = 0
  script.lines.forEach(line => {
    let cur: Row = { cells: [], y, line: line.index }
    let x = boxL
    line.words.forEach((w, t) => {
      ctx.font = font(500, 58)
      const full = ctx.measureText(`${w.text} `).width / k
      const ink = ctx.measureText(w.text).width / k
      if (x + full > boxR && cur.cells.length) { rows.push(cur); y += ROW_H; cur = { cells: [], y, line: line.index }; x = boxL }
      cur.cells.push({ text: w.text, chord: w.chord, x, line: line.index, token: t })
      flat.push({ left: x / S_BALL, right: (x + ink) / S_BALL, top: y / S_BALL })
      flatKey.push(`${line.index}:${t}`)
      x += full
    })
    rows.push(cur)
    y += ROW_H + 24
  })
  const { rows: readingRows, rowOf } = assignReadingRows(flat)
  const points = new Map<string, PathPoint>()
  flat.forEach((box, i) => {
    const [line, token] = flatKey[i].split(':').map(Number)
    points.set(`${line}:${token}`, { row: rowOf[i], x: box.left })
    points.set(`${line}:${token + 1}`, { row: rowOf[i], x: box.right })
  })
  const keyOf = (a: { line: number | null; token: number | null }) => `${a.line}:${a.token}`
  const rowIndexOfKey = new Map<string, number>()
  rows.forEach((row, index) => row.cells.forEach(c => rowIndexOfKey.set(`${c.line}:${c.token}`, index)))

  const roundRect = (x: number, y0: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x * k, y0 * k, w * k, h * k, r * k) }
  const fit = (text: string, maxW: number, weight: number, px: number) => {
    let size = px
    ctx.font = font(weight, size)
    while (ctx.measureText(text).width / k > maxW && size > 22) { size -= 2; ctx.font = font(weight, size) }
  }
  const credit = videoCreditLine(song)

  // Các vùng theo trục dọc, tất cả nằm TRONG vùng an toàn.
  const Y_TITLE = SAFE.top + 70, Y_COMPOSER = Y_TITLE + 56, Y_CREDIT = Y_COMPOSER + 52
  const Y_STRIP = Y_CREDIT + 36, H_STRIP = 150
  const Y_LYRICS = Y_STRIP + H_STRIP + 20
  const H_FOOTER = 112
  const Y_FOOTER = H - SAFE.bottom - H_FOOTER
  const H_LYRICS = Y_FOOTER - 16 - Y_LYRICS

  let scroll = 0
  let lastT = 0
  const draw = (beat: number, tNow: number) => {
    const dt = Math.min(0.1, Math.max(0, tNow - lastT))
    lastT = tNow
    const pos = locateBeat(timeline, beat)
    const ev = pos.chordIndex >= 0 ? timeline.events[pos.chordIndex] : null
    const next = pos.chordIndex + 1 < timeline.events.length ? timeline.events[pos.chordIndex + 1] : null
    const activeLine = ev ? script.virtualLine(ev.measure, ev.line) : 0
    const activeKey = ev ? `${activeLine}:${ev.token}` : ''
    const measure = timeline.measures[pos.measureIndex]
    const beatInMeasure = pos.state === 'active' ? Math.floor(pos.measureProgress * measure.beats) + 1 : 0

    // Bóng: NGUYÊN ballBetweenAnchors của viewer (một cú nảy mỗi ô, đi theo đường đọc).
    const ap = anchored.locate(pos.measurePosition)
    const from = ap.current.line === null ? undefined : points.get(keyOf(ap.current))
    const to = ap.next.line === null ? from : points.get(keyOf(ap.next))
    const ball = ap.state === 'active' && from && to ? ballBetweenAnchors(readingRows, from, to, ap.measureProgress, true) : null

    ctx.fillStyle = '#F2F2F7'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1C1C1E'
    fit(song.title, boxW, 700, 76)
    ctx.fillText(song.title, boxL * k, Y_TITLE * k)
    if (song.composer) { ctx.fillStyle = SUB; ctx.font = font(500, 40); ctx.fillText(song.composer, boxL * k, Y_COMPOSER * k) }
    if (credit) { ctx.fillStyle = SUB; fit(credit, boxW, 500, 36); ctx.fillText(credit, boxL * k, Y_CREDIT * k) }
    // Dải hợp âm hiện tại → kế tiếp + chấm nhịp
    ctx.fillStyle = '#fff'
    roundRect(boxL, Y_STRIP, boxW, H_STRIP, 36)
    ctx.fill()
    ctx.font = font(800, 84)
    ctx.fillStyle = ORANGE
    const cur = ev?.chord ?? '—'
    ctx.fillText(cur, (boxL + 44) * k, (Y_STRIP + 106) * k)
    let ax = (boxL + 44) * k + ctx.measureText(cur).width + 26 * k
    ctx.fillStyle = SUB
    ctx.font = font(600, 54)
    ctx.fillText('→', ax, (Y_STRIP + 98) * k)
    ax += ctx.measureText('→').width + 22 * k
    ctx.font = font(700, 68)
    ctx.fillText(next?.chord ?? '', ax, (Y_STRIP + 100) * k)
    for (let i = 0; i < measure.beats; i++) {
      const on = beatInMeasure === i + 1
      ctx.beginPath()
      ctx.arc((boxR - 44 - (measure.beats - 1 - i) * 54) * k, (Y_STRIP + 75) * k, (on ? 19 : 14) * k, 0, 7)
      ctx.fillStyle = on ? ORANGE : '#D1D1D6'
      ctx.fill()
    }
    // Lời + hợp âm + bóng; cuộn bám hàng của bóng (như viewer).
    const follow = ball ? ball.row : (rowIndexOfKey.get(activeKey) ?? 0)
    const followY = ball ? readingRows[follow].top * S_BALL : (rows[follow]?.y ?? 0)
    scroll += (followY - scroll) * (1 - Math.exp(-dt * 5))
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, Y_LYRICS * k, canvas.width, H_LYRICS * k)
    ctx.clip()
    const base = Y_LYRICS + H_LYRICS * 0.06 - scroll
    rows.forEach(row => {
      const yy = base + row.y
      if (yy < Y_LYRICS - ROW_H || yy > Y_LYRICS + H_LYRICS + ROW_H) return
      const isActiveLine = row.line === activeLine
      row.cells.forEach(c => {
        ctx.font = font(500, 58)
        ctx.fillStyle = isActiveLine ? '#1C1C1E' : '#6B6B70'
        ctx.fillText(c.text, c.x * k, (yy + LYRIC_BASE) * k)
        if (c.chord) {
          const active = `${c.line}:${c.token}` === activeKey
          ctx.font = font(700, 46)
          const wch = ctx.measureText(c.chord).width / k
          if (active) { ctx.fillStyle = ORANGE; roundRect(c.x - 12, yy + LANE, wch + 24, CHORD_H, 18); ctx.fill(); ctx.fillStyle = '#fff' }
          else ctx.fillStyle = '#C2410C'
          ctx.fillText(c.chord, c.x * k, (yy + LANE + 48) * k)
        }
      })
    })
    if (ball) {
      const bx = ball.x * S_BALL
      const by = base + ball.y * S_BALL
      ctx.save()
      ctx.shadowColor = 'rgba(234,88,12,.75)'
      ctx.shadowBlur = 22 * k
      ctx.fillStyle = ORANGE
      ctx.beginPath()
      ctx.arc(bx * k, by * k, BALL_RADIUS * S_BALL * k, 0, 7)
      ctx.fill()
      ctx.restore()
      options.onBall?.({ seconds: tNow, x: Math.round(bx * k), y: Math.round(by * k), row: ball.row })
    }
    ctx.restore()
    // Footer nhận diện: nền trắng nhẹ, đường phân cách mảnh phía trên, chữ cam căn giữa.
    const fx = SAFE.left, fw = W - SAFE.left - SAFE.right
    ctx.fillStyle = 'rgba(255,255,255,.92)'
    ctx.fillRect(fx * k, Y_FOOTER * k, fw * k, H_FOOTER * k)
    ctx.fillStyle = 'rgba(60,60,67,.22)'
    ctx.fillRect(fx * k, Y_FOOTER * k, fw * k, Math.max(1, 2 * k))
    ctx.fillStyle = ORANGE
    ctx.font = font(700, 44)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(BRAND_FOOTER, (fx + fw / 2) * k, (Y_FOOTER + H_FOOTER / 2 + 2) * k)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    if (options.showSafe) {
      ctx.save()
      ctx.strokeStyle = 'rgba(220,38,38,.9)'
      ctx.lineWidth = 4 * k
      ctx.setLineDash([18 * k, 12 * k])
      ctx.strokeRect(SAFE.left * k, SAFE.top * k, (W - SAFE.left - SAFE.right) * k, (H - SAFE.top - SAFE.bottom) * k)
      ctx.restore()
    }
  }

  return { timeline, bpm: song.bpm, width: canvas.width, height: canvas.height, draw }
}
