/**
 * ClassPracticeSchedule — section "Lịch thực hành thành viên" trên /class.
 *
 * PORT từ class2-site/src/components/SectionPractice.tsx (/azz) — cùng nguồn
 * dữ liệu thật từ Admin (class_schedule + class_sessions, cờ
 * show_on_practice_schedule = true). KHÔNG hardcode thứ/giờ/tên nhóm.
 *
 * - Lịch tuần compact: 1 card cho mỗi thứ có nhóm (ngày không có lịch → không
 *   render card rỗng; ngày nhiều nhóm → nhiều dòng).
 * - "Các buổi sắp tới" mặc định ĐÓNG (progressive disclosure), mở inline tối
 *   đa 6 buổi thật — không reload, không đổi route.
 * - Đây là section RIÊNG, tách khỏi lịch lớp tuyển sinh (/class giữ nguyên).
 */
import { useState } from 'react'
import {
  usePractice,
  stageInfo,
  WEEKDAY_LABEL,
  timeRange,
  fmtSessionDay,
  fmtSessionTime,
  publicTitle,
  type PracticeGroup,
  type PracticeSession,
} from '../lib/classPractice'

const COPY = {
  kicker: 'Lịch thực hành thành viên',
  title: 'Mỗi tuần đều có nơi để bạn thực hành.',
  sub: 'Bạn học đến đâu, tham gia nhóm phù hợp đến đó.',
  note: 'Các nhóm thực hành dành cho thành viên Hành trình.',
  emptyTitle: 'Lịch thực hành đang được cập nhật',
  emptySub: 'Thầy đang sắp xếp lịch cho các nhóm thực hành. Bạn quay lại sau nhé — hoặc hỏi trợ lý Mira bên dưới để biết thêm.',
  upcomingTitle: 'Các buổi sắp tới',
}

export default function ClassPracticeSchedule() {
  const { loading, error, data, reload } = usePractice()
  const [showUpcoming, setShowUpcoming] = useState(false)  // mặc định ĐÓNG

  return (
    <section id="thuchanh" className="band cps-sec">
      <div className="wrap">
        <div className="eyebrow">{COPY.kicker}</div>
        <h2>{COPY.title}</h2>
        <p className="lead">{COPY.sub}</p>
        <p className="cps-note">{COPY.note}</p>

        {loading && (
          <div className="cps-state">Đang tải lịch thực hành…</div>
        )}

        {!loading && error && (
          <div className="cps-state">
            <div>Không tải được lịch thực hành ({error}).</div>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={reload}>Thử lại</button>
          </div>
        )}

        {!loading && !error && data && data.groups.length === 0 && (
          <div className="cps-state">
            <div style={{ fontSize: 30 }}>🎸</div>
            <h3 style={{ margin: '8px 0 6px', fontSize: 18, fontWeight: 800 }}>{COPY.emptyTitle}</h3>
            <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, maxWidth: 460 }}>{COPY.emptySub}</p>
          </div>
        )}

        {!loading && !error && data && data.groups.length > 0 && (
          <ScheduleGrid
            groups={data.groups}
            sessions={data.sessions}
            showUpcoming={showUpcoming}
            onToggleUpcoming={() => setShowUpcoming(v => !v)}
          />
        )}
      </div>
      <style>{CSS}</style>
    </section>
  )
}

