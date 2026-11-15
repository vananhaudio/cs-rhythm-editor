// /me/broadcast — Gửi thông điệp (Owner/admin). Soạn → Xem trước số người nhận → Xác nhận cuối → Theo dõi tiến độ / Lịch sử.
// Không gửi gì khi chỉ soạn hoặc xem trước; chỉ nút "Xác nhận gửi tới N người" mới tạo chiến dịch (server kiểm quyền + số lượng).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { ConfirmDialog, EmptyState } from '../ui'
import { relativeTime } from '../posts/postModel'
import {
  cancelBroadcast, confirmBroadcast, fetchAudiences, fetchCampaign, fetchCampaigns, fetchRecipients, previewBroadcast,
} from './broadcastApi'
import {
  AUDIENCES, BODY_MAX, CHANNELS, EMPTY_DRAFT, RECIPIENT_STATUS, STATUS_LABEL, TITLE_MAX, channelLabel, confirmLabel, draftProblems, isActive,
  progressPct, reasonList, resultLine,
  type AudienceOption, type Campaign, type Draft, type Preview, type Recipient,
} from './broadcastModel'

type Tab = 'compose' | 'history'
const POLL_MS = 5000
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `bc-${Date.now()}-${Math.random().toString(36).slice(2)}`)

export default function BroadcastPage({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>('compose')
  const [openId, setOpenId] = useState<string | null>(null)
  if (!isAdmin) {
    return (
      <div className="cs-col cs-bc">
        <h1 className="cs-page-title">Gửi thông điệp</h1>
        <EmptyState icon={Megaphone} title="Chỉ dành cho quản trị viên" quiet>Bạn không có quyền dùng công cụ này.</EmptyState>
      </div>
    )
  }
  return (
    <div className="cs-col cs-bc">
      <h1 className="cs-page-title">Gửi thông điệp</h1>
      {!openId && (
        <div className="cs-bc-tabs" role="tablist" aria-label="Gửi thông điệp">
          <button type="button" role="tab" aria-selected={tab === 'compose'} className={tab === 'compose' ? 'is-on' : ''} onClick={() => setTab('compose')}>Soạn thông điệp</button>
          <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-on' : ''} onClick={() => setTab('history')}>Lịch sử đã gửi</button>
        </div>
      )}
      {openId
        ? <CampaignDetail id={openId} onBack={() => { setOpenId(null); setTab('history') }} />
        : tab === 'compose'
          ? <Compose onSent={id => setOpenId(id)} />
          : <History onOpen={setOpenId} />}
    </div>
  )
}

// ── Soạn + xem trước + xác nhận ─────────────────────────────────────────────
function Compose({ onSent }: { onSent: (id: string) => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [audiences, setAudiences] = useState<AudienceOption[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const keyRef = useRef<string>(newKey())
  const sentRef = useRef(false)

  useEffect(() => {
    let alive = true
    void fetchAudiences().then(r => { if (alive && r.ok) setAudiences(r.value) })
    return () => { alive = false }
  }, [])

  const problems = draftProblems(draft)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))
  const options = audiences.filter(a => a.kind === draft.audience)

  const next = async () => {
    if (busy || problems.length) return
    setBusy(true); setError(null); setNotice(null)
    const r = await previewBroadcast(draft)
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    setPreview(r.value); keyRef.current = newKey(); setStep('review')
  }

  const send = async () => {
    if (busy || sentRef.current || !preview || preview.eligible <= 0) return
    setBusy(true); setError(null); setNotice(null)
    const r = await confirmBroadcast(draft, keyRef.current, preview.eligible)
    if (r.ok) { sentRef.current = true; setBusy(false); onSent(r.value); return }   // giữ busy=false nhưng chặn bấm lại bằng sentRef
    setBusy(false)
    if (r.countChanged) {   // số người nhận đã đổi: nạp số mới và BẮT Owner xem lại — không tự gửi
      const p = await previewBroadcast(draft)
      if (p.ok) setPreview(p.value)
      setNotice('Số người nhận đã thay đổi. Hãy kiểm tra số mới rồi xác nhận lại.')
    } else setError(r.message)
  }

  if (step === 'review' && preview) {
    const reasons = reasonList(preview.reasons)
    return (
      <section className="cs-card cs-bc-card" aria-labelledby="bc-review">
        <h2 id="bc-review" className="cs-friends-title">Kiểm tra trước khi gửi</h2>
        <dl className="cs-bc-dl">
          <div><dt>Kênh</dt><dd>{channelLabel(draft.channel)}</dd></div>
          <div><dt>Đối tượng</dt><dd>{preview.label}</dd></div>
          <div><dt>Người nhận hợp lệ</dt><dd><strong className="cs-bc-num">{preview.eligible.toLocaleString('vi-VN')}</strong></dd></div>
          <div><dt>Không đủ điều kiện</dt><dd>{preview.excluded.toLocaleString('vi-VN')}</dd></div>
        </dl>
        {reasons.length > 0 && (
          <ul className="cs-bc-reasons" aria-label="Lý do loại trừ">
            {reasons.map(r => <li key={r.key}><span>{r.label}</span><b>{r.count.toLocaleString('vi-VN')}</b></li>)}
          </ul>
        )}
        <Preview draft={draft} />
        {preview.eligible === 0 && <p className="cs-form-error" role="alert">Không có người nhận hợp lệ.</p>}
        {notice && <p className="cs-rel-notice" role="status">{notice}</p>}
        {error && <p className="cs-form-error" role="alert">{error}</p>}
        <p className="cs-bc-warn">Tin đã gửi không thể thu hồi tự động.</p>
        <div className="cs-bc-actions">
          <button type="button" className="cs-btn cs-btn-soft" disabled={busy} onClick={() => { setStep('edit'); setNotice(null) }}>Quay lại sửa</button>
          <button type="button" className="cs-btn cs-btn-primary" disabled={busy || preview.eligible === 0} aria-busy={busy} onClick={() => void send()}>
            {busy ? 'Đang gửi…' : confirmLabel(preview.eligible)}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="cs-card cs-bc-card" aria-labelledby="bc-compose">
      <h2 id="bc-compose" className="cs-friends-title">Soạn thông điệp</h2>

      <fieldset className="cs-bc-field">
        <legend>Kênh gửi</legend>
        <div className="cs-bc-seg" role="radiogroup" aria-label="Kênh gửi">
          {CHANNELS.map(c => (
            <button key={c.id} type="button" role="radio" aria-checked={draft.channel === c.id} className={draft.channel === c.id ? 'is-on' : ''} onClick={() => set('channel', c.id)}>{c.label}</button>
          ))}
        </div>
        <p className="cs-bc-hint">{CHANNELS.find(c => c.id === draft.channel)?.hint}</p>
      </fieldset>

      <div className="cs-bc-field">
        <label htmlFor="bc-aud">Người nhận</label>
        <select id="bc-aud" className="cs-bc-input" value={draft.audience} onChange={e => setDraft(d => ({ ...d, audience: e.target.value as Draft['audience'], ref: null }))}>
          {AUDIENCES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {(draft.audience === 'class' || draft.audience === 'band') && (
          <select id="bc-ref" className="cs-bc-input" aria-label={draft.audience === 'class' ? 'Chọn lớp' : 'Chọn Band'} value={draft.ref ?? ''} onChange={e => set('ref', e.target.value || null)}>
            <option value="">{draft.audience === 'class' ? '— Chọn lớp —' : '— Chọn Band —'}</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.label} ({o.members})</option>)}
          </select>
        )}
      </div>

      {draft.channel === 'notice' && (
        <div className="cs-bc-field">
          <label htmlFor="bc-title">Tiêu đề <span className="cs-bc-opt">(không bắt buộc)</span></label>
          <input id="bc-title" className="cs-bc-input" value={draft.title} maxLength={TITLE_MAX} onChange={e => set('title', e.target.value)} autoComplete="off" />
        </div>
      )}
      <div className="cs-bc-field">
        <label htmlFor="bc-body">Nội dung</label>
        <textarea id="bc-body" className="cs-bc-input cs-bc-text" rows={6} value={draft.body} maxLength={BODY_MAX + 200} onChange={e => set('body', e.target.value)} />
        <p className={'cs-bc-count' + (draft.body.trim().length > BODY_MAX ? ' is-over' : '')}>{draft.body.trim().length.toLocaleString('vi-VN')} / {BODY_MAX.toLocaleString('vi-VN')}</p>
      </div>
      {draft.channel === 'notice' && (
        <div className="cs-bc-field">
          <label htmlFor="bc-link">Liên kết nội bộ <span className="cs-bc-opt">(không bắt buộc, ví dụ /me/friends)</span></label>
          <input id="bc-link" className="cs-bc-input" value={draft.link} onChange={e => set('link', e.target.value)} autoCapitalize="none" autoCorrect="off" inputMode="url" />
        </div>
      )}

      {draft.body.trim() && <Preview draft={draft} />}
      {error && <p className="cs-form-error" role="alert">{error}</p>}
      {draft.body.trim() !== '' && problems.length > 0 && <ul className="cs-bc-problems">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
      <div className="cs-bc-actions">
        <button type="button" className="cs-btn cs-btn-primary" disabled={busy || problems.length > 0} aria-busy={busy} onClick={() => void next()}>
          {busy ? 'Đang kiểm tra…' : 'Tiếp tục'}
        </button>
      </div>
    </section>
  )
}

function Preview({ draft }: { draft: Draft }) {
  const body = draft.body.trim()
  if (!body) return null
  return (
    <figure className="cs-bc-preview" aria-label="Xem trước">
      <figcaption>Người nhận sẽ thấy</figcaption>
      {draft.channel === 'notice'
        ? <div className="cs-bc-pv-notice">{draft.title.trim() && <strong>{draft.title.trim()}</strong>}<span>{body}</span>{draft.link.trim() && <em>Mở liên kết →</em>}</div>
        : <div className="cs-bc-pv-chat"><span>{body}</span></div>}
    </figure>
  )
}

// ── Lịch sử ──────────────────────────────────────────────────────────────────
function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: Campaign[] }>({ status: 'loading' })
  const load = useCallback(async () => {
    const r = await fetchCampaigns()
    setList(prev => (r.ok ? { status: 'ready', items: r.value } : prev.status === 'ready' ? prev : { status: 'error', message: r.message }))
  }, [])
  useEffect(() => {
    let alive = true
    void fetchCampaigns().then(r => { if (alive) setList(prev => (r.ok ? { status: 'ready', items: r.value } : prev.status === 'ready' ? prev : { status: 'error', message: r.message })) })
    return () => { alive = false }
  }, [])
  const anyActive = list.status === 'ready' && list.items.some(c => isActive(c.status))
  useEffect(() => {
    if (!anyActive) return
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [anyActive, load])

  return (
    <section className="cs-card cs-bc-card" aria-labelledby="bc-hist">
      <h2 id="bc-hist" className="cs-friends-title">Lịch sử đã gửi</h2>
      {list.status === 'loading' && <div className="cs-skeleton" style={{ width: '50%' }} aria-label="Đang tải" />}
      {list.status === 'error' && <div className="cs-feed-error" role="alert"><p>{list.message}</p><button type="button" className="cs-btn cs-btn-soft" onClick={() => { setList({ status: 'loading' }); void load() }}>Thử lại</button></div>}
      {list.status === 'ready' && list.items.length === 0 && <EmptyState icon={Megaphone} title="Chưa có chiến dịch nào" quiet>Thông điệp đã gửi sẽ hiện ở đây.</EmptyState>}
      {list.status === 'ready' && list.items.length > 0 && (
        <ul className="cs-bc-list">
          {list.items.map(c => (
            <li key={c.id}>
              <button type="button" className="cs-bc-row" onClick={() => onOpen(c.id)}>
                <span className="cs-bc-row-top"><b>{c.title || c.body.slice(0, 60)}</b><span className={'cs-bc-badge is-' + c.status}>{STATUS_LABEL[c.status]}</span></span>
                <span className="cs-bc-row-sub">{channelLabel(c.channel)} · {c.audienceLabel} · {relativeTime(c.createdAt)}</span>
                <span className="cs-bc-row-sub">{resultLine(c)}</span>
                {isActive(c.status) && <ProgressBar pct={progressPct(c)} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return <span className="cs-bc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: pct + '%' }} /></span>
}

// ── Chi tiết + tiến độ + từng người nhận ─────────────────────────────────────
function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [c, setC] = useState<Campaign | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [rows, setRows] = useState<Recipient[]>([])
  const [more, setMore] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)
  const filterRef = useRef(filter)

  const refresh = useCallback(async () => {
    const r = await fetchCampaign(id)
    if (r.ok) { setC(r.value); setError(r.value ? null : 'Không tìm thấy chiến dịch.') } else setError(r.message)
  }, [id])
  useEffect(() => {
    let alive = true
    void fetchCampaign(id).then(r => { if (!alive) return; if (r.ok) { setC(r.value); setError(r.value ? null : 'Không tìm thấy chiến dịch.') } else setError(r.message) })
    return () => { alive = false }
  }, [id])
  const active = c ? isActive(c.status) : false
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(t)
  }, [active, refresh])

  const loadRows = useCallback(async (status: string | null, after: string | null) => {
    setLoadingRows(true)
    const r = await fetchRecipients(id, status, after)
    setLoadingRows(false)
    if (filterRef.current !== status) return
    if (r.ok) { setRows(prev => (after ? [...prev, ...r.value] : r.value)); setMore(r.value.length === 50) } else setError(r.message)
  }, [id])
  useEffect(() => {
    filterRef.current = filter
    let alive = true
    void fetchRecipients(id, filter, null).then(r => {
      if (!alive || filterRef.current !== filter) return
      if (r.ok) { setRows(r.value); setMore(r.value.length === 50) }
    })
    return () => { alive = false }
  }, [id, filter])

  const doCancel = async () => {
    setBusy(true)
    const r = await cancelBroadcast(id)
    setBusy(false); setConfirmCancel(false)
    if (!r.ok) setError(r.message)
    await refresh()
  }
  const excluded = useMemo(() => reasonList(c?.excluded), [c])

  return (
    <section className="cs-card cs-bc-card" aria-labelledby="bc-detail">
      <button type="button" className="cs-link-btn" onClick={onBack}>‹ Lịch sử</button>
      <h2 id="bc-detail" className="cs-friends-title">Chi tiết chiến dịch</h2>
      {error && <p className="cs-form-error" role="alert">{error}</p>}
      {!c && !error && <div className="cs-skeleton" style={{ width: '50%' }} aria-label="Đang tải" />}
      {c && (
        <>
          <div className="cs-bc-row-top"><b>{c.title || channelLabel(c.channel)}</b><span className={'cs-bc-badge is-' + c.status}>{STATUS_LABEL[c.status]}</span></div>
          <p className="cs-bc-meta">{channelLabel(c.channel)} · {c.audienceLabel} · {relativeTime(c.createdAt)}</p>
          <p className="cs-bc-body">{c.body}</p>
          {c.link && <p className="cs-bc-meta">Liên kết: {c.link}</p>}
          <ProgressBar pct={progressPct(c)} />
          <p className="cs-bc-result">{resultLine(c)} · tổng {c.eligible.toLocaleString('vi-VN')} người nhận hợp lệ</p>
          {excluded.length > 0 && <ul className="cs-bc-reasons" aria-label="Lý do loại trừ">{excluded.map(r => <li key={r.key}><span>{r.label}</span><b>{r.count.toLocaleString('vi-VN')}</b></li>)}</ul>}
          {active && (
            <div className="cs-bc-actions">
              <button type="button" className="cs-btn cs-btn-soft" onClick={() => setConfirmCancel(true)}>Hủy phần chưa gửi</button>
            </div>
          )}
          {c.status !== 'sending' && c.stats.sent > 0 && <p className="cs-bc-hint">Tin đã gửi không thể thu hồi tự động.</p>}

          <h3 className="cs-bc-sub">Từng người nhận</h3>
          <div className="cs-bc-filter" role="group" aria-label="Lọc theo trạng thái">
            {[null, 'sent', 'pending', 'failed', 'skipped', 'cancelled'].map(s => (
              <button key={s ?? 'all'} type="button" className={filter === s ? 'is-on' : ''} onClick={() => setFilter(s)}>{s ? RECIPIENT_STATUS[s] : 'Tất cả'}</button>
            ))}
          </div>
          <ul className="cs-bc-rcpts">
            {rows.map(r => (
              <li key={r.userId}><span>{r.name}</span><span className={'cs-bc-rs is-' + r.status}>{RECIPIENT_STATUS[r.status] ?? r.status}</span>{r.error && <small>{r.error}</small>}</li>
            ))}
          </ul>
          {rows.length === 0 && !loadingRows && <p className="cs-friends-empty">Không có người nào ở mục này.</p>}
          {more && <button type="button" className="cs-btn cs-btn-soft" disabled={loadingRows} onClick={() => void loadRows(filter, rows[rows.length - 1]?.userId ?? null)}>{loadingRows ? 'Đang tải…' : 'Xem thêm'}</button>}
        </>
      )}
      {confirmCancel && (
        <ConfirmDialog title="Hủy phần chưa gửi?" confirmLabel="Hủy phần chưa gửi" cancelLabel="Giữ lại" danger busy={busy} onConfirm={() => void doCancel()} onCancel={() => setConfirmCancel(false)}>
          Những người chưa nhận sẽ không nhận nữa. Tin đã gửi không thể thu hồi.
        </ConfirmDialog>
      )}
    </section>
  )
}
