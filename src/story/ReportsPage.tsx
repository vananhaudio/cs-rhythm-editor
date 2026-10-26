// ── /story/reports — Ban biên tập xử lý báo cáo nội dung ──
// Đáp ứng App Store Guideline 1.2: có cơ chế báo cáo VÀ xử lý kịp thời,
// có khả năng chặn người kể gây hại.
// Chỉ thầy/admin xem được (RLS cũng chặn ở tầng DB).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { listClassReports, resolveClassReport, type ClassReport } from '../class-safety/api'
import { REASON_LABEL as CLASS_REASON, REPORT_KIND_LABEL, isReportKind, type ResolveAction } from '../class-safety/model'

const REASON_LABELS: Record<string, string> = {
  'khong-phu-hop': 'Nội dung không phù hợp',
  'khong-that': 'Không phải chuyện thật / quảng cáo',
  'lo-thong-tin': 'Lộ thông tin cá nhân người khác',
  'xuc-pham': 'Xúc phạm, công kích',
  'ban-quyen': 'Vi phạm bản quyền',
  'khac': 'Lý do khác',
}

type Report = {
  id: number
  story_id: string
  reason: string
  note: string | null
  status: string
  created_at: string
  story: { id: string; title: string | null; slug: string | null; status: string; user_id: string } | null
}

export default function ReportsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [rows, setRows] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'new' | 'done'>('new')
  const [msg, setMsg] = useState('')
  // Tab nguồn: Câu chuyện (story_reports, giữ nguyên) | Class (class_reports — UGC Safety V1)
  const [source, setSource] = useState<'story' | 'class'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'class' ? 'class' : 'story')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('story_reports')
      .select('id,story_id,reason,note,status,created_at,story:stories(id,title,slug,status,user_id)')
      .order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Report[])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAllowed(false); return }
      const { data: au } = await supabase.from('app_users').select('role').eq('id', user.id).maybeSingle()
      const ok = au?.role === 'teacher' || au?.role === 'admin'
      setAllowed(ok)
      if (ok) load()
    })
  }, [load])

  const mark = async (r: Report, status: 'handled' | 'dismissed') => {
    await supabase.from('story_reports')
      .update({ status, handled_at: new Date().toISOString() }).eq('id', r.id)
    setMsg(status === 'handled' ? 'Đã đánh dấu xử lý xong.' : 'Đã bỏ qua báo cáo này.')
    load()
  }

  const unpublish = async (r: Report) => {
    if (!r.story) return
    if (!confirm(`Gỡ câu chuyện "${r.story.title ?? ''}" khỏi Tạp chí?`)) return
    await supabase.from('stories').update({ status: 'unpublished' }).eq('id', r.story.id)
    await mark(r, 'handled')
    setMsg('Đã gỡ câu chuyện khỏi Tạp chí.')
  }

  const block = async (r: Report) => {
    if (!r.story) return
    if (!confirm('Chặn người kể này? Họ sẽ không gửi được câu chuyện mới.')) return
    const { error } = await supabase.from('edu_students')
      .update({ blocked_at: new Date().toISOString(), blocked_reason: REASON_LABELS[r.reason] ?? r.reason })
      .eq('user_id', r.story.user_id)
    setMsg(error ? 'Không chặn được: ' + error.message : 'Đã chặn người kể này.')
    if (!error) await mark(r, 'handled')
  }

  if (allowed === null) return <div className="rpg-note">Đang kiểm tra quyền…</div>
  if (!allowed) return <div className="rpg-note">Trang này chỉ dành cho Ban biên tập. <a href="/story">← Về Tạp chí</a></div>

  const list = rows.filter(r => tab === 'new' ? r.status === 'new' : r.status !== 'new')
  const newCount = rows.filter(r => r.status === 'new').length

  return (
    <div className="rpg-root">
      <style>{CSS}</style>
      <header className="rpg-head">
        <a href="/story" className="rpg-back">← Tạp chí</a>
        <h1>Báo cáo nội dung</h1>
        <p>Cam kết với người đọc: xem lại và xử lý báo cáo nghiêm túc.</p>
      </header>

      <div className="rpg-tabs">
        <button className={source === 'story' ? 'on' : ''} onClick={() => setSource('story')}>Câu chuyện</button>
        <button className={source === 'class' ? 'on' : ''} onClick={() => setSource('class')}>Class</button>
      </div>
      {source === 'class' && <ClassReports />}
      {source === 'story' && <div className="rpg-tabs">
        <button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>
          Chờ xử lý{newCount > 0 && <span className="rpg-badge">{newCount}</span>}
        </button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Đã xử lý</button>
      </div>}

      {source === 'story' && <>
      {msg && <div className="rpg-msg" onClick={() => setMsg('')}>{msg}</div>}

      {loading ? <div className="rpg-note">Đang tải…</div>
        : list.length === 0 ? (
          <div className="rpg-empty">
            {tab === 'new' ? '🌿 Không có báo cáo nào đang chờ.' : 'Chưa có báo cáo nào được xử lý.'}
          </div>
        ) : list.map(r => (
          <article key={r.id} className="rpg-card">
            <div className="rpg-reason">{REASON_LABELS[r.reason] ?? r.reason}</div>
            <h2>{r.story?.title || '(câu chuyện đã bị xoá)'}</h2>
            <div className="rpg-meta">
              {new Date(r.created_at).toLocaleString('vi-VN')}
              {r.story && <> · trạng thái bài: <b>{r.story.status}</b></>}
            </div>
            {r.note && <p className="rpg-note-text">“{r.note}”</p>}
            <div className="rpg-actions">
              {r.story?.slug && (
                <a className="rpg-btn" href={`/story/${r.story.slug}`} target="_blank" rel="noreferrer">Đọc bài</a>
              )}
              {r.status === 'new' && r.story && r.story.status === 'published' && (
                <button className="rpg-btn rpg-btn-danger" onClick={() => unpublish(r)}>Gỡ khỏi Tạp chí</button>
              )}
              {r.status === 'new' && r.story && (
                <button className="rpg-btn rpg-btn-danger" onClick={() => block(r)}>Chặn người kể</button>
              )}
              {r.status === 'new' && (
                <>
                  <button className="rpg-btn" onClick={() => mark(r, 'handled')}>Đã xử lý</button>
                  <button className="rpg-btn" onClick={() => mark(r, 'dismissed')}>Bỏ qua</button>
                </>
              )}
            </div>
          </article>
        ))}
      </>}
    </div>
  )
}

