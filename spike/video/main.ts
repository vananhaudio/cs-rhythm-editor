// SPIKE (không tích hợp, không commit dữ liệu bài): render khung 9:16 từ timeline thật → canvas.captureStream → MediaRecorder.
// Dữ liệu bài nạp lúc chạy từ ./data.json (nằm ngoài repo). Dùng NGUYÊN buildChordTimeline / buildPerformanceScript / locateBeat.
import { buildChordTimeline, locateBeat, beatsAtSeconds } from '../../src/thuvien/chordTimeline.ts'
import { buildPerformanceScript } from '../../src/thuvien/performanceScript.ts'
import { BALL_LANE, BALL_RADIUS, assignReadingRows, ballBetweenAnchors } from '../../src/rhythm-scroll-viewer/ballPath.ts'
import type { PathPoint } from '../../src/rhythm-scroll-viewer/ballPath.ts'
import { createAnchoredScroll } from '../../src/rhythm-scroll-viewer/anchored.ts'
import type { RhythmScrollAnchoredData } from '../../src/rhythm-scroll-viewer/anchored.ts'

const W = 1080, H = 1920, ORANGE = '#EA580C', SUB = '#8E8E93'
const log = (m: string) => { (document.getElementById('log') as HTMLElement).textContent += m + '\n'; (window as any).__log = ((window as any).__log ?? '') + m + '\n' }
const params = new URLSearchParams(location.search)
const SECONDS = Number(params.get('sec') ?? 14)
const START_BEAT = Number(params.get('start') ?? 0)
const FPS = Number(params.get('fps') ?? 30)
const SCALE = Number(params.get('scale') ?? 1)       // 1 = 1080x1920, 0.667 = 720x1280

// ── LAYOUT: MỘT chỗ chỉnh tập trung. Đơn vị = px của khung 1080×1920 (trước SCALE). Vùng an toàn là ƯỚC LƯỢNG BẢO THủ
// cho giao diện TikTok (thanh trên, mô tả/tên người đăng ở dưới, cột nút bên phải); KHÔNG phải chuẩn cố định → chỉnh ở đây
// sau khi xem thực tế. ?safe=1 vẽ khung vùng an toàn để kiểm tra bằng mắt.
const SAFE = { top: 230, bottom: 470, left: 64, right: 150 }
const S_BALL = 2.6   // hệ số phóng từ đơn vị viewer (BALL_LANE=34, BALL_RADIUS=7) sang px video
const SHOW_SAFE = params.get('safe') === '1'

