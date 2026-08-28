import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import FlowPlayer from './FlowPlayer'
import FingerExercise from './FingerExercise'
import ScaleExercise from './ScaleExercise'
import ArpeggioExercise from './ArpeggioExercise'
import GrooveExercise from './groove/GrooveExercise'
import ChordDiagramIcon from './ChordDiagramIcon'
import SongBuilderPage from './SongBuilderPage'
import PianoJourney from './PianoJourney'
import Metronome from './Metronome'
import { QuizViewer } from './components/QuizViewer'
import { isNativeIAP } from './iap'
import { NATIVE_LESSONS } from './elearn/nativeLessons'
import ChordStrumPlayer from './elearn/ChordStrumPlayer'
import { parseStrumConfig, configToSong } from './StrumConfigEditor'
import ElearnLessonView from './elearn/ElearnLessonView'
import { missingPrereqs, tenNangLuc } from './hanhtrinh'
import { NavIcon } from './navIcons'
import LivePageView, { type LivePage } from './live/LivePages'
import {
  ENTITLEMENT_TIER_LABEL,
  type EntitlementTier,
  normalizeEntitlementTier,
  resolveCourseAccess,
  resolveLessonAccess,
} from './contentAccess'

// ─── Light theme tokens ────────────────────────────────────────────────────────
const L = {
  bg:         '#F0F2F5',
  surface:    '#FFFFFF',
  surface2:   '#F7F8FA',
  border:     '#E8EAF0',
  p1:         '#4338CA',
  p2:         '#EEF2FF',
  p3:         '#C7D2FE',
  a1:         '#EA580C',
  a2:         '#FFF7ED',
  a3:         '#FED7AA',
  t1:         '#111827',
  t2:         '#6B7280',
  t3:         '#9CA3AF',
  tinv:       '#FFFFFF',
  green:      '#16A34A',
  greenBg:    '#F0FDF4',
  gold:       '#D97706',
  goldBg:     '#FFFBEB',
  shadow:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  shadowLg:   '0 8px 24px rgba(0,0,0,0.10)',
}

// Mở link ngoài app (Zalo/Facebook): '_system' để iOS đẩy ra trình duyệt/app thật, web fallback '_blank'.
const openExternal = (u: string) => { try { window.open(u, '_system') } catch { window.open(u, '_blank') } }

// Tên khoá/bài tiếng Việt thường dài hơn bề ngang điện thoại. Cắt cụt 1 dòng ("Đệm Hát Trình …")
// làm học viên không đọc được tên đầy đủ → cho xuống tối đa 2 dòng, chỉ cắt khi thật sự quá dài.
const clamp1: React.CSSProperties = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, overflow: 'hidden' }
const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }
const clamp3: React.CSSProperties = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }

type Tab    = 'home' | 'hoc' | 'tap' | 'teacher' | 'me'
type Screen = 'home' | 'courses' | 'lesson' | 'journey'
// View-model bài học phẳng cho MỘT HÀNH TRÌNH NGANG (aggregation layer, KHÔNG đổi canonical DB).
// Level = course trong môn (sort_order); Chương = module (order_index); Bài = lesson (order_index).
interface JourneyLesson {
  id: string; title: string
  courseId: string; courseName: string; courseCode: string | null
  moduleId: string; moduleName: string; moduleLevel: number | null
  subjectKey: string
  ytId: string | null
  // các trường access để resolveLessonAccess hoạt động (mode/tier/visibility/availability/allow_preview)
  lesson_type?: string | null; content_url?: string | null; tier?: string | null
  access_policy_mode?: string | null; required_tier?: string | null
  visibility?: string | null; availability?: string | null; allow_preview?: boolean | null
}

interface Student    { id: string; full_name: string; email: string | null; level: string | null; display_name?: string | null; avatar_url?: string | null; honor?: string | null; enrolled_at?: string | null }
interface DBTool     { id: string; icon: string; name: string; description: string | null; category: string; route: string; tier: string; enabled: boolean; status?: string; order_index?: number }

// Mapping: exercise timer id → edu_tools id (category 'Bài luyện')
const EX_TOOL_ID: Record<string, string> = {
  finger:    'bai-luyen-ngon',
  scale:     'bai-luyen-am-giai',
  arpeggio:  'bai-luyen-arpeggio',
  metronome: 'bai-luyen-metronome',
  ear:       'bai-luyen-cam-am',
}
// Reverse: edu_tools id → exercise short id (để lesson tool nhận ra bài luyện)
const TOOL_TO_EX: Record<string, string> = Object.fromEntries(
  Object.entries(EX_TOOL_ID).map(([exId, toolId]) => [toolId, exId])
)
const COURSE_SELECT = 'id,name,type,track,icon,image_url,status,sort_order,is_free,code,access_policy_enabled,required_tier,visibility,availability,allow_preview'
const COURSE_REL_SELECT = `id,name,type,track,icon,image_url,status,sort_order,is_free,code,access_policy_enabled,required_tier,visibility,availability,allow_preview`
type CourseSummary = Enrollment['course']
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: {
    id: string; name: string; type: string; track: string | null
    icon?: string | null; image_url?: string | null; status?: string; sort_order?: number; code?: string | null
    is_free?: boolean | null; access_policy_enabled?: boolean | null; required_tier?: string | null
    visibility?: string | null; availability?: string | null; allow_preview?: boolean | null
  }
}
interface Module { id: string; name: string; order_index: number }
interface Lesson {
  id: string; module_id: string; title: string; lesson_type: string
  content_url: string | null; description: string | null; content: string | null
  tools: string[]; order_index: number; tier?: string
  access_policy_mode?: string | null; required_tier?: string | null
  visibility?: string | null; availability?: string | null; allow_preview?: boolean | null
}

function uname(s: Student) {
  if (s.display_name?.trim()) return s.display_name.trim()
  const n = s.full_name ?? ''
  return (n.includes('@') ? n.split('@')[0] : n.split(' ').pop() ?? n)
}
function getYtId(url: string | null) {
  return url?.match(/(?:v=|youtu\.be\/|shorts\/)([^&?\s]+)/)?.[1] ?? null
}

// Chuẩn hóa URL Canva → dạng .../view?embed (dùng cho iframe)
function normalizeCanvaUrl(raw: string): string {
  const iframeSrc = raw.match(/src="([^"]*canva\.com[^"]*)"/)
  const s = (iframeSrc?.[1] ?? (raw.trim().startsWith('<') ? '' : raw)).trim()
  if (!s || !s.includes('canva.com')) return raw.trim()
  let base = s.split('?')[0].split('#')[0].replace(/\/+$/, '')
  base = base.replace(/\/watch(\/.*)?$/, '').replace(/\/+$/, '')
  const viewBase = base.endsWith('/view') ? base
    : base.includes('/view') ? base.substring(0, base.lastIndexOf('/view') + 5)
    : base + '/view'
  return viewBase + '?embed'
}
const LEVEL_VI: Record<string, string> = {
  beginner: 'Sơ cấp', elementary: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao',
}
const TIER_ORDER = ['free', 'basic', 'standard', 'pro']
const LEVEL_TIER: Record<string, string> = {
  beginner: 'free', elementary: 'basic', intermediate: 'standard', advanced: 'pro'
}
const TIER_VI: Record<string, string> = {
  free: 'Miễn phí', basic: 'Cơ bản', standard: 'Nâng cao', pro: 'Pro'
}

// ── Hệ thống danh hiệu ──────────────────────────────────────────────────────
const HONOR_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  none:     { label: '',               icon: '',   color: '#4338CA', bg: '#4338CA' },
  bronze:   { label: 'Bronze Member',  icon: '🥉', color: '#92400E', bg: '#B45309' },
  silver:   { label: 'Silver Member',  icon: '🥈', color: '#374151', bg: '#4B5563' },
  gold:     { label: 'Gold Member',    icon: '🥇', color: '#92400E', bg: '#D97706' },
  platinum: { label: 'Platinum',       icon: '💎', color: '#4C1D95', bg: '#7C3AED' },
  diamond:  { label: 'Diamond',        icon: '👑', color: '#0C4A6E', bg: '#0891B2' },
}

// Tính Year Member từ enrolled_at
function getYearBadge(enrolledAt?: string | null): string | null {
  if (!enrolledAt) return null
  const years = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / (365.25 * 24 * 3600 * 1000))
  if (years < 1) return null
  return years === 1 ? '1-Year Member' : `${years}-Year Member`
}

function CourseLogo({ course: courseInput, size = 44, radius = 12, bg }: { course?: { type?: string | null; icon?: string | null; image_url?: string | null } | null; size?: number; radius?: number; bg?: string }) {
  // Dữ liệu legacy/localStorage có thể trỏ tới khoá không còn tồn tại → course null. Không bao giờ crash vì logo.
  const course = courseInput ?? { type: '', icon: null, image_url: null }
  const fallback = course.icon || (course.type === 'canh_cua' ? '🔑' : '🎸')
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg ?? (course.type === 'canh_cua' ? '#FFF7ED' : '#EEF2FF'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0, overflow: 'hidden' }}>
      {course.image_url
        ? <img src={course.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : fallback}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMP HOME FEED MOCK — replace with canonical feed source (Phase 2: community_feed_items).
// CHỈ để chốt UI "Bản tin hôm nay". KHÔNG phải production data, KHÔNG ghi DB,
// KHÔNG tên người thật, KHÔNG link thật. Component đọc mảng này để Phase 2 chỉ thay data source.
// ─────────────────────────────────────────────────────────────────────────────
const HOME_FEED_MOCK: { type: string; kicker: string; title: string; summary: string; icon: string; tone: string }[] = [
  { type: 'story',         kicker: 'Câu chuyện',      title: 'Từ chàng nhân viên văn phòng đến sân khấu', summary: 'Hành trình một năm cầm đàn của một học viên.', icon: '📖', tone: '#7C3AED' },
  { type: 'class_start',   kicker: 'Lớp học',         title: 'Lớp Đệm hát K3 vừa khai giảng',             summary: 'Một chặng mới bắt đầu cùng nhau.',            icon: '🎓', tone: '#0891B2' },
  { type: 'student_video', kicker: 'Video học viên',  title: 'Một màn biểu diễn mới từ cộng đồng',         summary: 'Xem cộng đồng đang sống cùng âm nhạc.',       icon: '🎥', tone: '#EA580C' },
]

const LEARN_TRACKS: { key: string; title: string; hint: string }[] = [
  { key: 'dem_hat', title: 'Đệm hát', hint: 'Acoustic · rhythm · biểu diễn' },
  { key: 'tia_not', title: 'Tỉa nốt', hint: 'Melody · fretboard · bản nhạc' },
  { key: 'solo', title: 'Solo', hint: 'Fretboard · stage · năng lượng' },
  { key: 'nhac_ly', title: 'Nhạc lý / Cảm âm', hint: 'Notation · lắng nghe · khoảng cách' },
]

// ── Curriculum mapping: course cũ = Level của MÔN (nguồn thứ tự + gộp Nhập Môn vào Tỉa nốt) ──
// Stable key = course_id (KHÔNG so tên runtime). Level đồng bộ với edu_modules.level đã backfill.
// Course trong đây được coi như Level của subject tương ứng; tên course KHÔNG hiện cho học viên.
const JOURNEY_CURRICULUM: { subject: string; courseId: string; level: number }[] = [
  // Đệm hát
  { subject: 'dem_hat', courseId: '65bccb3e-4740-4103-b1fa-c2009fe67921', level: 1 }, // Đệm hát cơ bản
  { subject: 'dem_hat', courseId: 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', level: 2 }, // Trình Độ 2
  { subject: 'dem_hat', courseId: 'd5f963ac-bcd7-45e2-b002-7970ba33e710', level: 3 }, // Trình Độ 3
  // Tỉa nốt (Nhập Môn là Level 1 dù canonical track khác — gộp qua config, không sửa track)
  { subject: 'tia_not', courseId: 'fd23a7a2-bfce-44c6-8bde-6d76289a3625', level: 1 }, // Nhập Môn
  { subject: 'tia_not', courseId: '4e80d7ec-3b99-426a-a090-990d37eb24c0', level: 2 }, // Tỉa nốt 1
  { subject: 'tia_not', courseId: '41e08930-d8ca-4519-9ca5-f4c0aaf62662', level: 3 }, // Tỉa Nốt 2
  { subject: 'tia_not', courseId: 'efeababa-fdad-4eab-a88a-a80dab1da2af', level: 4 }, // Tỉa Nốt 3
]
const CURRICULUM_BY_COURSE = new Map(JOURNEY_CURRICULUM.map((e, i) => [e.courseId, { subject: e.subject, level: e.level, order: i }]))
// Môn của 1 course cho student journey: config (nếu có) ưu tiên, ngược lại theo track canonical.
function journeySubjectKey(course?: CourseSummary | null) {
  const id = course?.id
  return (id && CURRICULUM_BY_COURSE.get(id)?.subject) || learnTrackKey(course)
}

function learnTrackKey(course?: CourseSummary | null) {
  const track = (course?.track ?? '').trim()
  if (track) return track
  if (course?.type === 'final') return 'solo'
  if (course?.type === 'canh_cua') return 'nhac_ly'
  return 'khac'
}

function learnSeriesLabel(course?: CourseSummary | null) {
  return LEARN_TRACKS.find(t => t.key === learnTrackKey(course))?.title ?? (course?.type === 'canh_cua' ? 'Cánh cửa' : 'Hành trình')
}

function courseFallbackStyle(course?: CourseSummary | null): React.CSSProperties {
  const key = learnTrackKey(course)
  const gradients: Record<string, string> = {
    dem_hat: 'linear-gradient(135deg, #4338CA, #EA580C)',
    tia_not: 'linear-gradient(135deg, #15803D, #0F766E)',
    solo: 'linear-gradient(135deg, #211C32, #4338CA)',
    nhac_ly: 'linear-gradient(135deg, #7C3AED, #2563EB)',
    khac: 'linear-gradient(135deg, #4338CA, #64748B)',
  }
  return { background: gradients[key] ?? gradients.khac }
}

function CourseThumbCard({
  course,
  locked,
  statusText,
  progressText,
  onClick,
}: {
  course: CourseSummary
  locked: boolean
  statusText: string
  progressText?: string | null
  onClick: () => void
}) {
  const image = course.image_url?.trim()
  return (
    <button onClick={onClick} style={{
      flex: '0 0 156px',
      aspectRatio: '3 / 2',
      border: 'none',
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      padding: 0,
      background: L.surface,
      boxShadow: L.shadowLg,
      scrollSnapAlign: 'start',
      fontFamily: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
    }}>
      {image ? (
        <img src={image} alt="" style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          filter: locked ? 'grayscale(.2)' : undefined,
          transform: 'scale(1.02)',
        }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#fff', ...courseFallbackStyle(course) }}>
          <span style={{ fontSize: 34, lineHeight: 1 }}>{course.icon || (course.type === 'canh_cua' ? '🔑' : '🎸')}</span>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,24,39,0) 18%, rgba(17,24,39,.84) 100%)' }} />
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 11, color: '#fff' }}>
        <div style={{ fontSize: 10.5, fontWeight: 900, opacity: .82, textTransform: 'uppercase', letterSpacing: '.02em' }}>{learnSeriesLabel(course)}</div>
        <div style={{
          marginTop: 3,
          fontSize: 14.5,
          lineHeight: 1.18,
          fontWeight: 900,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
          overflow: 'hidden',
        }}>{course.name}</div>
        <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 850, opacity: .9 }}>{progressText ?? statusText}</div>
      </div>
      {locked ? (
        <span style={{ position: 'absolute', top: 10, right: 10, width: 31, height: 31, borderRadius: 12, background: 'rgba(17,24,39,.72)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 15 }}>🔒</span>
      ) : (
        <span style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.90)', color: L.p1, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>▶</span>
      )}
    </button>
  )
}

// ── Tool route map — dẫn đến đúng route theo id ──
const TOOL_ROUTES: Record<string, string> = {
  tap:           '/tempo',
  'tap-tempo':   '/tempo',
  'tap-beat':    '/tap',
  'tap-beam':    '/tap',
  'tap-sing':    '/tap',
  'tap-strum':   '/tap',
  'scroll-kara': '/tap',
  metronome:     '/metronome',
  backing_track: '/tap',
  chord:         '/chords',
  tuner:         '/tuner',
  submit_video:  '/tap',
  ear:           '/tap',
  'piano-journey': '/piano-journey',
}

const TABS = [
  { id: 'home'    as Tab, icon: '🏠', label: 'Trang chủ' },
  { id: 'hoc'     as Tab, icon: '📖', label: 'Học'       },
  { id: 'tap'     as Tab, icon: '🎯', label: 'Tập'       },
  { id: 'teacher' as Tab, icon: '💬', label: 'Thầy'      },
  { id: 'me'      as Tab, icon: '🙂', label: 'Tôi'       },
]
const TOOLS_MAP: Record<string, { label: string; icon: string; color: string; route: string }> = {
  tap:           { label: 'Tap nhịp',     icon: '🥁', color: L.p1,      route: '/tempo'  },
  'tap-tempo':   { label: 'Tap Tempo',    icon: '🥁', color: L.p1,      route: '/tempo'  },
  metronome:     { label: 'Máy đập nhịp', icon: '🎼', color: L.green,   route: '/metronome' },
  backing_track: { label: 'Backing Track',icon: '🎧', color: L.gold,    route: '/tap'    },
  submit_video:  { label: 'Nộp video',    icon: '📹', color: L.a1,      route: '/tap'    },
  chord:         { label: 'Luyện hợp âm', icon: '🎸', color: '#7C3AED', route: '/chords' },
  ear:           { label: 'Luyện tai',    icon: '👂', color: '#0891B2', route: '/tap'    },
}

interface Props { student: Student; onLogout: () => void; preview?: boolean; guest?: boolean; onLoginRequired?: () => void }

