import { useState } from 'react'
import {
  BookOpen, Check, ChevronRight, CircleUserRound, Crown, Dumbbell, Home,
  Lock, MessageCircle, Music2, Play, Radio, Settings, UserRound,
} from 'lucide-react'

type Tab = 'home' | 'learn' | 'practice' | 'teacher' | 'me'
type PackageCode = 'start' | 'basic' | 'advanced'
type Sheet = null | 'solo' | 'paywall' | 'library' | 'lesson' | 'practice' | 'zoom' | 'benefits'
type PracticeQuota = {
  period: string
  sessionsPerPeriod: number | 'unlimited'
  usedSessions: number
}

type LessonItem = {
  id: string
  title: string
  series: string
  image: string
  locked?: boolean
}

const P = {
  bg: '#F6F5FB',
  soft: '#EFECF8',
  card: '#FFFFFF',
  ink: '#211C32',
  muted: '#464160',
  faint: '#817A9D',
  border: '#DDD8EC',
  accent: '#4338CA',
  accentDark: '#352BA3',
  orange: '#EA580C',
  green: '#15803D',
  shadow: '0 10px 28px rgba(33,28,50,.08)',
  shadowSoft: '0 6px 16px rgba(33,28,50,.06)',
}

const packages: Record<PackageCode, { label: string; price: string; rank: number }> = {
  start: { label: 'Khởi đầu', price: '99K/tháng', rank: 1 },
  basic: { label: 'Căn bản', price: '396K/tháng', rank: 2 },
  advanced: { label: 'Nâng cao', price: '499K/tháng', rank: 3 },
}

const quickTools = [
  { title: 'Chuyển hợp âm', sub: '5 phút tay trái', image: '/app-luyentap.png' },
  { title: 'Nhịp điệu', sub: 'Groove hôm nay', image: '/app-tiendo.png' },
  { title: 'Tuner', sub: 'Lên dây nhanh', image: '/tune-lab.png' },
  { title: 'Tap Tempo', sub: 'Tìm BPM bài hát', image: '/app-khoahoc.png' },
  { title: 'Cảm âm', sub: 'Nghe và đoán nốt', image: '/piano-journey.png' },
  { title: 'GuitarBoard', sub: 'Cần đàn trực quan', image: '/ban-do-hanh-trinh-2027.png' },
]

const videos = [
  { title: 'Ballad: đệm sao cho mềm', tag: 'Xem cùng Thầy', image: '/thay-van-anh.png' },
  { title: 'Bolero: nhịp và hơi thở', tag: 'Dành cho bạn', image: '/og-default.png' },
  { title: 'Chuyển hợp âm sạch hơn', tag: 'Kỹ thuật', image: '/app-luyentap.png' },
  { title: 'Tỉa giai điệu nhập môn', tag: 'Tỉa nốt', image: '/app-khoahoc.png' },
]

const learnRows: { title: string; hint: string; lessons: LessonItem[] }[] = [
  {
    title: 'Đệm hát',
    hint: 'Acoustic · rhythm · biểu diễn',
    lessons: [
      { id: 'dem-1', series: 'Đệm hát', title: 'Khởi đầu Ballad với 4 hợp âm', image: '/app-luyentap.png' },
      { id: 'dem-2', series: 'Đệm hát', title: 'Chuyển hợp âm trong nhịp', image: '/thay-van-anh.png' },
      { id: 'dem-3', series: 'Đệm hát', title: 'Điệu Slow và cách giữ hơi', image: '/og-default.png' },
      { id: 'dem-4', series: 'Đệm hát', title: 'Bolero nền tảng cho người mới', image: '/app-tiendo.png', locked: true },
      { id: 'dem-5', series: 'Đệm hát', title: 'Intro đơn giản trước khi hát', image: '/ban-do-hanh-trinh-2027.png', locked: true },
      { id: 'dem-6', series: 'Đệm hát', title: 'Đệm bài hát có chuyển đoạn', image: '/app-khoahoc.png', locked: true },
    ],
  },
  {
    title: 'Tỉa nốt',
    hint: 'Melody · fretboard · bản nhạc',
    lessons: [
      { id: 'tia-1', series: 'Tỉa nốt', title: 'Tìm nốt đầu tiên trên cần đàn', image: '/piano-journey.png' },
      { id: 'tia-2', series: 'Tỉa nốt', title: 'Đọc câu giai điệu ngắn', image: '/app-khoahoc.png' },
      { id: 'tia-3', series: 'Tỉa nốt', title: 'Tỉa nốt đúng trường độ', image: '/app-tiendo.png', locked: true },
      { id: 'tia-4', series: 'Tỉa nốt', title: 'Giai điệu đi cùng hợp âm', image: '/og-default.png', locked: true },
      { id: 'tia-5', series: 'Tỉa nốt', title: 'Nghe và tìm lại câu nhạc', image: '/ban-do-hanh-trinh-2027.png', locked: true },
      { id: 'tia-6', series: 'Tỉa nốt', title: 'Tỉa một bài hát quen thuộc', image: '/thay-van-anh.png', locked: true },
    ],
  },
  {
    title: 'Solo',
    hint: 'Fretboard · stage · năng lượng',
    lessons: [
      { id: 'solo-1', series: 'Solo', title: 'Câu solo ngắn trên nền quen', image: '/thay-van-anh.png', locked: true },
      { id: 'solo-2', series: 'Solo', title: 'Motif và cách kết câu', image: '/og-default.png', locked: true },
      { id: 'solo-3', series: 'Solo', title: 'Solo có điểm rơi', image: '/app-tiendo.png', locked: true },
      { id: 'solo-4', series: 'Solo', title: 'Phrasing trong một vòng hợp âm', image: '/ban-do-hanh-trinh-2027.png', locked: true },
      { id: 'solo-5', series: 'Solo', title: 'Solo vào bài hát thật', image: '/app-luyentap.png', locked: true },
    ],
  },
  {
    title: 'Nhạc lý / Cảm âm',
    hint: 'Notation · lắng nghe · khoảng cách',
    lessons: [
      { id: 'ly-1', series: 'Nhạc lý / Cảm âm', title: 'Đọc nốt trên khuông nhạc', image: '/app-khoahoc.png' },
      { id: 'ly-2', series: 'Nhạc lý / Cảm âm', title: 'Nghe cao độ lên hay xuống', image: '/piano-journey.png' },
      { id: 'ly-3', series: 'Nhạc lý / Cảm âm', title: 'Hợp âm trưởng và thứ', image: '/ban-do-hanh-trinh-2027.png' },
      { id: 'ly-4', series: 'Nhạc lý / Cảm âm', title: 'Khoảng cách âm cơ bản', image: '/og-default.png', locked: true },
      { id: 'ly-5', series: 'Nhạc lý / Cảm âm', title: 'Ứng dụng nhạc lý vào bài', image: '/app-tiendo.png', locked: true },
    ],
  },
]