async function main() {
  const d = await (await fetch('./data.json')).json()
  const timeline = buildChordTimeline(d.text, d.anchors, d.meter)
  const script = buildPerformanceScript(d.text, d.anchors)
  const bpm: number = d.bpm ?? 80
  const canvas = document.getElementById('c') as HTMLCanvasElement
  canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE)
  const ctx = canvas.getContext('2d')!
  const k = SCALE
  const PAD = 28   // đệm trong vùng an toàn: chữ không chạm mép
  const boxL = SAFE.left + PAD, boxR = W - SAFE.right - PAD, boxW = boxR - boxL
  const font = (wt: number, px: number) => `${wt} ${Math.round(px * k)}px -apple-system, "SF Pro Text", system-ui, sans-serif`

  // Dữ liệu cho engine neo của viewer (cùng hình dạng RhythmScrollPage dựng).
  const anchoredData: RhythmScrollAnchoredData = {
    version: 2, prototype: true, songId: 'spike', lyricsHash: 'spike', meter: d.meter,
    ...(script.anchors.pickup ? { pickup: script.anchors.pickup } : {}), measures: script.anchors.measures,
    provenance: { sourceType: 'manual', sourceHash: 'spike', generator: 'chord-library-version', generatedAt: '2026-10-15T00:00:00.000Z' },
  }
  const anchored = createAnchoredScroll(anchoredData)

  // Bố cục lời: mỗi dòng ảo → các hàng (wrap theo bề ngang vùng an toàn). Mỗi hàng: làn bóng (BALL_LANE*S) → hợp âm → lời.
  const LANE = BALL_LANE * S_BALL
  const CHORD_H = 64, LYRIC_BASE = LANE + CHORD_H + 66, ROW_H = LYRIC_BASE + 60
  type Cell = { text: string; chord: string | null; x: number; w: number; line: number; token: number }
  type Row = { cells: Cell[]; y: number; line: number }
  const rows: Row[] = []
  const flat: { left: number; right: number; top: number }[] = []   // theo thứ tự đọc, đơn vị viewer (÷S_BALL)
  const flatKey: string[] = []
  ctx.font = font(500, 58)
  let y = 0
  script.lines.forEach(line => {
    let cur: Row = { cells: [], y, line: line.index }
    let x = boxL
    line.words.forEach((w, t) => {
      ctx.font = font(500, 58)
      const full = ctx.measureText(w.text + ' ').width / k, ink = ctx.measureText(w.text).width / k
      if (x + full > boxR && cur.cells.length) { rows.push(cur); y += ROW_H; cur = { cells: [], y, line: line.index }; x = boxL }
      cur.cells.push({ text: w.text, chord: w.chord, x, w: ink, line: line.index, token: t })
      flat.push({ left: x / S_BALL, right: (x + ink) / S_BALL, top: y / S_BALL }); flatKey.push(`${line.index}:${t}`)
      x += full
    })
    rows.push(cur); y += ROW_H + 24
  })
  const { rows: readingRows, rowOf } = assignReadingRows(flat)
  const points = new Map<string, PathPoint>()
  flat.forEach((b, i) => {
    const [ln, tk] = flatKey[i].split(':').map(Number)
    points.set(`${ln}:${tk}`, { row: rowOf[i], x: b.left })
    points.set(`${ln}:${tk + 1}`, { row: rowOf[i], x: b.right })
  })
  const keyOf = (a: { line: number | null; token: number | null }) => `${a.line}:${a.token}`
  const rowIndexOfKey = new Map<string, number>()
  rows.forEach((r, ri) => r.cells.forEach(c => rowIndexOfKey.set(`${c.line}:${c.token}`, ri)))

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x * k, y * k, w * k, h * k, r * k) }
  const fit = (text: string, maxW: number, wt: number, px: number) => { let s = px; ctx.font = font(wt, s); while (ctx.measureText(text).width / k > maxW && s > 22) { s -= 2; ctx.font = font(wt, s) } }
  const credit = [d.band ? (/^band\b/i.test(d.band) ? d.band : `Band ${d.band}`) : null, d.editor ? `Biên tập: ${d.editor}` : null].filter(Boolean).join(' · ')
  const ballLog: { t: number; x: number; y: number; row: number }[] = []
  ;(window as any).__ballLog = ballLog

  // Các vùng theo trục dọc, tất cả nằm TRONG vùng an toàn.
  const Y_TITLE = SAFE.top + 70, Y_COMPOSER = Y_TITLE + 56, Y_CREDIT = Y_COMPOSER + 52
  const Y_STRIP = Y_CREDIT + 36, H_STRIP = 150
  const Y_LYRICS = Y_STRIP + H_STRIP + 20
  const Y_BRAND = H - SAFE.bottom - PAD   // baseline dòng thương hiệu nằm TRONG vùng an toàn, có đệm
  const H_LYRICS = Y_BRAND - 90 - Y_LYRICS

  let scroll = 0, lastT = 0
  const draw = (beat: number, tNow: number) => {
    const dt = Math.min(0.1, Math.max(0, tNow - lastT)); lastT = tNow
    const pos = locateBeat(timeline, beat)
    const ev = pos.chordIndex >= 0 ? timeline.events[pos.chordIndex] : null
    const next = pos.chordIndex + 1 < timeline.events.length ? timeline.events[pos.chordIndex + 1] : null
    const activeLine = ev ? script.virtualLine(ev.measure, ev.line) : 0
    const activeKey = ev ? `${activeLine}:${ev.token}` : ''
    const meas = timeline.measures[pos.measureIndex]
    const beatInM = pos.state === 'active' ? Math.floor(pos.measureProgress * meas.beats) + 1 : 0

    // Bóng: DÙNG NGUYÊN ballBetweenAnchors của viewer (một cú nảy mỗi ô, đi theo đường đọc) — không có beat engine thứ hai.
    const ap = anchored.locate(pos.measurePosition)
    const from = ap.current.line === null ? undefined : points.get(keyOf(ap.current))
    const to = ap.next.line === null ? from : points.get(keyOf(ap.next))
    const ball = ap.state === 'active' && from && to ? ballBetweenAnchors(readingRows, from, to, ap.measureProgress, true) : null

    ctx.fillStyle = '#F2F2F7'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#1C1C1E'
    fit(d.title, boxW, 700, 76); ctx.fillText(d.title, boxL * k, Y_TITLE * k)
    if (d.composer) { ctx.fillStyle = SUB; ctx.font = font(500, 40); ctx.fillText(d.composer, boxL * k, Y_COMPOSER * k) }
    if (credit) { ctx.fillStyle = SUB; fit(credit, boxW, 500, 36); ctx.fillText(credit, boxL * k, Y_CREDIT * k) }
    // Dải hợp âm hiện tại → kế tiếp + chấm nhịp
    ctx.fillStyle = '#fff'; roundRect(boxL, Y_STRIP, boxW, H_STRIP, 36); ctx.fill()
    ctx.font = font(800, 84); ctx.fillStyle = ORANGE
    const cur = ev?.chord ?? '—'; ctx.fillText(cur, (boxL + 44) * k, (Y_STRIP + 106) * k)
    let ax = (boxL + 44) * k + ctx.measureText(cur).width + 26 * k
    ctx.fillStyle = SUB; ctx.font = font(600, 54); ctx.fillText('→', ax, (Y_STRIP + 98) * k)
    ax += ctx.measureText('→').width + 22 * k
    ctx.font = font(700, 68); ctx.fillText(next?.chord ?? '', ax, (Y_STRIP + 100) * k)
    for (let i = 0; i < meas.beats; i++) {
      const on = beatInM === i + 1
      ctx.beginPath(); ctx.arc((boxR - 44 - (meas.beats - 1 - i) * 54) * k, (Y_STRIP + 75) * k, (on ? 19 : 14) * k, 0, 7)
      ctx.fillStyle = on ? ORANGE : '#D1D1D6'; ctx.fill()
    }
    // Lời + hợp âm + BÓNG; cuộn bám hàng của bóng (như viewer).
    const follow = ball ? ball.row : (rowIndexOfKey.get(activeKey) ?? 0)
    const followY = ball ? readingRows[follow].top * S_BALL : (rows[follow]?.y ?? 0)
    scroll += (followY - scroll) * (1 - Math.exp(-dt * 5))
    ctx.save(); ctx.beginPath(); ctx.rect(0, Y_LYRICS * k, canvas.width, H_LYRICS * k); ctx.clip()
    const base = Y_LYRICS + H_LYRICS * 0.06 - scroll
    rows.forEach(r => {
      const yy = base + r.y
      if (yy < Y_LYRICS - ROW_H || yy > Y_LYRICS + H_LYRICS + ROW_H) return
      const isActiveLine = r.line === activeLine
      r.cells.forEach(c => {
        ctx.font = font(500, 58); ctx.fillStyle = isActiveLine ? '#1C1C1E' : '#6B6B70'
        ctx.fillText(c.text, c.x * k, (yy + LYRIC_BASE) * k)
        if (c.chord) {
          const act = `${c.line}:${c.token}` === activeKey
          ctx.font = font(700, 46); const wch = ctx.measureText(c.chord).width / k
          if (act) { ctx.fillStyle = ORANGE; roundRect(c.x - 12, yy + LANE, wch + 24, CHORD_H, 18); ctx.fill(); ctx.fillStyle = '#fff' }
          else ctx.fillStyle = '#C2410C'
          ctx.fillText(c.chord, c.x * k, (yy + LANE + 48) * k)
        }
      })
    })
    if (ball) {
      const bx = ball.x * S_BALL, by = base + ball.y * S_BALL
      ctx.save(); ctx.shadowColor = 'rgba(234,88,12,.75)'; ctx.shadowBlur = 22 * k
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(bx * k, by * k, BALL_RADIUS * S_BALL * k, 0, 7); ctx.fill(); ctx.restore()
      ballLog.push({ t: tNow, x: Math.round(bx * k), y: Math.round(by * k), row: ball.row })
    }
    ctx.restore()
    ctx.fillStyle = ORANGE; ctx.font = font(700, 46); ctx.textAlign = 'center'
    ctx.fillText('Lớp Guitar Thầy Văn Anh', ((boxL + boxR) / 2) * k, Y_BRAND * k); ctx.textAlign = 'left'
    if (SHOW_SAFE) {
      ctx.save(); ctx.strokeStyle = 'rgba(220,38,38,.9)'; ctx.lineWidth = 4 * k; ctx.setLineDash([18 * k, 12 * k])
      ctx.strokeRect(SAFE.left * k, SAFE.top * k, (W - SAFE.left - SAFE.right) * k, (H - SAFE.top - SAFE.bottom) * k)
      ctx.fillStyle = 'rgba(220,38,38,.08)'
      ctx.fillRect(0, 0, canvas.width, SAFE.top * k); ctx.fillRect(0, (H - SAFE.bottom) * k, canvas.width, SAFE.bottom * k); ctx.fillRect((W - SAFE.right) * k, 0, SAFE.right * k, canvas.height)
      ctx.restore()
    }
  }

  ;(window as any).__info = { totalBeats: timeline.totalBeats, bpm, rows: rows.length, events: timeline.events.length }
  draw(START_BEAT, 0)

  // Điều khiển cho trang thử iPhone: tiến độ, hủy, giữ màn hình sáng, tự hủy khi tab bị ẩn.
  let cancelled = false
  const ui = { progress: (f: number) => { const e = document.getElementById('bar') as HTMLElement | null; if (e) e.style.width = Math.round(f * 100) + '%' } }
  async function record() {
    cancelled = false
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=h264', 'video/webm;codecs=vp9', 'video/webm']
    const support = types.map(t => `${t}=${(window as any).MediaRecorder?.isTypeSupported?.(t)}`)
    log('UA: ' + navigator.userAgent)
    log('isTypeSupported: ' + support.join(' | '))
    log('captureStream: ' + (typeof (canvas as any).captureStream) + ' roundRect: ' + (typeof (ctx as any).roundRect) + ' wakeLock: ' + ('wakeLock' in navigator) + ' share: ' + (typeof navigator.share) + ' canShareFiles: ' + (typeof navigator.canShare))
    const mime = types.find(t => (window as any).MediaRecorder?.isTypeSupported?.(t))
    if (!mime) { log('KHÔNG có mimeType nào'); return null }
    let lock: { release(): Promise<void> } | null = null
    try { lock = await (navigator as any).wakeLock?.request('screen') } catch (e) { log('wakeLock lỗi: ' + e) }
    const onHide = () => { if (document.hidden) { cancelled = true; log('ĐÃ HỦY: tab/app bị chuyển nền khi đang ghi') } }
    document.addEventListener('visibilitychange', onHide)
    const stream = (canvas as any).captureStream(FPS) as MediaStream
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    const done = new Promise<void>(r => { rec.onstop = () => r() })
    const frameMs: number[] = []
    const maxBeats = Math.min(beatsAtSeconds(SECONDS, bpm), timeline.totalBeats - START_BEAT)
    const totalSec = (maxBeats * 60) / bpm
    const t0 = performance.now(); rec.start(500)
    await new Promise<void>(res => {
      const tick = () => {
        const el = (performance.now() - t0) / 1000
        const beat = START_BEAT + beatsAtSeconds(el, bpm)
        const a = performance.now(); draw(Math.min(beat, START_BEAT + maxBeats), el); frameMs.push(performance.now() - a)
        ui.progress(Math.min(1, el / totalSec))
        if (cancelled || el >= totalSec) { res(); return }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await new Promise(r => setTimeout(r, 150))
    rec.stop(); await done
    document.removeEventListener('visibilitychange', onHide)
    try { await lock?.release() } catch { /* bỏ qua */ }
    if (cancelled) { log('Không tạo file (đã hủy).'); return null }
    const blob = new Blob(chunks, { type: mime })
    const wall = (performance.now() - t0) / 1000
    const sorted = [...frameMs].sort((a, b) => a - b)
    const heap = (performance as any).memory?.usedJSHeapSize
    log(`mime=${mime} recorderType=${rec.mimeType} bytes=${blob.size} wall=${wall.toFixed(2)}s frames=${frameMs.length} drawAvg=${(frameMs.reduce((a, b) => a + b, 0) / frameMs.length).toFixed(2)}ms drawP95=${sorted[Math.floor(sorted.length * 0.95)].toFixed(2)}ms heap=${heap ? Math.round(heap / 1e6) + 'MB' : 'n/a'}`)
    ;(window as any).__blob = blob
    return blob
  }
  ;(window as any).__cancel = () => { cancelled = true }
  ;(window as any).__record = record
  const $ = (id: string) => document.getElementById(id) as HTMLElement
  $('go').onclick = async () => {
    ($('go') as HTMLButtonElement).disabled = true; $('cancel').style.display = ''; $('result').style.display = 'none'
    const blob = await record()
    $('cancel').style.display = 'none'; ($('go') as HTMLButtonElement).disabled = false
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([blob], `play-scroll-${Date.now()}.${ext}`, { type: blob.type })
    ;($('preview') as HTMLVideoElement).src = url
    ;($('dl') as HTMLAnchorElement).href = url; ($('dl') as HTMLAnchorElement).download = file.name
    $('share').onclick = async () => {
      try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Play Scroll' }); else log('canShare(files)=false') }
      catch (e) { log('share: ' + e) }
    }
    $('result').style.display = ''
  }
  $('cancel').onclick = () => { cancelled = true }

}
main()
