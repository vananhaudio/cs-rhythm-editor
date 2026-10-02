// Bàn điều hành Band — /me/bands/<slug> (Thầy/admin, Leader của Band — server quyết qua band_can_manage).
// 3 tab: ỨNG TUYỂN (BandApplicationsView) · THÀNH VIÊN · BỘ MÁY. Dùng chung cho MỌI Band: tên, lịch, gu, danh mục
// vị trí âm nhạc và vai trò vận hành đều đến từ dữ liệu Band (band_admin_overview) — không có gì riêng một Band.
// CSS (band.css) nạp ở container ClassSocialPage.
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Phone, Plus, UserPlus, Users, X } from 'lucide-react'
import { EmptyState } from '../class-social/ui'
import { BandApplicationsView } from './BandAdmin'
import {
  acceptApplication, addMember, fetchAdminBandDetail, fetchBandOverview, setApplicationStatus, setMemberRole, updateMember,
  type MemberPatch, type NewMember, type Result,
} from './bandApi'
import {
  MEMBER_STATUSES, MEMBER_STATUS_LABEL, bandPublicPath, formatDate, memberPositionLabels, roleLabel, roleSlots, splitMembers, staffedCount,
  type AdminApplication, type AdminBandDetail, type ApplicationStatus, type BandMember, type BandOverview, type BandPosition, type MemberStatus,
} from './bandModel'

export type BandTab = 'applications' | 'members' | 'org'
type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }

// ── Đầu trang ────────────────────────────────────────────────────────────────
export function BandManageHeader({ o }: { o: BandOverview }) {
  return (
    <section className="cs-card cs-band-mhead" aria-label="Thông tin Band">
      <dl className="cs-band-mhead-facts">
        <div><dt>Leader</dt><dd>{o.band.leaderName ?? 'Chưa có'}</dd></div>
        <div><dt>Lịch cố định</dt><dd>{o.band.scheduleText ?? 'Chưa có lịch'}</dd></div>
        <div><dt>Gu âm nhạc</dt><dd>{o.band.musicStyle ?? '—'}</dd></div>
      </dl>
      <div className="cs-band-mhead-stats">
        <div><b>{o.counts.members}</b><span>thành viên</span></div>
        <div className={o.counts.newApplications > 0 ? 'is-hot' : ''}><b>{o.counts.newApplications}</b><span>đơn mới</span></div>
      </div>
    </section>
  )
}

