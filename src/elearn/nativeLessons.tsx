// ── Registry BÀI HỌC NATIVE ───────────────────────────────────────────────────
// Bài có lesson_type='native' + content_url = key dưới đây → portal render component.
// Thêm bài native mới: viết component nhận { onClose, onComplete } rồi khai báo 1 dòng.
import type { ComponentType } from 'react'
import ChordLesson from './ChordLesson'
import { AM_E, C_G7, BASIC_1 } from './chordLessons'
import ForcedVideo from './ForcedVideo'

export interface NativeLessonProps { onClose?: () => void; onComplete?: () => void; studentId?: string; lessonId?: string }

// Video "Chào mừng Trình độ 2" — ép xem hết. Upload welcome-td2.mp4 vào bucket lessons.
const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'
const WELCOME_TD2 = {
  title: 'Chào mừng đến Trình độ 2',
  crumb: 'KHỞI ĐẦU ĐAM MÊ · TRÌNH ĐỘ 2',
  videoUrl: STORE + 'welcome-td2.mp4',
}

export const NATIVE_LESSONS: Record<string, { label: string; Component: ComponentType<NativeLessonProps> }> = {
  'welcome-td2': { label: 'Chào mừng Trình độ 2 — video (ép xem hết)', Component: (p) => <ForcedVideo cfg={WELCOME_TD2} {...p} /> },
  'chord-cg7': { label: 'Quạt hợp âm C ↔ G7 (3 bài tập)', Component: (p) => <ChordLesson cfg={C_G7} {...p} /> },
  'chord-am-e': { label: 'Hợp âm Am & E + 3 bài tập đổi (mic)', Component: (p) => <ChordLesson cfg={AM_E} {...p} /> },
  'chord-basic-1': { label: 'Chuyển hợp âm cơ bản 1 — C·G7·Am·E·Dm (6 BT, có nghỉ)', Component: (p) => <ChordLesson cfg={BASIC_1} {...p} /> },
}
