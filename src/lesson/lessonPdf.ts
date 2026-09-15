// ── Xuất tài liệu học ra PDF A4 ──
// Học viên bấm một nút là có file .pdf, KHÔNG phải mò hộp thoại in của trình duyệt.
//
// Hai điều bắt buộc, sai là hỏng:
//  1) Ký hiệu nhạc của alphaTab là <text> dùng font 'alphaTab' (Bravura) nạp từ /font/.
//     Khi chụp ảnh, SVG bị tách khỏi trang nên KHÔNG thấy font ngoài ⇒ bản nhạc trắng trơn.
//     Vì vậy phải NHÚNG font base64 vào trong từng <svg> trước khi chụp.
//  2) Chụp theo TỪNG KHỐI rồi mới xếp vào trang — không chụp cả trang dài rồi cắt,
//     vì nhát cắt sẽ rơi vào giữa khuông nhạc.
const A4_W = 210, A4_H = 297, MARGIN = 12
const BOX_W = A4_W - MARGIN * 2
const BOX_H = A4_H - MARGIN * 2
const GAP = 4

let fontCss: Promise<string> | null = null
async function bravuraCss(): Promise<string> {
  return (fontCss ??= (async () => {
    const res = await fetch('/font/Bravura.woff2')
    if (!res.ok) throw new Error('Không nạp được font bản nhạc')
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    return `@font-face{font-family:'alphaTab';src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`
  })().catch(e => { fontCss = null; throw e }))
}

// html2canvas KHÔNG vẽ dấu đầu dòng của <ol>/<ul> (và cũng không hiểu counter()
// trong ::before) ⇒ phải chèn thẳng "1." / "•" thành chữ vào bản sao.
// Đồng thời bỏ mọi thứ chỉ dành cho màn hình (nút "Xem lớn"…).
const PDF_CSS = `
.no-print{display:none !important;}
ol,ul{list-style:none !important;padding-left:6px !important;}
`

function inlineListMarkers(el: HTMLElement) {
  el.querySelectorAll('ol').forEach(ol => {
    [...ol.children].forEach((li, i) => {
      if (li instanceof HTMLElement && li.tagName === 'LI')
        li.insertBefore(el.ownerDocument.createTextNode(`${i + 1}.\u00A0`), li.firstChild)
    })
  })
  el.querySelectorAll('ul').forEach(ul => {
    if (ul.classList.contains('lsn-check')) return      // checklist đã có ô vuông riêng
    for (const li of [...ul.children]) {
      if (li instanceof HTMLElement && li.tagName === 'LI')
        li.insertBefore(el.ownerDocument.createTextNode('•\u00A0'), li.firstChild)
    }
  })
}

/** Chuẩn bị BẢN SAO trước khi chụp: nhúng font nhạc vào từng <svg> + CSS riêng cho PDF. */
function prepareClone(el: HTMLElement, fontFace: string) {
  el.querySelectorAll('svg').forEach(svg => {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = fontFace
    svg.insertBefore(style, svg.firstChild)
  })
  inlineListMarkers(el)
  const style = el.ownerDocument.createElement('style')
  style.textContent = PDF_CSS
  el.ownerDocument.head.appendChild(style)
}

/** Giới hạn cạnh canvas của trình duyệt — vượt qua là canvas ra TRẮNG. */
const MAX_EDGE = 15800

/**
 * Các mốc y (px, theo hệ toạ độ của trang) được phép cắt trang: đáy của mỗi khối.
 * Khối nào cao hơn một trang thì lấy tiếp đáy của các phần bên trong nó — nhờ vậy
 * nhát cắt luôn rơi vào KHE giữa hai khuông nhạc, không cắt ngang bản nhạc.
 */
