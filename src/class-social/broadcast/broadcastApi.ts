// Supabase cho Broadcast V1 — MỌI thao tác qua RPC broadcast_* (bảng không đọc/ghi thẳng được). Quyền admin do server kiểm.
import { supabase } from '../../supabase'
import type { Result } from '../posts/postsApi'
import {
  broadcastError, toAudienceOptions, toCampaign, toCampaigns, toPreview, toRecipients, toRpcArgs,
  type AudienceOption, type AudienceRow, type Campaign, type CampaignRow, type Draft, type Preview, type PreviewRow, type Recipient, type RecipientRow,
} from './broadcastModel'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T> & { countChanged?: boolean }> {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      if (import.meta.env.DEV) console.warn(`[broadcast] ${fn}:`, error.code, error.message)
      const e = broadcastError(error, !online())
      return { ok: false, message: e.text, countChanged: e.countChanged }
    }
    return { ok: true, value: data as T }
  } catch (e) {
    return { ok: false, message: broadcastError(e as Error, !online()).text }
  }
}

export async function fetchAudiences(): Promise<Result<AudienceOption[]>> {
  const r = await rpc<AudienceRow[]>('broadcast_audiences', {})
  return r.ok ? { ok: true, value: toAudienceOptions(r.value) } : r
}

export async function previewBroadcast(d: Draft): Promise<Result<Preview>> {
  const a = toRpcArgs(d)
  const r = await rpc<PreviewRow[]>('broadcast_preview', { p_channel: a.p_channel, p_audience: a.p_audience, p_ref: a.p_ref })
  if (!r.ok) return r
  const p = toPreview(r.value?.[0])
  return p ? { ok: true, value: p } : { ok: false, message: 'Chưa tải được số người nhận. Hãy thử lại.' }
}

/** Xác nhận gửi. key = khoá chống gửi trùng sinh MỘT lần cho mỗi lần Owner mở màn xác nhận. */
export async function confirmBroadcast(d: Draft, key: string, expected: number): Promise<Result<string> & { countChanged?: boolean }> {
  return rpc<string>('broadcast_confirm', { p_key: key, ...toRpcArgs(d), p_expected: expected })
}

export async function fetchCampaigns(limit = 30): Promise<Result<Campaign[]>> {
  const r = await rpc<CampaignRow[]>('broadcast_campaigns', { p_limit: limit })
  return r.ok ? { ok: true, value: toCampaigns(r.value) } : r
}
export async function fetchCampaign(id: string): Promise<Result<Campaign | null>> {
  const r = await rpc<CampaignRow[]>('broadcast_campaign', { p_id: id })
  return r.ok ? { ok: true, value: toCampaign(r.value?.[0]) } : r
}
export async function fetchRecipients(id: string, status: string | null, after: string | null): Promise<Result<Recipient[]>> {
  const r = await rpc<RecipientRow[]>('broadcast_recipients_page', { p_id: id, p_status: status, p_after: after, p_limit: 50 })
  return r.ok ? { ok: true, value: toRecipients(r.value) } : r
}
export async function cancelBroadcast(id: string): Promise<Result<{ status: string; cancelled: number }>> {
  return rpc('broadcast_cancel', { p_id: id })
}