/** Tab "Class": báo cáo UGC của Class (class_reports) — chỉ Thầy. */
function ClassReports() {
  const [tab, setTab] = useState<'new' | 'done'>('new')
  const [rows, setRows] = useState<ClassReport[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const [rev, setRev] = useState(0)
  const reload = () => { setState('loading'); setRev(x => x + 1) }
  useEffect(() => {
    let alive = true
    void listClassReports(tab === 'new' ? 'new' : 'all').then(r => {
      if (!alive) return
      if (r.ok) { setRows(tab === 'new' ? r.value : r.value.filter(x => x.status !== 'new')); setState('ready') }
      else { setErr(r.message); setState('error') }
    })
    return () => { alive = false }
  }, [tab, rev])

  const act = async (r: ClassReport, action: ResolveAction, ask?: string) => {
    if (busyId !== null) return
    if (ask && !confirm(ask)) return
    setBusyId(r.id); setMsg('')
    const res = await resolveClassReport(r.id, action)
    setBusyId(null)
    setMsg(res.ok ? 'Đã xử lý báo cáo.' : res.message)
    if (res.ok) reload()
  }

  return (
    <>
      <div className="rpg-tabs">
        <button className={tab === 'new' ? 'on' : ''} onClick={() => { setState('loading'); setTab('new') }}>Chờ xử lý</button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => { setState('loading'); setTab('done') }}>Đã xử lý</button>
      </div>
      <p className="rpg-meta" style={{ marginBottom: 12 }}>Cam kết: xem lại và xử lý báo cáo Class nghiêm túc.</p>
      {msg && <div className="rpg-msg" onClick={() => setMsg('')}>{msg}</div>}
      {state === 'loading' && <div className="rpg-note">Đang tải…</div>}
      {state === 'error' && <div className="rpg-note">{err} <button className="rpg-btn" onClick={reload}>Thử lại</button></div>}
      {state === 'ready' && rows.length === 0 && (
        <div className="rpg-empty">{tab === 'new' ? '🌿 Không có báo cáo Class nào đang chờ.' : 'Chưa có báo cáo Class nào được xử lý.'}</div>
      )}
      {state === 'ready' && rows.map(r => (
        <article key={r.id} className="rpg-card">
          <div className="rpg-reason">{CLASS_REASON[r.reason] ?? r.reason}</div>
          <h2>{isReportKind(r.kind) ? REPORT_KIND_LABEL[r.kind] : r.kind}{r.targetUserName ? ` · ${r.targetUserName}` : ''}</h2>
          <div className="rpg-meta">
            {new Date(r.createdAt).toLocaleString('vi-VN')}{r.reporterName ? ` · người báo: ${r.reporterName}` : ''}
            {r.status !== 'new' && <> · {r.status === 'dismissed' ? 'đã bỏ qua' : 'đã xử lý'}{r.handledAction ? ` (${r.handledAction})` : ''}</>}
          </div>
          {r.excerpt && <p className="rpg-note-text">“{r.excerpt}”</p>}
          {r.note && <p className="rpg-note-text">Ghi chú: {r.note}</p>}
          {r.status === 'new' && (
            <div className="rpg-actions">
              <button className="rpg-btn rpg-btn-danger" disabled={busyId === r.id} onClick={() => void act(r, 'hide', 'Ẩn nội dung này?')}>Ẩn nội dung</button>
              {r.targetUserId && (
                <button className="rpg-btn rpg-btn-danger" disabled={busyId === r.id}
                  onClick={() => void act(r, 'hide_and_block', 'Ẩn nội dung và hạn chế tài khoản người đăng? Họ sẽ không đăng được nội dung mới.')}>Ẩn và chặn người đăng</button>
              )}
              <button className="rpg-btn" disabled={busyId === r.id} onClick={() => void act(r, 'handled')}>Đã xử lý</button>
              <button className="rpg-btn" disabled={busyId === r.id} onClick={() => void act(r, 'dismiss')}>Bỏ qua</button>
            </div>
          )}
        </article>
      ))}
    </>
  )
}

