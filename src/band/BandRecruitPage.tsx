// /band/<slug> — trang tuyển thành viên CÔNG KHAI của một Band (khách xem được, không cần đăng nhập).
// Một component cho MỌI Band: hồ sơ + đợt tuyển + Rule đến từ RPC band_recruitment_public.
// Gửi đơn không bắt buộc đăng nhập (ít ma sát, như form đăng ký ở Trang Class); đã đăng nhập thì
// server tự gắn tài khoản vào đơn. Dùng chung khung + token tím-trắng của Class Social (classSocial.css).
// CSS nạp ở container (BandRecruitRoute) — file này không import CSS để test render trên Node chạy được.
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Music2, Sparkles, UserRound } from 'lucide-react'
import { ClassHomeLink } from '../class-social/ui'
import { CLASS_HOME_PATH } from '../class-social/resolveMeRoute'
import BandApplicationForm, { type SubmitFn } from './BandApplicationForm'
import { fetchBandPublic, submitBandApplication, type ApplyOutcome, type Result } from './bandApi'
import type { BandPublic } from './bandModel'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'missing' } | { status: 'ready'; data: BandPublic }

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="cs-root cs-band-root">
      <header className="cs-topbar">
        <a className="cs-brand" href={CLASS_HOME_PATH} aria-label="Thầy Văn Anh Guitar — Trang Class">
          <img className="cs-brand-logo" src="/logo-green.svg" alt="" width={30} height={29} />
          <span className="cs-brand-text">Thầy Văn Anh Guitar</span>
        </a>
        <div className="cs-topbar-spacer" />
        <ClassHomeLink />
      </header>
      <main className="cs-band-main">{children}</main>
    </div>
  )
}

