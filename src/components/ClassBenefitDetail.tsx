/**
 * ClassBenefitDetail — chiều sâu của 6 quyền lợi trên trang /class.
 *
 * PORT NGUYÊN VĂN từ /azz (class2-site/src/components/*Showcase.tsx):
 *  - Kho bài giảng   ← LessonShowcase   (LESSON_LIBRARY)
 *  - Sách giáo trình ← SachShowcase     (SACH_SHOWCASE)
 *  - Hỏi đáp qua Zalo ← ZaloShowcase    (ZALO_SHOWCASE)
 *  - Cộng đồng        ← CommunityShowcase (COMMUNITY_SHOWCASE)
 *
 * Interaction giống /azz: overlay ngay trên landing (không đổi URL, không mất
 * vị trí cuộn), full-screen mobile / card giữa desktop, đóng bằng ✕ hoặc Escape,
 * khóa cuộn nền, focus quay lại nút mở. Nội dung đọc từ src/class-benefits.ts.
 *
 * (App luyện tập → scroll tới section #app có sẵn; Buổi thực hành → demo-page
 * video có sẵn — không nằm trong component này.)
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  BENEFIT_LESSON_LIBRARY,
  BENEFIT_SACH,
  BENEFIT_ZALO,
  BENEFIT_COMMUNITY,
} from '../class-benefits'

export type BenefitKey = 'bai-giang' | 'sach' | 'thay' | 'cong-dong'

interface Props {
  benefit: BenefitKey
  onClose: () => void
}

const WIDTH: Record<BenefitKey, number> = {
  'bai-giang': 1024,
  sach: 768,
  thay: 672,
  'cong-dong': 672,
}

const TITLE: Record<BenefitKey, string> = {
  'bai-giang': BENEFIT_LESSON_LIBRARY.title,
  sach: BENEFIT_SACH.title,
  thay: BENEFIT_ZALO.title,
  'cong-dong': BENEFIT_COMMUNITY.title,
}

export default function ClassBenefitDetail({ benefit, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const prevFocus = useRef<Element | null>(null)
  const [lessonPlaying, setLessonPlaying] = useState(false)
  const [sachIdx, setSachIdx] = useState(0)
  const sachRailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    prevFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus()
    }
  }, [onClose])

  const sachScrollTo = (i: number) => {
    const el = sachRailRef.current
    if (!el) return
    const card = el.querySelector('figure')
    const step = (card?.offsetWidth ?? 0) + 16
    el.scrollTo({ left: i * step, behavior: 'smooth' })
  }

  return (
    <div
      className="cbd-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={TITLE[benefit]}
    >
      <div className="cbd-card" style={{ maxWidth: WIDTH[benefit] }}>
        {/* Header */}
        <div className="cbd-head">
          <div className="cbd-head-text">
            <h2 className="cbd-title">{TITLE[benefit]}</h2>
            {benefit === 'bai-giang' && (
              <p className="cbd-stat">
                <span aria-hidden>▶</span>
                {BENEFIT_LESSON_LIBRARY.stat}
              </p>
            )}
            {benefit === 'sach' && (
              <p className="cbd-headline">{BENEFIT_SACH.headline}</p>
            )}
            {benefit === 'thay' && (
              <>
                <p className="cbd-headline">{BENEFIT_ZALO.headline}</p>
                <p className="cbd-desc">{BENEFIT_ZALO.desc}</p>
              </>
            )}
            {benefit === 'cong-dong' && (
              <>
                <p className="cbd-headline">{BENEFIT_COMMUNITY.headline}</p>
                <p className="cbd-desc">{BENEFIT_COMMUNITY.desc}</p>
              </>
            )}
            {benefit === 'bai-giang' && (
              <p className="cbd-desc">{BENEFIT_LESSON_LIBRARY.desc}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="cbd-close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Body — cuộn bên trong */}
        <div className="cbd-body">
          {benefit === 'bai-giang' && <LessonBody onPlay={() => setLessonPlaying(true)} playing={lessonPlaying} />}
          {benefit === 'sach' && (
            <SachBody
              railRef={sachRailRef}
              idx={sachIdx}
              setIdx={setSachIdx}
              scrollTo={sachScrollTo}
            />
          )}
          {benefit === 'thay' && <ZaloBody />}
          {benefit === 'cong-dong' && <CommunityBody />}
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  )
}

