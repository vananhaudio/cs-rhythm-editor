// Admin V1 trong /me (Thầy/admin, hoặc Leader của chính Band — server quyết qua band_can_manage):
//  /me/bands          → các Band mình quản lý + số đơn
//  /me/bands/<slug>   → bàn điều hành Band (BandManage.tsx); tab Ứng tuyển dùng BandApplicationsView ở đây:
//                        lọc theo trạng thái, đổi NEW/REVIEWING/REJECTED; Chấp nhận = xác nhận → thêm vào Band
// CSS (band.css) nạp ở container ClassSocialPage. Cột câu hỏi KHÔNG hardcode: dịch key → nhãn bằng config đợt tuyển server trả kèm.
import { useEffect, useState } from 'react'
import { CheckCircle2, Inbox, Users } from 'lucide-react'
import { EmptyState } from '../class-social/ui'
import { fetchAdminBands } from './bandApi'
import {
  APPLICATION_STATUSES, STATUS_LABEL, answerLabel, countByStatus, filterApplications, formatDateTime, memberForApplication, positionLabel,
  type AdminApplication, type AdminBand, type AdminBandDetail, type AdminRecruitment, type ApplicationStatus, type BandMember,
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
      <h1 className="cs-page-title">Quản lý Band</h1>
      {state.status === 'loading' && <p className="cs-loading">Đang tải…</p>}
      {state.status === 'error' && <p className="cs-form-error" role="alert">{state.message}</p>}
      {state.status === 'ready' && <BandsAdminView bands={state.value} onOpenBand={onOpenBand} />}
    </div>
  )
}

function ApplicationCard({ a, rec, member, busy, error, confirming, onStatus, onAskAccept, onCancelAccept, onConfirmAccept, onOpenMembers }: {
  a: AdminApplication
  rec: AdminRecruitment | undefined
  /** hồ sơ thành viên khớp đơn này; undefined = chưa tải danh sách thành viên */
  member: BandMember | null | undefined
  busy: boolean
  error: string | null
  confirming: boolean
  onStatus: (s: ApplicationStatus) => void
  onAskAccept: () => void
  onCancelAccept: () => void
  onConfirmAccept: () => void
  onOpenMembers?: () => void
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
      {member && (
        <div className="cs-band-app-member">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{member.status === 'LEFT' ? 'Từng là thành viên (đã rời Band)' : 'Đã là thành viên của Band'}</span>
          {onOpenMembers && <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onOpenMembers}>Xem</button>}
        </div>
      )}
      {confirming ? (
        <div className="cs-band-confirm" role="alertdialog" aria-label="Xác nhận chấp nhận ứng viên">
          <p>Chấp nhận <b>{a.fullName}</b> và thêm vào Band?</p>
          <div className="cs-band-confirm-actions">
            <button type="button" className="cs-btn cs-btn-primary" disabled={busy} onClick={onConfirmAccept}>{busy ? 'Đang thêm…' : 'Xác nhận'}</button>
            <button type="button" className="cs-btn cs-btn-ghost" disabled={busy} onClick={onCancelAccept}>Huỷ</button>
          </div>
        </div>
      ) : (
        <div className="cs-band-app-actions" role="group" aria-label={`Trạng thái đơn của ${a.fullName}`}>
          {APPLICATION_STATUSES.map(s => (
            <button key={s} type="button" disabled={busy} aria-pressed={a.status === s}
              className={'cs-band-status-btn' + (a.status === s ? ` is-on is-${s.toLowerCase()}` : '')}
              onClick={() => { if (s === 'ACCEPTED') { if (a.status !== s) onAskAccept() } else if (a.status !== s) onStatus(s) }}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
      )}
      {/* Đơn ACCEPTED nhưng chưa có hồ sơ (vd. duyệt từ trước khi có Quản lý V1) → thêm vào Band, idempotent */}
      {!confirming && a.status === 'ACCEPTED' && member === null && (
        <button type="button" className="cs-btn cs-btn-soft cs-band-app-add" disabled={busy} onClick={onAskAccept}>Thêm vào Band</button>
      )}
      {error && <p className="cs-form-error" role="alert">{error}</p>}
    </li>
  )
}

export function BandApplicationsView({ detail, members, filter, onFilter, busyId, errorId, errorText, confirmId, onStatus, onAskAccept, onCancelAccept, onAccept, onOpenMembers }: {
  detail: AdminBandDetail
  /** thành viên của Band (để biết đơn nào đã thành hồ sơ); undefined = chưa tải */
  members?: BandMember[]
  filter: ApplicationStatus | 'ALL'
  onFilter: (f: ApplicationStatus | 'ALL') => void
  busyId: string | null
  errorId: string | null
  errorText: string | null
  confirmId: string | null
  onStatus: (a: AdminApplication, s: ApplicationStatus) => void
  onAskAccept: (a: AdminApplication) => void
  onCancelAccept: () => void
  onAccept: (a: AdminApplication) => void
  onOpenMembers?: () => void
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
                member={members ? memberForApplication(members, a) : undefined}
                error={errorId === a.id ? errorText : null} confirming={confirmId === a.id}
                onStatus={s => onStatus(a, s)} onAskAccept={() => onAskAccept(a)} onCancelAccept={onCancelAccept}
                onConfirmAccept={() => onAccept(a)} onOpenMembers={onOpenMembers} />
            ))}
          </ul>}
    </>
  )
}
