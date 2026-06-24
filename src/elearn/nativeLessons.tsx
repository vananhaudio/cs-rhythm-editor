// ── Registry BÀI HỌC NATIVE ───────────────────────────────────────────────────
// Bài có lesson_type='native' + content_url = key dưới đây → portal render component.
// Thêm bài native mới: viết component nhận { onClose, onComplete } rồi khai báo 1 dòng.
import type { ComponentType } from 'react'
import ChordLesson from './ChordLesson'
import { AM_E, C_G7 } from './chordLessons'

export interface NativeLessonProps { onClose?: () => void; onComplete?: () => void }

export const NATIVE_LESSONS: Record<string, { label: string; Component: ComponentType<NativeLessonProps> }> = {
  'chord-cg7': { label: 'Quạt hợp âm C ↔ G7 (3 bài tập)', Component: (p) => <ChordLesson cfg={C_G7} {...p} /> },
  'chord-am-e': { label: 'Hợp âm Am & E + 3 bài tập đổi (mic)', Component: (p) => <ChordLesson cfg={AM_E} {...p} /> },
}