/** Phần hiển thị THUẦN (không gọi mạng) — test render được. */
export function BandRecruitView({ data, submit, onReload, submitted, onSubmitted }: {
  data: BandPublic
  submit: SubmitFn
  onReload?: () => void
  submitted: ApplyOutcome | null
  onSubmitted: (o: ApplyOutcome) => void
}) {
  const { band, recruitment, rules } = data
  const facts: { icon: typeof Music2; label: string; value: string }[] = []
  if (band.leaderName) facts.push({ icon: UserRound, label: 'Band Leader', value: band.leaderName })
  if (band.musicStyle) facts.push({ icon: Music2, label: 'Gu nhạc', value: band.musicStyle })
  if (band.scheduleText) facts.push({ icon: CalendarClock, label: 'Lịch dự kiến', value: band.scheduleText })

  return (
    <div className="cs-band-page">
      <section className="cs-band-hero">
        <div className="cs-band-kicker">Ban nhạc · Tuyển thành viên</div>
        <h1 className="cs-band-name">{band.name}</h1>
        {band.tagline && <p className="cs-band-tagline">{band.tagline}</p>}
        {recruitment && !submitted && <a className="cs-btn cs-band-hero-cta" href="#ung-tuyen">Ứng tuyển ngay</a>}
      </section>

      <section className="cs-card cs-band-card" aria-label="Thông tin Band">
        <ul className="cs-band-facts">
          {facts.map(f => (
            <li key={f.label}><f.icon size={18} strokeWidth={2} aria-hidden="true" /><div><span>{f.label}</span><b>{f.value}</b></div></li>
          ))}
          {band.highlights.map(h => (
            <li key={h.label}><Sparkles size={18} strokeWidth={2} aria-hidden="true" /><div><span>{h.label}</span><b>{h.value}</b></div></li>
          ))}
        </ul>
        {band.referenceSongs.length > 0 && (
          <div className="cs-band-songs">
            <div className="cs-band-sub">Bài tham chiếu</div>
            <ul>
              {band.referenceSongs.map(s => (
                <li key={s.title}>
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}
                  {s.artist && <span> · {s.artist}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {band.description && <p className="cs-band-desc">{band.description}</p>}
      </section>

      {!recruitment || !rules ? (
        <section className="cs-card cs-band-card cs-band-closed">
          <h2>Band hiện chưa mở đợt tuyển</h2>
          <p>Hãy quay lại sau, hoặc theo dõi Trang Class để biết khi Band tuyển thành viên mới.</p>
        </section>
      ) : submitted ? (
        <section className="cs-card cs-band-card cs-band-done" role="status" id="ung-tuyen">
          <CheckCircle2 size={40} strokeWidth={1.8} aria-hidden="true" />
          <h2>{submitted.duplicate ? 'Bạn đã gửi đơn trước đó' : 'Đã gửi đơn ứng tuyển'}</h2>
          <p>{submitted.duplicate
            ? 'Đơn của bạn đang được xem xét — không cần gửi lại.'
            : recruitment.successMessage ?? 'Cảm ơn bạn! Band sẽ liên hệ với bạn sớm.'}</p>
          <a className="cs-btn cs-btn-ghost" href={CLASS_HOME_PATH}>Về Trang Class</a>
        </section>
      ) : (
        <section className="cs-card cs-band-card" id="ung-tuyen" aria-labelledby="band-apply-title">
          <h2 id="band-apply-title" className="cs-band-h2">{recruitment.title}</h2>
          {recruitment.intro && <p className="cs-band-intro">{recruitment.intro}</p>}
          <div className="cs-band-sub">Vị trí đang tuyển</div>
          <ul className="cs-band-chips">{recruitment.positions.map(p => <li key={p.key}>{p.label}</li>)}</ul>
          <hr className="cs-band-sep" />
          <BandApplicationForm recruitment={recruitment} rules={rules} submit={submit} onSubmitted={onSubmitted} onRulesChanged={onReload} />
        </section>
      )}
    </div>
  )
}

export default function BandRecruitPage({ slug, submit = submitBandApplication, load = fetchBandPublic }: {
  slug: string
  submit?: SubmitFn
  load?: (slug: string) => Promise<Result<BandPublic | null>>
}) {
  const [state, setState] = useState<Load>({ status: 'loading' })
  const [submitted, setSubmitted] = useState<ApplyOutcome | null>(null)

  const reload = useCallback(() => {
    void load(slug).then(r => {
      if (!r.ok) setState({ status: 'error', message: r.message })
      else if (!r.value) setState({ status: 'missing' })
      else setState({ status: 'ready', data: r.value })
    })
  }, [slug, load])
  useEffect(reload, [reload])

  useEffect(() => {
    if (state.status === 'ready') document.title = `${state.data.band.name} · Tuyển thành viên · Thầy Văn Anh Guitar`
  }, [state])

  const onSubmitted = (o: ApplyOutcome) => {
    setSubmitted(o)
    requestAnimationFrame(() => document.getElementById('ung-tuyen')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <Frame>
      {state.status === 'loading' && <div className="cs-splash" role="status"><div><div className="cs-spinner" />Đang tải…</div></div>}
      {state.status === 'error' && (
        <section className="cs-card cs-band-card cs-band-closed">
          <h2>Chưa tải được trang</h2>
          <p>{state.message}</p>
          <button type="button" className="cs-btn cs-btn-primary" onClick={() => { setState({ status: 'loading' }); reload() }}>Thử lại</button>
        </section>
      )}
      {state.status === 'missing' && (
        <section className="cs-card cs-band-card cs-band-closed">
          <h2>Không tìm thấy Band</h2>
          <p>Đường link có thể đã sai hoặc Band chưa công khai.</p>
          <a className="cs-btn cs-btn-ghost" href={CLASS_HOME_PATH}>Về Trang Class</a>
        </section>
      )}
      {state.status === 'ready' && (
        <BandRecruitView data={state.data} submit={submit} onReload={reload} submitted={submitted} onSubmitted={onSubmitted} />
      )}
    </Frame>
  )
}
