// ─────────────────────────────────────────────────────────────────────────────
// Class Mobile V1 — điều hướng THUẦN (không React, không DOM, không mạng) để test được.
//
// Năm tab dưới đã chốt, đúng tên và thứ tự: Trang chủ · Lớp Học · Ban Nhạc · Trò chuyện · Tôi.
// Mỗi tab có một ngăn xếp màn hình riêng (như UINavigationController của iOS): đổi tab không mất vị trí,
// bấm lại tab đang mở = về màn gốc của tab. Màn con tái dùng KIỂU `MeView` của Class Social (/me).
// ─────────────────────────────────────────────────────────────────────────────
import type { MeView } from '../class-social/resolveMeRoute'

export type MobileTab = 'home' | 'class' | 'band' | 'chat' | 'me'

/** Đúng 5 tab, đúng thứ tự — đã thống nhất, KHÔNG tự đổi tên/thứ tự/thêm tab. */
export const MOBILE_TABS: readonly { id: MobileTab; label: string }[] = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'class', label: 'Lớp Học' },
  { id: 'band', label: 'Ban Nhạc' },
  { id: 'chat', label: 'Trò chuyện' },
  { id: 'me', label: 'Tôi' },
]

/** Màn của khung mobile = màn Class Social (MeView) + vài màn riêng của khung. */
export type MobileView =
  | MeView
  | { kind: 'tabRoot' }        // màn gốc của tab (mỗi tab tự vẽ)
  | { kind: 'notices' }        // Thông báo (chuông phía trên)
  | { kind: 'account' }        // Tài khoản & cài đặt (trong tab Tôi)
  | { kind: 'blocked' }        // Người đã chặn (từ Tài khoản & cài đặt)
  | { kind: 'password' }       // Đổi mật khẩu (từ Tài khoản & cài đặt)

export const ROOT: MobileView = { kind: 'tabRoot' }

export type NavState = { tab: MobileTab; stacks: Record<MobileTab, MobileView[]> }

export function initialNav(tab: MobileTab = 'home'): NavState {
  return { tab, stacks: { home: [ROOT], class: [ROOT], band: [ROOT], chat: [ROOT], me: [ROOT] } }
}

export const isMobileTab = (v: unknown): v is MobileTab => MOBILE_TABS.some(t => t.id === v)

export const currentView = (s: NavState): MobileView => {
  const st = s.stacks[s.tab]
  return st[st.length - 1]
}
export const canPop = (s: NavState): boolean => s.stacks[s.tab].length > 1

/**
 * Màn thuộc tab nào khi MỞ TỪ NƠI KHÁC. Hội thoại luôn thuộc Trò chuyện (mở từ Trang cá nhân / Ban Nhạc → nhảy sang tab Trò chuyện);
 * mọi màn khác mở NGAY TRONG tab đang đứng (Quay lại về đúng chỗ vừa rời) — trừ khi gọi chỉ định tab.
 */
export function tabOwning(view: MobileView): MobileTab | null {
  switch (view.kind) {
    case 'chatConversation': case 'chatWith': return 'chat'
    default: return null
  }
}

export function selectTab(s: NavState, tab: MobileTab): NavState {
  if (s.tab !== tab) return { ...s, tab }
  // bấm lại tab đang mở → về màn gốc (giống iOS)
  if (s.stacks[tab].length > 1) return { ...s, stacks: { ...s.stacks, [tab]: [ROOT] } }
  return s
}

export function push(s: NavState, view: MobileView, tab?: MobileTab): NavState {
  const t = tab ?? tabOwning(view) ?? s.tab
  return { tab: t, stacks: { ...s.stacks, [t]: [...s.stacks[t], view] } }
}

/** Thay màn trên cùng (vd. Buổi trước/sau, hội thoại vừa tạo) — không chồng thêm lịch sử. */
export function replace(s: NavState, view: MobileView): NavState {
  const st = s.stacks[s.tab]
  if (st.length <= 1) return push(s, view)
  return { ...s, stacks: { ...s.stacks, [s.tab]: [...st.slice(0, -1), view] } }
}

export function pop(s: NavState): NavState {
  const st = s.stacks[s.tab]
  if (st.length <= 1) return s
  return { ...s, stacks: { ...s.stacks, [s.tab]: st.slice(0, -1) } }
}

/** Về màn cha hợp lý khi ngăn xếp đã hết (mở thẳng bằng liên kết): đẩy `fallback` thay vì không làm gì. */
export function backOr(s: NavState, fallback: MobileView): NavState {
  return canPop(s) ? pop(s) : push(s, fallback)
}

/** Lưu/khôi phục tab cuối cùng giữa các lần mở (chỉ tab, không lưu ngăn xếp). */
export const LAST_TAB_KEY = 'cm.lastTab'
export function readLastTab(storage: Pick<Storage, 'getItem'> | null): MobileTab {
  try {
    const v = storage?.getItem(LAST_TAB_KEY)
    return isMobileTab(v) ? v : 'home'
  } catch { return 'home' }
}
