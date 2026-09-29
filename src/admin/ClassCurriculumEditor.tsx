// ── Admin → Lớp học → Chặng & Giáo trình ──
// Quản lý Chặng của lớp, gắn buổi vào chặng, soạn Giáo trình từng buổi (Nháp / Xuất bản).
// Mọi ghi qua PostgREST bằng quyền teacher (RLS); không cần SQL tay.
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import LessonDocument from '../lesson/LessonDocument'
import type { LessonDoc } from '../lesson/lessonTypes'
import {
  assignSessionStage, createStage, deleteSessionContent, deleteStage, fetchClassOutline, fetchSessionContent,
  saveSessionContent, updateStage, type ClassOutlineData, type Db,
} from '../classLearning/api'
import {
  groupOutline, parseSections, planStagesFromTemplate, stageDates, toLessonDoc,
  type OutlineLesson, type StageRow,
} from '../classLearning/outline'
import { PROGRAM_TEMPLATES } from '../classLearning/programTemplates'

const C = { card: '#FFFFFF', border: '#E4E4E7', text: '#18181B', muted: '#52525B', green: '#2D6A4F',
  greenBg: '#E9F3EC', red: '#B91C1C', amber: '#B45309', amberBg: '#FEF3C7', grayBg: '#F4F4F5' }
const btn: CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 11px', background: C.card,
  color: C.text, font: '600 13px Inter, system-ui, sans-serif', cursor: 'pointer' }
const input: CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px', fontSize: 14,
  boxSizing: 'border-box', fontFamily: 'inherit' }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' })

interface Props { client: Db; cls: { id: string; code: string; name: string } }

