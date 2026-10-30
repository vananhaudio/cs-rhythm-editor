// Student 360° — tab "Thấu hiểu" trong hồ sơ học viên (giáo viên). Dùng chung Web + điện thoại (bố cục co giãn).
// Chỉ gọi RPC student_360_* qua `api` (JWT người dùng). Dữ liệu học tập/hồ sơ Class KHÔNG sao chép: phần "Tổng quan"
// hiển thị trực tiếp từ bản ghi edu_students mà StudentProfile đã tải.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Fact, HistoryEntry, Student360, Student360Api, Category, Visibility } from './types'
import { Student360Error } from './api'
import {
  ADD_MODES, CATEGORY_LABEL, CATEGORY_ORDER, MAX_CONTENT, SOURCE_LABEL, VISIBILITY_LABEL,
  actionLabel, fmtDateVN, fmtVN, groupFacts, isVerified, trustLine, type AddModeKey,
} from './model'

export interface Student360Overview {
  fullName: string | null; level: string | null; goals: string | null
  instruments: string | null; learningStyle: string | null; enrolledAt: string | null
}
interface Props { userId: string | null | undefined; overview: Student360Overview; api: Student360Api }

const T = {
  bg: '#FFFFFF', soft: '#F4F4F5', text: '#18181B', muted: '#52525B', border: '#E4E4E7',
  primary: '#2D6A4F', danger: '#B91C1C', warn: '#B45309', okBg: '#E9F3EC', warnBg: '#FEF3C7',
}
const btn: CSSProperties = {
  minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg,
  color: T.text, fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
const btnPrimary: CSSProperties = { ...btn, background: T.primary, color: '#fff', border: `1px solid ${T.primary}` }
const field: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 10,
  border: `1px solid ${T.border}`, fontSize: 16, fontFamily: 'inherit', background: T.bg, color: T.text,
}
const card: CSSProperties = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }
const chip = (bg: string, color: string): CSSProperties => ({
  display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 4,
})

const errText = (e: unknown) => (e instanceof Student360Error ? e.message : 'Chưa thực hiện được. Hãy thử lại.')

