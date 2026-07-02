// ── Tìm ảnh sheet qua Google Programmable Search (Custom Search JSON API) ──────
// Khoá đặt trong biến môi trường (KHÔNG hardcode): VITE_GOOGLE_CSE_KEY, VITE_GOOGLE_CSE_CX.
// Chưa cấu hình → cseConfigured=false, UI tự lùi về "mở tab Google Ảnh" + dán link.
// Hạn mức miễn phí: 100 lượt/ngày; vượt $5/1000 (đặt trần ở Google Cloud để khỏi cháy quota).
const KEY = import.meta.env.VITE_GOOGLE_CSE_KEY as string | undefined
const CX = import.meta.env.VITE_GOOGLE_CSE_CX as string | undefined

export const cseConfigured = !!(KEY && CX)

export interface ImgResult { url: string; thumb: string; title: string; w?: number; h?: number }

// Mở tab Google Hình ảnh (phương án lùi, không tốn quota)
export function googleImagesUrl(q: string): string {
  return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q + ' sheet hợp âm guitar')
}

export async function searchImages(q: string): Promise<ImgResult[]> {
  if (!cseConfigured) throw new Error('Chưa cấu hình tìm ảnh')
  const u = new URL('https://www.googleapis.com/customsearch/v1')
  u.searchParams.set('key', KEY!)
  u.searchParams.set('cx', CX!)
  u.searchParams.set('q', q + ' sheet hợp âm guitar')
  u.searchParams.set('searchType', 'image')
  u.searchParams.set('num', '10')
  u.searchParams.set('safe', 'active')
  const r = await fetch(u.toString())
  if (!r.ok) {
    if (r.status === 429) throw new Error('Hết lượt tìm miễn phí hôm nay (100/ngày). Thử lại mai hoặc dán link.')
    throw new Error('Google trả lỗi ' + r.status)
  }
  const d = await r.json()
  return (d.items || []).map((it: any): ImgResult => ({
    url: it.link,
    thumb: it.image?.thumbnailLink || it.link,
    title: it.title || '',
    w: it.image?.width, h: it.image?.height,
  }))
}