function StatusBadge({ status }: { status: OutlineLesson['content'] }) {
  const [label, fg, bg] = status === 'published' ? ['Đã xuất bản', C.green, C.greenBg]
    : status === 'draft' ? ['Nháp', C.amber, C.amberBg] : ['Chưa có', C.muted, C.grayBg]
  return <span style={{ fontSize: 12, fontWeight: 700, color: fg, background: bg, borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap' }}>{label}</span>
}

export default function ClassCurriculumEditor({ client, cls }: Props) {
  const [data, setData] = useState<ClassOutlineData | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingSession, setEditingSession] = useState<string | null>(null)
  const template = PROGRAM_TEMPLATES[cls.code]

  // Parent remounts this component per class (key = class id), so no reset effect is needed.
  const load = useCallback(async () => {
    try { setData(await fetchClassOutline(client, cls.id)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [client, cls.id])
  useEffect(() => {
    let cancelled = false
    fetchClassOutline(client, cls.id)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [client, cls.id])

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await fn(); setNotice(ok); await load() }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setBusy(false)
  }

  if (!data) return <div style={{ padding: 12, color: C.muted }}>{error || 'Đang tải chặng và buổi…'}</div>
  const outline = groupOutline(data.stages, data.sessions, data.contents)
  const editing = editingSession ? data.sessions.find(s => s.id === editingSession) : undefined

  const bootstrap = () => run(async () => {
    if (!template) throw new Error('Lớp này chưa có mẫu chương trình.')
    const plan = planStagesFromTemplate(data.stages, template.stages, template.perStage)
    if (!plan.length) throw new Error('Lớp đã có chặng — không khởi tạo lại.')
    for (const p of plan) {
      const st = await createStage(client, cls.id, { ...p, ...stageDates(data.sessions, p.from_session, p.to_session) })
      for (const s of data.sessions) {
        if (s.event_type === 'lesson' && s.session_number != null && s.session_number >= p.from_session && s.session_number <= p.to_session) {
          await assignSessionStage(client, s.id, st.id)
        }
      }
    }
  }, 'Đã khởi tạo chặng theo chương trình và gắn các buổi.')

  return <div>
    {error && <div role="alert" style={{ color: C.red, margin: '8px 0' }}>{error}</div>}
    {notice && <div role="status" style={{ color: C.green, margin: '8px 0' }}>{notice}</div>}

    {data.stages.length === 0 && <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Lớp chưa có chặng</div>
      {template
        ? <button disabled={busy} style={btn} onClick={() => void bootstrap()}>Khởi tạo chặng theo chương trình {cls.code}</button>
        : <div style={{ color: C.muted, fontSize: 14 }}>Tạo chặng thủ công bên dưới.</div>}
    </div>}

    {outline.map(group => <StageCard key={group.stage ? JSON.stringify(group.stage) : 'loose'} client={client} group={group}
      stages={data.stages} busy={busy} run={run} sessions={data.sessions}
      onEdit={id => { setEditingSession(id); setNotice('') }} />)}

    <NewStageForm key={data.stages.map(s => `${s.id}:${s.to_session}`).join(',')} stages={data.stages} busy={busy}
      onCreate={row => run(async () => {
        await createStage(client, cls.id, { ...row, ...stageDates(data.sessions, row.from_session, row.to_session) })
      }, 'Đã tạo chặng.')} />

    {editing && <LessonEditor key={editing.id} client={client} cls={cls} session={editing}
      stage={data.stages.find(st => st.id === editing.stage_id) ?? null}
      template={template?.lessons[editing.session_number ?? -1]}
      onClose={() => setEditingSession(null)} onSaved={load} />}
  </div>
}

function StageCard({ client, group, stages, sessions, busy, run, onEdit }: {
  client: Db; group: ReturnType<typeof groupOutline>[number]; stages: StageRow[]; sessions: ClassOutlineData['sessions']
  busy: boolean; run: (fn: () => Promise<void>, ok: string) => Promise<void>; onEdit: (sessionId: string) => void
}) {
  const st = group.stage
  // Parent keys this card by the stage row, so a saved stage remounts with fresh form values.
  const [form, setForm] = useState(st ? { stage_no: st.stage_no, public_title: st.public_title, summary: st.summary ?? '',
    from_session: st.from_session, to_session: st.to_session } : null)
  const [open, setOpen] = useState(false)

  const attachRange = () => run(async () => {
    if (!st) return
    for (const s of sessions) {
      if (s.event_type === 'lesson' && s.session_number != null && s.session_number >= st.from_session
        && s.session_number <= st.to_session && s.stage_id !== st.id) await assignSessionStage(client, s.id, st.id)
    }
  }, 'Đã gắn các buổi trong khoảng vào chặng.')

  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12, textAlign: 'left' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{st ? `Chặng ${st.stage_no} · ${st.public_title}` : 'Buổi chưa thuộc chặng nào'}</div>
        {st && <div style={{ color: C.muted, fontSize: 13 }}>Buổi {st.from_session}–{st.to_session}{st.starts_on ? ` · ${st.starts_on} → ${st.ends_on ?? '…'}` : ''}</div>}
      </div>
      {st && <button style={btn} onClick={() => setOpen(o => !o)}>{open ? 'Đóng sửa chặng' : 'Sửa chặng'}</button>}
      {st && <button style={btn} disabled={busy} onClick={() => void attachRange()}>Gắn buổi theo khoảng</button>}
    </div>

    {st && open && form && <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px', gap: 8, marginTop: 10 }}>
      <label style={{ fontSize: 12 }}>Thứ tự<input style={{ ...input, width: '100%' }} type="number" min={1} value={form.stage_no}
        onChange={e => setForm({ ...form, stage_no: Number(e.target.value) })} /></label>
      <label style={{ fontSize: 12 }}>Tên chặng<input style={{ ...input, width: '100%' }} value={form.public_title}
        onChange={e => setForm({ ...form, public_title: e.target.value })} /></label>
      <label style={{ fontSize: 12 }}>Từ buổi<input style={{ ...input, width: '100%' }} type="number" min={1} value={form.from_session}
        onChange={e => setForm({ ...form, from_session: Number(e.target.value) })} /></label>
      <label style={{ fontSize: 12 }}>Đến buổi<input style={{ ...input, width: '100%' }} type="number" min={1} value={form.to_session}
        onChange={e => setForm({ ...form, to_session: Number(e.target.value) })} /></label>
      <label style={{ fontSize: 12, gridColumn: '1 / 5' }}>Mô tả công khai (ai cũng đọc được — không ghi nội dung riêng)
        <textarea style={{ ...input, width: '100%', minHeight: 56 }} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></label>
      <div style={{ gridColumn: '1 / 5', display: 'flex', gap: 8 }}>
        <button style={btn} disabled={busy || !form.public_title.trim() || form.to_session < form.from_session}
          onClick={() => void run(() => updateStage(client, st.id, { ...form, public_title: form.public_title.trim(),
            summary: form.summary.trim() || null, ...stageDates(sessions, form.from_session, form.to_session) }), 'Đã lưu chặng.')}>Lưu chặng</button>
        <button style={{ ...btn, color: C.red }} disabled={busy} onClick={() => {
          if (window.confirm('Xoá chặng này? Các buổi đang gắn cần được gỡ trước.')) void run(() => deleteStage(client, st.id), 'Đã xoá chặng.')
        }}>Xoá chặng</button>
      </div>
    </div>}

    <div style={{ marginTop: 10 }}>
      {group.lessons.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Chưa có buổi.</div>}
      {group.lessons.map(l => <div key={l.session.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        borderTop: `1px solid ${C.border}`, padding: '8px 0' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>Buổi {String(l.no).padStart(2, '0')} · {l.title}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>{fmtDate(l.session.start_at)} · {l.session.status}</div>
        </div>
        <StatusBadge status={l.content} />
        <select aria-label={`Chặng của buổi ${l.no}`} style={{ ...input, padding: '6px 8px' }} disabled={busy}
          value={l.session.stage_id ?? ''} onChange={e => {
            const v = e.target.value === '' ? null : Number(e.target.value)
            void run(() => assignSessionStage(client, l.session.id, v), `Đã chuyển Buổi ${l.no}.`)
          }}>
          <option value="">— theo khoảng —</option>
          {stages.map(s => <option key={s.id} value={s.id}>Chặng {s.stage_no}</option>)}
        </select>
        <button style={btn} onClick={() => onEdit(l.session.id)}>Soạn giáo trình</button>
      </div>)}
    </div>
  </div>
}

function NewStageForm({ stages, busy, onCreate }: { stages: StageRow[]; busy: boolean
  onCreate: (row: { stage_no: number; public_title: string; summary: string | null; from_session: number; to_session: number }) => Promise<void> }) {
  const next = (stages.reduce((m, s) => Math.max(m, s.stage_no), 0) || 0) + 1
  const lastTo = stages.reduce((m, s) => Math.max(m, s.to_session), 0)
  // Parent keys this form by the stage list, so the default range follows new stages.
  const [f, setF] = useState({ public_title: '', from_session: lastTo + 1, to_session: lastTo + 8 })
  return <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
    <div style={{ fontWeight: 700, width: '100%' }}>Thêm chặng {next}</div>
    <input aria-label="Tên chặng mới" placeholder="Tên chặng" style={{ ...input, flex: '1 1 220px' }} value={f.public_title}
      onChange={e => setF({ ...f, public_title: e.target.value })} />
    <label style={{ fontSize: 12 }}>Từ buổi<input style={{ ...input, width: 70 }} type="number" min={1} value={f.from_session}
      onChange={e => setF({ ...f, from_session: Number(e.target.value) })} /></label>
    <label style={{ fontSize: 12 }}>Đến buổi<input style={{ ...input, width: 70 }} type="number" min={1} value={f.to_session}
      onChange={e => setF({ ...f, to_session: Number(e.target.value) })} /></label>
    <button style={btn} disabled={busy || !f.public_title.trim() || f.to_session < f.from_session}
      onClick={() => void onCreate({ stage_no: next, public_title: f.public_title.trim(), summary: null,
        from_session: f.from_session, to_session: f.to_session }).then(() => setF(v => ({ ...v, public_title: '' })))}>Tạo chặng</button>
  </div>
}

function LessonEditor({ client, cls, session, stage, template, onClose, onSaved }: {
  client: Db; cls: Props['cls']; session: ClassOutlineData['sessions'][number]; stage: StageRow | null
  template?: LessonDoc; onClose: () => void; onSaved: () => Promise<void>
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const c = await fetchSessionContent(client, session.id)
        if (cancelled) return
        setText(c ? JSON.stringify(c.sections, null, 2) : '[]'); setStatus(c?.status ?? null)
      } catch (e) { if (!cancelled) setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [client, session.id])

  const parsed = (() => { try { return parseSections(JSON.parse(text)) } catch { return { ok: false as const, error: 'JSON không hợp lệ.' } } })()

  const act = async (fn: () => Promise<void>, ok: string, next: typeof status) => {
    setBusy(true); setMsg(null)
    try { await fn(); setStatus(next); setMsg({ ok: true, text: ok }); await onSaved() }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }) }
    setBusy(false)
  }

  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(24,24,27,.45)', zIndex: 60, display: 'flex', justifyContent: 'center', padding: 16 }}>
    <div role="dialog" aria-label="Soạn giáo trình" style={{ background: C.card, borderRadius: 14, width: 'min(1100px, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>{cls.code} · Buổi {String(session.session_number ?? 0).padStart(2, '0')} · Soạn giáo trình</div>
          <div style={{ fontSize: 12, color: C.muted }}>{stage ? `Chặng ${stage.stage_no} · ${stage.public_title}` : 'Chưa thuộc chặng'} · Trạng thái: <StatusBadge status={status} /></div>
        </div>
        <button style={btn} onClick={onClose}>Đóng</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
        {template && <button style={btn} disabled={busy || loading} onClick={() => {
          if (text.trim() !== '[]' && !window.confirm('Thay nội dung đang soạn bằng bài có sẵn của chương trình?')) return
          setText(JSON.stringify(template.sections, null, 2)); setMsg({ ok: true, text: 'Đã nạp bài có sẵn — bấm Lưu nháp để lưu.' })
        }}>Nhập bài có sẵn</button>}
        <button style={btn} onClick={() => setPreview(p => !p)}>{preview ? 'Sửa JSON' : 'Xem trước'}</button>
        <span style={{ flex: 1 }} />
        <button style={btn} disabled={busy || loading || !parsed.ok}
          onClick={() => parsed.ok && void act(() => saveSessionContent(client, session.id, parsed.sections, 'draft'),
            status === 'published' ? 'Đã gỡ xuất bản, lưu thành nháp.' : 'Đã lưu nháp.', 'draft')}>
          {status === 'published' ? 'Gỡ xuất bản (về nháp)' : 'Lưu nháp'}</button>
        <button style={{ ...btn, background: C.green, color: '#fff', borderColor: C.green }} disabled={busy || loading || !parsed.ok || (parsed.ok && !parsed.sections.length)}
          onClick={() => parsed.ok && void act(() => saveSessionContent(client, session.id, parsed.sections, 'published'), 'Đã xuất bản giáo trình.', 'published')}>
          Xuất bản</button>
        {status && <button style={{ ...btn, color: C.red }} disabled={busy} onClick={() => {
          if (window.confirm('Xoá giáo trình của buổi này?')) void act(() => deleteSessionContent(client, session.id), 'Đã xoá giáo trình.', null)
        }}>Xoá</button>}
      </div>
      {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ padding: '8px 16px', color: msg.ok ? C.green : C.red, fontSize: 14 }}>{msg.text}</div>}
      {!parsed.ok && !loading && <div role="alert" style={{ padding: '0 16px 8px', color: C.red, fontSize: 13 }}>{parsed.error}</div>}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading ? <div style={{ padding: 16, color: C.muted }}>Đang tải…</div>
          : preview && parsed.ok ? <LessonDocument doc={toLessonDoc(cls, stage, session, parsed.sections)} onBack={() => setPreview(false)} />
          : <textarea aria-label="Giáo trình (JSON)" spellCheck={false} value={text} onChange={e => setText(e.target.value)}
              style={{ width: '100%', height: '100%', minHeight: 420, border: 'none', padding: 16, boxSizing: 'border-box',
                font: '13px/1.5 ui-monospace, Menlo, monospace', resize: 'none', outline: 'none' }} />}
      </div>
    </div>
  </div>
}
