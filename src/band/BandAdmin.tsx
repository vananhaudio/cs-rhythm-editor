// Admin V1 trong /me (Thầy/admin, hoặc Leader của chính Band — server quyết qua band_can_manage):
//  /me/bands          → các Band mình quản lý + số đơn
//  /me/bands/<slug>   → đơn ứng tuyển của Band: lọc theo trạng thái, đổi NEW/REVIEWING/ACCEPTED/REJECTED
// CSS (band.css) nạp ở container ClassSocialPage. Cột câu hỏi KHÔNG hardcode: dịch key → nhãn bằng config đợt tuyển server trả kèm.
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Inbox, Users } from 'lucide-react'
import { EmptyState } from '../class-social/ui'
import { fetchAdminBandDetail, fetchAdminBands, setApplicationStatus } from './bandApi'
import {
  APPLICATION_STATUSES, STATUS_LABEL, answerLabel, bandPublicPath, countByStatus, filterApplications, formatDateTime, positionLabel,
  type AdminApplication, type AdminBand, type AdminBandDetail, type AdminRecruitment, type ApplicationStatus,
} from './bandModel'

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }

export function BandsAdminView({ bands, onOpenBand }: { bands: AdminBand[]; onOpenBand: (slug: string) => void }) {
  if (bands.length === 0) {
    return <EmptyState icon={Users} title="Chưa có Band nào">Band được tạo bằng dữ liệu (xem docs/BAND-RECRUIT-V1.md). Tạo xong sẽ hiện ở đây.</EmptyState>
  }
  return (
    <ul className="cs-band-admin-list">
      {bands.map(b => (
        <li key={b.id}>
          <button type="button" className="cs-card cs-band-admin-band" onClick={() => onOpenBand(b.slug)}>
            <div className="cs-band-admin-band-main">
              <b>{b.name}</b>
              <span>{b.recruitmentStatus === 'open' ? 'Đang tuyển' : b.recruitmentStatus === 'closed' ? 'Đã đóng tuyển' : 'Chưa mở tuyển'}
                {b.status !== 'active' ? ' · Band chưa công khai' : ''}</span>
            </div>
            <div className="cs-band-admin-counts">
              {b.fresh > 0 && <span className="cs-band-status is-new">{b.fresh} mới</span>}
              <span>{b.total} đơn</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function BandsAdminPage({ onOpenBand }: { onOpenBand: (slug: string) => void }) {
  const [state, setState] = useState<Load<AdminBand[]>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void fetchAdminBands().then(r => { if (alive) setState(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [])
  return (
    <div className="cs-col cs-band-admin">
      <h1 className="cs-page-title">Tuyển thành viên Band</h1>
      {state.status === 'loading' && <p className="cs-loading">Đang tải…</p>}
      {state.status === 'error' && <p className="cs-form-error" role="alert">{state.message}</p>}
      {state.status === 'ready' && <BandsAdminView bands={state.value} onOpenBand={onOpenBand} />}
    </div>
  )
}

function ApplicationCard({ a, rec, busy, error, onStatus }: {
  a: AdminApplication
  rec: AdminRecruitment | undefined
  busy: boolean
  error: string | null
  onStatus: (s: ApplicationStatus) => void
}) {
  return (
    <li className="cs-card cs-band-app">
      <div className="cs-band-app-head">
        <div>
          <b className="cs-band-app-name">{a.fullName}</b>
          <a className="cs-band-app-phone" href={`tel:${a.phone}`}>{a.phone}</a>
        </div>
        <span className={`cs-band-status is-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
      </div>
      <dl className="cs-band-app-grid">
        <div><dt>Vị trí</dt><dd>{positionLabel(rec, a)}</dd></div>
        {(rec?.questions ?? []).map(q => (
          <div key={q.key}><dt>{q.shortLabel}</dt><dd>{answerLabel(q, a.answers[q.key])}</dd></div>
        ))}
        {/* câu trả lời của câu hỏi không còn trong config (đổi config sau) — vẫn hiện, không mất dữ liệu */}
        {Object.keys(a.answers).filter(k => !rec?.questions.some(q => q.key === k)).map(k => (
          <div key={k}><dt>{k}</dt><dd>{a.answers[k]}</dd></div>
        ))}
        <div><dt>Rule</dt><dd>Đã đồng ý bản v{a.ruleVersion} · {formatDateTime(a.rulesAcceptedAt)}</dd></div>
        <div><dt>Gửi lúc</dt><dd>{formatDateTime(a.createdAt)}{a.hasAccount ? ' · có tài khoản' : ''}</dd></div>
      </dl>
      <div className="cs-band-app-reason">
        <div className="cs-band-app-reason-label">{rec?.reasonLabel ?? 'Lý do tham gia'}</div>
        <p>{a.reason}</p>
      </div>
      <div className="cs-band-app-actions" role="group" aria-label={`Trạng thái đơn của ${a.fullName}`}>
        {APPLICATION_STATUSES.map(s => (
          <button key={s} type="button" disabled={busy} aria-pressed={a.status === s}
            className={'cs-band-status-btn' + (a.status === s ? ` is-on is-${s.toLowerCase()}` : '')}
            onClick={() => { if (a.status !== s) onStatus(s) }}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      {error && <p className="cs-form-error" role="alert">{error}</p>}
    </li>
  )
}

export function BandApplicationsView({ detail, filter, onFilter, busyId, errorId, errorText, onStatus }: {
  detail: AdminBandDetail
  filter: ApplicationStatus | 'ALL'
  onFilter: (f: ApplicationStatus | 'ALL') => void
  busyId: string | null
  errorId: string | null
  errorText: string | null
  onStatus: (a: AdminApplication, s: ApplicationStatus) => void
}) {
  const counts = countByStatus(detail.applications)
  const list = filterApplications(detail.applications, filter)
  const recOf = (id: string) => detail.recruitments.find(r => r.id === id)
  return (
    <>
      <div className="cs-band-filter" role="tablist" aria-label="Lọc theo trạng thái">
        {(['ALL', ...APPLICATION_STATUSES] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} className={'cs-band-filter-btn' + (filter === s ? ' is-on' : '')}
            onClick={() => onFilter(s)}>{s === 'ALL' ? 'Tất cả' : STATUS_LABEL[s]}<span className="cs-count">{counts[s]}</span></button>
        ))}
      </div>
      {list.length === 0
        ? <EmptyState icon={Inbox} title={detail.applications.length === 0 ? 'Chưa có đơn nào' : 'Không có đơn ở trạng thái này'} quiet>
            {detail.applications.length === 0 ? 'Gửi link tuyển thành viên cho học viên để nhận đơn.' : 'Chọn bộ lọc khác.'}
          </EmptyState>
        : <ul className="cs-band-app-list">
            {list.map(a => (
              <ApplicationCard key={a.id} a={a} rec={recOf(a.recruitmentId)} busy={busyId === a.id}
                error={errorId === a.id ? errorText : null} onStatus={s => onStatus(a, s)} />
            ))}
          </ul>}
    </>
  )
}

export function BandApplicationsAdminPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [state, setState] = useState<Load<AdminBandDetail>>({ status: 'loading' })
  const [filter, setFilter] = useState<ApplicationStatus | 'ALL'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<{ id: string; text: string } | null>(null)

  const load = useCallback(() => {
    void fetchAdminBandDetail(slug).then(r => setState(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }))
  }, [slug])
  useEffect(load, [load])
  useEffect(() => {
    if (state.status === 'ready') document.title = `Đơn ứng tuyển · ${state.value.band.name}`
  }, [state])

  const onStatus = async (a: AdminApplication, s: ApplicationStatus) => {
    setBusyId(a.id); setErr(null)
    const r = await setApplicationStatus(a.id, s)
    setBusyId(null)
    if (!r.ok) { setErr({ id: a.id, text: r.message }); return }
    setState(st => st.status !== 'ready' ? st : {
      status: 'ready',
      value: { ...st.value, applications: st.value.applications.map(x => (x.id === a.id ? { ...x, status: s } : x)) },
    })
  }

  return (
    <div className="cs-col cs-band-admin">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-band-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Các Band
      </button>
      <div className="cs-band-admin-title">
        <h1 className="cs-page-title">{state.status === 'ready' ? state.value.band.name : 'Đơn ứng tuyển'}</h1>
        <a className="cs-btn cs-btn-soft cs-btn-sm" href={bandPublicPath(slug)} target="_blank" rel="noopener noreferrer">
          Trang tuyển <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      {state.status === 'loading' && <p className="cs-loading">Đang tải…</p>}
      {state.status === 'error' && <p className="cs-form-error" role="alert">{state.message}</p>}
      {state.status === 'ready' && (
        <BandApplicationsView detail={state.value} filter={filter} onFilter={setFilter} busyId={busyId}
          errorId={err?.id ?? null} errorText={err?.text ?? null} onStatus={(a, s) => void onStatus(a, s)} />
      )}
    </div>
  )
}
