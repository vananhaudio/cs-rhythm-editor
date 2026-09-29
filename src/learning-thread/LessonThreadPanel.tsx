// App học — khu vực "TRẢ BÀI / HỎI BÀI" ngay trong bài đang học (PRIVATE VIEW: chỉ thread của chính mình).
// Không cấu hình (cả hai off) → KHÔNG hiện gì. "Yêu cầu Trả bài" (required) chỉ hiển thị, KHÔNG khoá bài (P1).
// Mọi hành động mở LearningThreadSheet — cùng MỘT thread cho bài này.
import { useState } from 'react'
import './styles'
import { isEnabled } from './ltModel'
import { useLessonThreadState } from './useLessonThreadState'
import { LessonThreadPanelView } from './LessonThreadPanelView'
import LearningThreadSheet, { type SheetMode } from './LearningThreadSheet'

export default function LessonThreadPanel({ lessonId, lessonTitle, compact = false, disabled = false }: {
  lessonId: string
  lessonTitle: string
  compact?: boolean
  /** xem thử của Thầy / khách → không hiện */
  disabled?: boolean
}) {
  const { state, reload } = useLessonThreadState(lessonId, !disabled)
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  if (disabled || !state || !isEnabled(state)) return null
  return (
    <>
      <LessonThreadPanelView state={state} compact={compact}
        onAction={a => setSheet(a.kind ? { compose: a.kind } : { compose: null })} />
      {sheet && (
        <LearningThreadSheet lessonId={lessonId} lessonTitle={lessonTitle} state={state} mode={sheet}
          onClose={() => setSheet(null)} onChanged={reload} />
      )}
    </>
  )
}
