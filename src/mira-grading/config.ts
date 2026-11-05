import { Capacitor } from '@capacitor/core'
import { miraOriginOf } from './protocol'

/**
 * Khung Mira cạnh màn chấm bài CHỈ bật khi build có VITE_MIRA_GRADING_URL (URL trang /grading của Mira) → mặc định TẮT:
 * không đổi gì cho production cho tới khi Owner duyệt và đặt biến này. Giai đoạn đầu chỉ WEB: tắt trong app native (iOS/Android),
 * nơi bản web đóng gói sẵn và chưa kiểm duyệt Mira.
 */
export function miraGradingConfig(env: { url?: string; isNative?: boolean } = {}): { url: string; origin: string } | null {
  const url = env.url ?? (import.meta.env?.VITE_MIRA_GRADING_URL as string | undefined)
  const isNative = env.isNative ?? safeIsNative()
  if (isNative) return null
  const origin = miraOriginOf(url)
  return origin && url ? { url, origin } : null
}
function safeIsNative(): boolean { try { return Capacitor.isNativePlatform() } catch { return false } }
