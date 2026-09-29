// ── ĐIỆU ĐỆM HÁT — trình bày ──
// Một nguồn nội dung (src/content/dieudemhat) + một danh sách bước (pacing.ts) → hai presentation:
//   AppLesson  : từng bước một màn (quy tắc FlowPlayer: 100dvh, không cuộn, nút cố định cuối)
//   BookLesson : các bước nối tiếp như sách, điểm dừng thành ô thực hành, ngắt trang khi in
// Ký âm = StrumScore (StrumBeat — cùng bộ vẽ với màn gảy-theo). Không đọc `editorial`.
import { useState } from 'react'
import { StrumBeat } from '../elearn/StrumBeat'
import { SECTION_LABEL, type Pattern, type RhythmStyle, type StrumNotation } from '../content/dieudemhat'
import { buildSteps, patternNames, type LearningStep } from './pacing'

// ── Ô nhịp StrumScore (một ô, số phách phía trên) ──
export function StrumBar({ strum }: { strum: StrumNotation }) {
  const n = strum.beatsPerBar
  return (
    <div className="ddh-bar" role="img" aria-label="Ký âm tiết tấu">
      <div className="ddh-bar-nums" style={{ gridTemplateColumns: `repeat(${n},1fr)` }}>
        {Array.from({ length: n }, (_, j) => <span key={j}>{j + 1}</span>)}
      </div>
      <div className="ddh-bar-row">
        <div className="ddh-bar-line" />
        <div className="ddh-bar-beats" style={{ gridTemplateColumns: `repeat(${n},1fr)` }}>
          {strum.beats.map((b, j) => <StrumBeat key={j} strokes={b} lit={false} detail />)}
        </div>
        <div className="ddh-bar-line end" />
      </div>
    </div>
  )
}

// Chi tiết phụ của âm hình (ký hiệu, viết gọn, trường độ, độ dài) — Sách hiện đủ, App gói vào "Xem thêm".
function PatternDetails({ pattern, withSymbol }: { pattern: Pattern; withSymbol: boolean }) {
  return (
    <>
      {withSymbol && <div className="ddh-sym"><span className="ddh-sym-k">Ký hiệu</span><code>{pattern.guitar}</code></div>}
      {pattern.durations && <div className="ddh-sym"><span className="ddh-sym-k">Trường độ</span><code>{pattern.durations}</code></div>}
      {(pattern.legend || pattern.length) && <p className="ddh-small">{[pattern.legend, pattern.length].filter(Boolean).join(' · ')}</p>}
    </>
  )
}

function PatternHead({ pattern, option, intensity, label }: { pattern: Pattern; option?: string; intensity?: string; label?: string }) {
  return (
    <>
      {label && <p className="ddh-kicker">{label}{intensity ? ` — ${intensity}` : ''}</p>}
      <header className="ddh-pattern-h">
        {option && <span className="ddh-option">{option}</span>}
        <h3>{pattern.name}</h3>
        {pattern.tempo && <span className="ddh-tempo">{pattern.tempo}</span>}
      </header>
    </>
  )
}

// App: một màn = tên/mục tiêu + StrumScore + MỘT câu hướng dẫn. Chi tiết phụ vào "Xem thêm".
// Chưa có StrumScore (thiếu dữ liệu) → ký hiệu guitar là minh họa chính.
function PatternApp(props: { pattern: Pattern; option?: string; intensity?: string; label?: string }) {
  const { pattern } = props
  const hasMore = !!(pattern.strum || pattern.durations || pattern.legend || pattern.length)
  return (
    <article className="ddh-pattern">
      <PatternHead {...props} />
      {pattern.strum ? <StrumBar strum={pattern.strum} /> : <p className="ddh-sym-main"><code>{pattern.guitar}</code></p>}
      <p className="ddh-howto">{pattern.howTo}</p>
      {hasMore && (
        <details className="ddh-more">
          <summary>Xem thêm</summary>
          <PatternDetails pattern={pattern} withSymbol={!!pattern.strum} />
        </details>
      )}
    </article>
  )
}

// Sách: đủ chi tiết, đọc liền mạch.
function PatternBook(props: { pattern: Pattern; option?: string; intensity?: string; label?: string }) {
  const { pattern } = props
  return (
    <article className="ddh-pattern">
      <PatternHead {...props} />
      {pattern.strum && <StrumBar strum={pattern.strum} />}
      <PatternDetails pattern={pattern} withSymbol />
      <p className="ddh-howto">{pattern.howTo}</p>
    </article>
  )
}

function FlowDiagram({ st }: { st: RhythmStyle }) {
  return (
    <div className="ddh-flow">
      {st.sections.map((s, i) => (
        <div key={s.kind}>
          {i > 0 && <div className="ddh-flow-arrow" aria-hidden>↓</div>}
          <div className="ddh-flow-box"><b>{SECTION_LABEL[s.kind]}</b><span>{patternNames(s)}</span></div>
        </div>
      ))}
    </div>
  )
}

