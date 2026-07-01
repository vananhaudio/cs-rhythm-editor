// ClassLandingPage — trang tuyển sinh class.vananhaudio.com (route /class)
// Cổng tuyển sinh "có đạo diễn": 3 cửa vào → showcase hành động → chat nhẹ →
// lớp sắp khai giảng → quyền lợi → form (ghi leads) → thanh toán (ẩn) → app/thầy/FAQ.
// Quy ước: dùng chung Supabase (anon ghi leads). Style: scoped CSS .tva-class (responsive/hover).
import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'
import ClassJourney2027 from './ClassJourney2027'
import ClassDemHat from './ClassDemHat'
import ClassTiaNot from './ClassTiaNot'
import ClassQuiz from './ClassQuiz'
import ClassAppGuide from './ClassAppGuide'
import ClassNangCao from './ClassNangCao'
import { FAQS } from './classFaq'

// ─── Lớp dự phòng (hiện khi chưa đọc được Google Sheet) ───
const CLASSES = [
  { tag: 'Đệm hát · Trình độ 1', name: 'Khởi đầu đam mê – Đệm hát TĐ1', path: 'dem_hat', day: 'Thứ 3 · 19h00', date: 'Khai giảng 07/07/2026', price: '990k' },
  { tag: 'Tỉa nốt · Trình độ 3', name: 'Tỉa nốt trên nền karaoke – Cảm âm thực chiến', path: 'tia_not', day: 'Thứ 5 · 19h00', date: 'Khai giảng 09/07/2026', price: '990k' },
  { tag: 'Đệm hát · Trình độ 2', name: 'Khởi đầu đam mê – Đệm hát TĐ2', path: 'dem_hat', day: 'Thứ 6 · 19h00', date: 'Khai giảng 10/07/2026', price: '990k' },
  { tag: 'Toàn diện · Combo', name: 'Hành trình Guitar 2027 (combo 10 khoá)', path: 'combo', day: 'Thứ 5 · 20h30', date: 'Khai giảng tháng 9/2026', price: 'Combo' },
]

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
const parseVNDate = (s: string): number | null => { const m = (s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null }
const schedToCard = (it: { name: string; schedule: string; start: string; price?: string }) => ({
  tag: inferTag(it.name), name: it.name, path: inferPath(it.name),
  day: it.schedule || 'Đang cập nhật', date: it.start ? 'Khai giảng ' + it.start : 'Đang xếp lịch',
  price: it.price || (/nhập môn|miễn phí/i.test(it.name) ? 'Free' : '990k'),
})

// ─── 3 cửa vào — nút mở bài viết (nếu có) hoặc cuộn tới lớp/chat ───
const DOORS: { dq: string; badge: string; desc: string; cta: string; slot: string; fallback: string; native?: string }[] = [
  { dq: 'Tôi muốn vừa đàn vừa hát', badge: 'Guitar căn bản theo hướng Đệm hát', desc: 'Dành cho người mới thích hát, hay hát karaoke, muốn học hợp âm, nhịp phách và tự đệm các bài yêu thích.', cta: 'Xem lớp Đệm hát căn bản', slot: 'cua-dem-hat', fallback: 'lichlop', native: 'demhat' },
  { dq: 'Tôi muốn học Guitar từ gốc', badge: 'Guitar căn bản theo hướng Giai điệu', desc: 'Dành cho người mới muốn làm quen với nốt nhạc, vị trí trên cần đàn và chơi những giai điệu đầu tiên.', cta: 'Xem lớp Guitar căn bản', slot: 'cua-tia-not', fallback: 'lichlop', native: 'tianot' },
  { dq: 'Tôi đã biết chơi và muốn tiến xa hơn', badge: 'Xếp trình độ nâng cao', desc: 'Dành cho người đã học một thời gian nhưng còn bí nhịp, tông, nốt, âm giai, cảm âm hoặc cách xử lý bài hát.', cta: 'Xem mình đang ở đâu', slot: 'cua-cam-am', fallback: 'chat', native: 'nangcao' },
]

// ─── Showcase hành động (tâm lý → 1 hành động nhỏ) ───
// slot: nếu có bài viết (articles) published cùng slot → thẻ "sống dậy", CTA mở bài viết.
const STARTERS: { t: string; d: string; cta: string; href?: string; modal?: string; ready: boolean; note?: string; slot?: string; articleCta?: string; native?: string }[] = [
  { t: 'Tìm điểm bắt đầu của tôi', d: 'Bài test 2 phút. Không cần biết trình độ — trả lời vài câu để biết mình phù hợp lớp nào.', cta: 'Làm bài test', ready: true, native: 'quiz' },
  { t: 'Mở bài học thử trên app', d: 'Dùng thử app TVA Guitar 7 ngày: trải nghiệm bài học đầu tiên, cách luyện tập và theo dõi tiến độ.', cta: 'Dùng thử miễn phí', href: '#chat', ready: false, note: 'cần link bản dùng thử app', slot: 'dung-thu-app', articleCta: 'Tìm hiểu dùng thử' },
  { t: 'Xem một buổi học vận hành thế nào', d: 'Lớp Zoom có thầy dẫn, nhóm Zalo nhắc lịch & giao bài, app lưu bài, có trả bài. Học online không phải tự bơi.', cta: 'Xem một buổi học', ready: true, native: 'demo' },
  { t: '90 phút mỗi tuần cho cây đàn của bạn', d: 'Một tuần chỉ 90 phút, lộ trình 8 buổi. Nếu không đặt lịch cho ước mơ, nó sẽ bị việc khác chen vào.', cta: 'Đọc bài viết', href: '#chat', ready: false, note: 'cần bài viết', slot: '90-phut-moi-tuan', articleCta: 'Đọc bài viết' },
  { t: 'Những học viên lớn tuổi bắt đầu thế nào', d: 'Nhiều người bắt đầu khi đã 40, 50, 60. Quan trọng không phải tuổi — mà là đi chậm và đúng cách.', cta: 'Xem video lớp học', href: '#chat', ready: false, note: 'cần video', slot: 'hoc-vien-lon-tuoi', articleCta: 'Đọc bài viết' },
  { t: 'Bạn được hỗ trợ gì sau khi đăng ký', d: 'Chọn sai lớp? Không theo kịp? Bận một buổi? Mỗi lo lắng đều có cách hệ thống hỗ trợ bạn.', cta: 'Xem cam kết', modal: 'camket', ready: true, slot: 'cam-ket', articleCta: 'Xem cam kết' },
]

const CHAT_FAQ: Record<string, string> = {
  'Tôi nên bắt đầu từ đâu?': 'Người mới hoàn toàn nên bắt đầu từ <b>Nhập môn (miễn phí)</b>, rồi chọn nhánh Đệm hát hoặc Tỉa nốt. Bạn đang ở mức nào?',
  'Học phí thế nào?': 'Mỗi khoá <b>990k</b>, học 2 tháng (8 buổi). Nhập môn &amp; Nhạc lý căn bản miễn phí.',
  'Đệm hát hay tỉa nốt?': 'Muốn tự đàn hát → <b>Đệm hát</b>. Muốn chơi giai điệu, đọc nốt → <b>Tỉa nốt</b>. Bạn thiên về cái nào?',
  'Lịch học ra sao?': 'Các lớp sắp mở chủ yếu <b>tối trong tuần (19h–20h30)</b>. Xem mục "Lớp sắp khai giảng", hoặc cho mình biết khung giờ bạn rảnh.',
}

const MODALS: Record<string, string> = {
  mohinh: `<h3>Một buổi học vận hành thế nào?</h3>
    <p class="lead" style="margin-top:6px">Học ở đây không phải tự xem video rồi tự bơi — có cả một mô hình hỗ trợ quanh bạn.</p>
    <div class="mh-grid">
      <div class="mh-card"><div class="mh-ph">Ảnh lớp Zoom thật</div><h4>Lớp Zoom có người dẫn</h4><p>Học theo lịch cố định, thầy giảng trực tiếp.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh nhóm Zalo lớp</div><h4>Nhóm Zalo lớp</h4><p>Nhắc lịch, giao bài, hỏi đáp sau buổi học.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh màn hình app</div><h4>App TVA Guitar</h4><p>Bài học, bài tập, tiến độ được lưu để ôn lại.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh hướng dẫn trả bài</div><h4>Trả bài có góp ý</h4><p>Gửi bài để thầy/trợ lý xem và sửa cho bạn.</p></div>
    </div>`,
  camket: `<h3>Bạn được hỗ trợ gì sau khi đăng ký?</h3>
    <p class="lead" style="margin-top:6px">Bạn không bị ném vào một khoá học rồi tự xoay xở.</p>
    <table class="ck-table"><tbody>
      <tr><td>Chọn sai lớp</td><td>Được tư vấn trước khi vào lớp</td></tr>
      <tr><td>Không theo kịp</td><td>App xem lại bài + bài tập sau buổi</td></tr>
      <tr><td>Bận một buổi</td><td>Có nội dung ôn lại trong app / nhóm lớp</td></tr>
      <tr><td>Không biết tập gì</td><td>Có bài tập rõ sau mỗi buổi học</td></tr>
      <tr><td>Vào lớp chưa phù hợp</td><td>Thầy/trợ lý sẽ định hướng lại</td></tr>
    </tbody></table>`,
  banDo: `<h3>Bản đồ hành trình dài hạn</h3>
    <p class="lead" style="margin-top:6px">Bạn không cần học hết ngay — chỉ cần bắt đầu bằng khóa đầu tiên phù hợp. Đây là con đường nếu bạn muốn đi xa.</p>
    <div class="bando">
      <div class="b-row"><span class="b-node b-free">Nhập môn (miễn phí)</span></div>
      <div class="b-row"><span class="b-branch">Nhạc lý</span> căn bản → nâng cao → hoà âm cảm âm</div>
      <div class="b-row"><span class="b-branch">Đệm hát</span> TĐ1 → TĐ2 → TĐ3 (bứt phá)</div>
      <div class="b-row"><span class="b-branch">Tỉa nốt</span> TĐ1 → TĐ2 → nâng cao</div>
      <div class="b-row b-converge">↓ hội tụ: Đệm hát nâng cao → Solo Guitar → Nghệ sĩ Guitar</div>
    </div>`,
}

const ZALO = '0983 259 893'
const ZALO_LINK = 'https://zalo.me/vananhguitarist'

type Msg = { who: 'ai' | 'me'; html: string }

export default function ClassLandingPage() {
  const [form, setForm] = useState({ name: '', phone: '', zalo: '', email: '', className: CLASSES[0].name, note: '', isHanhtrinh: false })
  const [showPending, setShowPending] = useState(false)   // học sinh HT gửi yêu cầu miễn phí → chờ duyệt
  const [formErr, setFormErr] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [sent, setSent] = useState(false)
  const [okBox, setOkBox] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [showJourney, setShowJourney] = useState(false)
  const [showDemHat, setShowDemHat] = useState(false)
  const [showTiaNot, setShowTiaNot] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [showNangCao, setShowNangCao] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'ai', html: 'Chào bạn 👋 Mình là <b>Mira</b>, trợ lý của Thầy Văn Anh Guitar. Bạn đang muốn học guitar theo hướng nào, hay còn băn khoăn gì? Cứ hỏi mình nhé.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatSessionRef = useRef<string | null>(null)
  const [articles, setArticles] = useState<Record<string, { title: string; body: string }>>({})
  type SchedItem = { name: string; code: string; schedule: string; start: string; price?: string }
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
    setSuErr('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail.trim())) { setSuErr('Email chưa đúng định dạng.'); return }
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
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

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

  // Đọc lịch lớp từ bảng class_schedule (thầy quản lý trong /admin → Lịch lớp)
  useEffect(() => {
    supabase.from('class_schedule').select('code,name,section,schedule,start_text,price,is_active,sort_order')
      .eq('is_active', true).order('sort_order').order('created_at')
      .then(({ data }) => {
        const rows = (data ?? []) as any[]
        const toItem = (r: any) => ({ name: r.name, code: r.code ?? '', schedule: r.schedule ?? '', start: r.start_text ?? '', price: r.price ?? '' })
        const upcoming = rows.filter(r => r.section === 'upcoming').map(toItem)
        const active = rows.filter(r => r.section === 'active').map(toItem)
        const smallGroup = rows.filter(r => r.section === 'smallgroup').map(r => ({ schedule: r.schedule ?? '' }))
        const oneOnOneCount = rows.filter(r => r.section === 'oneonone').length
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

  const goto = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  // Deep-link chia sẻ: ?xem=... (mở đúng nội dung) — vd ?xem=hanhtrinh, ?xem=lich, ?xem=app
  useEffect(() => {
    const xem = (new URLSearchParams(window.location.search).get('xem') || window.location.hash.replace('#', '') || '').toLowerCase()
    if (!xem) return
    const actions: Record<string, () => void> = {
      hanhtrinh: () => setShowJourney(true),
      lich: () => setTimeout(() => goto('lichlop'), 350),
      lichlop: () => setTimeout(() => goto('lichlop'), 350),
      app: () => setTimeout(() => goto('app'), 350),
      caidat: () => setShowGuide(true),
      demhat: () => setShowDemHat(true),
      tianot: () => setShowTiaNot(true),
      nangcao: () => setShowNangCao(true),
      quiz: () => setShowQuiz(true),
      dangky: () => setTimeout(() => goto('dangky'), 350),
      cuavao: () => setTimeout(() => goto('cuavao'), 350),
    }
    actions[xem]?.()
  }, [])

  const pickClass = (name: string) => { set('className', name); goto('dangky') }

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
    const cls = CLASSES.find(c => c.name === form.className)
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
          <div className="brand"><img className="mark" src="/tva-logo.png" alt="TVA Guitar" /> Thầy Văn Anh Guitar</div>
          <div className="nav-links">
            <a onClick={() => goto('cuavao')}>Cửa vào</a>
            <a onClick={() => goto('chat')}>Tư vấn</a>
            <a onClick={() => goto('batdau')}>Bắt đầu</a>
            <a onClick={() => goto('lichlop')}>Lịch lớp</a>
            {!me && <a onClick={() => goto('dangky')}>Đăng ký</a>}
            {!me && <a onClick={() => setShowLogin(true)}>Đăng nhập</a>}
          </div>
          {me
            ? <button className="btn btn-primary nav-cta" onClick={() => { window.location.href = '/me' }}>🎸 Hành trình của tôi</button>
            : <button className="btn btn-primary nav-cta" onClick={() => goto('dangky')}>Đăng ký lớp</button>}
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>Bắt đầu học Guitar bằng <span className="hl">một khóa nhỏ phù hợp với bạn</span></h1>
            <p>Thích hát, thích chơi giai điệu, hay đã chơi nhưng muốn tiến xa hơn — mỗi người một cửa vào. Bạn không cần học cả hành trình ngay từ đầu, chỉ cần chọn đúng khóa nhỏ đầu tiên. Khi sẵn sàng, bản đồ dài hạn luôn ở đó để bạn đi tiếp.</p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={() => goto('cuavao')}>Chọn cửa vào của tôi →</button>
              <button className="btn btn-ghost" onClick={() => goto('chat')}>Trò chuyện với Mira</button>
            </div>
          </div>
          <div className="hero-art">
            <h3>Bắt đầu bằng đúng một bước</h3>
            <p>Chọn một khóa nhỏ phù hợp với bạn. Học theo lớp Zoom, luyện thêm trên app và có lộ trình đi tiếp khi sẵn sàng.</p>
            <div className="hero-stats">
              <div><b>3</b><span>cửa vào để chọn</span></div>
              <div><b>8 buổi Zoom</b><span>trực tiếp cùng thầy</span></div>
              <div><b>24/24</b><span>tự luyện trên app</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* 3 CỬA VÀO */}
      <section id="cuavao" className="band">
        <div className="wrap">
          <div className="eyebrow">Chọn điểm bắt đầu</div>
          <h2>Chọn cửa vào phù hợp với bạn</h2>
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

      {/* SHOWCASE HÀNH ĐỘNG */}
      <section id="batdau" className="band">
        <div className="wrap">
          <div className="eyebrow">Chọn một bước nhỏ</div>
          <h2>Bắt đầu theo cách phù hợp với bạn</h2>
          <p className="lead">Mỗi người có một điểm bắt đầu khác nhau. Làm bài test, xem thử cách học, đọc một bài ngắn — hoặc hỏi trợ lý, trước khi đăng ký.</p>
          <div className="worries">
            {STARTERS.map((x, i) => {
              const art = x.slot ? articles[x.slot] : undefined
              const live = x.ready || !!art
              return (
              <div className="worry" key={i}>
                <h3>{x.t}</h3>
                <p>{x.d}</p>
                {x.native === 'quiz'
                  ? <button className="btn btn-primary" onClick={() => setShowQuiz(true)}>{x.cta} →</button>
                  : x.native === 'demo'
                  ? <button className="btn btn-primary" onClick={() => setShowDemo(true)}>{x.cta} →</button>
                  : art
                  ? <button className="btn btn-primary" onClick={() => setModal('art:' + x.slot)}>{x.articleCta ?? 'Đọc bài viết'} →</button>
                  : x.modal
                  ? <button className="btn btn-ghost" onClick={() => setModal(x.modal!)}>{x.cta} →</button>
                  : <button className={`btn ${x.ready ? 'btn-primary' : 'btn-ghost'}`} onClick={() => goto((x.href ?? '#chat').replace('#', ''))}>{x.cta} →</button>}
                <a className="askline" onClick={() => goto('chat')}>Hỏi trợ lý về bước này →</a>
                {!live && <div className="soon">Sắp có · {x.note}</div>}
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* CHAT */}
      <section className="chat-sec" id="chat">
        <div className="wrap chat-grid">
          <div>
            <div className="eyebrow">Trợ lý Mira</div>
            <h2>Còn câu hỏi riêng? Hỏi Mira nhé</h2>
            <p className="lead">Mira giúp bạn tìm đúng cửa vào phù hợp và trả lời mọi thắc mắc riêng của bạn — trước khi quyết định đăng ký.</p>
          </div>
          <div className="chat-card">
            <div className="cc-head">
              <div className="av">M<span className="dot" /></div>
              <div><h4>Mira · Trợ lý TVA Guitar</h4><p><b>● Đang trực tuyến</b> · trả lời ngay</p></div>
            </div>
            <div className="cc-body" ref={chatBodyRef}>
              {msgs.map((m, i) => <div key={i} className={`msg ${m.who}`} dangerouslySetInnerHTML={{ __html: m.html }} />)}
              {chatLoading && <div className="msg ai cc-typing"><span /><span /><span /></div>}
            </div>
            <div className="cc-foot">
              <div className="cc-chips">
                {Object.keys(CHAT_FAQ).map(q => <button key={q} className="cc-chip" disabled={chatLoading} onClick={() => chatSendText(q)}>{q}</button>)}
              </div>
              <div className="cc-input">
                <input value={chatInput} disabled={chatLoading} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') chatSend() }} placeholder="Nhập câu hỏi của bạn..." />
                <button onClick={chatSend} disabled={chatLoading}>Gửi</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LỚP SẮP KHAI GIẢNG */}
      <section id="lichlop">
        <div className="wrap">
          <div className="eyebrow">Lịch khai giảng</div>
          <h2>Lớp sắp khai giảng</h2>
          <p className="lead">Tất cả lớp đều <b>học online trực tiếp qua Zoom</b> · 990k/khoá · 2 tháng · 8 buổi. Đã quyết thì đăng ký luôn, còn lăn tăn thì hỏi thêm.</p>
          <div className="cls-list">
            {(sched?.upcoming?.length
              ? [...sched.upcoming].sort((a, b) => { const da = parseVNDate(a.start), db = parseVNDate(b.start); if (da == null && db == null) return 0; if (da == null) return 1; if (db == null) return -1; return da - db }).map(schedToCard)
              : CLASSES
            ).map((c, i) => (
              <div className="cls-item" key={i}>
                <span className="tag">{c.tag}</span>
                <h3>{c.name}</h3>
                <div className="cls-format">🎥 Online qua Zoom · {c.path === 'combo' ? 'combo 10 khoá' : '8 buổi · mỗi buổi 90 phút'}</div>
                <div className="meta"><span><b>{c.day}</b></span><span>{c.date}</span><span className="price">{c.price}</span></div>
                <div className="acts">
                  <button className="btn btn-primary" onClick={() => pickClass(c.name)}>Đăng ký lớp này</button>
                  <button className="btn btn-ghost" onClick={() => goto('chat')}>Hỏi thêm</button>
                </div>
              </div>
            ))}
          </div>
          {sched && sched.activeCount > 0 && (
            <div style={{ textAlign: 'center', marginTop: 26 }}>
              <button className="btn btn-ghost" onClick={() => setShowActive(true)}>👀 Xem thêm {sched.activeCount} lớp đang học →</button>
            </div>
          )}
        </div>
      </section>

      {/* QUYỀN LỢI */}
      <section id="quyenloi" className="band">
        <div className="wrap">
          <div className="eyebrow">Quyền lợi</div>
          <h2>Một khóa học gồm những gì?</h2>
          <div className="zoom-callout">
            <div className="zoom-callout-h">🎥 Lớp Online trực tiếp cùng Thầy Văn Anh</div>
            <p>Bạn <b>không học một mình qua video quay sẵn</b>. Bạn học <b>online trực tiếp qua Zoom</b> (8 buổi / 2 tháng, mỗi buổi 90 phút), luyện thêm trên app TVA Guitar và được theo dõi, hỗ trợ trong nhóm lớp.</p>
          </div>
          <div className="benefits">
            {[['🎥', '<b>8 buổi Zoom trực tiếp</b> cùng thầy, mỗi buổi 90 phút'], ['📱', '<b>App TVA Guitar</b> luyện tập 24/24'], ['✍️', '<b>Bài tập</b> rõ ràng sau mỗi buổi'], ['👥', '<b>Nhóm lớp</b> nhận thông báo & hỗ trợ'], ['🎯', '<b>Tư vấn chọn đúng trình độ</b> trước khi vào lớp'], ['🗺️', '<b>Lộ trình học tiếp</b> rõ ràng khi sẵn sàng']].map(([ic, t], i) => (
              <div className="bf" key={i}><span className="bi">{ic}</span><div dangerouslySetInnerHTML={{ __html: t }} /></div>
            ))}
          </div>
          <div className="tuition">Học phí khóa học: <b>990.000đ</b></div>
        </div>
      </section>

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
                  {CLASSES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="full"><label>Ghi chú thêm (không bắt buộc)</label><textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} placeholder="Khung giờ rảnh, câu muốn hỏi thầy..." /></div>
              {/* Học phí + tick miễn phí cho học sinh lớp Hành trình (chỉ khi đã đăng nhập) */}
              <div className="full" style={{ background: '#F4F4F5', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 15 }}>Học phí khoá này: <b style={{ color: '#EA580C' }}>{(CLASSES.find(c => c.name === form.className)?.price === 'Combo') ? 'Combo trọn gói' : '990.000đ'}</b></div>
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
            <button className="btn btn-primary" onClick={() => goto('lichlop')}>Xem lớp &amp; đăng ký</button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-in">
          <div><b>VAN ANH AUDIO</b> · TVA Guitar · vananhaudio.com</div>
          <div>Đăng ký qua Zalo thầy: <a className="foot-zalo" href={ZALO_LINK} target="_blank" rel="noreferrer">{ZALO}</a></div>
        </div>
      </footer>

      <button className="fab" onClick={() => goto('chat')}>💬 Hỏi Mira</button>

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
                {suErr && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, marginBottom: 12 }}>{suErr}</div>}
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
          onRegister={() => { setShowJourney(false); setTimeout(() => goto('lichlop'), 60) }}
        />
      )}

      {showDemHat && (
        <ClassDemHat
          onClose={() => setShowDemHat(false)}
          onRegister={() => { setShowDemHat(false); setTimeout(() => goto('lichlop'), 60) }}
          onChat={() => { setShowDemHat(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showTiaNot && (
        <ClassTiaNot
          onClose={() => setShowTiaNot(false)}
          onRegister={() => { setShowTiaNot(false); setTimeout(() => goto('lichlop'), 60) }}
          onChat={() => { setShowTiaNot(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showQuiz && (
        <ClassQuiz
          onClose={() => setShowQuiz(false)}
          onRegister={() => { setShowQuiz(false); setTimeout(() => goto('lichlop'), 60) }}
          onChat={() => { setShowQuiz(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showGuide && (
        <ClassAppGuide
          onClose={() => setShowGuide(false)}
          onRegister={() => { setShowGuide(false); setTimeout(() => goto('lichlop'), 60) }}
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

      {showDemo && (
        <div className="demo-page">
          <div className="demo-top">
            <button className="demo-back" onClick={() => setShowDemo(false)}>← Quay lại</button>
            <button className="demo-cta" onClick={() => { setShowDemo(false); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp &amp; đăng ký →</button>
          </div>
          <div className="demo-scroll">
            <div className="demo-inner">
              <div className="demo-eyebrow">Mô hình học</div>
              <h2 className="demo-h2">Một buổi học vận hành thế nào?</h2>
              <p className="demo-lead">Xem trực tiếp một buổi học thật: thầy giảng trên Zoom, hướng dẫn từng bước, học viên thực hành và được sửa ngay. Học online ở đây không phải tự bơi.</p>
              <div className="demo-video">
                <iframe
                  src="https://www.youtube.com/embed/1PtetZ2VYms?start=6420&rel=0"
                  title="Một buổi học TVA Guitar"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="demo-points">
                {[['🎥', 'Lớp Zoom có người dẫn — thầy giảng trực tiếp theo lịch cố định'], ['💬', 'Nhóm Zalo lớp — nhắc lịch, giao bài, hỏi đáp sau buổi học'], ['📱', 'App TVA Guitar — bài học, bài tập, tiến độ lưu lại để ôn'], ['✍️', 'Trả bài có góp ý — gửi bài để thầy xem và sửa cho bạn']].map(([ic, t], i) => (
                  <div className="demo-point" key={i}><span>{ic}</span>{t}</div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => { setShowDemo(false); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp &amp; đăng ký →</button>
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
              <button className="btn btn-primary art-top-cta" onClick={() => { setModal(null); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp &amp; đăng ký →</button>
            </div>
            <div className="art-scroll">
              <div className="art-inner">
                {a ? <>
                  <h1 className="art-h1">{a.title}</h1>
                  <div className="art-body" dangerouslySetInnerHTML={{ __html: a.body }} />
                  <button className="btn btn-primary" style={{ marginTop: 28 }} onClick={() => { setModal(null); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp &amp; đăng ký →</button>
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
            <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={() => { setShowActive(false); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp sắp khai giảng &amp; đăng ký →</button>
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
    </div>
  )
}

const CSS = `
.tva-class{--bg:#F2EEE7;--surface:#FFFFFF;--ink:#211C32;--ink-soft:#5A5470;--ink-faint:#8A8499;--indigo:#4338CA;--indigo-dark:#352BA3;--indigo-tint:#EEEBFB;--honey:#C9711E;--honey-tint:#FBF1E4;--line:#E4DED4;--online:#16A34A;--orange:#EE7D3C;font-family:'Be Vietnam Pro',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55;font-size:16px;min-height:100vh;text-align:left;}
.tva-class *{box-sizing:border-box;}
.tva-class .wrap{max-width:1080px;margin:0 auto;padding:0 20px;}
.tva-class section{padding:58px 0;}
.tva-class .band{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.tva-class .band-top{background:#fff;border-top:1px solid var(--line);}
.tva-class h2{font-size:30px;font-weight:800;line-height:1.15;letter-spacing:-.5px;}
.tva-class .eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey);margin-bottom:10px;}
.tva-class .lead{color:var(--ink-soft);font-size:16.5px;max-width:640px;margin-top:12px;}
.tva-class .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:15px;border-radius:12px;padding:13px 22px;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s;}
.tva-class .btn-primary{background:var(--indigo);color:#fff;}
.tva-class .btn-primary:hover{background:var(--indigo-dark);}
.tva-class .btn-ghost{background:transparent;color:var(--indigo);border:1.5px solid #D3CEE8;}
.tva-class .btn-ghost:hover{background:var(--indigo-tint);}
.tva-class .ph{border:2px dashed #CFC9DA;border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--ink-faint);font-size:12.5px;font-weight:600;padding:14px;background:#FBFAF7;}
.tva-class nav{position:sticky;top:0;z-index:40;background:rgba(242,238,231,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.tva-class .nav-in{display:flex;align-items:center;justify-content:space-between;height:62px;}
.tva-class .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:16px;}
.tva-class .brand .mark{width:36px;height:36px;border-radius:9px;object-fit:contain;display:block;}
.tva-class .nav-links{display:flex;gap:22px;font-size:14.5px;font-weight:500;}
.tva-class .nav-links a{color:var(--ink-soft);text-decoration:none;cursor:pointer;}
.tva-class .nav-links a:hover{color:var(--indigo);}
.tva-class .nav-cta{font-size:14px;padding:9px 16px;}
@media(max-width:860px){.tva-class .nav-links{display:none;}}
.tva-class .hero{padding:60px 0 46px;}
.tva-class .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;}
.tva-class .hero h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-1px;}
.tva-class .hero h1 .hl{color:var(--indigo);}
.tva-class .hero p{margin-top:18px;color:var(--ink-soft);font-size:17px;max-width:500px;}
.tva-class .hero-cta{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap;}
.tva-class .hero-art{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:26px;box-shadow:0 20px 50px -24px rgba(33,28,50,.25);}
.tva-class .hero-art h3{margin:0 0 6px;font-size:18px;font-weight:700;}
.tva-class .hero-art p{font-size:14px;color:var(--ink-soft);}
.tva-class .hero-stats{display:flex;gap:22px;margin-top:18px;border-top:1px solid var(--line);padding-top:16px;}
.tva-class .hero-stats div b{display:block;font-size:22px;font-weight:800;color:var(--indigo);}
.tva-class .hero-stats div span{font-size:12px;color:var(--ink-faint);}
@media(max-width:860px){.tva-class .hero-grid{grid-template-columns:1fr;gap:28px;}.tva-class .hero h1{font-size:32px;}}
.tva-class .doors{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-class .door{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;}
.tva-class .door .dq{font-size:16.5px;font-weight:700;line-height:1.3;}
.tva-class .door .dbadge{font-size:11.5px;font-weight:700;color:var(--honey);background:var(--honey-tint);padding:3px 9px;border-radius:6px;align-self:flex-start;margin:9px 0 10px;}
.tva-class .door p{font-size:13.5px;color:var(--ink-soft);flex:1;margin-bottom:14px;line-height:1.45;}
.tva-class .door .btn{font-size:13.5px;padding:10px;}
.tva-class .map-hint{margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:#FAF8F4;border:1px dashed var(--line);border-radius:14px;padding:16px 18px;font-size:14px;color:var(--ink-soft);}
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
.tva-class .final .btn-primary{background:#fff;color:var(--indigo);}
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
`
