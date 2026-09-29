// ── /dieudemhat — trang công khai ĐIỆU ĐỆM HÁT (bản đang biên soạn) ──
//   /dieudemhat              → chọn điệu
//   /dieudemhat/<id>         → học từng bước (AppLesson)
//   /dieudemhat/<id>?view=sach → đọc liền (BookLesson)
// Chỉ ghép các component đã duyệt (DieuDemHat.tsx) + nguồn nội dung src/content/dieudemhat.
// KHÔNG hiển thị ghi chú biên soạn (`editorial`), không công cụ biên soạn, không Supabase.
import { useEffect } from 'react'
import { COLLECTION, STYLES } from '../content/dieudemhat'
import { AppLesson, BookLesson, StyleIndex } from './DieuDemHat'
import { C, DIEUDEMHAT_CSS } from './styles'

const BASE = '/dieudemhat'

export default function DieuDemHatPage({ path }: { path: string }) {
  const slug = path.replace(/^\/dieudemhat\/?/, '').replace(/\/$/, '')
  const st = STYLES.find((s) => s.id === slug)
  const book = new URLSearchParams(window.location.search).get('view') === 'sach'

  useEffect(() => {
    document.title = st ? `${st.name} — ${COLLECTION.title}` : COLLECTION.title
  }, [st])

  const status = <span className="ddh-status">Đang biên soạn</span>

  // Học từng bước: thanh mảnh phía trên (trạng thái + đọc liền), khung App chiếm phần còn lại.
  if (st && !book) {
    return (
      <div className="ddh-page ddh-page-app">
        <style>{DIEUDEMHAT_CSS + PAGE_CSS}</style>
        <div className="ddh-strip">{status}<a href={`${BASE}/${st.id}?view=sach`}>Đọc liền cả bài</a></div>
        <div className="ddh-page-frame"><AppLesson st={st} backHref={`${BASE}`} /></div>
      </div>
    )
  }

  return (
    <div className="ddh-page">
      <style>{DIEUDEMHAT_CSS + PAGE_CSS}</style>
      <div className="ddh-strip">
        {status}
        {st && <a href={`${BASE}/${st.id}`}>Học từng bước</a>}
        {st && <a href={BASE}>Tất cả điệu</a>}
      </div>
      {st ? <BookLesson st={st} />
        : slug ? <div className="ddh"><p style={{ paddingTop: 24 }}>Không tìm thấy điệu này. <a href={BASE}>Xem các điệu</a></p></div>
        : <StyleIndex title={COLLECTION.title} lead={COLLECTION.lead} styles={STYLES} hrefFor={(s) => `${BASE}/${s.id}`} />}
    </div>
  )
}

// Nền + màu cố định, không theo dark mode của CSS chung (index.css đổi màu h1/h2/code khi máy tối).
const PAGE_CSS = `
.ddh-page{width:100%;min-height:100dvh;background:${C.bg};color:${C.ink};color-scheme:light;text-align:left;}
.ddh-page-app{height:100dvh;display:flex;flex-direction:column;}
.ddh-page-frame{flex:1;min-height:0;display:flex;justify-content:center;}
.ddh-page-frame>.ddh-app{height:100%;width:100%;max-width:560px;}
.ddh-strip{flex:none;display:flex;align-items:center;gap:14px;padding:8px 16px;font-family:'Be Vietnam Pro',system-ui,sans-serif;font-size:13px;}
.ddh-page:not(.ddh-page-app)>.ddh-strip{max-width:720px;margin:0 auto;box-sizing:border-box;padding-top:14px;}
.ddh-strip a{color:${C.indigo};font-weight:600;text-decoration:none;}
.ddh-status{font-size:12px;font-weight:700;color:${C.honey};background:${C.honeyTint};border:1px solid #F1DDBE;border-radius:999px;padding:2px 10px;}
@media print{.ddh-strip{display:none;}}
`