/** Lưới lịch tuần: 1 card cho mỗi thứ có nhóm + "Các buổi sắp tới" (mặc định đóng). */
function ScheduleGrid({ groups, sessions, showUpcoming, onToggleUpcoming }: {
  groups: PracticeGroup[]
  sessions: PracticeSession[]
  showUpcoming: boolean
  onToggleUpcoming: () => void
}) {
  // Gom theo thứ trong tuần (độc lập với bậc — thứ nào có nhóm thì hiện thứ đó)
  const byWeekday = new Map<number, PracticeGroup[]>()
  for (const g of groups) {
    if (g.weekday === null || g.weekday === undefined) continue
    const arr = byWeekday.get(g.weekday) ?? []
    arr.push(g)
    byWeekday.set(g.weekday, arr)
  }
  const weekdays = Array.from(byWeekday.keys()).sort((a, b) => a - b)

  // Buổi sắp tới: bỏ buổi nghỉ/đã huỷ, tối đa 6 buổi gần nhất
  const upcoming = sessions
    .filter(s => s.event_type !== 'break' && s.status !== 'cancelled' && s.status !== 'holiday')
    .slice(0, 6)
  const groupOf = (id: string) => groups.find(x => x.id === id)

  return (
    <div className="cps-grid-wrap">
      {/* Lịch tuần */}
      <div className="cps-week">
        {weekdays.map(wd => (
          <div className="cps-day" key={wd}>
            <div className="cps-day-head">{WEEKDAY_LABEL[wd]}</div>
            <div className="cps-day-body">
              {(byWeekday.get(wd) ?? []).map(g => {
                const st = stageInfo(g.stage)
                return (
                  <div className="cps-group" key={g.id}>
                    {st && (
                      <span className="cps-badge" style={{ color: st.color, background: st.soft }}>{st.l}</span>
                    )}
                    <div className="cps-group-name">{publicTitle(g)}</div>
                    <div className="cps-group-time">
                      {timeRange(g.start_time, g.duration_minutes)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Các buổi sắp tới — mặc định ĐÓNG, bấm mới mở */}
      {upcoming.length > 0 && (
        <div className="cps-upcoming">
          <button
            type="button"
            className="cps-up-toggle"
            onClick={onToggleUpcoming}
            aria-expanded={showUpcoming}
          >
            {showUpcoming ? 'Thu gọn ↑' : 'Xem các buổi sắp tới ↓'}
            {!showUpcoming && <span className="cps-up-count">{upcoming.length}</span>}
          </button>

          {showUpcoming && (
            <div className="cps-up-list">
              <h3 className="cps-up-title">{COPY.upcomingTitle}</h3>
              <ul className="cps-up-rows">
                {upcoming.map(s => {
                  const g = groupOf(s.class_id)
                  const st = stageInfo(g?.stage)
                  return (
                    <li key={s.id} className="cps-up-row">
                      <span className="cps-up-day">{fmtSessionDay(s.start_at)}</span>
                      <span className="cps-up-time">{fmtSessionTime(s.start_at)}</span>
                      <span className="cps-up-name">
                        {g ? publicTitle(g) : ''}
                        {s.title ? <span className="cps-up-title-sub"> · {s.title}</span> : null}
                      </span>
                      {st && (
                        <span className="cps-badge" style={{ color: st.color, background: st.soft }}>{st.l}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Style scoped — dùng đúng design token của .tva-class ─── */
const CSS = `
.tva-class .cps-sec{padding:58px 0;}
.tva-class .cps-note{margin:8px 0 0;font-size:13.5px;font-weight:600;color:var(--honey);}
.tva-class .cps-state{margin-top:26px;border:1.5px dashed var(--line);border-radius:16px;background:var(--surface);padding:36px 22px;text-align:center;}
.tva-class .cps-week{display:grid;gap:14px;margin-top:28px;grid-template-columns:1fr;}
@media(min-width:640px){.tva-class .cps-week{grid-template-columns:repeat(2,1fr);}}
@media(min-width:900px){.tva-class .cps-week{grid-template-columns:repeat(3,1fr);}}
.tva-class .cps-day{border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;box-shadow:0 14px 40px -24px rgba(33,28,50,.25);}
.tva-class .cps-day-head{padding:11px 16px;border-bottom:1px solid var(--line);background:var(--bg);font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-soft);}
.tva-class .cps-day-body{display:flex;flex-direction:column;}
.tva-class .cps-group{padding:14px 16px;border-bottom:1px solid var(--line);}
.tva-class .cps-group:last-child{border-bottom:none;}
.tva-class .cps-badge{display:inline-block;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800;line-height:1.6;}
.tva-class .cps-group-name{margin-top:7px;font-size:15px;font-weight:800;line-height:1.35;color:var(--ink);}
.tva-class .cps-group-time{margin-top:3px;font-size:13.5px;font-weight:600;color:var(--ink-soft);}
.tva-class .cps-upcoming{margin-top:24px;}
.tva-class .cps-up-toggle{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--indigo);background:transparent;color:var(--indigo);border-radius:999px;padding:10px 18px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:all .15s;}
.tva-class .cps-up-toggle:hover{background:var(--indigo-tint);}
.tva-class .cps-up-count{background:var(--indigo-tint);color:var(--indigo);border-radius:999px;padding:1px 9px;font-size:11.5px;font-weight:800;}
.tva-class .cps-up-list{margin-top:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;box-shadow:0 14px 40px -24px rgba(33,28,50,.25);}
.tva-class .cps-up-title{margin:0;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--bg);font-size:14px;font-weight:800;color:var(--ink);}
.tva-class .cps-up-rows{margin:0;padding:0;list-style:none;}
.tva-class .cps-up-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:13px 16px;border-bottom:1px solid var(--line);}
.tva-class .cps-up-row:last-child{border-bottom:none;}
.tva-class .cps-up-day{min-width:118px;font-size:13px;font-weight:800;color:var(--ink);}
.tva-class .cps-up-time{min-width:50px;font-size:13px;font-weight:700;color:var(--honey);}
.tva-class .cps-up-name{flex:1;min-width:160px;font-size:14px;color:var(--ink);}
.tva-class .cps-up-title-sub{color:var(--ink-soft);}
`
