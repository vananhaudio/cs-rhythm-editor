// ── Lớp dữ liệu Strum Score học sinh tự soạn (bảng student_strum_drafts) ───────
// RLS: học sinh chỉ thấy/sửa bài của mình; thầy đọc hết. Xem db/student_strum_drafts.sql
import { supabase } from './supabase'

export type DraftStatus = 'draft' | 'done'

export interface StrumDraft {
  id: string
  owner_id?: string
  title: string
  sheet_url: string | null
  meter: number
  raw_lyric: string
  cuts: number[]
  status: DraftStatus   // 'draft' = đang soạn · 'done' = xong, hiện ở "Bài hát của tôi"
  pattern_id?: string | null
  style_id?: string | null
  tempo?: number | null
  created_at?: string
  updated_at?: string
}

// Chuẩn hoá hàng DB → StrumDraft (cuts có thể là null/chuỗi; status có thể chưa có cột)
function normalize(row: any): StrumDraft {
  let cuts: number[] = []
  try { cuts = Array.isArray(row.cuts) ? row.cuts : JSON.parse(row.cuts ?? '[]') } catch { cuts = [] }
  return {
    id: row.id, owner_id: row.owner_id, title: row.title ?? 'Bài chưa đặt tên',
    sheet_url: row.sheet_url ?? null, meter: row.meter ?? 4, raw_lyric: row.raw_lyric ?? '',
    cuts, status: row.status === 'done' ? 'done' : 'draft',
    pattern_id: row.pattern_id ?? null, style_id: row.style_id ?? null, tempo: row.tempo ?? null,
    created_at: row.created_at, updated_at: row.updated_at,
  }
}

// Danh sách bài của người đang đăng nhập (mới sửa lên đầu)
export async function listMyDrafts(): Promise<StrumDraft[]> {
  const { data, error } = await supabase.from('student_strum_drafts').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalize)
}

// Tạo bài mới (owner_id tự lấy auth.uid() từ default DB). Trả bài vừa tạo.
export async function createDraft(title = 'Bài chưa đặt tên'): Promise<StrumDraft> {
  const { data, error } = await supabase.from('student_strum_drafts').insert({ title }).select('*').single()
  if (error) throw error
  return normalize(data)
}

// Lưu thay đổi 1 bài
export async function saveDraft(id: string, patch: Partial<StrumDraft>): Promise<void> {
  const { owner_id, id: _i, created_at, updated_at, ...rest } = patch as any
  const { error } = await supabase.from('student_strum_drafts').update(rest).eq('id', id)
  if (error) throw error
}

// Xoá bài
export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase.from('student_strum_drafts').delete().eq('id', id)
  if (error) throw error
}