const libraryRows = [
  { title: 'Dành cho bạn', minRank: 1, items: videos },
  { title: 'Đệm hát', minRank: 1, items: videos.slice(0, 3) },
  { title: 'Tỉa nốt', minRank: 2, items: videos.slice(1) },
  { title: 'Solo', minRank: 3, items: videos.slice().reverse() },
  { title: 'Cảm âm', minRank: 3, items: videos.slice(0, 2) },
]

const practiceSkills = [
  { id: 'finger', name: 'Luyện ngón', image: '/app-luyentap.png', target: 'component:FingerExercise' },
  { id: 'scale', name: 'Âm giai', image: '/ban-do-hanh-trinh-2027.png', target: 'component:ScaleExercise' },
  { id: 'arpeggio', name: 'Arpeggio', image: '/thay-van-anh.png', target: 'component:ArpeggioExercise' },
  { id: 'rhythm', name: 'Tiết tấu', image: '/app-tiendo.png', target: 'component:GrooveExercise' },
  { id: 'ear', name: 'Cảm âm', image: '/piano-journey.png', target: 'presentation:ear' },
]

const practiceSongs = [
  { title: 'Happy Birthday', meta: 'Đang tập', image: '/app-khoahoc.png', route: '/song-builder?title=Happy%20Birthday&standalone=1' },
  { title: 'Ballad mẫu', meta: 'Chuyển hợp âm', image: '/thay-van-anh.png', route: '/song-builder?title=Ballad%20mau&standalone=1' },
]

const realTools = [
  { name: 'Tap Beat', short: 'Tap', route: '/tap', icon: 'tap' },
  { name: 'Tap Tempo', short: 'Tempo', route: '/tempo', icon: 'tempo' },
  { name: 'Tuner', short: 'Tuner', route: '/tuner', icon: 'tuner', image: '/tune-lab.png' },
  { name: 'Hợp âm', short: 'Hợp âm', route: '/chords', icon: 'chord' },
  { name: 'Note Sheet', short: 'Nốt nhạc', route: '/notesheet', icon: 'note' },
  { name: 'GuitarBoard', short: 'Cần đàn', route: '/guitarboard', icon: 'board' },
  { name: 'Metronome', short: 'Nhịp', route: '/metronome', icon: 'metro' },
  { name: 'BMS', short: 'Bài hát', route: '/song-builder?standalone=1', icon: 'bms' },
  { name: 'Piano Journey', short: 'Piano', route: '/piano-journey', icon: 'piano', image: '/piano-journey.png' },
]

// Prototype fixture only: UI reads entitlement capability, not package name or price.
const teacherEntitlements: Record<PackageCode, PracticeQuota> = {
  start: { period: 'tháng này', sessionsPerPeriod: 4, usedSessions: 0 },
  basic: { period: 'tháng này', sessionsPerPeriod: 4, usedSessions: 2 },
  advanced: { period: 'tháng này', sessionsPerPeriod: 'unlimited', usedSessions: 6 },
}