export default function MobileStudentPortal({ student, onLogout, preview = false, guest = false, onLoginRequired }: Props) {
  const [tab, setTab]             = useState<Tab>('home')
  const [me, setMe]               = useState<Student>(student)
  // Đồng bộ lại khi student đổi (guest → đăng nhập, khôi phục phiên) — không thì header chào sai tên
  useEffect(() => { setMe(student) }, [student.id])
  const [showSettings, setShowSettings] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const [screen, setScreen]       = useState<Screen>('home')
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [modules, setModules]     = useState<Module[]>([])
  const [lessons, setLessons]     = useState<Lesson[]>([])
  const [lessonActionMap, setLessonActionMap] = useState<Record<string, Set<string>>>({})  // lessonId → set action_type (cho màu mốc)
  const [masterPath, setMasterPath] = useState<{ id: string; title: string; courseId: string; courseName: string }[]>([])  // đường mốc xuyên suốt mọi khóa
  const [journeyLessons, setJourneyLessons] = useState<JourneyLesson[]>([])  // view-model bài học phẳng theo môn (cho hành trình ngang)
  const [activeSubject, setActiveSubject]   = useState<string | null>(null)  // môn đang mở màn journey
  const [noteSaved, setNoteSaved]           = useState(false)  // feedback "Đã lưu" cho ghi chú journey
  const noteSaveTimerRef = useRef(0)  // debounce auto-save ghi chú
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)  // bài đang chọn trong journey (gắn companion)
  const [activeLevel, setActiveLevel]       = useState<number | null>(null)  // vùng Level đang xem (navigator) — tách khỏi current/selected
  const journeyRailRef = useRef<HTMLDivElement | null>(null)  // auto-scroll tới bài hiện tại
  const railRafRef = useRef(0)  // throttle scroll → cập nhật activeLevel
  const suppressRailScrollRef = useRef(false)  // chặn onRailScroll ghi đè khi đang animate goToLevel
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [returnLessonId, setReturnLessonId] = useState<string | null>(null) // bài vừa mở → khi quay lại danh sách cuộn về đúng chỗ
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [skillMap, setSkillMap]         = useState<Record<string, number>>({})  // lessonId → số phiên luyện (đỏ/vàng/xanh)
  const [freeCourses, setFreeCourses]   = useState<Set<string>>(new Set())  // khoá miễn phí (is_free)
  const [accessCourses, setAccessCourses] = useState<Set<string>>(new Set()) // khoá đã được thầy cấp quyền
  const [ownedCourseIds, setOwnedCourseIds] = useState<Set<string>>(new Set()) // khoá đang theo học thật
  const [effectiveEntitlement, setEffectiveEntitlement] = useState('free')
  const [foundationGaps, setFoundationGaps] = useState<Enrollment['course'][]>([]) // khoá NỀN còn thiếu (đặc cách vượt cấp) — §6 bộ luật
  const [htMember, setHtMember] = useState(false) // học viên Hành trình 2026/27: full khoá NHƯNG học tuần tự
  const [courseLessonIds, setCourseLessonIds] = useState<Record<string, string[]>>({}) // courseId → mọi lesson id (tính hoàn thành khoá)
  const [lastOpenedCourse, setLastOpenedCourse] = useState<string | null>(null) // khoá mở gần nhất (localStorage) → "Học ngay" resume
  const [lastDoneLesson, setLastDoneLesson] = useState<string | null>(null)      // bài hoàn thành gần nhất (fallback resume → tra khoá ở render)
  const [lessonTab, setLessonTab] = useState<'content' | 'note'>('content')
  const [dbTools, setDbTools]     = useState<DBTool[]>([])
  const [exerciseStatuses, setExerciseStatuses] = useState<Record<string, string>>({}) // exId → 'on'|'off'|'coming_soon'
  const [bpm, setBpm]             = useState(72)
  const [tapCount, setTapCount]   = useState(0)
  const tapTimes                  = useRef<number[]>([])
  const tapTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── XP & Artist Level ──
  const ARTIST_LEVELS = [
    { label: '🌱 Mầm non',    min: 0,      max: 1000,  color: '#16A34A' },
    { label: '📚 Học việc',   min: 1000,   max: 5000,  color: '#0891B2' },
    { label: '🎤 Biểu diễn',  min: 5000,   max: 15000, color: '#7C3AED' },
    { label: '🎸 Nghệ sĩ',    min: 15000,  max: 40000, color: '#D97706' },
    { label: '👑 Bậc thầy',   min: 40000,  max: 999999,color: '#DC2626' },
  ]
  const XP_SOURCE: Record<string, number> = {
    practice:      1,    // per minute
    lesson:        50,
    song_tempo:    100,
    song_timing:   200,
    song_approved: 300,
    song_mastered: 500,
    streak:        200,
  }
  const [totalXP, setTotalXP]     = useState(0)
  const [weekXP, setWeekXP]       = useState(0)
  const [lastWeekXP, setLastWeekXP] = useState(0)
  const [classRank, setClassRank] = useState<{ rank: number; total: number } | null>(null)
  // (Bảng xếp hạng đầy đủ đã gỡ khỏi tab Sống — chỉ còn HẠNG của mình hiện ở tab Học)
  const [communityGroups, setCommunityGroups] = useState<{ id: string; name: string; group_type: string; zalo_url: string | null; facebook_url: string | null }[]>([])
  const [livePage, setLivePage] = useState<LivePage | null>(null)   // trang con của tab Sống
  const [practiceStats, setPracticeStats] = useState<{ streak: number; daysWeek: number; weekMin: number; weekDays: boolean[] }>({ streak: 0, daysWeek: 0, weekMin: 0, weekDays: [] })

  // ── Practice tracker ──
  const EXERCISES = [
    { id: 'finger',    name: 'Luyện ngón',  icon: '🖐', color: '#7C3AED' },
    { id: 'scale',     name: 'Âm giai',     icon: '🎼', color: '#0891B2' },
    { id: 'arpeggio',  name: 'Arpeggio',    icon: '🎸', color: '#4338CA' },
    { id: 'metronome', name: 'Tiết tấu',     icon: '🥁', color: '#2E7D52' },
    { id: 'ear',       name: 'Cảm âm',      icon: '👂', color: '#D97706' },
  ]
  const [practiceTotals, setPracticeTotals] = useState<Record<string, number>>({})
  const [practiceToday, setPracticeToday]   = useState<Record<string, number>>({})
  const [activeTimer, setActiveTimer]       = useState<string | null>(null)
  const [timerStart, setTimerStart]         = useState<number | null>(null)
  const [timerSeconds, setTimerSeconds]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Journey config ──
  const JOURNEY_STEPS = [
    { id: 'tempo',  label: 'Tempo',  icon: '🥁', route: '/tempo', color: '#7C3AED' },
    { id: 'timing', label: 'Timing', icon: '🎼', route: '/song-builder', color: '#0891B2' },
    { id: 'nhip',   label: 'Nhịp',   icon: '🎵', route: null,     color: '#4338CA' },
    { id: 'hat',    label: 'Hát',    icon: '🎤', route: null,     color: '#16A34A' },
    { id: 'dan',    label: 'Đàn',    icon: '🎸', route: null,     color: '#D97706' },
  ]

  // ── YouTube Search ──
  const YT_API_KEY = 'AIzaSyA6kg3G2CVZ7b_x8IAlkZJCOa4AJHyWHms'
  const [ytQuery, setYtQuery]         = useState('')
  const [ytResults, setYtResults]     = useState<{ id: string; title: string; channel: string; thumbnail: string }[]>([])
  const [ytSearching, setYtSearching] = useState(false)
  const [ytSelected, setYtSelected]   = useState<{ id: string; title: string; thumbnail: string } | null>(null)

  const searchYouTube = async (q: string) => {
    if (!q.trim()) return
    setYtSearching(true); setYtResults([])
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`)
      const data = await res.json()
      setYtResults((data.items ?? []).map((item: any) => ({
        id: item.id.videoId, title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.default?.url ?? '',
      })))
    } catch(e) { console.error(e) }
    setYtSearching(false)
  }

  const selectYtVideo = (r: { id: string; title: string; thumbnail: string }) => {
    setYtSelected(r)
    setNewSongTitle(r.title)
    setNewSongYoutube(`https://youtube.com/watch?v=${r.id}`)
    setShowConfirmSave(true)
  }

  // ── Add Song Flow ──
  const [showAddSong, setShowAddSong]       = useState(false)
  const [addStep, setAddStep]               = useState<'input'|'preview'>('input')
  const [newSongTitle, setNewSongTitle]     = useState('')
  const [newSongYoutube, setNewSongYoutube] = useState('')
  const [addingSong, setAddingSong]         = useState(false)
  const [carouselIdx, setCarouselIdx]       = useState(0)
  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [showAllSongs, setShowAllSongs]     = useState(false)

  // XP thưởng cho từng bước journey
  const STEP_XP: Record<string, number> = {
    tempo: XP_SOURCE.song_tempo, timing: XP_SOURCE.song_timing,
    nhip: 150, hat: 250, dan: 300,
  }
  const [celebrate, setCelebrate] = useState<{ title: string; mastered: boolean; xp: number } | null>(null)

  const markStepDone = async (songId: string, stepId: string) => {
    const song = mySongs.find(s => s.id === songId)
    if (!song) return
    const newJourney = song.journey.map(j => j.id === stepId ? { ...j, done: true } : j)
    const mastered = newJourney.every(j => j.done)
    // Cập nhật DB — nếu lỗi thì KHÔNG cập nhật UI (tránh hiện tiến độ giả)
    const { error: songErr } = await supabase.from('student_songs')
      .update({ journey: newJourney, status: mastered ? 'mastered' : stepId })
      .eq('id', songId)
    if (songErr) { console.error('Lưu tiến độ bài hát lỗi:', songErr); return }
    setMySongs(prev => prev.map(s => s.id === songId ? { ...s, journey: newJourney } : s))
    // Thưởng XP — bước + bonus nếu chinh phục cả bài
    const gained = (STEP_XP[stepId] ?? 100) + (mastered ? XP_SOURCE.song_mastered : 0)
    const { error: xpErr } = await supabase.from('student_xp_log').insert({
      student_id: student.id, xp: gained,
      source: mastered ? 'song_mastered' : 'song_step', ref_id: songId,
    })
    if (xpErr) console.error('Ghi XP lỗi:', xpErr)
    setTotalXP(prev => prev + gained)
    setWeekXP(prev  => prev + gained)
    // Chúc mừng
    setCelebrate({ title: song.title, mastered, xp: gained })
    setTimeout(() => setCelebrate(null), mastered ? 3500 : 2200)
  }

  const handleAddSong = async () => {
    if (guest) { requireLogin(); return }
    if (!newSongTitle.trim()) return
    setAddingSong(true)
    // Chụp lại trước khi reset state
    const savedTitle   = newSongTitle.trim()
    const savedYoutube = newSongYoutube.trim()
    const steps = [
      { id: 'tempo',  done: false },
      { id: 'timing', done: false },
      { id: 'nhip',   done: false },
      { id: 'hat',    done: false },
      { id: 'dan',    done: false },
    ]
    const { data: newSong, error: insertErr } = await supabase.from('student_songs').insert({
      student_id: student.id,
      title: savedTitle,
      youtube_url: savedYoutube || null,
      status: 'tempo',
      journey: steps,
    }).select('id').single()
    if (insertErr || !newSong) { alert('Thêm bài thất bại: ' + (insertErr?.message ?? '')); setAddingSong(false); return }
    const { data } = await supabase.from('student_songs')
      .select('id,title,artist,tempo,status,created_at,journey')
      .eq('student_id', student.id).order('created_at', { ascending: false })
    setMySongs((data ?? []).map((s: any) => ({
      ...s,
      journey: s.journey?.length ? s.journey : steps
    })))
    // Reset form
    setShowConfirmSave(false)
    setShowAddSong(false)
    setAddStep('input')
    setNewSongTitle(''); setNewSongYoutube('')
    setYtSelected(null); setYtQuery(''); setYtResults([])
    setCarouselIdx(0)
    setAddingSong(false)
    // Tự động mở Tap Tempo — nạp sẵn tên bài + YouTube + songId để CẬP NHẬT đúng bài (không tạo trùng)
    const params = new URLSearchParams({ title: savedTitle })
    if (savedYoutube) params.set('youtube', savedYoutube)
    params.set('songId', newSong.id)
    setPendingJourney({ songId: newSong.id, stepId: 'tempo' })
    openTool('/tempo?' + params.toString(), 'Tempo', 'tempo')
  }

  // ── My Songs ──
  const [mySongs, setMySongs] = useState<{ id: string; title: string; artist: string | null; tempo: number | null; status: string; created_at: string; journey: { id: string; done: boolean }[]; youtube_url?: string | null }[]>([])

  // ── Progress tracking ──
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [markingDone, setMarkingDone]   = useState(false)
  const [noteText, setNoteText]         = useState('')

  // ── Finger Exercise overlay ──
  const [showFingerExercise, setShowFingerExercise] = useState(false)
  // ── Scale Exercise overlay ──
  const [showScaleExercise, setShowScaleExercise] = useState(false)
  // ── Arpeggio Exercise overlay ──
  const [showArpExercise, setShowArpExercise] = useState(false)
  // ── Groove (Tiết tấu) overlay — port từ Groove Lab ──
  const [showGroove, setShowGroove] = useState(false)
  // ── BMS (Song Builder) render THẲNG trong app (không iframe) — hết app-chồng-app ──
  const [showBMS, setShowBMS] = useState(false)
  const [showPiano, setShowPiano] = useState(false)
  const [showMetronome, setShowMetronome] = useState(false)
  const [metronomeBpm, setMetronomeBpm]   = useState<number | null>(null)
  const [bmsInit, setBmsInit] = useState<{ title?: string | null; youtube?: string | null; tempo?: string | null } | undefined>(undefined)
  // Tool ID của bài học đang mở exercise (để mark done khi đóng)
  const [currentLessonToolId, setCurrentLessonToolId] = useState<string | null>(null)
  // ── Coming-soon tools accordion ──
  const [showComingTools, setShowComingTools] = useState(false)

  // ── Tool overlay — mở tool ngay trong app, không navigate ra ngoài ──
  const [activeTool, setActiveTool] = useState<{ name: string; url: string } | null>(null)
  // Bước journey đang chờ xác nhận khi đóng tool (vd mở Tempo cho 1 bài → đóng xong đánh dấu bước 'tempo')
  const [pendingJourney, setPendingJourney] = useState<{ songId: string; stepId: string } | null>(null)
  // ── Track tool đã dùng trong bài hiện tại ──
  const [usedToolIds, setUsedToolIds] = useState<Set<string>>(new Set())
  const [lessonActions, setLessonActions] = useState<Set<string>>(new Set())
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  // Refs phục vụ ghi giờ tăng dần (không phụ thuộc closure của state trong setInterval / event nền)
  const activeTimerRef = useRef<string | null>(null)
  const lastFlushRef   = useRef<number | null>(null)   // mốc thời điểm lần lưu gần nhất
  const flushRef       = useRef<() => void>(() => {})

  const requireLogin = () => {
    if (onLoginRequired) onLoginRequired()
    else window.location.href = '/start'
  }

  const openUpgrade = () => {
    window.location.href = '/subscribe'
  }

  const explainUpgrade = () => {
    window.location.href = '/subscribe'
  }

  // Ghi thời gian luyện + XP vào DB và cập nhật hiển thị ngay (1 XP / phút)
  const persistMinutes = async (exId: string, minutes: number) => {
    if (minutes < 1) return
    if (guest) {
      setPracticeTotals(prev => ({ ...prev, [exId]: (prev[exId] ?? 0) + minutes }))
      setPracticeToday(prev => ({ ...prev, [exId]: (prev[exId] ?? 0) + minutes }))
      return
    }
    const { error: plErr } = await supabase.from('student_practice_log').insert({ student_id: student.id, exercise_id: exId, minutes })
    if (plErr) console.error('Ghi nhật ký luyện tập lỗi:', plErr)
    // Ghi XP — 1 XP/phút
    const { error: xpErr } = await supabase.from('student_xp_log').insert({ student_id: student.id, xp: minutes, source: 'practice', ref_id: exId })
    if (xpErr) console.error('Ghi XP lỗi:', xpErr)
    setTotalXP(prev => prev + minutes)
    setWeekXP(prev  => prev + minutes)
    setPracticeTotals(prev => ({ ...prev, [exId]: (prev[exId] ?? 0) + minutes }))
    setPracticeToday(prev  => ({ ...prev, [exId]: (prev[exId] ?? 0) + minutes }))
  }

  // Flush định kỳ: lưu số PHÚT TRỌN đã tích luỹ từ lần flush trước, giữ lại phần lẻ <1'.
  // Nhờ vậy dù app iOS bị khoá màn hình / kill / reload thì tối đa chỉ mất <1 phút,
  // và "Còn X' để mở" + progress cập nhật trực tiếp trong lúc tập (totalMinutes tăng theo practiceTotals).
  const flushPractice = () => {
    const exId = activeTimerRef.current
    if (!exId || lastFlushRef.current == null) return
    const minutes = Math.floor((Date.now() - lastFlushRef.current) / 60000)
    if (minutes < 1) return
    lastFlushRef.current += minutes * 60000   // chỉ tiêu thụ phần phút trọn, giữ phần lẻ
    void persistMinutes(exId, minutes)
  }
  flushRef.current = flushPractice   // luôn trỏ tới closure mới nhất cho các listener nền

  const startTimer = (exerciseId: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const t0 = Date.now()
    activeTimerRef.current = exerciseId
    lastFlushRef.current   = t0
    setActiveTimer(exerciseId); setTimerStart(t0); setTimerSeconds(0)
    timerRef.current = setInterval(() => { setTimerSeconds(s => s + 1); flushPractice() }, 1000)
  }
  const stopTimer = async (lessonToolId?: string) => {
    const exId = activeTimerRef.current
    if (!exId || lastFlushRef.current == null) { setActiveTimer(null); setTimerStart(null); setTimerSeconds(0); return }
    if (timerRef.current) clearInterval(timerRef.current)
    // Phần đuôi còn lại: làm tròn; nếu cả buổi chưa từng flush (<1') vẫn tính tối thiểu 1'
    let minutes = Math.round((Date.now() - lastFlushRef.current) / 60000)
    if (minutes < 1 && timerStart != null && lastFlushRef.current === timerStart) minutes = 1
    await persistMinutes(exId, minutes)
    activeTimerRef.current = null; lastFlushRef.current = null
    setActiveTimer(null); setTimerStart(null); setTimerSeconds(0)
    // Mark lesson tool done nếu gọi từ bài học
    if (lessonToolId && activeLesson) {
      setUsedToolIds(prev => {
        const next = new Set([...prev, lessonToolId])
        try { localStorage.setItem(usedToolsKey(activeLesson.id), JSON.stringify([...next])) } catch { /* bỏ qua */ }
        return next
      })
    }
  }

  // iOS WKWebView: lưu giờ khi app xuống nền / đóng trang; khi quay lại thì đặt lại mốc
  // để KHÔNG cộng oan khoảng thời gian app bị treo (màn hình khoá không phải là đang tập).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) flushRef.current()
      else if (activeTimerRef.current) lastFlushRef.current = Date.now()
    }
    const onHidePage = () => flushRef.current()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHidePage)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHidePage)
    }
  }, [])
  const fmtTimer = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  // Khoá lưu trạng thái tool đã thực hành theo từng học sinh + bài học
  const usedToolsKey = (lessonId: string) => `usedTools:${student.id}:${lessonId}`

  // Gộp tool bảng cứng (TOOLS_MAP) + bài luyện nội bộ + tool DB → mọi tool hợp lệ đều có thẻ thực hành
  const resolveTool = (tid: string): { label: string; icon: string; color: string; route: string } | null => {
    if (TOOLS_MAP[tid]) return TOOLS_MAP[tid]
    // Bài luyện nội bộ (timer) — route dạng '#exercise:<exId>'
    const exId = TOOL_TO_EX[tid]
    if (exId) {
      const ex = EXERCISES.find(e => e.id === exId)
      if (ex) return { label: ex.name, icon: ex.icon, color: ex.color, route: '#exercise:' + exId }
    }
    const db = dbTools.find(t => t.id === tid)
    if (db) return { label: db.name, icon: db.icon, color: L.p1, route: db.route }
    return null
  }

  const markToolUsed = (toolId: string) => setUsedToolIds(prev => {
    const next = new Set([...prev, toolId])
    if (activeLesson) { try { localStorage.setItem(usedToolsKey(activeLesson.id), JSON.stringify([...next])) } catch { /* bỏ qua */ } }
    return next
  })

  const openTool = (route: string, name: string, toolId?: string) => {
    // Piano Journey: render THẲNG như BMS. Bắt buộc phải thẳng, không iframe —
    // getUserMedia trong iframe của WKWebView (app iOS) hay bị chặn ⇒ mic chết.
    if (route.includes('/piano-journey')) {   // includes: bắt cả khi route là URL tuyệt đối
      setShowPiano(true)
      if (toolId) markToolUsed(toolId)
      return
    }
    // Máy đập nhịp: render THẲNG (không iframe) → chỉ 1 header, hết "app chồng app".
    if (route.includes('/metronome')) {
      const p = new URLSearchParams(route.split('?')[1] ?? '')
      const t = parseInt(p.get('tempo') ?? '', 10)
      setMetronomeBpm(Number.isFinite(t) ? t : null)
      setShowMetronome(true)
      if (toolId) markToolUsed(toolId)
      return
    }
    // BMS: render THẲNG (không iframe) → hết "app chồng app". Tham số truyền qua prop, không qua URL iframe.
    if (route.startsWith('/song-builder')) {
      const p = new URLSearchParams(route.split('?')[1] ?? '')
      setBmsInit({ title: p.get('title'), youtube: p.get('youtube'), tempo: p.get('tempo') })
      setShowBMS(true)
      if (toolId) markToolUsed(toolId)
      return
    }
    // Thêm embedded=1 để tool bên trong ẩn nút ✕ của mình (tránh 2 nút đóng)
    const sep = route.includes('?') ? '&' : '?'
    const embeddedRoute = route.startsWith('http') ? route : route + sep + 'embedded=1'
    const url = embeddedRoute.startsWith('http') ? embeddedRoute : window.location.origin + embeddedRoute
    setActiveTool({ name, url })
    if (toolId) markToolUsed(toolId)
  }

  // Đóng tool — nếu có bước journey đang chờ, đọc lại bài & đánh dấu bước nếu DỮ LIỆU xác nhận
  const closeTool = async () => {
    setActiveTool(null)
    const pj = pendingJourney
    setPendingJourney(null)
    if (!pj) return
    const { data } = await supabase.from('student_songs')
      .select('id,tempo,journey').eq('id', pj.songId).maybeSingle()
    if (!data) return
    const alreadyDone = (data.journey ?? []).find((j: { id: string; done: boolean }) => j.id === pj.stepId)?.done
    // Bước 'tempo' chỉ tính xong khi bài đã có tempo thật (tránh đánh dấu giả khi học viên thoát giữa chừng)
    const dataConfirms = pj.stepId === 'tempo' ? !!data.tempo : false
    if (!alreadyDone && dataConfirms) {
      setMySongs(prev => prev.map(s => s.id === pj.songId ? { ...s, tempo: data.tempo } : s))
      markStepDone(pj.songId, pj.stepId)
    }
  }

  const effectiveTier = normalizeEntitlementTier(effectiveEntitlement)
  const entitlementLegacyTier = effectiveTier === 'nang_cao_499' ? 'pro'
    : effectiveTier === 'can_ban_396' ? 'standard'
    : effectiveTier === 'khoi_dau_99' ? 'basic'
    : 'free'
  const studentTierIdx = Math.max(
    TIER_ORDER.indexOf(LEVEL_TIER[student.level ?? 'beginner'] ?? 'free'),
    TIER_ORDER.indexOf(entitlementLegacyTier),
  )
  const isTierUnlocked = (tier?: string) => TIER_ORDER.indexOf(tier ?? 'free') <= studentTierIdx

  // ── Chặn tuần tự cho học viên Hành trình (HT): khoá cấp trên chỉ mở khi HOÀN THÀNH hết bài cấp dưới ──
  // Mã năng lực đã hoàn thành = mọi bài của khoá đó đều xong.
  const completedCodes = new Set<string>()
  enrollments.forEach(e => {
    const code = (e.course?.code || '').trim().toUpperCase()
    const ids = courseLessonIds[e.course_id]
    if (code && ids && ids.length > 0 && ids.every(id => completedIds.has(id))) completedCodes.add(code)
  })
  const seqLockMissing = (code?: string | null) => htMember ? missingPrereqs(code, completedCodes).map(c => tenNangLuc(c) || c) : []
  const isSeqLocked = (code?: string | null) => seqLockMissing(code).length > 0

  // Tất cả bài đã sắp xếp đúng thứ tự: module order_index → lesson order_index
  const sortedLessons = [...lessons].sort((a, b) => {
    const ma = modules.find(m => m.id === a.module_id)?.order_index ?? 0
    const mb = modules.find(m => m.id === b.module_id)?.order_index ?? 0
    return ma !== mb ? ma - mb : a.order_index - b.order_index
  })

  const isSequentiallyUnlocked = (lessonId: string) => {
    const idx = sortedLessons.findIndex(l => l.id === lessonId)
    if (idx <= 0) return true
    // Mở nếu bài liền trước đã xong, HOẶC chính bài này đã hoàn thành — để khi
    // đổi thứ tự chương/bài, học viên không bị "khoá ngược" các bài đã học xong.
    return completedIds.has(sortedLessons[idx - 1].id) || completedIds.has(lessonId)
  }

  const courseById = new Map(enrollments.map(e => [e.course_id, e.course]))
  const activeCourse = activeCourseId ? courseById.get(activeCourseId) : null

  // Quyền MỞ KHOÁ THEO TỪNG KHOÁ: policy mới ưu tiên khi Admin bật.
  // Chưa bật policy mới => giữ behavior cũ bằng is_free / edu_course_access / enrollment / lesson.tier.
  const activeCourseUnlocked = preview || !activeCourseId || freeCourses.has(activeCourseId) || accessCourses.has(activeCourseId) || ownedCourseIds.has(activeCourseId)
  const resolveLesson = (l: Lesson) => resolveLessonAccess(l, activeCourse ?? { is_free: true, status: 'on' }, effectiveTier, {
    courseLegacyUnlocked: activeCourseUnlocked,
    preview,
  })
  const isLessonCourseUnlocked = (l: Lesson) => resolveLesson(l).canAccess

  const isUnlocked = (l: Lesson) =>
    isLessonCourseUnlocked(l) && isSequentiallyUnlocked(l.id)

  // ── Màu mốc (gradient) — điểm "độ chắc" ẩn từ event THẬT, nội suy ra màu ──
  // 0 = chưa học (xám) · 40 = đã học (đỏ) · +30 đã thực hành · +30 đã gửi bài → 100 (xanh)
  const scoreById = (id: string) => {
    if (!completedIds.has(id)) return 0
    let s = 40
    const acts = lessonActionMap[id]
    if (acts?.has('practiced_lesson')) s += 30
    if (acts?.has('submitted_video_self_report')) s += 30
    return s
  }
  const lessonScore = (l: Lesson) => scoreById(l.id)
  const scoreColor = (score: number) => {
    if (score <= 0) return '#D1D5DB'
    const stops: [number, [number, number, number]][] = [[40, [239, 68, 68]], [70, [245, 158, 11]], [100, [34, 197, 94]]]
    if (score <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`
    for (let i = 0; i < stops.length - 1; i++) {
      const [s1, c1] = stops[i]; const [s2, c2] = stops[i + 1]
      if (score >= s1 && score <= s2) {
        const t = (score - s1) / (s2 - s1)
        const c = c1.map((v, j) => Math.round(v + (c2[j] - v) * t))
        return `rgb(${c[0]},${c[1]},${c[2]})`
      }
    }
    return `rgb(${stops[stops.length - 1][1].join(',')})`
  }

  const loadCourseLessonMap = async (courseIds: string[]) => {
    const ids = [...new Set(courseIds.filter(Boolean))]
    if (ids.length === 0) return
    const { data: mods } = await supabase.from('edu_modules').select('id,course_id').in('course_id', ids)
    const modIds = (mods ?? []).map((m: any) => m.id)
    if (modIds.length === 0) {
      setCourseLessonIds(prev => {
        const next = { ...prev }
        ids.forEach(id => { if (!next[id]) next[id] = [] })
        return next
      })
      return
    }
    const { data: lsns } = await supabase.from('edu_course_lessons').select('id,module_id').in('module_id', modIds)
    const modCourse: Record<string, string> = {}
    ;(mods ?? []).forEach((m: any) => { modCourse[m.id] = m.course_id })
    const nextMap: Record<string, string[]> = {}
    ids.forEach(id => { nextMap[id] = [] })
    ;(lsns ?? []).forEach((l: any) => {
      const cid = modCourse[l.module_id]
      if (cid) (nextMap[cid] ??= []).push(l.id)
    })
    setCourseLessonIds(prev => ({ ...prev, ...nextMap }))
  }

  // Dựng view-model hành trình ngang (dùng cho GUEST — logged-in build inline cùng masterPath)
  const loadJourneyLessons = async (courseObjs: (Enrollment['course'] | null | undefined)[]) => {
    const list = courseObjs.filter(Boolean) as Enrollment['course'][]
    const cids = list.map(c => c.id)
    if (cids.length === 0) { setJourneyLessons([]); return }
    const order: Record<string, number> = {}; const cname: Record<string, string> = {}; const cobj: Record<string, Enrollment['course']> = {}
    ;[...list].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)).forEach((c, i) => { order[c.id] = i; cname[c.id] = c.name ?? 'Khóa học'; cobj[c.id] = c })
    const { data: mods } = await supabase.from('edu_modules').select('id,course_id,order_index,name,level').in('course_id', cids)
    const modMap: Record<string, { course_id: string; order_index: number; name?: string; level?: number | null }> = {}
    ;(mods ?? []).forEach((m: any) => { modMap[m.id] = m })
    const modIds = (mods ?? []).map((m: any) => m.id)
    if (modIds.length === 0) { setJourneyLessons([]); return }
    const { data: lsns } = await supabase.from('edu_course_lessons')
      .select('id,module_id,title,order_index,lesson_type,content_url,tier,access_policy_mode,required_tier,visibility,availability,allow_preview')
      .in('module_id', modIds)
    const ranked = (lsns ?? []).map((l: any) => {
      const m = modMap[l.module_id]; const cid = m?.course_id ?? ''
      return { l, m, cid, cs: CURRICULUM_BY_COURSE.get(cid)?.order ?? order[cid] ?? 99, mo: m?.order_index ?? 0, lo: l.order_index ?? 0 }
    }).sort((a: any, b: any) => a.cs - b.cs || a.mo - b.mo || a.lo - b.lo)
    setJourneyLessons(ranked.map((p: any) => {
      const c = cobj[p.cid]
      return {
        id: p.l.id, title: p.l.title,
        courseId: p.cid, courseName: cname[p.cid] ?? '', courseCode: c?.code ?? null,
        moduleId: p.l.module_id, moduleName: p.m?.name ?? '', moduleLevel: CURRICULUM_BY_COURSE.get(p.cid)?.level ?? p.m?.level ?? null,
        subjectKey: journeySubjectKey(c), ytId: getYtId(p.l.content_url ?? null),
        lesson_type: p.l.lesson_type ?? null, content_url: p.l.content_url ?? null, tier: p.l.tier ?? null,
        access_policy_mode: p.l.access_policy_mode ?? null, required_tier: p.l.required_tier ?? null,
        visibility: p.l.visibility ?? null, availability: p.l.availability ?? null, allow_preview: p.l.allow_preview ?? null,
      }
    }))
  }

  useEffect(() => {
    if (guest) {
      supabase.from('edu_courses')
        .select(COURSE_SELECT)
        .then(({ data }) => {
          const courses = ((data ?? []) as any[]).filter(c => c && (c.status ?? 'on') !== 'off')
          setEnrollments(courses.map((course: any) => ({
            id: `public-${course.id}`,
            course_id: course.id,
            enrolled_at: '',
            course,
          })))
          setFreeCourses(new Set(courses.filter((course: any) => course.is_free !== false).map((course: any) => course.id)))
          setAccessCourses(new Set())
          setOwnedCourseIds(new Set())
          setFoundationGaps([])
          loadCourseLessonMap(courses.map((course: any) => course.id))
          loadJourneyLessons(courses as Enrollment['course'][])  // guest vẫn xem được hành trình (free-first)
        })
      supabase.from('edu_tools').select('*').order('order_index')
        .then(({ data }) => {
          const all = (data ?? []).map((t: any) => ({
            ...t, status: t.status ?? (t.enabled ? 'on' : 'off'),
          }))
          setDbTools(all.filter((t: any) => t.status !== 'off' && t.category !== 'Bài luyện') as DBTool[])
          const exMap: Record<string, string> = {}
          Object.entries(EX_TOOL_ID).forEach(([exId, toolId]) => {
            const tool = all.find((t: any) => t.id === toolId)
            exMap[exId] = tool?.status ?? 'on'
          })
          setExerciseStatuses(exMap)
        })
      setMasterPath([])
      setCourseLessonIds({})
      setSkillMap({})
      setTotalXP(0)
      setWeekXP(0)
      setLastWeekXP(0)
      setClassRank(null)
      setCommunityGroups([])
      setPracticeTotals({})
      setPracticeToday({})
      setPracticeStats({ streak: 0, daysWeek: 0, weekMin: 0, weekDays: [] })
      setMySongs([])
      setCompletedIds(new Set())
      setHtMember(false)
      setEffectiveEntitlement('free')
      setLastOpenedCourse(null)
      setLastDoneLesson(null)
      return
    }

    const loadCourses = () => supabase.from('edu_enrollments')
      .select(`id,course_id,enrolled_at,is_active,course:edu_courses(${COURSE_REL_SELECT})`)
      .eq('student_id', student.id).eq('is_active', true)
      .then(async ({ data }) => {
        // Lọc null NGAY TẠI NGUỒN: enrollment thiếu course (join null) không được vào state — mọi UI phía dưới tin dữ liệu sạch
        const enr = ((data ?? []) as unknown as Enrollment[]).filter(e => e && e.course)
        setOwnedCourseIds(new Set(enr.map(e => e.course_id)))
        const { data: publicCourses } = await supabase
          .from('edu_courses')
          .select(COURSE_SELECT)
        const enrolledById = new Map(enr.map(e => [e.course_id, e]))
        const discovery = ((publicCourses ?? []) as any[])
          .filter(c => c && (c.status ?? 'on') !== 'off' && !enrolledById.has(c.id))
          .map(course => ({
            id: `public-${course.id}`,
            course_id: course.id,
            enrolled_at: '',
            course,
          } as Enrollment))
        const mergedEnrollments = [...enr, ...discovery]
        setEnrollments(mergedEnrollments)
        loadCourseLessonMap(mergedEnrollments.map(e => e.course_id))
        // Khoá miễn phí + khoá đã được cấp quyền → dùng để mở/khoá bài theo từng khoá
        setFreeCourses(new Set(mergedEnrollments.filter(e => (e.course as any)?.is_free !== false).map(e => e.course_id)))
        supabase.from('edu_course_access').select('course_id').eq('student_id', student.id).eq('active', true)
          .then(({ data: acc }) => setAccessCourses(new Set((acc ?? []).map((a: any) => a.course_id))))
        // ── Khoá NỀN còn thiếu (§6): gom mã tiên quyết chưa sở hữu, nạp thẻ mờ để nhắc học bổ sung ──
        const ownedCodes = new Set(enr.map(e => (e.course?.code || '').trim().toUpperCase()).filter(Boolean))
        const gapCodes = new Set<string>()
        enr.forEach(e => missingPrereqs(e.course?.code, ownedCodes).forEach(c => gapCodes.add(c)))
        if (gapCodes.size > 0) {
          supabase.from('edu_courses').select(COURSE_SELECT)
            .in('code', [...gapCodes])
            .then(({ data: gc }) => setFoundationGaps(((gc ?? []) as any[])
              .filter(c => c && (c.status ?? 'on') !== 'off' && !ownedCodes.has((c.code || '').trim().toUpperCase()))))
        } else setFoundationGaps([])
        // Tiến độ KỸ NĂNG (đỏ/vàng/xanh) theo số phiên luyện
        supabase.from('edu_skill_progress').select('lesson_id,sessions').eq('student_id', student.id)
          .then(({ data: sk }) => { const m: Record<string, number> = {}; (sk ?? []).forEach((r: any) => { m[r.lesson_id] = r.sessions }); setSkillMap(m) })
        // ── Dựng đường mốc XUYÊN SUỐT mọi khóa (master journey) ──
        const courses = enr.filter(e => (e.course?.status ?? 'on') !== 'off')
        const courseIds = courses.map(e => e.course_id)
        if (courseIds.length === 0) { setMasterPath([]); return }
        const order: Record<string, number> = {}
        const cname: Record<string, string> = {}
        const cobj: Record<string, Enrollment['course']> = {}
        ;[...courses].sort((a, b) => (a.course?.sort_order ?? 99) - (b.course?.sort_order ?? 99))
          .forEach((e, i) => { order[e.course_id] = i; cname[e.course_id] = e.course?.name ?? 'Khóa học'; if (e.course) cobj[e.course_id] = e.course })
        const { data: mods } = await supabase.from('edu_modules').select('id,course_id,order_index,name,level').in('course_id', courseIds)
        const modMap: Record<string, { course_id: string; order_index: number; name?: string; level?: number | null }> = {}
        ;(mods ?? []).forEach((m: any) => { modMap[m.id] = m })
        const modIds = (mods ?? []).map((m: any) => m.id)
        if (modIds.length === 0) { setMasterPath([]); setJourneyLessons([]); return }
        const { data: lsns } = await supabase.from('edu_course_lessons')
          .select('id,module_id,title,order_index,lesson_type,content_url,tier,access_policy_mode,required_tier,visibility,availability,allow_preview')
          .in('module_id', modIds)
        // Gom lesson id theo khoá → tính khoá đã hoàn thành (chặn tuần tự HT)
        const cli: Record<string, string[]> = {}
        ;(lsns ?? []).forEach((l: any) => { const cid = modMap[l.module_id]?.course_id; if (cid) (cli[cid] ??= []).push(l.id) })
        setCourseLessonIds(prev => ({ ...prev, ...cli }))
        const ranked = (lsns ?? []).map((l: any) => {
          const m = modMap[l.module_id]; const cid = m?.course_id ?? ''
          return { l, m, cid, cs: CURRICULUM_BY_COURSE.get(cid)?.order ?? order[cid] ?? 99, mo: m?.order_index ?? 0, lo: l.order_index ?? 0 }
        }).sort((a: any, b: any) => a.cs - b.cs || a.mo - b.mo || a.lo - b.lo)
        setMasterPath(ranked.map((p: any) => ({ id: p.l.id, title: p.l.title, courseId: p.cid, courseName: cname[p.cid] ?? '' })))
        // View-model hành trình ngang: giữ module (chương) + course (level) + trường access + ytId
        setJourneyLessons(ranked.map((p: any) => {
          const c = cobj[p.cid]
          return {
            id: p.l.id, title: p.l.title,
            courseId: p.cid, courseName: cname[p.cid] ?? '', courseCode: c?.code ?? null,
            moduleId: p.l.module_id, moduleName: p.m?.name ?? '', moduleLevel: CURRICULUM_BY_COURSE.get(p.cid)?.level ?? p.m?.level ?? null,
            subjectKey: journeySubjectKey(c),
            ytId: getYtId(p.l.content_url ?? null),
            lesson_type: p.l.lesson_type ?? null, content_url: p.l.content_url ?? null, tier: p.l.tier ?? null,
            access_policy_mode: p.l.access_policy_mode ?? null, required_tier: p.l.required_tier ?? null,
            visibility: p.l.visibility ?? null, availability: p.l.availability ?? null, allow_preview: p.l.allow_preview ?? null,
          }
        }))
      })
    loadCourses()
    supabase.from('edu_tools').select('*').order('order_index')
      .then(({ data }) => {
        const all = (data ?? []).map((t: any) => ({
          ...t, status: t.status ?? (t.enabled ? 'on' : 'off'),
        }))
        // Công cụ thông thường: không phải 'off', không phải bài luyện
        const regularTools = all.filter((t: any) => t.status !== 'off' && t.category !== 'Bài luyện')
        setDbTools(regularTools as DBTool[])   // luôn gọi — kể cả khi rỗng (không dùng fallback)
        // Trạng thái bài luyện
        const exMap: Record<string, string> = {}
        Object.entries(EX_TOOL_ID).forEach(([exId, toolId]) => {
          const tool = all.find((t: any) => t.id === toolId)
          exMap[exId] = tool?.status ?? 'on'
        })
        setExerciseStatuses(exMap)
      })
    // Load progress
    // Load XP
    const weekAgo     = new Date(Date.now() - 7  * 24 * 3600 * 1000).toISOString()
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    supabase.from('student_xp_log').select('xp, source, created_at').eq('student_id', student.id)
      .then(({ data }) => {
        if (!data) return
        const total   = data.reduce((a, r) => a + r.xp, 0)
        const week    = data.filter(r => r.created_at >= weekAgo).reduce((a, r) => a + r.xp, 0)
        const lweek   = data.filter(r => r.created_at >= twoWeeksAgo && r.created_at < weekAgo).reduce((a, r) => a + r.xp, 0)
        setTotalXP(total); setWeekXP(week); setLastWeekXP(lweek)
      })
    // Bảng xếp hạng THEO LỚP (cùng nhóm Zalo, gộp nhiều lớp) — RPC my_class_leaderboard
    supabase.rpc('my_class_leaderboard').then(({ data }) => {
      const clean = (n?: string | null) => { const s = (n ?? '').trim(); return s.includes('@') ? s.split('@')[0] : (s || 'Học viên') }
      const lb = ((data ?? []) as any[])
        .map(r => ({ id: r.student_id, name: clean(r.name), avatar: r.avatar_url ?? null, xp: Number(r.xp) || 0 }))
        .sort((a, b) => b.xp - a.xp)
      const myIdx = lb.findIndex(r => r.id === student.id)
      setClassRank({ rank: myIdx >= 0 ? myIdx + 1 : lb.length, total: Math.max(lb.length, 1) })
    })

    // Cộng đồng của bạn (Facebook chung + nhóm Zalo đã gán) — qua RPC my_groups
    supabase.rpc('my_groups').then(({ data }) => setCommunityGroups((data ?? []) as any))

    // Load practice data
    const now2 = new Date()
    const todayStart = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate()).toISOString()
    supabase.from('student_practice_log')
      .select('exercise_id, minutes, practiced_at')
      .eq('student_id', student.id)
      .then(({ data }) => {
        if (!data) return
        const totals: Record<string, number> = {}
        const today: Record<string, number>  = {}
        const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        const days = new Set<string>()
        const weekAgoMs = Date.now() - 7 * 24 * 3600 * 1000
        let weekMin = 0
        data.forEach((r: any) => {
          totals[r.exercise_id] = (totals[r.exercise_id] ?? 0) + r.minutes
          if (r.practiced_at >= todayStart)
            today[r.exercise_id] = (today[r.exercise_id] ?? 0) + r.minutes
          const d = new Date(r.practiced_at)
          days.add(dayKey(d))
          if (d.getTime() >= weekAgoMs) weekMin += r.minutes
        })
        setPracticeTotals(totals)
        setPracticeToday(today)
        // Nhịp tuần + streak (chuỗi ngày luyện liên tiếp)
        const weekDays: boolean[] = []   // index 0 = 6 ngày trước ... index 6 = hôm nay
        for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); weekDays.push(days.has(dayKey(d))) }
        const daysWeek = weekDays.filter(Boolean).length
        let streak = 0; const cur = new Date()
        if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1) // chưa tập hôm nay → đếm từ hôm qua
        while (days.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1) }
        setPracticeStats({ streak, daysWeek, weekMin, weekDays })
      })

    supabase.from('student_songs')
      .select('id,title,artist,tempo,status,created_at,journey,youtube_url')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMySongs((data ?? []).map((s: any) => ({
        ...s,
        journey: s.journey?.length ? s.journey : JOURNEY_STEPS.map((step: any) => ({ id: step.id, done: false }))
      }))))
    supabase.from('edu_lesson_progress')
      .select('lesson_id').eq('student_id', student.id)
      .then(({ data }) => {
        if (data) setCompletedIds(new Set(data.map((r: any) => r.lesson_id)))
      })
    supabase.from('edu_students').select('ht_member').eq('id', student.id).single()
      .then(({ data }) => setHtMember(!!(data as any)?.ht_member))
    supabase.rpc('get_effective_student_entitlement', { p_student_id: student.id })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data
        setEffectiveEntitlement(row?.effective_tier ?? 'free')
      })
    try { setLastOpenedCourse(localStorage.getItem('lastCourse:' + student.id)) } catch { /**/ }
    // Khoá có bài hoàn thành GẦN NHẤT → fallback cho "Học ngay" khi chưa có lastOpened
    supabase.from('edu_lesson_progress').select('lesson_id').eq('student_id', student.id).eq('completed', true)
      .order('completed_at', { ascending: false }).limit(1)
      .then(({ data }) => { const lid = (data ?? [])[0]?.lesson_id; if (lid) setLastDoneLesson(lid) })
  }, [student.id, guest])

  const openCourse = async (courseId: string, targetLessonId?: string) => {
    // HT: chặn mở khoá cấp trên khi chưa hoàn thành cấp dưới (lưới an toàn cho mọi lối vào)
    const code = enrollments.find(e => e.course_id === courseId)?.course?.code
    if (isSeqLocked(code)) return
    const courseForAccess = enrollments.find(e => e.course_id === courseId)?.course
    const courseAccess = resolveCourseAccess(courseForAccess ?? { is_free: true, status: 'on' }, effectiveTier, {
      legacyUnlocked: preview || freeCourses.has(courseId) || accessCourses.has(courseId) || ownedCourseIds.has(courseId),
      preview,
    })
    if (!courseAccess.visible) return
    if (!courseAccess.available) return
    setActiveCourseId(courseId)
    setReturnLessonId(null)   // vào khoá mới → bắt đầu từ đầu (chỉ cuộn-giữ-chỗ khi quay lại từ 1 bài)
    try { localStorage.setItem('lastCourse:' + student.id, courseId) } catch { /**/ }  // ghi khoá vừa mở → "Học ngay" resume đúng chỗ
    setLastOpenedCourse(courseId)
    const { data: mods } = await supabase.from('edu_modules')
      .select('*').eq('course_id', courseId).order('order_index')
    setModules(mods ?? [])
    if (mods?.length) {
      const { data: lsns } = await supabase.from('edu_course_lessons')
        .select('*').in('module_id', mods.map((m: Module) => m.id)).order('order_index')
      const parsed = (lsns ?? []).map((l: Lesson & {tools?: unknown}) => ({ ...l, tools: Array.isArray(l.tools) ? l.tools : [] }))
      setLessons(parsed)
      const ownedNow = preview || freeCourses.has(courseId) || accessCourses.has(courseId) || ownedCourseIds.has(courseId)
      // Mở THẲNG vào 1 bài cụ thể (nút Học tiếp / Học ngay) — nếu bài mở được
      if (targetLessonId) {
        const t = parsed.find(l => l.id === targetLessonId)
        const tAccess = t ? resolveLessonAccess(t, courseForAccess ?? { is_free: true, status: 'on' }, effectiveTier, { courseLegacyUnlocked: ownedNow, preview }) : null
        if (t && tAccess?.canAccess) { setReturnLessonId(t.id); setActiveLesson(t); setLessonTab('content'); try { setUsedToolIds(new Set(JSON.parse(localStorage.getItem(usedToolsKey(t.id)) || '[]'))) } catch { /**/ } setScreen('lesson'); return }
      }
      // Khoá elearn 1 bài → mở thẳng không qua màn hình danh sách (CHỈ khi đã sở hữu — khoá nền thiếu thì luôn dừng ở mục lục)
      if (parsed.length === 1 && parsed[0].lesson_type === 'link' && parsed[0].content_url?.startsWith('/lessons/')
        && resolveLessonAccess(parsed[0], courseForAccess ?? { is_free: true, status: 'on' }, effectiveTier, { courseLegacyUnlocked: ownedNow, preview }).canAccess) {
        setActiveLesson(parsed[0])
        setScreen('lesson')
        return
      }
    }
    setScreen('courses')
    // Nạp hành động (cho màu mốc) — RLS tự lọc theo user hiện tại
    supabase.from('student_action_logs').select('lesson_id, action_type').then(({ data }) => {
      const m: Record<string, Set<string>> = {}
      ;(data ?? []).forEach((r: any) => { if (r.lesson_id) { if (!m[r.lesson_id]) m[r.lesson_id] = new Set(); m[r.lesson_id].add(r.action_type) } })
      setLessonActionMap(m)
    })
  }

  const noteKey = (lessonId: string) => `note:${student.id}:${lessonId}`

  const openLesson = (l: Lesson) => {
    if (!isUnlocked(l)) return // khoá, không mở
    setReturnLessonId(l.id)   // nhớ để khi quay lại danh sách cuộn về đúng bài
    setActiveLesson(l)
    setLessonTab('content')
    // Khôi phục tool đã thực hành của bài này (nếu có) → không bị "khoá lại" khi mở lại
    try {
      const saved = JSON.parse(localStorage.getItem(usedToolsKey(l.id)) || '[]')
      setUsedToolIds(new Set(Array.isArray(saved) ? saved : []))
    } catch { setUsedToolIds(new Set()) }
    // Khôi phục ghi chú
    setNoteText(localStorage.getItem(noteKey(l.id)) ?? '')
    // Nạp hành động đã ghi nhận của bài này (RLS tự lọc theo user hiện tại)
    setLessonActions(new Set())
    supabase.from('student_action_logs').select('action_type').eq('lesson_id', l.id)
      .then(({ data }) => setLessonActions(new Set((data ?? []).map((r: any) => r.action_type))))
    setScreen('lesson')
  }

  // Ghi nhận "hành động thật" (đã thực hành / gửi bài) → event + XP (1 lần/bài/loại)
  const XP_ACTION: Record<string, number> = { practiced_lesson: 10, submitted_video_self_report: 50, reviewed_old_lesson: 5 }
  const logAction = async (actionType: string) => {
    if (!activeLesson || lessonActions.has(actionType) || actionBusy) return
    setActionBusy(actionType)
    if (guest) { requireLogin(); setActionBusy(null); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setActionBusy(null); return }
    const { error } = await supabase.from('student_action_logs')
      .insert({ user_id: user.id, action_type: actionType, lesson_id: activeLesson.id })
    if (error) { alert('Ghi nhận thất bại: ' + error.message); setActionBusy(null); return }
    const xp = XP_ACTION[actionType] ?? 0
    if (xp > 0) {
      const { error: xpErr } = await supabase.from('student_xp_log')
        .insert({ student_id: student.id, xp, source: actionType, ref_id: activeLesson.id })
      if (!xpErr) { setTotalXP(p => p + xp); setWeekXP(p => p + xp) }
    }
    setLessonActions(prev => new Set([...prev, actionType]))
    setLessonActionMap(prev => {
      const next = { ...prev }; const s = new Set(next[activeLesson.id] ?? []); s.add(actionType); next[activeLesson.id] = s; return next
    })
    setActionBusy(null)
  }

  const markComplete = async (lessonId: string) => {
    if (preview || guest) return   // tài khoản thầy xem khoá / khách free → không ghi tiến độ
    if (completedIds.has(lessonId) || markingDone) return
    setMarkingDone(true)
    // Kiểm tra đã có record chưa trước khi insert
    const { data: existing } = await supabase.from('edu_lesson_progress')
      .select('id,status').eq('student_id', student.id).eq('lesson_id', lessonId).maybeSingle()
    const { error } = existing
      ? await supabase.from('edu_lesson_progress')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabase.from('edu_lesson_progress')
          .insert({ student_id: student.id, lesson_id: lessonId, status: 'completed', completed_at: new Date().toISOString() })
    if (error) {
      console.error('Lỗi lưu tiến độ:', error)
      alert('Không lưu được tiến độ: ' + error.message)
      setMarkingDone(false)
      return
    }
    // Thưởng XP lần ĐẦU hoàn thành bài (không thưởng lại nếu trước đó đã 'completed')
    if (existing?.status !== 'completed') {
      const { error: xpErr } = await supabase.from('student_xp_log').insert({
        student_id: student.id, xp: XP_SOURCE.lesson, source: 'lesson', ref_id: lessonId,
      })
      if (xpErr) console.error('Ghi XP bài học lỗi:', xpErr)
      else { setTotalXP(prev => prev + XP_SOURCE.lesson); setWeekXP(prev => prev + XP_SOURCE.lesson) }
    }
    setCompletedIds(prev => new Set([...prev, lessonId]))
    setMarkingDone(false)
  }

  // Hoàn thành bài elearn: đánh dấu xong + ghi nhận "đã thực hành" (widget tương tác = thực hành)
  // → điểm hành trình lên 70 (cam), không chỉ 40 (đỏ "mới học")
  const finishElearnLesson = async (lessonId: string) => {
    await markComplete(lessonId)
    const acts = lessonActionMap[lessonId]
    if (!acts?.has('practiced_lesson')) {
      if (guest) return
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('student_action_logs')
          .insert({ user_id: user.id, action_type: 'practiced_lesson', lesson_id: lessonId })
        if (!error) {
          await supabase.from('student_xp_log')
            .insert({ student_id: student.id, xp: XP_ACTION.practiced_lesson, source: 'practiced_lesson', ref_id: lessonId })
          setTotalXP(p => p + XP_ACTION.practiced_lesson)
          setWeekXP(p => p + XP_ACTION.practiced_lesson)
          setLessonActionMap(prev => {
            const next = { ...prev }; const s = new Set(next[lessonId] ?? []); s.add('practiced_lesson'); next[lessonId] = s; return next
          })
        }
      }
    }
    goBack()
  }

  const goBack = () => screen === 'lesson' ? setScreen(activeSubject ? 'journey' : 'courses') : (setScreen('home'), setActiveCourseId(null))

  // Quay lại danh sách bài → cuộn về ĐÚNG bài vừa học (không nhảy về đầu khoá)
  useEffect(() => {
    if (screen !== 'courses' || !returnLessonId) return
    const id = returnLessonId
    const t = window.setTimeout(() => {
      document.getElementById('ls-' + id)?.scrollIntoView({ block: 'center', behavior: 'auto' })
      setReturnLessonId(null)
    }, 60)
    return () => window.clearTimeout(t)
  }, [screen, returnLessonId])

  // Journey: tự cuộn ngang tới bài hiện tại (không bắt vuốt từ Bài 1 mỗi lần)
  useEffect(() => {
    if (screen !== 'journey' || !activeSubject) return
    const t = window.setTimeout(() => {
      const el = document.querySelector('[data-jlcur="1"]') as HTMLElement | null
      if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [screen, activeSubject, journeyLessons.length])

  // % hoàn thành của 1 khoá
  const courseProgress = (courseId: string) => {
    const courseLessons = lessons.filter(l => {
      const mod = modules.find(m => m.id === l.module_id)
      return !!mod
    })
    if (!courseLessons.length) return 0
    const done = courseLessons.filter(l => completedIds.has(l.id)).length
    return Math.round((done / courseLessons.length) * 100)
  }

  const handleTap = () => {
    const now = Date.now()
    tapTimes.current.push(now)
    if (tapTimes.current.length > 8) tapTimes.current.shift()
    if (tapTimes.current.length > 1) {
      const diffs = tapTimes.current.slice(1).map((t, i) => t - tapTimes.current[i])
      setBpm(Math.round(60000 / (diffs.reduce((a, b) => a + b) / diffs.length)))
    }
    setTapCount(c => c + 1)
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => { tapTimes.current = []; setTapCount(0) }, 3000)
  }

  const [pwDraft, setPwDraft] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const changePassword = async () => {
    const v = pwDraft.trim()
    if (v.length < 6) { setPwMsg('Mật khẩu cần ít nhất 6 ký tự'); return }
    setSavingPw(true); setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: v })
    setSavingPw(false)
    if (error) { setPwMsg('Lỗi: ' + error.message); return }
    setPwDraft(''); setPwMsg('✓ Đã đổi mật khẩu thành công')
  }
  const openSettings = () => { setNameDraft(uname(me)); setShowSettings(true); setPwDraft(''); setPwMsg('') }
  const saveDisplayName = async () => {
    const v = nameDraft.trim()
    if (!v) return
    setSavingProfile(true)
    const { error } = await supabase.from('edu_students').update({ display_name: v }).eq('id', me.id)
    setSavingProfile(false)
    if (error) { alert('Lưu tên thất bại: ' + error.message); return }
    setMe(prev => ({ ...prev, display_name: v }))
  }
  const uploadAvatar = async (file: File) => {
    setSavingProfile(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${me.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) { alert('Lỗi tải ảnh: ' + upErr.message); setSavingProfile(false); return }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: avatarErr } = await supabase.from('edu_students').update({ avatar_url: pub.publicUrl }).eq('id', me.id)
      if (avatarErr) { alert('Cập nhật ảnh đại diện thất bại: ' + avatarErr.message); setSavingProfile(false); return }
      setMe(prev => ({ ...prev, avatar_url: pub.publicUrl }))
    } catch (e: any) {
      alert('Lỗi: ' + (e?.message ?? e))
    }
    setSavingProfile(false)
  }

  // Sắp xếp theo sort_order; policy mới ẩn khóa khi Admin set hidden.
  const visibleEnrollments = enrollments.filter(e => resolveCourseAccess(e.course, effectiveTier, {
    legacyUnlocked: preview || freeCourses.has(e.course_id) || accessCourses.has(e.course_id) || ownedCourseIds.has(e.course_id),
    preview,
  }).visible)
  const sortedEnrollments = [...visibleEnrollments].sort((a, b) => {
    const aa = resolveCourseAccess(a.course, effectiveTier, { legacyUnlocked: preview || freeCourses.has(a.course_id) || accessCourses.has(a.course_id) || ownedCourseIds.has(a.course_id), preview })
    const ba = resolveCourseAccess(b.course, effectiveTier, { legacyUnlocked: preview || freeCourses.has(b.course_id) || accessCourses.has(b.course_id) || ownedCourseIds.has(b.course_id), preview })
    const ap = aa.available ? 0 : 1
    const bp = ba.available ? 0 : 1
    if (ap !== bp) return ap - bp
    return (a.course?.sort_order ?? 99) - (b.course?.sort_order ?? 99)
  })
  // Khoá "Học ngay": available ưu tiên, coming soon nằm sau.
  const mainCourse = sortedEnrollments.find(e => resolveCourseAccess(e.course, effectiveTier, { legacyUnlocked: preview || freeCourses.has(e.course_id) || accessCourses.has(e.course_id) || ownedCourseIds.has(e.course_id), preview }).available)
    ?? sortedEnrollments[0]
  const name = uname(me)

  // Dùng thẳng dbTools — admin tắt công cụ nào thì ẩn luôn, không fallback hardcode
  const displayTools = dbTools

  const Pill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      background: active ? L.p1 : L.surface2, color: active ? L.tinv : L.t2,
      border: `1px solid ${active ? L.p1 : L.border}`, borderRadius: 20,
      padding: '7px 16px', fontSize: 14, fontWeight: active ? 600 : 400,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
    }}>{label}</button>
  )

  // % hiển thị ở home cho mainCourse
  const mainProgress = mainCourse && lessons.length > 0 ? courseProgress(mainCourse.course_id) : null

  // ── HAI NÚT: "Học tiếp" (theo thứ tự hành trình) vs "Học ngay" (resume chỗ dang dở) ──
  const codeByCourse: Record<string, string> = {}
  enrollments.forEach(e => { const c = (e.course?.code || '').trim().toUpperCase(); if (c) codeByCourse[e.course_id] = c })
  const courseSeqLocked = (cid?: string | null) => !!cid && isSeqLocked(codeByCourse[cid])
  const nextLessonOf = (cid?: string | null) => cid ? masterPath.find(m => m.courseId === cid && !completedIds.has(m.id)) : undefined
  // Học tiếp = bài chưa xong ĐẦU TIÊN theo thứ tự giáo trình, BỎ QUA khoá đang khoá (seq-lock HT)
  const journeyNext = masterPath.find(m => !completedIds.has(m.id) && !courseSeqLocked(m.courseId))
  // Học ngay = khoá dang dở gần nhất còn học được (localStorage → bài hoàn thành gần nhất → journey → mainCourse)
  const canResume = (cid?: string | null) => !!cid && sortedEnrollments.some(e => e.course_id === cid) && !courseSeqLocked(cid) && !!nextLessonOf(cid)
  const resumeCourseId = [lastOpenedCourse, masterPath.find(m => m.id === lastDoneLesson)?.courseId, journeyNext?.courseId, mainCourse?.course_id].find(canResume) ?? undefined
  const resumeLesson = nextLessonOf(resumeCourseId)
  const resumeCourse = sortedEnrollments.find(e => e.course_id === resumeCourseId)
  const courseProgressStats = (courseId: string) => {
    const ids = courseLessonIds[courseId]
    if (!ids || ids.length === 0) return null
    const done = ids.filter(id => completedIds.has(id)).length
    return { done, total: ids.length, pct: Math.round((done / ids.length) * 100) }
  }
  const courseAccessOf = (e: Enrollment) => resolveCourseAccess(e.course, effectiveTier, {
    legacyUnlocked: preview || freeCourses.has(e.course_id) || accessCourses.has(e.course_id) || ownedCourseIds.has(e.course_id),
    preview,
  })
  const learnRows = LEARN_TRACKS.map(row => ({
    ...row,
    items: sortedEnrollments.filter(e => learnTrackKey(e.course) === row.key),
  })).filter(row => row.items.length > 0)
  const otherLearnItems = sortedEnrollments.filter(e => !LEARN_TRACKS.some(row => row.key === learnTrackKey(e.course)))
  if (otherLearnItems.length > 0) {
    learnRows.push({ key: 'khac', title: 'Khác', hint: 'Các khóa còn lại', items: otherLearnItems })
  }

  // ── HÀNH TRÌNH NGANG theo MÔN (aggregation, không đổi canonical) ──
  // Danh sách môn cho màn chọn: 4 môn chuẩn + "Khác" nếu có khoá lệch track (không để mất nội dung).
  const SUBJECTS = [...LEARN_TRACKS, { key: 'khac', title: 'Khác', hint: 'Các khoá còn lại' }]
    .filter(s => sortedEnrollments.some(e => journeySubjectKey(e.course) === s.key))
  const subjectCourseFor = (key: string) => sortedEnrollments.find(e => journeySubjectKey(e.course) === key)?.course ?? null
  const journeyOf = (key: string) => journeyLessons.filter(j => j.subjectKey === key)  // đã sort course→module→lesson
  // Access THẬT cho 1 bài trong hành trình — reuse resolver production (KHÔNG rule riêng)
  const lessonAccessOf = (jl: JourneyLesson) => resolveLessonAccess(jl, courseById.get(jl.courseId) ?? { is_free: true, status: 'on' }, effectiveTier, {
    courseLegacyUnlocked: preview || freeCourses.has(jl.courseId) || accessCourses.has(jl.courseId) || ownedCourseIds.has(jl.courseId),
    preview,
  })
  const subjectProgress = (key: string) => {
    const items = journeyOf(key)
    if (items.length === 0) return null
    const done = items.filter(j => completedIds.has(j.id)).length
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
  }
  // Tone nhận diện theo Level (index course trong môn) — Level đổi màu tạo cảm giác "vùng mới"
  const LEVEL_TONES = ['#4338CA', '#0891B2', '#15803D', '#D97706', '#7C3AED', '#BE185D']
  const openJourneyLesson = (jl: JourneyLesson) => {
    const a = lessonAccessOf(jl)
    if (!a.visible) return
    if (!a.available) return                    // sắp có → không mở
    if (!a.canAccess) { openUpgrade(); return } // khoá theo gói → nâng gói (flow hiện tại)
    if (isSeqLocked(jl.courseCode)) return       // khoá tuần tự HT → không mở
    openCourse(jl.courseId, jl.id)               // available → mở thẳng player production
  }

  return (
    <>
    {/* ── Finger Exercise overlay (fullscreen, position:fixed) ── */}
    {showFingerExercise && (
      <FingerExercise
        totalMinutes={practiceTotals['finger'] ?? 0}
        onClose={async () => {
          await stopTimer(currentLessonToolId ?? undefined)
          setShowFingerExercise(false)
          setCurrentLessonToolId(null)
        }}
      />
    )}

    {showScaleExercise && (
      <ScaleExercise
        totalMinutes={practiceTotals['scale'] ?? 0}
        onClose={async () => {
          await stopTimer(currentLessonToolId ?? undefined)
          setShowScaleExercise(false)
          setCurrentLessonToolId(null)
        }}
      />
    )}

    {showArpExercise && (
      <ArpeggioExercise
        totalMinutes={practiceTotals['arpeggio'] ?? 0}
        onClose={async () => {
          await stopTimer(currentLessonToolId ?? undefined)
          setShowArpExercise(false)
          setCurrentLessonToolId(null)
        }}
      />
    )}

    {showGroove && (
      <GrooveExercise
        onClose={async () => {
          await stopTimer(currentLessonToolId ?? undefined)
          setShowGroove(false)
          setCurrentLessonToolId(null)
        }}
      />
    )}

    {showBMS && (
      <SongBuilderPage embedded initial={bmsInit} onClose={() => setShowBMS(false)} />
    )}

    {showMetronome && (
      <Metronome initialBpm={metronomeBpm} onClose={() => setShowMetronome(false)} />
    )}

    {/* Trang con của tab Sống (Band · Cộng đồng · Đại hội · Nhóm lớp) */}
    {livePage && (
      <LivePageView page={livePage} groups={communityGroups} onClose={() => setLivePage(null)} />
    )}

    {showPiano && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
        <PianoJourney onClose={() => setShowPiano(false)} studentName={me.display_name ?? me.full_name ?? undefined} />
      </div>
    )}

    {celebrate && (
      <div onClick={() => setCelebrate(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s ease' }}>
        <div style={{ background: L.surface, borderRadius: 24, padding: '28px 32px', textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.25)', maxWidth: 320, margin: 16, animation: 'popIn .35s cubic-bezier(.18,.89,.32,1.28)' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>{celebrate.mastered ? '👑' : '🎉'}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: celebrate.mastered ? L.green : L.p1, marginBottom: 4 }}>
            {celebrate.mastered ? 'Chinh phục thành công!' : 'Hoàn thành bước!'}
          </div>
          <div style={{ fontSize: 14, color: L.t2, marginBottom: 14, lineHeight: 1.4, ...clamp2 }}>{celebrate.title}</div>
          <div style={{ display: 'inline-block', background: '#D9770618', color: '#D97706', fontWeight: 800, fontSize: 16, padding: '6px 16px', borderRadius: 99 }}>+{celebrate.xp} XP</div>
        </div>
        <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes popIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}`}</style>
      </div>
    )}
    <div style={{
      maxWidth: 430, margin: '0 auto', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: L.bg, fontFamily: '"SF Pro Display", "DM Sans", system-ui, sans-serif',
      color: L.t1, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>

        {/* ── TRANG CHỦ — trang cá nhân "sống" (read-only: XEM · CẢM NHẬN · KẾT NỐI). Không CTA học/luyện, không chuông, không dashboard. */}
        {tab === 'home' && (() => {
          const trinhDo = guest ? 'Khách' : (LEVEL_VI[me.level ?? ''] ?? 'Học viên')
          const goiLabel = ENTITLEMENT_TIER_LABEL[effectiveTier]
          const journeySubjects = SUBJECTS.filter(s => journeyOf(s.key).length > 0)
          const rhythm = practiceStats
          const hasRhythm = rhythm.daysWeek > 0 || rhythm.weekMin > 0
          return (
          <div style={{ paddingBottom: 8 }}>
            {/* HomeProfileHero — COVER + HỒ SƠ (profile-first; cover fallback gradient, chưa có canonical cover) */}
            <div style={{ position: 'relative' }}>
              <div style={{ height: 'calc(150px + env(safe-area-inset-top, 0px))', background: 'linear-gradient(135deg, #4338CA 0%, #7C3AED 55%, #EA580C 120%)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: 8, fontSize: 150, opacity: .1, color: '#fff', transform: 'rotate(-14deg)', lineHeight: 1 }}>🎸</div>
              </div>
              <div style={{ padding: '0 18px', marginTop: -44, textAlign: 'center', position: 'relative' }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', margin: '0 auto', background: L.p2, border: `4px solid ${L.bg}`, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 900, color: L.p1, overflow: 'hidden', boxShadow: L.shadow }}>
                  {me.avatar_url ? <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: L.t1, marginTop: 10, ...clamp1 }}>{name}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: L.t2, marginTop: 3 }}>{trinhDo} · {goiLabel}</div>
              </div>
            </div>

            {/* HomeJourneyCard — HÀNH TRÌNH CỦA BẠN (read-only "con đường"; KHÔNG CTA học) */}
            {journeySubjects.length > 0 && (
              <section style={{ margin: '26px 18px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: L.t1, marginBottom: 12, textAlign: 'left' }}>Hành trình của bạn</div>
                <div style={{ background: L.surface, borderRadius: 20, boxShadow: L.shadow, padding: '8px 16px' }}>
                  {journeySubjects.map((s, i) => {
                    const p = subjectProgress(s.key)
                    const pct = p ? p.pct : 0
                    const started = !!(p && p.done > 0)
                    const done = !!(p && p.done >= p.total)
                    const status = done ? 'Đã đi hết' : started ? 'Đang đi' : 'Chưa bắt đầu'
                    const tone = LEVEL_TONES[i % LEVEL_TONES.length]
                    return (
                      <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${L.border}` }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: started ? tone : L.surface2, border: `2px solid ${started ? tone : L.border}`, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: L.t1, ...clamp1 }}>{s.title}</div>
                          <div style={{ marginTop: 6, height: 6, background: L.p2, borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: started ? tone : L.t3, flexShrink: 0 }}>{status}</div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* HomeNewsFeed — BẢN TIN HÔM NAY (UI-only; mock tách riêng HOME_FEED_MOCK, Phase 2 thay data source) */}
            <section style={{ margin: '26px 18px 0' }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: L.t1, marginBottom: 12, textAlign: 'left' }}>Bản tin hôm nay</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {HOME_FEED_MOCK.map((it, i) => (
                  <div key={i} style={{ background: L.surface, borderRadius: 18, boxShadow: L.shadow, overflow: 'hidden', display: 'flex', alignItems: 'stretch', textAlign: 'left' }}>
                    <div style={{ width: 92, flexShrink: 0, background: `linear-gradient(135deg, ${it.tone}, ${it.tone}bb)`, display: 'grid', placeItems: 'center', fontSize: 30 }}>{it.icon}</div>
                    <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: it.tone, textTransform: 'uppercase', letterSpacing: '.04em' }}>{it.kicker}</div>
                      <div style={{ fontSize: 14.5, fontWeight: 900, color: L.t1, lineHeight: 1.25, marginTop: 3, ...clamp2 }}>{it.title}</div>
                      <div style={{ fontSize: 12.5, color: L.t2, marginTop: 4, ...clamp1 }}>{it.summary}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* HomeMusicRhythm — NHỊP SỐNG (chỉ khi có data THẬT từ practiceStats; không fake số) */}
            {hasRhythm && (
              <section style={{ margin: '26px 18px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: L.t1, marginBottom: 12, textAlign: 'left' }}>Nhịp sống âm nhạc</div>
                <div style={{ background: L.surface, borderRadius: 20, boxShadow: L.shadow, padding: 16, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, color: L.t1, fontWeight: 800 }}>{rhythm.daysWeek} ngày chơi đàn tuần này{rhythm.weekMin > 0 ? ` · ${rhythm.weekMin} phút` : ''}</div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
                    {(rhythm.weekDays.length === 7 ? rhythm.weekDays : [false, false, false, false, false, false, false]).map((on, i) => (
                      <div key={i} style={{ flex: 1, height: 30, borderRadius: 8, background: on ? L.p1 : L.p2 }} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
          )
        })()}

        {/* ── HOME (tab Học) ──────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'home' && (
          <>
            <div style={{ padding: 'max(26px, calc(env(safe-area-inset-top, 0px) + 12px)) 18px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: L.p1, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: L.shadow }}>
                  <NavIcon name="hoc" color="#fff" size={22} />
                </div>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: L.t3, fontWeight: 800, letterSpacing: '.04em' }}>THẦY VĂN ANH GUITAR</div>
                  <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: L.t1, letterSpacing: 0 }}>Học</div>
                </div>
              </div>
              <div style={{ marginTop: 7, color: L.t2, fontSize: 13.5, lineHeight: 1.45 }}>Chọn một môn để vào hành trình học — vuốt ngang, học từng bài.</div>
            </div>

            {SUBJECTS.length > 0 ? (
              <div style={{ padding: '4px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {SUBJECTS.map(sub => {
                  const prog = subjectProgress(sub.key)
                  // State NGẮN — không tổng bài, không keyword marketing
                  const state = prog
                    ? prog.done >= prog.total ? 'Đã học xong' : prog.done > 0 ? 'Tiếp tục hành trình' : 'Bắt đầu hành trình'
                    : 'Sắp có'
                  return (
                    <button key={sub.key}
                      onClick={() => { setActiveSubject(sub.key); setSelectedLessonId(null); setActiveLevel(null); setNoteSaved(false); setScreen('journey') }}
                      style={{ position: 'relative', width: '100%', height: 136, border: 'none', borderRadius: 22, overflow: 'hidden', padding: 0, cursor: 'pointer', fontFamily: 'inherit', boxShadow: L.shadowLg, textAlign: 'left' }}>
                      {/* Nền gradient SẠCH theo môn — KHÔNG dùng ảnh course (bỏ giant ĐH/TN) */}
                      <div style={{ position: 'absolute', inset: 0, ...courseFallbackStyle({ track: sub.key } as CourseSummary) }} />
                      {/* icon nhỏ tinh tế góc phải */}
                      <div style={{ position: 'absolute', top: 14, right: 16, width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', fontSize: 21 }}>🎸</div>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,24,39,0) 30%, rgba(17,24,39,.55) 100%)' }} />
                      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: '#fff' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 900, opacity: .8, letterSpacing: '.06em', textTransform: 'uppercase' }}>Hành trình</div>
                        <div style={{ fontSize: 25, fontWeight: 900, lineHeight: 1.1, marginTop: 3 }}>{sub.title}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, opacity: .95, marginTop: 5 }}>{state}</div>
                      </div>
                      {prog && prog.total > 0 && prog.done > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'rgba(255,255,255,.22)' }}>
                          <div style={{ width: `${prog.pct}%`, height: '100%', background: '#fff' }} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ margin: '24px 18px', background: L.surface, borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: L.shadow }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>{guest ? 'Bắt đầu miễn phí' : 'Hành trình chưa bắt đầu'}</div>
                <div style={{ fontSize: 14, color: L.t2, lineHeight: 1.7 }}>{guest ? 'Bạn có thể xem các phần miễn phí trước khi đăng nhập hoặc nâng gói.' : 'Thầy sẽ thêm bạn vào khoá học sau buổi học đầu tiên.'}</div>
              </div>
            )}
          </>
        )}

        {/* ── COURSES (danh sách bài học) ──────────────────────────────── */}
        {tab === 'hoc' && screen === 'courses' && (
          <>
            <div style={{ background: L.surface, padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 16px', boxShadow: '0 1px 0 ' + L.border }}>
              <button onClick={goBack} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, marginBottom: 12 }}>‹</button>
              <div style={{ fontWeight: 800, fontSize: 20 }}>Danh sách bài học</div>
              {/* ── Cảnh báo thiếu khoá nền tảng (vào DH2 mà chưa có DH1/NL1…) ── */}
              {activeCourseId && (() => {
                const cur = enrollments.find(e => e.course_id === activeCourseId)?.course
                const owned = new Set(enrollments.map(e => (e.course?.code || '').trim().toUpperCase()).filter(Boolean))
                const miss = missingPrereqs(cur?.code, owned)
                if (miss.length === 0) return null
                const names = miss.map(c => tenNangLuc(c) || c)
                return (
                  <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <div style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.55 }}>
                      <b>Thiếu nền tảng.</b> Bạn chưa học {names.length > 1 ? 'các khoá' : 'khoá'} <b>{names.join(' · ')}</b> — nền tảng của khoá này. Nên học bổ sung {names.length > 1 ? 'các khoá đó' : 'khoá đó'} để theo kịp và chơi vững hơn.
                    </div>
                  </div>
                )
              })()}
              {/* ── Khoá NỀN chưa mở (đặc cách) — chỉ lộ mục lục, khuyến khích học bổ sung (§6) ── */}
              {activeCourseId && foundationGaps.some(g => g?.id === activeCourseId) && (
                <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '13px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.55 }}>
                    <b>Khoá nền — bạn chưa mở.</b> Đây là nền tảng cho khoá bạn đang học. Bạn xem trước được mục lục dưới đây; hãy học bổ sung khoá này để chắc gốc và theo kịp. Liên hệ thầy để mở khoá.
                  </div>
                </div>
              )}
              {/* Progress summary — không hiện cho khoá nền chưa mở */}
              {activeCourseId && lessons.length > 0 && !foundationGaps.some(g => g?.id === activeCourseId) && (() => {
                const done = lessons.filter(l => completedIds.has(l.id)).length
                const pct  = Math.round((done / lessons.length) * 100)
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: L.t2, marginBottom: 5 }}>
                      <span>{done}/{lessons.length} bài đã học</span>
                      <span style={{ fontWeight: 700, color: L.p1 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: L.p2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${L.p1}, #6366F1)`, width: `${pct}%`, transition: 'width .3s' }} />
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ── Bản đồ hành trình (ẩn cho khoá nền chưa mở — chỉ lộ mục lục) ── */}
            {activeCourseId && sortedLessons.length > 0 && !foundationGaps.some(g => g?.id === activeCourseId) && (() => {
              const total = sortedLessons.length
              const completedCount = sortedLessons.filter(l => completedIds.has(l.id)).length
              let curIdx = sortedLessons.findIndex(l => !completedIds.has(l.id))
              if (curIdx < 0) curIdx = total - 1
              const posLabel = Math.min(completedCount + 1, total)
              const W = 9
              let start = Math.max(0, curIdx - Math.floor(W / 2))
              const end = Math.min(total, start + W)
              start = Math.max(0, end - W)
              const win = sortedLessons.slice(start, end)
              const nextLesson = sortedLessons.find(l => !completedIds.has(l.id) && isUnlocked(l))
              const redLesson  = sortedLessons.find(l => completedIds.has(l.id) && lessonScore(l) <= 40)
              return (
                <div style={{ background: L.surface, margin: '0 16px 8px', borderRadius: 18, padding: 16, boxShadow: L.shadow }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>Tiến độ khóa này</span>
                    <span style={{ fontSize: 13, color: L.t2 }}>Mốc <b style={{ color: L.p1 }}>{posLabel}</b>/{total}</span>
                  </div>
                  {/* dải mốc + path gradient */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
                    <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 4, borderRadius: 99, background: 'linear-gradient(90deg,#EF4444,#F59E0B,#22C55E)', opacity: .25, transform: 'translateY(-50%)' }} />
                    {win.map((l) => {
                      const col = scoreColor(lessonScore(l))
                      const isCur = l.id === sortedLessons[curIdx].id
                      const locked = !isUnlocked(l) && !completedIds.has(l.id)
                      return (
                        <div key={l.id} onClick={() => { if (!locked) openLesson(l) }}
                          style={{ position: 'relative', zIndex: 1, cursor: locked ? 'default' : 'pointer' }}>
                          <div style={{
                            width: isCur ? 22 : 16, height: isCur ? 22 : 16, borderRadius: '50%',
                            background: locked ? '#E5E7EB' : col,
                            border: isCur ? `3px solid ${L.p1}` : '2px solid #fff',
                            boxShadow: isCur ? `0 0 0 3px ${col}55` : '0 1px 3px rgba(0,0,0,.18)',
                          }} />
                        </div>
                      )
                    })}
                  </div>
                  {/* chú thích màu */}
                  <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 10, fontSize: 11, color: L.t3 }}>
                    <span><span style={{ color: '#EF4444' }}>●</span> Mới học</span>
                    <span><span style={{ color: '#F59E0B' }}>●</span> Đã luyện</span>
                    <span><span style={{ color: '#22C55E' }}>●</span> Chắc</span>
                  </div>
                  {/* việc tiếp theo */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${L.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: L.t3, marginBottom: 8, letterSpacing: '.04em' }}>VIỆC TIẾP THEO</div>
                    {nextLesson ? (
                      <button onClick={() => openLesson(nextLesson)}
                        style={{ width: '100%', textAlign: 'left', background: L.p2, border: 'none', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: L.p1, lineHeight: 1.35, ...clamp2 }}>Học: {nextLesson.title}</span>
                        <span style={{ color: L.p1 }}>›</span>
                      </button>
                    ) : (
                      <div style={{ fontSize: 15, fontWeight: 700, color: L.green }}>Bạn đã hoàn thành tất cả bài trong khóa!</div>
                    )}
                    {redLesson && (
                      <button onClick={() => openLesson(redLesson)}
                        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: '1px dashed #EF444466', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: L.t2, lineHeight: 1.4, ...clamp2 }}>Củng cố cho chắc: <b style={{ color: L.t1 }}>{redLesson.title}</b></span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            <div style={{ padding: '16px' }}>
              {(() => {
                const todo = lessons.filter(l => { const n = skillMap[l.id]; return n > 0 && n < 3 }).slice(0, 3)
                if (!todo.length) return null
                return (
                  <div style={{ background: '#EEF2FF', border: '1px solid #C7CBF0', borderRadius: 14, padding: '12px 14px', marginBottom: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#4338CA', marginBottom: 8 }}>🎯 Việc nên làm hôm nay</div>
                    {todo.map(l => (
                      <div key={l.id} onClick={() => openLesson(l)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', cursor: 'pointer' }}>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4, marginRight: 8, ...clamp2 }}>Ôn <b>{l.title}</b></span>
                        <span style={{ fontSize: 12, color: '#4338CA', fontWeight: 700, flexShrink: 0 }}>còn {3 - skillMap[l.id]} phiên →</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6, lineHeight: 1.5 }}>Mỗi ngày xanh hóa 1–2 bài là đẹp. Nghỉ 1–2 phút sau mỗi phiên.</div>
                  </div>
                )
              })()}
              {modules.map(mod => (
                <div key={mod.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 4px 10px' }}>{mod.name}</div>
                  {lessons.filter(l => l.module_id === mod.id).sort((a, b) => a.order_index - b.order_index).map((l) => {
                    const icons: Record<string, string> = { video: '▶️', text: '📄', slide: '🖼', quiz: '❓', tap: '🥁', metronome: '🎵', backing_track: '🎧', submit_video: '📹' }
                    const access = resolveLesson(l)
                    if (!access.visible) return null
                    const done       = completedIds.has(l.id)
                    const policyLocked = !access.canAccess
                    const seqLocked  = !isSequentiallyUnlocked(l.id)
                    const locked     = policyLocked || seqLocked
                    const isCurrent  = !done && !locked
                    return (
                      <div key={l.id} id={'ls-' + l.id} onClick={() => { if (access.reason === 'requires_upgrade') explainUpgrade(); else if (!seqLocked && access.canAccess) openLesson(l) }}
                        style={{ background: L.surface, borderRadius: 14, padding: '14px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: access.reason === 'requires_upgrade' || !locked ? 'pointer' : 'default', marginBottom: 8, border: `2px solid ${isCurrent ? L.p1 : 'transparent'}`, opacity: locked ? .5 : 1, position: 'relative' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: done ? L.greenBg : isCurrent ? L.p2 : L.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                          {done ? '✅' : locked ? '🔒' : (icons[l.lesson_type] ?? '📄')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, ...clamp2, lineHeight: 1.35, color: done ? L.green : locked ? L.t3 : L.t1 }}>{l.title}</div>
                          {seqLocked && !policyLocked && (
                            <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>Hoàn thành bài trước để mở khoá</div>
                          )}
                          {access.reason === 'requires_upgrade' && (
                            <div style={{ fontSize: 11, color: L.gold, fontWeight: 600, marginTop: 2 }}>🔒 Cần {ENTITLEMENT_TIER_LABEL[access.requiredTier]} để mở bài này →</div>
                          )}
                          {access.reason === 'coming_soon' && (
                            <div style={{ fontSize: 11, color: L.gold, fontWeight: 600, marginTop: 2 }}>Sắp có</div>
                          )}
                          {isCurrent && !skillMap[l.id] && (
                            <div style={{ fontSize: 11, color: L.p1, fontWeight: 600, marginTop: 2 }}>▶ Học tiếp theo</div>
                          )}
                          {skillMap[l.id] > 0 && (() => {
                            const n = skillMap[l.id]
                            const c = n >= 3 ? { dot: '🟢', col: '#16A34A', t: 'Thành thạo' } : n === 2 ? { dot: '🟡', col: '#D97706', t: 'Đang ổn định' } : { dot: '🔴', col: '#DC2626', t: 'Cần luyện thêm' }
                            return <div style={{ fontSize: 11, color: c.col, fontWeight: 600, marginTop: 2 }}>{c.dot} {c.t} · {Math.min(n, 3)}/3 phiên{n < 3 ? ' để xanh hóa' : ''}</div>
                          })()}
                        </div>
                        {!locked && !done && <span style={{ color: L.p1, fontSize: 18 }}>›</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
              {lessons.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: L.t3 }}>
                  Khoá học chưa có bài nào
                </div>
              )}
            </div>
          </>
        )}

        {/* ── LESSON ──────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'lesson' && activeLesson && (
          <>
            {/* Flow Player — fullScreen=true → FlowPlayer tự dùng position:fixed, tránh bug iOS WebKit */}
            {activeLesson.lesson_type === 'native' ? (
              (() => {
                const key = (activeLesson.content_url || activeLesson.content || '').trim()
                const entry = NATIVE_LESSONS[key]
                if (!entry) return <div style={{ padding: 24, color: L.t2 }}>Bài học chưa cấu hình đúng (native: {key || '—'}).<br /><button onClick={goBack} style={{ marginTop: 12 }}>‹ Quay lại</button></div>
                const C = entry.Component
                return <C onClose={goBack} onComplete={() => markComplete(activeLesson.id)} studentId={preview || guest ? undefined : student.id} lessonId={activeLesson.id} />
              })()
            ) : activeLesson.lesson_type === 'strum' ? (
              <ChordStrumPlayer song={configToSong(parseStrumConfig(activeLesson.content), activeLesson.title)} onClose={goBack} onComplete={() => markComplete(activeLesson.id)} studentId={preview || guest ? undefined : student.id} lessonId={activeLesson.id} />
            ) : activeLesson.lesson_type === 'flow' ? (
              <FlowPlayer
                lessonId={activeLesson.id}
                studentId={guest ? undefined : student.id}
                onComplete={() => markComplete(activeLesson.id)}
                onBack={goBack}
                fullScreen
                onLogAction={logAction}
                doneActions={lessonActions}
                actionBusy={actionBusy}
                onOpenTool={(tool) => {
                  const map: Record<string, [string, string]> = {
                    tuner:          ['/tuner', 'Tuner — Lên dây'],
                    tempo:          ['/metronome', 'Máy đập nhịp'],
                    guitarboard:    ['/guitarboard', 'Bảng phím / Tab'],
                    chords:         ['/chords', 'Chord See — Nghe hợp âm'],
                    tap:            ['/tap', 'Tập gõ nhịp'],
                    'song-builder': ['/song-builder', 'Song Builder'],
                  }
                  const [route, name] = map[tool] ?? map.tuner
                  openTool(route, name, tool)
                }}
              />
            ) : (
            <>
            <div style={{ background: L.surface, padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 0', boxShadow: '0 1px 0 ' + L.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <button onClick={goBack} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, flexShrink: 0 }}>‹</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, ...clamp2, lineHeight: 1.3 }}>{activeLesson.title}</div>
                </div>
                {/* Trạng thái hoàn thành */}
                {completedIds.has(activeLesson.id)
                  ? <span style={{ fontSize: 20 }}>✅</span>
                  : <span style={{ fontSize: 14, color: L.t3 }}>Chưa học</span>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, paddingBottom: 14 }}>
                <Pill label="Nội dung" active={lessonTab === 'content'} onClick={() => setLessonTab('content')} />
                <Pill label="Ghi chú"  active={lessonTab === 'note'}    onClick={() => setLessonTab('note')}    />
              </div>
            </div>

            {/* Video */}
            {activeLesson.lesson_type !== 'flow' && activeLesson.lesson_type === 'video' && getYtId(activeLesson.content_url) && (
              <div style={{ aspectRatio: '16/9', background: '#000' }}>
                <iframe src={`https://www.youtube.com/embed/${getYtId(activeLesson.content_url)}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              </div>
            )}

            {/* Slide Canva — nút mở trình duyệt ngoài (không dùng iframe vì cross-origin) */}
            {activeLesson.lesson_type === 'slide' && activeLesson.content_url && (
              <div style={{ margin: '0 16px 4px', background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)', borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.4 }}>{activeLesson.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>Slide Canva — mở toàn màn hình để xem</div>
                <button
                  onClick={() => window.open(normalizeCanvaUrl(activeLesson.content_url!), '_system')}
                  style={{ background: '#4338CA', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Mở slide Canva ↗
                </button>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Xem xong bấm nút quay lại để tiếp tục</div>
              </div>
            )}

            {/* Link / Elearn */}
            {activeLesson.lesson_type !== 'flow' && activeLesson.lesson_type === 'link' && activeLesson.content_url && (() => {
              // Bài elearn (content {"elearn":true,"num":X}) → render component native
              let elearnNum: number | null = null
              try {
                const c = typeof activeLesson.content === 'string' ? JSON.parse(activeLesson.content) : activeLesson.content
                if (c?.elearn && c?.num) elearnNum = c.num
              } catch { /* không phải elearn */ }

              if (elearnNum != null) {
                return (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#F6F2EA' }}>
                    <ElearnLessonView
                      key={activeLesson.id}
                      num={elearnNum}
                      title={activeLesson.title}
                      studentName={me.display_name ?? me.full_name}
                      isDone={completedIds.has(activeLesson.id)}
                      onBack={goBack}
                      onComplete={() => finishElearnLesson(activeLesson.id)}
                      onOpenTool={(tool) => openTool(tool === 'tuner' ? '/tuner' : '/metronome', tool === 'tuner' ? 'Tuner — Lên dây' : 'Máy đập nhịp')}
                    />
                  </div>
                )
              }
              // Link thường → iframe
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#F6F2EA' }}>
                  <iframe
                    src={activeLesson.content_url!}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allow="microphone; camera" title={activeLesson.title}
                  />
                  <button onClick={goBack} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 16, zIndex: 51, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>← Quay lại</button>
                </div>
              )
            })()}

            {activeLesson.lesson_type !== 'flow' && <div style={{ padding: '16px' }}>
              {lessonTab === 'content' ? (
                activeLesson.lesson_type === 'quiz' ? (
                  <QuizViewer
                    lessonId={activeLesson.id}
                    studentId={student.id}
                    quizData={(() => { try { return typeof activeLesson.content === 'string' ? JSON.parse(activeLesson.content) : activeLesson.content } catch { return null } })()}
                    onComplete={() => markComplete(activeLesson.id)}
                  />
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {activeLesson.description && (
                    <div style={{ fontSize: 15, color: L.t2, lineHeight: 1.8 }}>{activeLesson.description}</div>
                  )}
                  {activeLesson.content && (
                    <div style={{ background: L.surface, borderRadius: 16, padding: '16px', boxShadow: L.shadow, fontSize: 15, lineHeight: 1.8, color: L.t1 }}
                      className="rich-content"
                      dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                  )}
                  {activeLesson.tools?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.06em', paddingLeft: 4 }}>
                        Thực hành — hoàn thành để tiếp tục
                      </div>
                      {activeLesson.tools.map((tid) => {
                        const t = resolveTool(tid); if (!t) return null
                        const done = usedToolIds.has(tid)
                        // ── Bài luyện nội bộ — mở đúng component đã nâng cấp ──
                        if (t.route.startsWith('#exercise:')) {
                          const exId = t.route.replace('#exercise:', '')
                          const running = activeTimer === exId
                          const openExercise = () => {
                            setCurrentLessonToolId(tid)
                            if (exId === 'finger') { startTimer('finger'); setShowFingerExercise(true) }
                            else if (exId === 'scale') { startTimer('scale'); setShowScaleExercise(true) }
                            else if (exId === 'arpeggio') { startTimer('arpeggio'); setShowArpExercise(true) }
                            else if (exId === 'metronome') { startTimer('metronome'); setShowGroove(true) }
                            else { startTimer(exId) } // ear: chỉ timer
                          }
                          return (
                            <div key={tid}
                              style={{ background: done ? L.greenBg : running ? t.color + '10' : L.surface, border: `2px solid ${done ? L.green : running ? t.color : t.color + '60'}`, borderRadius: 18, padding: '18px 16px', transition: 'all .2s' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 52, height: 52, borderRadius: 14, background: done ? L.green + '18' : t.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                                  {done ? '✅' : running ? '⏱' : t.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: done ? L.green : running ? t.color : L.t1, marginBottom: 3 }}>{t.label}</div>
                                  <div style={{ fontSize: 13, color: done ? L.green : running ? t.color : L.t2 }}>
                                    {done ? 'Đã hoàn thành ✓' : running ? fmtTimer(timerSeconds) : 'Bấm để bắt đầu luyện tập'}
                                  </div>
                                </div>
                                {!done && (
                                  running && (exId === 'finger' || exId === 'scale' || exId === 'arpeggio' || exId === 'metronome') ? (
                                    // Đang chạy overlay-based exercise → nút mở lại overlay
                                    <button onClick={openExercise}
                                      style={{ background: t.color, color: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                      Mở lại →
                                    </button>
                                  ) : running ? (
                                    // Timer-only exercise đang chạy → nút Dừng
                                    <button onClick={() => stopTimer(tid)}
                                      style={{ background: L.green, color: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                      Dừng ✓
                                    </button>
                                  ) : (
                                    <button onClick={openExercise}
                                      style={{ background: t.color, color: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                      Bắt đầu →
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )
                        }
                        // ── Tool thông thường (mở URL overlay) ──
                        return (
                          <div key={tid} onClick={() => openTool(t.route, t.label, tid)}
                            style={{ background: done ? L.greenBg : L.surface, border: `2px solid ${done ? L.green : t.color}`, borderRadius: 18, padding: '18px 16px', cursor: 'pointer', boxShadow: done ? 'none' : `0 4px 20px ${t.color}22`, transition: 'all .2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ width: 52, height: 52, borderRadius: 14, background: done ? L.green + '18' : t.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                                {done ? '✅' : t.icon}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 16, fontWeight: 700, color: done ? L.green : L.t1, marginBottom: 3 }}>{t.label}</div>
                                <div style={{ fontSize: 13, color: done ? L.green : L.t2 }}>
                                  {done ? 'Đã hoàn thành ✓' : 'Bấm để bắt đầu thực hành'}
                                </div>
                              </div>
                              {!done && (
                                <div style={{ background: t.color, color: '#fff', borderRadius: 12, padding: '8px 14px', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                  Bắt đầu →
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* Ghi nhận hành động thật — nền cho màu mốc + Điểm hành trình */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.06em', paddingLeft: 4 }}>Ghi nhận thực hành</div>
                    {[
                      { type: 'practiced_lesson', label: 'Tôi đã thực hành bài này', xp: 10, icon: '🎸' },
                      { type: 'submitted_video_self_report', label: 'Tôi đã gửi bài cho thầy', xp: 50, icon: '📹' },
                    ].map(a => {
                      const done = lessonActions.has(a.type)
                      return (
                        <button key={a.type} onClick={() => logAction(a.type)} disabled={done || actionBusy === a.type}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, background: done ? L.greenBg : L.surface, border: `1.5px solid ${done ? L.green : L.border}`, borderRadius: 14, padding: '13px 14px', cursor: done ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: actionBusy === a.type ? 0.6 : 1 }}>
                          <span style={{ fontSize: 20 }}>{done ? '✅' : a.icon}</span>
                          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: done ? L.green : L.t1 }}>{done ? `${a.label} — đã ghi nhận` : a.label}</span>
                          {!done && <span style={{ fontSize: 12, fontWeight: 700, color: L.a1 }}>+{a.xp} XP</span>}
                        </button>
                      )
                    })}
                  </div>
                  {!activeLesson.description && !activeLesson.content && activeLesson.lesson_type !== 'video' && (
                    <div style={{ textAlign: 'center', padding: '28px', color: L.t3, fontSize: 15 }}>Chưa có nội dung</div>
                  )}
                </div>
                )
              ) : (
                <textarea
                  placeholder="Ghi chú của bạn..."
                  value={noteText}
                  onChange={e => {
                    setNoteText(e.target.value)
                    if (activeLesson) {
                      try { localStorage.setItem(noteKey(activeLesson.id), e.target.value) } catch { /* bỏ qua */ }
                    }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 220, background: L.surface, border: `1px solid ${L.border}`, borderRadius: 16, padding: '16px', color: L.t1, fontSize: 15, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.8, boxShadow: L.shadow }}
                />
              )}
            </div>}

            {/* Nav buttons + Đánh dấu hoàn thành — ẩn khi flow (FlowPlayer tự quản lý) */}
            {activeLesson.lesson_type === 'flow' ? null : <>{/* Nav buttons + Đánh dấu hoàn thành */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Nút hoàn thành — block nếu chưa dùng hết tool */}
              {!completedIds.has(activeLesson.id) && (() => {
                // Chỉ tính tool còn hiển thị được thẻ (có trong TOOLS_MAP hoặc DB).
                // Tool không xác định (đã xoá/đổi id) bị bỏ qua → KHÔNG khoá vĩnh viễn.
                const requiredTools = (activeLesson.tools ?? []).filter(tid => !!resolveTool(tid))
                const allToolsDone = requiredTools.length === 0 || requiredTools.every(tid => usedToolIds.has(tid))
                return allToolsDone ? (
                  <button onClick={() => markComplete(activeLesson.id)} disabled={markingDone}
                    style={{ width: '100%', background: L.greenBg, border: `1.5px solid ${L.green}`, borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: L.green, opacity: markingDone ? 0.6 : 1 }}>
                    {markingDone ? 'Đang lưu…' : '✓ Đánh dấu đã học'}
                  </button>
                ) : (
                  <div style={{ background: L.surface2, border: `1.5px solid ${L.border}`, borderRadius: 14, padding: '13px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: L.t3, fontWeight: 600 }}>
                      🔒 Hoàn thành {requiredTools.filter(tid => !usedToolIds.has(tid)).length} bài tập thực hành để tiếp tục
                    </div>
                  </div>
                )
              })()}
              {completedIds.has(activeLesson.id) && (
                <div style={{ textAlign: 'center', fontSize: 14, color: L.green, fontWeight: 600, padding: '8px 0' }}>✅ Bài này đã hoàn thành</div>
              )}
              {/* Prev / Next */}
              <div style={{ display: 'flex', gap: 10 }}>
                {(() => {
                  const idx  = sortedLessons.findIndex(l => l.id === activeLesson.id)
                  const prev = idx > 0 ? sortedLessons[idx - 1] : null
                  const next = idx < sortedLessons.length - 1 ? sortedLessons[idx + 1] : null
                  return (
                    <>
                      {prev && (
                        <button onClick={() => openLesson(prev)} style={{ flex: 1, background: L.surface, border: `1px solid ${L.border}`, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: L.t1, boxShadow: L.shadow }}>
                          ‹ Trước
                        </button>
                      )}
                      <button onClick={() => { if (next) openLesson(next); else goBack() }}
                        style={{ flex: 2, background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: L.tinv, border: 'none', borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(67,56,202,.3)' }}>
                        {next ? 'TIẾP THEO ›' : '✓ HOÀN THÀNH'}
                      </button>
                    </>
                  )
                })()}
              </div>
            </div>
            </>}
            </> /* đóng nhánh else (không phải flow) */
            )}
          </>
        )}

        {/* ── TẬP ─────────────────────────────────────────────────────── */}
        {tab === 'tap' && (
          <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Luyện tập</div>

            {/* ══ HÔM NAY LUYỆN GÌ ══ */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Hôm nay luyện gì?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXERCISES.filter(ex => (exerciseStatuses[ex.id] ?? 'on') !== 'off').map(ex => {
                  const exStatus = exerciseStatuses[ex.id] ?? 'on'
                  const isComingSoon = exStatus === 'coming_soon'
                  const totalMin = practiceTotals[ex.id] ?? 0
                  const totalHrs = (totalMin / 60).toFixed(1)
                  const todayMin = practiceToday[ex.id] ?? 0
                  const isActive = activeTimer === ex.id
                  return (
                    <div key={ex.id} style={{ background: L.surface, borderRadius: 16, padding: '14px 16px', boxShadow: L.shadow, border: `1.5px solid ${isActive ? ex.color : 'transparent'}`, transition: 'border .2s', opacity: isComingSoon ? 0.55 : 1, position: 'relative' }}>
                      {isComingSoon && (
                        <div style={{ position: 'absolute', top: 10, right: 12, background: '#FFFBEB', color: '#D97706', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>🔜 Sắp ra mắt</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: ex.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {ex.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{ex.name}</div>
                          <div style={{ fontSize: 12, color: L.t2, marginTop: 2 }}>
                            Tích lũy: <span style={{ color: ex.color, fontWeight: 700 }}>{totalHrs}h</span>
                            {todayMin > 0 && <span style={{ color: L.green }}> · Hôm nay: {todayMin}ph</span>}
                          </div>
                        </div>
                        {isComingSoon ? (
                          <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>Sắp mở</span>
                        ) : ex.id === 'finger' ? (
                          /* Card Luyện ngón: mở FingerExercise overlay thay vì chỉ chạy timer */
                          isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                              <button onClick={() => setShowFingerExercise(true)}
                                style={{ background: ex.color, border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Mở →
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={!!activeTimer}
                              onClick={() => { startTimer('finger'); setShowFingerExercise(true) }}
                              style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              ▶ Bắt đầu
                            </button>
                          )
                        ) : ex.id === 'scale' ? (
                          /* Card Âm giai: mở ScaleExercise overlay */
                          isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                              <button onClick={() => setShowScaleExercise(true)}
                                style={{ background: ex.color, border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Mở →
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={!!activeTimer}
                              onClick={() => { startTimer('scale'); setShowScaleExercise(true) }}
                              style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              ▶ Bắt đầu
                            </button>
                          )
                        ) : ex.id === 'metronome' ? (
                          /* Card Tiết tấu: mở GrooveExercise overlay (Học + Tập) */
                          isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                              <button onClick={() => setShowGroove(true)}
                                style={{ background: ex.color, border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Mở →
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={!!activeTimer}
                              onClick={() => { startTimer('metronome'); setShowGroove(true) }}
                              style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              ▶ Bắt đầu
                            </button>
                          )
                        ) : ex.id === 'arpeggio' ? (
                          /* Card Arpeggio: mở ArpeggioExercise overlay */
                          isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                              <button onClick={() => setShowArpExercise(true)}
                                style={{ background: ex.color, border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Mở →
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={!!activeTimer}
                              onClick={() => { startTimer('arpeggio'); setShowArpExercise(true) }}
                              style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              ▶ Bắt đầu
                            </button>
                          )
                        ) : isActive ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 17, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                            <button onClick={() => stopTimer()}
                              style={{ background: '#EF4444', border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Dừng
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startTimer(ex.id)} disabled={!!activeTimer}
                            style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                            ▶ Bắt đầu
                          </button>
                        )}
                      </div>
                      {totalMin > 0 && (
                        <div style={{ marginTop: 10, height: 3, borderRadius: 99, background: L.surface2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, background: ex.color, width: `${Math.min(100, totalMin / (1000*60) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ══ BÀI HÁT ĐANG CHINH PHỤC ══ */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>🎸 Bài hát đang chinh phục</div>
                {mySongs.length > 0 && <span style={{ fontSize: 12, color: L.t3 }}>{mySongs.length} bài</span>}
              </div>

              {/* Empty state */}
              {mySongs.length === 0 && !showAddSong && (
                <div style={{ background: L.surface, borderRadius: 20, padding: '32px 20px', boxShadow: L.shadow, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🎸</div>
                  <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Bạn chưa có bài hát nào</div>
                  <div style={{ fontSize: 14, color: L.t2, lineHeight: 1.7, marginBottom: 24 }}>Mỗi nghệ sĩ đều bắt đầu từ bài hát đầu tiên.</div>
                  <button onClick={() => { setShowAddSong(true); setAddStep('input') }}
                    style={{ background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ➕ Chọn bài hát đầu tiên
                  </button>
                </div>
              )}

              {/* Add song — step input: YouTube search */}
              {showAddSong && addStep === 'input' && (
                <div style={{ background: L.surface, borderRadius: 20, padding: '20px', boxShadow: L.shadow }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Tìm bài hát</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={ytQuery} onChange={e => setYtQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchYouTube(ytQuery)}
                      placeholder="Nhập tên bài hát..." autoFocus
                      style={{ flex: 1, background: L.surface2, border: `1.5px solid ${L.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, color: L.t1, fontFamily: 'inherit', outline: 'none' }} />
                    <button onClick={() => searchYouTube(ytQuery)} disabled={ytSearching || !ytQuery.trim()}
                      style={{ background: L.p1, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 17, cursor: 'pointer', opacity: ytSearching ? 0.6 : 1, flexShrink: 0 }}>
                      {ytSearching ? '⏳' : '🔍'}
                    </button>
                  </div>
                  {ytResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                      {ytResults.map(r => (
                        <div key={r.id} onClick={() => selectYtVideo(r)}
                          style={{ display: 'flex', gap: 10, background: L.surface2, borderRadius: 12, padding: '10px', cursor: 'pointer', border: `1px solid ${L.border}` }}>
                          {r.thumbnail && <img src={r.thumbnail} alt="" style={{ width: 60, height: 45, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: L.t1, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>{r.channel}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowAddSong(false); setYtResults([]); setYtQuery('') }}
                    style={{ width: '100%', background: L.surface2, color: L.t2, border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Huỷ
                  </button>
                </div>
              )}

              {/* Confirm save popup */}
              {showConfirmSave && ytSelected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ background: L.surface, borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480 }}>
                    <div style={{ width: 40, height: 4, background: L.border, borderRadius: 99, margin: '0 auto 20px' }} />
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>Thêm vào thư viện?</div>
                    <div style={{ display: 'flex', gap: 12, background: L.surface2, borderRadius: 16, padding: 14, marginBottom: 20 }}>
                      <img src={ytSelected.thumbnail} alt="" style={{ width: 80, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{ytSelected.title}</div>
                        <div style={{ fontSize: 12, color: L.green, marginTop: 4 }}>✓ YouTube đã liên kết</div>
                      </div>
                    </div>
                    <button onClick={async () => { await handleAddSong() }}
                      disabled={addingSong}
                      style={{ width: '100%', background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, opacity: addingSong ? 0.7 : 1 }}>
                      {addingSong ? '⏳ Đang lưu...' : '🎸 Lưu vào thư viện'}
                    </button>
                    <button onClick={() => { setShowConfirmSave(false); setYtSelected(null); setNewSongTitle(''); setNewSongYoutube('') }}
                      style={{ width: '100%', background: 'none', border: 'none', color: L.t2, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '10px' }}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}

              {/* Carousel */}
              {mySongs.length > 0 && !showAddSong && (() => {
                const recent = mySongs.slice(0, 5)
                const song = recent[Math.min(carouselIdx, recent.length - 1)]
                if (!song) return null
                const openBMS = () => {
                  const params = new URLSearchParams({ title: song.title })
                  if (song.youtube_url) params.set('youtube', song.youtube_url)
                  params.set('songId', song.id)
                  if (song.tempo) params.set('tempo', String(song.tempo))
                  openTool('/song-builder?' + params.toString(), 'BMS', 'song-builder')
                }
                return (
                  <div>
                    {/* Card bài hát */}
                    <div style={{ background: L.surface, borderRadius: 20, padding: '18px', boxShadow: L.shadowLg, border: `1.5px solid ${L.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #4338CA20, #EA580C20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎸</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.3, ...clamp2 }}>{song.title}</div>
                          <div style={{ fontSize: 12, color: L.t2, marginTop: 2 }}>
                            {song.tempo
                              ? <span>🥁 <span style={{ color: L.p1, fontWeight: 700 }}>{song.tempo} BPM</span></span>
                              : <span style={{ color: L.t3 }}>Chưa đo tempo</span>}
                          </div>
                        </div>
                      </div>
                      {/* Tiến trình chinh phục bài hát — 5 bước journey */}
                      {(() => {
                        const stepDone = (stepId: string) => {
                          if (song.journey?.find(x => x.id === stepId)?.done) return true
                          if (stepId === 'tempo' && song.tempo) return true  // có tempo = đã xong bước Tempo
                          return false
                        }
                        const doneCount = JOURNEY_STEPS.filter(s => stepDone(s.id)).length
                        return (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: L.t2 }}>🏆 Chinh phục bài hát</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: doneCount === 5 ? L.green : L.p1 }}>{doneCount}/5 bước</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              {JOURNEY_STEPS.map(step => {
                                const done = stepDone(step.id)
                                return (
                                  <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                                      background: done ? step.color : L.p2, color: done ? '#fff' : L.t3,
                                      border: done ? 'none' : `1.5px solid ${L.border}`, transition: 'all .2s' }}>
                                      {done ? '✓' : step.icon}
                                    </div>
                                    <span style={{ fontSize: 9.5, fontWeight: 600, color: done ? step.color : L.t3 }}>{step.label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                      <button onClick={openBMS}
                        style={{ width: '100%', background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: '#fff', border: 'none', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        🎼 Luyện với BMS
                      </button>
                    </div>
                    {/* Dots carousel */}
                    {recent.length > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <button onClick={() => setCarouselIdx(i => Math.max(0, i - 1))} disabled={carouselIdx === 0}
                          style={{ background: 'none', border: 'none', color: carouselIdx === 0 ? L.border : L.t2, fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>‹</button>
                        {recent.map((_, i) => (
                          <div key={i} onClick={() => setCarouselIdx(i)}
                            style={{ width: i === carouselIdx ? 16 : 7, height: 7, borderRadius: 99, background: i === carouselIdx ? L.p1 : L.border, cursor: 'pointer', transition: 'all .2s' }} />
                        ))}
                        <button onClick={() => setCarouselIdx(i => Math.min(recent.length - 1, i + 1))} disabled={carouselIdx === recent.length - 1}
                          style={{ background: 'none', border: 'none', color: carouselIdx === recent.length - 1 ? L.border : L.t2, fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>›</button>
                      </div>
                    )}
                    {/* All songs */}
                    {mySongs.length > 5 && (
                      <div style={{ marginTop: 10 }}>
                        <button onClick={() => setShowAllSongs(!showAllSongs)}
                          style={{ width: '100%', background: 'none', border: 'none', color: L.t2, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Tất cả bài hát ({mySongs.length})</span><span>{showAllSongs ? '▲' : '▼'}</span>
                        </button>
                        {showAllSongs && mySongs.map(s => (
                          <div key={s.id} onClick={() => { const idx = mySongs.slice(0,5).findIndex(ss => ss.id === s.id); if (idx >= 0) setCarouselIdx(idx); setShowAllSongs(false) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: L.surface, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', marginTop: 6 }}>
                            <span style={{ fontSize: 16 }}>🎸</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, ...clamp2 }}>{s.title}</div>
                              <div style={{ fontSize: 11, color: L.t3 }}>{s.tempo ? `🥁 ${s.tempo} BPM` : 'Chưa đo tempo'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { setShowAddSong(true); setAddStep('input') }}
                      style={{ width: '100%', marginTop: 10, background: 'none', border: `1.5px dashed ${L.border}`, borderRadius: 14, padding: '11px', fontSize: 14, fontWeight: 600, color: L.t2, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ➕ Thêm bài hát mới
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* ── Công cụ ── */}
            {(() => {
              const activeTools  = displayTools.filter(t => t.status !== 'coming_soon')
              const comingTools  = displayTools.filter(t => t.status === 'coming_soon')
              return (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: L.t2, marginBottom: 12 }}>Công cụ luyện tập</div>

                  {/* Tools grid — chỉ active */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: comingTools.length ? 10 : 0 }}>
                    {activeTools.map((t) => {
                      const unlocked = isTierUnlocked(t.tier)
                      const route = TOOL_ROUTES[t.id] ?? t.route ?? '/tap'
                      return (
                        <div key={t.id} onClick={() => { if (unlocked) openTool(route, t.name, t.id) }}
                          style={{ background: L.surface, borderRadius: 18, padding: '18px 14px', boxShadow: L.shadow, cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : .5, position: 'relative' }}>
                          {!unlocked && (
                            <div style={{ position: 'absolute', top: 8, right: 8 }}>
                              <span style={{ fontSize: 11, background: L.goldBg, color: L.gold, borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>{TIER_VI[t.tier] ?? t.tier}</span>
                            </div>
                          )}
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: (route.startsWith('/tuner') || route.startsWith('/piano-journey')) ? 'transparent' : L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10, overflow: 'hidden' }}>
                            {route.startsWith('/tuner')
                              ? <img src="/tune-lab.png" alt="Tune Lab" style={{ width: 44, height: 44, borderRadius: 12 }} />
                              : route.startsWith('/piano-journey')
                              ? <img src="/piano-journey.png" alt="Piano Journey" style={{ width: 44, height: 44, borderRadius: 12 }} />
                              : t.id === 'chord-seeing' ? <ChordDiagramIcon size={30} />
                              : t.icon}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: unlocked ? L.p1 : L.t3, marginBottom: 4 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: L.t3, lineHeight: 1.4 }}>{t.description}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Nhóm sắp ra mắt — accordion */}
                  {comingTools.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <button onClick={() => setShowComingTools(v => !v)}
                        style={{ width: '100%', background: '#FFFBEB', border: '1.5px dashed #FCD34D', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ fontSize: 17 }}>🔜</span>
                        <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, color: '#D97706' }}>
                          {comingTools.length} công cụ sắp ra mắt
                        </span>
                        <span style={{ fontSize: 14, color: '#D97706', transition: 'transform .2s', display: 'inline-block', transform: showComingTools ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                      </button>

                      {showComingTools && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                          {comingTools.map(t => (
                            <div key={t.id}
                              style={{ background: L.surface, borderRadius: 18, padding: '18px 14px', boxShadow: L.shadow, opacity: 0.6, position: 'relative' }}>
                              <div style={{ position: 'absolute', top: 8, right: 8 }}>
                                <span style={{ fontSize: 11, background: '#FFFBEB', color: '#D97706', borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>🔜 Sắp ra</span>
                              </div>
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>{t.icon}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: L.t3, marginBottom: 4 }}>{t.name}</div>
                              <div style={{ fontSize: 12, color: L.t3, lineHeight: 1.4 }}>Sắp ra mắt</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── SỐNG ────────────────────────────────────────────────────── */}
        {/* ══ SỐNG ══ Lớp = đơn vị đào tạo · Band = đơn vị cộng đồng.
            Mỗi mục là 1 entry điều hướng (không feed, không dashboard). ═══════ */}
        {/* ── THẦY ────────────────────────────────────────────────────── */}
        {/* Gặp/hỏi/thực hành cùng Thầy. Zalo/nhóm/cộng đồng dùng capability THẬT; buổi thực hành chưa có data canonical → empty state (không fake lịch/Zoom). */}
        {tab === 'teacher' && (() => {
          const zaloUrl = communityGroups.find(g => g.group_type === 'zalo' && g.zalo_url)?.zalo_url ?? null
          return (
          <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 8px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Thầy</div>
            <div style={{ fontSize: 14, color: L.t2, marginBottom: 20 }}>Gặp, hỏi và thực hành trực tiếp cùng Thầy.</div>

            {/* A. GẶP THẦY — hero, CTA Zalo nổi nhất (link THẬT; chưa có Zalo → vào Nhóm lớp) */}
            <div style={{ background: L.surface, borderRadius: 18, padding: '18px', boxShadow: L.shadow, marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>💬 Gặp Thầy</div>
              <div style={{ fontSize: 14, color: L.t2, lineHeight: 1.6 }}>Có câu hỏi về bài đang học? Nhắn Thầy.</div>
              {zaloUrl ? (
                <button onClick={() => openExternal(zaloUrl)}
                  style={{ width: '100%', marginTop: 14, background: L.p1, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Nhắn Thầy qua Zalo
                </button>
              ) : (
                <>
                  <button onClick={() => setLivePage('classgroup')}
                    style={{ width: '100%', marginTop: 14, background: L.p1, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Vào Nhóm lớp để nhắn Thầy
                  </button>
                  <div style={{ fontSize: 12, color: L.t3, marginTop: 8 }}>Zalo lớp nằm trong “Nhóm lớp của tôi”.</div>
                </>
              )}
            </div>

            {/* B. BUỔI THỰC HÀNH CÙNG THẦY — chưa có lịch canonical → empty state sạch (§7) */}
            <div style={{ background: L.surface, borderRadius: 18, padding: '18px', boxShadow: L.shadow, marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>📅 Buổi thực hành cùng Thầy</div>
              <div style={{ fontSize: 14, color: L.t2, lineHeight: 1.6 }}>Chưa có buổi thực hành sắp tới.</div>
              <div style={{ fontSize: 12.5, color: L.t3, marginTop: 6, lineHeight: 1.5 }}>Lịch buổi thực hành sẽ hiện ở đây khi Thầy mở. Lịch hiển thị cho mọi người; quyền tham gia theo lớp/gói của bạn.</div>
            </div>

            {/* C. Nhóm lớp · D. Cộng đồng — capability THẬT, giữ nguyên behavior */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['classgroup', '💬', 'Nhóm lớp của tôi'],
                ['community',  '👥', 'Cộng đồng Hành trình'],
              ] as const).map(([key, icon, label]) => (
                <button key={key}
                  onClick={() => {
                    if (key === 'community') {
                      const fb = communityGroups.find(g => g.group_type === 'facebook' && g.facebook_url)
                      if (fb?.facebook_url) { openExternal(fb.facebook_url); return }
                    }
                    setLivePage(key)
                  }}
                  style={{ width: '100%', background: L.surface, border: 'none', borderRadius: 16, boxShadow: L.shadow, padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: L.t1, lineHeight: 1.35 }}>{label}</span>
                  <span style={{ color: L.t3, fontSize: 18, flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>
          </div>
          )
        })()}

        {/* ── TÔI ─────────────────────────────────────────────────────── */}
        {/* Hồ sơ/gói/tiến độ THẬT. Guest có trạng thái riêng, KHÔNG ép login khi mở tab. */}
        {tab === 'me' && (
          <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 8px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Tôi</div>
            <div style={{ fontSize: 14, color: L.t2, marginBottom: 20 }}>Hồ sơ, gói học và tài khoản.</div>

            {/* Hồ sơ + tiến độ THẬT (masterPath/completedIds) */}
            <div style={{ background: L.surface, borderRadius: 20, boxShadow: L.shadow, padding: 18, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 20, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: L.p1, fontWeight: 800, overflow: 'hidden', flexShrink: 0 }}>
                  {me.avatar_url
                    ? <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.3, ...clamp2 }}>{name}</div>
                  <div style={{ fontSize: 13, color: L.t2, marginTop: 2 }}>{guest ? 'Khách · Miễn phí' : (LEVEL_VI[me.level ?? ''] ?? 'Học viên')}</div>
                </div>
              </div>
              {(() => {
                const total = masterPath.length
                const done = masterPath.filter(m => completedIds.has(m.id)).length
                if (total === 0) return null
                const pct = Math.round((done / total) * 100)
                return (
                  <div style={{ marginTop: 16, textAlign: 'left' }}>
                    <div style={{ height: 9, background: L.p2, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: L.p1 }} />
                    </div>
                    <div style={{ marginTop: 8, color: L.t2, fontSize: 13 }}>{done}/{total} bài trong hành trình · {pct}%</div>
                  </div>
                )
              })()}
            </div>

            {/* Gói của tôi — tên gói từ ENTITLEMENT THẬT; CTA reuse paywall đã duyệt (openUpgrade → /subscribe) */}
            <div style={{ background: L.surface, borderRadius: 20, boxShadow: L.shadow, padding: 16, marginBottom: 14, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: L.p2, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>👑</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: L.t2, fontWeight: 750 }}>Gói của tôi</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: L.t1 }}>{ENTITLEMENT_TIER_LABEL[effectiveTier]}</div>
                </div>
                <button onClick={openUpgrade} style={{ background: effectiveTier === 'free' ? L.p1 : L.p2, border: 'none', borderRadius: 12, padding: '9px 14px', color: effectiveTier === 'free' ? '#fff' : L.p1, fontSize: 13, fontWeight: 850, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {effectiveTier === 'free' ? 'Nâng gói' : 'Quản lý gói'}
                </button>
              </div>
            </div>

            {/* Hành trình của tôi — Band · 1001 Câu chuyện · Đại hội (chuyển từ Thầy; reuse handler thật) */}
            <div style={{ fontSize: 12.5, fontWeight: 800, color: L.t3, textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 2px 8px' }}>Hành trình của tôi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {([
                ['band',     '🎸', 'Band của tôi'],
                ['story',    '📖', '1001 Câu chuyện cùng Guitar'],
                ['festival', '🎪', 'Đại hội Guitar'],
              ] as const).map(([key, icon, label]) => (
                <button key={key}
                  onClick={() => { if (key === 'story') { window.location.href = '/story'; return } setLivePage(key) }}
                  style={{ width: '100%', background: L.surface, border: 'none', borderRadius: 16, boxShadow: L.shadow, padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: L.t1, lineHeight: 1.35 }}>{label}</span>
                  <span style={{ color: L.t3, fontSize: 18, flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>

            {/* Tài khoản — cài đặt hồ sơ / đăng nhập / đăng xuất */}
            <div style={{ background: L.surface, borderRadius: 16, padding: '12px 14px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: L.t1 }}>Tài khoản</div>
                <div style={{ fontSize: 12.5, color: L.t2 }}>{guest ? 'Đăng nhập để lưu tiến trình' : 'Đổi hồ sơ · đăng xuất'}</div>
              </div>
              {!guest && <button onClick={openSettings} title="Cài đặt hồ sơ" style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>⚙️</button>}
              <button onClick={guest ? requireLogin : onLogout} style={{ background: L.surface2, border: `1px solid ${L.border}`, borderRadius: 10, padding: '8px 12px', color: L.t2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                {guest ? 'Đăng nhập' : 'Đăng xuất'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ JOURNEY — MỘT HÀNH TRÌNH NGANG DUY NHẤT (nửa trên rail · nửa dưới đồng hành) ══ */}
      {tab === 'hoc' && screen === 'journey' && activeSubject && (() => {
        const items = journeyOf(activeSubject)
        const subject = SUBJECTS.find(s => s.key === activeSubject)
        const modLessonIds: Record<string, string[]> = {}
        items.forEach(j => { (modLessonIds[j.moduleId] ??= []).push(j.id) })
        const moduleDone = (mid: string) => (modLessonIds[mid] ?? []).length > 0 && (modLessonIds[mid] ?? []).every(id => completedIds.has(id))
        const currentId = items.find(j => { const a = lessonAccessOf(j); return a.canAccess && !completedIds.has(j.id) })?.id
        const selectedId = selectedLessonId ?? currentId ?? items[0]?.id
        const selected = items.find(j => j.id === selectedId) ?? null
        const selectLesson = (jl: JourneyLesson) => { setSelectedLessonId(jl.id); setNoteSaved(false); window.setTimeout(() => document.getElementById('jl-' + jl.id)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }), 0) }
        const saveNote = (id: string, val: string) => { try { localStorage.setItem(noteKey(id), val) } catch { /**/ } setNoteSaved(true) }

        const nodes: React.ReactNode[] = []
        let lastLevelGroup: string | null = null, lastModule: string | null = null, lastCourse: string | null = null, courseIdx = -1, chapterNum = 0
        items.forEach((jl) => {
          if (jl.courseId !== lastCourse) courseIdx++
          const toneIdx = jl.moduleLevel != null ? (jl.moduleLevel - 1) : courseIdx
          const tone = LEVEL_TONES[((toneIdx % LEVEL_TONES.length) + LEVEL_TONES.length) % LEVEL_TONES.length]
          const levelGroup = jl.moduleLevel != null ? `${jl.courseId}#${jl.moduleLevel}` : jl.courseId
          const newModule = jl.moduleId !== lastModule
          // Đếm chương trong Level (structure, không parse title) → context line ngắn
          if (levelGroup !== lastLevelGroup) chapterNum = 1
          else if (newModule) chapterNum++
          if (levelGroup !== lastLevelGroup) {
            if (lastLevelGroup !== null || jl.moduleLevel != null) {
              // ── MỐC LEVEL (mạnh) — panel tone, badge lớn, cột mốc ──
              nodes.push(
                <div key={'lv-' + jl.moduleId} id={jl.moduleLevel != null ? 'jl-level-' + jl.moduleLevel : undefined} data-level={jl.moduleLevel ?? undefined} style={{ flex: '0 0 auto', alignSelf: 'stretch', minWidth: 124, scrollSnapAlign: 'center', borderRadius: 18, background: `${tone}12`, border: `1.5px dashed ${tone}66`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '0 12px', zIndex: 1 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: tone, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, boxShadow: `0 8px 20px ${tone}55` }}>🎖️</div>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: tone, textTransform: 'uppercase', letterSpacing: '.07em' }}>{jl.moduleLevel != null ? `Level ${jl.moduleLevel}` : 'Chặng mới'}</div>
                </div>
              )
            }
          } else if (newModule && lastModule !== null) {
            const done = moduleDone(lastModule)
            // ── MỐC CHƯƠNG (nhẹ) ──
            nodes.push(
              <div key={'ch-' + lastModule} style={{ flex: '0 0 auto', alignSelf: 'stretch', minWidth: 66, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '0 2px', zIndex: 1 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: done ? '#16A34A18' : L.surface, color: done ? '#16A34A' : L.t3, display: 'grid', placeItems: 'center', fontSize: 20, border: `2px solid ${done ? '#16A34A' : L.border}` }}>{done ? '✓' : '♪'}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: done ? '#16A34A' : L.t3, textAlign: 'center' }}>Hết chương</div>
              </div>
            )
          }
          const a = lessonAccessOf(jl)
          if (a.visible) {
            const completed = completedIds.has(jl.id)
            const comingSoon = !a.available
            const locked = a.available && !a.canAccess
            const seqLocked = isSeqLocked(jl.courseCode)
            const isCurrent = jl.id === currentId
            const isSelected = jl.id === selectedId
            const dim = locked || comingSoon || seqLocked
            // Chỉ dùng MEDIA THẬT (YouTube thumb); không lấy course cover → tránh mọi card giống nhau "ĐH"
            const thumb = jl.ytId ? `https://img.youtube.com/vi/${jl.ytId}/hqdefault.jpg` : null
            const stateLabel = completed ? '✓ Đã học' : comingSoon ? '🔜 Sắp có' : (locked || seqLocked) ? '🔒 Mở khoá' : isCurrent ? '▶ Học tiếp' : 'Vào học'
            nodes.push(
              <div key={jl.id} id={'jl-' + jl.id} data-jlcur={isCurrent ? '1' : undefined} data-level={jl.moduleLevel ?? undefined} role="button" tabIndex={0}
                onClick={() => selectLesson(jl)}
                style={{ flex: '0 0 62vw', maxWidth: 250, minWidth: 198, scrollSnapAlign: 'center', position: 'relative', display: 'flex', flexDirection: 'column', border: isSelected ? `2px solid ${tone}` : `1px solid ${L.border}`, borderRadius: 18, overflow: 'hidden', padding: 0, cursor: 'pointer', fontFamily: 'inherit', background: L.surface, boxShadow: isSelected ? `0 8px 22px ${tone}33` : L.shadow, textAlign: 'left', alignSelf: 'stretch', zIndex: isSelected ? 2 : 1 }}>
                {thumb ? (
                  /* Thumbnail thật — overlay nhẹ để tách khỏi phần chữ, không quá sáng/loạn */
                  <div style={{ position: 'relative', width: '100%', height: '40%', flexShrink: 0, overflow: 'hidden', background: `${tone}12` }}>
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: dim ? 'grayscale(.55)' : undefined }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,24,39,.10) 0%, rgba(17,24,39,0) 42%, rgba(17,24,39,.26) 100%)' }} />
                  </div>
                ) : (
                  /* Fallback SẠCH — dải gradient tone + icon nhỏ trong badge trắng mờ; KHÔNG watermark/chữ lớn */
                  <div style={{ width: '100%', height: '32%', flexShrink: 0, background: `linear-gradient(135deg, ${tone}, ${tone}cc)`, display: 'grid', placeItems: 'center' }}>
                    <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 18 }}>🎸</span>
                  </div>
                )}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 13px 12px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: tone, textTransform: 'uppercase', letterSpacing: '.03em', opacity: .95, ...clamp1 }}>{jl.moduleLevel != null ? `Level ${jl.moduleLevel} · Chương ${chapterNum}` : `Chương ${chapterNum}`}</div>
                  <div style={{ marginTop: 4, fontSize: 15.5, fontWeight: 900, color: L.t1, lineHeight: 1.2, letterSpacing: '-.01em', ...clamp2 }}>{jl.title}</div>
                  <div style={{ flex: 1 }} />
                  <button onClick={e => { e.stopPropagation(); openJourneyLesson(jl) }} disabled={comingSoon}
                    style={{ marginTop: 8, alignSelf: 'flex-start', border: 'none', borderRadius: 10, padding: '7px 13px', fontSize: 12, fontWeight: 850, cursor: comingSoon ? 'default' : 'pointer', fontFamily: 'inherit', background: comingSoon ? L.surface2 : (locked || seqLocked) ? '#FFF7ED' : isCurrent ? tone : L.p2, color: comingSoon ? L.t3 : (locked || seqLocked) ? '#C2410C' : isCurrent ? '#fff' : L.p1 }}>{stateLabel}</button>
                </div>
                <div style={{ height: 4, background: dim ? L.border : tone }} />
                {completed && <span style={{ position: 'absolute', top: 8, right: 8, width: 25, height: 25, borderRadius: '50%', background: '#16A34A', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 900 }}>✓</span>}
              </div>
            )
          }
          lastCourse = jl.courseId; lastModule = jl.moduleId; lastLevelGroup = levelGroup
        })
        const headerLine = selected
          ? (selected.moduleLevel != null ? `Level ${selected.moduleLevel} · bài đang chọn` : 'Bài đang chọn')
          : `Hành trình ${subject?.title ?? ''}`.trim()
        // ── Level navigator: chỉ các Level THẬT có trong journey (từ edu_modules.level) ──
        const levels = [...new Set(items.map(j => j.moduleLevel).filter((l): l is number => l != null))].sort((a, b) => a - b)
        const currentLevel = items.find(j => j.id === currentId)?.moduleLevel ?? levels[0] ?? null
        const shownActiveLevel = activeLevel ?? currentLevel  // active = vùng đang xem, mặc định = level của current
        // Nhảy tới vùng Level: tự animate scrollLeft (easeOut) — chạy mọi trình duyệt/WebView, mượt như smooth
        const goToLevel = (n: number) => {
          setActiveLevel(n)
          const rail = journeyRailRef.current
          const marker = document.getElementById('jl-level-' + n)
          if (!rail || !marker) return
          const mr = marker.getBoundingClientRect(), rr = rail.getBoundingClientRect()
          const start = rail.scrollLeft
          const dist = (mr.left + mr.width / 2) - (rr.left + rr.width / 2)
          if (Math.abs(dist) < 2) return
          suppressRailScrollRef.current = true
          const dur = 420, t0 = performance.now()
          const step = (now: number) => {
            const p = Math.min(1, (now - t0) / dur)
            rail.scrollLeft = start + dist * (1 - Math.pow(1 - p, 3))
            if (p < 1) window.requestAnimationFrame(step)
            else suppressRailScrollRef.current = false
          }
          window.requestAnimationFrame(step)
          // an toàn: nếu rAF bị pause (WebView nền), vẫn nhảy đúng vị trí + gỡ suppress
          window.setTimeout(() => { if (suppressRailScrollRef.current) { rail.scrollLeft = start + dist; suppressRailScrollRef.current = false } }, dur + 140)
        }
        // Vuốt rail → cập nhật activeLevel theo phần tử có level gần center nhất (debounce setTimeout — bền hơn rAF trong WebView)
        const onRailScroll = () => {
          if (suppressRailScrollRef.current) return
          if (railRafRef.current) window.clearTimeout(railRafRef.current)
          railRafRef.current = window.setTimeout(() => {
            railRafRef.current = 0
            const rail = journeyRailRef.current
            if (!rail) return
            const centerX = rail.getBoundingClientRect().left + rail.clientWidth / 2
            let best: string | null = null, bestDist = Infinity
            rail.querySelectorAll('[data-level]').forEach(el => {
              const r = (el as HTMLElement).getBoundingClientRect()
              const d = Math.abs((r.left + r.width / 2) - centerX)
              if (d < bestDist) { bestDist = d; best = (el as HTMLElement).getAttribute('data-level') }
            })
            if (best != null) setActiveLevel(Number(best))
          }, 90)
        }
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 'calc(62px + env(safe-area-inset-bottom))', background: L.bg, display: 'flex', flexDirection: 'column', zIndex: 8 }}>
            {/* Header — gọn, ngữ cảnh, KHÔNG nhấn tổng bài */}
            <div style={{ background: L.surface, padding: 'max(46px, calc(env(safe-area-inset-top, 0px) + 10px)) 16px 10px', boxShadow: '0 1px 0 ' + L.border, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => { setScreen('home'); setActiveSubject(null); setActiveLevel(null) }} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, flexShrink: 0 }}>‹</button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 19, color: L.t1, lineHeight: 1.1, ...clamp1 }}>{subject?.title ?? 'Hành trình'}</div>
                <div style={{ fontSize: 12, color: L.t2, marginTop: 1, ...clamp1 }}>{headerLine}</div>
              </div>
            </div>
            {/* NỬA TRÊN — MỘT rail ngang duy nhất (lesson + mốc chương/level) */}
            {items.length > 0 ? (
              <div ref={journeyRailRef} onScroll={onRailScroll} style={{ flexShrink: 0, overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x proximity', scrollbarWidth: 'none', padding: '14px 0 8px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 10, padding: '0 18px', height: 288 }}>
                  {/* Đường path liên tục (nhẹ) — chạy sau card, hiện ở khe & sau mốc */}
                  <div style={{ position: 'absolute', left: 18, right: 18, top: '54%', height: 2, background: `${L.p1}22`, zIndex: 0 }} />
                  {nodes}
                </div>
              </div>
            ) : (
              <div style={{ flexShrink: 0, height: 260, display: 'grid', placeItems: 'center', padding: '0 24px', textAlign: 'center', color: L.t2 }}>
                <div>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎼</div>
                  <div style={{ fontWeight: 800, color: L.t1, marginBottom: 4 }}>Hành trình đang được soạn</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>Các bài học của môn này sẽ xuất hiện ở đây.</div>
                </div>
              </div>
            )}
            {/* ── LEVEL NAVIGATOR (nhẹ) — nhảy nhanh tới vùng Level; KHÔNG mục lục, không đổi current/selected/progress ── */}
            {items.length > 0 && levels.length > 1 && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '2px 18px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: L.t3, textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>Level</span>
                {levels.map(n => {
                  const on = shownActiveLevel === n
                  return (
                    <button key={n} onClick={() => goToLevel(n)}
                      style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 900 : 700, display: 'grid', placeItems: 'center', transition: 'all .15s', background: on ? L.p2 : 'transparent', color: on ? L.p1 : L.t2, border: on ? `2px solid ${L.p1}` : `1.5px solid ${L.border}` }}>{n}</button>
                  )
                })}
              </div>
            )}
            {/* NỬA DƯỚI — SỔ TAY: "Ghi chú của bạn" là trung tâm, gắn selectedLesson (reuse localStorage note) */}
            <div style={{ flex: 1, minHeight: 0, background: L.surface, borderTop: `1px solid ${L.border}`, display: 'flex', flexDirection: 'column', padding: '12px 18px calc(14px + env(safe-area-inset-bottom))' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: L.t1 }}>Ghi chú của bạn</div>
                {selected && <span style={{ fontSize: 11.5, fontWeight: 700, color: noteSaved ? L.green : L.t3, transition: 'color .2s' }}>{noteSaved ? '✓ Đã lưu' : ''}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: L.t2, marginTop: 2, ...clamp1 }}>{selected ? selected.title : 'Chọn một bài để ghi chú'}</div>
              {selected ? (
                <textarea
                  key={selected.id}
                  defaultValue={(() => { try { return localStorage.getItem(noteKey(selected.id)) ?? '' } catch { return '' } })()}
                  onChange={e => { const v = e.target.value; setNoteSaved(false); if (noteSaveTimerRef.current) window.clearTimeout(noteSaveTimerRef.current); noteSaveTimerRef.current = window.setTimeout(() => saveNote(selected.id, v), 500) }}
                  onBlur={e => { if (noteSaveTimerRef.current) window.clearTimeout(noteSaveTimerRef.current); saveNote(selected.id, e.target.value) }}
                  placeholder="Ghi lại điều bạn muốn nhớ về bài này…"
                  style={{ flex: 1, minHeight: 90, marginTop: 10, resize: 'none', width: '100%', border: `1px solid ${L.border}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', color: L.t1, background: L.bg, outline: 'none', lineHeight: 1.55, boxSizing: 'border-box' }} />
              ) : (
                <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: L.t3, fontSize: 13.5 }}>Chọn một bài để ghi chú.</div>
              )}
              {/* CTA phụ — Hỏi Thầy (route thật). Chừa chỗ "Trả bài" cạnh đây, chưa mở. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setTab('teacher')} style={{ background: 'transparent', color: L.p1, border: `1.5px solid ${L.p1}`, borderRadius: 12, padding: '8px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>💬 Hỏi Thầy về bài này</button>
                <span style={{ color: L.t3, fontSize: 11.5, fontWeight: 700, opacity: .7 }}>Trả bài cho Thầy · sắp có</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══ BOTTOM NAV ════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${L.border}`,
        display: 'flex', padding: '9px 5px max(10px, env(safe-area-inset-bottom)) 5px',
        zIndex: 20,
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id}
              onClick={() => { setTab(t.id); if (t.id === 'hoc') setScreen('home') }}
              style={{
                flex: 1, minWidth: 0, background: active ? L.p2 : 'transparent', border: 'none',
                borderRadius: 14, cursor: 'pointer', padding: '7px 2px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontFamily: 'inherit', transition: 'background .15s',
              }}>
              <NavIcon name={t.id} color={active ? L.p1 : L.t3} size={23} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 500, color: active ? L.p1 : L.t3, letterSpacing: '.01em', whiteSpace: 'nowrap' }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>

    {/* ── Modal Cài đặt hồ sơ ── */}
    {showSettings && (
      <div onClick={() => setShowSettings(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: L.surface, borderRadius: '24px 24px 0 0', padding: '20px 20px max(20px, env(safe-area-inset-bottom))', width: '100%', maxWidth: 430, boxShadow: '0 -8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: L.border, margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>Hồ sơ của tôi</span>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: L.t3, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
            <div onClick={() => avatarFileRef.current?.click()}
              style={{ width: 92, height: 92, borderRadius: '50%', background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: L.p1, fontWeight: 800, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: `3px solid ${L.surface}`, boxShadow: L.shadow }}>
              {me.avatar_url
                ? <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : name.charAt(0).toUpperCase()}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 17, padding: '3px 0', textAlign: 'center' }}>📷</div>
            </div>
            <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.currentTarget.value = '' }} />
            <div style={{ fontSize: 13, color: L.t3, marginTop: 10 }}>{savingProfile ? 'Đang lưu…' : 'Bấm vào ảnh để đổi ảnh đại diện'}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, marginBottom: 8 }}>Tên hiển thị</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                placeholder="Nhập tên của bạn"
                style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: `1px solid ${L.border}`, fontSize: 16, fontFamily: 'inherit', outline: 'none', background: L.surface2 }} />
              <button onClick={saveDisplayName} disabled={savingProfile || !nameDraft.trim()}
                style={{ background: L.p1, color: L.tinv, border: 'none', borderRadius: 12, padding: '0 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (savingProfile || !nameDraft.trim()) ? 0.5 : 1 }}>
                Lưu
              </button>
            </div>
          </div>
          {/* Đổi mật khẩu — học sinh tự đổi tại chỗ, không cần email */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: L.t2, marginBottom: 8 }}>Đổi mật khẩu</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={pwDraft} onChange={e => setPwDraft(e.target.value)} type="password"
                placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: `1px solid ${L.border}`, fontSize: 16, fontFamily: 'inherit', outline: 'none', background: L.surface2 }} />
              <button onClick={changePassword} disabled={savingPw || pwDraft.trim().length < 6}
                style={{ background: L.p1, color: L.tinv, border: 'none', borderRadius: 12, padding: '0 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (savingPw || pwDraft.trim().length < 6) ? 0.5 : 1 }}>
                {savingPw ? '…' : 'Đổi'}
              </button>
            </div>
            {pwMsg && <div style={{ fontSize: 13, marginTop: 8, color: pwMsg.startsWith('✓') ? '#16A34A' : '#E53E3E' }}>{pwMsg}</div>}
          </div>
          <button onClick={() => setShowSettings(false)}
            style={{ width: '100%', background: L.surface2, border: `1px solid ${L.border}`, borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 700, color: L.t1, cursor: 'pointer', fontFamily: 'inherit' }}>
            Xong
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletingAccount}
            style={{ width: '100%', background: 'none', border: 'none', marginTop: 12, padding: '10px', fontSize: 14, color: '#E53E3E', cursor: 'pointer', fontFamily: 'inherit', opacity: deletingAccount ? 0.5 : 1 }}>
            {deletingAccount ? 'Đang xóa tài khoản...' : 'Xóa tài khoản'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 4 }}>
            <a href="https://timming.vananhaudio.com/tvaprivacy" target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: '#6B7280', textDecoration: 'underline' }}>
              Chính sách bảo mật
            </a>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal xác nhận xóa tài khoản ── */}
    {showDeleteConfirm && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ background: L.surface, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
          <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: L.t1, textAlign: 'center' }}>Xóa tài khoản?</h3>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: L.t2, textAlign: 'center', lineHeight: 1.6 }}>
            Toàn bộ dữ liệu học tập, tiến độ và lịch sử luyện tập của bạn sẽ bị <strong>xóa vĩnh viễn</strong> và không thể khôi phục.
          </p>
          <button
            onClick={async () => {
              setShowDeleteConfirm(false)
              setDeletingAccount(true)
              try {
                const { error } = await supabase.rpc('delete_my_account')
                if (error) {
                  // Lỗi Postgres (FK chặn / chưa đăng nhập) trả về ở đây, KHÔNG vào catch.
                  // Phải dừng lại — KHÔNG được signOut/logout giả vờ như đã xóa.
                  setDeletingAccount(false)
                  alert('Không xóa được tài khoản. Vui lòng thử lại hoặc liên hệ vananhaudio@gmail.com.')
                  return
                }
                // Đã xóa thành công ở server -> đăng xuất. Token mồ côi 401 là vô hại.
                try { await supabase.auth.signOut() } catch { /* token đã mồ côi sau khi xóa */ }
                onLogout()
              } catch {
                setDeletingAccount(false)
                alert('Không xóa được tài khoản. Vui lòng kiểm tra mạng và thử lại.')
              }
            }}
            style={{ width: '100%', background: '#E53E3E', border: 'none', borderRadius: 14, padding: '15px', fontSize: 17, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
            Xóa tài khoản vĩnh viễn
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            style={{ width: '100%', background: L.surface2, border: `1px solid ${L.border}`, borderRadius: 14, padding: '15px', fontSize: 17, fontWeight: 600, color: L.t1, cursor: 'pointer', fontFamily: 'inherit' }}>
            Hủy bỏ
          </button>
        </div>
      </div>
    )}

    {/* ── Tool Overlay — fullscreen iframe, không rời app ── */}
    {activeTool && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>
        {/* Thanh tiêu đề */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: L.p1, flexShrink: 0 }}>
          <button onClick={closeTool}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 12, minWidth: 72, height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', fontWeight: 600 }}>
            ✕ <span style={{ fontSize: 14 }}>Đóng</span>
          </button>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTool.name}</span>
        </div>
        {/* Tool chạy trong iframe — session Supabase được chia sẻ qua localStorage */}
        <iframe
          src={activeTool.url}
          style={{ flex: 1, border: 'none', width: '100%' }}
          allow="microphone; camera"
          title={activeTool.name}
        />
      </div>
    )}
    </>
  )
}