/* ─── Kho bài giảng ─── */
function LessonBody({ playing, onPlay }: { playing: boolean; onPlay: () => void }) {
  const c = BENEFIT_LESSON_LIBRARY
  return (
    <>
      {/* Phần 1 — quy mô kho */}
      <figure>
        <div className="cbd-browser">
          <div className="cbd-browser-bar">
            <span className="cbd-dot cbd-dot-red" aria-hidden />
            <span className="cbd-dot cbd-dot-amber" aria-hidden />
            <span className="cbd-dot" aria-hidden />
          </div>
          <img src={c.overview.image} alt={c.overview.alt} className="cbd-browser-img" />
        </div>
        <figcaption className="cbd-caption">{c.overview.caption}</figcaption>
      </figure>

      {/* Video xem thử — click-to-play, không autoplay */}
      <section className="cbd-sec" aria-label={c.video.heading}>
        <h3 className="cbd-h3">{c.video.heading}</h3>
        <p className="cbd-h3-sub">{c.video.desc}</p>
        <div className="cbd-video">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${c.video.id}?autoplay=1&rel=0`}
              title={c.video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="cbd-video-frame"
            />
          ) : (
            <button
              type="button"
              onClick={onPlay}
              className="cbd-video-poster"
              aria-label={`Phát video: ${c.video.title}`}
            >
              <img src={c.video.thumb} alt={c.video.title} className="cbd-video-img" />
              <span className="cbd-video-shade">
                <span className="cbd-play cbd-play-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Phần 2 — các kệ nội dung */}
      <div className="cbd-sec">
        {c.shelves.map((shelf) => (
          <section key={shelf.name} aria-label={shelf.name} className="cbd-shelf">
            <h3 className="cbd-shelf-name">{shelf.name}</h3>
            <div className="cbd-rail">
              {shelf.items.map((item) => (
                <figure key={item.label} className="cbd-card-mini">
                  <div className="cbd-card-mini-imgwrap">
                    <img src={item.image} alt="" loading="lazy" className="cbd-card-mini-img" />
                  </div>
                  <figcaption className="cbd-card-mini-cap">
                    <p className="cbd-card-mini-label">{item.label}</p>
                    <p className="cbd-card-mini-meta">{item.meta}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Phần 3 — chiều sâu */}
      <section className="cbd-depth">
        <div>
          <h3 className="cbd-h3 cbd-depth-h">{c.depth.line1}</h3>
          <p className="cbd-depth-p">{c.depth.line2}</p>
        </div>
        <figure className="cbd-depth-fig">
          <img src={c.depth.image} alt={c.depth.alt} loading="lazy" className="cbd-depth-img" />
        </figure>
      </section>
    </>
  )
}

/* ─── Sách giáo trình ─── */
function SachBody({
  railRef,
  idx,
  setIdx,
  scrollTo,
}: {
  railRef: RefObject<HTMLDivElement | null>
  idx: number
  setIdx: (i: number) => void
  scrollTo: (i: number) => void
}) {
  const c = BENEFIT_SACH
  // Video giới thiệu sách: chỉ hiện khi có video thật — hiện chưa có → không placeholder.
  return (
    <>
      <div
        ref={railRef}
        onScroll={() => {
          const el = railRef.current
          if (!el) return
          const card = el.querySelector('figure')
          const step = (card?.offsetWidth ?? 0) + 16
          setIdx(Math.min(Math.max(Math.round(el.scrollLeft / step), 0), c.images.length - 1))
        }}
        className="cbd-carousel"
      >
        {c.images.map((img) => (
          <figure key={img.src} className="cbd-carousel-card">
            <img src={img.src} alt={img.alt} loading="lazy" className="cbd-carousel-img" />
          </figure>
        ))}
      </div>

      {/* Dots điều hướng */}
      <div className="cbd-dots" aria-hidden>
        {c.images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Xem ảnh ${i + 1}`}
            className={'cbd-dot-btn' + (i === idx ? ' cbd-dot-btn-on' : '')}
          />
        ))}
      </div>

      {/* Câu chốt */}
      <p className="cbd-closer-text">{c.closer}</p>
    </>
  )
}

