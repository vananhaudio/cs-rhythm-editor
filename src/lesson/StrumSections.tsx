// ── Khối giáo trình "strum" + "flow": dùng lại bộ vẽ của /dieudemhat (StrumBar, ddh-flow), chỉ chỉnh khoảng cách cho hợp .lsn-block ──
import type { LessonSection } from './lessonTypes'
import { StrumBar } from '../dieudemhat/DieuDemHat'
import { DIEUDEMHAT_CSS } from '../dieudemhat/styles'

const LOCAL_CSS = `
.ddh.ddh-in-lsn{max-width:none;padding:0;font-size:inherit;}
.ddh-in-lsn .ddh-pattern-h{margin-bottom:12px;}
.ddh-in-lsn .ddh-howto{font-size:16px;}
.ddh-in-lsn .ddh-flow-box{grid-template-columns:96px 1fr;}
.ddh-in-lsn .ddh-flow-arrow{margin:2px 0;}
@media print{.ddh-in-lsn .ddh-bar{break-inside:avoid;}}
`

export function StrumSectionBlock({ s }: { s: Extract<LessonSection, { kind: 'strum' }> }) {
  return (
    <section className="lsn-block">
      <style>{DIEUDEMHAT_CSS + LOCAL_CSS}</style>
      <div className="ddh ddh-in-lsn">
        <header className="ddh-pattern-h">
          {s.label && <span className="ddh-option">{s.label}</span>}
          <h3>{s.name}</h3>
          {s.tempo && <span className="ddh-tempo">{s.tempo}</span>}
        </header>
        <StrumBar strum={s.strum} />
        <div className="ddh-sym"><span className="ddh-sym-k">Ký hiệu</span><code>{s.guitar}</code></div>
        {s.durations && <div className="ddh-sym"><span className="ddh-sym-k">Trường độ</span><code>{s.durations}</code></div>}
        {s.legend && <p className="ddh-small">{s.legend}</p>}
        <p className="ddh-howto">{s.howTo}</p>
      </div>
    </section>
  )
}

export function FlowSectionBlock({ s }: { s: Extract<LessonSection, { kind: 'flow' }> }) {
  return (
    <section className="lsn-block">
      <style>{DIEUDEMHAT_CSS + LOCAL_CSS}</style>
      <header className="lsn-block-h"><h2>{s.title}</h2>{s.lead && <p className="lsn-sub">{s.lead}</p>}</header>
      <div className="ddh ddh-in-lsn">
        <div className="ddh-flow">
          {s.steps.map((st, i) => (
            <div key={i}>
              {i > 0 && <div className="ddh-flow-arrow" aria-hidden>↓</div>}
              <div className="ddh-flow-box"><b>{st.label}</b><span>{st.value}</span></div>
            </div>
          ))}
        </div>
        {s.note && <p className="ddh-reuse">{s.note}</p>}
      </div>
    </section>
  )
}
