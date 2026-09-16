// ── LessonDocument — khuôn tài liệu học dùng chung cho CẢ 24 buổi SOLO-01 ──
// Nhận một LessonDoc (dữ liệu) → dựng trang giáo trình: web/app + in A4.
// Nhận diện Class: cream #F7F5FC, indigo #4338CA, Be Vietnam Pro (index.html đã nạp font).
// Section nào không có trong doc.sections thì đơn giản là không hiện.
import { useRef, useState } from 'react'
import type { LessonDoc, LessonSection } from './lessonTypes'
import { exportLessonPdf } from './lessonPdf'
import FretboardMap from './FretboardMap'
import ZoomFrame from './ZoomFrame'
import LessonScore from './LessonScore'

const P = {
  bg: '#F7F5FC', surface: '#FFFFFF', ink: '#1D1930', inkSoft: '#3E3952', inkFaint: '#6A6580',
  purple: '#4338CA', purpleDark: '#352BA3', purpleTint: '#EDEBFB',
  line: '#E4E0F0', honey: '#A85F0E', honeyTint: '#FBF3E6',
}

function Block({ label, title, children, sub }:
  { label?: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="lsn-block">
      <header className="lsn-block-h">
        {label && <span className="lsn-tag">{label}</span>}
        <h2>{title}</h2>
        {sub && <p className="lsn-sub">{sub}</p>}
      </header>
      {children}
    </section>
  )
}