const CSS = `
.rpg-root { max-width: 720px; margin: 0 auto; padding: 24px 18px 60px; font-family: -apple-system, system-ui, sans-serif; color: #1A1A1A; text-align: left; }
.rpg-note, .rpg-empty { max-width: 720px; margin: 40px auto; padding: 0 18px; text-align: center; color: #6B6B70; font-family: -apple-system, system-ui, sans-serif; }
.rpg-back { font-size: 14px; color: #007AFF; text-decoration: none; }
.rpg-head h1 { font-size: 26px; font-weight: 700; margin: 10px 0 4px; }
.rpg-head p { font-size: 14px; color: #6B6B70; margin-bottom: 18px; }
.rpg-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.rpg-tabs button { border: 1.5px solid #E5E5EA; background: #fff; border-radius: 999px; padding: 8px 16px; font-size: 14px; font-family: inherit; cursor: pointer; color: #1A1A1A; display: flex; align-items: center; gap: 7px; }
.rpg-tabs button.on { border-color: #007AFF; color: #007AFF; font-weight: 600; }
.rpg-badge { background: #FF3B30; color: #fff; border-radius: 999px; font-size: 12px; font-weight: 700; padding: 1px 7px; }
.rpg-msg { background: #E9F7EC; color: #2E7D3A; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; cursor: pointer; }
.rpg-card { background: #fff; border: 1px solid #E5E5EA; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }
.rpg-reason { font-size: 12px; font-weight: 700; color: #C0342B; background: #FFF0EF; display: inline-block; padding: 3px 9px; border-radius: 6px; margin-bottom: 8px; }
.rpg-card h2 { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.rpg-meta { font-size: 12.5px; color: #8E8E93; }
.rpg-note-text { font-size: 14.5px; color: #4A4A4F; font-style: italic; margin-top: 9px; line-height: 1.5; }
.rpg-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
.rpg-btn { border: 1.5px solid #E5E5EA; background: #fff; border-radius: 10px; padding: 8px 14px; font-size: 13.5px; font-family: inherit; cursor: pointer; color: #1A1A1A; text-decoration: none; display: inline-block; }
.rpg-btn-danger { border-color: #FFC9C5; color: #C0342B; }
`