const zooms = [
  { day: 'Thứ Ba', time: '19:30', title: 'Chuyển hợp âm sạch', mode: 'Online qua Zoom' },
  { day: 'Thứ Năm', time: '20:30', title: 'Thực hành Đệm hát', mode: 'Online qua Zoom' },
  { day: 'Thứ Bảy', time: '15:00', title: 'Tập nhịp Ballad', mode: 'Online qua Zoom' },
  { day: 'Chủ Nhật', time: '09:00', title: 'Tỉa nốt & Cảm âm', mode: 'Online qua Zoom' },
  { day: 'Chủ Nhật', time: '20:00', title: 'Hỏi đáp bài đang tập', mode: 'Online qua Zoom' },
]

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 14, border: `1px solid ${P.border}`,
      background: P.card, color: P.ink, display: 'grid', placeItems: 'center',
      boxShadow: P.shadowSoft,
    }}>{children}</div>
  )
}

function Section({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 10px' }}>
        <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.2, fontWeight: 800, color: P.ink }}>{title}</h2>
        {action && <span style={{ color: P.accent, fontSize: 13, fontWeight: 800 }}>{action}</span>}
      </div>
      {children}
    </section>
  )
}

function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, overflowX: 'auto', padding: '0 18px 4px',
      scrollSnapType: 'x proximity', scrollbarWidth: 'none',
    }}>{children}</div>
  )
}

function ThumbCard({ title, sub, image, wide, locked, onClick }: {
  title: string; sub?: string; image: string; wide?: boolean; locked?: boolean; onClick?: () => void
}) {
  return (
    <button onClick={onClick} style={{
      flex: `0 0 ${wide ? 252 : 148}px`, height: wide ? 158 : 174, border: 'none',
      borderRadius: 18, overflow: 'hidden', position: 'relative', textAlign: 'left',
      padding: 0, background: P.card, boxShadow: P.shadow, scrollSnapAlign: 'start',
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <img src={image} alt="" style={{ width: '100%', height: wide ? 98 : 104, objectFit: 'cover', display: 'block', filter: locked ? 'grayscale(.35)' : undefined }} />
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 850, color: P.ink, lineHeight: 1.25 }}>{title}</div>
        {sub && <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: P.faint, lineHeight: 1.25 }}>{sub}</div>}
      </div>
      {locked && <LockBadge />}
    </button>
  )
}

function LearnLessonCard({ lesson, onOpen, onLocked }: { lesson: LessonItem; onOpen: (l: LessonItem) => void; onLocked: () => void }) {
  return (
    <button onClick={() => lesson.locked ? onLocked() : onOpen(lesson)} style={{
      flex: '0 0 156px',
      aspectRatio: '3 / 2',
      border: 'none',
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      padding: 0,
      background: P.card,
      boxShadow: P.shadow,
      scrollSnapAlign: 'start',
      fontFamily: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
    }}>
      <img src={lesson.image} alt="" style={{
        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        filter: lesson.locked ? 'grayscale(.25)' : undefined,
        transform: 'scale(1.02)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(33,28,50,0) 22%, rgba(33,28,50,.80) 100%)' }} />
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 11, color: '#fff' }}>
        <div style={{ fontSize: 10.5, fontWeight: 900, opacity: .82, textTransform: 'uppercase' }}>{lesson.series}</div>
        <div style={{
          marginTop: 3, fontSize: 14.5, lineHeight: 1.18, fontWeight: 900,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
        }}>{lesson.title}</div>
      </div>
      {!lesson.locked && (
        <span style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.90)', color: P.accent, display: 'grid', placeItems: 'center' }}>
          <Play size={14} fill="currentColor" />
        </span>
      )}
      {lesson.locked && <LockBadge />}
    </button>
  )
}

function PracticeSkillCard({ item, onClick }: {
  item: { name: string; image: string }
  onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      flex: '0 0 124px', height: 132, border: 'none', borderRadius: 18, overflow: 'hidden',
      background: P.card, boxShadow: P.shadow, position: 'relative', textAlign: 'left',
      padding: 0, fontFamily: 'inherit', cursor: 'pointer', scrollSnapAlign: 'start',
    }}>
      <img src={item.image} alt="" style={{ width: '100%', height: 78, objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: '9px 10px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 950, color: P.ink, lineHeight: 1.18 }}>{item.name}</div>
      </div>
    </button>
  )
}

function SongPracticeCard({ song, onClick }: {
  song: { title: string; meta: string; image: string }
  onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      flex: '0 0 158px', height: 122, border: 'none', borderRadius: 18, overflow: 'hidden',
      background: P.card, boxShadow: P.shadow, position: 'relative', textAlign: 'left',
      padding: 0, fontFamily: 'inherit', cursor: 'pointer', scrollSnapAlign: 'start',
    }}>
      <img src={song.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(33,28,50,.05), rgba(33,28,50,.78))' }} />
      <div style={{ position: 'absolute', left: 11, right: 11, bottom: 10, color: '#fff' }}>
        <div style={{ fontSize: 14, lineHeight: 1.18, fontWeight: 950, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{song.title}</div>
        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 750, opacity: .82 }}>{song.meta}</div>
      </div>
    </button>
  )
}

