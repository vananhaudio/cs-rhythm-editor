// Share Note — nạp xem trước trích đoạn cho bài Feed. Thứ tự BẮT BUỘC: share_note_open (server quyết ok / stale / no_access / unavailable)
// → CHỈ khi ok mới đọc giáo trình (class_lesson_content qua RLS của người xem — lớp bảo vệ thứ hai) → lấy đúng khối nhạc.
// - Hàng đợi: MỘT yêu cầu một lúc (không bắn hàng loạt khi Feed có nhiều thẻ).
// - Cache theo NGƯỜI XEM (uid trong khoá): đổi tài khoản không dùng lại kết quả của người khác; hết hạn sau TTL để thấy bản nhạc Thầy sửa.
// - Lỗi mạng KHÔNG cache (lần sau thử lại). supabase nạp ĐỘNG để component lá test được trên Node.
import { isBarsOpen, isRegionOpen, isShareNoteSessionOpen, isTextOpen, openShareNote, type BarRange, type ScoreKey, type ShareNoteKind } from './shareNoteApi'
import { scoreTexAt } from './scoreExcerpt'
import { splitByRanges, type RegionPart } from './regionAnchor'
import { UNAVAILABLE_TEXT } from './refCards'
import { leafTextAt, verifyAnchor, type TextAnchor } from './textAnchor'

export type PreviewLoad =
  | { status: 'ok'; kind: 'bars'; note: string; tex: string; bars: BarRange; score: ScoreKey; section?: unknown }   // section = khối giáo trình chứa bản nhạc (khung ngữ cảnh)
  /** vùng văn bản: `text` = toạ độ ĐÃ được server xác nhận VÀ client kiểm lại bằng băm (verifyAnchor); `section` = khối chứa lá */
  | { status: 'ok'; kind: 'text'; note: string; text: TextAnchor; moved: boolean; section: unknown }
  /** vùng khoanh hỗn hợp (V3.1): `parts` = toạ độ ĐÃ được server xác nhận VÀ client kiểm lại trên giáo trình người xem đọc được; `sections` = giáo trình của buổi */
  | { status: 'ok'; kind: 'region'; note: string; parts: RegionPart[]; moved: boolean; sections: unknown[] }
  | { status: 'stale' | 'no_access' | 'locked'; note: string; kind?: ShareNoteKind }
  | { status: 'unavailable' }
  | { status: 'error' }

export function shareNoteMessage(load: PreviewLoad | null): string | null {
  if (!load) return null
  if (load.status !== 'ok' && 'kind' in load && load.kind === 'region') {
    if (load.status === 'no_access') return 'Bạn chưa có quyền xem phần giáo trình này.'
    if (load.status === 'locked') return 'Buổi này chưa mở cho bạn nên chưa xem được vùng được khoanh.'
    if (load.status === 'stale') return 'Giáo trình đã được cập nhật nên chưa hiển thị vùng này.'
  }
  if (load.status !== 'ok' && 'kind' in load && load.kind === 'text') {
    if (load.status === 'no_access') return 'Bạn chưa có quyền xem phần giáo trình này.'
    if (load.status === 'locked') return 'Buổi này chưa mở cho bạn nên chưa xem được đoạn văn bản.'
    if (load.status === 'stale') return 'Giáo trình đã được cập nhật nên chưa hiển thị đoạn này.'
  }
  if (load.status === 'no_access') return 'Bạn chưa có quyền xem bản nhạc này.'
  if (load.status === 'locked') return 'Buổi này chưa mở cho bạn nên chưa xem được bản nhạc.'
  if (load.status === 'stale') return 'Bản nhạc đã được cập nhật nên chưa hiển thị đoạn này.'
  if (load.status === 'unavailable') return UNAVAILABLE_TEXT
  if (load.status === 'error') return 'Chưa tải được bản nhạc. Cuộn lại để thử lại.'
  return null
}

/** Mọi đoạn chữ khớp lá nguồn, mọi bản nhạc còn có alphaTex, mọi ô nhịp có thể xảy ra (≥ 1). Sai một chỗ ⇒ false. */
export function regionFits(sections: unknown, parts: RegionPart[]): boolean {
  if (!Array.isArray(sections)) return false
  return parts.every(p => sections[p.sec] !== undefined
    && p.leaves.every(l => { const t = leafTextAt(sections, { section: p.sec, path: l.p }); return t !== null && splitByRanges(t, l.r) !== null })
    && p.scores.every(sc => scoreTexAt(sections, { section: p.sec, path: sc.p as ScoreKey['path'] }) !== null))
}

/** Hết hạn cache (ms): đủ để cuộn Feed không tải lại, đủ ngắn để Thầy sửa nhạc thì thẻ sớm báo cập nhật. */
export const PREVIEW_TTL_MS = 2 * 60 * 1000

type Entry<T> = { at: number; v: T }
const notes = new Map<string, Entry<PreviewLoad>>()
const contents = new Map<string, Entry<unknown>>()   // sessionId → sections (đã parse)
let tail: Promise<unknown> = Promise.resolve()
let clock: () => number = () => Date.now()

const fresh = <T,>(m: Map<string, Entry<T>>, k: string): Entry<T> | null => {
  const e = m.get(k)
  if (!e) return null
  if (clock() - e.at > PREVIEW_TTL_MS) { m.delete(k); return null }
  return e
}

