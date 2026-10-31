// Khung Mira cạnh màn chấm bài (chỉ Thầy/admin ĐƯỢC PHÉP trong pilot, chỉ web, chỉ khi build bật VITE_MIRA_GRADING_URL).
// Class chỉ nói cho Mira "Thầy đang mở bài trả này" — Mira tự tra ngữ cảnh. Tắt/không được phép/hỏng thì màn chấm bài y nguyên.
import { useMemo, type ReactNode } from 'react'
import './miraDock.css'
import PilotDock from './PilotDock'
import { miraGradingApi } from './client'
import { miraGradingConfig } from './config'

export default function MiraDock({ enabled, threadId, children }: { enabled: boolean; threadId: string; children: ReactNode }) {
  const cfg = useMemo(() => (enabled ? miraGradingConfig() : null), [enabled])
  return <PilotDock enabled={enabled} cfg={cfg} api={miraGradingApi} threadId={threadId}>{children}</PilotDock>
}
