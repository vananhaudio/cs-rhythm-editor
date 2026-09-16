// ── Solo01Page — SOLO GUITAR CĂN BẢN (SOLO-01) ──
// Route: class.vananhaudio.com/solo01 (public).
// Design system / bố cục / CSS lấy NGUYÊN từ src/Hanhtrinh2027Page.tsx (accordion theo chặng,
// accent tím Class #4338CA, mobile-first, contrast cao) — chỉ đổi nội dung sang SOLO-01.
// Nội dung giáo trình đọc từ src/data/solo01Program.ts (nguồn duy nhất).
// KHÔNG đụng DB: khoá này chưa có lớp trong class_schedule, học phí nằm trong file data.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { SOLO01, SOLO01_STAGES, SOLO01_PROGRESSION, SOLO01_PRICES, SOLO01_METHOD, SOLO01_NOTATION, soloLessonOpen, soloUnlockLabel } from './data/solo01Program'
import { generateSessions, fmtDMY, type SessionRow } from './journey/sessions'

const P = {
  bg: '#F7F5FC', surface: '#FFFFFF', ink: '#1D1930', inkSoft: '#3E3952', inkFaint: '#6A6580',
  purple: '#4338CA', purpleDark: '#352BA3', purpleDeep: '#201A52', purpleTint: '#EDEBFB',
  line: '#E4E0F0', honey: '#A85F0E', honeyTint: '#FBF3E6', ok: '#15803D',
}
const STAGE_COLORS = ['#4338CA', '#7C3AED', '#A78BFA']
const ZALO_LINK = 'https://zalo.me/vananhguitarist'
const p2 = (n: number) => String(n).padStart(2, '0')
const ymdOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const fmtDM = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`
const WEEKDAY_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// Nhãn trạng thái buổi học — cùng bộ với /hanhtrinh2027 (class_sessions.status)
const SESS_STATUS: Record<string, { l: string; c: string }> = {
  scheduled: { l: 'Dự kiến', c: '#475569' },
  confirmed: { l: 'Đã xác nhận', c: '#6D28D9' },
  rescheduled: { l: 'Đổi lịch', c: '#C2410C' },
  completed: { l: 'Đã hoàn thành', c: '#15803D' },
  cancelled: { l: 'Đã hủy', c: '#B91C1C' },
  holiday: { l: 'Nghỉ lễ', c: '#6B7280' },
  makeup: { l: 'Buổi bù', c: '#0369A1' },
}

interface ProgClass { id: string; code: string | null; name: string; start_date: string | null; start_time: string | null; timezone: string | null; duration_minutes: number | null; total_sessions: number; status: string | null }
interface OffDay { off_date: string; reason: string | null; source: string | null }

interface TimelineEntry {
  kind: 'lesson' | 'break' | 'off'
  date: Date
  session?: SessionRow
  offReason?: string
  stageNo: number | null
}

// Dựng timeline: mỗi thứ Năm trong khoảng [buổi 1 → buổi cuối] là buổi học / nghỉ chặng / ngày bỏ qua.
const buildTimeline = (sessions: SessionRow[], offDays: OffDay[]): TimelineEntry[] => {
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

// Fixture CHỈ DÙNG KHI CHẠY DEV — sinh từ CÙNG engine + giáo trình.
function devFixture(): { cls: ProgClass; sessions: SessionRow[]; offDays: OffDay[] } | null {
  if (!import.meta.env.DEV) return null
  const sessions = generateSessions(
    SOLO01.proposedStartDate, SOLO01.weekday, SOLO01.startTime, SOLO01.durationMinutes, SOLO01.totalSessions,
    { breaksAfter: SOLO01.breaksAfter },
  ).map(s => ({ session_number: s.session_number, start_at: s.start_at, status: s.event_type === 'break' ? 'holiday' : 'scheduled', event_type: s.event_type }))
  return {
    cls: { id: 'dev', code: SOLO01.classCode, name: SOLO01.name, start_date: SOLO01.proposedStartDate, start_time: SOLO01.startTime, timezone: SOLO01.timezone, duration_minutes: SOLO01.durationMinutes, total_sessions: SOLO01.totalSessions, status: 'scheduled' },
    sessions,
    offDays: [],
  }
}

const CANONICAL = 'https://class.vananhaudio.com/solo01'
const SEO_TITLE = 'Solo Guitar Căn Bản | Thầy Văn Anh Guitar'
const SEO_DESC = 'Khóa Solo Guitar Căn Bản 24 buổi – từ giai điệu, bass, hòa âm, kỹ thuật đến tự dựng bài hát yêu thích thành Solo Guitar.'

// Đặt <meta>/<link> cho trang (index.html chỉ có thẻ mặc định của site).
function useSeo() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = SEO_TITLE
    const created: Element[] = []
    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); created.push(el) }
      el.setAttribute('content', content)
    }
    setMeta('name', 'description', SEO_DESC)
    setMeta('property', 'og:title', SEO_TITLE)
    setMeta('property', 'og:description', SEO_DESC)
    setMeta('property', 'og:url', CANONICAL)
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); created.push(link) }
    link.href = CANONICAL
    return () => { document.title = prevTitle; created.forEach(el => el.remove()) }
  }, [])
}

export default function Solo01Page() {
  const [openStage, setOpenStage] = useState(1)      // chặng đang mở (phần giáo trình)
  const [openSched, setOpenSched] = useState(1)      // chặng đang mở (phần lịch)
  const [cls, setCls] = useState<ProgClass | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [loading, setLoading] = useState(true)
  const [isDevFixture, setIsDevFixture] = useState(false)
  useSeo()

  // Lịch đọc từ NGUỒN DÙNG CHUNG: class_schedule (program_code='SOLO01') + class_sessions + class_off_days.
  // KHÔNG hardcode ngày trong component; admin đổi lịch → trang tự cập nhật.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: clsRow } = await supabase.from('class_schedule')
          .select('id,code,name,start_date,start_time,timezone,duration_minutes,total_sessions,status')
          .eq('program_code', SOLO01.programCode).maybeSingle()
        const clsData: ProgClass | null = clsRow
          ?? (await supabase.from('class_schedule').select('id,code,name,start_date,start_time,timezone,duration_minutes,total_sessions,status')
            .eq('code', SOLO01.classCode).maybeSingle()).data
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
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const timeline = useMemo(() => buildTimeline(sessions, offDays), [sessions, offDays])
  const lessons = useMemo(() => [...sessions].filter(s => s.event_type !== 'break').sort((a, b) => a.start_at.localeCompare(b.start_at)), [sessions])
  const firstLesson = lessons[0]
  const lastLesson = lessons[lessons.length - 1]
  const startDateLabel = cls?.start_date ? fmtDMY(cls.start_date) : 'ngày sắp công bố'

  // Nhóm timeline theo chặng (cho phần lịch accordion)
  const byStage = useMemo(() => {
    const map = new Map<number, TimelineEntry[]>()
    for (const t of timeline) {
      const k = t.stageNo ?? Math.max(1, ...map.keys())
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    }
    return SOLO01_STAGES.map(st => map.get(st.no) ?? [])
  }, [timeline])
  const stageRange = (entries: TimelineEntry[]) => {
    const ls = entries.filter(e => e.kind === 'lesson')
    if (!ls.length) return ''
    return `${fmtDM(ls[0].date)} – ${fmtDM(ls[ls.length - 1].date)}`
  }

  const startTime = cls?.start_time?.slice(0, 5) ?? SOLO01.startTime
  const endTime = (() => {
    const [hh, mm] = startTime.split(':').map(Number)
    const t = hh * 60 + mm + (cls?.duration_minutes ?? SOLO01.durationMinutes)
    return `${p2(Math.floor(t / 60) % 24)}:${p2(t % 60)}`
  })()

  return (
    <div className="solo01">
      <style>{CSS}</style>

      <header className="solo01-top">
        <a className="solo01-brand" href="/">
          <img src="/logo.png" alt="Thầy Văn Anh Guitar" />
          <span>Thầy Văn Anh <i>Guitar</i></span>
        </a>
        <a className="solo01-topback" href="/">← Về trang Class</a>
      </header>

      <main className="solo01-main">
        {/* ── HERO ── */}
        <section className="solo01-hero">
          <div className="solo01-wrap">
            <div className="solo01-kicker"><span />SOLO-01 · Khoá dài hạn cùng Thầy</div>
            <h1>SOLO GUITAR <span>CĂN BẢN</span></h1>
            <p className="solo01-sub">Từ chơi giai điệu đến tự dựng bài Solo Guitar mình yêu thích</p>
            <p className="solo01-lead">
              Không học thuộc từng bản Solo có sẵn. Học cách tìm giai điệu, thêm bass – hòa âm,
              sử dụng kỹ thuật Guitar và từng bước tự dựng một tác phẩm của chính mình.
            </p>
            <div className="solo01-timechip">
              <span className="solo01-timechip-big">{startTime} – {endTime}</span>
              <span className="solo01-timechip-sub">tối <b>{SOLO01.weekdayLabel}</b> hằng tuần · <b>24 buổi · 3 chặng · 6 tháng</b><br />Khai giảng <b>{startDateLabel}</b></span>
            </div>
            <div className="solo01-cta-btns left">
              <a className="solo01-btn primary" href={ZALO_LINK} target="_blank" rel="noreferrer">ĐĂNG KÝ HỌC →</a>
              <a className="solo01-btn outline" href="#lotrinh">XEM LỘ TRÌNH 24 BUỔI</a>
            </div>
          </div>
        </section>

        {/* ── CẤU TRÚC CHƯƠNG TRÌNH ── */}
        <section className="solo01-band">
          <div className="solo01-wrap">
            <div className="solo01-eyebrow">Cấu trúc chương trình</div>
            <div className="solo01-stats">
              {[['24', 'buổi học'], ['3', 'chặng'], ['8', 'buổi mỗi chặng'], ['6', 'tháng']].map(([n, l]) => (
                <div key={l}><b>{n}</b><span>{l}</span></div>
              ))}
            </div>
            <div className="solo01-progress">
              {SOLO01_PROGRESSION.map((p, i) => (
                <div className="solo01-progress-item" key={p}>
                  <span className="solo01-progress-dot" style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
                  <span className="solo01-progress-label">{p}</span>
                  {i < SOLO01_PROGRESSION.length - 1 && <span className="solo01-progress-arrow">→</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VẤN ĐỀ KHOÁ HỌC GIẢI QUYẾT ── */}
        <section className="solo01-wrap solo01-gap">
          <div className="solo01-eyebrow">Khoá học này giải quyết điều gì?</div>
          <h2>Khoảng trống giữa “chơi được vài câu” và “tự dựng một bản Solo”</h2>
          <div className="solo01-gap-grid">
            <div className="solo01-gap-card ok">
              <div className="solo01-gap-title">Nhiều người đã có thể</div>
              <ul>
                <li>tìm và chơi một giai điệu;</li>
                <li>đọc TAB hoặc biết một số nốt trên cần đàn;</li>
                <li>đệm được một số hợp âm.</li>
              </ul>
            </div>
            <div className="solo01-gap-card miss">
              <div className="solo01-gap-title">Nhưng vẫn chưa biết</div>
              <ul>
                <li>làm thế nào để thêm bass vào melody;</li>
                <li>lựa chọn vị trí nốt nào trên cần đàn;</li>
                <li>kết hợp melody với hợp âm;</li>
                <li>dùng Slide, Hammer-on, Pull-off ở đâu;</li>
                <li>tự biến một bài hát yêu thích thành Solo Guitar.</li>
              </ul>
            </div>
          </div>
          <div className="solo01-note">SOLO-01 được xây dựng để nối chính khoảng trống đó.</div>
        </section>

        {/* ── TRIẾT LÝ HỌC ── */}
        <section className="solo01-band">
          <div className="solo01-wrap">
            <div className="solo01-eyebrow">Triết lý học</div>
            <h2>HỌC ĐẾN ĐÂU – CHƠI ĐƯỢC ĐẾN ĐÓ</h2>
            <p className="solo01-lead">
              Khóa học không đi theo cách: học lý thuyết nhiều tháng → sau đó mới chơi nhạc.
              Mỗi buổi kết hợp đủ 5 lớp nội dung:
            </p>
            <div className="solo01-chain">
              {SOLO01_PROGRESSION.map((s, i) => (
                <span key={s} className="solo01-chain-item">
                  <b>{s}</b>{i < SOLO01_PROGRESSION.length - 1 && <i>→</i>}
                </span>
              ))}
            </div>
            <div className="solo01-note">
              Mục tiêu: sau mỗi tuần, học viên phải <b>nghe thấy tiếng đàn của mình tiến bộ</b>.
            </div>
          </div>
        </section>

        {/* ── MỤC LỤC NHANH ── */}
        <nav className="solo01-wrap solo01-toc">
          {SOLO01_STAGES.map(s => (
            <a key={s.no} href={`#chang-${s.no}`} style={{ borderColor: STAGE_COLORS[s.no - 1], color: STAGE_COLORS[s.no - 1] }}>Chặng {s.no}</a>
          ))}
          <a href="#lich" className="solo01-toc-schedule">Lịch học dự kiến</a>
          <a href="#hocphi" className="solo01-toc-schedule">Học phí</a>
        </nav>

        {/* ── LỘ TRÌNH 3 CHẶNG (accordion) ── */}
        <section id="lotrinh" className="solo01-wrap solo01-stages">
          <div className="solo01-eyebrow">Lộ trình 24 buổi · 3 chặng</div>
          {SOLO01_STAGES.map(st => {
            const open = openStage === st.no
            const stColor = STAGE_COLORS[st.no - 1]
            return (
              <div key={st.no} id={`chang-${st.no}`} className="solo01-acc" style={{ borderColor: stColor }}>
                <button className="solo01-acc-head" onClick={() => setOpenStage(open ? 0 : st.no)} aria-expanded={open}>
                  <span className="solo01-acc-no" style={{ background: stColor }}>Chặng {st.no}</span>
                  <span className="solo01-acc-title">{st.title}<i>8 buổi</i></span>
                  <span className="solo01-acc-caret" style={{ color: stColor }}>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div className="solo01-acc-body">
                    {st.note && <p className="solo01-stage-note">★ {st.note}</p>}
                    <p className="solo01-stage-goal"><b>Mục tiêu:</b> {st.goal}</p>
                    {st.works && (
                      <div className="solo01-works">
                        <span>Tác phẩm mẫu</span>
                        {st.works.map(w => <b key={w}>{w}</b>)}
                      </div>
                    )}
                    <ol className="solo01-stage-lessons">
                      {st.lessons.map((l, i) => (
                        <li key={l.title}>
                          <span className="solo01-lesson-no" style={{ color: stColor, borderColor: stColor }}>{p2((st.no - 1) * 8 + i + 1)}</span>
                          <span className="solo01-lesson-body">
                            <b>{l.title}</b>
                            {l.points && <span className="solo01-lesson-points">{l.points.map(p => <i key={p}>{p}</i>)}</span>}
                            {l.doc && (() => {
                              // Buổi chưa tới giờ vẫn hiện và vẫn bấm được — vào sẽ thấy màn khoá.
                              const no = (st.no - 1) * 8 + i + 1
                              const open = soloLessonOpen(no)
                              return (
                                <a className={`solo01-lesson-doc${open ? '' : ' is-locked'}`} href={l.doc}
                                   style={open ? { color: stColor, borderColor: stColor } : undefined}>
                                  {open ? 'Giáo trình buổi học →' : `🔒 Mở ${soloUnlockLabel(l.unlockAt!)}`}
                                </a>
                              )
                            })()}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* ── LỊCH HỌC DỰ KIẾN (accordion theo chặng) — đọc từ class_sessions ── */}
        <section id="lich" className="solo01-wrap solo01-schedule">
          <div className="solo01-eyebrow">Khu vực lịch</div>
          <h2>LỊCH HỌC DỰ KIẾN</h2>
          <div className="solo01-notice">
            Đây là lịch dự kiến. Ngày học có thể được điều chỉnh theo lịch nghỉ lễ và tình hình thực tế.
            Mọi thay đổi chính thức sẽ được cập nhật trực tiếp trên hệ thống Class.
          </div>

          {loading ? (
            <div className="solo01-empty">Đang tải lịch…</div>
          ) : !cls || !sessions.length ? (
            <div className="solo01-empty">Lịch dự kiến sẽ được công bố tại đây khi lớp được mở.</div>
          ) : (
            <>
              <div className="solo01-sched-meta">
                <span>🕗 {startTime} – {endTime} · tối {SOLO01.weekdayLabel} hằng tuần · Giờ Việt Nam (GMT+7)</span>
                {firstLesson && lastLesson && <span>🗓 Buổi 1: {fmtDMY(ymdOf(new Date(firstLesson.start_at)))} → Buổi {lastLesson.session_number}: {fmtDMY(ymdOf(new Date(lastLesson.start_at)))}</span>}
              </div>
              {isDevFixture && <div className="solo01-devnote">⚙ Dữ liệu mẫu chế độ dev — chưa phải lịch thật trên hệ thống.</div>}

              <div className="solo01-legend">
                <span><i className="dot lesson" />Buổi học</span>
                <span><i className="dot brk" />Nghỉ giữa chặng</span>
                <span><i className="dot off" />Bỏ qua (nghỉ lễ)</span>
              </div>

              <div className="solo01-timeline">
                {SOLO01_STAGES.map((st, si) => {
                  const entries = byStage[si]
                  if (!entries?.length) return null
                  const open = openSched === st.no
                  const stColor = STAGE_COLORS[si]
                  const ls = entries.filter(e => e.kind === 'lesson')
                  const brs = entries.filter(e => e.kind === 'break')
                  const offs = entries.filter(e => e.kind === 'off')
                  return (
                    <div key={st.no} className="solo01-sched-stage">
                      <button className="solo01-sched-head" onClick={() => setOpenSched(open ? 0 : st.no)} aria-expanded={open}>
                        <span className="solo01-sched-no" style={{ background: stColor }}>Chặng {st.no}</span>
                        <span className="solo01-sched-range">
                          <b>{stageRange(entries)}</b>
                          <span>{ls.length} buổi{brs.length ? ` · nghỉ ${brs.length} tuần` : ''}{offs.length ? ` · bỏ qua ${offs.length} ngày` : ''}</span>
                        </span>
                        <span className="solo01-acc-caret" style={{ color: stColor }}>{open ? '−' : '+'}</span>
                      </button>
                      {open && (
                        <div className="solo01-sched-body">
                          {entries.map((t, idx) => {
                            if (t.kind === 'lesson') {
                              const num = t.session?.session_number ?? 0
                              const stt = SESS_STATUS[t.session?.status ?? 'scheduled']
                              return (
                                <div key={idx} className="solo01-tl-row" style={{ borderLeftColor: stColor }}>
                                  <div className="solo01-tl-date">
                                    <b>{fmtDM(t.date)}</b>
                                    <span>{WEEKDAY_VI[t.date.getDay()]}</span>
                                  </div>
                                  <div className="solo01-tl-body">
                                    <div className="solo01-tl-title">
                                      <span className="solo01-tl-num" style={{ background: `${stColor}18`, color: stColor }}>Buổi {p2(num)}</span>
                                      <span className="solo01-tl-name">{t.session?.title ? t.session.title.replace(/^Buổi \d+ · /, '') : st.lessons[(num - 1) % 8]?.title}</span>
                                    </div>
                                    <div className="solo01-tl-foot">
                                      <span className="solo01-tl-time">{startTime}</span>
                                      <span className="solo01-tl-status" style={{ color: stt.c, background: `${stt.c}14` }}>{stt.l}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            if (t.kind === 'break') {
                              return (
                                <div key={idx} className="solo01-tl-row solo01-tl-break">
                                  <div className="solo01-tl-date"><b>{fmtDM(t.date)}</b><span>{WEEKDAY_VI[t.date.getDay()]}</span></div>
                                  <div className="solo01-tl-body">
                                    <div className="solo01-tl-title"><span className="solo01-tl-brk">✕ Nghỉ giữa chặng</span></div>
                                    <div className="solo01-tl-foot"><span className="solo01-tl-breaknote">tự luyện và hoàn thiện sản phẩm</span></div>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div key={idx} className="solo01-tl-row solo01-tl-off">
                                <div className="solo01-tl-date"><b>{fmtDM(t.date)}</b><span>{WEEKDAY_VI[t.date.getDay()]}</span></div>
                                <div className="solo01-tl-body">
                                  <div className="solo01-tl-title"><span className="solo01-tl-offtag">Bỏ qua</span><span className="solo01-tl-name">{t.offReason}</span></div>
                                  <div className="solo01-tl-foot"><span className="solo01-tl-breaknote">buổi dời sang tuần phù hợp tiếp theo</span></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* ── KỸ NĂNG "BÀN GIẤY" ── */}
        <section className="solo01-band">
          <div className="solo01-wrap">
            <div className="solo01-eyebrow">Điểm khác biệt</div>
            <h2>KHÔNG CHỈ CẦM ĐÀN – HỌC CÁCH TỰ DỰNG BÀI</h2>
            <p className="solo01-lead">
              Học viên từng bước học cách đưa những gì mình nghe và chơi được thành một bản nháp
              có thể nhìn thấy và chỉnh sửa. Không bắt buộc tất cả phải biết ký âm chuyên nghiệp —
              tuỳ nền tảng, học viên có thể sử dụng:
            </p>
            <div className="solo01-tags">
              {SOLO01_NOTATION.map(t => <span key={t}>{t}</span>)}
            </div>
            <div className="solo01-note">
              Công cụ có thể khác nhau. Đích đến giống nhau: <b>tự dựng được bài hát mình yêu thích</b>.
            </div>
          </div>
        </section>

        {/* ── PHƯƠNG PHÁP HỌC ── */}
        <section className="solo01-wrap solo01-method">
          <div className="solo01-eyebrow">Phương pháp học</div>
          <h2>Học dài hạn — chuẩn bị trước, thực hành cùng Thầy</h2>
          <div className="solo01-steps">
            <div className="solo01-step">
              <span className="solo01-step-tag">Trước buổi học</span>
              <p>Học viên nhận <b>video</b>, <b>tài liệu</b>, <b>TAB/Sheet</b> (nếu có) và <b>bài tập thực hành</b> trước khoảng 1 tuần.</p>
            </div>
            <div className="solo01-step">
              <span className="solo01-step-tag">Trong tuần</span>
              <p>Tự luyện tập. Đặt câu hỏi ngay khi gặp vướng mắc.</p>
            </div>
            <div className="solo01-step">
              <span className="solo01-step-tag">Buổi học</span>
              <p>Không dành phần lớn thời gian để lần đầu tiếp xúc kiến thức. Buổi học tập trung vào:
                <b> kiểm tra → sửa lỗi → giải đáp → hướng dẫn sâu → thực hành cùng Thầy</b>.</p>
            </div>
          </div>
        </section>

        {/* ── ĐÍCH ĐẾN CUỐI KHOÁ ── */}
        <section className="solo01-band solo01-dest">
          <div className="solo01-wrap">
            <div className="solo01-eyebrow">Đích đến cuối khoá</div>
            <h2>SAU 24 BUỔI, BẠN KHÔNG CHỈ BIẾT CHƠI MỘT VÀI BẢN SOLO</h2>
            <p className="solo01-lead">Mà có một phương pháp làm việc của riêng mình:</p>
            <ol className="solo01-flow">
              {SOLO01_METHOD.map((s, i) => (
                <li key={s}><span className="solo01-flow-no">{p2(i + 1)}</span>{s}</li>
              ))}
            </ol>
            <div className="solo01-flow-end">TỰ HOÀN THIỆN BÀI SOLO GUITAR CỦA MÌNH</div>
          </div>
        </section>

        {/* ── HỌC PHÍ ── */}
        <section id="hocphi" className="solo01-wrap solo01-pricing">
          <div className="solo01-eyebrow">Học phí &amp; cách tham gia</div>
          <h2>CHỌN CÁCH HỌC PHÙ HỢP VỚI BẠN</h2>
          <p className="solo01-pricing-intro">
            Khoá SOLO-01 kéo dài 24 buổi / khoảng 6 tháng — bạn có thể đóng từng tháng hoặc chọn gói trọn khoá.
          </p>
          <div className="solo01-price-grid">
            {SOLO01_PRICES.map(pkg => (
              <div key={pkg.name} className={`solo01-price-card${pkg.highlight ? ' hot' : ''}`}>
                {pkg.highlight && <span className="solo01-price-badge">Phổ biến</span>}
                <div className="solo01-price-name">{pkg.name}</div>
                <div className="solo01-price-amount">{pkg.priceVnd.toLocaleString('vi-VN')}đ<span className="solo01-price-unit"> / {pkg.unit}</span></div>
                <div className="solo01-price-desc">{pkg.desc}</div>
                <a className="solo01-btn primary solo01-price-cta" href={ZALO_LINK} target="_blank" rel="noreferrer">Đăng ký qua Zalo</a>
              </div>
            ))}
          </div>
          <div className="solo01-pricing-foot">
            Chưa chắc trình độ của mình phù hợp chưa? Cứ nhắn Thầy — Thầy sẽ tư vấn lớp phù hợp nhất.
          </div>
        </section>

        {/* ── CTA CUỐI TRANG ── */}
        <section className="solo01-wrap solo01-cta">
          <div className="solo01-cta-card">
            <div className="solo01-cta-title">BÀI SOLO ĐẦU TIÊN BẠN TỰ DỰNG SẼ LÀ BÀI NÀO?</div>
            <p>Nhắn Thầy qua Zalo để giữ chỗ cho khoá SOLO-01 — Thầy sẽ hướng dẫn bạn từng bước.</p>
            <div className="solo01-cta-facts">
              {['24 buổi', '3 chặng', `${SOLO01.startTime} ${SOLO01.weekdayLabel}`, '499k / tháng', 'Gói 6 tháng: 396k / tháng'].map(f => <span key={f}>{f}</span>)}
            </div>
            <div className="solo01-cta-btns">
              <a className="solo01-btn primary" href={ZALO_LINK} target="_blank" rel="noreferrer">ĐĂNG KÝ SOLO-01 →</a>
              <a className="solo01-btn ghost" href="#lotrinh">Xem lộ trình 24 buổi</a>
            </div>
          </div>
        </section>

        <footer className="solo01-foot">
          <div className="solo01-wrap">
            <p>Học đến đâu – chơi được đến đó. Đích đến không phải là thuộc một bản Solo, mà là tự dựng được bài hát mình yêu thích.</p>
            <div className="solo01-foot-row">
              <img src="/logo.png" alt="" />
              <span>Thầy Văn Anh · Guitar</span>
              <span className="solo01-foot-right">Zalo 0983 259 893</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');
.solo01{--p:${P.purple};--pd:${P.purpleDark};--pt:${P.purpleTint};background:${P.bg};color:${P.ink};font-family:'Be Vietnam Pro',system-ui,sans-serif;line-height:1.6;font-size:16px;min-height:100vh;text-align:left;color-scheme:light;overflow-x:hidden;}
.solo01 *{box-sizing:border-box;margin:0;}
.solo01 ::selection{background:${P.purple};color:#fff;}
.solo01 .solo01-wrap{max-width:760px;margin:0 auto;padding:0 20px;}
.solo01 a{color:${P.purple};}

/* thanh trên */
.solo01-top{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 16px;background:rgba(247,245,252,.95);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.solo01-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:${P.ink};font-size:13.5px;font-weight:700;}
.solo01-brand img{width:26px;height:26px;display:block;}
.solo01-brand i{color:${P.purple};font-style:normal;}
.solo01-topback{margin-left:auto;font-size:13px;font-weight:600;color:${P.inkSoft};text-decoration:none;border:1px solid ${P.line};border-radius:999px;padding:7px 14px;background:#fff;white-space:nowrap;}
.solo01-topback:hover{color:${P.purple};border-color:${P.purple};}

/* hero */
.solo01-hero{padding:52px 0 44px;background:linear-gradient(180deg,#F0EDFB 0%,${P.bg} 100%);}
.solo01-kicker{display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${P.honey};margin-bottom:18px;}
.solo01-kicker span{width:26px;height:2px;background:${P.honey};flex-shrink:0;}
.solo01-hero h1{font-size:clamp(30px,7vw,52px);line-height:1.08;letter-spacing:-.02em;color:${P.ink};font-weight:900;margin-bottom:8px;}
.solo01-hero h1 span{color:${P.purple};}
.solo01-sub{font-size:clamp(17px,2.6vw,22px);font-weight:700;color:${P.inkSoft};margin-bottom:16px;}
.solo01-lead{font-size:15px;color:${P.inkSoft};line-height:1.7;margin-bottom:12px;text-wrap:pretty;}
.solo01-timechip{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;background:${P.purpleDeep};color:#fff;border-radius:16px;padding:15px 22px;margin:18px 0;}
.solo01-timechip-big{font-size:clamp(28px,5.5vw,40px);font-weight:900;letter-spacing:-.02em;line-height:1;}
.solo01-timechip-sub{font-size:14px;color:rgba(255,255,255,.88);}
.solo01-timechip-sub b{color:#fff;}

/* band chung */
.solo01-band{padding:44px 0;background:#fff;border-top:1px solid ${P.line};border-bottom:1px solid ${P.line};}
.solo01-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${P.honey};margin-bottom:12px;}
.solo01 h2{font-size:clamp(21px,3.6vw,30px);font-weight:800;line-height:1.22;letter-spacing:-.015em;color:${P.ink};margin-bottom:16px;}
.solo01-note{font-size:13.5px;color:${P.inkSoft};background:${P.purpleTint};border-radius:12px;padding:13px 15px;line-height:1.7;margin-top:14px;}
.solo01-note b{color:${P.purple};}

/* cấu trúc chương trình */
.solo01-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:${P.line};border:1px solid ${P.line};border-radius:14px;overflow:hidden;margin:20px 0;}
.solo01-stats>div{background:#fff;padding:16px 10px;text-align:center;}
.solo01-stats b{display:block;font-size:clamp(22px,3.4vw,30px);font-weight:900;color:${P.purple};line-height:1;}
.solo01-stats span{display:block;font-size:12px;color:${P.inkFaint};margin-top:6px;line-height:1.35;}
@media(max-width:480px){.solo01-stats{grid-template-columns:repeat(2,1fr);}}
.solo01-progress{display:flex;flex-wrap:wrap;align-items:center;gap:8px 6px;}
.solo01-progress-item{display:flex;align-items:center;gap:7px;}
.solo01-progress-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.solo01-progress-label{font-size:13px;font-weight:600;color:${P.inkSoft};}
.solo01-progress-arrow{color:#C9C3DE;font-size:13px;}

/* vấn đề */
.solo01-gap{padding:44px 0 8px;}
.solo01-gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.solo01-gap-card{background:#fff;border:1px solid ${P.line};border-radius:16px;padding:18px 18px 16px;}
.solo01-gap-card.ok{border-left:4px solid ${P.ok};}
.solo01-gap-card.miss{border-left:4px solid ${P.honey};}
.solo01-gap-title{font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${P.inkFaint};margin-bottom:10px;}
.solo01-gap-card.ok .solo01-gap-title{color:${P.ok};}
.solo01-gap-card.miss .solo01-gap-title{color:${P.honey};}
.solo01-gap-card ul{list-style:none;display:flex;flex-direction:column;gap:7px;}
.solo01-gap-card li{font-size:14px;color:${P.ink};line-height:1.55;padding-left:16px;position:relative;}
.solo01-gap-card li:before{content:'';position:absolute;left:0;top:9px;width:6px;height:6px;border-radius:50%;background:${P.line};}
.solo01-gap-card.ok li:before{background:${P.ok};}
.solo01-gap-card.miss li:before{background:${P.honey};}
@media(max-width:700px){.solo01-gap-grid{grid-template-columns:1fr;}}

/* chuỗi triết lý */
.solo01-chain{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:6px 0 4px;}
.solo01-chain-item{display:flex;align-items:center;gap:8px;}
.solo01-chain-item b{font-size:13.5px;font-weight:700;color:${P.purple};background:${P.purpleTint};border-radius:999px;padding:6px 13px;}
.solo01-chain-item i{color:#C9C3DE;font-style:normal;font-size:13px;}

/* mục lục nhanh */
.solo01-toc{display:flex;flex-wrap:wrap;gap:8px;padding:24px 20px 4px;}
.solo01-toc a{text-decoration:none;font-size:13px;font-weight:700;border:1.5px solid;border-radius:999px;padding:7px 15px;background:#fff;}
.solo01-toc .solo01-toc-schedule{background:${P.purple};color:#fff !important;border-color:${P.purple} !important;}

/* 3 chặng — accordion */
.solo01-stages{padding:30px 20px 10px;}
.solo01-acc{border:1px solid;border-left-width:4px;border-radius:14px;background:#fff;margin-bottom:10px;overflow:hidden;}
.solo01-acc-head{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:#fff;border:none;cursor:pointer;font-family:inherit;text-align:left;}
.solo01-acc-no{flex-shrink:0;color:#fff;font-size:11.5px;font-weight:800;border-radius:8px;padding:5px 10px;}
.solo01-acc-title{flex:1;min-width:0;font-size:15px;font-weight:700;color:${P.ink};line-height:1.4;}
.solo01-acc-title i{display:block;font-style:normal;font-size:12px;font-weight:600;color:${P.inkFaint};margin-top:2px;}
.solo01-acc-caret{flex-shrink:0;font-size:20px;font-weight:700;line-height:1;}
.solo01-acc-body{padding:4px 16px 16px;border-top:1px solid ${P.line};}
.solo01-stage-note{font-size:13px;font-weight:700;color:#8A4B06;background:${P.honeyTint};border-radius:10px;padding:9px 12px;margin-top:12px;}
.solo01-stage-goal{font-size:14px;color:${P.inkSoft};line-height:1.65;margin:12px 0 6px;text-wrap:pretty;}
.solo01-stage-goal b{color:${P.ink};}
.solo01-works{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 2px;}
.solo01-works span{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${P.honey};}
.solo01-works b{font-size:13px;font-weight:700;color:${P.ink};background:${P.bg};border:1px solid ${P.line};border-radius:999px;padding:5px 12px;}
.solo01-stage-lessons{list-style:none;display:flex;flex-direction:column;}
.solo01-stage-lessons li{display:flex;gap:11px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed ${P.line};font-size:14.5px;color:${P.ink};}
.solo01-stage-lessons li:last-child{border-bottom:none;}
.solo01-lesson-no{flex-shrink:0;font-size:11px;font-weight:800;border:1.5px solid;border-radius:6px;padding:1px 6px;letter-spacing:.04em;margin-top:3px;}
.solo01-lesson-body{flex:1;min-width:0;}
.solo01-lesson-body>b{font-weight:700;line-height:1.45;}
.solo01-lesson-doc{display:inline-block;margin-top:8px;font-size:12.5px;font-weight:700;
  text-decoration:none;border:1.5px solid;border-radius:999px;padding:4px 12px;background:#fff;}
.solo01-lesson-doc:hover{background:${P.purpleTint};}
.solo01-lesson-doc.is-locked{color:${P.inkFaint};border-color:${P.line};background:#F6F5FA;font-weight:600;}
.solo01-lesson-points{display:flex;flex-direction:column;gap:3px;margin-top:5px;}
.solo01-lesson-points i{font-style:normal;font-size:13.5px;color:${P.inkSoft};line-height:1.5;padding-left:13px;position:relative;}
.solo01-lesson-points i:before{content:'';position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;background:#C9C3DE;}

/* lịch — accordion theo chặng (khuôn /hanhtrinh2027) */
.solo01-schedule{padding:44px 0 16px;}
.solo01-notice{background:${P.honeyTint};border:1px solid #EFD9B3;border-left:4px solid ${P.honey};border-radius:12px;padding:12px 15px;font-size:13.5px;color:#6B4A12;line-height:1.65;margin-bottom:16px;}
.solo01-empty{padding:40px 20px;text-align:center;color:${P.inkFaint};font-size:15px;background:#fff;border:1px dashed ${P.line};border-radius:14px;}
.solo01-sched-meta{display:flex;flex-direction:column;gap:4px;font-size:13.5px;color:${P.inkSoft};background:#fff;border:1px solid ${P.line};border-radius:12px;padding:11px 15px;margin-bottom:10px;}
.solo01-devnote{font-size:12.5px;color:#92400E;background:#FEF3C7;border-radius:8px;padding:7px 12px;margin-bottom:10px;}
.solo01-legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12.5px;color:${P.inkFaint};margin:12px 0;}
.solo01-legend .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px;}
.solo01-legend .dot.lesson{background:${P.purple};}
.solo01-legend .dot.brk{background:#fff;border:2px solid ${P.honey};}
.solo01-legend .dot.off{background:#D1D5DB;}
.solo01-sched-stage{border:1px solid ${P.line};border-radius:14px;background:#fff;margin-bottom:10px;overflow:hidden;}
.solo01-sched-head{display:flex;align-items:center;gap:12px;width:100%;padding:13px 15px;background:#fff;border:none;cursor:pointer;font-family:inherit;text-align:left;}
.solo01-sched-no{flex-shrink:0;color:#fff;font-size:11.5px;font-weight:800;border-radius:8px;padding:5px 10px;}
.solo01-sched-range{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3;}
.solo01-sched-range b{font-size:14.5px;color:${P.ink};font-weight:700;}
.solo01-sched-range span{font-size:12px;color:${P.inkFaint};}
.solo01-sched-body{border-top:1px solid ${P.line};padding:4px 14px 10px;}
.solo01-tl-row{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid ${P.line};border-left:3px solid ${P.purple};padding-left:12px;}
.solo01-tl-row:last-child{border-bottom:none;}
.solo01-tl-date{flex-shrink:0;width:66px;text-align:left;}
.solo01-tl-date b{display:block;font-size:14.5px;font-weight:800;color:${P.ink};letter-spacing:.01em;}
.solo01-tl-date span{font-size:11px;color:${P.inkFaint};}
.solo01-tl-body{flex:1;min-width:0;}
.solo01-tl-title{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;}
.solo01-tl-num{font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;flex-shrink:0;}
.solo01-tl-name{font-size:14px;font-weight:600;color:${P.ink};line-height:1.45;}
.solo01-tl-foot{display:flex;gap:8px;align-items:center;margin-top:3px;flex-wrap:wrap;}
.solo01-tl-time{font-size:11.5px;color:${P.inkFaint};}
.solo01-tl-status{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px;}
.solo01-tl-break{background:${P.honeyTint};border-left-color:${P.honey};border-radius:0 8px 8px 0;margin:6px 0;padding:8px 12px;}
.solo01-tl-brk{font-size:12px;font-weight:800;color:#8A4B06;letter-spacing:.02em;}
.solo01-tl-breaknote{font-size:11.5px;color:#7A5A28;font-style:italic;}
.solo01-tl-off{background:#F7F7F9;border-left-color:#C9CBD6;border-radius:0 8px 8px 0;margin:6px 0;padding:8px 12px;}
.solo01-tl-offtag{font-size:10.5px;font-weight:800;color:#4B5563;background:#E5E7EB;border-radius:6px;padding:2px 7px;flex-shrink:0;}
.solo01-tl-off .solo01-tl-name{color:${P.inkFaint};font-weight:500;}

/* tags ký âm */
.solo01-tags{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 2px;}
.solo01-tags span{font-size:13px;font-weight:600;color:${P.inkSoft};background:${P.bg};border:1px solid ${P.line};border-radius:999px;padding:7px 14px;}

/* phương pháp học */
.solo01-method{padding:44px 0 8px;}
.solo01-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
.solo01-step{background:#fff;border:1px solid ${P.line};border-left:4px solid ${P.purple};border-radius:14px;padding:16px 16px 15px;}
.solo01-step-tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:${P.purple};border-radius:999px;padding:4px 11px;margin-bottom:9px;}
.solo01-step p{font-size:13.5px;color:${P.inkSoft};line-height:1.65;}
.solo01-step p b{color:${P.ink};}
@media(max-width:700px){.solo01-steps{grid-template-columns:1fr;}}

/* đích đến */
.solo01-flow{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 0;}
.solo01-flow li{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:${P.ink};background:${P.bg};border:1px solid ${P.line};border-radius:999px;padding:7px 14px 7px 7px;}
.solo01-flow-no{font-size:10.5px;font-weight:800;color:#fff;background:${P.purple};border-radius:999px;padding:3px 8px;}
.solo01-flow-end{margin-top:14px;background:${P.purpleDeep};color:#fff;border-radius:16px;padding:18px 20px;font-size:clamp(15px,2.6vw,20px);font-weight:900;letter-spacing:-.01em;text-align:center;}

/* học phí */
.solo01-pricing{padding:44px 0 8px;}
.solo01-pricing-intro{font-size:14.5px;color:${P.inkSoft};line-height:1.7;margin-bottom:18px;max-width:600px;}
.solo01-price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.solo01-price-card{position:relative;background:#fff;border:1.5px solid ${P.line};border-radius:16px;padding:20px 18px;display:flex;flex-direction:column;}
.solo01-price-card.hot{border-color:${P.purple};box-shadow:0 6px 22px rgba(67,56,202,.12);}
.solo01-price-badge{position:absolute;top:-10px;right:14px;background:${P.purple};color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:4px 10px;}
.solo01-price-name{font-size:14.5px;font-weight:700;color:${P.ink};margin-bottom:6px;}
.solo01-price-amount{font-size:clamp(22px,3.4vw,30px);font-weight:900;color:${P.purple};line-height:1.1;letter-spacing:-.02em;white-space:nowrap;}
.solo01-price-unit{font-size:14px;font-weight:600;color:${P.inkFaint};letter-spacing:0;}
.solo01-price-desc{font-size:13px;color:${P.inkSoft};line-height:1.6;margin:10px 0 16px;flex:1;}
.solo01-price-cta{display:block;text-align:center;padding:11px 14px;font-size:13.5px;}
.solo01-pricing-foot{margin-top:16px;font-size:13px;color:${P.inkFaint};text-align:center;}
@media(max-width:700px){.solo01-price-grid{grid-template-columns:1fr;}.solo01-price-card{padding:18px 16px;}}

/* CTA */
.solo01-cta{padding:44px 0;}
.solo01-cta-card{background:${P.purpleDeep};color:#fff;border-radius:20px;padding:28px 24px;text-align:center;}
.solo01-cta-title{font-size:clamp(18px,3vw,24px);font-weight:800;letter-spacing:-.01em;margin-bottom:10px;}
.solo01-cta-card p{font-size:14px;color:rgba(255,255,255,.85);line-height:1.7;max-width:540px;margin:0 auto 16px;}
.solo01-cta-facts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:18px;}
.solo01-cta-facts span{font-size:12.5px;font-weight:700;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:6px 13px;}
.solo01-cta-btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.solo01-cta-btns.left{justify-content:flex-start;margin-top:4px;}
.solo01-btn{display:inline-block;text-decoration:none;font-size:14.5px;font-weight:700;border-radius:999px;padding:12px 22px;cursor:pointer;font-family:inherit;}
.solo01-btn.primary{background:${P.purple};color:#fff;border:1.5px solid ${P.purple};}
.solo01-btn.primary:hover{background:#4F46E5;}
.solo01-btn.ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.5);}
.solo01-btn.ghost:hover{border-color:#fff;}
.solo01-btn.outline{background:#fff;color:${P.purple};border:1.5px solid ${P.purple};}
.solo01-btn.outline:hover{background:${P.purpleTint};}

/* footer */
.solo01-foot{background:${P.purpleDeep};color:rgba(255,255,255,.75);padding:38px 0 34px;}
.solo01-foot p{font-size:clamp(15px,2.2vw,19px);line-height:1.5;color:#fff;margin-bottom:24px;max-width:620px;text-wrap:pretty;}
.solo01-foot-row{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding-top:18px;border-top:1px solid rgba(255,255,255,.16);font-size:13px;}
.solo01-foot-row img{width:26px;height:26px;filter:brightness(0) invert(1);opacity:.85;}
.solo01-foot-right{margin-left:auto;color:rgba(255,255,255,.55);}

@media(max-width:480px){.solo01-tl-date{width:58px;}.solo01-topback{font-size:12px;padding:6px 11px;}.solo01-btn{padding:11px 18px;font-size:14px;}}
`