async function viewerId(): Promise<string> {
  try {
    const { supabase } = await import('../supabase')
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? 'anon'
  } catch { return 'anon' }
}

async function sessionIdOf(classId: string, sessionNo: number): Promise<string | null> {
  const { supabase } = await import('../supabase')
  const r = await supabase.from('class_sessions').select('id').eq('class_id', classId).eq('session_number', sessionNo).eq('event_type', 'lesson').maybeSingle()
  if (r.error) throw new Error(r.error.message)
  return (r.data as { id: string } | null)?.id ?? null
}

async function run(noteId: string, uid: string): Promise<PreviewLoad> {
  const key = `${uid}:${noteId}`
  const hit = fresh(notes, key)
  if (hit) return hit.v
  try {
    const open = await openShareNote(noteId)
    let out: PreviewLoad
    if (open.status === 'unavailable') out = { status: 'unavailable' }
    else if (open.status === 'stale' || open.status === 'no_access') out = { status: open.status, note: open.note, kind: open.kind }   // stale / no_access: KHÔNG đọc giáo trình
    else if (!(await isShareNoteSessionOpen(noteId))) out = { status: 'locked', note: open.note, kind: open.kind }   // buổi khoá: KHÔNG tải giáo trình
    else {
      const sid = await sessionIdOf(open.classId, open.sessionNo)
      let sections = sid ? fresh(contents, `${uid}:${sid}`)?.v : null
      if (sid && !sections) {
        const { supabase } = await import('../supabase')
        const { fetchSessionContent } = await import('../classLearning/api')
        const c = await fetchSessionContent(supabase, sid)
        sections = c?.sections ?? null
        if (sections) contents.set(`${uid}:${sid}`, { at: clock(), v: sections })
      }
      if (isRegionOpen(open)) {
        // Vùng khoanh: server đã quyết ok/moved; client KIỂM LẠI từng đoạn chữ / bản nhạc trên đúng giáo trình người xem đọc được (RLS). Không khớp ⇒ KHÔNG hiện (stale).
        if (!Array.isArray(sections)) out = { status: 'no_access', note: open.note, kind: 'region' }
        else if (!regionFits(sections, open.parts)) out = { status: 'stale', note: open.note, kind: 'region' }
        else out = { status: 'ok', kind: 'region', note: open.note, parts: open.parts, moved: open.status === 'moved', sections }
      } else if (isTextOpen(open)) {
        // Vùng văn bản: server đã quyết ok/moved; client KIỂM LẠI toạ độ + băm trên đúng giáo trình người xem đọc được (RLS). Không khớp ⇒ KHÔNG tô/hiện (stale).
        if (!sections) out = { status: 'no_access', note: open.note, kind: 'text' }
        else if (!(await verifyAnchor(sections, open.text, open.sha))) out = { status: 'stale', note: open.note, kind: 'text' }
        else out = { status: 'ok', kind: 'text', note: open.note, text: open.text, moved: open.status === 'moved', section: (sections as unknown[])[open.text.section] }
      } else if (!isBarsOpen(open)) {
        out = { status: 'unavailable' }
      } else {
        const tex = sections ? scoreTexAt(sections, open.score) : null
        // Không đọc được giáo trình / không thấy khối nhạc → coi như không có quyền xem nhạc (không đoán, không vẽ)
        out = tex ? { status: 'ok', kind: 'bars', note: open.note, tex, bars: open.bars, score: open.score, section: Array.isArray(sections) ? sections[open.score.section] : undefined } : { status: 'no_access', note: open.note, kind: 'bars' }
      }
    }
    if (out.status !== 'locked') notes.set(key, { at: clock(), v: out })   // khoá buổi KHÔNG cache: mở khoá xong thẻ cập nhật ở lần nạp kế
    return out
  } catch {
    return { status: 'error' }
  }
}

/** Nạp xem trước cho một note. Không bao giờ ném lỗi (thẻ lỗi không làm hỏng Feed). */
export function loadSharePreview(noteId: string): Promise<PreviewLoad> {
  const go = async () => run(noteId, await viewerId())
  const next = tail.then(go, go)
  tail = next.catch(() => undefined)
  return next
}

/** Đăng xuất / đổi tài khoản / dữ liệu đổi: bỏ toàn bộ cache. */
export function resetSharePreviewStore() { notes.clear(); contents.clear(); tail = Promise.resolve() }
export function setPreviewClockForTest(fn: (() => number) | null) { clock = fn ?? (() => Date.now()) }

// ── Khe dựng alphaTab: tối đa N bản nhạc đang sống cùng lúc trên Feed (thẻ khác chờ, hiện khung chờ) ──
export const MAX_LIVE_RENDERERS = 2
let live = 0
const waiters: Array<() => void> = []
export const liveRenderers = () => live

/** Xin một khe; trả hàm trả khe (idempotent). onGrant gọi khi được khe (có thể ngay lập tức). */
export function requestRenderSlot(onGrant: () => void): { release: () => void } {
  let granted = false, released = false
  const grant = () => { granted = true; live++; onGrant() }
  if (live < MAX_LIVE_RENDERERS) grant(); else waiters.push(grant)
  return {
    release() {
      if (released) return
      released = true
      if (granted) { live--; const n = waiters.shift(); if (n) n() }
      else { const i = waiters.indexOf(grant); if (i >= 0) waiters.splice(i, 1) }
    },
  }
}
export function resetRenderSlotsForTest() { live = 0; waiters.length = 0 }
