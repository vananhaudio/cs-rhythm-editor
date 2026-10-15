// Supabase cho Trò chuyện V1a. MỌI thao tác qua RPC dm_* (bảng dm_* không đọc/ghi thẳng được).
// Client KHÔNG tự suy luận quyền: dm_can_message / can_send do server quyết.
import { supabase } from '../../supabase'
import type { Result } from '../posts/postsApi'
import type { ShareRef } from '../../share/shareRef'
import {
  bandIdOf, chatErrorText, isBandConversation, mergeConversationLists, toBandConversations, toBandMembers, toBandMessages,
  toConversations, toMessages, toSystemNotices, toSystemSummary, NOTICE_PAGE, PAGE,
  type BandMember, type BandMemberRow, type BandMessageRow, type BandRoomRow,
  type ChatMessage, type ConversationItem, type ConversationRow, type MessageRow,
  type SystemNotice, type SystemNoticeRow, type SystemSummary, type SystemSummaryRow,
} from './chatModel'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

async function rpc<T>(fn: string, args: Record<string, unknown>, ctx?: 'share'): Promise<Result<T>> {
  try {
    const { data, error, status } = await supabase.rpc(fn, args)
    if (error) {
      if (import.meta.env.DEV) console.warn(`[class-chat] ${fn}:`, error.code, error.message)
      return { ok: false, message: chatErrorText({ ...error, status }, !online(), ctx) }
    }
    return { ok: true, value: data as T }
  } catch (e) {
    return { ok: false, message: chatErrorText(e as Error, !online()) }
  }
}

/** Hội thoại cá nhân (dm_*) + nhóm Band (bandchat_*). Nhóm Band là phần BỔ SUNG: lỗi/chưa có tính năng ở server → danh sách cá nhân vẫn hiện bình thường. */
export async function fetchConversations(limit = 50): Promise<Result<ConversationItem[]>> {
  const [r, b] = await Promise.all([
    rpc<ConversationRow[]>('dm_conversations', { p_limit: limit }),
    rpc<BandRoomRow[]>('bandchat_rooms', { p_limit: limit }),
  ])
  if (!r.ok) return r
  return { ok: true, value: mergeConversationLists(toConversations(r.value), b.ok ? toBandConversations(b.value) : []) }
}

export async function fetchUnreadCount(): Promise<Result<number>> {
  const [r, b] = await Promise.all([rpc<number>('dm_unread_count', {}), rpc<number>('bandchat_unread_count', {})])
  if (!r.ok) return r
  return { ok: true, value: Math.max(0, Number(r.value) || 0) + (b.ok ? Math.max(0, Number(b.value) || 0) : 0) }
}

/** Thành viên hiện hành của một nhóm Band (id hội thoại dạng `band:<id>`) */
export async function fetchBandMembers(conversationId: string): Promise<Result<BandMember[]>> {
  const r = await rpc<BandMemberRow[]>('bandchat_members', { p_band: bandIdOf(conversationId) })
  return r.ok ? { ok: true, value: toBandMembers(r.value) } : r
}

/** Tin của một hội thoại. afterSeq → chỉ tin mới (polling); beforeSeq → trang cũ hơn; không có → trang mới nhất */
export async function fetchMessages(conversationId: string, opts: { afterSeq?: number; beforeSeq?: number; limit?: number } = {}): Promise<Result<ChatMessage[]>> {
  if (isBandConversation(conversationId)) {
    const b = await rpc<BandMessageRow[]>('bandchat_messages', {
      p_band: bandIdOf(conversationId),
      p_after_seq: opts.afterSeq ?? null,
      p_before_seq: opts.beforeSeq ?? null,
      p_limit: opts.limit ?? PAGE,
    })
    return b.ok ? { ok: true, value: toBandMessages(b.value) } : b
  }
  const r = await rpc<MessageRow[]>('dm_messages', {
    p_conversation: conversationId,
    p_after_seq: opts.afterSeq ?? null,
    p_before_seq: opts.beforeSeq ?? null,
    p_limit: opts.limit ?? PAGE,
  })
  return r.ok ? { ok: true, value: toMessages(r.value) } : r
}