function ToolAppIcon({ tool, onClick }: {
  tool: { name: string; short: string; image?: string; icon: string }
  onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      border: 'none', background: 'transparent', padding: 0, minWidth: 0,
      display: 'grid', justifyItems: 'center', gap: 7, fontFamily: 'inherit',
      color: P.ink, cursor: 'pointer',
    }}>
      <span style={{
        width: 58, height: 58, borderRadius: 18, background: P.card,
        display: 'grid', placeItems: 'center', boxShadow: P.shadowSoft,
        border: `1px solid ${P.border}`, overflow: 'hidden',
      }}>
        {tool.image
          ? <img src={tool.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <ToolGlyph icon={tool.icon} />}
      </span>
      <span style={{ fontSize: 11.5, lineHeight: 1.15, fontWeight: 800, color: P.muted, minHeight: 27, display: 'flex', alignItems: 'flex-start', textAlign: 'center' }}>{tool.short}</span>
    </button>
  )
}

function ToolGlyph({ icon }: { icon: string }) {
  const color = P.accent
  if (icon === 'tap') return <Dumbbell size={24} color={color} strokeWidth={1.9} />
  if (icon === 'tempo' || icon === 'metro') return <Radio size={24} color={color} strokeWidth={1.9} />
  if (icon === 'chord' || icon === 'board') return <Music2 size={25} color={color} strokeWidth={1.9} />
  if (icon === 'note') return <BookOpen size={24} color={color} strokeWidth={1.9} />
  if (icon === 'bms') return <Play size={24} color={color} strokeWidth={1.9} />
  return <Music2 size={24} color={color} strokeWidth={1.9} />
}

function LockBadge() {
  return (
    <span style={{ position: 'absolute', top: 10, right: 10, width: 31, height: 31, borderRadius: 12, background: 'rgba(33,28,50,.72)', color: '#fff', display: 'grid', placeItems: 'center' }}>
      <Lock size={15} />
    </span>
  )
}

function PackageSwitch({ pkg, setPkg }: { pkg: PackageCode; setPkg: (p: PackageCode) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, background: P.soft, borderRadius: 14, padding: 4 }}>
      {(Object.keys(packages) as PackageCode[]).map(code => (
        <button key={code} onClick={() => setPkg(code)} style={{
          border: 'none', borderRadius: 11, padding: '8px 10px', background: pkg === code ? P.card : 'transparent',
          color: pkg === code ? P.accent : P.muted, boxShadow: pkg === code ? P.shadowSoft : 'none',
          fontSize: 12, fontWeight: 850, cursor: 'pointer', fontFamily: 'inherit',
        }}>{packages[code].price.replace('/tháng', '')}</button>
      ))}
    </div>
  )
}

