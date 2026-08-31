/**
 * CLASS PRACTICE — nguồn lịch thực hành cho trang /class (Lịch thực hành thành viên).
 *
 * PORT từ class2-site/src/lib/practice.ts (trang /azz) — cùng project Supabase
 * (wojmdilyflffvdtpovmq), cùng bảng class_schedule + class_sessions, cùng cờ
 * show_on_practice_schedule = true (Admin bật). RLS anon đã mở sẵn cho nhóm này.
 *
 * NGUYÊN TẮC: KHÔNG hardcode thứ/giờ/tên nhóm — Admin là nguồn duy nhất.
 * Lịch lớp tuyển sinh (/class) đọc class_schedule với show_on_practice_schedule =
 * false — 2 lịch độc lập, không nhập chung.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type Stage = 'co_ban' | 'phat_trien' | 'nang_cao'

/** 1 nhóm thực hành = 1 dòng class_schedule (lặp hằng tuần). */
export interface PracticeGroup {
  id: string
  name: string
  code: string | null
  stage: Stage | null
  practice_type: string | null
  weekday: number | null       // 0=CN … 6=T7
  start_time: string | null    // '19:00:00'
  duration_minutes: number
  start_date: string | null
  end_date: string | null
  status: string | null
  is_active: boolean
  program_code: string | null
  timezone: string | null
  show_on_practice_schedule: boolean
  metadata?: Record<string, unknown> | null
}

/** 1 buổi đã sinh (class_sessions). */
export interface PracticeSession {
  id: string
  class_id: string
  session_number: number | null
  title: string | null
  start_at: string
  end_at: string | null
  status: string
  event_type: string
}

export interface PracticeData {
  groups: PracticeGroup[]
  sessions: PracticeSession[]
}

/** Bậc thực hành — enum cố định của Class (không phải mapping thứ↔bậc). */
export const STAGES: { v: Stage; l: string; color: string; soft: string }[] = [
  { v: 'co_ban', l: 'Cơ bản', color: '#2D6A4F', soft: '#E9F3EC' },
  { v: 'phat_trien', l: 'Phát triển', color: '#B45309', soft: '#FEF3C7' },
  { v: 'nang_cao', l: 'Nâng cao', color: '#7C3AED', soft: '#F3E8FF' },
]
export const stageInfo = (v?: string | null) => STAGES.find(s => s.v === v) ?? null

/** Nhãn loại thực hành — map hiển thị cho giá trị quen thuộc, còn lại hiện nguyên. */
const PT_LABEL: Record<string, string> = {
  tia_not: 'Tỉa nốt',
  dem_hat: 'Đệm hát',
  cam_am: 'Cảm âm',
  solo: 'Solo',
  nhac_ly: 'Nhạc lý',
  tong_hop: 'Tổng hợp',
  nang_cao: 'Thực hành nâng cao',
}
export const practiceTypeLabel = (v?: string | null): string | null =>
  v ? (PT_LABEL[v.trim().toLowerCase()] ?? v) : null

/**
 * TÊN PUBLIC cho học sinh — KHÔNG hiển thị mã nội bộ (class code/program code).
 * Thứ tự ưu tiên (structured data, không parse/cắt chuỗi):
 *   1. metadata.public_title (Admin đặt — rõ nghĩa nhất nếu có)
 *   2. practice_type + stage → vd 'Đệm hát' + 'Cơ bản' → 'Đệm hát cơ bản'
 *   3. practice_type hoặc stage đơn lẻ
 *   4. name gốc (fallback cuối — hiếm, chỉ khi Admin chưa khai báo gì)
 */
export function publicTitle(g: PracticeGroup): string {
  const metaTitle = typeof g.metadata?.public_title === 'string' && g.metadata.public_title.trim()
    ? g.metadata.public_title.trim()
    : null
  if (metaTitle) return metaTitle
  const pt = practiceTypeLabel(g.practice_type)
  const st = stageInfo(g.stage)
  if (pt && st) {
    // tránh lặp: 'Thực hành nâng cao' + 'Nâng cao' → chỉ giữ practice label
    return pt.toLowerCase().includes(st.l.toLowerCase()) ? pt : `${pt} ${st.l.toLowerCase()}`
  }
  return pt ?? st?.l ?? (g.name || '')
}

export const WEEKDAY_LABEL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

/** '19:00:00' + 90 → '19:00–20:30' */
export function timeRange(startTime?: string | null, durationMin?: number | null): string {
  if (!startTime) return ''
  const [h, m] = startTime.slice(0, 5).split(':').map(Number)
  const end = new Date(2000, 0, 1, h, m, 0)
  end.setMinutes(end.getMinutes() + (durationMin || 90))
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(h)}:${p2(m)}–${p2(end.getHours())}:${p2(end.getMinutes())}`
}

/** ISO → 'Thứ 5 · 19:00' / 'Thứ 5, 19/11' cho danh sách buổi sắp tới. */
export function fmtSessionDay(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAY_LABEL[d.getDay()]} · ${d.getDate()}/${d.getMonth() + 1}`
}
export function fmtSessionTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Đọc lịch thực hành thật: nhóm thực hành đang bật (stage/practice_type) + buổi sắp tới.
 * Không có nhóm nào → data rỗng (UI hiển thị trạng thái "đang cập nhật").
 */
export async function fetchPractice(): Promise<{ ok: true; data: PracticeData } | { ok: false; error: string }> {
  try {
    // 1) Nhóm thực hành: CỜ show_on_practice_schedule = true (Admin bật) + đang hoạt động.
    //    stage/practice_type chỉ là mô tả sư phạm — KHÔNG dùng làm điều kiện hiển thị.
    const gRes = await supabase
      .from('class_schedule')
      .select('id,name,code,stage,practice_type,weekday,start_time,duration_minutes,start_date,end_date,status,is_active,program_code,timezone,show_on_practice_schedule')
      .eq('show_on_practice_schedule', true)
      .eq('is_active', true)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })
    if (gRes.error) throw new Error(`class_schedule ${gRes.error.message}`)
    const groups = (gRes.data ?? []) as PracticeGroup[]

    // 2) Buổi sắp tới của các nhóm đó (nếu có nhóm)
    let sessions: PracticeSession[] = []
    if (groups.length) {
      const ids = groups.map(g => g.id)
      const now = new Date().toISOString()
      const sRes = await supabase
        .from('class_sessions')
        .select('id,class_id,session_number,title,start_at,end_at,status,event_type')
        .in('class_id', ids)
        .gte('start_at', now)
        .order('start_at', { ascending: true })
        .limit(24)
      if (sRes.error) throw new Error(`class_sessions ${sRes.error.message}`)
      sessions = (sRes.data ?? []) as PracticeSession[]
    }

    return { ok: true, data: { groups, sessions } }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) }
  }
}

/** Hook dùng chung cho các section cần lịch — fetch 1 lần, reload được. */
export function usePractice() {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: PracticeData | null }>({
    loading: true,
    error: null,
    data: null,
  })
  const reload = () => {
    setState(s => ({ ...s, loading: true, error: null }))
    fetchPractice().then(res => {
      if (res.ok) setState({ loading: false, error: null, data: res.data })
      else setState({ loading: false, error: res.error, data: null })
    })
  }
  useEffect(() => {
    // fetch lần đầu — setState chỉ xảy ra bất đồng bộ trong .then (không cascading render)
    fetchPractice().then(res => {
      if (res.ok) setState({ loading: false, error: null, data: res.data })
      else setState({ loading: false, error: res.error, data: null })
    })
  }, [])
  return { ...state, reload }
}