function collectCuts(root: HTMLElement, pageHcss: number): number[] {
  const top = root.getBoundingClientRect().top
  const cuts: number[] = []
  // Đừng bao giờ ngắt trang ngay sau tiêu đề hay dòng tempo — bản nhạc phải nằm
  // cùng trang với cái tên của nó.
  const NO_CUT_AFTER = ['lsn-block-h', 'lsn-tempo', 'lsn-piece-h', 'lsn-piece-note', 'lsn-sub']
  const walk = (el: HTMLElement) => {
    if (el.classList.contains('no-print')) return
    if (NO_CUT_AFTER.some(c => el.classList.contains(c))) return
    const r = el.getBoundingClientRect()
    const kids = [...el.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && !c.classList.contains('no-print'),
    )
    if (r.height > pageHcss && kids.length) { for (const k of kids) walk(k) }
    cuts.push(r.bottom - top)
  }
  for (const c of [...root.children]) if (c instanceof HTMLElement) walk(c)
  return [...new Set(cuts)].sort((a, b) => a - b)
}

/** Bề ngang trang in (px @96dpi) — ép về khổ này để PDF không phụ thuộc màn hình. */
const PAPER_PX = 794

/**
 * Trên điện thoại, trang đang ở bố cục hẹp: chụp thẳng sẽ ra PDF dài lê thê (27 trang
 * cho một buổi học). Nên tạm kéo trang về đúng bề ngang A4, ĐỢI alphaTab khắc lại
 * bản nhạc theo khổ mới, chụp xong mới trả lại như cũ.
 */
async function withPaperWidth<T>(root: HTMLElement, run: () => Promise<T>): Promise<T> {
  if (root.getBoundingClientRect().width >= PAPER_PX - 20) return run()
  const saved = { width: root.style.width, maxWidth: root.style.maxWidth, bodyOv: document.body.style.overflowX }
  root.style.width = `${PAPER_PX}px`
  root.style.maxWidth = 'none'
  document.body.style.overflowX = 'hidden'
  try {
    // Chờ bản nhạc khắc lại: dừng khi chiều cao trang thôi thay đổi (tối đa ~6 giây).
    let last = -1, stable = 0
    for (let i = 0; i < 24 && stable < 2; i++) {
      await new Promise(r => setTimeout(r, 250))
      const h = root.scrollHeight
      stable = h === last ? stable + 1 : 0
      last = h
    }
    return await run()
  } finally {
    root.style.width = saved.width
    root.style.maxWidth = saved.maxWidth
    document.body.style.overflowX = saved.bodyOv
  }
}

export async function exportLessonPdf(root: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }, css] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
    bravuraCss(),
  ])

  await withPaperWidth(root, async () => {
  const rect = root.getBoundingClientRect()
  const pageHcss = (rect.width * BOX_H) / BOX_W        // một trang A4 cao bao nhiêu px trên màn
  const cuts = collectCuts(root, pageHcss)

  // Chụp MỘT lần cho cả tài liệu: html2canvas nhân bản cả trang mỗi lần gọi, gọi nhiều
  // lần (mỗi khối một lần) làm việc xuất kéo dài hàng phút.
  const scale = Math.min(2, MAX_EDGE / rect.height, MAX_EDGE / rect.width)
  const canvas = await html2canvas(root, {
    scale,
    backgroundColor: '#FFFFFF',
    useCORS: true,
    logging: false,
    onclone: (_d, cloned) => prepareClone(cloned as HTMLElement, css),
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageH = (canvas.width * BOX_H) / BOX_W         // chiều cao một trang, tính bằng px ảnh
  const slice = document.createElement('canvas')
  const ctx = slice.getContext('2d')!

  let y = 0, first = true
  while (y < canvas.height - 2) {
    const limit = y + pageH
    let end = 0
    for (const c of cuts) { const cp = c * scale; if (cp > y + 20 && cp <= limit) end = cp }
    if (!end) end = Math.min(limit, canvas.height)      // khối dài hơn cả trang thì đành cắt thẳng
    if (end >= canvas.height - 2) end = canvas.height

    slice.width = canvas.width
    slice.height = Math.round(end - y)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, Math.round(y), canvas.width, slice.height, 0, 0, canvas.width, slice.height)

    if (!first) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN,
      BOX_W, (BOX_W * slice.height) / canvas.width)
    first = false
    y = end
  }

  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(9)
    pdf.setTextColor(120)
    pdf.text(`${i} / ${pages}`, A4_W / 2, A4_H - 6, { align: 'center' })
  }
  pdf.save(fileName)
  })
}