export default function AppV2Preview() {
  const [tab, setTab] = useState<Tab>('home')
  const [pkg, setPkg] = useState<PackageCode>('basic')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [selectedZooms, setSelectedZooms] = useState<number[]>([])
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null)
  const [activePractice, setActivePractice] = useState<{ name: string; target: string } | null>(null)
  const pack = packages[pkg]
  const teacherQuota = teacherEntitlements[pkg]
  const selectedThisPeriod = selectedZooms.length
  const usedSessions = teacherQuota.usedSessions + selectedThisPeriod
  const sessionLimit = typeof teacherQuota.sessionsPerPeriod === 'number' ? teacherQuota.sessionsPerPeriod : null
  const isUnlimited = sessionLimit === null
  const remainingSessions = sessionLimit === null ? Infinity : Math.max(sessionLimit - usedSessions, 0)
  const hasTeacherAccess = sessionLimit === null || sessionLimit > 0
  const maxLibraryRank = pack.rank

  const openPaywall = () => setSheet('paywall')
  const openLesson = (lesson: LessonItem) => {
    setActiveLesson(lesson)
    setSheet('lesson')
  }
  const openPracticeTarget = (item: { name: string; target?: string; route?: string }) => {
    if (item.route) {
      window.location.href = item.route
      return
    }
    setActivePractice({ name: item.name, target: item.target ?? 'presentation' })
    setSheet('practice')
  }
  const choosePackage = (code: PackageCode) => {
    setPkg(code)
    setSelectedZooms([])
  }
  const pickZoom = (index: number) => {
    if (selectedZooms.includes(index)) {
      setSheet('zoom')
      return
    }
    if (!hasTeacherAccess || remainingSessions <= 0) {
      openPaywall()
      return
    }
    setSelectedZooms([...selectedZooms, index])
    setSheet('zoom')
  }

  return (
    <div style={{
      minHeight: '100dvh', background: P.bg, color: P.ink,
      fontFamily: '"Be Vietnam Pro", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100dvh', background: P.bg,
        position: 'relative', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(221,216,236,.75)',
      }}>
        <main style={{ height: '100dvh', overflowY: 'auto', paddingBottom: 92 }}>
          <div style={{ padding: 'max(18px, calc(env(safe-area-inset-top, 0px) + 10px)) 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 14, background: P.accent, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: P.shadow }}>
                <Music2 size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: P.faint, fontWeight: 700 }}>APP CLASS 2.0 · MOCK</div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>Thầy Văn Anh Guitar</div>
              </div>
            </div>
            <PackageSwitch pkg={pkg} setPkg={choosePackage} />
          </div>

          {tab === 'home' && (
            <>
              <div style={{ padding: '24px 18px 0', textAlign: 'left' }}>
                <div style={{ fontSize: 28, lineHeight: 1.18, fontWeight: 900, letterSpacing: 0 }}>
                  Chào anh,<br />hôm nay chơi Guitar một chút nhé.
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: P.muted, lineHeight: 1.55 }}>
                  Mở app là có thứ để luyện, xem và hỏi Thầy. Học vẫn ở phía sau, rất chặt.
                </div>
              </div>
              <Section title="Luyện ngay" action="vuốt để xem">
                <Rail>{quickTools.map(t => <ThumbCard key={t.title} title={t.title} sub={t.sub} image={t.image} onClick={() => setTab('practice')} />)}</Rail>
              </Section>
              <Section title="Xem cùng Thầy" action="Kho bài giảng" >
                <Rail>{videos.map(v => <ThumbCard key={v.title} title={v.title} sub={v.tag} image={v.image} wide onClick={() => setSheet('library')} />)}</Rail>
              </Section>
              <Section title="Tiếp tục hành trình">
                <div style={{ margin: '0 18px', background: P.card, borderRadius: 20, padding: 16, boxShadow: P.shadow, textAlign: 'left', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <img src="/app-khoahoc.png" alt="" style={{ width: 82, height: 82, borderRadius: 16, objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: P.accent }}>Đệm hát</div>
                    <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25, marginTop: 4 }}>Chuyển hợp âm trong nhịp</div>
                    <button onClick={() => openLesson(learnRows[0].lessons[1])} style={{ marginTop: 12, border: 'none', background: P.accent, color: '#fff', borderRadius: 12, padding: '9px 14px', fontSize: 13, fontWeight: 850 }}>Tiếp tục</button>
                  </div>
                </div>
              </Section>
            </>
          )}

          {tab === 'learn' && (
            <>
              <Header title="Học" subtitle="Nhìn thumbnail, vuốt ngang, bấm một bài rồi học." icon={<BookOpen size={21} />} />
              {learnRows.map(row => (
                <Section key={row.title} title={row.title} action={row.hint}>
                  <Rail>{row.lessons.map(lesson => (
                    <LearnLessonCard key={lesson.id} lesson={lesson} onOpen={openLesson} onLocked={() => lesson.series === 'Solo' ? setSheet('solo') : setSheet('paywall')} />
                  ))}</Rail>
                </Section>
              ))}
            </>
          )}

          {tab === 'practice' && (
            <>
              <Header title="Tập" subtitle="Mở ra, chọn một thứ, tập ngay." icon={<Dumbbell size={21} />} />
              <section style={{ margin: '10px 18px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 900, textAlign: 'left', marginBottom: 10 }}>Tập tiếp</div>
                <button onClick={() => openPracticeTarget(practiceSkills[0])} style={{
                  width: '100%', border: 'none', borderRadius: 20, background: P.card, boxShadow: P.shadow,
                  padding: 12, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}>
                  <img src="/app-luyentap.png" alt="" style={{ width: 68, height: 58, objectFit: 'cover', borderRadius: 16 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 950, color: P.ink }}>Luyện ngón</span>
                    <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, color: P.muted, fontWeight: 700 }}>5 phút tay trái</span>
                  </span>
                  <span style={{ background: P.accent, color: '#fff', borderRadius: 13, padding: '10px 13px', fontSize: 13, fontWeight: 900 }}>Tập</span>
                </button>
              </section>

              <Section title="Tập kỹ năng">
                <Rail>{practiceSkills.map(skill => (
                  <PracticeSkillCard key={skill.id} item={skill} onClick={() => openPracticeTarget(skill)} />
                ))}</Rail>
              </Section>

              <Section title="Bài hát đang tập">
                <Rail>
                  {practiceSongs.map(song => (
                    <SongPracticeCard key={song.title} song={song} onClick={() => openPracticeTarget({ name: song.title, route: song.route })} />
                  ))}
                  <button onClick={() => openPracticeTarget({ name: 'Chọn bài hát', route: '/song-builder?standalone=1' })} style={{
                    flex: '0 0 118px', height: 122, border: `1.5px dashed ${P.border}`, borderRadius: 18,
                    background: P.card, color: P.accent, fontFamily: 'inherit', fontWeight: 950,
                    display: 'grid', placeItems: 'center', boxShadow: P.shadowSoft, cursor: 'pointer',
                  }}>+<br />Chọn bài</button>
                </Rail>
              </Section>

              <section style={{ marginTop: 24, padding: '0 18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.2, fontWeight: 900, color: P.ink }}>Công cụ</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '15px 10px' }}>
                  {realTools.map(tool => (
                    <ToolAppIcon key={tool.name} tool={tool} onClick={() => openPracticeTarget({ name: tool.name, route: tool.route })} />
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === 'teacher' && (
            <>
              <Header title="Thầy" subtitle="Nhắn Thầy, chọn buổi, vào nhóm." icon={<MessageCircle size={21} />} />
              <TeacherBenefit icon={<MessageCircle />} title="Gặp Thầy qua Zalo" locked={!hasTeacherAccess} button="Nhắn Thầy" onClick={hasTeacherAccess ? () => setSheet('benefits') : openPaywall} />
              <Section title="Buổi thực hành cùng Thầy">
                <div style={{ padding: '0 18px', display: 'grid', gap: 10 }}>
                  <QuotaCard quota={teacherQuota} usedSessions={usedSessions} remainingSessions={remainingSessions} />
                  {zooms.map((z, i) => (
                    <PracticeSessionCard
                      key={z.title}
                      session={z}
                      selected={selectedZooms.includes(i)}
                      quotaFull={!isUnlimited && remainingSessions <= 0}
                      onClick={() => pickZoom(i)}
                    />
                  ))}
                </div>
              </Section>
              <TeacherBenefit icon={<Radio />} title={pkg === 'advanced' ? 'Nhóm thực hành Nâng cao' : 'Nhóm thực hành Cơ bản'} locked={!hasTeacherAccess} button="Vào nhóm" onClick={hasTeacherAccess ? () => setSheet('benefits') : openPaywall} />
            </>
          )}

          {tab === 'me' && (
            <>
              <Header title="Tôi" subtitle="Hành trình, gói học và tài khoản." icon={<UserRound size={21} />} />
              <div style={{ margin: '0 18px', background: P.card, borderRadius: 22, boxShadow: P.shadow, padding: 18, textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <img src="/thay-van-anh.png" alt="" style={{ width: 68, height: 68, borderRadius: 22, objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900 }}>Anh học viên</div>
                    <div style={{ fontSize: 13, color: P.muted }}>Đang đi qua Đệm hát</div>
                  </div>
                </div>
                <div style={{ marginTop: 18, height: 9, background: P.soft, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: '42%', height: '100%', background: P.accent }} /></div>
                <div style={{ marginTop: 8, color: P.muted, fontSize: 13 }}>Tiến trình xem ở tab Tôi, không nhồi vào Học.</div>
              </div>
              <div style={{ margin: '14px 18px 0', background: P.card, borderRadius: 20, boxShadow: P.shadow, padding: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Crown color={P.accent} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: P.muted, fontWeight: 750 }}>Gói của tôi</div>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>{pack.label} · {pack.price}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  <button onClick={() => setSheet('benefits')} style={smallBtn(false)}>Xem quyền lợi</button>
                  <button onClick={openPaywall} style={smallBtn(true)}>Nâng cấp</button>
                </div>
              </div>
              {['Tài khoản', 'Cài đặt', 'Chính sách bảo mật'].map(label => (
                <div key={label} style={{ margin: '10px 18px 0', background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 15, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                  <Settings size={18} color={P.faint} /><span style={{ flex: 1, fontWeight: 800 }}>{label}</span><ChevronRight size={18} color={P.faint} />
                </div>
              ))}
            </>
          )}
        </main>

        <nav style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10,
          display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4,
          padding: '8px 10px max(10px, env(safe-area-inset-bottom))',
          background: 'rgba(255,255,255,.92)', borderTop: `1px solid ${P.border}`,
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        }}>
          {[
            ['home', 'Trang chủ', Home],
            ['learn', 'Học', BookOpen],
            ['practice', 'Tập', Dumbbell],
            ['teacher', 'Thầy', MessageCircle],
            ['me', 'Tôi', CircleUserRound],
          ].map(([id, label, I]) => {
            const active = tab === id
            const Icon = I as typeof Home
            return (
              <button key={id as string} onClick={() => setTab(id as Tab)} style={{
                border: 'none', borderRadius: 14, background: active ? P.soft : 'transparent',
                color: active ? P.accent : P.faint, padding: '8px 2px', display: 'grid',
                justifyItems: 'center', gap: 4, fontFamily: 'inherit', cursor: 'pointer',
              }}>
                <Icon size={22} strokeWidth={1.8} />
                <span style={{ fontSize: 10.5, fontWeight: active ? 900 : 700 }}>{label as string}</span>
              </button>
            )
          })}
        </nav>

        {sheet && (
          <BottomSheet onClose={() => setSheet(null)}>
            {sheet === 'solo' && <SoloSheet onClose={() => setSheet(null)} />}
            {sheet === 'paywall' && <Paywall current={pkg} onPick={(p) => setPkg(p)} />}
            {sheet === 'library' && <LibrarySheet maxRank={maxLibraryRank} onLocked={openPaywall} />}
            {sheet === 'lesson' && <LessonShell lesson={activeLesson} onClose={() => setSheet(null)} />}
            {sheet === 'practice' && <PracticeShell item={activePractice} onClose={() => setSheet(null)} />}
            {sheet === 'zoom' && <ZoomSheet />}
            {sheet === 'benefits' && <BenefitsSheet pkg={pkg} />}
          </BottomSheet>
        )}
      </div>
    </div>
  )
}

function Header({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div style={{ padding: '26px 18px 8px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton>{icon}</IconButton>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, fontWeight: 950, color: P.ink }}>{title}</h1>
          <div style={{ marginTop: 5, color: P.muted, fontSize: 13.5, lineHeight: 1.45 }}>{subtitle}</div>
        </div>
      </div>
    </div>
  )
}

function TeacherBenefit({ icon, title, locked, button, onClick }: { icon: React.ReactNode; title: string; locked: boolean; button: string; onClick: () => void }) {
  return (
    <div style={{ margin: '14px 18px 0', background: P.card, borderRadius: 20, padding: 14, boxShadow: P.shadow, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', opacity: locked ? .82 : 1 }}>
      <div style={{ width: 44, height: 44, borderRadius: 15, background: P.soft, color: P.accent, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
      </div>
      <button onClick={onClick} style={{ border: 'none', background: locked ? P.soft : P.accent, color: locked ? P.accent : '#fff', borderRadius: 12, padding: '9px 12px', fontWeight: 850, fontFamily: 'inherit' }}>{locked ? 'Xem gói' : button}</button>
    </div>
  )
}

function QuotaCard({ quota, usedSessions, remainingSessions }: {
  quota: PracticeQuota
  usedSessions: number
  remainingSessions: number
}) {
  const total = quota.sessionsPerPeriod === 'unlimited' ? null : quota.sessionsPerPeriod
  const unlimited = total === null
  const used = unlimited ? 0 : Math.min(usedSessions, total)
  return (
    <div style={{
      background: P.card, border: `1px solid ${P.border}`, boxShadow: P.shadowSoft,
      borderRadius: 18, padding: 14, textAlign: 'left',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ color: P.accent, fontSize: 13, fontWeight: 950 }}>
            {unlimited ? 'Không giới hạn' : `${total} buổi / tháng`}
          </div>
          <div style={{ color: P.muted, fontSize: 12.5, fontWeight: 750, marginTop: 3 }}>
            {unlimited ? 'Chọn buổi phù hợp trong lịch' : `Đã dùng ${used}/${total}`}
          </div>
        </div>
        <div style={{ color: P.ink, fontSize: 13, fontWeight: 900 }}>
          {unlimited ? quota.period : `Còn ${remainingSessions}`}
        </div>
      </div>
      {!unlimited && (
        <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
          {Array.from({ length: total ?? 0 }).map((_, i) => (
            <span key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < used ? P.accent : P.soft,
              border: `1px solid ${i < used ? P.accent : P.border}`,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

function PracticeSessionCard({ session, selected, quotaFull, onClick }: {
  session: { day: string; time: string; title: string; mode: string }
  selected: boolean
  quotaFull: boolean
  onClick: () => void
}) {
  const buttonLabel = selected ? 'Đã chọn' : quotaFull ? 'Nâng gói' : 'Chọn buổi'
  return (
    <div style={{
      background: P.card,
      border: `1px solid ${selected ? P.accent : P.border}`,
      boxShadow: selected ? P.shadow : P.shadowSoft,
      borderRadius: 18,
      padding: 14,
      textAlign: 'left',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: P.accent, fontSize: 12.5, fontWeight: 900 }}>{session.day} · {session.time}</div>
        <div style={{ fontSize: 15.5, fontWeight: 950, marginTop: 4, lineHeight: 1.25 }}>{session.title}</div>
        <div style={{ color: P.muted, fontSize: 12.5, marginTop: 3, fontWeight: 700 }}>{session.mode}</div>
      </div>
      <button onClick={onClick} style={{
        border: 'none',
        borderRadius: 13,
        padding: '10px 12px',
        minWidth: 82,
        background: selected ? P.soft : quotaFull ? P.soft : P.accent,
        color: selected || quotaFull ? P.accent : '#fff',
        fontWeight: 900,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}>{buttonLabel}</button>
    </div>
  )
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(33,28,50,.36)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '86dvh', overflowY: 'auto', background: P.card, borderRadius: '26px 26px 0 0', padding: '12px 18px max(22px, env(safe-area-inset-bottom))', boxShadow: '0 -18px 48px rgba(33,28,50,.20)' }}>
        <div style={{ width: 42, height: 5, borderRadius: 999, background: P.border, margin: '0 auto 18px' }} />
        {children}
      </div>
    </div>
  )
}

function SoloSheet({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>Solo sẽ mở sau.</h2>
      <p style={sheetText()}>Solo sẽ mở khi bạn đạt đủ nền tảng Đệm hát và Tỉa nốt.</p>
      <button onClick={onClose} style={primaryBtn()}>Tiếp tục học</button>
    </div>
  )
}

function LessonShell({ lesson, onClose }: { lesson: LessonItem | null; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>{lesson?.title ?? 'Bài học'}</h2>
      <p style={sheetText()}>Shell mỏng mô phỏng mở lesson cũ. Bước này không redesign lesson engine, không ghi progress/XP.</p>
      <div style={{ marginTop: 14, borderRadius: 18, overflow: 'hidden', background: '#111827', color: '#fff' }}>
        <img src={lesson?.image ?? '/app-khoahoc.png'} alt="" style={{ width: '100%', height: 158, objectFit: 'cover', opacity: .78, display: 'block' }} />
        <div style={{ padding: 15 }}>
          <div style={{ fontSize: 12, fontWeight: 850, opacity: .75 }}>{lesson?.series ?? 'Class 2.0'}</div>
          <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>Video / nội dung / bài tập của lesson hiện tại sẽ nằm ở đây.</div>
        </div>
      </div>
      <button onClick={onClose} style={primaryBtn()}>Đóng bài học</button>
    </div>
  )
}

function PracticeShell({ item, onClose }: { item: { name: string; target: string } | null; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>{item?.name ?? 'Bài tập'}</h2>
      <p style={sheetText()}>Nội dung bài tập hiện có sẽ mở tại đây.</p>
      <button onClick={onClose} style={primaryBtn()}>Đóng</button>
    </div>
  )
}

function Paywall({ current, onPick }: { current: PackageCode; onPick: (p: PackageCode) => void }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>Chọn gói học phù hợp</h2>
      <p style={sheetText()}>Prototype chỉ mô phỏng CTA. Chưa nối Apple IAP hoặc Google Play Billing.</p>
      {(Object.keys(packages) as PackageCode[]).map(code => {
        const isBasic = code === 'basic'
        return (
          <button key={code} onClick={() => onPick(code)} style={{
            width: '100%', marginTop: 10, border: `1.5px solid ${isBasic ? P.accent : P.border}`,
            background: isBasic ? P.soft : P.card, borderRadius: 18, padding: 15,
            textAlign: 'left', fontFamily: 'inherit', boxShadow: isBasic ? P.shadow : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div><b style={{ fontSize: 16 }}>{packages[code].label.toUpperCase()}</b><div style={{ color: P.muted, fontSize: 13, marginTop: 4 }}>{code === 'start' ? 'Tự học khởi đầu' : code === 'basic' ? 'Zalo + Zoom + kho căn bản' : 'Chiều sâu nâng cao + nhóm nâng cao'}</div></div>
              <div style={{ color: P.accent, fontWeight: 950 }}>{packages[code].price}</div>
            </div>
            <div style={{ marginTop: 10, color: current === code ? P.green : P.accent, fontSize: 13, fontWeight: 900 }}>{current === code ? 'Đang xem mock gói này' : 'Chọn gói này'}</div>
          </button>
        )
      })}
    </div>
  )
}

function LibrarySheet({ maxRank, onLocked }: { maxRank: number; onLocked: () => void }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>Kho bài giảng / Xem</h2>
      <p style={sheetText()}>Xem là khám phá. Học là mở một bài trực tiếp.</p>
      {libraryRows.map(row => (
        <div key={row.title} style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
            <span>{row.title}</span>{row.minRank > maxRank && <span style={{ color: P.orange, fontSize: 12 }}>Vượt gói</span>}
          </div>
          <Rail>{row.items.map(v => <ThumbCard key={row.title + v.title} title={v.title} sub={row.minRank > maxRank ? 'Cần nâng cấp' : v.tag} image={v.image} wide locked={row.minRank > maxRank} onClick={row.minRank > maxRank ? onLocked : undefined} />)}</Rail>
        </div>
      ))}
    </div>
  )
}

function ZoomSheet() {
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>✓ Bạn đã chọn buổi này</h2>
      <p style={sheetText()}>Mock state local. Chưa nối DB lịch thật, chưa tạo đăng ký Zoom thật.</p>
      <button style={primaryBtn()}>Vào Zoom</button>
    </div>
  )
}

function BenefitsSheet({ pkg }: { pkg: PackageCode }) {
  const lines = pkg === 'start'
    ? ['Tự học theo phạm vi Khởi đầu', 'Chưa có quyền Thầy', 'Kho bài giảng giới hạn']
    : pkg === 'basic'
    ? ['Zalo với Thầy', '4 buổi thực hành online/tháng', 'Nhóm thực hành Cơ bản', 'Kho bài giảng Căn bản']
    : ['Zalo với Thầy', '4 buổi thực hành online/tháng', 'Nhóm thực hành Nâng cao', 'Kho bài giảng Căn bản đến Nâng cao']
  return (
    <div style={{ textAlign: 'left' }}>
      <h2 style={sheetTitle()}>Quyền lợi gói {packages[pkg].label}</h2>
      {lines.map(x => <div key={x} style={{ display: 'flex', gap: 10, marginTop: 12, color: P.muted, fontWeight: 800 }}><Check size={18} color={P.green} />{x}</div>)}
    </div>
  )
}

function sheetTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 950, color: P.ink }
}

function sheetText(): React.CSSProperties {
  return { margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: P.muted }
}

function primaryBtn(): React.CSSProperties {
  return { width: '100%', marginTop: 18, border: 'none', background: P.accent, color: '#fff', borderRadius: 15, padding: '14px 16px', fontSize: 15, fontWeight: 900, fontFamily: 'inherit' }
}

function smallBtn(primary: boolean): React.CSSProperties {
  return { border: primary ? 'none' : `1px solid ${P.border}`, background: primary ? P.accent : P.soft, color: primary ? '#fff' : P.accent, borderRadius: 13, padding: '12px', fontWeight: 900, fontFamily: 'inherit' }
}