export default function Student360Panel({ userId, overview, api }: Props) {
  const [data, setData] = useState<Student360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showRevoked, setShowRevoked] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [revoking, setRevoking] = useState<{ id: string; reason: string } | null>(null)
  const [sharing, setSharing] = useState<string | null>(null)
  const [history, setHistory] = useState<{ id: string; loading: boolean; entries: HistoryEntry[]; error?: string } | null>(null)
  const [draft, setDraft] = useState<{ category: Category; mode: AddModeKey | ''; share: boolean; text: string }>({ category: 'goal', mode: '', share: false, text: '' })
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!userId) return
    const my = ++seq.current
    setLoading(true); setLoadError(null)
    try {
      const d = await api.get(userId, showRevoked)
      if (my === seq.current) setData(d)
    } catch (e) {
      if (my === seq.current) setLoadError(errText(e))
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [api, userId, showRevoked])

  useEffect(() => { void load() }, [load])

  // Mỗi thao tác: khoá nút của mục, gọi RPC, báo kết quả, tải lại từ server (nguồn sự thật là server).
  async function act(key: string, okText: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false
    setBusy(key); setNotice(null)
    try { await fn(); setNotice({ kind: 'ok', text: okText }); await load(); return true }
    catch (e) { setNotice({ kind: 'error', text: errText(e) }); return false }
    finally { setBusy(null) }
  }

  async function openHistory(id: string) {
    if (history?.id === id) { setHistory(null); return }
    setHistory({ id, loading: true, entries: [] })
    try { setHistory({ id, loading: false, entries: await api.history(id) }) }
    catch (e) { setHistory({ id, loading: false, entries: [], error: errText(e) }) }
  }

  const ov = overview
  const overviewCard = (
    <section aria-label="Tổng quan học viên" style={card}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Tổng quan nhanh</h3>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {([['Trình độ', ov.level], ['Nhạc cụ đang học', ov.instruments], ['Mục tiêu (trong hồ sơ Class)', ov.goals],
          ['Phong cách học', ov.learningStyle], ['Ngày nhập học', fmtDateVN(ov.enrolledAt) || null]] as [string, string | null][]).map(([k, v]) => (
          <div key={k}><dt style={{ fontSize: 12, color: T.muted }}>{k}</dt><dd style={{ margin: 0, fontSize: 14 }}>{v || 'Chưa có'}</dd></div>
        ))}
      </dl>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: T.muted }}>
        Dữ liệu lấy trực tiếp từ hồ sơ Class, không sao chép. Lớp, bài nộp và tiến độ xem ở các tab bên cạnh.
      </p>
    </section>
  )

  if (!userId) {
    return (
      <div style={{ textAlign: 'left' }}>
        {overviewCard}
        <div role="status" style={{ ...card, background: T.warnBg }}>Học viên này chưa có tài khoản đăng nhập Class nên chưa thể có hồ sơ Student 360°.</div>
      </div>
    )
  }

  const groups = data ? groupFacts(data.facts) : []
  const canSubmit = draft.mode !== '' && draft.text.trim().length > 0 && draft.text.length <= MAX_CONTENT && !busy
  // Chỉ chia sẻ khi giáo viên tích rõ ràng; mục suy luận không bao giờ chia sẻ ngay lúc thêm (phải qua hộp xác nhận ở thẻ mục).
  const addVisibility: Visibility = draft.share && draft.mode !== '' && draft.mode !== 'guess' ? 'student_and_teacher' : 'teacher'

  return (
    <div style={{ textAlign: 'left' }}>
      {overviewCard}

      <section aria-label="Thấu hiểu học viên" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Thấu hiểu học viên</h3>
          <label style={{ fontSize: 13, color: T.muted, display: 'flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
            <input type="checkbox" checked={showRevoked} onChange={e => setShowRevoked(e.target.checked)} /> Hiện cả mục đã thu hồi
          </label>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: T.muted }}>
          Thông tin <b>suy luận</b> luôn mang nhãn riêng và mặc định chỉ giáo viên thấy. Chỉ khi Thầy chọn "Cho học viên xem" thì học viên mới thấy.
        </p>

        {notice && (
          <div role={notice.kind === 'error' ? 'alert' : 'status'}
            style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 12, fontSize: 14,
              background: notice.kind === 'error' ? '#FEE2E2' : T.okBg, color: notice.kind === 'error' ? T.danger : T.primary }}>
            {notice.text}
          </div>
        )}

        {loading && !data && <div role="status" aria-busy="true" style={{ padding: 16, color: T.muted }}>Đang tải hồ sơ…</div>}
        {loadError && (
          <div role="alert" style={{ padding: 12, borderRadius: 10, background: '#FEE2E2', color: T.danger, marginBottom: 12 }}>
            {loadError} <button type="button" style={{ ...btn, marginLeft: 8 }} onClick={() => void load()}>Thử lại</button>
          </div>
        )}
        {data && groups.length === 0 && !loadError && (
          <div role="status" style={{ padding: 16, color: T.muted, background: T.soft, borderRadius: 10 }}>
            Chưa có thông tin nào được ghi nhận. Hãy thêm điều Thầy biết về học viên ở phần bên dưới.
          </div>
        )}

        {groups.map(g => (
          <div key={g.category} style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, color: T.muted }}>{g.label}</h4>
            {g.facts.map(f => (
              <FactCard key={f.id} fact={f} busy={busy} editing={editing?.id === f.id ? editing : null} revoking={revoking?.id === f.id ? revoking : null} sharing={sharing === f.id}
                history={history?.id === f.id ? history : null}
                onEditStart={() => setEditing({ id: f.id, text: f.content })}
                onEditChange={text => setEditing({ id: f.id, text })}
                onEditCancel={() => setEditing(null)}
                onEditSave={async () => { if (editing && await act(`edit:${f.id}`, 'Đã lưu nội dung. Mức xác minh được đặt lại về "Chưa xác minh".', () => api.edit(f.id, editing.text))) setEditing(null) }}
                onVerify={() => void act(`verify:${f.id}`, isVerified(f) ? 'Đã bỏ xác minh.' : 'Đã xác minh.', () => api.setVerification(f.id, isVerified(f) ? 'unverified' : 'teacher_verified'))}
                onVisibility={() => {
                  // Chỉ mục suy luận khi MỞ cho học viên mới cần xác nhận; các thao tác khác làm ngay.
                  if (f.origin === 'inferred' && f.visibility === 'teacher') { setSharing(f.id); return }
                  void act(`vis:${f.id}`, f.visibility === 'teacher' ? 'Học viên đã có thể xem mục này.' : 'Mục này chỉ còn giáo viên thấy.',
                    () => api.setVisibility(f.id, f.visibility === 'teacher' ? 'student_and_teacher' : 'teacher'))
                }}
                onShareCancel={() => setSharing(null)}
                onShareConfirm={async () => { if (await act(`vis:${f.id}`, 'Học viên đã có thể xem mục này.', () => api.setVisibility(f.id, 'student_and_teacher'))) setSharing(null) }}
                onHistory={() => void openHistory(f.id)}
                onRevokeStart={() => setRevoking({ id: f.id, reason: '' })}
                onRevokeChange={reason => setRevoking({ id: f.id, reason })}
                onRevokeCancel={() => setRevoking(null)}
                onRevokeConfirm={async () => { if (revoking && await act(`revoke:${f.id}`, 'Đã thu hồi. Lịch sử vẫn được lưu.', () => api.revoke(f.id, revoking.reason.trim() || null))) setRevoking(null) }}
              />
            ))}
          </div>
        ))}
      </section>

      <section aria-label="Thêm thông tin" style={card}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Thêm thông tin</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
          <label style={{ fontSize: 13, color: T.muted }}>Nhóm thông tin
            <select aria-label="Nhóm thông tin" style={field} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as Category })}>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, color: T.muted }}>Thông tin này đến từ đâu
            <select aria-label="Nguồn thông tin" style={field} value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as AddModeKey | '', share: e.target.value === 'guess' ? false : draft.share })}>
              <option value="" disabled>Chọn nguồn…</option>
              {ADD_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <textarea aria-label="Nội dung" style={{ ...field, minHeight: 88 }} maxLength={MAX_CONTENT} value={draft.text} placeholder="Ví dụ: Muốn tự đệm hát được vài bài Bolero"
          onChange={e => setDraft({ ...draft, text: e.target.value })} />
        {draft.mode !== 'guess' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minHeight: 44 }}>
            <input type="checkbox" checked={draft.share} onChange={e => setDraft({ ...draft, share: e.target.checked })} /> Cho học viên xem ngay
          </label>
        )}
        <div role="status" aria-label="Ai sẽ thấy" style={{ fontSize: 13, color: addVisibility === 'teacher' ? T.muted : T.primary, margin: '2px 0 6px' }}>
          {draft.mode === '' ? 'Hãy chọn nguồn thông tin trước khi thêm.' : addVisibility === 'teacher' ? 'Ai sẽ thấy: chỉ giáo viên.' : 'Ai sẽ thấy: giáo viên và học viên.'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: T.muted }}>{draft.text.length}/{MAX_CONTENT} · luôn bắt đầu ở mức "Chưa xác minh"</span>
          <button type="button" style={canSubmit ? btnPrimary : { ...btnPrimary, opacity: 0.5, cursor: 'not-allowed' }} disabled={!canSubmit}
            onClick={async () => {
              const m = ADD_MODES.find(x => x.key === draft.mode)
              if (!m) return
              if (await act('add', 'Đã thêm thông tin.', () => api.add({ userId, category: draft.category, content: draft.text.trim(), origin: m.origin, sourceKind: m.sourceKind, visibility: addVisibility })))
                setDraft({ category: draft.category, mode: '', share: false, text: '' })   // không giữ lựa chọn nguồn/chia sẻ sang lần thêm sau
            }}>
            {busy === 'add' ? 'Đang lưu…' : 'Thêm'}
          </button>
        </div>
      </section>
    </div>
  )
}