function renderSection(s: LessonSection, i: number) {
  switch (s.kind) {
    case 'objectives':
      return (
        <section key={i} className="lsn-goals lsn-block">
          <h2>{s.title ?? 'Sau buổi này học viên làm được'}</h2>
          <ol>{s.items.map((t, k) => <li key={k}>{t}</li>)}</ol>
        </section>
      )

    case 'recap':
      return (
        <section key={i} className="lsn-recap lsn-block">
          <h2>{s.title}</h2>
          <div className="lsn-recap-grid">
            {s.steps.map((st, k) => (
              <div key={k} className="lsn-recap-step">
                <b>{st.label}</b>
                <ul>{st.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
          {s.message && <p className="lsn-recap-msg">{s.message}</p>}
        </section>
      )

    case 'layers':
      return (
        <Block key={i} label="Chồng lớp" title={s.title} sub={s.lead}>
          <div className="lsn-layers">
            {s.layers.map((ly, k) => (
              <div key={k} className={`lsn-layer${ly.current ? ' is-current' : ''}`}>
                <div className="lsn-layer-h">
                  <span className="lsn-layer-no">{ly.label}</span>
                  <b>{ly.what}</b>
                </div>
                <LessonScore tex={ly.tex} barsPerRow={2} zoomable={false} />
              </div>
            ))}
          </div>
          {s.note && <p className="lsn-legend">{s.note}</p>}
        </Block>
      )

    case 'note':
      return (
        <aside key={i} className="lsn-note lsn-block">
          {s.title && <strong>{s.title}</strong>}
          <p>{s.text}</p>
        </aside>
      )

    case 'fretboard':
      return (
        <Block key={i} label="Bản đồ" title={s.title} sub={s.lead}>
          <ZoomFrame hint="Vuốt ngang để xem hết cần đàn, hoặc bấm “Xem lớn”.">
            <FretboardMap frets={s.frets} zones={s.zones} dots={s.dots} />
          </ZoomFrame>
          <div className="lsn-zone-legend">
            {s.zones.map(z => (
              <div key={z.no} className="lsn-zone-item">
                <span className="lsn-zone-chip" style={{ background: z.color }} />
                <div>
                  <b>{z.label}</b>
                  {z.hint && <span> — {z.hint}</span>}
                </div>
              </div>
            ))}
          </div>
          {s.legend && <p className="lsn-legend">{s.legend.join('  ·  ')}</p>}
        </Block>
      )

    case 'score':
      return (
        <Block key={i} label={s.subtitle} title={s.title} sub={s.lead}>
          {s.tempo && <div className="lsn-tempo">{s.tempo}</div>}
          <LessonScore tex={s.tex} />
          {s.marks && s.marks.length > 0 && (
            <div className="lsn-marks">
              {s.marks.map((m, k) => (
                <span key={k} className="lsn-mark"><b>{m.at}</b> {m.text}</span>
              ))}
            </div>
          )}
          {s.guidance && <ul className="lsn-guide">{s.guidance.map((g, k) => <li key={k}>{g}</li>)}</ul>}
        </Block>
      )

    case 'repertoire':
      return (
        <Block key={i} label="Tác phẩm" title={s.title}>
          <div className="lsn-rep">
            <div className="lsn-rep-list">
              <b>Dự kiến:</b> {s.candidates.join(' · ')}
            </div>
            {s.pieces?.map((w, k) => (
              <div key={k} className="lsn-piece">
                <div className="lsn-piece-h">
                  <h3>{w.title}</h3>
                  {w.composer && <span className="lsn-piece-by">{w.composer}</span>}
                </div>
                {w.note && <p className="lsn-piece-note">{w.note}</p>}
                {w.tempo && <div className="lsn-tempo">{w.tempo}</div>}
                <LessonScore tex={w.tex} barsPerRow={w.barsPerRow ?? 4} />
                {w.marks && w.marks.length > 0 && (
                  <div className="lsn-marks">
                    {w.marks.map((mk, j) => <span key={j} className="lsn-mark"><b>{mk.at}</b> {mk.text}</span>)}
                  </div>
                )}
                {w.guidance && <ul className="lsn-guide">{w.guidance.map((g, j) => <li key={j}>{g}</li>)}</ul>}
              </div>
            ))}
            {s.status === 'pending' ? (
              <div className="lsn-pending">
                {s.pendingText ?? 'Tác phẩm Buổi 01 – chờ giáo viên cung cấp MusicXML/PDF/TAB.'}
              </div>
            ) : (
              <div className="lsn-assets">
                {s.assets?.map((a, k) => (
                  <a key={k} className="lsn-asset" href={a.href}>{a.label}</a>
                ))}
              </div>
            )}
            {s.annotationTypes && (
              <div className="lsn-annot">
                <b>Khi có bản nhạc, đánh dấu trực tiếp trên bản:</b>
                <div className="lsn-annot-chips">
                  {s.annotationTypes.map((t, k) => <span key={k}>{t}</span>)}
                </div>
              </div>
            )}
          </div>
        </Block>
      )

    case 'assignment':
      return (
        <Block key={i} title={s.title ?? 'Bài tập về nhà'}>
          <ul className="lsn-hw">
            {s.items.map((it, k) => (
              <li key={k}><b>{it.label}</b> {it.text}</li>
            ))}
          </ul>
          {s.message && <p className="lsn-msg">{s.message}</p>}
        </Block>
      )

    case 'checklist':
      return (
        <Block key={i} title={s.title ?? 'Checklist cuối bài'}>
          <ul className="lsn-check">
            {s.items.map((t, k) => <li key={k}><span className="lsn-box" />{t}</li>)}
          </ul>
        </Block>
      )

    case 'studentNotes':
      return (
        <Block key={i} title={s.title ?? 'Ghi chú / câu hỏi cho thầy'}>
          <div className="lsn-notes" style={{ minHeight: (s.lines ?? 7) * 30 }}>
            {Array.from({ length: s.lines ?? 7 }, (_, k) => <span key={k} />)}
          </div>
        </Block>
      )

    default:
      return null
  }
}

export default function LessonDocument({ doc }: { doc: LessonDoc }) {
  const m = doc.meta
  const paperRef = useRef<HTMLElement>(null)
  const [pdf, setPdf] = useState<'idle' | 'working' | 'error'>('idle')

  const fileName = `${m.programCode}-Buoi-${String(m.sessionNo).padStart(2, '0')}.pdf`

  const savePdf = async () => {
    if (!paperRef.current || pdf === 'working') return
    setPdf('working')
    try {
      await exportLessonPdf(paperRef.current, fileName)
      setPdf('idle')
    } catch {
      // Máy nào chặn tải file (app trong WebView) thì lùi về hộp thoại in của hệ thống.
      setPdf('error')
      window.print()
    }
  }

  return (
    <div className="lsn">
      <style>{CSS}</style>

      <div className="lsn-bar no-print">
        <a href={m.backHref ?? '/solo01'}>← {m.programName}</a>
        <button type="button" onClick={savePdf} disabled={pdf === 'working'}>
          {pdf === 'working' ? 'Đang tạo PDF…' : '⬇ Lưu PDF'}
        </button>
      </div>
      {pdf === 'error' && (
        <p className="lsn-pdf-note no-print">
          Máy này không tải được file. Trong cửa sổ in vừa mở, chọn <b>Lưu thành PDF</b>.
        </p>
      )}

      <article className="lsn-paper" ref={paperRef}>
        <header className="lsn-head">
          <div className="lsn-head-top">{m.programCode} · {m.programName}</div>
          <h1>BUỔI {String(m.sessionNo).padStart(2, '0')}</h1>
          <p className="lsn-head-title">{m.title}</p>
          {m.stageLabel && <p className="lsn-head-stage">{m.stageLabel}</p>}
        </header>

        {doc.sections.map(renderSection)}

        <footer className="lsn-foot">
          {m.programCode} · Buổi {String(m.sessionNo).padStart(2, '0')} — Thầy Văn Anh Guitar
        </footer>
      </article>
    </div>
  )
}

const CSS = `
.lsn{background:${P.bg};color:${P.ink};font-family:'Be Vietnam Pro',system-ui,sans-serif;
  line-height:1.6;font-size:16px;min-height:100vh;text-align:left;color-scheme:light;overflow-x:hidden;}
.lsn *{box-sizing:border-box;}
.lsn-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;
  gap:12px;padding:10px 16px;background:rgba(247,245,252,.94);backdrop-filter:blur(8px);
  border-bottom:1px solid ${P.line};}
.lsn-bar a{color:${P.purple};font-weight:600;text-decoration:none;font-size:14px;}
.lsn-bar button{border:1px solid ${P.purple};background:${P.purple};color:#fff;font-weight:600;
  font-size:14px;border-radius:10px;padding:8px 14px;cursor:pointer;font-family:inherit;}
.lsn-bar button:disabled{opacity:.65;cursor:progress;}
.lsn-pdf-note{max-width:900px;margin:10px auto 0;padding:10px 14px;font-size:13.5px;
  background:${P.honeyTint};border:1px solid #EFD9B3;border-radius:10px;color:#6B4A12;}

.lsn-paper{max-width:900px;margin:0 auto;padding:22px 16px 60px;}
/* trạng thái đang xuất PDF: ẩn mọi thứ chỉ dành cho màn hình */
.lsn-paper.is-printing .no-print{display:none !important;}

.lsn-head{background:${P.surface};border:1px solid ${P.line};border-radius:16px;padding:20px;
  margin-bottom:18px;border-top:4px solid ${P.purple};}
.lsn-head-top{font-size:12.5px;font-weight:700;letter-spacing:.09em;color:${P.purple};text-transform:uppercase;}
.lsn-head h1{margin:6px 0 2px;font-size:30px;font-weight:800;letter-spacing:.02em;}
.lsn-head-title{margin:0;font-size:18px;font-weight:600;color:${P.inkSoft};}
.lsn-head-stage{margin:8px 0 0;font-size:13px;color:${P.inkFaint};}

.lsn-block{background:${P.surface};border:1px solid ${P.line};border-radius:16px;padding:18px;margin:0 0 16px;}
.lsn-block-h{margin-bottom:12px;}
.lsn-tag{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:${P.purple};background:${P.purpleTint};border-radius:999px;padding:3px 10px;margin-bottom:6px;}
.lsn-block h2{margin:0;font-size:19px;font-weight:700;}
.lsn-sub{margin:6px 0 0;font-size:14.5px;color:${P.inkFaint};}

.lsn-goals{border-left:4px solid ${P.purple};}
.lsn-goals h2{margin:0 0 8px;font-size:17px;}
.lsn-goals ol{margin:0;padding-left:20px;}
.lsn-goals li{margin:3px 0;font-size:15px;}

.lsn-note{background:${P.honeyTint};border-color:#F0DFC2;}
.lsn-note strong{display:block;font-size:14px;color:${P.honey};margin-bottom:4px;}
.lsn-note p{margin:0;font-size:14.5px;color:${P.inkSoft};}

/* ── Sơ đồ cần đàn ── */
.lsn-fb{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.lsn-fb svg{min-width:620px;display:block;}
.lsn-fb.is-compact{max-width:430px;}
.lsn-fb.is-compact svg{min-width:0;}
.lsn-zoom-frame.is-big .lsn-fb.is-compact{max-width:none;}
.lsn-zone-legend{display:grid;gap:6px;margin-top:12px;}
.lsn-zone-item{display:flex;gap:9px;align-items:flex-start;font-size:14px;color:${P.inkSoft};}
.lsn-zone-chip{width:14px;height:14px;border-radius:4px;flex:none;margin-top:4px;}
.lsn-legend{margin:10px 0 0;font-size:13px;color:${P.inkFaint};}

/* ── Khung xem / phóng toàn màn hình ── */
.lsn-zoom-frame{position:relative;}
.lsn-zoom-btn{position:absolute;right:8px;top:8px;z-index:2;border:1px solid ${P.line};background:#fff;
  color:${P.purple};font-size:12.5px;font-weight:600;border-radius:8px;padding:5px 10px;cursor:pointer;
  font-family:inherit;box-shadow:0 1px 3px rgba(29,25,48,.08);}
.lsn-zoom-hint{margin:8px 0 0;font-size:12.5px;color:${P.inkFaint};}
.lsn-zoom-frame.is-big{position:fixed;inset:0;z-index:140;background:#fff;margin:0;
  padding:58px 12px 28px;overflow:auto;-webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;touch-action:pan-x pan-y;}
.lsn-zoom-tools{position:fixed;top:10px;right:12px;left:12px;z-index:2;display:flex;align-items:center;
  justify-content:flex-end;gap:8px;}
.lsn-zoom-tools button{border:1px solid ${P.line};background:#fff;color:${P.ink};font-family:inherit;
  font-size:17px;font-weight:700;width:38px;height:38px;border-radius:10px;cursor:pointer;line-height:1;}
.lsn-zoom-tools button:disabled{opacity:.4;cursor:default;}
.lsn-zoom-tools span{font-size:13px;font-weight:600;color:${P.inkFaint};min-width:46px;text-align:center;}
.lsn-zoom-tools .lsn-zoom-close{width:auto;padding:0 14px;font-size:14.5px;background:${P.purple};
  color:#fff;border-color:${P.purple};}
.lsn-zoom-rotate{position:fixed;left:12px;bottom:10px;margin:0;font-size:12.5px;color:${P.inkFaint};}
@media (orientation:landscape){.lsn-zoom-rotate{display:none;}}
.lsn-zoom-frame.is-big .lsn-zoom-btn{position:fixed;right:12px;top:12px;font-size:15px;padding:9px 16px;
  background:${P.purple};color:#fff;border-color:${P.purple};}
.lsn-zoom-frame.is-big .lsn-score,.lsn-zoom-frame.is-big .lsn-fb{border:none;max-width:none;overflow:visible;}
.lsn-zoom-frame.is-big .lsn-score-host{overflow:visible;}
.lsn-zoom-frame.is-big .lsn-score-host svg{max-width:none;}
/* Sơ đồ phóng bằng chính bề rộng của SVG (vector, vẫn nét) — KHÔNG dùng CSS zoom:
   zoom làm kẹt thao tác kéo trên máy cảm ứng và làm alphaTab đo sai bề ngang khung. */
.lsn-zoom-frame.is-big .lsn-fb svg{min-width:0 !important;max-width:none;
  width:calc(100% * var(--zoom,1.4));}

/* ── Bản nhạc ── */
.lsn-tempo{font-size:14px;font-weight:700;color:${P.purple};margin-bottom:8px;}
.lsn-score{position:relative;border:1px solid ${P.line};border-radius:12px;background:#fff;padding:6px 4px;}
.lsn-score-host{overflow-x:auto;}
.lsn-score-host svg{max-width:100%;height:auto;}
.lsn-score.is-big .lsn-score-host{overflow-x:auto;}
.lsn-score.is-big .lsn-score-host svg{max-width:none;transform:scale(1.5);transform-origin:top left;}
.lsn-score-msg{font-size:13.5px;color:${P.inkFaint};padding:10px;}
.lsn-score-msg.err{color:#B91C1C;}
.lsn-marks{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.lsn-mark{font-size:12.5px;color:${P.inkSoft};background:${P.purpleTint};border-radius:8px;padding:4px 9px;}
.lsn-mark b{color:${P.purple};}
.lsn-guide{margin:10px 0 0;padding-left:20px;font-size:14.5px;color:${P.inkSoft};}
.lsn-guide li{margin:3px 0;}

/* ── Ôn lại & chồng lớp ── */
.lsn-recap{border-left:4px solid ${P.honey};}
.lsn-recap h2{margin:0 0 12px;font-size:17px;}
.lsn-recap-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));}
.lsn-recap-step{background:${P.bg};border:1px solid ${P.line};border-radius:12px;padding:12px 14px;}
.lsn-recap-step b{display:block;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:${P.purple};margin-bottom:6px;}
.lsn-recap-step ul{margin:0;padding-left:18px;font-size:14.5px;color:${P.inkSoft};}
.lsn-recap-step li{margin:3px 0;}
.lsn-recap-msg{margin:12px 0 0;font-size:14.5px;font-weight:600;color:${P.honey};
  background:${P.honeyTint};border-radius:10px;padding:10px 12px;}
.lsn-layers{display:grid;gap:14px;}
.lsn-layer{border:1px solid ${P.line};border-radius:13px;padding:12px;background:#FCFBFE;break-inside:avoid;}
.lsn-layer.is-current{border-color:${P.purple};background:${P.purpleTint};}
.lsn-layer-h{display:flex;align-items:baseline;gap:9px;margin-bottom:8px;flex-wrap:wrap;}
.lsn-layer-no{font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  color:#fff;background:${P.purple};border-radius:999px;padding:3px 10px;}
.lsn-layer-h b{font-size:14.5px;}

/* ── Tác phẩm ── */
.lsn-rep-list{font-size:15px;}
.lsn-pending{margin-top:10px;border:1.5px dashed ${P.line};border-radius:12px;padding:22px 16px;
  text-align:center;font-size:14.5px;color:${P.inkFaint};background:#FBFAFE;}
.lsn-assets{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.lsn-asset{font-size:13.5px;font-weight:600;color:${P.purple};border:1px solid ${P.line};
  border-radius:9px;padding:6px 11px;text-decoration:none;}
.lsn-piece{margin-top:14px;padding-top:14px;border-top:1px solid ${P.line};break-inside:avoid;}
.lsn-piece:first-of-type{border-top:none;padding-top:4px;}
.lsn-piece-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.lsn-piece-h h3{margin:0;font-size:17px;font-weight:700;}
.lsn-piece-by{font-size:13.5px;color:${P.inkFaint};}
.lsn-piece-note{margin:4px 0 10px;font-size:14px;color:${P.inkSoft};}
.lsn-annot{margin-top:12px;font-size:13.5px;color:${P.inkSoft};}
.lsn-annot-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
.lsn-annot-chips span{font-size:12.5px;background:${P.purpleTint};color:${P.purpleDark};
  border-radius:999px;padding:3px 10px;}

/* ── Bài tập / checklist / ghi chú ── */
.lsn-hw{margin:0;padding-left:20px;font-size:15px;}
.lsn-hw li{margin:5px 0;}
.lsn-msg{margin:12px 0 0;font-size:14px;color:${P.honey};background:${P.honeyTint};
  border-radius:10px;padding:10px 12px;}
.lsn-check{list-style:none;margin:0;padding:0;font-size:15px;}
.lsn-check li{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed ${P.line};}
.lsn-check li:last-child{border-bottom:none;}
.lsn-box{width:17px;height:17px;border:1.6px solid ${P.purple};border-radius:5px;flex:none;}
.lsn-notes{display:grid;gap:29px;padding-top:12px;}
.lsn-notes span{display:block;border-bottom:1px solid ${P.line};}

.lsn-foot{text-align:center;font-size:12.5px;color:${P.inkFaint};padding-top:6px;}

@media (max-width:640px){
  .lsn-paper{padding:14px 10px 40px;}
  .lsn-bar a{font-size:13px;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lsn-fb{position:relative;}
  /* màn hẹp: nút "Xem lớn" đặt thành hàng riêng phía trên, không đè lên bản nhạc/sơ đồ */
  .lsn-zoom-frame:not(.is-big){display:flex;flex-direction:column-reverse;}
  .lsn-zoom-frame:not(.is-big) .lsn-zoom-btn{position:static;align-self:flex-end;margin:0 0 8px;
    font-size:13px;padding:7px 12px;}
  .lsn-zoom-frame:not(.is-big) .lsn-zoom-hint{margin:8px 0 0;}
  /* vệt mờ mép phải: báo cho biết sơ đồ còn nội dung bên ngoài màn hình */
  .lsn-zoom-frame:not(.is-big) .lsn-fb:after{content:'';position:absolute;top:0;right:0;bottom:0;width:26px;
    pointer-events:none;background:linear-gradient(90deg,rgba(255,255,255,0),#fff);}
  .lsn-head h1{font-size:25px;}
  .lsn-block{padding:14px 12px;}
  .lsn{font-size:15.5px;}
}

/* ── IN GIÁO TRÌNH A4 ── */
@media print{
  @page{size:A4 portrait;margin:14mm 12mm;}
  .no-print{display:none !important;}
  .lsn{background:#fff;font-size:11.5pt;}
  .lsn-paper{max-width:none;margin:0;padding:0;}
  .lsn-block,.lsn-head,.lsn-score,.lsn-fb{break-inside:avoid;page-break-inside:avoid;}
  .lsn-block{box-shadow:none;margin-bottom:10mm;border-color:#C9C4DA;}
  .lsn-head{border-top-width:3px;}
  .lsn-fb{overflow:visible;}
  .lsn-fb svg{min-width:0;width:100%;}
  .lsn-score-host{overflow:visible;}
  .lsn-score-host svg{max-width:100%;height:auto;}
  .lsn-notes{gap:34px;}
  .lsn-foot{position:running(footer);}
}
`
