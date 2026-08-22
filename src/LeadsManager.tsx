// LeadsManager — tab "Đăng ký" trong admin. Quản lý bảng leads từ trang tuyển sinh.
// Đọc/cập nhật status (authenticated). Lọc theo trạng thái, xem chi tiết, đổi trạng thái.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const C = {
  accent: '#2D6A4F', accentLight: '#E9F3EC', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', bg: '#F4F4F5', surface: '#FFFFFF',
}

const STATUSES = ['Chờ duyệt', 'Đã duyệt', 'Mới đăng ký', 'Đã xác nhận', 'Đang trải nghiệm', 'Cần gọi', 'Đã tư vấn', 'Học thử', 'Dùng thử app', 'Đã đóng phí', 'Chưa phù hợp']
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  'Chờ duyệt':       { bg: '#FEF9C3', fg: '#854D0E' },
  'Đã duyệt':        { bg: '#DCFCE7', fg: '#166534' },
  'Mới đăng ký':     { bg: '#E9F3EC', fg: '#2D6A4F' },
  'Đã xác nhận':     { bg: '#DBEAFE', fg: '#1E40AF' },
  'Đang trải nghiệm': { bg: '#FEF3C7', fg: '#92400E' },
  'Cần gọi':         { bg: '#FEF3C7', fg: '#92400E' },
  'Đã tư vấn':       { bg: '#E0F2FE', fg: '#075985' },
  'Học thử':         { bg: '#F3E8FF', fg: '#6B21A8' },
  'Dùng thử app':    { bg: '#FAE8FF', fg: '#86198F' },
  'Đã đóng phí':     { bg: '#DCFCE7', fg: '#166534' },
  'Chưa phù hợp':    { bg: '#F4F4F5', fg: '#71717A' },
}
const INTENT_LABEL: Record<string, string> = {
  dang_ky: 'Đăng ký lớp', hoc_thu_lop: 'Học thử lớp', dung_thu_app: 'Dùng thử app',
}

/**
 * BƯỚC 7 — Gói khách đã chọn (leads.package_choice) là NGUỒN SỰ THẬT.
 * Admin đọc field này trực tiếp — KHÔNG parse note.
 */
const PACKAGE_CHOICE_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  khoi_dau_99:   { label: 'Khởi đầu · 99K/tháng', bg: '#E0F2FE', fg: '#075985' },
  can_ban_396:   { label: 'Căn bản · 396K/tháng', bg: '#E9F3EC', fg: '#2D6A4F' },
  nang_cao_499:  { label: 'Nâng cao · 499K/tháng', bg: '#F3E8FF', fg: '#6B21A8' },
  hanh_trinh_9990: { label: 'Hành trình cùng Thầy · 9.990K/năm', bg: '#FEF3C7', fg: '#92400E' },
}

/** Các gói tháng có tháng đầu miễn phí (flow "Bắt đầu trải nghiệm"). */
const TRIAL_PACKAGE_CHOICES = ['khoi_dau_99', 'can_ban_396', 'nang_cao_499']

/** Cộng 1 THÁNG LỊCH (calendar month) — 31/01 + 1 tháng → cuối tháng 2. */
const addCalendarMonth = (iso: string): Date => {
  const d = new Date(iso)
  const day = d.getDate()
  d.setMonth(d.getMonth() + 1)
  if (d.getDate() < day) d.setDate(0)
  return d
}
const fmtDMY = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

interface Lead {
  id: number; name: string; phone: string; zalo: string | null; email: string | null
  class_name: string | null; path: string | null; intent: string | null; note: string | null
  source: string | null; status: string; created_at: string
  is_hanhtrinh?: boolean | null; student_id?: string | null
  package_choice?: string | null
  trial_started_at?: string | null
}
interface CourseOpt { id: string; name: string; code?: string | null }
interface ClassOpt { id: string; code: string | null; name: string }
interface PkgRow { student_id: string | null; renews_at: string | null; packages: { name: string } | { name: string }[] | null }
interface PkgInfo { name: string; renews_at: string }

// PostgREST embed (packages(name)) có thể trả object hoặc mảng — lấy tên gói an toàn
const pkgName = (p: PkgRow['packages']): string | null =>
  Array.isArray(p) ? (p[0]?.name ?? null) : (p?.name ?? null)

