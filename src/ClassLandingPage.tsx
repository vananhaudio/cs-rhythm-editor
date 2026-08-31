// ClassLandingPage — trang tuyển sinh class.vananhaudio.com (route /class)
// Cổng tuyển sinh "có đạo diễn": 3 cửa vào → showcase hành động → chat nhẹ →
// lớp sắp khai giảng → quyền lợi → form (ghi leads) → thanh toán (ẩn) → app/thầy/FAQ.
// Quy ước: dùng chung Supabase (anon ghi leads). Style: scoped CSS .tva-class (responsive/hover).
import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'
import { checkEmail } from './logic/emailCheck'
import ClassJourney2027 from './ClassJourney2027'
import ClassDemHat from './ClassDemHat'
import ClassTiaNot from './ClassTiaNot'
import ClassQuiz from './ClassQuiz'
import ClassAppGuide from './ClassAppGuide'
import ClassNangCao from './ClassNangCao'
import { FAQS } from './classFaq'
import { tenNangLuc } from './hanhtrinh'
import ClassBenefitDetail, { type BenefitKey } from './components/ClassBenefitDetail'
import ClassLearningWays from './components/ClassLearningWays'
import ClassWeekJourney from './components/ClassWeekJourney'

// ─── Combo Hành trình — sản phẩm bán quanh năm, KHÔNG nằm trong class_schedule ───
// (Lịch lớp thật đọc từ bảng class_schedule; tuyệt đối không hardcode lớp ở đây.)
const COMBO_HT = { name: 'Hành trình Guitar 2027 (combo 10 khoá)', path: 'combo', price: 'Combo' }

// Suy ra nhãn/lộ trình/giá từ tên lớp (dữ liệu sheet không có sẵn các cột này)
const inferTag = (n: string) => { const s = n.toLowerCase()
  if (s.includes('nhập môn')) return 'Nhập môn · Miễn phí'
  if (s.includes('hành trình')) return 'Toàn diện · Combo'
  if (s.includes('đệm hát')) return 'Đệm hát'
  if (s.includes('tỉa nốt') || s.includes('guitar cho') || s.includes('guitar căn')) return 'Tỉa nốt / Guitar'
  if (s.includes('cảm nhận') || s.includes('cảm âm') || s.includes('nhạc lý')) return 'Cảm âm / Nhạc lý'
  if (s.includes('bolero')) return 'Chuyên đề'
  return 'Guitar' }
const inferPath = (n: string) => { const s = n.toLowerCase()
  if (s.includes('đệm hát')) return 'dem_hat'
  if (s.includes('tỉa nốt') || s.includes('guitar')) return 'tia_not'
  if (s.includes('hành trình')) return 'combo'
  return '' }
import { DOORS, CHAT_FAQ, MODALS } from './class-content'


const ZALO = '0983 259 893'
const ZALO_LINK = 'https://zalo.me/vananhguitarist'
const SHOP_URL = 'https://shop.vananhaudio.com'

type Msg = { who: 'ai' | 'me'; html: string }

