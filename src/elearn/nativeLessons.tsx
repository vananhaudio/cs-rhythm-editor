// ── Registry BÀI HỌC NATIVE ───────────────────────────────────────────────────
// Bài có lesson_type='native' + content_url = key dưới đây → portal render component.
// Thêm bài native mới: viết component nhận { onClose, onComplete } rồi khai báo 1 dòng.
import type { ComponentType } from 'react'
import ChordLesson from './ChordLesson'
import { AM_E, C_G7, BASIC_1 } from './chordLessons'

export interface NativeLessonProps { onClose?: () => void; onComplete?: () => void; studentId?: string; lessonId?: string }

export const NATIVE_LESSONS: Record<string, { label: string; Component: ComponentType<NativeLessonProps> }> = {
  'chord-cg7': { label: 'Quạt hợp âm C ↔ G7 (3 bài tập)', Component: (p) => <ChordLesson cfg={C_G7} {...p} /> },
  'chord-am-e': { label: 'Hợp âm Am & E + 3 bài tập đổi (mic)', Component: (p) => <ChordLesson cfg={AM_E} {...p} /> },
  'chord-basic-1': { label: 'Chuyển hợp âm cơ bản 1 — C·G7·Am·E·Dm (6 BT, có nghỉ)', Component: (p) => <ChordLesson cfg={BASIC_1} {...p} /> },
}
