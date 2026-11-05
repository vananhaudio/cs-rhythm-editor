// Cổng pilot: Mira CHỈ hiện cho tài khoản được phép (server quyết định, xem mira_grading_pilot_enabled).
// Chưa biết / không được / lỗi → chỉ render children, y hệt khi chưa có tính năng (không iframe, không xin vé, không đổi bố cục).
import type { ReactNode } from 'react'
import DockView from './DockView'
import type { MiraGradingApi } from './api'
import { usePilotEnabled } from './usePilotEnabled'

type Cfg = { url: string; origin: string }

export default function PilotDock({ enabled, cfg, api, threadId, children }: {
  enabled: boolean; cfg: Cfg | null; api: MiraGradingApi; threadId: string; children: ReactNode
}) {
  const pilot = usePilotEnabled(api, enabled && !!cfg)
  return <DockView enabled={pilot} cfg={cfg} api={api} threadId={threadId}>{children}</DockView>
}