export default function ClassLandingPage() {
  const [form, setForm] = useState({ name: '', phone: '', zalo: '', email: '', className: '', note: '', isHanhtrinh: false })
  const [showPending, setShowPending] = useState(false)   // học sinh HT gửi yêu cầu miễn phí → chờ duyệt
  const [formErr, setFormErr] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [sent, setSent] = useState(false)
  const [okBox, setOkBox] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [showJourney, setShowJourney] = useState(false)

  // Deep-link: /class#hanh-trinh mở thẳng Bản đồ hành trình (chia sẻ được qua Zalo)
  useEffect(() => {
    if (window.location.hash === '#hanh-trinh') setShowJourney(true)
  }, [])
  const [showDemHat, setShowDemHat] = useState(false)
  const [showTiaNot, setShowTiaNot] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showPractice, setShowPractice] = useState(false)   // modal xem một buổi thực hành (video thật)
  const [benefit, setBenefit] = useState<BenefitKey | null>(null)   // chiều sâu 6 quyền lợi (reuse từ /azz)
  const [showNangCao, setShowNangCao] = useState(false)
  const [waysTab, setWaysTab] = useState<'practice' | 'class'>('practice')   // tab 2 cách học: Gói Thực hành (CAM) / Gói Học theo lớp (TÍM)
  const [miraOpen, setMiraOpen] = useState(false)   // bong bóng Mira nổi góc phải
  const [miraEver, setMiraEver] = useState(false)   // đã mở lần nào chưa (giữ iframe, không tải lại)
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'ai', html: 'Chào bạn 👋 Mình là <b>Mira</b>, trợ lý của Thầy Văn Anh Guitar. Bạn đang muốn học guitar theo hướng nào, hay còn băn khoăn gì? Cứ hỏi mình nhé.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatSessionRef = useRef<string | null>(null)
  const [articles, setArticles] = useState<Record<string, { title: string; body: string }>>({})
  type SchedItem = { name: string; code: string; schedule: string; start: string; price?: string; courseTitle?: string; tag?: string; dateLabel?: string }
  const [sched, setSched] = useState<{ upcoming: SchedItem[]; active: SchedItem[]; smallGroup: { schedule: string }[]; oneOnOneCount: number; activeCount: number } | null>(null)
  const [showActive, setShowActive] = useState(false)
  const [faqAll, setFaqAll] = useState(false)
  // Tạo tài khoản miễn phí (gọi Edge Function signup-free)
  const [showSignup, setShowSignup] = useState(false)
  const [suName, setSuName] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPass, setSuPass] = useState('')
  const [suLoading, setSuLoading] = useState(false)
  const [suErr, setSuErr] = useState('')
  const [suSuggest, setSuSuggest] = useState('')   // email gợi ý sửa khi gõ nhầm tên miền
  const [suDone, setSuDone] = useState(false)

  // ── Đăng nhập học viên ngay trên trang tuyển sinh ──
  const [me, setMe] = useState<{ name: string; email?: string | null; phone?: string | null } | null>(null)   // null = chưa đăng nhập
  const [showLogin, setShowLogin] = useState(false)
  const [liEmail, setLiEmail] = useState('')
  const [liPass, setLiPass] = useState('')
  const [liErr, setLiErr] = useState('')
  const [liLoading, setLiLoading] = useState(false)

  const loadMe = async (userId: string, email: string | null) => {
    const { data: stu } = await supabase.from('edu_students').select('id,full_name,display_name,email,phone').eq('user_id', userId).maybeSingle()
    const nm = stu?.display_name || stu?.full_name || (email ? email.split('@')[0] : 'bạn')
    const cleanName = (nm || 'bạn').includes('@') ? (nm as string).split('@')[0] : nm as string
    setMe({ name: cleanName, email: (stu as any)?.email || email || null, phone: (stu as any)?.phone || null })
  }
  // Favicon riêng CHO TRANG CLASS (component này chỉ chạy trên hostname class.) = logo gốc
  useEffect(() => {
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(el => el.remove())
    const link = document.createElement('link')
    link.rel = 'icon'; link.type = 'image/svg+xml'; link.href = '/logo-green.svg'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user) loadMe(session.user.id, session.user.email ?? null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) loadMe(session.user.id, session.user.email ?? null); else setMe(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Đăng nhập xong → tự điền sẵn họ tên / email / SĐT vào form đăng ký (đỡ phiền nhập lại)
  useEffect(() => {
    if (!me) return
    setForm(f => ({
      ...f,
      name: f.name || me.name || '',
      email: f.email || me.email || '',
      phone: f.phone || me.phone || '',
    }))
  }, [me])

  // Đăng nhập xong → Mira chào theo tên (nếu chat chưa diễn tiến)
  useEffect(() => {
    if (!me) return
    setMsgs(prev => prev.length <= 1
      ? [{ who: 'ai', html: `Chào ${me.name} 👋 Mình là <b>Mira</b>, trợ lý của Thầy Văn Anh Guitar. Rất vui được gặp lại bạn! Bạn cần mình hỗ trợ gì hôm nay?` }]
      : prev)
  }, [me])

  const submitLogin = async () => {
    setLiErr('')
    if (!liEmail.trim() || !liPass.trim()) { setLiErr('Nhập email và mật khẩu.'); return }
    setLiLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: liEmail.trim(), password: liPass.trim() })
    setLiLoading(false)
    if (error || !data.user) { setLiErr('Sai email hoặc mật khẩu, thử lại nhé.'); return }
    await loadMe(data.user.id, data.user.email ?? null)
    setShowLogin(false)
  }

  const submitSignup = async () => {
    setSuErr(''); setSuSuggest('')
    const ec = checkEmail(suEmail)
    if (!ec.ok) { setSuErr(ec.error || 'Email chưa đúng.'); setSuSuggest(ec.suggestion || ''); return }
    if (suPass.trim().length < 6) { setSuErr('Mật khẩu cần ít nhất 6 ký tự.'); return }
    setSuLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('signup-free', { body: { name: suName.trim(), email: suEmail.trim(), password: suPass.trim() } })
      const res = (data || {}) as { ok?: boolean; error?: string }
      if (error || res.error) { setSuErr(res.error || 'Tạo tài khoản chưa được, thử lại hoặc nhắn Zalo thầy nhé.'); setSuLoading(false); return }
      setSuDone(true)
    } catch { setSuErr('Lỗi kết nối, thử lại nhé.') }
    setSuLoading(false)
  }
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const miraRef = useRef<HTMLIFrameElement>(null) // iframe Mira mới
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  // DANH TÍNH: gửi token đăng nhập sang iframe Mira (đúng origin Mira) để Mira
  // biết tên & hồ sơ học viên. Iframe báo 'mira-ready' → gửi token; đăng nhập/
  // đăng xuất giữa chừng cũng cập nhật.
  useEffect(() => {
    const MIRA_ORIGIN = 'https://mira-vananhaudio.netlify.app'
    const postToken = async () => {
      const { data } = await supabase.auth.getSession()
      miraRef.current?.contentWindow?.postMessage(
        { type: 'mira-auth', token: data.session?.access_token ?? null }, MIRA_ORIGIN)
    }
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== MIRA_ORIGIN) return
      if ((ev.data as { type?: string } | null)?.type === 'mira-ready') void postToken()
    }
    window.addEventListener('message', onMsg)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void postToken() })
    return () => { window.removeEventListener('message', onMsg); subscription.unsubscribe() }
  }, [])

  // Đọc bài viết published → map theo slot (thẻ showcase sống dậy khi thầy đăng bài)
  useEffect(() => {
    supabase.from('articles').select('slot,title,body').eq('published', true).then(({ data }) => {
      if (!data) return
      const m: Record<string, { title: string; body: string }> = {}
      data.forEach((a: { slot: string | null; title: string; body: string | null }) => {
        if (a.slot) m[a.slot] = { title: a.title, body: a.body ?? '' }
      })
      setArticles(m)
    })
  }, [])

  // Đọc lịch lớp từ bảng class_schedule + gắn TÊN KHOÁ/CẤP ĐỘ (từ khoá đã liên kết)
  useEffect(() => {
    const TRACK_VI: Record<string, string> = { dem_hat: 'Đệm hát', tia_not: 'Tỉa nốt', nhac_ly: 'Nhạc lý', nhap_mon: 'Nhập môn', solo: 'Solo', cam_am: 'Cảm âm' }
    Promise.all([
      supabase.from('class_schedule').select('code,name,section,schedule,start_text,price,course_ids,main_course_id,is_active,sort_order,start_date,end_date,status').eq('is_active', true).eq('show_on_practice_schedule', false).order('sort_order').order('created_at'),
      supabase.from('edu_courses').select('id,name,track,code'),
    ]).then(([{ data: rows }, { data: cs }]) => {
      const byId: Record<string, any> = {}; (cs ?? []).forEach((c: any) => { byId[c.id] = c })
      const DAY = 86400000
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const HIDDEN = ['draft', 'cancelled', 'merged', 'completed', 'paused']   // status KHÔNG hiện công khai
      const dmy = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
      const dayStart = (s: string) => new Date(s + 'T00:00:00').setHours(0, 0, 0, 0)

      // Nhóm hiển thị suy từ status + ngày thật; lớp cũ chưa có ngày → theo section (không phá)
      const bucketOf = (r: any): 'hidden' | 'upcoming' | 'active' | 'smallgroup' | 'oneonone' => {
        if (HIDDEN.includes(r.status)) return 'hidden'                    // tự ẩn nháp/huỷ/xong/gộp/dừng
        if (r.section === 'smallgroup') return 'smallgroup'
        if (r.section === 'oneonone') return 'oneonone'
        if (!r.start_date) return r.section === 'active' ? 'active' : 'upcoming'   // dữ liệu cũ
        const start = dayStart(r.start_date)
        const end = r.end_date ? dayStart(r.end_date) : null
        if (r.status === 'active' || r.status === 'ending_soon') return 'active'
        if (start > today.getTime()) return 'upcoming'
        if (end === null || end >= today.getTime()) return 'active'
        return 'hidden'                                                   // đã quá ngày kết thúc
      }

      const toItem = (r: any): SchedItem => {
        // Tiêu đề = khoá chính CÓ MÃ HÀNH TRÌNH (không phải NM). Không có khoá mã → dùng tên lớp.
        const linked = (r.course_ids ?? []).map((id: string) => byId[id]).filter(Boolean)
        const coded = linked.filter((c: any) => c.code && c.code !== 'NM')   // khoá có mã năng lực, bỏ NM
        let main = byId[r.main_course_id]
        if (!main || !main.code || main.code === 'NM') main = coded[0] ?? null
        const courseTitle = main?.name ?? r.name
        const tag = tenNangLuc(main?.code) ?? TRACK_VI[main?.track] ?? 'Guitar'   // hiển thị năng lực rõ: "Đệm hát 2"
        // Nhãn ngày động từ lịch thật (đếm ngược / kết thúc)
        let dateLabel: string | undefined
        if (r.start_date) {
          const start = dayStart(r.start_date)
          if (start > today.getTime()) {
            const days = Math.ceil((start - today.getTime()) / DAY)
            dateLabel = `Khai giảng ${dmy(r.start_date)}` + (days > 0 ? ` · còn ${days} ngày` : ' · hôm nay')
          } else {
            dateLabel = r.end_date ? `Đang học · kết thúc ${dmy(r.end_date)}` : 'Đang học'
          }
        }
        return { name: r.name, code: r.code ?? '', schedule: r.schedule ?? '', start: r.start_text ?? '', price: r.price ?? '', courseTitle, tag, dateLabel }
      }

      const all = (rows ?? []) as any[]
      const upcoming: SchedItem[] = [], active: SchedItem[] = [], smallGroup: { schedule: string }[] = []
      let oneOnOneCount = 0
      for (const r of all) {
        const b = bucketOf(r)
        if (b === 'hidden') continue
        if (b === 'smallgroup') { smallGroup.push({ schedule: r.schedule ?? '' }); continue }
        if (b === 'oneonone') { oneOnOneCount++; continue }
        ;(b === 'active' ? active : upcoming).push(toItem(r))
      }
      setSched({ upcoming, active, smallGroup, oneOnOneCount, activeCount: active.length + smallGroup.length + oneOnOneCount })
    })
  }, [])

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [msgs])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [])

  const openMira = () => { setMiraEver(true); setMiraOpen(true) }
  // 'chat' → mở bong bóng Mira ở góc (không đẩy chat ra giữa trang nữa). Còn lại: cuộn tới mục.
  const goto = (id: string) => {
    if (id === 'chat') { openMira(); return }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  // Chuyển tab 2 cách học + cuộn tới section (dùng cho nav/deep-link/nút 'Xem lớp & đăng ký')
  const gotoLich = (tab: 'practice' | 'class') => {
    setWaysTab(tab)
    setTimeout(() => document.getElementById('cach-hoc')?.scrollIntoView({ behavior: 'smooth' }), 60)
  }

  // Deep-link chia sẻ: ?xem=... (mở đúng nội dung) — vd ?xem=hanhtrinh, ?xem=lich, ?xem=app
  useEffect(() => {
    const xem = (new URLSearchParams(window.location.search).get('xem') || window.location.hash.replace('#', '') || '').toLowerCase()
    if (!xem) return
    const actions: Record<string, () => void> = {
      hanhtrinh: () => setShowJourney(true),
      lich: () => gotoLich('class'),
      lichlop: () => gotoLich('class'),
      app: () => setTimeout(() => goto('app'), 350),
      caidat: () => setShowGuide(true),
      demhat: () => setShowDemHat(true),
      tianot: () => setShowTiaNot(true),
      nangcao: () => setShowNangCao(true),
      quiz: () => setShowQuiz(true),
      dangky: () => setTimeout(() => goto('dangky'), 350),
      cuavao: () => setTimeout(() => goto('cuavao'), 350),
      baigiang: () => setBenefit('bai-giang'),
      sach: () => setBenefit('sach'),
      thay: () => setBenefit('thay'),
      congdong: () => setBenefit('cong-dong'),
      thuchanh: () => gotoLich('practice'),
      cachhoc: () => setTimeout(() => goto('cach-hoc'), 350),
    }
    actions[xem]?.()
  }, [])

  const pickClass = (name: string) => { set('className', name); goto('dangky') }

  // Lớp có thể đăng ký = lớp THẬT từ class_schedule (sắp khai giảng + đang học) + combo Hành trình.
  // name (giá trị ghi vào leads) KÈM MÃ LỚP — vì có thể 2 lớp trùng tên (vd TN3.GL12 và TN3.GL13).
  const regName = (it: { name: string; code?: string }) => it.code ? `${it.name} · ${it.code}` : it.name
  const regClasses = [
    ...(sched?.upcoming ?? []).map(it => ({ name: regName(it), path: inferPath(it.courseTitle || it.name), price: it.price || '990k', label: regName(it) })),
    ...(sched?.active ?? []).map(it => ({ name: regName(it), path: inferPath(it.courseTitle || it.name), price: it.price || '990k', label: `${regName(it)} · đang học` })),
    { ...COMBO_HT, label: COMBO_HT.name },
  ]

  const chatPush = (m: Msg) => setMsgs(prev => [...prev, m])
  // text thuần → HTML an toàn: escape, markdown link [text](url) + URL trần + đậm + xuống dòng
  const richReply = (s: string) => {
    const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const A = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noreferrer" style="color:#4338CA;font-weight:600">${text}</a>`
    return esc
      // 1 lượt: markdown link [text](url) HOẶC URL/zalo trần — không xử lý chồng nhau
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)*<]+|zalo\.me\/[^\s)*<]+)/g, (_m, mdText, mdUrl, bareUrl) => {
        if (mdUrl) return A(mdUrl, mdText)
        const url = (bareUrl as string).replace(/[.,;!?]+$/, '')
        return A(url.startsWith('http') ? url : 'https://' + url, url)
      })
      // markdown đậm **...** → <b>
      .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>')
  }
  const chatSendText = async (text: string) => {
    const t = text.trim(); if (!t || chatLoading) return
    chatPush({ who: 'me', html: richReply(t) }); setChatInput('')
    setChatLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('class-ai', { body: { sessionId: chatSessionRef.current, message: t, userName: me?.name } })
      if (error) throw error
      if (data?.sessionId) chatSessionRef.current = data.sessionId
      chatPush({ who: 'ai', html: richReply(data?.reply || 'Bạn nói rõ hơn giúp mình nhé.') })
    } catch {
      chatPush({ who: 'ai', html: `Xin lỗi, trợ lý đang bận một chút. Bạn nhắn Zalo thầy Văn Anh (<a href="${ZALO_LINK}" target="_blank" rel="noreferrer" style="color:#4338CA;font-weight:600">${ZALO}</a>) giúp mình nhé.` })
    } finally { setChatLoading(false) }
  }
  const chatSend = () => chatSendText(chatInput)

  const submitReg = async () => {
    const cls = regClasses.find(c => c.name === form.className) ?? { path: inferPath(form.className) }
    // HỌC SINH LỚP HÀNH TRÌNH (đã đăng nhập + tick miễn phí): gửi YÊU CẦU chờ thầy duyệt, KHÔNG qua thanh toán.
    if (me && form.isHanhtrinh) {
      let studentId: string | null = null, phone = form.phone.trim()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: s } = await supabase.from('edu_students').select('id,phone').eq('user_id', user.id).maybeSingle()
        studentId = (s as any)?.id ?? null; phone = phone || (s as any)?.phone || '—'
      }
      const { error } = await supabase.from('leads').insert({
        name: me.name, phone, zalo: form.zalo.trim() || null, email: form.email.trim() || null,
        class_name: form.className, path: cls?.path ?? null, intent: 'dang_ky',
        note: form.note.trim() || null, source: 'app', status: 'Chờ duyệt',
        is_hanhtrinh: true, student_id: studentId,
      })
      if (error) { setFormErr(true); console.error('Gửi yêu cầu lỗi:', error); return }
      setFormErr(false); setShowPending(true); setTimeout(() => goto('thanhtoan'), 60)
      return
    }
    // Đăng ký thường: cần tên + SĐT → leads → thanh toán
    if (!form.name.trim() || !form.phone.trim() || !form.className) { setFormErr(true); return }
    setFormErr(false)
    const { error } = await supabase.from('leads').insert({
      name: form.name.trim(), phone: form.phone.trim(), zalo: form.zalo.trim() || null,
      email: form.email.trim() || null, class_name: form.className, path: cls?.path ?? null,
      intent: 'dang_ky', note: form.note.trim() || null, source: 'landing', status: 'Mới đăng ký',
    })
    if (error) console.error('Ghi leads lỗi (vẫn cho sang thanh toán):', error)
    setShowPay(true)
    setTimeout(() => goto('thanhtoan'), 60)
  }

  return (
    <div className="tva-class">
      <style>{CSS}</style>

      <nav>
        <div className="wrap nav-in">
          <div className="brand"><img className="mark" src="/logo-green.svg" alt="Thầy Văn Anh Guitar" /> Thầy Văn Anh Guitar</div>
          <div className="nav-links">
            <a onClick={() => goto('cuavao')}>Cửa vào</a>
            <a onClick={() => goto('chat')}>Tư vấn</a>
            <a onClick={() => goto('quyenloi')}>Quyền lợi</a>
            <a onClick={() => gotoLich('class')}>Lịch lớp</a>
            {/* Bỏ mục chữ "Đăng ký" — trùng đích với nút "Đăng ký lớp" bên phải, mà hàng
                nav cần chỗ cho nút Shop. */}
            {!me && <a onClick={() => setShowLogin(true)}>Đăng nhập</a>}
          </div>
          <div className="nav-right">
            {/* Nút Shop — mang màu cam của shop.vananhaudio.com để khách nhận ra
                đang sang cửa hàng. Hiện ở MỌI cỡ màn (menu chữ bị ẩn dưới 860px). */}
            <a className="shop-cta" href={SHOP_URL} aria-label="Shop nhạc cụ Văn Anh Audio">
              <svg className="shop-cta-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="shop-cta-full">Shop</span>
            </a>
            {/* CTA 1001 Câu chuyện — pill nổi hơn menu, nhẹ hơn nút chính; mobile rút gọn "📖 1001" */}
            <button className="story-cta" onClick={() => { window.location.href = '/story' }} aria-label="1001 Câu chuyện cùng Guitar">
              📖 <span className="story-cta-full">1001 Câu chuyện</span><span className="story-cta-short">1001</span>
            </button>
            {me
              ? <button className="btn btn-primary nav-cta" onClick={() => { window.location.href = '/me' }}>🎸 Hành trình của tôi</button>
              : <button className="btn btn-primary nav-cta" onClick={() => goto('dangky')}>Đăng ký lớp</button>}
          </div>
        </div>
      </nav>

      {/* HERO — trang tổng Hành trình Guitar: text trái + card giá phải (không ảnh Thầy) */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>Một Hành trình giúp bạn <span className="hl">chơi Guitar tốt hơn mỗi ngày.</span></h1>
            <p>Học, luyện tập và tiến bộ cùng Thầy Văn Anh.</p>
            <a className="hero-scroll" onClick={() => goto('cuavao')}>Khám phá bên dưới ↓</a>
          </div>
          <div className="hero-card">
            <div className="hc-kicker">Tham gia Hành trình</div>
            <div className="hc-price">499.000đ <span>/ tháng</span></div>
            <div className="hc-price-sub">Đăng ký dài hạn: 396.000đ/tháng</div>
            <p className="hc-body">Học theo năng lực hiện tại, luyện tập trên App và tham gia các buổi thực hành cùng Thầy.</p>
            <ul className="hc-items">
              {['Kho bài giảng', 'App luyện tập', 'Thực hành hàng tuần', 'Hỏi Thầy', 'Sách', 'Cộng đồng'].map(x => <li key={x}>{x}</li>)}
            </ul>
            <div className="hc-note">Học gói <b>Free</b> trước. Thấy phù hợp rồi hãy tham gia.</div>
          </div>
        </div>
      </header>

      {/* 3 CỬA VÀO */}
      <section id="cuavao" className="band">
        <div className="wrap">
          <div className="eyebrow">Có giống bạn không?</div>
          <h2>Bạn đang muốn điều gì với Guitar?</h2>
          <p className="lead">Nếu bạn mới bắt đầu, hãy chọn một trong hai hướng: <b>Đệm hát</b> hoặc <b>Guitar căn bản theo giai điệu</b>. Nếu bạn đã học rồi, trợ lý sẽ giúp bạn xếp đúng trình độ để đi tiếp.</p>
          <div className="doors">
            {DOORS.map((d, i) => {
              const art = articles[d.slot]
              return (
                <div className="door" key={i}>
                  <div className="dq">{d.dq}</div>
                  <span className="dbadge">{d.badge}</span>
                  <p>{d.desc}</p>
                  {d.native === 'demhat'
                    ? <button className="btn btn-primary" onClick={() => setShowDemHat(true)}>{d.cta} →</button>
                    : d.native === 'tianot'
                    ? <button className="btn btn-primary" onClick={() => setShowTiaNot(true)}>{d.cta} →</button>
                    : d.native === 'nangcao'
                    ? <button className="btn btn-primary" onClick={() => setShowNangCao(true)}>{d.cta} →</button>
                    : art
                    ? <button className="btn btn-primary" onClick={() => setModal('art:' + d.slot)}>{d.cta} →</button>
                    : <button className="btn btn-primary" onClick={() => goto(d.fallback)}>{d.cta} →</button>}
                </div>
              )
            })}
          </div>
          <div className="map-hint">
            Sau khóa đầu tiên, bạn có thể đi tiếp theo bản đồ hành trình dài hạn khi sẵn sàng.
            <button className="btn btn-ghost" onClick={() => setShowJourney(true)}>Xem bản đồ hành trình đầy đủ</button>
          </div>
        </div>
      </section>

      {/* SHOWCASE HÀNH ĐỘNG — ĐÃ BỎ KHỎI LANDING (vòng 'trang tổng'): quiz/app-free/video/cam-kết
          vẫn GIỮ capability phía dưới (deep-link ?xem=quiz… vẫn hoạt động). */}

      {/* CHAT */}
      <section className="chat-sec" id="chat">
        <div className="wrap chat-grid">
          <div>
            <div className="eyebrow">Trợ lý Mira</div>
            <h2>Còn câu hỏi riêng? Hỏi Mira nhé</h2>
            <p className="lead">Mira giúp bạn tìm đúng cửa vào phù hợp và trả lời mọi thắc mắc riêng của bạn — trước khi quyết định đăng ký.</p>
          </div>
          {/* CTA mở Mira ở GÓC (không nhúng giữa trang). Chat thật là bong bóng nổi. */}
          <div className="mira-cta">
            <div className="mc-av">M<span className="mc-dot" /></div>
            <h4>Trò chuyện riêng với Mira</h4>
            <p>Mira mở ở góc màn hình và trả lời ngay — cứ hỏi gì bạn còn băn khoăn.</p>
            <button className="btn btn-primary" onClick={openMira}>💬 Mở khung chat với Mira</button>
          </div>
        </div>
      </section>

      {/* QUYỀN LỢI — 6 thành phần của Hành trình (thay 'Một khóa học gồm những gì?') */}
      <section id="quyenloi" className="band">
        <div className="wrap">
          <div className="eyebrow">Khi tham gia Hành trình</div>
          <h2>Đây là những gì bạn có khi tham gia.</h2>
          <p className="lead" style={{ maxWidth: 640 }}>Không chỉ là những bài học. Bạn có những công cụ, tài liệu, các buổi thực hành và sự đồng hành cần thiết để tiếp tục chơi Guitar tốt hơn.</p>
          <div className="pl-grid">
            {[
              { ic: '🎬', name: 'Kho bài giảng', desc: 'Hàng trăm bài học để bạn học Guitar từ những bước đầu tiên và tiếp tục khám phá ngày càng sâu hơn.', cta: 'Xem bên trong →', act: () => setBenefit('bai-giang') },
              { ic: '📱', name: 'App luyện tập', desc: 'Bài tập và những công cụ Guitar được thiết kế để bạn luyện tập mỗi ngày.', cta: 'Xem App →', act: () => goto('app') },
              { ic: '📖', name: 'Sách giáo trình', desc: 'Những cuốn sách được biên soạn để đồng hành cùng quá trình học của bạn.', cta: 'Xem sách →', act: () => setBenefit('sach') },
              { ic: '🧭', name: 'Hỏi đáp cùng Thầy qua Zalo', desc: 'Gặp chỗ vướng trong lúc học — bạn hỏi Thầy qua Zalo và nhận hướng dẫn để tiếp tục.', cta: 'Xem cách hỏi Thầy →', act: () => setBenefit('thay') },
              { ic: '🎥', name: 'Buổi thực hành cùng Thầy', desc: 'Tham gia những buổi thực hành online để cùng Thầy luyện tập và đưa những gì đã học vào chơi Guitar thực tế.', cta: 'Xem một buổi thực hành', act: () => setShowPractice(true) },
              { ic: '👥', name: 'Cộng đồng học viên', desc: 'Những người cùng yêu Guitar, cùng học, chia sẻ và chơi đàn với nhau.', cta: 'Xem cộng đồng →', act: () => setBenefit('cong-dong') },
            ].map((c: any) => (
              <div className="pl-card" key={c.name}>
                <span className="pl-ic" aria-hidden>{c.ic}</span>
                <h3>{c.name}</h3>
                <p>{c.desc}</p>
                {c.cta && <button className="pl-cta" onClick={c.act}>{c.cta}</button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MỘT TUẦN HỌC — cách dùng 6 quyền lợi trong một tuần bình thường (trước 2 cách học) */}
      <ClassWeekJourney />

      {/* 2 CÁCH HỌC — 2 TAB: Gói Thực hành (CAM) / Gói Học theo lớp (TÍM); lịch + giá nằm trong từng tab */}
      <ClassLearningWays
        tab={waysTab}
        onTabChange={setWaysTab}
        sched={sched}
        onRegister={pickClass}
        onShowActive={() => setShowActive(true)}
        onChat={() => goto('chat')}
      />

      {/* ĐĂNG KÝ */}
      <section id="dangky" className="band">
        <div className="wrap">
          <div className="eyebrow">Đăng ký</div>
          <h2>Xác nhận đăng ký lớp</h2>
          <p className="lead">Điền vài thông tin, thầy sẽ giữ chỗ và kích hoạt tài khoản app cho bạn.</p>
          <div className="panel">
            <div className="frm">
              <div><label>Họ và tên</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nguyễn Văn A" /></div>
              <div><label>Số điện thoại</label><input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" inputMode="tel" placeholder="09xx xxx xxx" /></div>
              <div><label>Zalo / Facebook đang dùng</label><input value={form.zalo} onChange={e => set('zalo', e.target.value)} placeholder="Số Zalo hoặc link FB" /></div>
              <div><label>Email (tạo tài khoản app)</label><input value={form.email} onChange={e => set('email', e.target.value)} type="email" placeholder="email@..." /></div>
              <div className="full"><label>Lớp muốn đăng ký</label>
                <select value={form.className} onChange={e => set('className', e.target.value)}>
                  <option value="">— Chọn lớp —</option>
                  {regClasses.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
                </select>
              </div>
              <div className="full"><label>Ghi chú thêm (không bắt buộc)</label><textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} placeholder="Khung giờ rảnh, câu muốn hỏi thầy..." /></div>
              {/* Học phí + tick miễn phí cho học sinh lớp Hành trình (chỉ khi đã đăng nhập) */}
              <div className="full" style={{ background: '#F4F4F5', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 15 }}>Học phí khoá này: <b style={{ color: '#EA580C' }}>{(regClasses.find(c => c.name === form.className)?.price === 'Combo') ? 'Combo trọn gói' : '990.000đ'}</b></div>
                {me && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, cursor: 'pointer', fontSize: 14.5 }}>
                    <input type="checkbox" checked={form.isHanhtrinh} onChange={e => setForm(f => ({ ...f, isHanhtrinh: e.target.checked }))} style={{ marginTop: 3, width: 18, height: 18 }} />
                    <span>Tôi là <b>học sinh lớp Hành trình</b> — được <b>miễn phí</b> khoá này (gửi yêu cầu để thầy duyệt mở khoá).</span>
                  </label>
                )}
              </div>
              {formErr && <div className="full err">{me && form.isHanhtrinh ? 'Gửi yêu cầu thất bại, thử lại giúp thầy nhé.' : 'Bạn vui lòng nhập Họ tên, Số điện thoại và chọn lớp nhé.'}</div>}
              <div className="full"><button className="btn btn-primary" style={{ width: '100%' }} onClick={submitReg}>{me && form.isHanhtrinh ? 'Gửi yêu cầu miễn phí (chờ duyệt) →' : 'Xác nhận đăng ký lớp →'}</button></div>
            </div>
          </div>
        </div>
      </section>

      {/* CHỜ DUYỆT — học sinh lớp Hành trình gửi yêu cầu miễn phí */}
      {showPending && (
        <section id="thanhtoan">
          <div className="wrap">
            <div className="eyebrow">Đã gửi yêu cầu</div>
            <h2>Yêu cầu mở khoá đã gửi tới thầy 🎸</h2>
            <p className="lead">Bạn đã đăng ký <b>{form.className}</b> theo diện <b>lớp Hành trình (miễn phí)</b>. Thầy sẽ duyệt và mở khoá cho bạn — không cần thanh toán. Khoá sẽ hiện trong app ngay sau khi thầy duyệt.</p>
            <div className="panel">
              <div className="ok-box">
                <h4>✓ Cảm ơn bạn!</h4>
                <p>Trong lúc chờ, bạn cứ học các khoá đã mở. Có thắc mắc thì nhắn Zalo thầy nhé.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <a className="zalo-btn" href={ZALO_LINK} target="_blank" rel="noreferrer">💬 Nhắn Zalo thầy →</a>
                  <button className="ok-guide" onClick={() => { window.location.href = '/me' }}>🎸 Về Hành trình của tôi →</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* THANH TOÁN (ẩn đến khi xác nhận) */}
      {!showPending && showPay && (
        <section id="thanhtoan">
          <div className="wrap">
            <div className="eyebrow">Bước hoàn tất</div>
            <h2>Hoàn tất học phí để giữ chỗ</h2>
            <p className="lead">Sau khi thanh toán, tài khoản app TVA Guitar sẽ được kích hoạt và bạn được thêm vào nhóm lớp.</p>
            <div className="panel">
              <div className="pay-grid">
                <img className="qr-img" src="/qr-thanhtoan.png" alt="QR chuyển khoản TPBank – CTY TNHH Văn Anh Audio" />
                <div className="pay-info">
                  <div><span>Ngân hàng</span><span>TPBank</span></div>
                  <div><span>Số tài khoản</span><span>06496099801</span></div>
                  <div><span>Chủ tài khoản</span><span>Công ty TNHH Văn Anh Audio</span></div>
                  <div><span>Số tiền</span><span className="price">990.000đ</span></div>
                  <div><span>Nội dung CK</span><span>{form.name.trim() || 'Họ tên của bạn'}</span></div>
                </div>
              </div>
              <div className="pay-note">💡 Nội dung chuyển khoản chỉ cần ghi <b>họ tên của bạn</b>. Chuyển xong, bấm nút bên dưới gửi <b>ảnh bill qua Zalo thầy</b> để được kích hoạt tài khoản &amp; thêm vào nhóm lớp nhanh nhất.</div>
              <a className="zalo-btn" href={ZALO_LINK} target="_blank" rel="noreferrer">💬 Gửi bill qua Zalo thầy Văn Anh →</a>
              {!okBox
                ? <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setOkBox(true)}>Tôi đã chuyển khoản</button>
                : <div className="ok-box">
                    <h4>✓ Cảm ơn bạn đã đăng ký!</h4>
                    <p>Đừng quên <b>gửi ảnh bill qua Zalo thầy</b> để được kích hoạt tài khoản app &amp; thêm vào nhóm lớp nhanh nhất.</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <a className="zalo-btn" href={ZALO_LINK} target="_blank" rel="noreferrer">💬 Nhắn Zalo thầy →</a>
                      <button className="ok-guide" onClick={() => setShowGuide(true)}>📲 Xem hướng dẫn cài app →</button>
                    </div>
                  </div>}
            </div>
          </div>
        </section>
      )}
      {sent && null}

      {/* SAU KHI THANH TOÁN */}
      <section className="band">
        <div className="wrap">
          <div className="eyebrow">Sau khi thanh toán</div>
          <h2>Bạn đã chính thức bước vào hành trình</h2>
          <div className="steps">
            {[['1', 'Giữ chỗ lớp', 'Chọn lớp & xác nhận thông tin.'], ['2', 'Hoàn tất học phí', 'Hệ thống kích hoạt tài khoản.'], ['3', 'Tải app TVA Guitar', 'Mở bài định hướng đầu tiên.'], ['4', 'Vào nhóm lớp', 'Chuẩn bị buổi học đầu cùng thầy.']].map(([n, h, p]) => (
              <div className="step" key={n}><div className="num">{n}</div><h4>{h}</h4><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* APP */}
      <section>
        <div className="wrap">
          <div className="app-sec" id="app">
            <div className="app-grid">
              <div>
                <div className="eyebrow" style={{ color: '#A89FF0' }}>App TVA Guitar</div>
                <h2>Học, tập và theo dõi tiến độ — suốt hành trình</h2>
                <p className="lead">Không chỉ là nơi xem video. Đây là cổng học tập cá nhân đi cùng bạn từ buổi đầu.</p>
                <div className="app-feats">
                  {[['📚', 'Bài học chia nhỏ, có bài tập sau mỗi nội dung'], ['🎚️', 'Công cụ luyện tập: nhịp, tỉa nốt, chỉnh dây, karaoke'], ['📈', 'Nhật ký học tập & theo dõi tiến bộ của riêng bạn']].map(([ic, t], i) => (
                    <div className="app-feat" key={i}><span className="ic">{ic}</span><div>{t}</div></div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <button className="app-guide-btn" onClick={() => setShowGuide(true)}>📲 Hướng dẫn cài đặt app →</button>
                  <button className="app-guide-btn" onClick={() => setShowSignup(true)} style={{ background: '#4F46E5', color: '#fff', borderColor: '#4F46E5' }}>🎁 Tạo tài khoản miễn phí — học thử</button>
                </div>
              </div>
              <div className="app-shots">
                <img className="shot" src="/app-khoahoc.png" alt="Màn hình Khoá học" />
                <img className="shot" src="/app-luyentap.png" alt="Màn hình Công cụ luyện tập" />
                <img className="shot" src="/app-tiendo.png" alt="Màn hình Tiến độ học tập" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THẦY */}
      <section className="band-top">
        <div className="wrap teacher">
          <img className="t-photo" src="/thay-van-anh.png" alt="Thầy Văn Anh" />
          <div>
            <div className="eyebrow">Người dẫn đường</div>
            <h2>Học cùng Thầy Văn Anh</h2>
            <p className="lead">Nhiều năm giảng dạy guitar, xây dựng hệ thống bài học cho người mới và cộng đồng học viên online. Phương pháp: dễ hiểu, dễ làm theo, chia nhỏ, luyện đều, theo dõi tiến độ, sửa lỗi từng bước.</p>
            <div className="quote">"Tôi không dạy bạn trở nên cao siêu. Tôi giúp bạn làm chủ cây đàn một cách đơn giản nhất."</div>
            <p className="lead" style={{ marginTop: 14 }}>Hệ thống bài học được chia nhỏ để người mới dễ theo, dễ luyện và biết mình đang tiến bộ ở đâu.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="band" id="faq">
        <div className="wrap">
          <div className="eyebrow">Hỏi đáp</div>
          <h2>Câu hỏi thường gặp</h2>
          <p className="lead">Những thắc mắc phổ biến nhất khi bắt đầu học guitar cùng Thầy Văn Anh. Còn câu hỏi riêng? <a onClick={() => goto('chat')} style={{ color: '#4338CA', cursor: 'pointer', fontWeight: 600 }}>Hỏi trợ lý →</a></p>
          <div className="faq-list">
            {(faqAll ? FAQS : FAQS.slice(0, 7)).map((f, i) => (
              <details key={i}>
                <summary>{f.q}</summary>
                <div className="faq-a">
                  {f.a.map((b, j) => Array.isArray(b)
                    ? <ul key={j}>{b.map((li, k) => <li key={k}>{li}</li>)}</ul>
                    : <p key={j}>{b}</p>)}
                </div>
              </details>
            ))}
          </div>
          {!faqAll && FAQS.length > 7 && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setFaqAll(true)}>Xem tất cả {FAQS.length} câu hỏi →</button>
            </div>
          )}
          {faqAll && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => { setFaqAll(false); goto('faq') }}>Thu gọn ↑</button>
            </div>
          )}
        </div>
      </section>

      {/* CTA cuối */}
      <section>
        <div className="wrap">
          <div className="final">
            <h2>Bắt đầu hành trình guitar của bạn hôm nay</h2>
            <p>Chọn lớp phù hợp và giữ chỗ ngay — thầy sẽ đồng hành cùng bạn từ buổi đầu tiên.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => gotoLich('class')}>Xem lớp &amp; đăng ký</button>
              <button className="btn" onClick={() => setShowJourney(true)} style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: '1.5px solid rgba(255,255,255,.6)', backdropFilter: 'blur(4px)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/></svg>
                Tìm hiểu Bản đồ hành trình
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-in">
          <div><b>VAN ANH AUDIO</b> · TVA Guitar · vananhaudio.com</div>
          <div>Đăng ký qua Zalo thầy: <a className="foot-zalo" href={ZALO_LINK} target="_blank" rel="noreferrer">{ZALO}</a></div>
        </div>
      </footer>

      {/* Ẩn nút khi khung chat đang mở — để khung ngồi đúng góc, không bị "kê" lên nút. */}
      {!miraOpen && <button className="fab" onClick={() => goto('chat')}>💬 Hỏi Mira</button>}

      {/* HÀNH TRÌNH 2027 — bài viết thiết kế native, full màn hình */}
      {showSignup && (
        <div onClick={() => setShowSignup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.3)', fontFamily: 'system-ui, sans-serif' }}>
            {!suDone ? (
              <>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Tạo tài khoản miễn phí</div>
                <div style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.55, marginBottom: 16 }}>
                  Học thử miễn phí trên app: khoá <b>Nhập Môn</b> và <b>Nhạc lý cơ bản</b>. Đăng ký học với thầy để mở các khoá còn lại.
                </div>
                {[['Họ tên', suName, setSuName, 'text', 'Nguyễn Văn A'], ['Email', suEmail, setSuEmail, 'email', 'email@example.com'], ['Mật khẩu (≥ 6 ký tự)', suPass, setSuPass, 'password', '••••••']].map(([lbl, val, set, type, ph]: any) => (
                  <div key={lbl} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, color: '#6B7280', marginBottom: 5, fontWeight: 500 }}>{lbl}</label>
                    <input value={val} onChange={e => set(e.target.value)} type={type} placeholder={ph}
                      onKeyDown={e => { if (e.key === 'Enter') submitSignup() }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, color: '#111827', outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                ))}
                {suErr && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, marginBottom: 12 }}>
                    {suErr}
                    {suSuggest && (
                      <button onClick={() => { setSuEmail(suSuggest); setSuErr(''); setSuSuggest('') }}
                        style={{ display: 'block', marginTop: 7, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Sửa thành {suSuggest}
                      </button>
                    )}
                  </div>
                )}
                <button onClick={submitSignup} disabled={suLoading} style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: suLoading ? .65 : 1 }}>
                  {suLoading ? 'Đang tạo...' : 'Tạo tài khoản & học thử →'}
                </button>
                <button onClick={() => setShowSignup(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, marginTop: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Để sau</button>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 42 }}>🎉</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#111827', margin: '6px 0' }}>Tạo tài khoản thành công!</div>
                <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 18 }}>
                  Bạn đã có thể đăng nhập trên app để học thử khoá Nhập Môn và Nhạc lý cơ bản.
                </div>
                <a href="https://timming.vananhaudio.com/start" target="_blank" rel="noreferrer"
                  style={{ display: 'block', background: '#4F46E5', color: '#fff', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>Mở app & đăng nhập →</a>
                <button onClick={() => { setShowSignup(false); setSuDone(false); setSuName(''); setSuEmail(''); setSuPass('') }} style={{ width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, marginTop: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Đóng</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showLogin && (
        <div onClick={() => setShowLogin(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.3)', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Đăng nhập học viên</div>
            <div style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.55, marginBottom: 16 }}>Đăng nhập để vào <b>Hành trình của bạn</b> — và để Mira nhớ tên bạn cho những lần trò chuyện sau.</div>
            {[['Email', liEmail, setLiEmail, 'email', 'email@example.com'], ['Mật khẩu', liPass, setLiPass, 'password', '••••••']].map(([lbl, val, set, type, ph]: any) => (
              <div key={lbl} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#6B7280', marginBottom: 5, fontWeight: 500 }}>{lbl}</label>
                <input value={val} onChange={e => set(e.target.value)} type={type} placeholder={ph}
                  onKeyDown={e => { if (e.key === 'Enter') submitLogin() }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, color: '#111827', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            ))}
            {liErr && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, marginBottom: 12 }}>{liErr}</div>}
            <button onClick={submitLogin} disabled={liLoading} style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: liLoading ? .65 : 1 }}>
              {liLoading ? 'Đang đăng nhập...' : 'Đăng nhập →'}
            </button>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 12 }}>Chưa có tài khoản? <a onClick={() => { setShowLogin(false); setShowSignup(true) }} style={{ color: '#4F46E5', fontWeight: 600, cursor: 'pointer' }}>Tạo tài khoản miễn phí</a></div>
            <button onClick={() => setShowLogin(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, marginTop: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Để sau</button>
          </div>
        </div>
      )}

      {showJourney && (
        <ClassJourney2027
          onClose={() => setShowJourney(false)}
          onRegister={() => { setShowJourney(false); setTimeout(() => gotoLich('class'), 60) }}
        />
      )}

      {showDemHat && (
        <ClassDemHat
          onClose={() => setShowDemHat(false)}
          onRegister={() => { setShowDemHat(false); setTimeout(() => gotoLich('class'), 60) }}
          onChat={() => { setShowDemHat(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showTiaNot && (
        <ClassTiaNot
          onClose={() => setShowTiaNot(false)}
          onRegister={() => { setShowTiaNot(false); setTimeout(() => gotoLich('class'), 60) }}
          onChat={() => { setShowTiaNot(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showQuiz && (
        <ClassQuiz
          onClose={() => setShowQuiz(false)}
          onRegister={() => { setShowQuiz(false); setTimeout(() => gotoLich('class'), 60) }}
          onChat={() => { setShowQuiz(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showGuide && (
        <ClassAppGuide
          onClose={() => setShowGuide(false)}
          onRegister={() => { setShowGuide(false); setTimeout(() => gotoLich('class'), 60) }}
        />
      )}

      {showNangCao && (
        <ClassNangCao
          onClose={() => setShowNangCao(false)}
          onChat={() => { setShowNangCao(false); setTimeout(() => goto('chat'), 60) }}
          onJourney={() => { setShowNangCao(false); setShowJourney(true) }}
          onQuiz={() => { setShowNangCao(false); setShowQuiz(true) }}
        />
      )}

      {/* CHIỀU SÂU 6 QUYỀN LỢI — reuse nội dung /azz (class-benefits.ts) */}
      {benefit && (
        <ClassBenefitDetail benefit={benefit} onClose={() => setBenefit(null)} />
      )}

      {showPractice && (
        <div className="demo-page">
          <div className="demo-top">
            <button className="demo-back" onClick={() => setShowPractice(false)}>← Quay lại</button>
            <button className="demo-cta" onClick={() => { setShowPractice(false); setTimeout(() => gotoLich('class'), 60) }}>Xem lớp &amp; đăng ký →</button>
          </div>
          <div className="demo-scroll">
            <div className="demo-inner">
              <div className="demo-eyebrow">Thực hành cùng Thầy</div>
              <h2 className="demo-h2">Một buổi thực hành cùng Thầy</h2>
              <p className="demo-lead">Xem một buổi thực hành online thật — cùng học, cùng luyện và chơi Guitar với Thầy cùng những người học khác.</p>
              <div className="demo-video">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/i28oaOErUEQ?rel=0&modestbranding=1"
                  title="Buổi thực hành online cùng Thầy Văn Anh"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="demo-points">
                {[['🎸', 'Thầy hướng dẫn — nghe giải thích, xem mẫu và được chỉ ra những điểm cần chú ý'], ['🎼', 'Cùng luyện tập — cầm đàn lên và thực hành ngay những gì đang học'], ['🎶', 'Cùng chơi Guitar — nghe mọi người chơi và cảm nhận âm nhạc trong một buổi thật']].map(([ic, t], i) => (
                  <div className="demo-point" key={i}><span>{ic}</span>{t}</div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => { setShowPractice(false); setTimeout(() => gotoLich('class'), 60) }}>Xem lớp &amp; đăng ký →</button>
            </div>
          </div>
        </div>
      )}

      {/* BÀI VIẾT — mở full màn hình (dài, có ảnh) */}
      {modal?.startsWith('art:') && (() => {
        const a = articles[modal.slice(4)]
        return (
          <div className="art-page">
            <div className="art-top">
              <button className="art-close" onClick={() => setModal(null)}>← Quay lại</button>
              <button className="btn btn-primary art-top-cta" onClick={() => { setModal(null); setTimeout(() => gotoLich('class'), 60) }}>Xem lớp &amp; đăng ký →</button>
            </div>
            <div className="art-scroll">
              <div className="art-inner">
                {a ? <>
                  <h1 className="art-h1">{a.title}</h1>
                  <div className="art-body" dangerouslySetInnerHTML={{ __html: a.body }} />
                  <button className="btn btn-primary" style={{ marginTop: 28 }} onClick={() => { setModal(null); setTimeout(() => gotoLich('class'), 60) }}>Xem lớp &amp; đăng ký →</button>
                </> : <div>Bài viết không còn.</div>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* XEM THÊM CÁC LỚP ĐANG HỌC (bằng chứng xã hội) */}
      {showActive && sched && (
        <div className="modal open" onClick={e => { if (e.target === e.currentTarget) setShowActive(false) }}>
          <div className="modal-box">
            <button className="x" onClick={() => setShowActive(false)}>×</button>
            <h3>Các lớp đang hoạt động</h3>
            <p className="lead" style={{ marginTop: 6 }}>Hệ thống đang có <b>nhiều lớp diễn ra song song</b> — bạn không học một mình. Tất cả đều online trực tiếp qua Zoom.</p>
            <div className="active-list">
              {sched.active.map((c, i) => (
                <div className="active-row" key={'a' + i}>
                  <div className="active-name">{c.name}</div>
                  <div className="active-sch">{c.schedule || 'Đang cập nhật'}</div>
                </div>
              ))}
              {sched.smallGroup.map((c, i) => (
                <div className="active-row" key={'g' + i}>
                  <div className="active-name">Lớp nhóm nhỏ</div>
                  <div className="active-sch">{c.schedule || 'Lịch linh động'}</div>
                </div>
              ))}
              {sched.oneOnOneCount > 0 && (
                <div className="active-row active-1v1">
                  <div className="active-name">🎯 {sched.oneOnOneCount} học viên đang học 1 kèm 1</div>
                  <div className="active-sch">Lịch linh động</div>
                </div>
              )}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={() => { setShowActive(false); setTimeout(() => gotoLich('class'), 60) }}>Xem lớp sắp khai giảng &amp; đăng ký →</button>
          </div>
        </div>
      )}

      {/* POPUP NGẮN dùng chung (mô hình học / cam kết / bản đồ rút gọn) */}
      {modal && !modal.startsWith('art:') && (
        <div className="modal open" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="modal-box">
            <button className="x" onClick={() => setModal(null)}>×</button>
            <div dangerouslySetInnerHTML={{ __html: MODALS[modal] ?? '' }} />
          </div>
        </div>
      )}

      {/* MIRA — bong bóng chat nổi ở GÓC PHẢI. Iframe app Mira (nguồn 'class');
          trang gửi token đăng nhập sang để Mira biết tên & hồ sơ học viên.
          Giữ iframe sau lần mở đầu (miraEver) để không tải lại giữa cuộc. */}
      {miraEver && (
        <div className="mira-panel" style={{ display: miraOpen ? 'flex' : 'none' }}>
          <div className="mira-panel-head">
            <span className="mp-av">M</span>
            <div className="mp-title"><b>Mira</b><span>Trợ lý TVA Guitar · trả lời ngay</span></div>
            <button className="mp-close" onClick={() => setMiraOpen(false)} aria-label="Đóng">×</button>
          </div>
          <iframe
            ref={miraRef}
            src="https://mira-vananhaudio.netlify.app/shop?channel=class"
            title="Mira · Trợ lý TVA Guitar"
            className="mira-frame"
          />
        </div>
      )}
    </div>
  )
}

const CSS = `
.tva-class{--bg:#F2EEE7;--surface:#FFFFFF;--ink:#211C32;--ink-soft:#5A5470;--ink-faint:#8A8499;--indigo:#4338CA;--indigo-dark:#352BA3;--indigo-tint:#EEEBFB;--honey:#C9711E;--honey-tint:#FBF1E4;--line:#E4DED4;--online:#16A34A;--orange:#EE7D3C;--mem:#EA580C;--mem-soft:#FDF0E7;--mem-line:#F5CFB6;font-family:'Be Vietnam Pro',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55;font-size:16px;min-height:100vh;text-align:left;color-scheme:light;}
.tva-class *{box-sizing:border-box;}
.tva-class .wrap{max-width:1080px;margin:0 auto;padding:0 20px;}
.tva-class section{padding:58px 0;}
.tva-class .band{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.tva-class .band-top{background:#fff;border-top:1px solid var(--line);}
.tva-class h1,.tva-class h2,.tva-class h3,.tva-class h4,.tva-class h5{color:var(--ink);}
.tva-class h2{font-size:30px;font-weight:800;line-height:1.15;letter-spacing:-.5px;}
.tva-class .eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey);margin-bottom:10px;}
.tva-class .lead{color:var(--ink-soft);font-size:16.5px;max-width:640px;margin-top:12px;}
.tva-class .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:15px;border-radius:12px;padding:13px 22px;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s;}
.tva-class .btn-primary{background:var(--indigo);color:#fff;}
.tva-class .btn-primary:hover{background:var(--indigo-dark);}
.tva-class .btn-ghost{background:transparent;color:var(--indigo);border:1.5px solid #D3CEE8;}
.tva-class .btn-ghost:hover{background:var(--indigo-tint);}
.tva-class .ph{border:2px dashed #CFC9DA;border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--ink-faint);font-size:12.5px;font-weight:600;padding:14px;background:#FBFAF7;}
.tva-class nav{position:sticky;top:0;z-index:40;background:rgba(242,238,231,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding-top:env(safe-area-inset-top,0px);/* chừa tai thỏ iPhone */}
.tva-class .nav-in{display:flex;align-items:center;justify-content:space-between;height:62px;}
.tva-class .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:16px;white-space:nowrap;}
.tva-class .brand .mark{width:36px;height:36px;border-radius:9px;object-fit:contain;display:block;}
/* gap 22 → 16: hàng nav có thêm nút Shop, cần chỗ cho 3 nút bên phải */
.tva-class .nav-links{display:flex;gap:16px;font-size:14px;font-weight:500;}
.tva-class .nav-links a{color:var(--ink-soft);text-decoration:none;cursor:pointer;white-space:nowrap;}
.tva-class .nav-links a:hover{color:var(--indigo);}
.tva-class .nav-cta{font-size:14px;padding:9px 16px;}
.tva-class .nav-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.tva-class .story-cta{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1.5px solid var(--indigo);background:var(--surface);color:var(--indigo);font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;line-height:1;}
.tva-class .story-cta:hover{background:var(--indigo-tint);}
.tva-class .story-cta-short{display:none;}
/* Máy nhỏ: giấu CHỮ thương hiệu (giữ logo) để đủ chỗ cho nút Shop — trước đây chữ
   này cũng đã bị xuống 2 dòng, giấu đi lại gọn hơn. */
@media(max-width:520px){.tva-class .brand{font-size:0;gap:0;}}
/* NÚT SHOP — mượn đúng cam của shop.vananhaudio.com (#FF9F1C → #F59E0B, nhấn #E87900)
   để khách thấy ngay đây là cửa sang cửa hàng, không lẫn với màu chàm của lớp học. */
.tva-class .shop-cta{display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:999px;border:none;background:linear-gradient(135deg,#FF9F1C,#F59E0B);color:#fff;font-size:13.5px;font-weight:700;text-decoration:none;white-space:nowrap;line-height:1;box-shadow:0 6px 16px -7px rgba(232,121,0,.9);transition:transform .16s ease,box-shadow .16s ease,background .16s ease;}
.tva-class .shop-cta:hover{background:linear-gradient(135deg,#FFB347,#E87900);transform:translateY(-1px);box-shadow:0 10px 22px -8px rgba(232,121,0,.95);}
.tva-class .shop-cta:active{transform:translateY(0);box-shadow:0 4px 12px -7px rgba(232,121,0,.9);}
.tva-class .shop-cta-ico{width:15px;height:15px;flex-shrink:0;}
/* Ngưỡng ẩn menu chữ nâng 860 → 1120px: hàng nav có thêm nút Shop nên hẹp hơn mức
   này là không đủ chỗ cho cả menu chữ lẫn 3 nút (đo thật: cần ~1045px). */
@media(max-width:1120px){.tva-class .nav-links{display:none;}
/* Máy rất hẹp (≤360px): nút Shop rút còn mỗi biểu tượng, không thì header tràn */
@media(max-width:360px){.tva-class .shop-cta-full{display:none;}.tva-class .shop-cta{padding:8px 10px;}}
.tva-class .nav-right{gap:8px;}
.tva-class .story-cta{padding:7px 11px;font-size:13px;}
.tva-class .story-cta-full{display:none;}
.tva-class .story-cta-short{display:inline;}}
.tva-class .hero{padding:56px 0 44px;}
.tva-class .hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center;}
.tva-class .hero h1{font-size:40px;font-weight:800;line-height:1.12;letter-spacing:-1px;}
.tva-class .hero h1 .hl{color:var(--indigo);}
.tva-class .hero p{margin-top:18px;color:var(--ink-soft);font-size:17px;max-width:460px;}
.tva-class .hero-scroll{display:inline-block;margin-top:22px;font-size:14px;font-weight:600;color:var(--ink-faint);cursor:pointer;text-decoration:none;border-bottom:1px solid transparent;transition:color .15s ease,border-color .15s ease;}
.tva-class .hero-scroll:hover{color:var(--indigo);border-color:var(--indigo);}
/* Card giá — tinh thần card Hero cũ: card chữ nhật, thông tin cụ thể, sản phẩm là nhân vật chính */
.tva-class .hero-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:26px 26px 22px;box-shadow:0 20px 50px -24px rgba(33,28,50,.25);}
.tva-class .hero-card .hc-kicker{font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--honey);}
.tva-class .hero-card .hc-price{margin-top:8px;font-size:36px;font-weight:800;letter-spacing:-1px;color:var(--indigo);line-height:1;}
.tva-class .hero-card .hc-price span{font-size:16px;font-weight:600;color:var(--ink-faint);letter-spacing:0;}
.tva-class .hero-card .hc-price-sub{margin-top:6px;font-size:12.5px;font-weight:600;color:var(--ink-soft);}
.tva-class .hero-card .hc-body{margin-top:12px;font-size:14px;line-height:1.6;color:var(--ink-soft);max-width:none;}
.tva-class .hero-card .hc-items{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:16px;padding:16px 0 0;border-top:1px solid var(--line);list-style:none;}
.tva-class .hero-card .hc-items li{font-size:13px;font-weight:600;color:var(--ink);padding-left:18px;position:relative;}
.tva-class .hero-card .hc-items li::before{content:'';position:absolute;left:0;top:6px;width:8px;height:8px;border-radius:50%;background:var(--indigo);opacity:.85;}
.tva-class .hero-card .hc-note{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);font-size:13px;color:var(--ink-soft);}
.tva-class .hero-card .hc-note b{color:var(--honey);}
@media(max-width:860px){.tva-class .hero-grid{grid-template-columns:1fr;gap:26px;}.tva-class .hero h1{font-size:32px;}.tva-class .hero-card{padding:22px 20px 20px;}.tva-class .hero-card .hc-price{font-size:32px;}}
.tva-class .doors{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-class .door{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;}
.tva-class .door .dq{font-size:16.5px;font-weight:700;line-height:1.3;}
.tva-class .door .dbadge{font-size:11.5px;font-weight:700;color:var(--honey);background:var(--honey-tint);padding:3px 9px;border-radius:6px;align-self:flex-start;margin:9px 0 10px;}
.tva-class .door p{font-size:13.5px;color:var(--ink-soft);flex:1;margin-bottom:14px;line-height:1.45;}
.tva-class .door .btn{font-size:13.5px;padding:10px;}
.tva-class .map-hint{margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:#FAF8F4;border:1px dashed var(--line);border-radius:14px;padding:16px 18px;font-size:14px;color:var(--ink-soft);}
/* 6 thành phần Hành trình (quyền lợi mới) — grid 3×2, card gọn */
.tva-class .pl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-class .pl-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;}
.tva-class .pl-card .pl-ic{font-size:24px;line-height:1;}
.tva-class .pl-card h3{font-size:15.5px;font-weight:700;margin:12px 0 6px;}
.tva-class .pl-card p{font-size:13.5px;color:var(--ink-soft);line-height:1.5;margin:0 0 14px;flex:1;}
.tva-class .pl-card .pl-cta{font-size:13px;font-weight:600;color:var(--indigo);background:none;border:none;padding:0;cursor:pointer;font-family:inherit;align-self:flex-start;text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--indigo);}
.tva-class .pl-card .pl-cta:hover{color:var(--indigo-dark);}
@media(max-width:860px){.tva-class .pl-grid{grid-template-columns:1fr;}}
@media(max-width:860px){.tva-class .doors{grid-template-columns:1fr;}}
.tva-class .worries{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px;}
.tva-class .worry{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;}
.tva-class .worry h3{font-size:15.5px;font-weight:700;line-height:1.3;}
.tva-class .worry p{font-size:13.5px;color:var(--ink-soft);margin:8px 0 14px;flex:1;}
.tva-class .worry .askline{font-size:13px;font-weight:600;color:var(--ink-faint);margin-top:10px;cursor:pointer;}
.tva-class .worry .askline:hover{color:var(--indigo);}
.tva-class .worry .soon{font-size:11.5px;color:var(--honey);background:var(--honey-tint);border-radius:6px;padding:5px 9px;margin-top:10px;}
@media(max-width:860px){.tva-class .worries{grid-template-columns:1fr;}}
.tva-class .chat-sec{background:linear-gradient(180deg,#fff,#FAF8F4);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.tva-class .chat-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;}
.tva-class .chat-card{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 44px -22px rgba(33,28,50,.22);overflow:hidden;display:flex;flex-direction:column;height:470px;}
.tva-class .cc-head{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid var(--line);}
.tva-class .cc-head .av{width:40px;height:40px;border-radius:50%;background:linear-gradient(150deg,var(--indigo),#6D63E6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;position:relative;flex-shrink:0;}
.tva-class .cc-head .av .dot{position:absolute;right:0;bottom:1px;width:10px;height:10px;border-radius:50%;background:var(--online);border:2px solid #fff;}
.tva-class .cc-head h4{font-size:14.5px;font-weight:700;}.tva-class .cc-head p{font-size:12px;color:var(--ink-soft);}.tva-class .cc-head p b{color:var(--online);}
.tva-class .cc-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.tva-class .msg{max-width:84%;padding:10px 13px;font-size:14px;line-height:1.5;border-radius:14px;}
.tva-class .msg.ai{background:#F4F2EE;border-bottom-left-radius:4px;align-self:flex-start;}
.tva-class .msg.me{background:var(--indigo);color:#fff;border-bottom-right-radius:4px;align-self:flex-end;}
.tva-class .cc-foot{border-top:1px solid var(--line);padding:11px 13px;}
.tva-class .cc-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:9px;}
.tva-class .cc-chip{border:1.4px solid #D8D2E6;background:#fff;color:var(--ink);padding:7px 12px;border-radius:999px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:inherit;}
.tva-class .cc-chip:hover{border-color:var(--indigo);background:var(--indigo-tint);color:var(--indigo-dark);}
.tva-class .cc-chip:disabled,.tva-class .cc-input input:disabled,.tva-class .cc-input button:disabled{opacity:.5;cursor:default;}
.tva-class .cc-typing{display:flex;gap:4px;align-items:center;}
.tva-class .cc-typing span{width:7px;height:7px;border-radius:50%;background:#B9B2A4;display:inline-block;animation:ccblink 1.2s infinite both;}
.tva-class .cc-typing span:nth-child(2){animation-delay:.2s;}
.tva-class .cc-typing span:nth-child(3){animation-delay:.4s;}
@keyframes ccblink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.tva-class .cc-input{display:flex;gap:8px;}
.tva-class .cc-input input{flex:1;border:1.4px solid var(--line);background:#F7F5F1;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:14px;}
.tva-class .cc-input input:focus{outline:none;border-color:var(--indigo);background:#fff;}
.tva-class .cc-input button{background:var(--indigo);color:#fff;border:none;border-radius:10px;padding:0 15px;font-weight:600;cursor:pointer;font-family:inherit;}
@media(max-width:860px){.tva-class .chat-grid{grid-template-columns:1fr;gap:24px;}.tva-class .chat-card{height:440px;}}
.tva-class .cls-list{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:28px;}
.tva-class .cls-item{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;}
.tva-class .cls-item .tag{font-size:11px;font-weight:700;color:var(--honey);background:var(--honey-tint);display:inline-block;padding:3px 9px;border-radius:6px;align-self:flex-start;}
.tva-class .cls-item h3{font-size:16px;font-weight:700;margin:10px 0 8px;line-height:1.3;}
.tva-class .cls-format{font-size:12.5px;font-weight:600;color:var(--indigo);background:var(--indigo-tint);border-radius:7px;padding:5px 10px;display:inline-block;align-self:flex-start;margin-bottom:10px;}
.tva-class .cls-item .meta{font-size:13.5px;color:var(--ink-soft);display:flex;flex-direction:column;gap:3px;margin-bottom:14px;}
.tva-class .zoom-callout{background:linear-gradient(150deg,#2A2440,#1B1730);border-radius:16px;padding:22px 24px;margin:22px 0 26px;}
.tva-class .zoom-callout-h{font-size:17px;font-weight:800;color:#fff;margin-bottom:8px;}
.tva-class .zoom-callout p{font-size:14.5px;line-height:1.7;color:#C9C3DE;margin:0;}
.tva-class .zoom-callout b{color:#fff;}
.tva-class .active-list{margin-top:16px;display:flex;flex-direction:column;gap:7px;}
.tva-class .active-row{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#FAF8F4;border:1px solid var(--line);border-radius:10px;padding:11px 14px;}
.tva-class .active-name{font-size:14px;font-weight:600;color:var(--ink);}
.tva-class .active-sch{font-size:12.5px;color:var(--indigo);font-weight:600;white-space:nowrap;flex-shrink:0;}
.tva-class .active-1v1{background:var(--honey-tint);border-color:#F1D9B8;}
.tva-class .cls-item .meta b{color:var(--indigo);}
.tva-class .cls-item .price{font-weight:800;color:var(--honey);}
.tva-class .cls-item .acts{margin-top:auto;display:flex;gap:8px;}
.tva-class .cls-item .acts .btn{flex:1;font-size:13.5px;padding:10px;}
@media(max-width:860px){.tva-class .cls-list{grid-template-columns:1fr;}}

/* Nhánh Học theo lớp — TÍM (nối với card TÍM ở section '2 cách học' phía trên) */
.tva-class .cls-sec{padding-top:34px;}
.tva-class .cls-sec .eyebrow{color:var(--indigo);}
.tva-class .cls-kicker{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.tva-class .cls-kicker .eyebrow{margin-bottom:0;}
.tva-class .cls-pill{font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--indigo);background:var(--indigo-tint);border:1px solid #D3CEE8;border-radius:999px;padding:4px 12px;}
.tva-class .cls-sec .cls-item{border-top:3px solid var(--indigo);}
.tva-class .cls-sec .cls-item .tag{color:var(--indigo);background:var(--indigo-tint);}

.tva-class .benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-class .bf{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start;font-size:14.5px;line-height:1.4;}
.tva-class .bf .bi{font-size:20px;flex-shrink:0;}
.tva-class .tuition{margin-top:22px;font-size:18px;font-weight:600;color:var(--ink-soft);}
.tva-class .tuition b{color:var(--honey);font-size:24px;font-weight:800;}
@media(max-width:860px){.tva-class .benefits{grid-template-columns:1fr;}}
.tva-class .panel{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:26px;margin-top:26px;max-width:640px;}
.tva-class .frm{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.tva-class .frm .full{grid-column:1/-1;}
.tva-class .frm label{font-size:12.5px;font-weight:600;color:var(--ink-soft);display:block;margin-bottom:5px;}
.tva-class .frm input,.tva-class .frm select,.tva-class .frm textarea{width:100%;font-family:inherit;font-size:14.5px;color:var(--ink);background:#F7F5F1;border:1.5px solid var(--line);border-radius:11px;padding:11px 13px;resize:none;}
.tva-class .frm input:focus,.tva-class .frm select:focus,.tva-class .frm textarea:focus{outline:none;border-color:var(--indigo);background:#fff;}
.tva-class .frm .err{color:#B91C1C;font-size:13px;font-weight:600;}
@media(max-width:560px){.tva-class .frm{grid-template-columns:1fr;}}
.tva-class .pay-grid{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:center;}
.tva-class .qr-ph{height:180px;}
.tva-class .qr-img{width:100%;max-width:220px;border-radius:14px;border:1px solid var(--line);display:block;align-self:center;}
.tva-class .pay-note b{color:var(--ink);}
.tva-class .zalo-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;background:#0068FF;color:#fff;text-decoration:none;border-radius:12px;padding:13px 20px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;}
.tva-class .zalo-btn:hover{background:#0055D4;}
.tva-class .foot-zalo{color:#fff;font-weight:700;text-decoration:underline;}
.tva-class .pay-info div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px;}
.tva-class .pay-info div span:first-child{color:var(--ink-soft);}
.tva-class .pay-info div span:last-child{font-weight:600;}
.tva-class .pay-info .price{color:var(--honey);}
.tva-class .pay-note{margin-top:14px;font-size:13px;color:var(--ink-soft);background:var(--honey-tint);border-radius:10px;padding:11px 14px;}
.tva-class .ok-box{margin-top:16px;background:#EAF7EE;border:1px solid #BFE6CC;border-radius:13px;padding:16px;}
.tva-class .ok-box h4{color:var(--green-d,#2E7D32);font-size:16px;font-weight:700;margin-bottom:6px;}
.tva-class .ok-box p{font-size:14px;color:var(--ink-soft);}
.tva-class .ok-guide{margin-top:12px;background:#fff;border:1.5px solid #BFE6CC;color:var(--green-d,#2E7D32);border-radius:10px;padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}
.tva-class .app-guide-btn{margin-top:20px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.25);color:#fff;border-radius:12px;padding:13px 20px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;}
.tva-class .app-guide-btn:hover{background:rgba(255,255,255,.2);}
@media(max-width:560px){.tva-class .pay-grid{grid-template-columns:1fr;}}
.tva-class .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:26px;}
.tva-class .step{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;}
.tva-class .step .num{width:30px;height:30px;border-radius:9px;background:var(--indigo-tint);color:var(--indigo);font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px;}
.tva-class .step h4{font-size:14.5px;font-weight:700;}
.tva-class .step p{font-size:13px;color:var(--ink-soft);margin-top:4px;}
@media(max-width:860px){.tva-class .steps{grid-template-columns:1fr 1fr;}}
.tva-class .app-sec{background:linear-gradient(160deg,#2A2440,#211C32);border-radius:24px;padding:38px;color:#fff;}
.tva-class .app-grid{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:center;}
.tva-class .app-sec h2{color:#fff;}.tva-class .app-sec .lead{color:#C9C3DE;}
.tva-class .app-feats{margin-top:20px;display:flex;flex-direction:column;gap:12px;}
.tva-class .app-feat{display:flex;gap:12px;align-items:flex-start;font-size:14.5px;color:#E6E2F2;}
.tva-class .app-feat .ic{font-size:20px;}
.tva-class .app-shots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.tva-class img.shot{width:100%;display:block;border-radius:14px;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px -12px rgba(0,0,0,.5);}
@media(max-width:860px){.tva-class .app-grid{grid-template-columns:1fr;gap:24px;}}
.tva-class .teacher{display:grid;grid-template-columns:280px 1fr;gap:34px;align-items:center;}
.tva-class img.t-photo{width:100%;height:380px;object-fit:contain;object-position:center bottom;border-radius:18px;background:linear-gradient(160deg,#FBF1E4,#F2EEE7);display:block;}
.tva-class .quote{margin-top:18px;font-size:16px;font-style:italic;color:var(--ink);border-left:3px solid var(--honey);padding-left:16px;}
@media(max-width:860px){.tva-class .teacher{grid-template-columns:1fr;}.tva-class .t-photo{height:220px;}}
.tva-class .faq-list{display:flex;flex-direction:column;gap:10px;max-width:780px;margin-top:24px;}
.tva-class .faq-list details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:0;overflow:hidden;}
.tva-class .faq-list summary{font-weight:600;font-size:15.5px;cursor:pointer;list-style:none;padding:15px 44px 15px 18px;position:relative;color:var(--ink);line-height:1.45;}
.tva-class .faq-list summary::-webkit-details-marker{display:none;}
.tva-class .faq-list summary::after{content:'+';position:absolute;right:18px;top:13px;font-size:20px;color:var(--honey);font-weight:400;transition:transform .2s;}
.tva-class .faq-list details[open] summary::after{content:'–';}
.tva-class .faq-list details[open] summary{color:var(--indigo);}
.tva-class .faq-a{padding:0 18px 16px;}
.tva-class .faq-a p{margin:0 0 10px;font-size:14.5px;color:var(--ink-soft);line-height:1.7;}
.tva-class .faq-a p:last-child{margin-bottom:0;}
.tva-class .faq-a ul{margin:0 0 10px;padding-left:20px;}
.tva-class .faq-a li{font-size:14.5px;color:var(--ink-soft);line-height:1.6;margin-bottom:4px;}
.tva-class .final{background:linear-gradient(150deg,var(--indigo),#6D63E6);border-radius:22px;padding:44px;text-align:center;color:#fff;}
.tva-class .final h2{color:#fff;}
.tva-class .final p{margin:12px auto 22px;max-width:480px;color:#E6E2F2;}
.tva-class .final .btn-primary{background:#fff;color:var(--indigo);box-shadow:0 10px 24px -10px rgba(0,0,0,.35);}
.tva-class .final .btn-primary:hover{background:#fff;transform:translateY(-1px);box-shadow:0 14px 30px -10px rgba(0,0,0,.4);}
.tva-class .final .btn-ghost{background:rgba(255,255,255,.12);color:#fff;border:1.5px solid rgba(255,255,255,.55);backdrop-filter:blur(4px);}
.tva-class .final .btn-ghost:hover{background:rgba(255,255,255,.22);border-color:#fff;transform:translateY(-1px);}
.tva-class .final .btn-ghost svg{opacity:.9;}
.tva-class footer{background:#211C32;color:#C9C3DE;padding:26px 0;font-size:13.5px;}
.tva-class .foot-in{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.tva-class .foot-in b{color:#fff;}
.tva-class .fab{position:fixed;right:18px;bottom:18px;z-index:50;background:var(--indigo);color:#fff;border:none;border-radius:999px;padding:13px 18px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 10px 26px -8px rgba(67,56,202,.6);}
.tva-class .modal{position:fixed;inset:0;z-index:100;background:rgba(20,16,32,.55);display:flex;align-items:center;justify-content:center;padding:20px;}
.tva-class .modal-box{background:var(--surface);border-radius:20px;padding:28px;max-width:620px;width:100%;max-height:86vh;overflow-y:auto;position:relative;}
.tva-class .modal-box.wide{max-width:760px;padding:32px 36px;}
.tva-class .modal-box.wide h3{font-size:24px;line-height:1.25;}
.tva-class .modal-box .x{position:absolute;right:16px;top:14px;border:none;background:#F1EFF9;width:32px;height:32px;border-radius:9px;font-size:18px;cursor:pointer;color:var(--ink-soft);}
.tva-class .modal-box h3{font-size:20px;font-weight:800;}
.tva-class .mh-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;}
.tva-class .mh-card{border:1px solid var(--line);border-radius:13px;padding:14px;}
.tva-class .mh-card .mh-ph{height:88px;border-radius:9px;margin-bottom:10px;border:2px dashed #CFC9DA;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--ink-faint);font-size:11px;font-weight:600;background:#FBFAF7;}
.tva-class .mh-card h4{font-size:14px;font-weight:700;}.tva-class .mh-card p{font-size:12.5px;color:var(--ink-soft);margin-top:3px;}
.tva-class .ck-table{width:100%;border-collapse:collapse;margin-top:14px;}
.tva-class .ck-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px;}
.tva-class .ck-table td:first-child{color:var(--ink-soft);width:42%;}
.tva-class .ck-table td:last-child{font-weight:600;}
.tva-class .bando{margin-top:16px;display:flex;flex-direction:column;gap:10px;}
.tva-class .bando .b-row{font-size:14px;color:var(--ink-soft);}
.tva-class .bando .b-node{display:inline-block;padding:6px 12px;border-radius:9px;font-weight:700;color:#fff;}
.tva-class .bando .b-free{background:var(--orange);}
.tva-class .bando .b-branch{display:inline-block;min-width:74px;font-weight:800;color:var(--indigo);}
.tva-class .bando .b-converge{font-weight:700;color:var(--honey);}
@media(max-width:560px){.tva-class .mh-grid{grid-template-columns:1fr;}}
.tva-class .demo-page{position:fixed;inset:0;z-index:120;background:var(--bg);display:flex;flex-direction:column;}
.tva-class .demo-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.tva-class .demo-back{border:1.5px solid #D3CEE8;background:#fff;color:var(--indigo);border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-class .demo-cta{border:none;background:var(--indigo);color:#fff;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-class .demo-scroll{flex:1;overflow-y:auto;}
.tva-class .demo-inner{max-width:840px;margin:0 auto;padding:30px 22px 64px;}
.tva-class .demo-eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey);margin-bottom:10px;}
.tva-class .demo-h2{font-size:28px;font-weight:800;letter-spacing:-.4px;color:var(--ink);margin:0 0 10px;}
.tva-class .demo-lead{font-size:16px;line-height:1.7;color:var(--ink-soft);margin:0 0 20px;max-width:640px;}
.tva-class .demo-video{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 18px 44px -20px rgba(33,28,50,.4);}
.tva-class .demo-video iframe{position:absolute;inset:0;width:100%;height:100%;border:none;}
.tva-class .demo-points{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0;}
.tva-class .demo-point{display:flex;align-items:flex-start;gap:11px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:14px 16px;font-size:14.5px;line-height:1.5;color:var(--ink-soft);}
.tva-class .demo-point span{font-size:20px;flex-shrink:0;}
@media(max-width:600px){.tva-class .demo-points{grid-template-columns:1fr;}.tva-class .demo-h2{font-size:24px;}}
.tva-class .art-page{position:fixed;inset:0;z-index:120;background:var(--bg);display:flex;flex-direction:column;}
.tva-class .art-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.tva-class .art-close{border:1.5px solid #D3CEE8;background:#fff;color:var(--indigo);border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-class .art-close:hover{background:var(--indigo-tint);}
.tva-class .art-top-cta{font-size:14px;padding:9px 16px;}
.tva-class .art-scroll{flex:1;overflow-y:auto;}
.tva-class .art-inner{max-width:760px;margin:0 auto;padding:32px 22px 64px;}
.tva-class .art-h1{font-size:30px;font-weight:800;line-height:1.2;letter-spacing:-.5px;margin-bottom:18px;color:var(--ink);}
@media(max-width:560px){.tva-class .art-h1{font-size:24px;}.tva-class .art-top-cta{display:none;}}
.tva-class .art-body{font-size:16px;line-height:1.8;color:var(--ink-soft);}
.tva-class .art-body p{margin:0 0 12px;}
.tva-class .art-body h2,.tva-class .art-body h3{color:var(--ink);margin:16px 0 8px;}
.tva-class .art-body ul,.tva-class .art-body ol{margin:0 0 12px;padding-left:20px;}
.tva-class .art-body img{max-width:100%;border-radius:10px;margin:8px 0;}
.tva-class .art-body b,.tva-class .art-body strong{color:var(--ink);}

/* CTA mở Mira (thay ô chat giữa trang) */
.tva-class .mira-cta{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 44px -22px rgba(33,28,50,.22);padding:28px 24px;display:flex;flex-direction:column;align-items:flex-start;gap:10px;}
.tva-class .mira-cta .mc-av{position:relative;width:48px;height:48px;border-radius:50%;background:#4338CA;color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px;}
.tva-class .mira-cta .mc-dot{position:absolute;right:1px;bottom:1px;width:11px;height:11px;border-radius:50%;background:#22c55e;border:2px solid var(--surface);}
.tva-class .mira-cta h4{margin:4px 0 0;font-size:17px;color:var(--ink);}
.tva-class .mira-cta p{margin:0;color:var(--ink-soft);font-size:14px;}
.tva-class .mira-cta .btn{margin-top:6px;}

/* Khung chat Mira nổi góc phải (mở bằng nút "💬 Hỏi Mira" sẵn có) */
.mira-panel{position:fixed;right:18px;bottom:18px;z-index:60;width:370px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);flex-direction:column;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;box-shadow:0 24px 64px -16px rgba(15,23,42,.4);}
.mira-panel-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:11px 14px;background:#4338CA;color:#fff;}
.mira-panel-head .mp-av{width:34px;height:34px;border-radius:50%;background:#fff;color:#4338CA;display:grid;place-items:center;font-weight:800;}
.mira-panel-head .mp-title{display:flex;flex-direction:column;line-height:1.25;}
.mira-panel-head .mp-title b{font-size:14.5px;}
.mira-panel-head .mp-title span{font-size:11px;opacity:.85;}
.mira-panel-head .mp-close{margin-left:auto;background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;}
.mira-frame{flex:1;width:100%;border:0;background:#fff;}
@media(max-width:560px){.mira-panel{right:12px;left:12px;width:auto;bottom:12px;height:72vh;}}
`