// Nội dung MỘT bước — dùng chung cho App và Sách.
type Medium = 'app' | 'book'
function StepBody({ st, step, medium }: { st: RhythmStyle; step: LearningStep; medium: Medium }) {
  switch (step.kind) {
    case 'overview':
      return (
        <div className="ddh-step">
          <p className="ddh-eyebrow">Điệu đệm hát · {st.meter}</p>
          <h2 className="ddh-title">{st.name}</h2>
          <p className="ddh-lead">{st.beatDivision}</p>
          {st.count && <p className="ddh-small">Đếm: <code>{st.count}</code></p>}
          {st.traits.length > 0 && <ul className="ddh-list">{st.traits.map((t, k) => <li key={k}>{t}</li>)}</ul>}
          <p className="ddh-kicker ddh-quick-k">Công thức cả bài</p>
          <ol className="ddh-quick">
            {st.sections.map((s) => <li key={s.kind}><b>{SECTION_LABEL[s.kind]}</b><span>{patternNames(s)}</span></li>)}
          </ol>
        </div>
      )
    case 'pattern': {
      const P = medium === 'app' ? PatternApp : PatternBook
      return (
        <div className="ddh-step">
          <P pattern={step.pattern} option={step.option} intensity={step.intensity} label={SECTION_LABEL[step.section.kind]} />
          {step.section.choiceNote && step.option === 'Lựa chọn 1' && <p className="ddh-choice">{step.section.choiceNote}</p>}
        </div>
      )
    }
    case 'practice':
      // App: một màn nhiệm vụ. Sách: box nhỏ gọn nối ngay sau âm hình.
      return medium === 'app' ? (
        <div className="ddh-step ddh-practice">
          <div className="ddh-practice-icon" aria-hidden>✋</div>
          <p className="ddh-practice-k">Thực hành · {step.pattern.name}</p>
          <p className="ddh-practice-task">{step.task}</p>
          <p className="ddh-practice-cue">{step.cue}</p>
        </div>
      ) : (
        <div className="ddh-practice-box">
          <p className="ddh-practice-box-k">Thực hành</p>
          <p className="ddh-practice-box-task">{step.task}</p>
          <p className="ddh-practice-box-cue">{step.cue}</p>
        </div>
      )
    case 'assemble': {
      const reuse = st.sections.filter((s) => s.reuseOf)
      return (
        <div className="ddh-step">
          <h2 className="ddh-h2">Ghép cả bài</h2>
          <FlowDiagram st={st} />
          {reuse.map((s) => <p key={s.kind} className="ddh-reuse">{SECTION_LABEL[s.kind]}: dùng lại cách đệm {SECTION_LABEL[s.reuseOf!]}.</p>)}
          <ul className="ddh-list">{st.practiceNotes.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )
    }
    case 'exercise':
      return (
        <div className="ddh-step">
          <h2 className="ddh-h2">Bài tập thực hành</h2>
          <div className="ddh-task">{step.text}</div>
          <p className="ddh-method">Nhìn âm hình → Đàn theo → Ghép vào bài.</p>
        </div>
      )
  }
}

// ── APP: từng bước một màn, tiến tuần tự ──
export function AppLesson({ st, backHref }: { st: RhythmStyle; backHref: string }) {
  const steps = buildSteps(st)
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1
  const next = step.kind === 'practice' ? 'Tôi đã tập xong →' : last ? 'Hoàn thành' : 'Tiếp →'
  return (
    <div className="ddh-app">
      <header className="ddh-app-top">
        <a href={backHref} className="ddh-app-back" aria-label="Quay lại">‹</a>
        <div className="ddh-app-name">{st.name}<span>{step.title}</span></div>
        <span className="ddh-app-count">{i + 1}/{steps.length}</span>
      </header>
      <div className="ddh-app-progress"><div style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
      <main className="ddh-app-body"><StepBody st={st} step={step} medium="app" /></main>
      <footer className="ddh-app-nav">
        <button type="button" className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>‹ Trước</button>
        <button type="button" disabled={last} onClick={() => setI(i + 1)}>{next}</button>
      </footer>
    </div>
  )
}

// ── SÁCH: các bước nối tiếp, điểm dừng thành ô thực hành ──
export function BookLesson({ st }: { st: RhythmStyle }) {
  const steps = buildSteps(st)
  let n = 0
  return (
    <div className="ddh ddh-book">
      {steps.map((step, k) => {
        const numbered = step.kind === 'pattern' ? ++n : null
        return (
          <section key={k} className={`ddh-book-sec ddh-book-${step.kind}`}>
            {numbered && <p className="ddh-book-step">Bước {numbered}</p>}
            <StepBody st={st} step={step} medium="book" />
          </section>
        )
      })}
    </div>
  )
}

export function StyleIndex({ title, lead, styles, hrefFor }:
  { title: string; lead: string; styles: RhythmStyle[]; hrefFor: (s: RhythmStyle) => string }) {
  return (
    <div className="ddh">
      <header className="ddh-hero">
        <p className="ddh-eyebrow">Giáo trình đệm hát</p>
        <h1>{title}</h1>
        <p className="ddh-lead">{lead}</p>
      </header>
      <div className="ddh-index">
        {styles.map((st) => (
          <a key={st.id} className="ddh-index-card" href={hrefFor(st)}>
            <div className="ddh-index-top"><span className="ddh-index-name">{st.name}</span><span className="ddh-meter">{st.meter}</span></div>
            <ol className="ddh-mini">
              {st.sections.map((s) => <li key={s.kind}><b>{SECTION_LABEL[s.kind]}</b><span>{patternNames(s)}</span></li>)}
            </ol>
            <span className="ddh-index-go">Học điệu này →</span>
          </a>
        ))}
      </div>
    </div>
  )
}
