// Khung Mira cạnh màn chấm bài (chỉ Thầy/admin, chỉ web, chỉ khi build bật VITE_MIRA_GRADING_URL).
// Class chỉ nói cho Mira "Thầy đang mở bài trả này" — Mira tự tra ngữ cảnh. Tắt/hỏng thì màn chấm bài vẫn y nguyên.
import { useMemo, type ReactNode } from 'react'
import './miraDock.css'
import DockView from './DockView'
import { miraGradingApi } from './client'
import { miraGradingConfig } from './config'

export default function MiraDock({ enabled, threadId, children }: { enabled: boolean; threadId: string; children: ReactNode }) {
  const cfg = useMemo(() => (enabled ? miraGradingConfig() : null), [enabled])
  return <DockView enabled={enabled} cfg={cfg} api={miraGradingApi} threadId={threadId}>{children}</DockView>
}