interface CardProps {
  fact: Fact; busy: string | null
  editing: { id: string; text: string } | null; revoking: { id: string; reason: string } | null; sharing: boolean
  history: { id: string; loading: boolean; entries: HistoryEntry[]; error?: string } | null
  onEditStart: () => void; onEditChange: (t: string) => void; onEditCancel: () => void; onEditSave: () => void
  onVerify: () => void; onVisibility: () => void; onShareConfirm: () => void; onShareCancel: () => void; onHistory: () => void
  onRevokeStart: () => void; onRevokeChange: (r: string) => void; onRevokeCancel: () => void; onRevokeConfirm: () => void
}

function FactCard(p: CardProps) {
  const f = p.fact
  const revoked = f.status === 'revoked'
  const disabled = !!p.busy
  const verified = isVerified(f)
  return (
    <article aria-label={`Mục: ${f.content.slice(0, 40)}`} style={{ ...card, background: revoked ? T.soft : T.bg, opacity: revoked ? 0.75 : 1, marginBottom: 10 }}>
      {p.editing ? (
        <div>
          <textarea aria-label="Sửa nội dung" style={{ ...field, minHeight: 80 }} maxLength={MAX_CONTENT} value={p.editing.text} onChange={e => p.onEditChange(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btnPrimary} disabled={disabled || !p.editing.text.trim()} onClick={p.onEditSave}>Lưu</button>
            <button type="button" style={btn} onClick={p.onEditCancel}>Hủy</button>
          </div>
        </div>
      ) : (
        <p style={{ margin: '0 0 8px', fontSize: 15, lineHeight: 1.45, whiteSpace: 'pre-wrap', textDecoration: revoked ? 'line-through' : 'none' }}>{f.content}</p>
      )}

      <div>
        <span style={chip(f.origin === 'inferred' ? T.warnBg : T.soft, f.origin === 'inferred' ? T.warn : T.muted)}>{trustLine(f)}</span>
        <span style={chip(T.soft, T.muted)}>Nguồn: {SOURCE_LABEL[f.source_kind]}</span>
        <span style={chip(f.visibility === 'teacher' ? T.soft : T.okBg, f.visibility === 'teacher' ? T.muted : T.primary)}>{VISIBILITY_LABEL[f.visibility]}</span>
        {revoked && <span style={chip('#FEE2E2', T.danger)}>Đã thu hồi{f.revoke_reason ? `: ${f.revoke_reason}` : ''}</span>}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Cập nhật {fmtVN(f.updated_at)}</div>

      {!revoked && !p.editing && !p.revoking && !p.sharing && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button type="button" style={btn} disabled={disabled} onClick={p.onEditStart}>Sửa</button>
          <button type="button" style={btn} disabled={disabled} onClick={p.onVerify}>{verified ? 'Bỏ xác minh' : 'Xác minh'}</button>
          <button type="button" style={btn} disabled={disabled} onClick={p.onVisibility}>{f.visibility === 'teacher' ? 'Cho học viên xem' : 'Chỉ giáo viên xem'}</button>
          <button type="button" style={btn} onClick={p.onHistory}>{p.history ? 'Ẩn lịch sử' : 'Lịch sử'}</button>
          <button type="button" style={{ ...btn, color: T.danger }} disabled={disabled} onClick={p.onRevokeStart}>Thu hồi</button>
        </div>
      )}
      {revoked && (
        <div style={{ marginTop: 8 }}><button type="button" style={btn} onClick={p.onHistory}>{p.history ? 'Ẩn lịch sử' : 'Lịch sử'}</button></div>
      )}

      {p.sharing && (
        <div role="group" aria-label="Xác nhận cho học viên xem" style={{ marginTop: 10, padding: 12, borderRadius: 10, background: T.warnBg, border: `1px solid ${T.warn}` }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            <b>Đây là thông tin suy luận</b>, có thể chưa chính xác. Nếu tiếp tục, học viên sẽ nhìn thấy nội dung này trong hồ sơ của mình.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btnPrimary} disabled={disabled} onClick={p.onShareConfirm}>Vẫn cho học viên xem</button>
            <button type="button" style={btn} onClick={p.onShareCancel}>Hủy</button>
          </div>
        </div>
      )}

      {p.revoking && (
        <div role="group" aria-label="Xác nhận thu hồi" style={{ marginTop: 10, padding: 12, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Thu hồi mục này? Mục sẽ ẩn khỏi hồ sơ (kể cả với học viên). Lịch sử thay đổi vẫn được lưu.</div>
          <input aria-label="Lý do thu hồi (không bắt buộc)" style={field} maxLength={300} placeholder="Lý do (không bắt buộc)" value={p.revoking.reason} onChange={e => p.onRevokeChange(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...btnPrimary, background: T.danger, border: `1px solid ${T.danger}` }} disabled={disabled} onClick={p.onRevokeConfirm}>Xác nhận thu hồi</button>
            <button type="button" style={btn} onClick={p.onRevokeCancel}>Hủy</button>
          </div>
        </div>
      )}

      {p.history && (
        <div role="region" aria-label="Lịch sử thay đổi" style={{ marginTop: 10, padding: 10, borderRadius: 10, background: T.soft, fontSize: 13 }}>
          {p.history.loading && <div role="status">Đang tải lịch sử…</div>}
          {p.history.error && <div role="alert" style={{ color: T.danger }}>{p.history.error}</div>}
          {!p.history.loading && !p.history.error && p.history.entries.length === 0 && <div>Chưa có lịch sử.</div>}
          {p.history.entries.map((h, i) => (
            <div key={i} style={{ padding: '6px 0', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
              <b>{actionLabel(h.action)}</b> · {fmtVN(h.at)}
              {h.action === 'edit' && h.before?.content && <div style={{ color: T.muted }}>Trước: {h.before.content}</div>}
              {h.action === 'edit' && h.after?.content && <div>Sau: {h.after.content}</div>}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
