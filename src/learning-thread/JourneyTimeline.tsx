// HÀNH TRÌNH ÂM NHẠC — timeline các Learning Thread gom theo CHẶNG (lớp/Tự học × khoá) theo DANH TÍNH LỊCH SỬ.
// Màu chặng xác định theo môn (TRACK_THEMES, cùng bộ màu App học). Mỗi mốc = tóm tắt ngắn; bấm → /me/t/<id>.
// Component lá (không CSS import, không mạng) — test render được.
import { lessonLine, moduleLabel, SOCIAL_STATUS_LABEL, STATUS_UI, VISIBILITY_LABEL } from './ltModel'
import { eventSteps, groupJourney, type JourneyItem } from './feedModel'
import UiIcon from '../class-social/UiIcon'

export default function JourneyTimeline({ items, ownerName, onOpenThread }: {
  items: JourneyItem[]
  ownerName: string
  onOpenThread?: (threadId: string) => void
}) {
  const phases = groupJourney(items)
  if (phases.length === 0) {
    return (
      <div className="lt-journey-empty" role="status">
        <b>Chưa có dấu mốc học tập.</b>
        <span>Những lần Trả bài, Hỏi bài của {ownerName} sẽ dần tạo nên Hành trình tại đây.</span>
      </div>
    )
  }
  return (
    <section className="lt-journey" aria-label={`Hành trình âm nhạc của ${ownerName}`}>
      <h2 className="lt-journey-title">Hành trình âm nhạc của {ownerName}</h2>
      <ol className="lt-journey-phases">
        {phases.map((ph, i) => {
          const showYear = i === 0 || phases[i - 1].year !== ph.year
          return (
            <li key={ph.key} className="lt-phase" style={{ ['--lt-phase-from' as string]: ph.theme.from, ['--lt-phase-to' as string]: ph.theme.to }}>
              {showYear && <div className="lt-year">{ph.year}</div>}
              <div className="lt-phase-head">
                <span className="lt-phase-dot" aria-hidden="true" />
                <div className="lt-phase-text">
                  <span className="lt-phase-title">{ph.title}</span>
                  <span className="lt-phase-sub">{[ph.theme.label, ph.subtitle].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
              <ol className="lt-milestones">
                {ph.items.map(it => {
                  const steps = eventSteps(it.events)
                  const st = STATUS_UI[it.status]
                  const module = moduleLabel(it.identity.module.name)
                  const body = (
                    <>
                      <span className="lt-ms-lesson">{it.identity.lesson.title}</span>
                      {module && <span className="lt-ms-module">{module}</span>}
                      <span className="lt-ms-steps">{steps.map((s, i) => <span key={i} className="lt-ms-step"><UiIcon emoji={s.icon} size={14} /> {s.label}{s.times ? <span className="lt-ms-times" aria-label={`${s.times} lần`}> ×{s.times}</span> : null}</span>)}</span>
                      <span className="lt-ms-meta">
                        <span className={'lt-chip is-' + st.tone}>{SOCIAL_STATUS_LABEL[it.status]}</span>
                        {it.visibility === 'private' && <span className="lt-badge">{VISIBILITY_LABEL.private}</span>}
                        {it.isHidden && <span className="lt-badge">Đang ẩn</span>}
                      </span>
                    </>
                  )
                  return (
                    <li key={it.id} className="lt-milestone">
                      {onOpenThread
                        ? <button type="button" className="lt-ms-btn" onClick={() => onOpenThread(it.id)} aria-label={`Mở: ${lessonLine(it.identity)}`}>{body}</button>
                        : <div className="lt-ms-btn">{body}</div>}
                    </li>
                  )
                })}
              </ol>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
