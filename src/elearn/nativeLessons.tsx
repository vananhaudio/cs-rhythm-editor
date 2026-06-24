// ── Registry BÀI HỌC NATIVE ───────────────────────────────────────────────────
// Bài có lesson_type='native' + content_url = key dưới đây → portal render component.
// Thêm bài native mới: viết component nhận { onClose, onComplete } rồi khai báo 1 dòng.
import type { ComponentType } from 'react'
import ChordLessonCG7 from './ChordLessonCG7'
import ChordLesson from './ChordLesson'
import { AM_E } from './chordLessons'

export interface NativeLessonProps { onClose?: () => void; onComplete?: () => void }

export const NATIVE_LESSONS: Record<string, { label: string; Component: ComponentType<NativeLessonProps> }> = {
  'chord-cg7': { label: 'Đổi hợp âm C ↔ G7 (mic + nhịp)', Component: ChordLessonCG7 },
  'chord-am-e': { label: 'Hợp âm Am & E + 3 bài tập đổi (mic)', Component: (p) => <ChordLesson cfg={AM_E} {...p} /> },
}
