// Supabase cho Trò chuyện V1a. MỌI thao tác qua RPC dm_* (bảng dm_* không đọc/ghi thẳng được).
// Client KHÔNG tự suy luận quyền: dm_can_message / can_send do server quyết.
import { supabase } from '../../supabase'
import type { Result } from '../posts/postsApi'
import {
  chatErrorText, toConversations, toMessages, PAGE,
  type ChatMessage, type ConversationItem, type ConversationRow, type MessageRow,
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

export async function fetchConversations(): Promise<Result<ConversationItem[]>> {
  const r = await rpc<ConversationRow[]>('dm_conversations', { p_limit: 50 })
  return r.ok ? { ok: true, value: toConversations(r.value) } : r
}

export async function fetchUnreadCount(): Promise<Result<number>> {
  const r = await rpc<number>('dm_unread_count', {})
  return r.ok ? { ok: true, value: Math.max(0, Number(r.value) || 0) } : r
}

/** Tin của một hội thoại. afterSeq → chỉ tin mới (polling); beforeSeq → trang cũ hơn; không có → trang mới nhất */
export async function fetchMessages(conversationId: string, opts: { afterSeq?: number; beforeSeq?: number; limit?: number } = {}): Promise<Result<ChatMessage[]>> {
  const r = await rpc<MessageRow[]>('dm_messages', {
    p_conversation: conversationId,
    p_after_seq: opts.afterSeq ?? null,
    p_before_seq: opts.beforeSeq ?? null,
    p_limit: opts.limit ?? PAGE,
  })
  return r.ok ? { ok: true, value: toMessages(r.value) } : r
}

export async function sendMessage(conversationId: string, body: string): Promise<Result<number>> {
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

/** Chia sẻ một BMS artifact cho một người bạn (V1b): CHỈ gửi tham chiếu; DB kiểm bạn bè + quyền đọc object của người gửi. */
export async function shareToFriend(userId: string, artifactId: string): Promise<Result<{ conversationId: string; seq: number }>> {
  const r = await rpc<{ conversation_id: string; seq: number | string }[]>('dm_share', { p_user: userId, p_ref_type: 'tool_artifact', p_ref_key: artifactId }, 'share')
  if (!r.ok) return r
  const row = r.value?.[0]
  return row?.conversation_id ? { ok: true, value: { conversationId: row.conversation_id, seq: Number(row.seq) } } : { ok: false, message: 'Chưa thực hiện được. Hãy thử lại.' }
}