/* ─── Hỏi đáp cùng Thầy qua Zalo ─── */
function ZaloBody() {
  const c = BENEFIT_ZALO
  return (
    <>
      {/* Phần 1 — tình huống hỏi đáp (minh họa) */}
      <section>
        <h3 className="cbd-h3">{c.chat.heading}</h3>
        <div className="cbd-chat">
          <div className="cbd-bubble-row">
            <div className="cbd-bubble cbd-bubble-student">
              <p className="cbd-bubble-who">Học viên</p>
              {c.chat.student}
            </div>
          </div>
          <div className="cbd-bubble-row cbd-bubble-row-right">
            <div className="cbd-bubble cbd-bubble-teacher">
              <p className="cbd-bubble-who cbd-bubble-who-teacher">Thầy Văn Anh</p>
              {c.chat.teacher}
            </div>
          </div>
        </div>
        <div className="cbd-helpbox">
          <p className="cbd-helpbox-intro">{c.chat.helpIntro}</p>
          <ul className="cbd-chips">
            {c.chat.helps.map((h) => (
              <li key={h} className="cbd-chip">{h}</li>
            ))}
          </ul>
        </div>
        <p className="cbd-caption">{c.chat.label}</p>
      </section>

      {/* Phần 2 — hỏi để biết làm gì tiếp theo */}
      <section className="cbd-sec cbd-zalo-depth">
        <div>
          <h3 className="cbd-h3">{c.depth.heading}</h3>
          <p className="cbd-h3-sub">{c.depth.body}</p>
        </div>
        <figure className="cbd-zalo-depth-fig">
          <img src={c.depth.image} alt={c.depth.alt} loading="lazy" className="cbd-zalo-depth-img" />
        </figure>
      </section>

      {/* Phần 3 — có thể hỏi gì */}
      <section className="cbd-sec">
        <h3 className="cbd-h3">{c.questions.heading}</h3>
        <ul className="cbd-qlist">
          {c.questions.items.map((q) => (
            <li key={q} className="cbd-qitem">
              <span className="cbd-qico" aria-hidden>💬</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Câu chốt */}
      <div className="cbd-closer">
        <p className="cbd-closer-big">{c.closer}</p>
        <p className="cbd-closer-tag">{c.closerTag}</p>
      </div>
    </>
  )
}

/* ─── Cộng đồng học viên ─── */
function CommunityBody() {
  const c = BENEFIT_COMMUNITY
  return (
    <>
      {/* Phần 1 — cộng đồng thật: 1 ảnh lớn + gallery ngắn */}
      <figure className="cbd-comm-hero">
        <img src={c.hero.src} alt={c.hero.alt} className="cbd-comm-hero-img" />
      </figure>
      <p className="cbd-caption">{c.hero.caption}</p>

      <div className="cbd-comm-gallery">
        {c.gallery.map((g, i) => (
          <figure
            key={g.src}
            className={'cbd-comm-g-item' + (i === c.gallery.length - 1 && c.gallery.length % 2 === 1 ? ' cbd-comm-g-wide' : '')}
          >
            <img src={g.src} alt={g.alt} loading="lazy" className="cbd-comm-g-img" />
          </figure>
        ))}
      </div>

      {/* Phần 2 — không chỉ học: 3 ý nhẹ */}
      <section className="cbd-sec">
        <h3 className="cbd-h3">{c.together.heading}</h3>
        <div className="cbd-comm-grid">
          {c.together.items.map((item) => (
            <div key={item.name}>
              <p className="cbd-comm-name">{item.name}</p>
              <p className="cbd-comm-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Câu chốt */}
      <div className="cbd-closer">
        <p className="cbd-closer-big">{c.closer}</p>
        <p className="cbd-closer-tag">{c.closerTag}</p>
      </div>
    </>
  )
}

/* ─── Style scoped — dùng đúng design token của .tva-class ─── */
const CSS = `
.tva-class .cbd-overlay{position:fixed;inset:0;z-index:120;background:rgba(33,28,50,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:0;}
@media(min-width:768px){.tva-class .cbd-overlay{padding:24px;}}
.tva-class .cbd-card{background:var(--surface);width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px -20px rgba(0,0,0,.45);}
@media(min-width:768px){.tva-class .cbd-card{height:auto;max-height:92vh;border-radius:16px;}}
.tva-class .cbd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid var(--line);}
@media(min-width:768px){.tva-class .cbd-head{padding:20px 28px;}}
.tva-class .cbd-head-text{min-width:0;}
.tva-class .cbd-title{font-size:20px;font-weight:800;letter-spacing:-.3px;color:var(--ink);margin:0;}
.tva-class .cbd-stat{display:inline-flex;align-items:center;gap:6px;margin:8px 0 0;background:var(--indigo-tint);color:var(--indigo);border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:700;}
.tva-class .cbd-headline{margin:6px 0 0;font-size:15px;font-weight:600;color:var(--ink);}
.tva-class .cbd-desc{margin:6px 0 0;font-size:13px;line-height:1.6;color:var(--ink-soft);max-width:560px;}
.tva-class .cbd-close{flex-shrink:0;width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;box-shadow:0 1px 3px rgba(33,28,50,.08);}
.tva-class .cbd-close:hover{color:var(--ink);}
.tva-class .cbd-body{flex:1;overflow-y:auto;padding:20px;}
@media(min-width:768px){.tva-class .cbd-body{padding:24px 28px 28px;}}
.tva-class .cbd-browser{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 1px 3px rgba(33,28,50,.06);}
.tva-class .cbd-browser-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--paper-deep);}
.tva-class .cbd-dot{width:10px;height:10px;border-radius:999px;background:var(--indigo);}
.tva-class .cbd-dot-red{background:#E5484D;}
.tva-class .cbd-dot-amber{background:rgba(201,113,30,.45);}
.tva-class .cbd-browser-img{width:100%;display:block;}
.tva-class .cbd-caption{margin:8px auto 0;text-align:center;font-size:11.5px;color:var(--ink-soft);opacity:.8;}
.tva-class .cbd-sec{margin-top:26px;}
.tva-class .cbd-h3{font-size:17px;font-weight:800;letter-spacing:-.2px;color:var(--ink);margin:0;}
.tva-class .cbd-h3-sub{margin:4px 0 0;font-size:13.5px;line-height:1.6;color:var(--ink-soft);}
.tva-class .cbd-video{margin-top:12px;aspect-ratio:16/9;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#1B1826;box-shadow:0 1px 3px rgba(33,28,50,.06);}
.tva-class .cbd-video-frame{width:100%;height:100%;border:none;display:block;}
.tva-class .cbd-video-poster{position:relative;display:block;width:100%;height:100%;padding:0;border:none;cursor:pointer;font-family:inherit;background:#1B1826;}
.tva-class .cbd-video-img{width:100%;height:100%;object-fit:cover;display:block;}
.tva-class .cbd-video-shade{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(33,28,50,.2);transition:background .15s;}
.tva-class .cbd-video-poster:hover .cbd-video-shade{background:rgba(33,28,50,.35);}
.tva-class .cbd-play{display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.95);color:var(--indigo);box-shadow:0 10px 30px -8px rgba(33,28,50,.5);transition:transform .15s;}
.tva-class .cbd-play-lg{width:56px;height:56px;}
.tva-class .cbd-video-poster:hover .cbd-play{transform:scale(1.06);}
.tva-class .cbd-shelf{margin-top:24px;}
.tva-class .cbd-shelf-name{font-size:12.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey);margin:0 0 10px;}
.tva-class .cbd-rail{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory;scrollbar-width:none;}
.tva-class .cbd-rail::-webkit-scrollbar{display:none;}
.tva-class .cbd-card-mini{flex-shrink:0;width:160px;scroll-snap-align:start;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:8px;box-shadow:0 1px 3px rgba(33,28,50,.05);margin:0;}
.tva-class .cbd-card-mini-imgwrap{overflow:hidden;border-radius:9px;border:1px solid var(--line);}
.tva-class .cbd-card-mini-img{width:100%;aspect-ratio:16/9;object-fit:cover;object-position:top;display:block;}
.tva-class .cbd-card-mini-cap{padding:7px 2px 1px;}
.tva-class .cbd-card-mini-label{font-size:12.5px;font-weight:600;line-height:1.35;color:var(--ink);margin:0;}
.tva-class .cbd-card-mini-meta{margin:3px 0 0;font-size:11.5px;color:var(--ink-soft);opacity:.85;}
.tva-class .cbd-depth{margin-top:30px;display:grid;gap:18px;align-items:center;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:20px;}
@media(min-width:768px){.tva-class .cbd-depth{grid-template-columns:1fr 1fr;padding:24px;gap:24px;}}
.tva-class .cbd-depth-h{font-size:19px;line-height:1.3;}
.tva-class .cbd-depth-p{margin:8px 0 0;font-size:14px;line-height:1.65;color:var(--ink-soft);}
.tva-class .cbd-depth-fig{margin:0;overflow:hidden;border-radius:11px;border:1px solid var(--line);}
.tva-class .cbd-depth-img{width:100%;display:block;}
.tva-class .cbd-carousel{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory;scrollbar-width:none;}
.tva-class .cbd-carousel::-webkit-scrollbar{display:none;}
.tva-class .cbd-carousel-card{flex-shrink:0;width:256px;scroll-snap-align:center;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:8px;box-shadow:0 1px 3px rgba(33,28,50,.05);margin:0;}
@media(min-width:768px){.tva-class .cbd-carousel-card{width:288px;}}
.tva-class .cbd-carousel-img{width:100%;height:340px;object-fit:cover;object-position:top;border-radius:11px;display:block;}
@media(min-width:768px){.tva-class .cbd-carousel-img{height:400px;}}
.tva-class .cbd-dots{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
.tva-class .cbd-dot-btn{height:8px;border-radius:999px;border:none;background:rgba(33,28,50,.22);padding:0;cursor:pointer;transition:all .2s;width:8px;}
.tva-class .cbd-dot-btn:hover{background:rgba(33,28,50,.4);}
.tva-class .cbd-dot-btn-on{width:24px;background:var(--indigo);}
.tva-class .cbd-closer-text{margin:26px auto 2px;max-width:440px;text-align:center;font-size:15px;font-weight:600;line-height:1.6;color:var(--ink);}
.tva-class .cbd-chat{margin-top:14px;display:flex;flex-direction:column;gap:12px;}
.tva-class .cbd-bubble-row{display:flex;justify-content:flex-start;}
.tva-class .cbd-bubble-row-right{justify-content:flex-end;}
.tva-class .cbd-bubble{max-width:85%;border-radius:14px;padding:12px 16px;font-size:14px;line-height:1.6;color:var(--ink);}
.tva-class .cbd-bubble-student{background:var(--surface);border:1px solid var(--line);border-top-left-radius:4px;}
.tva-class .cbd-bubble-teacher{background:var(--indigo);color:#fff;border-top-right-radius:4px;}
.tva-class .cbd-bubble-who{margin:0 0 3px;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--ink-soft);opacity:.75;}
.tva-class .cbd-bubble-who-teacher{color:rgba(255,255,255,.75);}
.tva-class .cbd-helpbox{margin-top:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:14px 16px;}
.tva-class .cbd-helpbox-intro{margin:0;font-size:13px;font-weight:600;color:var(--ink-soft);}
.tva-class .cbd-chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0;padding:0;list-style:none;}
.tva-class .cbd-chip{background:var(--indigo-tint);color:var(--indigo);border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:600;}
.tva-class .cbd-zalo-depth{display:grid;gap:18px;align-items:center;}
@media(min-width:768px){.tva-class .cbd-zalo-depth{grid-template-columns:1fr auto;gap:26px;}}
.tva-class .cbd-zalo-depth-fig{margin:0 auto;overflow:hidden;border-radius:14px;border:1px solid var(--line);box-shadow:0 1px 3px rgba(33,28,50,.06);}
.tva-class .cbd-zalo-depth-img{height:220px;width:auto;max-width:100%;object-fit:cover;object-position:top;display:block;}
@media(min-width:768px){.tva-class .cbd-zalo-depth-img{height:250px;}}
.tva-class .cbd-qlist{margin:14px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;}
.tva-class .cbd-qitem{display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.5;color:var(--ink-soft);}
.tva-class .cbd-qico{flex-shrink:0;margin-top:1px;color:var(--indigo);}
.tva-class .cbd-closer{margin-top:28px;background:var(--indigo);border-radius:14px;padding:22px 20px;text-align:center;}
.tva-class .cbd-closer-big{margin:0;font-size:17px;font-weight:700;line-height:1.55;color:#fff;}
.tva-class .cbd-closer-tag{margin:8px 0 0;font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.75);}
.tva-class .cbd-comm-hero{margin:0;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:var(--paper-deep);box-shadow:0 1px 3px rgba(33,28,50,.06);}
.tva-class .cbd-comm-hero-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}
.tva-class .cbd-comm-gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
@media(min-width:768px){.tva-class .cbd-comm-gallery{grid-template-columns:repeat(3,1fr);}}
.tva-class .cbd-comm-g-item{margin:0;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:var(--paper-deep);box-shadow:0 1px 3px rgba(33,28,50,.06);}
.tva-class .cbd-comm-g-wide{grid-column:span 2;}
@media(min-width:768px){.tva-class .cbd-comm-g-wide{grid-column:auto;}}
.tva-class .cbd-comm-g-img{width:100%;height:100%;aspect-ratio:16/9;object-fit:cover;display:block;}
.tva-class .cbd-comm-grid{display:grid;gap:18px;margin-top:14px;}
@media(min-width:768px){.tva-class .cbd-comm-grid{grid-template-columns:repeat(3,1fr);gap:26px;}}
.tva-class .cbd-comm-name{margin:0;font-size:14px;font-weight:700;color:var(--ink);}
.tva-class .cbd-comm-desc{margin:5px 0 0;font-size:13px;line-height:1.6;color:var(--ink-soft);}
`