export async function sendMessage(conversationId: string, body: string): Promise<Result<number>> {
  if (isBandConversation(conversationId)) {
    const b = await rpc<number>('bandchat_send', { p_band: bandIdOf(conversationId), p_body: body })
    return b.ok ? { ok: true, value: Number(b.value) } : b
  }
  const r = await rpc<number>('dm_send', { p_conversation: conversationId, p_body: body })
  return r.ok ? { ok: true, value: Number(r.value) } : r
}

/** Gửi tin đầu / tin tới một người: tìm-hoặc-tạo hội thoại chuẩn tắc rồi ghi tin */
export async function startConversation(userId: string, body: string): Promise<Result<{ conversationId: string; seq: number }>> {
  const r = await rpc<{ conversation_id: string; seq: number | string }[]>('dm_start', { p_user: userId, p_body: body })
  if (!r.ok) return r
  const row = r.value?.[0]
  return row?.conversation_id ? { ok: true, value: { conversationId: row.conversation_id, seq: Number(row.seq) } } : { ok: false, message: 'Chưa thực hiện được. Hãy thử lại.' }
}

export async function markRead(conversationId: string, seq: number): Promise<Result<number>> {
  if (isBandConversation(conversationId)) {
    const b = await rpc<number>('bandchat_mark_read', { p_band: bandIdOf(conversationId), p_seq: seq })
    return b.ok ? { ok: true, value: Number(b.value) } : b
  }
  const r = await rpc<number>('dm_mark_read', { p_conversation: conversationId, p_seq: seq })
  return r.ok ? { ok: true, value: Number(r.value) } : r
}

/** Hội thoại đã có với người này (không tạo). null = chưa có */
export async function findConversation(userId: string): Promise<Result<string | null>> {
  const r = await rpc<string | null>('dm_find', { p_user: userId })
  return r.ok ? { ok: true, value: r.value ?? null } : r
}

export async function canMessage(userId: string): Promise<Result<boolean>> {
  const r = await rpc<boolean>('dm_can_message', { p_user: userId })
  return r.ok ? { ok: true, value: r.value === true } : r
}

/** Chia sẻ một đối tượng cho một người bạn: CHỈ gửi tham chiếu. DB kiểm bạn bè (dm_rule) + NGƯỜI GỬI có quyền với object; không cấp quyền cho người nhận. */
export async function shareToFriend(userId: string, ref: ShareRef): Promise<Result<{ conversationId: string; seq: number }>> {
  const r = await rpc<{ conversation_id: string; seq: number | string }[]>('dm_share', { p_user: userId, p_ref_type: ref.type, p_ref_key: ref.key }, 'share')
  if (!r.ok) return r
  const row = r.value?.[0]
  return row?.conversation_id ? { ok: true, value: { conversationId: row.conversation_id, seq: Number(row.seq) } } : { ok: false, message: 'Chưa thực hiện được. Hãy thử lại.' }
}

// ── Class 2.0 (thông báo hệ thống): CHỈ đọc + đánh dấu đã đọc. Client không có đường ghi thông báo (server/trigger phát). ──
export async function fetchSystemSummary(): Promise<Result<SystemSummary>> {
  const r = await rpc<SystemSummaryRow[]>('class_system_notice_summary', {})
  return r.ok ? { ok: true, value: toSystemSummary(r.value) } : r
}

export async function fetchSystemNotices(opts: { beforeSeq?: number; limit?: number } = {}): Promise<Result<SystemNotice[]>> {
  const r = await rpc<SystemNoticeRow[]>('class_system_notices', { p_before_seq: opts.beforeSeq ?? null, p_limit: opts.limit ?? NOTICE_PAGE })
  return r.ok ? { ok: true, value: toSystemNotices(r.value) } : r
}

export async function markSystemRead(seq: number): Promise<Result<number>> {
  const r = await rpc<number>('class_system_notice_mark_read', { p_seq: seq })
  return r.ok ? { ok: true, value: Number(r.value) } : r
}