export function BandTabs({ tab, onTab, o }: { tab: BandTab; onTab: (t: BandTab) => void; o: BandOverview }) {
  const slots = roleSlots(o)
  const items: { key: BandTab; label: string; badge: string }[] = [
    { key: 'applications', label: 'Ứng tuyển', badge: o.counts.newApplications > 0 ? String(o.counts.newApplications) : '' },
    { key: 'members', label: 'Thành viên', badge: String(o.counts.members) },
    { key: 'org', label: 'Bộ máy', badge: `${staffedCount(slots)}/${slots.length}` },
  ]
  return (
    <div className="cs-band-tabs" role="tablist" aria-label="Khu vực quản lý Band">
      {items.map(it => (
        <button key={it.key} type="button" role="tab" aria-selected={tab === it.key} className={'cs-band-tab' + (tab === it.key ? ' is-on' : '')}
          onClick={() => onTab(it.key)}>
          {it.label}{it.badge && <span className="cs-count">{it.badge}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Chọn vị trí (dùng cho Thêm và Sửa) ───────────────────────────────────────
function PositionPicker({ catalog, value, extra, note, onChange, onNote }: {
  catalog: BandPosition[]
  value: string[]
  /** key đang giữ nhưng đã bị gỡ khỏi danh mục — vẫn hiện để bỏ được */
  extra: string[]
  note: string
  onChange: (v: string[]) => void
  onNote: (v: string) => void
}) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])
  const opts = [...catalog.map(p => ({ key: p.key, label: p.label })), ...extra.map(k => ({ key: k, label: k }))]
  const needsNote = catalog.some(p => p.other && value.includes(p.key)) || note !== ''
  return (
    <div className="cs-band-field">
      <div className="cs-band-label">Vị trí âm nhạc <span className="cs-band-label-sub">(chọn một hoặc nhiều)</span></div>
      <div className="cs-band-chips" role="group" aria-label="Vị trí âm nhạc">
        {opts.map(o => (
          <button key={o.key} type="button" aria-pressed={value.includes(o.key)} className={'cs-band-chip' + (value.includes(o.key) ? ' is-on' : '')}
            onClick={() => toggle(o.key)}>{o.label}</button>
        ))}
      </div>
      {needsNote && (
        <input className="cs-input cs-band-input" aria-label="Mô tả vị trí / nhạc cụ khác" placeholder="Nhạc cụ khác (vd. Saxophone)"
          value={note} maxLength={80} onChange={e => onNote(e.target.value)} />
      )}
    </div>
  )
}

// ── Thành viên ───────────────────────────────────────────────────────────────
function MemberEditor({ m, catalog, busy, error, onSave, onCancel }: {
  m: BandMember
  catalog: BandPosition[]
  busy: boolean
  error: string | null
  onSave: (p: MemberPatch) => void
  onCancel: () => void
}) {
  const [positions, setPositions] = useState<string[]>(m.positions)
  const [note, setNote] = useState(m.positionNote ?? '')
  const [status, setStatus] = useState<MemberStatus>(m.status)
  const extra = m.positions.filter(k => !catalog.some(p => p.key === k))
  const leaving = status === 'LEFT' && m.status !== 'LEFT'
  return (
    <div className="cs-band-medit">
      <PositionPicker catalog={catalog} value={positions} extra={extra} note={note} onChange={setPositions} onNote={setNote} />
      <div className="cs-band-field">
        <div className="cs-band-label">Trạng thái</div>
        <div className="cs-band-seg" role="radiogroup" aria-label="Trạng thái thành viên">
          {MEMBER_STATUSES.map(s => (
            <label key={s} className={'cs-band-seg-opt' + (status === s ? ' is-on' : '')}>
              <input type="radio" name={`st-${m.id}`} checked={status === s} onChange={() => setStatus(s)} />
              <span>{MEMBER_STATUS_LABEL[s]}</span>
            </label>
          ))}
        </div>
        {leaving && m.roles.length > 0 && <div className="cs-band-hint">Rời Band sẽ gỡ {m.roles.length} vai trò vận hành của {m.fullName}.</div>}
      </div>
      {error && <p className="cs-form-error" role="alert">{error}</p>}
      <div className="cs-band-confirm-actions">
        <button type="button" className="cs-btn cs-btn-primary" disabled={busy}
          onClick={() => onSave({ positions, positionNote: note.trim() || null, status })}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="cs-btn cs-btn-ghost" disabled={busy} onClick={onCancel}>Huỷ</button>
      </div>
    </div>
  )
}

function MemberCard({ m, o, editing, busy, error, onEdit, onSave, onCancel }: {
  m: BandMember
  o: BandOverview
  editing: boolean
  busy: boolean
  error: string | null
  onEdit: () => void
  onSave: (p: MemberPatch) => void
  onCancel: () => void
}) {
  const positions = memberPositionLabels(m, o.positionCatalog)
  return (
    <li className={'cs-card cs-band-member' + (m.status !== 'ACTIVE' ? ` is-${m.status.toLowerCase()}` : '')}>
      <div className="cs-band-app-head">
        <div>
          <b className="cs-band-app-name">{m.fullName}</b>
          {m.phone && <a className="cs-band-app-phone" href={`tel:${m.phone}`}><Phone size={13} aria-hidden="true" /> {m.phone}</a>}
        </div>
        {m.status !== 'ACTIVE' && <span className={`cs-band-mstatus is-${m.status.toLowerCase()}`}>{MEMBER_STATUS_LABEL[m.status]}</span>}
      </div>
      <div className="cs-band-chips" aria-label="Vị trí âm nhạc">
        {positions.length > 0 ? positions.map(p => <span key={p} className="cs-band-chip is-static">{p}</span>)
          : <span className="cs-band-muted">Chưa có vị trí</span>}
      </div>
      {m.roles.length > 0 && (
        <div className="cs-band-chips" aria-label="Vai trò vận hành">
          {m.roles.map(r => <span key={r} className="cs-band-chip is-role">{roleLabel(r, o.roleCatalog)}</span>)}
        </div>
      )}
      <div className="cs-band-member-meta">
        Tham gia {formatDate(m.joinedAt)} · {m.applicationId ? 'qua đơn ứng tuyển' : 'thêm trực tiếp'}{m.hasAccount ? ' · có tài khoản Class' : ''}
      </div>
      {editing
        ? <MemberEditor m={m} catalog={o.positionCatalog} busy={busy} error={error} onSave={onSave} onCancel={onCancel} />
        : <button type="button" className="cs-btn cs-btn-soft cs-btn-sm cs-band-member-edit" onClick={onEdit}>Sửa vị trí / trạng thái</button>}
    </li>
  )
}

function AddMemberForm({ catalog, busy, error, onAdd, onCancel }: {
  catalog: BandPosition[]
  busy: boolean
  error: string | null
  onAdd: (m: NewMember) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<NewMember>({ fullName: '', phone: '', positions: [], positionNote: '' })
  return (
    <form className="cs-card cs-band-madd" aria-label="Thêm thành viên" onSubmit={e => { e.preventDefault(); onAdd(v) }}>
      <div className="cs-band-madd-title">Thêm thành viên trực tiếp</div>
      <p className="cs-band-hint">Dành cho người không đi qua đơn ứng tuyển (vd. thành viên sáng lập). Ứng viên thì bấm Chấp nhận ở tab Ứng tuyển.</p>
      <div className="cs-band-field">
        <label className="cs-band-label" htmlFor="madd-name">Họ và tên</label>
        <input id="madd-name" className="cs-input cs-band-input" value={v.fullName} maxLength={80} onChange={e => setV({ ...v, fullName: e.target.value })} />
      </div>
      <div className="cs-band-field">
        <label className="cs-band-label" htmlFor="madd-phone">Số điện thoại / Zalo <span className="cs-band-label-sub">(không bắt buộc)</span></label>
        <input id="madd-phone" className="cs-input cs-band-input" type="tel" inputMode="tel" value={v.phone} maxLength={20}
          onChange={e => setV({ ...v, phone: e.target.value })} />
      </div>
      <PositionPicker catalog={catalog} value={v.positions} extra={[]} note={v.positionNote}
        onChange={positions => setV({ ...v, positions })} onNote={positionNote => setV({ ...v, positionNote })} />
      {error && <p className="cs-form-error" role="alert">{error}</p>}
      <div className="cs-band-confirm-actions">
        <button type="submit" className="cs-btn cs-btn-primary" disabled={busy}>{busy ? 'Đang thêm…' : 'Thêm vào Band'}</button>
        <button type="button" className="cs-btn cs-btn-ghost" disabled={busy} onClick={onCancel}>Huỷ</button>
      </div>
    </form>
  )
}

export function MembersView({ o, onAdd, onUpdate }: {
  o: BandOverview
  onAdd: (m: NewMember) => Promise<Result<undefined>>
  onUpdate: (id: string, p: MemberPatch) => Promise<Result<undefined>>
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const { current, left } = splitMembers(o.members)
  const run = async (fn: () => Promise<Result<undefined>>, done: () => void) => {
    setBusy(true); setErr(null)
    const r = await fn()
    setBusy(false)
    if (r.ok) done(); else setErr(r.message)
  }
  const card = (m: BandMember) => (
    <MemberCard key={m.id} m={m} o={o} editing={editId === m.id} busy={busy} error={editId === m.id ? err : null}
      onEdit={() => { setEditId(m.id); setAdding(false); setErr(null) }} onCancel={() => setEditId(null)}
      onSave={p => void run(() => onUpdate(m.id, p), () => setEditId(null))} />
  )
  return (
    <>
      {adding
        ? <AddMemberForm catalog={o.positionCatalog} busy={busy} error={err} onCancel={() => setAdding(false)}
            onAdd={m => void run(() => onAdd(m), () => setAdding(false))} />
        : <button type="button" className="cs-btn cs-btn-soft cs-band-madd-open" onClick={() => { setAdding(true); setEditId(null); setErr(null) }}>
            <UserPlus size={16} aria-hidden="true" /> Thêm thành viên
          </button>}
      {current.length === 0
        ? <EmptyState icon={Users} title="Band chưa có thành viên" quiet>Chấp nhận ứng viên ở tab Ứng tuyển — người đó sẽ xuất hiện ở đây.</EmptyState>
        : <ul className="cs-band-app-list">{current.map(card)}</ul>}
      {left.length > 0 && (
        <div className="cs-band-left">
          <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" aria-expanded={showLeft} onClick={() => setShowLeft(x => !x)}>
            {showLeft ? 'Ẩn' : 'Xem'} người đã rời Band ({left.length})
          </button>
          {showLeft && <ul className="cs-band-app-list">{left.map(card)}</ul>}
        </div>
      )}
    </>
  )
}

// ── Bộ máy ───────────────────────────────────────────────────────────────────
export function OrgView({ o, onSetRole, onOpenMembers }: {
  o: BandOverview
  onSetRole: (memberId: string, roleKey: string, on: boolean) => Promise<Result<undefined>>
  onOpenMembers: () => void
}) {
  const slots = roleSlots(o)
  const staffed = staffedCount(slots)
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ role: string; text: string } | null>(null)
  const candidates = (roleKey: string) => o.members.filter(m => m.status !== 'LEFT' && !m.roles.includes(roleKey))
  const run = async (roleKey: string, memberId: string, on: boolean) => {
    setBusy(true); setErr(null)
    const r = await onSetRole(memberId, roleKey, on)
    setBusy(false)
    if (!r.ok) { setErr({ role: roleKey, text: r.message }); return }
    setPickFor(null); setPick('')
  }
  return (
    <>
      <p className={'cs-band-org-sum' + (staffed === slots.length ? ' is-full' : '')}>
        {staffed === slots.length ? 'Bộ máy đã đủ người phụ trách' : `Đã phân công ${staffed}/${slots.length} vai trò`}
      </p>
      <ul className="cs-band-org">
        {slots.map(({ role, holders, full }) => (
          <li key={role.key} className={'cs-card cs-band-role' + (holders.length === 0 ? ' is-empty' : '')}>
            <div className="cs-band-role-name">{role.label}{role.max != null && <span className="cs-band-label-sub"> · tối đa {role.max}</span>}</div>
            {holders.length === 0
              ? <div className="cs-band-role-none">Chưa phân công</div>
              : <ul className="cs-band-role-holders">
                  {holders.map(h => (
                    <li key={h.id}>
                      <span>{h.fullName}{h.status === 'PAUSED' ? ' (tạm nghỉ)' : ''}</span>
                      <button type="button" className="cs-band-role-x" disabled={busy} aria-label={`Bỏ ${h.fullName} khỏi ${role.label}`}
                        onClick={() => void run(role.key, h.id, false)}><X size={15} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>}
            {pickFor === role.key ? (
              <div className="cs-band-role-pick">
                {candidates(role.key).length === 0
                  ? <p className="cs-band-hint">Không còn thành viên nào để phân công. <button type="button" className="cs-band-link" onClick={onOpenMembers}>Thêm thành viên</button></p>
                  : <select className="cs-input cs-band-input" aria-label={`Chọn người phụ trách ${role.label}`} value={pick} onChange={e => setPick(e.target.value)}>
                      <option value="">— Chọn thành viên —</option>
                      {candidates(role.key).map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                    </select>}
                <div className="cs-band-confirm-actions">
                  <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busy || !pick} onClick={() => void run(role.key, pick, true)}>
                    {busy ? 'Đang lưu…' : 'Phân công'}
                  </button>
                  <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" disabled={busy} onClick={() => { setPickFor(null); setPick('') }}>Huỷ</button>
                </div>
              </div>
            ) : !full && (
              <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-band-role-add" disabled={busy}
                onClick={() => { setPickFor(role.key); setPick(''); setErr(null) }}>
                <Plus size={15} aria-hidden="true" /> {holders.length === 0 ? 'Phân công' : 'Thêm người'}
              </button>
            )}
            {err?.role === role.key && <p className="cs-form-error" role="alert">{err.text}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}

// ── Trang ────────────────────────────────────────────────────────────────────
export default function BandManagePage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [ov, setOv] = useState<Load<BandOverview>>({ status: 'loading' })
  const [apps, setApps] = useState<Load<AdminBandDetail>>({ status: 'loading' })
  const [tab, setTab] = useState<BandTab>('applications')
  const [filter, setFilter] = useState<ApplicationStatus | 'ALL'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [err, setErr] = useState<{ id: string; text: string } | null>(null)

  const loadOverview = useCallback(() => fetchBandOverview(slug).then(r => setOv(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message })), [slug])
  const loadApps = useCallback(() => fetchAdminBandDetail(slug).then(r => setApps(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message })), [slug])
  useEffect(() => { void loadOverview(); void loadApps() }, [loadOverview, loadApps])
  useEffect(() => { if (ov.status === 'ready') document.title = `${ov.value.band.name} · Quản lý Band` }, [ov])

  const onStatus = async (a: AdminApplication, s: ApplicationStatus) => {
    setBusyId(a.id); setErr(null)
    const r = await setApplicationStatus(a.id, s)
    setBusyId(null)
    if (!r.ok) { setErr({ id: a.id, text: r.message }); return }
    await Promise.all([loadApps(), loadOverview()])
  }
  const onAccept = async (a: AdminApplication) => {
    setBusyId(a.id); setErr(null)
    const r = await acceptApplication(a.id)
    setBusyId(null)
    if (!r.ok) { setErr({ id: a.id, text: r.message }); return }
    setConfirmId(null)
    await Promise.all([loadApps(), loadOverview()])
  }
  // Sau mỗi thay đổi: tải lại tổng quan → đầu trang, Thành viên, Bộ máy cập nhật ngay
  const after = async <T,>(r: Result<T>): Promise<Result<undefined>> => {
    if (r.ok) await loadOverview()
    return r.ok ? { ok: true, value: undefined } : r
  }

  const o = ov.status === 'ready' ? ov.value : null
  return (
    <div className="cs-col cs-band-admin">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-band-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Các Band
      </button>
      <div className="cs-band-admin-title">
        <h1 className="cs-page-title">{o ? o.band.name : 'Quản lý Band'}</h1>
        <a className="cs-btn cs-btn-soft cs-btn-sm" href={bandPublicPath(slug)} target="_blank" rel="noopener noreferrer">
          Trang tuyển <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      {ov.status === 'loading' && <p className="cs-loading">Đang tải…</p>}
      {ov.status === 'error' && <p className="cs-form-error" role="alert">{ov.message}</p>}
      {o && (
        <>
          <BandManageHeader o={o} />
          <BandTabs tab={tab} onTab={setTab} o={o} />
          <div role="tabpanel" className="cs-band-tabpanel">
            {tab === 'applications' && (
              apps.status === 'loading' ? <p className="cs-loading">Đang tải…</p>
                : apps.status === 'error' ? <p className="cs-form-error" role="alert">{apps.message}</p>
                : <BandApplicationsView detail={apps.value} members={o.members} filter={filter} onFilter={setFilter} busyId={busyId}
                    errorId={err?.id ?? null} errorText={err?.text ?? null} confirmId={confirmId}
                    onStatus={(a, s) => void onStatus(a, s)} onAskAccept={a => { setConfirmId(a.id); setErr(null) }}
                    onCancelAccept={() => setConfirmId(null)} onAccept={a => void onAccept(a)} onOpenMembers={() => setTab('members')} />
            )}
            {tab === 'members' && (
              <MembersView o={o} onAdd={async m => after(await addMember(slug, m))} onUpdate={async (id, p) => after(await updateMember(id, p))} />
            )}
            {tab === 'org' && (
              <OrgView o={o} onSetRole={async (id, k, on) => after(await setMemberRole(id, k, on))} onOpenMembers={() => setTab('members')} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
