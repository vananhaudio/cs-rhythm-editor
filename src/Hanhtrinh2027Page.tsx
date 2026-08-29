// ── Hanhtrinh2027Page — 40 BUỔI THỰC HÀNH GUITAR · Hành trình 2027 ──
// Route: class.vananhaudio.com/hanhtrinh2027 (public).
// Lịch ĐỌC TỪ NGUỒN DÙNG CHUNG: class_schedule (program_code='HT2027')
//   + class_sessions (40 buổi + 8 tuần nghỉ) + class_off_days (ngày bỏ qua).
// KHÔNG hardcode ngày trong component; admin đổi lịch ở /admin → trang tự cập nhật.
// Accent: tím Class (#4338CA) — KHÔNG dùng forest green.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { HT2027, HT2027_STAGES, HT2027_PROGRESSION, HT2027_ELIGIBLE_CODES } from './data/ht2027Program'
import { generateSessions, type SessionRow } from './journey/sessions'

const P = {
  bg: '#F7F5FC', surface: '#FFFFFF', ink: '#201C33', inkSoft: '#4C4763', inkFaint: '#8A85A3',
  purple: '#4338CA', purpleDark: '#352BA3', purpleDeep: '#1F1A56', purpleTint: '#EDEBFB',
  line: '#E5E1F1', honey: '#C9711E', honeyTint: '#FBF1E4', ok: '#15803D',
}
// 5 sắc tím cho 5 chặng (cùng hệ tím Class)
const STAGE_COLORS = ['#4338CA', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA']
const STAGE_TINTS = ['#EDEBFB', '#F3EDFC', '#F5F0FD', '#F6F2FE', '#F8F5FF']
const ZALO_LINK = 'https://zalo.me/vananhguitarist'

const SESS_STATUS: Record<string, { l: string; c: string }> = {
  scheduled: { l: 'Dự kiến', c: '#64748B' },
  confirmed: { l: 'Đã xác nhận', c: '#6D28D9' },
  rescheduled: { l: 'Đổi lịch', c: '#D97706' },
  completed: { l: 'Đã hoàn thành', c: '#16A34A' },
  cancelled: { l: 'Đã hủy', c: '#DC2626' },
  holiday: { l: 'Nghỉ lễ', c: '#94A3B8' },
  makeup: { l: 'Buổi bù', c: '#0284C7' },
}
const p2 = (n: number) => String(n).padStart(2, '0')
const ymdOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const fmtDM = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`
const WEEKDAY_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

interface ProgClass { id: string; code: string | null; name: string; start_date: string | null; start_time: string | null; timezone: string | null; total_sessions: number; status: string | null }
interface OffDay { off_date: string; reason: string | null; source: string | null }

interface TimelineEntry {
  kind: 'lesson' | 'break' | 'off'
  date: Date
  session?: SessionRow
  offReason?: string
  stageNo: number | null   // chặng của buổi học (break/off = chặng đang diễn ra)
}

// Dựng timeline: mỗi thứ trong khoảng [buổi 1 → buổi cuối] là buổi học / nghỉ chặng / ngày bỏ qua.
const buildTimeline = (cls: ProgClass, sessions: SessionRow[], offDays: OffDay[]): TimelineEntry[] => {
  const byYmd = new Map<string, SessionRow>()
  for (const s of sessions) byYmd.set(ymdOf(new Date(s.start_at)), s)
  const offByYmd = new Map<string, OffDay>()
  for (const o of offDays) offByYmd.set(o.off_date.slice(0, 10), o)
  const sorted = [...sessions].sort((a, b) => a.start_at.localeCompare(b.start_at))
  if (!sorted.length) return []
  const d = new Date(sorted[0].start_at)
  const end = new Date(sorted[sorted.length - 1].start_at)
  const out: TimelineEntry[] = []
  let stageNo: number | null = null
  while (d.getTime() <= end.getTime()) {
    const ymd = ymdOf(d)
    const s = byYmd.get(ymd)
    if (s) {
      if (s.event_type === 'break') out.push({ kind: 'break', date: new Date(d), session: s, stageNo })
      else {
        stageNo = s.session_number ? Math.ceil(s.session_number / 8) : stageNo
        out.push({ kind: 'lesson', date: new Date(d), session: s, stageNo })
      }
    } else {
      const o = offByYmd.get(ymd)
      if (o) out.push({ kind: 'off', date: new Date(d), offReason: o.reason ?? 'Nghỉ lễ / lịch chung', stageNo })
    }
    d.setDate(d.getDate() + 7)
  }
  return out
}

// Fixture CHỈ DÙNG KHI CHẠY DEV (import.meta.env.DEV) — sinh từ CÙNG engine + giáo trình,
// KHÔNG phải nguồn dữ liệu thứ hai; build production sẽ không bao gồm nhánh này.
function devFixture(): { cls: ProgClass; sessions: SessionRow[]; offDays: OffDay[] } | null {
  if (!import.meta.env.DEV) return null
  const offDates = ['2027-02-04', '2027-02-11', '2027-09-02']
  const sessions = generateSessions(
    HT2027.proposedStartDate, HT2027.weekday, HT2027.startTime, HT2027.durationMinutes, HT2027.totalSessions,
    { breaksAfter: HT2027.breaksAfter, skipDates: offDates },
  ).map(s => ({ session_number: s.session_number, start_at: s.start_at, status: s.event_type === 'break' ? 'holiday' : 'scheduled', event_type: s.event_type }))
  return {
    cls: { id: 'dev', code: HT2027.classCode, name: HT2027.name, start_date: HT2027.proposedStartDate, start_time: HT2027.startTime, timezone: HT2027.timezone, total_sessions: HT2027.totalSessions, status: 'scheduled' },
    sessions,
    offDays: offDates.map(d => ({ off_date: d, reason: d === '2027-09-02' ? 'Quốc khánh 2/9' : 'Tết Nguyên Đán (dự kiến)', source: d === '2027-09-02' ? 'official' : 'tet' })),
  }
}

export default function Hanhtrinh2027Page() {
  const [cls, setCls] = useState<ProgClass | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [loading, setLoading] = useState(true)
  const [isDevFixture, setIsDevFixture] = useState(false)
  const [me, setMe] = useState<{ htMember: boolean; eligible: string[] } | null>(null)   // null = chưa đăng nhập

  useEffect(() => { document.title = '40 Buổi Thực Hành · Hành Trình 2027' }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const { data: clsRow } = await supabase.from('class_schedule').select('id,code,name,start_date,start_time,timezone,total_sessions,status')
          .eq('program_code', HT2027.programCode).maybeSingle()
        const clsData: ProgClass | null = clsRow
          ?? (await supabase.from('class_schedule').select('id,code,name,start_date,start_time,timezone,total_sessions,status')
            .eq('code', HT2027.classCode).maybeSingle()).data
        // Nếu chưa seed (chưa có lớp) → dev: dùng fixture để xem giao diện; prod: hiện trạng thái chờ
        let sessionsData: SessionRow[] = []
        let offData: OffDay[] = []
        if (clsData) {
          const [sessRes, offRes] = await Promise.all([
            supabase.from('class_sessions').select('session_number,start_at,status,event_type,title').eq('class_id', clsData.id).order('start_at'),
            supabase.from('class_off_days').select('off_date,reason,source').eq('is_active', true),
          ])
          sessionsData = (sessRes.data ?? []) as SessionRow[]
          offData = (offRes.data ?? []) as OffDay[]
        }
        let finalCls = clsData, finalSess = sessionsData, finalOff = offData
        if (!finalCls || !finalSess.length) {
          const fx = devFixture()
          if (fx) { finalCls = fx.cls; finalSess = fx.sessions; finalOff = fx.offDays; setIsDevFixture(true) }
        }
        if (cancelled) return
        setCls(finalCls); setSessions(finalSess); setOffDays(finalOff)
        // Quyền tham gia: đọc MÃ NĂNG LỰC chuẩn (không theo tên khoá)
        if (session?.user) {
          const stuRes = await supabase.from('edu_students').select('id,ht_member').eq('user_id', session.user.id).maybeSingle()
          const stu = stuRes.data as { id: string; ht_member: boolean } | null
          if (stu) {
            const accessRes = await supabase.from('edu_course_access').select('course_id').eq('student_id', stu.id).eq('active', true)
            const access = (accessRes.data ?? []) as { course_id: string }[]
            const coursesRes = await supabase.from('edu_courses').select('id,code').in('code', HT2027_ELIGIBLE_CODES)
            const courses = (coursesRes.data ?? []) as { id: string; code: string | null }[]
            const has = new Set(access.map(a => a.course_id))
            const eligible = courses.filter(c => has.has(c.id)).map(c => c.code).filter((x): x is string => !!x)
            if (!cancelled) setMe({ htMember: !!stu.ht_member, eligible })
          }
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const timeline = useMemo(() => buildTimeline(cls ?? ({} as ProgClass), sessions, offDays), [cls, sessions, offDays])
  const startTime = cls?.start_time?.slice(0, 5) ?? '20:30'
  const lastLesson = [...sessions].filter(s => s.event_type !== 'break').sort((a, b) => a.start_at.localeCompare(b.start_at)).pop()

  const cta = !me ? 'anon' : me.htMember ? 'member' : me.eligible.length ? 'eligible' : 'other'
  const eligibleName = me?.eligible.map(c => c === 'DH2' ? 'Đệm hát 2' : c === 'TN2' ? 'Tỉa nốt 2' : c).join(' / ')

  return (
    <div className="ht2027">
      <style>{CSS}</style>

      {/* ── Thanh trên ── */}
      <header className="ht2027-top">
        <a className="ht2027-brand" href="/">
          <img src="/logo.png" alt="Thầy Văn Anh Guitar" />
          <span>Thầy Văn Anh <i>Guitar</i></span>
        </a>
        <a className="ht2027-topback" href="/">← Về trang Class</a>
      </header>

      <main className="ht2027-main">
        {/* ── HERO ── */}
        <section className="ht2027-hero">
          <div className="ht2027-wrap">
            <div className="ht2027-kicker"><span />Hành trình 2027 · Thực hành cùng Thầy</div>
            <h1>40 BUỔI THỰC HÀNH <span>GUITAR</span></h1>
            <p className="ht2027-sub">Đồng hành cùng <b>Hành trình 2027</b></p>
            <p className="ht2027-lead">
              Học Guitar không chỉ là xem hết bài giảng hay hoàn thành một khóa học.
              Điều quan trọng hơn là biến những kiến thức đã học thành khả năng chơi đàn thực tế:
              hiểu hợp âm, làm chủ tiết tấu, tìm được giai điệu, biết hòa âm và từng bước hoàn thiện một tác phẩm Solo Guitar.
            </p>
            <p className="ht2027-lead">
              Vì vậy, trong Hành trình 2027, Thầy Văn Anh tổ chức <b>40 buổi thực hành trực tuyến</b>, diễn ra cố định vào:
            </p>
            <div className="ht2027-timechip">
              <span className="ht2027-timechip-big">20h30</span>
              <span className="ht2027-timechip-sub">tối <b>thứ Năm</b> hằng tuần · Giờ Việt Nam (GMT+7)</span>
            </div>
            <p className="ht2027-lead">
              Đây là không gian để học sinh cùng luyện đàn, ứng dụng kiến thức vào bài hát thật,
              được Thầy hướng dẫn, sửa bài và hoàn thiện sản phẩm qua từng chặng.
            </p>
          </div>
        </section>

        {/* ── CẤU TRÚC CHƯƠNG TRÌNH ── */}
        <section className="ht2027-band">
          <div className="ht2027-wrap">
            <div className="ht2027-eyebrow">Cấu trúc chương trình</div>
            <h2>5 chặng · 40 buổi · một hành trình hoàn thiện</h2>
            <div className="ht2027-stats">
              {[['40', 'buổi thực hành'], ['5', 'chặng'], ['8', 'buổi mỗi chặng'], ['2', 'tuần nghỉ giữa chặng'], ['01', 'sản phẩm cuối mỗi chặng']].map(([n, l]) => (
                <div key={l}><b>{n}</b><span>{l}</span></div>
              ))}
            </div>
            <div className="ht2027-progress">
              {HT2027_PROGRESSION.map((p, i) => (
                <div className="ht2027-progress-item" key={p}>
                  <span className="ht2027-progress-dot" style={{ background: STAGE_COLORS[i], borderColor: STAGE_COLORS[i] }} />
                  <span className="ht2027-progress-label">{p}</span>
                  {i < HT2027_PROGRESSION.length - 1 && <span className="ht2027-progress-arrow">→</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MỤC LỤC NHANH ── */}
        <section className="ht2027-wrap">
          <nav className="ht2027-toc">
            {HT2027_STAGES.map(s => (
              <a key={s.no} href={`#chang-${s.no}`} style={{ borderColor: STAGE_COLORS[s.no - 1], color: STAGE_COLORS[s.no - 1] }}>
                Chặng {s.no}
              </a>
            ))}
            <a href="#lich" className="ht2027-toc-schedule">Lịch dự kiến 2027</a>
          </nav>
        </section>

        {/* ── 5 CHẶNG ── */}
        {HT2027_STAGES.map(st => (
          <section key={st.no} id={`chang-${st.no}`} className="ht2027-band" style={{ background: STAGE_TINTS[st.no - 1] }}>
            <div className="ht2027-wrap">
              <div className="ht2027-stage-head">
                <div className="ht2027-stage-no" style={{ background: STAGE_COLORS[st.no - 1] }}>Chặng {st.no}</div>
                <h2 style={{ color: STAGE_COLORS[st.no - 1] }}>{st.title}</h2>
              </div>
              <p className="ht2027-stage-goal"><b>Mục tiêu:</b> {st.goal}</p>
              <ol className="ht2027-stage-lessons">
                {st.lessons.map((l, i) => (
                  <li key={l}>
                    <span className="ht2027-lesson-no" style={{ color: STAGE_COLORS[st.no - 1], borderColor: STAGE_COLORS[st.no - 1] }}>{p2((st.no - 1) * 8 + i + 1)}</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ol>
              <div className="ht2027-stage-results">
                <div className="ht2027-results-title">Kết quả cuối chặng</div>
                <ul>{st.results.map(r => <li key={r}>✓ {r}</li>)}</ul>
              </div>
            </div>
          </section>
        ))}

        {/* ── LỊCH THỰC HÀNH DỰ KIẾN 2027 ── */}
        <section id="lich" className="ht2027-wrap ht2027-schedule">
          <div className="ht2027-eyebrow">Khu vực lịch</div>
          <h2>LỊCH THỰC HÀNH DỰ KIẾN 2027</h2>
          <div className="ht2027-notice">
            Đây là lịch dự kiến. Ngày học có thể được điều chỉnh theo lịch nghỉ lễ và tình hình thực tế.
            Mọi thay đổi chính thức sẽ được cập nhật trực tiếp trên hệ thống Class.
          </div>

          {loading ? (
            <div className="ht2027-empty">Đang tải lịch…</div>
          ) : !cls ? (
            <div className="ht2027-empty">
              Lịch dự kiến sẽ được công bố tại đây khi chương trình được mở.
            </div>
          ) : (
            <>
              <div className="ht2027-sched-meta">
                <span>🕗 {startTime} · tối thứ Năm hằng tuần · Giờ Việt Nam (GMT+7)</span>
                {lastLesson && <span>🗓 Buổi 1: {fmtDM(new Date(sessions[0].start_at))} → Buổi {HT2027.totalSessions}: {fmtDM(new Date(lastLesson.start_at))}</span>}
              </div>
              {isDevFixture && <div className="ht2027-devnote">⚙ Dữ liệu mẫu chế độ dev — chưa phải lịch thật trên hệ thống.</div>}

              <div className="ht2027-legend">
                <span><i className="dot lesson" />Buổi học</span>
                <span><i className="dot brk" />Nghỉ giữa chặng</span>
                <span><i className="dot off" />Bỏ qua (nghỉ lễ / lịch chung)</span>
              </div>

              <div className="ht2027-timeline">
                {timeline.map((t, idx) => {
                  const showStage = t.kind === 'lesson' && t.stageNo && (idx === 0 || timeline[idx - 1].stageNo !== t.stageNo)
                  const st = t.kind === 'lesson' && t.stageNo ? HT2027_STAGES[t.stageNo - 1] : null
                  const stColor = t.stageNo ? STAGE_COLORS[t.stageNo - 1] : P.purple
                  const stTint = t.stageNo ? STAGE_TINTS[t.stageNo - 1] : P.purpleTint
                  if (t.kind === 'lesson') {
                    const num = t.session?.session_number ?? 0
                    const stt = SESS_STATUS[t.session?.status ?? 'scheduled']
                    return (
                      <div key={idx}>
                        {showStage && (
                          <div className="ht2027-tl-stage" style={{ color: stColor, borderColor: stColor }}>
                            Chặng {t.stageNo} · {st?.title}
                          </div>
                        )}
                        <div className="ht2027-tl-row" style={{ borderLeftColor: stColor }}>
                          <div className="ht2027-tl-date">
                            <b>{fmtDM(t.date)}</b>
                            <span>{WEEKDAY_VI[t.date.getDay()]}</span>
                          </div>
                          <div className="ht2027-tl-body">
                            <div className="ht2027-tl-title">
                              <span className="ht2027-tl-num" style={{ background: stTint, color: stColor }}>Buổi {p2(num)}</span>
                              <span className="ht2027-tl-name">{t.session?.title ? t.session.title.replace(/^Buổi \d+ · /, '') : st?.lessons[(num - 1) % 8]}</span>
                            </div>
                            <div className="ht2027-tl-foot">
                              <span className="ht2027-tl-time">{startTime}</span>
                              <span className="ht2027-tl-status" style={{ color: stt.c, background: `${stt.c}14` }}>{stt.l}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  if (t.kind === 'break') {
                    return (
                      <div key={idx} className="ht2027-tl-row ht2027-tl-break">
                        <div className="ht2027-tl-date"><b>{fmtDM(t.date)}</b><span>{WEEKDAY_VI[t.date.getDay()]}</span></div>
                        <div className="ht2027-tl-body">
                          <div className="ht2027-tl-title"><span className="ht2027-tl-brk">✕ Nghỉ giữa chặng</span></div>
                          <div className="ht2027-tl-foot"><span className="ht2027-tl-breaknote">thời gian tự luyện và hoàn thiện sản phẩm</span></div>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="ht2027-tl-row ht2027-tl-off">
                      <div className="ht2027-tl-date"><b>{fmtDM(t.date)}</b><span>{WEEKDAY_VI[t.date.getDay()]}</span></div>
                      <div className="ht2027-tl-body">
                        <div className="ht2027-tl-title"><span className="ht2027-tl-offtag">Bỏ qua</span><span className="ht2027-tl-name">{t.offReason}</span></div>
                        <div className="ht2027-tl-foot"><span className="ht2027-tl-breaknote">không tổ chức buổi học · buổi dời sang tuần phù hợp tiếp theo</span></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* ── ĐỐI TƯỢNG THAM GIA ── */}
        <section className="ht2027-band">
          <div className="ht2027-wrap">
            <div className="ht2027-eyebrow">Ai được tham gia</div>
            <h2>Chương trình dành cho</h2>
            <ul className="ht2027-who">
              <li>🎓 Học sinh đã đăng ký <b>Hành trình 2027</b></li>
              <li>🎸 Học sinh đã tốt nghiệp <b>Đệm hát 2</b></li>
              <li>🎼 Học sinh đã tốt nghiệp <b>Tỉa nốt 2</b></li>
            </ul>
            <div className="ht2027-note">
              Đây <b>không phải</b> lớp dành cho người mới bắt đầu.
              Bấm hợp âm, chuyển hợp âm, giữ nhịp và chơi giai điệu đơn giản là năng lực đầu vào
              — chương trình tập trung đưa bạn đến sự chủ động: chọn hòa âm, phát triển giai điệu,
              điều khiển tiết tấu và hoàn thiện tác phẩm Solo Guitar.
            </div>
          </div>
        </section>

        {/* ── CTA theo quyền tham gia thật ── */}
        <section className="ht2027-wrap ht2027-cta">
          {cta === 'anon' && (
            <div className="ht2027-cta-card">
              <div className="ht2027-cta-title">Bạn là học viên của Thầy?</div>
              <p>Đăng nhập để xem quyền tham gia chương trình của bạn. Lịch hiển thị cho mọi người; quyền tham gia theo lớp/gói của bạn.</p>
              <div className="ht2027-cta-btns">
                <a className="ht2027-btn primary" href="/start">Đăng nhập / Vào cổng học →</a>
                <a className="ht2027-btn ghost" href={ZALO_LINK} target="_blank" rel="noreferrer">Hỏi Thầy qua Zalo</a>
              </div>
            </div>
          )}
          {cta === 'member' && (
            <div className="ht2027-cta-card">
              <div className="ht2027-cta-title">🎓 Bạn là học viên Hành trình 2027</div>
              <p>40 buổi thực hành nằm trong chương trình của bạn. Lịch chi tiết ở phía trên — mọi cập nhật chính thức đều hiển thị trực tiếp trên hệ thống Class.</p>
              <div className="ht2027-cta-btns">
                <a className="ht2027-btn primary" href="/start">Vào cổng học →</a>
                <a className="ht2027-btn ghost" href={ZALO_LINK} target="_blank" rel="noreferrer">Nhắn Thầy qua Zalo</a>
              </div>
            </div>
          )}
          {cta === 'eligible' && (
            <div className="ht2027-cta-card">
              <div className="ht2027-cta-title">✓ Bạn đủ điều kiện tham gia</div>
              <p>Bạn đã có quyền học <b>{eligibleName}</b> — thuộc nhóm học viên tốt nghiệp được mời vào chương trình thực hành. Nhắn Thầy để được ghi danh buổi thực hành.</p>
              <div className="ht2027-cta-btns">
                <a className="ht2027-btn primary" href={ZALO_LINK} target="_blank" rel="noreferrer">Nhắn Thầy để ghi danh</a>
              </div>
            </div>
          )}
          {cta === 'other' && (
            <div className="ht2027-cta-card">
              <div className="ht2027-cta-title">Chương trình dành cho ai?</div>
              <p>40 buổi thực hành dành cho học viên <b>Hành trình 2027</b> và học viên tốt nghiệp <b>Đệm hát 2</b> hoặc <b>Tỉa nốt 2</b>. Nếu bạn chưa thuộc nhóm này, hãy hỏi Thầy để chọn lộ trình phù hợp.</p>
              <div className="ht2027-cta-btns">
                <a className="ht2027-btn primary" href={ZALO_LINK} target="_blank" rel="noreferrer">Hỏi Thầy qua Zalo</a>
                <a className="ht2027-btn ghost" href="/class#hanh-trinh">Tìm hiểu Hành trình 2027</a>
              </div>
            </div>
          )}
        </section>

        {/* ── FOOTER ── */}
        <footer className="ht2027-foot">
          <div className="ht2027-wrap">
            <p>Hành Trình 2027 không dạy bạn chơi đàn theo cách thông thường — mà giúp bạn làm chủ cây đàn từ bên trong.</p>
            <div className="ht2027-foot-row">
              <img src="/logo.png" alt="" />
              <span>Thầy Văn Anh · Guitar</span>
              <span className="ht2027-foot-right">Zalo 0983 259 893</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');
.ht2027{--p:${P.purple};--pd:${P.purpleDark};--pt:${P.purpleTint};background:${P.bg};color:${P.ink};font-family:'Be Vietnam Pro',system-ui,sans-serif;line-height:1.6;font-size:16px;min-height:100vh;text-align:left;color-scheme:light;}
.ht2027 *{box-sizing:border-box;margin:0;}
.ht2027 ::selection{background:${P.purple};color:#fff;}
.ht2027 .ht2027-wrap{max-width:760px;margin:0 auto;padding:0 20px;}
.ht2027 a{color:${P.purple};}

/* thanh trên */
.ht2027-top{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 16px;background:rgba(247,245,252,.94);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.ht2027-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:${P.ink};font-size:13.5px;font-weight:700;}
.ht2027-brand img{width:26px;height:26px;display:block;}
.ht2027-brand i{color:${P.purple};font-style:normal;}
.ht2027-topback{margin-left:auto;font-size:13px;font-weight:600;color:${P.inkSoft};text-decoration:none;border:1px solid ${P.line};border-radius:999px;padding:7px 14px;background:#fff;white-space:nowrap;}
.ht2027-topback:hover{color:${P.purple};border-color:${P.purple};}

/* hero */
.ht2027-hero{padding:64px 0 56px;background:linear-gradient(180deg,#F0EDFB 0%,${P.bg} 100%);}
.ht2027-kicker{display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${P.honey};margin-bottom:22px;}
.ht2027-kicker span{width:26px;height:2px;background:${P.honey};}
.ht2027-hero h1{font-size:clamp(30px,7vw,52px);line-height:1.08;letter-spacing:-.02em;color:${P.ink};font-weight:900;margin-bottom:10px;}
.ht2027-hero h1 span{color:${P.purple};}
.ht2027-sub{font-size:clamp(17px,2.6vw,22px);font-weight:700;color:${P.inkSoft};margin-bottom:22px;}
.ht2027-lead{font-size:15.5px;color:${P.inkSoft};line-height:1.75;margin-bottom:14px;text-wrap:pretty;}
.ht2027-timechip{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;background:${P.purpleDeep};color:#fff;border-radius:16px;padding:16px 22px;margin:22px 0;}
.ht2027-timechip-big{font-size:clamp(30px,5.5vw,42px);font-weight:900;letter-spacing:-.02em;line-height:1;}
.ht2027-timechip-sub{font-size:14px;color:rgba(255,255,255,.85);}
.ht2027-timechip-sub b{color:#fff;}

/* band chung */
.ht2027-band{padding:52px 0;background:#fff;border-top:1px solid ${P.line};border-bottom:1px solid ${P.line};}
.ht2027-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${P.honey};margin-bottom:12px;}
.ht2027 h2{font-size:clamp(21px,3.6vw,30px);font-weight:800;line-height:1.22;letter-spacing:-.015em;color:${P.ink};margin-bottom:18px;}

/* cấu trúc chương trình */
.ht2027-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:${P.line};border:1px solid ${P.line};border-radius:14px;overflow:hidden;margin:26px 0;}
.ht2027-stats>div{background:#fff;padding:18px 10px;text-align:center;}
.ht2027-stats b{display:block;font-size:clamp(22px,3.4vw,32px);font-weight:900;color:${P.purple};line-height:1;}
.ht2027-stats span{display:block;font-size:12px;color:${P.inkFaint};margin-top:6px;line-height:1.35;}
@media(max-width:600px){.ht2027-stats{grid-template-columns:repeat(3,1fr);}.ht2027-stats>div:nth-child(4),.ht2027-stats>div:nth-child(5){display:none;}}
.ht2027-progress{display:flex;flex-wrap:wrap;align-items:center;gap:8px 6px;margin-top:8px;}
.ht2027-progress-item{display:flex;align-items:center;gap:7px;}
.ht2027-progress-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.ht2027-progress-label{font-size:13.5px;font-weight:600;color:${P.inkSoft};}
.ht2027-progress-arrow{color:${P.line};font-size:13px;}

/* mục lục nhanh */
.ht2027-toc{display:flex;flex-wrap:wrap;gap:8px;padding:26px 0 8px;}
.ht2027-toc a{text-decoration:none;font-size:13.5px;font-weight:700;border:1.5px solid;border-radius:999px;padding:8px 16px;background:#fff;}
.ht2027-toc .ht2027-toc-schedule{background:${P.purple};color:#fff !important;border-color:${P.purple} !important;}

/* 5 chặng */
.ht2027-stage-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;}
.ht2027-stage-no{flex-shrink:0;color:#fff;font-size:12.5px;font-weight:800;letter-spacing:.06em;border-radius:9px;padding:7px 13px;margin-top:4px;}
.ht2027-stage-head h2{margin-bottom:0;}
.ht2027-stage-goal{font-size:15px;color:${P.inkSoft};line-height:1.7;margin-bottom:20px;text-wrap:pretty;}
.ht2027-stage-goal b{color:${P.ink};}
.ht2027-stage-lessons{list-style:none;display:flex;flex-direction:column;}
.ht2027-stage-lessons li{display:flex;gap:12px;align-items:baseline;padding:11px 0;border-bottom:1px dashed ${P.line};font-size:15px;color:${P.ink};}
.ht2027-stage-lessons li:last-child{border-bottom:none;}
.ht2027-lesson-no{flex-shrink:0;font-size:11.5px;font-weight:800;border:1.5px solid;border-radius:7px;padding:2px 7px;letter-spacing:.04em;}
.ht2027-stage-results{margin-top:18px;background:#fff;border:1px solid ${P.line};border-radius:14px;padding:16px 18px;}
.ht2027-results-title{font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${P.honey};margin-bottom:10px;}
.ht2027-stage-results ul{list-style:none;display:flex;flex-direction:column;gap:7px;}
.ht2027-stage-results li{font-size:14px;color:${P.inkSoft};line-height:1.55;}

/* lịch */
.ht2027-schedule{padding:56px 0 20px;}
.ht2027-notice{background:${P.honeyTint};border:1px solid #F3D9B8;border-left:4px solid ${P.honey};border-radius:12px;padding:13px 16px;font-size:13.5px;color:#7A4A12;line-height:1.65;margin-bottom:18px;}
.ht2027-empty{padding:44px 20px;text-align:center;color:${P.inkFaint};font-size:15px;background:#fff;border:1px dashed ${P.line};border-radius:14px;}
.ht2027-sched-meta{display:flex;flex-direction:column;gap:5px;font-size:13.5px;color:${P.inkSoft};background:#fff;border:1px solid ${P.line};border-radius:12px;padding:12px 16px;margin-bottom:12px;}
.ht2027-devnote{font-size:12.5px;color:#92400E;background:#FEF3C7;border-radius:8px;padding:7px 12px;margin-bottom:10px;}
.ht2027-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12.5px;color:${P.inkFaint};margin:14px 0;}
.ht2027-legend .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px;}
.ht2027-legend .dot.lesson{background:${P.purple};}
.ht2027-legend .dot.brk{background:#fff;border:2px solid ${P.honey};}
.ht2027-legend .dot.off{background:#E5E7EB;}

.ht2027-timeline{display:flex;flex-direction:column;gap:0;position:relative;}
.ht2027-tl-stage{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-bottom:2px solid;padding:18px 0 8px;margin-top:6px;}
.ht2027-tl-row{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid ${P.line};border-left:3px solid ${P.purple};padding-left:14px;background:#fff;border-radius:0 12px 12px 0;margin-bottom:8px;}
.ht2027-tl-date{flex-shrink:0;width:74px;text-align:left;}
.ht2027-tl-date b{display:block;font-size:15px;font-weight:800;color:${P.ink};letter-spacing:.01em;}
.ht2027-tl-date span{font-size:11.5px;color:${P.inkFaint};}
.ht2027-tl-body{flex:1;min-width:0;}
.ht2027-tl-title{display:flex;gap:9px;align-items:baseline;flex-wrap:wrap;}
.ht2027-tl-num{font-size:11.5px;font-weight:800;border-radius:7px;padding:2px 8px;flex-shrink:0;}
.ht2027-tl-name{font-size:14.5px;font-weight:600;color:${P.ink};line-height:1.45;}
.ht2027-tl-foot{display:flex;gap:8px;align-items:center;margin-top:5px;flex-wrap:wrap;}
.ht2027-tl-time{font-size:12px;color:${P.inkFaint};}
.ht2027-tl-status{font-size:11px;font-weight:800;border-radius:999px;padding:2px 9px;}
.ht2027-tl-break{background:${P.honeyTint};border-left-color:${P.honey};}
.ht2027-tl-brk{font-size:12.5px;font-weight:800;color:#9A5B13;letter-spacing:.02em;}
.ht2027-tl-breaknote{font-size:12px;color:#8A6A3D;font-style:italic;}
.ht2027-tl-off{background:#FAFAFA;border-left-color:#C9CBD6;opacity:.92;}
.ht2027-tl-offtag{font-size:11px;font-weight:800;color:#6B7280;background:#E5E7EB;border-radius:7px;padding:2px 8px;flex-shrink:0;}
.ht2027-tl-off .ht2027-tl-name{color:${P.inkFaint};font-weight:500;}

/* đối tượng */
.ht2027-who{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:16px;}
.ht2027-who li{font-size:15.5px;color:${P.ink};background:#fff;border:1px solid ${P.line};border-left:4px solid ${P.purple};border-radius:12px;padding:13px 16px;}
.ht2027-who li b{color:${P.purple};}
.ht2027-note{font-size:14px;color:${P.inkSoft};background:${P.purpleTint};border-radius:12px;padding:14px 16px;line-height:1.7;}

/* CTA */
.ht2027-cta{padding:52px 0;}
.ht2027-cta-card{background:${P.purpleDeep};color:#fff;border-radius:20px;padding:30px 26px;text-align:center;}
.ht2027-cta-title{font-size:clamp(18px,3vw,24px);font-weight:800;letter-spacing:-.01em;margin-bottom:12px;}
.ht2027-cta-card p{font-size:14.5px;color:rgba(255,255,255,.82);line-height:1.7;max-width:560px;margin:0 auto 20px;}
.ht2027-cta-card p b{color:#fff;}
.ht2027-cta-btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.ht2027-btn{display:inline-block;text-decoration:none;font-size:14.5px;font-weight:700;border-radius:999px;padding:13px 24px;cursor:pointer;font-family:inherit;}
.ht2027-btn.primary{background:${P.purple};color:#fff;border:1.5px solid ${P.purple};}
.ht2027-btn.primary:hover{background:#4F46E5;}
.ht2027-btn.ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.45);}
.ht2027-btn.ghost:hover{border-color:#fff;}

/* footer */
.ht2027-foot{background:${P.purpleDeep};color:rgba(255,255,255,.72);padding:46px 0 40px;}
.ht2027-foot p{font-size:clamp(16px,2.4vw,20px);line-height:1.5;color:#fff;margin-bottom:28px;max-width:640px;text-wrap:pretty;}
.ht2027-foot-row{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding-top:20px;border-top:1px solid rgba(255,255,255,.16);font-size:13px;}
.ht2027-foot-row img{width:26px;height:26px;filter:brightness(0) invert(1);opacity:.85;}
.ht2027-foot-right{margin-left:auto;color:rgba(255,255,255,.55);}

@media(max-width:480px){.ht2027-tl-date{width:62px;}.ht2027-topback{font-size:12px;padding:6px 11px;}}
`
