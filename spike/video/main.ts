// SPIKE (không tích hợp, không commit dữ liệu bài): render khung 9:16 từ timeline thật → canvas.captureStream → MediaRecorder.
// Dữ liệu bài nạp lúc chạy từ ./data.json (nằm ngoài repo). Dùng NGUYÊN buildChordTimeline / buildPerformanceScript / locateBeat.
import { buildChordTimeline, locateBeat, beatsAtSeconds } from '../../src/thuvien/chordTimeline.ts'
import { buildPerformanceScript } from '../../src/thuvien/performanceScript.ts'

const W = 1080, H = 1920, ORANGE = '#EA580C', TEXT = '#1C1C1E', SUB = '#8E8E93'
const log = (m: string) => { (document.getElementById('log') as HTMLElement).textContent += m + '\n'; (window as any).__log = ((window as any).__log ?? '') + m + '\n' }
const params = new URLSearchParams(location.search)
const SECONDS = Number(params.get('sec') ?? 14)
const START_BEAT = Number(params.get('start') ?? 0)
const FPS = Number(params.get('fps') ?? 30)
const SCALE = Number(params.get('scale') ?? 1)       // 1 = 1080x1920, 0.667 = 720x1280

async function main() {
  const d = await (await fetch('./data.json')).json()
  const timeline = buildChordTimeline(d.text, d.anchors, d.meter)
  const script = buildPerformanceScript(d.text, d.anchors)
  const bpm: number = d.bpm ?? 80
  const canvas = document.getElementById('c') as HTMLCanvasElement
  canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE)
  const ctx = canvas.getContext('2d')!
  const k = SCALE

  // Bố cục dòng lời (một lần): mỗi dòng ảo → các hàng (wrap theo chiều rộng), mỗi từ có x.
  type Cell = { text: string; chord: string | null; x: number; line: number; token: number }
  type Row = { cells: Cell[]; y: number; line: number }
  const FONT_L = `500 ${Math.round(58 * k)}px -apple-system, "SF Pro Text", system-ui, sans-serif`
  const FONT_C = `700 ${Math.round(46 * k)}px -apple-system, "SF Pro Text", system-ui, sans-serif`
  const rows: Row[] = []
  const rowOf = new Map<string, number>()   // "line:token" → chỉ số hàng
  const left = 90 * k, maxX = (W - 90) * k, rowH = 170 * k
  ctx.font = FONT_L
  let y = 0
  script.lines.forEach(line => {
    let cur: Row = { cells: [], y, line: line.index }
    let x = left
    if (script.labels[line.index]) { ctx.font = FONT_L; x += ctx.measureText(script.labels[line.index] + ' ').width }
    line.words.forEach((w, t) => {
      ctx.font = FONT_L
      const wd = ctx.measureText(w.text + ' ').width
      if (x + wd > maxX && cur.cells.length) { rows.push(cur); y += rowH; cur = { cells: [], y, line: line.index }; x = left }
      cur.cells.push({ text: w.text, chord: w.chord, x, line: line.index, token: t })
      rowOf.set(`${line.index}:${t}`, rows.length)
      x += wd
    })
    rows.push(cur); y += rowH + 20 * k
  })

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }
  const fit = (text: string, maxW: number, font: (px: number) => string, px: number) => { let s = px; ctx.font = font(s); while (ctx.measureText(text).width > maxW && s > 20 * k) { s -= 2; ctx.font = font(s) } }
  const credit = [d.band ? `Band ${d.band}` : null, d.editor ? `Biên tập: ${d.editor}` : null].filter(Boolean).join(' · ')

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

    ctx.fillStyle = '#F2F2F7'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    // 1. Tên bài + tác giả
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = TEXT
    fit(d.title, (W - 160) * k, px => `700 ${px}px -apple-system, system-ui, sans-serif`, 78 * k); ctx.fillText(d.title, 80 * k, 190 * k)
    if (d.composer) { ctx.fillStyle = SUB; ctx.font = `500 ${40 * k}px -apple-system, system-ui, sans-serif`; ctx.fillText(d.composer, 80 * k, 252 * k) }
    // 2. Ghi công
    if (credit) { ctx.fillStyle = SUB; fit(credit, (W - 160) * k, px => `500 ${px}px -apple-system, system-ui, sans-serif`, 36 * k); ctx.fillText(credit, 80 * k, 312 * k) }
    // 3a. Dải hợp âm hiện tại → tiếp theo + chấm nhịp
    const sy = 360 * k, sh = 150 * k
    ctx.fillStyle = '#fff'; roundRect(60 * k, sy, (W - 120) * k, sh, 36 * k); ctx.fill()
    ctx.font = `800 ${84 * k}px -apple-system, system-ui, sans-serif`; ctx.fillStyle = ORANGE
    const cur = ev?.chord ?? '—'; ctx.fillText(cur, 110 * k, sy + 105 * k)
    let ax = 110 * k + ctx.measureText(cur).width + 30 * k
    ctx.fillStyle = SUB; ctx.font = `600 ${56 * k}px -apple-system, system-ui, sans-serif`; ctx.fillText('→', ax, sy + 98 * k)
    ax += ctx.measureText('→').width + 26 * k
    ctx.font = `700 ${68 * k}px -apple-system, system-ui, sans-serif`; ctx.fillText(next?.chord ?? '', ax, sy + 100 * k)
    const nDots = meas.beats
    for (let i = 0; i < nDots; i++) {
      const on = beatInM === i + 1
      ctx.beginPath(); ctx.arc((W - 130 - (nDots - 1 - i) * 56) * k, sy + 75 * k, (on ? 20 : 15) * k, 0, 7)
      ctx.fillStyle = on ? ORANGE : '#D1D1D6'; ctx.fill()
    }
    // 3b. Lời + hợp âm (cuộn mượt theo hàng đang hát)
    const areaTop = 540 * k, areaH = (H - 540 - 250) * k
    const ri = rowOf.get(activeKey) ?? 0
    const target = (rows[ri]?.y ?? 0) * k * 0 + (rows[ri]?.y ?? 0)
    scroll += (target - scroll) * (1 - Math.exp(-dt * 5))
    ctx.save(); ctx.beginPath(); ctx.rect(0, areaTop, canvas.width, areaH); ctx.clip()
    const centerY = areaTop + areaH * 0.38
    rows.forEach(r => {
      const yy = centerY + r.y - scroll
      if (yy < areaTop - rowH || yy > areaTop + areaH + rowH) return
      const isActiveLine = r.line === activeLine
      r.cells.forEach(c => {
        ctx.font = FONT_L; ctx.fillStyle = isActiveLine ? TEXT : '#6B6B70'
        ctx.fillText(c.text, c.x, yy + 120 * k)
        if (c.chord) {
          const act = `${c.line}:${c.token}` === activeKey
          ctx.font = FONT_C; const wch = ctx.measureText(c.chord).width
          if (act) { ctx.fillStyle = ORANGE; roundRect(c.x - 14 * k, yy + 14 * k, wch + 28 * k, 68 * k, 18 * k); ctx.fill(); ctx.fillStyle = '#fff' }
          else ctx.fillStyle = '#C2410C'
          ctx.fillText(c.chord, c.x, yy + 64 * k)
        }
      })
    })
    ctx.restore()
    // 4. Dòng thương hiệu cố định
    ctx.fillStyle = ORANGE; ctx.font = `700 ${46 * k}px -apple-system, system-ui, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('Lớp Guitar Thầy Văn Anh', canvas.width / 2, (H - 110) * k); ctx.textAlign = 'left'
  }

  ;(window as any).__info = { totalBeats: timeline.totalBeats, bpm, rows: rows.length, events: timeline.events.length }
  draw(START_BEAT, 0)

  async function record() {
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=h264', 'video/webm;codecs=vp9', 'video/webm']
    const support = types.map(t => `${t}=${(window as any).MediaRecorder?.isTypeSupported?.(t)}`)
    log('isTypeSupported: ' + support.join(' | '))
    log('captureStream: ' + (typeof (canvas as any).captureStream) + ' roundRect: ' + (typeof (ctx as any).roundRect))
    const mime = types.find(t => (window as any).MediaRecorder?.isTypeSupported?.(t))
    if (!mime) { log('KHÔNG có mimeType nào'); return null }
    const stream = (canvas as any).captureStream(FPS) as MediaStream
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    const done = new Promise<void>(r => { rec.onstop = () => r() })
    const frameMs: number[] = []
    const maxBeats = Math.min(beatsAtSeconds(SECONDS, bpm), timeline.totalBeats - START_BEAT)
    const t0 = performance.now(); rec.start(500)
    let stop = false
    await new Promise<void>(res => {
      const tick = () => {
        const el = (performance.now() - t0) / 1000
        const beat = START_BEAT + beatsAtSeconds(el, bpm)
        const a = performance.now(); draw(Math.min(beat, START_BEAT + maxBeats), el); frameMs.push(performance.now() - a)
        if (el >= (maxBeats * 60) / bpm) { res(); return }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await new Promise(r => setTimeout(r, 150))
    rec.stop(); await done
    const blob = new Blob(chunks, { type: mime })
    const wall = (performance.now() - t0) / 1000
    const sorted = [...frameMs].sort((a, b) => a - b)
    const heap = (performance as any).memory?.usedJSHeapSize
    log(`mime=${mime} recorderType=${rec.mimeType} bytes=${blob.size} wall=${wall.toFixed(2)}s frames=${frameMs.length} drawAvg=${(frameMs.reduce((a, b) => a + b, 0) / frameMs.length).toFixed(2)}ms drawP95=${sorted[Math.floor(sorted.length * 0.95)].toFixed(2)}ms heap=${heap ? Math.round(heap / 1e6) + 'MB' : 'n/a'}`)
    ;(window as any).__blob = blob
    return blob
  }
  ;(window as any).__record = record
  document.getElementById('go')!.onclick = () => record()
}
main()
