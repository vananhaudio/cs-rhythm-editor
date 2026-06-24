// ── Registry BÀI HỌC NATIVE ───────────────────────────────────────────────────
// Bài có lesson_type='native' + content_url = key dưới đây → portal render component.
// Thêm bài native mới: viết component nhận { onClose, onComplete } rồi khai báo 1 dòng.
import type { ComponentType } from 'react'
import ChordLesson from './ChordLesson'
import { AM_E, C_G7, BASIC_1 } from './chordLessons'
import NarratedSlides from './NarratedSlides'

export interface NativeLessonProps { onClose?: () => void; onComplete?: () => void; studentId?: string; lessonId?: string }

// Slide "Chào mừng Trình độ 2" — trình chiếu như video, ép nghe hết.
// Ảnh slide: upload td2-1.png … td2-8.png vào bucket lessons (Supabase Storage).
const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'
const WELCOME_TD2 = {
  title: 'Chào mừng đến Trình độ 2',
  crumb: 'KHỞI ĐẦU ĐAM MÊ · TRÌNH ĐỘ 2',
  audioUrl: STORE + 'Chao%20mung%20trinh%20do%202.wav',
  slides: Array.from({ length: 8 }, (_, i) => `${STORE}td2-${i + 1}.png`),
}

export const NATIVE_LESSONS: Record<string, { label: string; Component: ComponentType<NativeLessonProps> }> = {
  'welcome-td2': { label: 'Chào mừng Trình độ 2 — slide + audio (ép nghe hết)', Component: (p) => <NarratedSlides cfg={WELCOME_TD2} {...p} /> },
  'chord-cg7': { label: 'Quạt hợp âm C ↔ G7 (3 bài tập)', Component: (p) => <ChordLesson cfg={C_G7} {...p} /> },
  'chord-am-e': { label: 'Hợp âm Am & E + 3 bài tập đổi (mic)', Component: (p) => <ChordLesson cfg={AM_E} {...p} /> },
  'chord-basic-1': { label: 'Chuyển hợp âm cơ bản 1 — C·G7·Am·E·Dm (6 BT, có nghỉ)', Component: (p) => <ChordLesson cfg={BASIC_1} {...p} /> },
}
