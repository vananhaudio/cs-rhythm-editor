// ── Tìm ảnh sheet bằng Google CSE ELEMENT (widget nhúng) — hiện kết quả NGAY TRONG APP ─
// Lưu ý lịch sử: Custom Search JSON API đã ĐÓNG với khách mới (403 dù đủ key+billing,
// xem memory project_strum_score). Widget cse.js thì vẫn free, không cần key/billing.
// cx là mã CÔNG KHAI của Programmable Search Engine (bật "toàn bộ web" + image search).
export const CSE_CX = '35dc10d3ccf47407c'

// Mở tab Google Hình ảnh (đường phụ)
export function googleImagesUrl(q: string): string {
  return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q + ' sheet hợp âm guitar')
}

// Nạp script cse.js một lần, trả về google.search.cse.element (API render/execute)
let pending: Promise<any> | null = null
export function loadCseElement(): Promise<any> {
  const w = window as any
  if (w.google?.search?.cse?.element) return Promise.resolve(w.google.search.cse.element)
  if (pending) return pending
  pending = new Promise((resolve) => {
    w.__gcse = { ...(w.__gcse || {}), parsetags: 'explicit', initializationCallback: () => resolve(w.google.search.cse.element) }
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://cse.google.com/cse.js?cx=' + CSE_CX
    document.head.appendChild(s)
  })
  return pending
}