const buildPkgMap = (data: PkgRow[]): Record<string, PkgInfo> => {
  const m: Record<string, PkgInfo> = {}
  data.forEach((r) => {
    const n = pkgName(r.packages)
    if (r.student_id && n) m[r.student_id] = { name: n, renews_at: r.renews_at ?? '' }
  })
  return m
}

// Query gói active của học viên (Đợt 2) — dùng chung cho nạp đầu + refresh sau kích hoạt
const fetchActivePkgs = () =>
  supabase.from('student_packages').select('student_id, renews_at, packages(name)').eq('status', 'active')

// Mật khẩu mặc định khi tạo tài khoản từ duyệt đăng ký — học viên đổi sau trong app (đồng bộ AiAssistant)
const DEFAULT_PW = '12345678'

export default function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [pick, setPick] = useState<Record<number, string>>({})   // leadId → course_id đã chọn để mở
  const [opening, setOpening] = useState<number | null>(null)
  const [classes, setClasses] = useState<ClassOpt[]>([])          // lịch lớp — để duyệt nhanh vào đúng lớp
  const [pickClass, setPickClass] = useState<Record<number, string>>({})  // leadId → class id đã chọn
  const [approving, setApproving] = useState<number | null>(null)
  const [activatingPkg, setActivatingPkg] = useState<number | null>(null)
  // BƯỚC 7 — lỗi thao tác hiển thị INLINE (không nuốt lỗi, không chỉ dựa optimistic UI)
  const [opErr, setOpErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  // student_id → gói đang active (Đợt 2: hiển thị trạng thái gói + renews_at cho Thầy)
  const [pkgInfo, setPkgInfo] = useState<Record<string, PkgInfo>>({})

  const load = async () => {
    setLoading(true); setErr(null)
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) { setErr(error.message); setLoading(false); return }
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Đợt 2: refresh gói active sau khi kích hoạt
  const loadPkgInfo = async () => {
    const { data, error } = await fetchActivePkgs()
    if (!error && data) setPkgInfo(buildPkgMap(data as PkgRow[]))
  }

  useEffect(() => {
    supabase.from('edu_courses').select('id,name,code').order('sort_order')
      .then(({ data }) => setCourses((data ?? []) as CourseOpt[]))
    supabase.from('class_schedule').select('id,code,name').eq('is_active', true).order('sort_order')
      .then(({ data }) => setClasses((data ?? []) as ClassOpt[]))
    // nạp gói active trong .then() — không setState đồng bộ trong effect
    fetchActivePkgs().then(({ data, error }) => {
      if (!error && data) setPkgInfo(buildPkgMap(data as PkgRow[]))
    })
  }, [])

  // Gợi ý khoá khớp nhất với tên lớp đăng ký
  const guessCourse = (l: Lead): string => {
    const cn = (l.class_name ?? '').toLowerCase()
    const hit = courses.find(c => cn && (cn.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cn)))
    return hit?.id ?? courses[0]?.id ?? ''
  }
  // DUYỆT → mở khoá: ghi danh + cấp quyền cho học sinh, đánh dấu Đã duyệt
  const approveOpen = async (l: Lead) => {
    if (!l.student_id) { alert('Yêu cầu này chưa gắn tài khoản học sinh — không mở khoá tự động được. Hãy mở thủ công ở Hồ sơ học viên.'); return }
    const courseId = pick[l.id] ?? guessCourse(l)
    if (!courseId) { alert('Chưa chọn được khoá để mở.'); return }
    setOpening(l.id)
    const uid = (await supabase.auth.getUser()).data.user?.id
    await supabase.from('edu_enrollments').upsert({ student_id: l.student_id, course_id: courseId, enrolled_by: uid, is_active: true }, { onConflict: 'student_id,course_id' })
    const { error } = await supabase.from('edu_course_access').upsert({ student_id: l.student_id, course_id: courseId, active: true, granted_by: uid, note: 'Duyệt đăng ký (Hành trình)' }, { onConflict: 'student_id,course_id' })
    setOpening(null)
    if (error) { alert('Mở khoá lỗi: ' + error.message); return }
    const cname = courses.find(c => c.id === courseId)?.name ?? 'khoá'
    setStatus(l.id, 'Đã duyệt')
    alert(`Đã mở "${cname}" cho ${l.name}.`)
  }

  // Khớp lớp với tên lớp học viên đã bấm đăng ký (form ghi đúng name từ class_schedule)
  const guessClass = (l: Lead): string => {
    const cn = (l.class_name ?? '').trim().toLowerCase()
    if (!cn) return ''
    const hit = classes.find(c => c.name.trim().toLowerCase() === cn)
      ?? classes.find(c => c.code && cn.includes(c.code.toLowerCase()))
      ?? classes.find(c => c.name.toLowerCase().includes(cn) || cn.includes(c.name.toLowerCase()))
    return hit?.id ?? ''
  }

  // Đọc lỗi từ functions.invoke (FunctionsHttpError giấu message trong context)
  const fnErr = async (e: any): Promise<string> => {
    try { const j = await e?.context?.json?.(); if (j?.error) return j.error } catch { /* ignore */ }
    return e?.message || 'lỗi gọi máy chủ'
  }

  // ⚡ DUYỆT NHANH đăng ký thường: tạo tài khoản (nếu chưa có) + vào đúng lớp theo MÃ
  // (qua admin-ai: action create + add_group — add_group tự gọi backfill_class cấp khoá của lớp)
  const approveCreate = async (l: Lead) => {
    const email = (l.email ?? '').trim().toLowerCase()
    if (!email) { alert('Đăng ký này không có email — cần email để tạo tài khoản. Thầy liên hệ học viên bổ sung rồi duyệt sau.'); return }
    const clsId = pickClass[l.id] ?? guessClass(l)
    const cls = classes.find(c => c.id === clsId)
    if (!cls) { if (!confirm('Chưa chọn được lớp — sẽ CHỈ TẠO TÀI KHOẢN, không tự vào lớp. Tiếp tục?')) return }
    else if (!cls.code) { if (!confirm(`Lớp "${cls.name}" chưa có MÃ LỚP — sẽ chỉ tạo tài khoản, không tự vào nhóm/cấp khoá được. Tiếp tục?`)) return }
    setApproving(l.id)
    try {
      // 1) Tạo tài khoản — email đã tồn tại thì bỏ qua, đi tiếp bước vào lớp (idempotent)
      let password: string | null = null
      let existed = false
      try {
        const { data: cr, error: crErr } = await supabase.functions.invoke('admin-ai',
          { body: { action: 'create', students: [{ email, full_name: l.name, password: DEFAULT_PW }] } })
        if (crErr) throw crErr
        const r0 = cr?.results?.[0]
        if (r0?.ok) password = r0.password
        else if (/đã có tài khoản/i.test(r0?.error ?? '')) existed = true
        else throw new Error(r0?.error || 'không tạo được tài khoản')
      } catch (e: any) { throw new Error(e?.context ? await fnErr(e) : (e?.message || String(e))) }
      // 2) Vào lớp theo mã (nhóm Zalo ≡ mã lớp; backfill_class cấp toàn bộ khoá của lớp)
      let groupMsg = ''
      if (cls?.code) {
        const { data: ga, error: gaErr } = await supabase.functions.invoke('admin-ai',
          { body: { action: 'add_group', assignments: [{ studentEmail: email, groupName: cls.code }] } })
        if (gaErr) throw new Error(await fnErr(gaErr))
        const g0 = ga?.results?.[0]
        if (!g0?.ok) throw new Error(g0?.error || 'không vào được lớp')
        groupMsg = `\n• Vào lớp ${cls.code}` + (typeof g0.coursesGranted === 'number' ? ` — đã cấp khoá của lớp` : '') + (g0.warn ? `\n⚠ ${g0.warn}` : '')
      }
      setStatus(l.id, 'Đã duyệt')
      alert(`✅ Duyệt xong cho ${l.name}:\n• Tài khoản: ${email}${existed ? ' (đã có từ trước — giữ nguyên mật khẩu cũ)' : ` · mật khẩu: ${password ?? DEFAULT_PW}`}${groupMsg}\n\nGửi thông tin đăng nhập cho học viên qua Zalo/điện thoại nhé.`)
    } catch (e) {
      alert('Duyệt lỗi: ' + ((e as Error)?.message || e))
    } finally { setApproving(null) }
  }

  // 🎸 KÍCH HOẠT GÓI ĐỒNG HÀNH 396K — mã khoá theo hướng đã chọn ở placement
  const pkgCodes = (l: Lead): string[] | null => {
    const p = (l.path ?? '').toLowerCase()
    if (p.includes('dem')) return ['NM', 'DH1']
    if (p.includes('tia')) return ['NM', 'TN1']
    return null // mặc định config gói (NM) — solo/chưa biết cần Thầy xác nhận trước
  }
  const pkgNames = (codes: string[] | null) =>
    (codes ?? ['NM']).map(c => courses.find(x => x.code === c)?.name ?? c).join(' + ')

  const activatePkg = async (l: Lead) => {
    const email = (l.email ?? '').trim().toLowerCase()
    if (!email && !l.student_id) { alert('Đăng ký này chưa có email/tài khoản — cần email để kích hoạt gói.'); return }
    setActivatingPkg(l.id)
    try {
      let studentId = l.student_id
      let password: string | null = null
      let existed = false
      if (!studentId) {
        // Tạo tài khoản theo cơ chế signup hiện tại (admin-ai create) — không tạo hệ thống account mới
        try {
          const { data: cr, error: crErr } = await supabase.functions.invoke('admin-ai',
            { body: { action: 'create', students: [{ email, full_name: l.name, password: DEFAULT_PW }] } })
          if (crErr) throw crErr
          const r0 = cr?.results?.[0]
          if (r0?.ok) password = r0.password
          else if (/đã có tài khoản/i.test(r0?.error ?? '')) existed = true
          else throw new Error(r0?.error || 'không tạo được tài khoản')
        } catch (e) {
          throw new Error(
            e && typeof e === 'object' && 'context' in e ? await fnErr(e) : e instanceof Error ? e.message : String(e),
            { cause: e },
          )
        }
        const { data: stu, error: sErr } = await supabase.from('edu_students').select('id').eq('email', email).limit(1).maybeSingle()
        if (sErr || !stu?.id) throw new Error('Tạo tài khoản xong nhưng không tìm thấy hồ sơ học viên')
        studentId = stu.id
        await supabase.from('leads').update({ student_id: studentId }).eq('id', l.id)
      }
      const codes = pkgCodes(l)
      const { data: rp, error: rpErr } = await supabase.rpc('activate_student_package',
        { p_student: studentId, p_package_code: 'DONG_HANH_396K', p_course_codes: codes ?? null })
      if (rpErr) throw new Error(rpErr.message)
      const names = ((rp?.granted_codes ?? []) as string[])
        .map(c => courses.find(x => x.code === c)?.name ?? c).join(', ')
      const zaloUrl = (rp?.zalo_url as string) || ''
      const teacherZalo = (rp?.zalo_teacher_url as string) || ''
      const practice = (rp?.practice_schedule as string) || ''
      setStatus(l.id, 'Đã đóng phí')
      loadPkgInfo()
      alert(`✅ Đã kích hoạt gói ĐỒNG HÀNH 396K cho ${l.name}:
• Tài khoản: ${email || 'đã có sẵn'}${existed ? ' (đã có — giữ mật khẩu cũ)' : password ? ` · mật khẩu: ${password}` : ''}
• Mở khoá: ${names || '—'}
• Gói đến: ${rp?.renews_at ? fmtDate(rp.renews_at) : '—'}
${zaloUrl ? `• Nhóm Zalo chung: ${zaloUrl}
` : ''}${teacherZalo ? `• Hỏi Thầy: ${teacherZalo}
` : ''}${practice ? `• Lịch thực hành: ${practice}
` : ''}
Gửi thông tin đăng nhập + link app cho học viên nhé.`)
    } catch (e) {
      alert('Kích hoạt lỗi: ' + ((e as Error)?.message || e))
    } finally { setActivatingPkg(null) }
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => { m[l.status] = (m[l.status] ?? 0) + 1 })
    return m
  }, [leads])

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return leads.filter(l =>
      (filter === 'all' || l.status === filter) &&
      (!kw || [l.name, l.phone, l.zalo, l.email, l.class_name].some(x => (x ?? '').toLowerCase().includes(kw)))
    )
  }, [leads, filter, q])

  /**
   * SERVER LÀ NGUỒN SỰ THẬT: gửi UPDATE → chờ DB → select verify row trả về
   * → chỉ khi DB xác nhận status mới cập UI. Thất bại → giữ UI cũ + hiện lỗi inline.
   */
  const setStatus = async (id: number, status: string): Promise<boolean> => {
    setOpErr(null)
    setBusyId(id)
    try {
      const { data, error } = await supabase
        .from('leads').update({ status }).eq('id', id)
        .select('id,status').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('máy chủ không xác nhận được cập nhật (0 row) — thử lại')
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: data!.status } : l))
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setOpErr(`Không cập nhật được trạng thái lead #${id}: ${msg}. Dữ liệu giữ nguyên — hãy kiểm tra đăng nhập rồi thử lại.`)
      await load() // đồng bộ lại đúng theo DB
      return false
    } finally {
      setBusyId(null)
    }
  }

  /** BƯỚC 7 — Bắt đầu trải nghiệm: status → Đang trải nghiệm + ghi trial_started_at NẾU chưa có.
   *  Idempotent: nếu trial_started_at đã có giá trị → GIỮ NGUYÊN (không ghi đè ngày bắt đầu cũ).
   *  SERVER LÀ NGUỒN SỰ THẬT: chỉ cập UI sau khi DB verify trả về row đúng. */
  const startTrial = async (l: Lead): Promise<boolean> => {
    const now = new Date().toISOString()
    setOpErr(null)
    setBusyId(l.id)
    try {
      const { data, error } = await supabase
        .from('leads').update({ status: 'Đang trải nghiệm', trial_started_at: l.trial_started_at ?? now }).eq('id', l.id)
        .select('id,status,trial_started_at').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('máy chủ không xác nhận được cập nhật (0 row) — thử lại')
      setLeads(prev => prev.map(x => x.id === l.id ? { ...x, status: data!.status, trial_started_at: data!.trial_started_at } : x))
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setOpErr(`Không bắt đầu được trải nghiệm cho lead #${l.id}: ${msg}. Dữ liệu giữ nguyên — hãy kiểm tra đăng nhập rồi thử lại.`)
      await load()
      return false
    } finally {
      setBusyId(null)
    }
  }

  const fmtDate = (s: string) => {
    const d = new Date(s)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text1 }}>Đăng ký từ trang tuyển sinh</h2>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 2 }}>{leads.length} người · cập nhật trạng thái để theo dõi phễu</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên / SĐT / email / lớp..."
            style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, width: 240, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={load} style={{ padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>↻ Tải lại</button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilter('all')}
          style={chipStyle(filter === 'all')}>Tất cả ({leads.length})</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={chipStyle(filter === s)}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* BƯỚC 7 — lỗi thao tác hiển thị rõ ràng (server là nguồn sự thật) */}
      {opErr && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 13.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ flex: 1, lineHeight: 1.5 }}>⚠ {opErr}</span>
          <button onClick={() => setOpErr(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }} aria-label="Đóng thông báo lỗi">✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: C.text3, fontSize: 14, padding: 20 }}>Đang tải...</div>
      ) : err ? (
        <div style={{ color: '#DC2626', fontSize: 14, padding: 16, background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA' }}>
          Lỗi đọc bảng leads: {err}<br />
          <span style={{ color: C.text2 }}>Có thể bảng <code>leads</code> chưa được tạo — chạy <code>db/class_tuyensinh_setup.sql</code> trong Supabase.</span>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ color: C.text3, fontSize: 14, padding: 20 }}>Chưa có đăng ký nào{filter !== 'all' ? ' ở trạng thái này' : ''}.</div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#FAFAFA', textAlign: 'left', color: C.text2 }}>
                <th style={th}>Ngày</th>
                <th style={th}>Họ tên</th>
                <th style={th}>Liên hệ</th>
                <th style={th}>Gói đã chọn</th>
                <th style={th}>Lớp / Ý định</th>
                <th style={th}>Ghi chú</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(l => {
                const pkg = PACKAGE_CHOICE_LABEL[l.package_choice ?? '']
                const isNewClass2 = !!l.package_choice // lead từ flow chọn gói mới (BƯỚC 6)
                return (
                <tr key={l.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={td}><span style={{ color: C.text3, whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</span></td>
                  <td style={td}><b style={{ color: C.text1 }}>{l.name}</b></td>
                  <td style={td}>
                    <div style={{ whiteSpace: 'nowrap' }}>{l.phone}</div>
                    {l.zalo && <div style={{ color: C.text3, fontSize: 12 }}>Zalo: {l.zalo}</div>}
                    {l.email && <div style={{ color: C.text3, fontSize: 12 }}>{l.email}</div>}
                  </td>
                  <td style={td}>
                    {pkg ? (
                      <span style={{ fontSize: 12, fontWeight: 800, color: pkg.fg, background: pkg.bg, borderRadius: 6, padding: '3px 9px', display: 'inline-block' }}>
                        {pkg.label}
                      </span>
                    ) : (
                      <span style={{ color: C.text3 }}>—</span>
                    )}
                    {l.source === 'class2' && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#2D6A4F', fontWeight: 700 }}>Class 2.0</div>
                    )}
                    {/* BƯỚC 7 — tháng trải nghiệm: ngày bắt đầu + dự kiến hết (+1 tháng lịch) */}
                    {l.trial_started_at && (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '5px 8px', lineHeight: 1.6 }}>
                        Bắt đầu: {fmtDMY(new Date(l.trial_started_at))}<br />
                        Dự kiến hết tháng miễn phí: {fmtDMY(addCalendarMonth(l.trial_started_at))}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {l.class_name && <div>{l.class_name}</div>}
                    <span style={{ fontSize: 11.5, color: C.accent, background: C.accentLight, borderRadius: 5, padding: '1px 7px' }}>{INTENT_LABEL[l.intent ?? ''] ?? l.intent ?? '—'}</span>
                    {/* Đợt 2: trạng thái gói đang active của học viên */}
                    {pkgInfo[l.student_id ?? ''] && (
                      <div style={{ marginTop: 4, fontSize: 11.5, color: '#065F46', background: '#D1FAE5', borderRadius: 5, padding: '1px 7px', display: 'inline-block' }}>
                        🎸 {pkgInfo[l.student_id ?? ''].name} · đến {fmtDate(pkgInfo[l.student_id ?? ''].renews_at)}
                      </div>
                    )}
                    {/* ⚡ Duyệt nhanh đăng ký thường: tạo tài khoản + vào đúng lớp đã đăng ký.
                        KHÔNG hiện khi: lead đã có student_id (đã tạo tài khoản), hoặc trạng thái
                        đã chốt (Đã duyệt / Đã đóng phí) — tránh bấm nhầm flow cũ. */}
                    {!l.is_hanhtrinh && !l.package_choice && l.intent === 'dang_ky' && !l.student_id
                      && l.status !== 'Đã duyệt' && l.status !== 'Đã đóng phí' && (
                      <div style={{ marginTop: 8, background: C.accentLight, border: '1px solid #C7D2FE', borderRadius: 8, padding: '8px 9px' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#3730A3', marginBottom: 6 }}>⚡ Duyệt nhanh — tạo tài khoản + vào lớp</div>
                        {l.email ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select value={pickClass[l.id] ?? guessClass(l)} onChange={e => setPickClass(p => ({ ...p, [l.id]: e.target.value }))}
                              style={{ padding: '5px 7px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', maxWidth: 200 }}>
                              <option value="">— chọn lớp —</option>
                              {classes.map(c => <option key={c.id} value={c.id}>{(c.code ? c.code + ' · ' : '') + c.name}</option>)}
                            </select>
                            <button onClick={() => approveCreate(l)} disabled={approving === l.id}
                              style={{ background: approving === l.id ? C.text3 : C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {approving === l.id ? 'Đang duyệt…' : '✅ Duyệt: tạo TK + vào lớp'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: '#92400E' }}>Thiếu email — không tạo tài khoản tự động được (liên hệ học viên bổ sung).</div>
                        )}
                      </div>
                    )}
                    {l.is_hanhtrinh && !l.package_choice && (
                      <div style={{ marginTop: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 9px' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#166534', marginBottom: 6 }}>🎁 Lớp Hành trình — xin mở miễn phí</div>
                        {l.student_id ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select value={pick[l.id] ?? guessCourse(l)} onChange={e => setPick(p => ({ ...p, [l.id]: e.target.value }))}
                              style={{ padding: '5px 7px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', maxWidth: 180 }}>
                              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button onClick={() => approveOpen(l)} disabled={opening === l.id}
                              style={{ background: '#15803D', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {opening === l.id ? '...' : '✅ Duyệt & mở khoá'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: '#92400E' }}>Chưa gắn tài khoản — mở thủ công ở Hồ sơ học viên.</div>
                        )}
                      </div>
                    )}
                    {/* 🎸 Kích hoạt gói ĐỒNG HÀNH 396K (Đợt 1) — lead → tài khoản → gói → quyền.
                        CHỈ cho lead cũ (chưa có package_choice) — lead mới Class 2.0 xử lý theo gói đã chọn. */}
                    {!l.package_choice && (
                    <div style={{ marginTop: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 9px' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#065F46', marginBottom: 4 }}>🎸 Gói ĐỒNG HÀNH 396K</div>
                      <div style={{ fontSize: 11.5, color: '#047857', marginBottom: 6 }}>
                        Sẽ mở: {pkgNames(pkgCodes(l))}
                      </div>
                      <button onClick={() => activatePkg(l)} disabled={activatingPkg === l.id}
                        style={{ background: activatingPkg === l.id ? C.text3 : '#059669', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {activatingPkg === l.id ? 'Đang kích hoạt…' : 'Kích hoạt gói'}
                      </button>
                    </div>
                    )}
                  </td>
                  <td style={{ ...td, maxWidth: 220, color: C.text2 }}>{l.note || <span style={{ color: C.text3 }}>—</span>}</td>
                  <td style={td}>
                    <select value={l.status} disabled={busyId === l.id} onChange={e => { void setStatus(l.id, e.target.value) }}
                      style={{
                        padding: '5px 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: 'none', appearance: 'auto',
                        background: (STATUS_COLOR[l.status] ?? STATUS_COLOR['Chưa phù hợp']).bg,
                        color: (STATUS_COLOR[l.status] ?? STATUS_COLOR['Chưa phù hợp']).fg,
                      }}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {/* BƯỚC 7 — vòng đời tối thiểu cho lead Class 2.0: Mới đăng ký → Đã xác nhận → Đang trải nghiệm.
                        "Bắt đầu trải nghiệm" CHỈ cho 3 gói tháng (99/396/499) — Hành trình 9.990K không có tháng miễn phí. */}
                    {isNewClass2 && l.status === 'Mới đăng ký' && (
                      <button onClick={() => { void setStatus(l.id, 'Đã xác nhận') }} disabled={busyId === l.id}
                        style={{ marginTop: 6, width: '100%', background: busyId === l.id ? C.text3 : '#2563EB', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 8px', fontSize: 12, fontWeight: 700, cursor: busyId === l.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                        {busyId === l.id ? 'Đang ghi…' : '✅ Xác nhận'}
                      </button>
                    )}
                    {isNewClass2 && TRIAL_PACKAGE_CHOICES.includes(l.package_choice ?? '') && l.status === 'Đã xác nhận' && (
                      <button onClick={() => { void startTrial(l) }} disabled={busyId === l.id}
                        style={{ marginTop: 6, width: '100%', background: busyId === l.id ? C.text3 : '#D97706', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 8px', fontSize: 12, fontWeight: 700, cursor: busyId === l.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                        {busyId === l.id ? 'Đang ghi…' : '▶ Bắt đầu trải nghiệm'}
                      </button>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: 12.5 }
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'top' }
function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent : C.surface,
    color: active ? '#fff' : C.text2,
  }
}
