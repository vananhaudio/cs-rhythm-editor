// Đề bài của một bài trả (checkpoint) để Thầy xem NGAY trong màn chấm. Dùng lại khối checkpoint của giáo trình
// (class_lesson_content.blocks) — không sao chép đề, không thêm bảng. Logic thuần: không React, không Supabase.
import { isCheckpoint } from '../lesson/checkpoint'
import type { LessonSection } from '../lesson/lessonTypes'

export type CheckpointPrompt = { id: string; title: string; prompt: string | null }

/** Tìm đúng bài trả theo id trong các khối của buổi; không có → null (không đoán bài khác). */
export function pickCheckpointPrompt(sections: LessonSection[], checkpointId: string): CheckpointPrompt | null {
  const cp = sections.filter(isCheckpoint).find(c => c.id === checkpointId)
  if (!cp) return null
  const prompt = typeof cp.prompt === 'string' && cp.prompt.trim() ? cp.prompt.trim() : null
  return { id: cp.id, title: cp.title, prompt }
}

export type PromptState = { status: 'loading' } | { status: 'missing' } | { status: 'unpublished' } | { status: 'ready'; cp: CheckpointPrompt }
/** Một hàng class_lesson_content: trạng thái + các khối. */
export type SessionBlocks = { status: string; sections: LessonSection[] }

/** Hàng giáo trình → trạng thái thẻ. Chỉ 'published' mới cho ra đề. */
export function promptStateOf(content: SessionBlocks | null, checkpointId: string): PromptState {
  if (!content) return { status: 'missing' }
  if (content.status !== 'published') return { status: 'unpublished' }
  const cp = pickCheckpointPrompt(content.sections, checkpointId)
  return cp ? { status: 'ready', cp } : { status: 'missing' }
}
