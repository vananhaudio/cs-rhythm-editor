// PREVIEW ONLY (không vào bản build production): máy chủ giả trả lời các RPC của Trò chuyện bằng dữ liệu mẫu có kích thước tuỳ ý.
// Giao diện + chatApi + inboxApi chạy NGUYÊN BẢN; chỉ lớp mạng (fetch tới /rest/v1/rpc/<hàm>) bị thay. Ngữ nghĩa lọc/tìm/con trỏ/ghim
// phản chiếu db/chat_list_v2_setup.sql (bản thật được kiểm bằng scripts/test-chat-list-v2-db.sh).
import { foldVi } from '../class-social/chat/inboxModel'

export type Scenario = { dms: number; bands: number; support: number; pins: number; legacy: boolean; latency: number; fail: boolean }

type Row = {
  conv_key: string; kind: 'dm' | 'band'; peer_id: string | null; name: string; avatar_url: string | null; cover_path: string | null
  project_id: string | null; project_avatar_path: string | null; peer_role: string | null
  last_seq: number; last_body: string; last_sender_name: string | null; last_mine: boolean; last_at: string; sort_at: string
  unread: number; member_count: number; can_send: boolean; archived: boolean; support: boolean
}

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý']
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hương', 'Khánh', 'Lan', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo', 'Uyên', 'Việt', 'Yến', 'Như', 'Đạt']
const PREVIEWS = ['Mai mình tập lúc 7h nhé', 'Cảm ơn Thầy ạ', 'Em gửi bài Buổi 05 rồi ạ', 'Ok bạn', 'Chiều nay có rảnh không?', 'Đã nhận file, mình xem rồi báo lại', 'Hẹn thứ Bảy nhé!', 'Bạn tập nhịp 6/8 chưa?', 'Cho mình xin tab bài này với']
const BANDS = ['Gió Mùa', 'Đêm Trắng', 'Nắng Hạ', 'Sao Băng', 'Mây Trời', 'Hồ Gươm', 'Phố Cổ', 'Biển Xanh', 'Lá Thu', 'Đồng Vọng', 'Trăng Non', 'Sông Hương']

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
const pad = (n: number, w = 12) => String(n).padStart(w, '0')

export function buildRows(sc: Scenario): Row[] {
  const rand = rng(20261102)
  const now = Date.now()
  const rows: Row[] = []
  for (let i = 1; i <= sc.dms; i++) {
    const name = `${HO[Math.floor(rand() * HO.length)]} ${TEN[Math.floor(rand() * TEN.length)]}${i > 60 ? ' ' + i : ''}`
    const at = new Date(now - i * (i < 8 ? 47 : 190) * 60_000 - Math.floor(rand() * 600_000)).toISOString()
    rows.push({
      conv_key: `88888888-0000-4000-8000-${pad(i)}`, kind: 'dm', peer_id: `99999999-0000-4000-8000-${pad(i)}`, name, avatar_url: null, cover_path: null,
      project_id: null, project_avatar_path: null, peer_role: i % 17 === 0 ? 'teacher' : 'student', last_seq: 4,
      last_body: PREVIEWS[Math.floor(rand() * PREVIEWS.length)], last_sender_name: null, last_mine: rand() < 0.35, last_at: at, sort_at: at,
      unread: rand() < 0.22 ? 1 + Math.floor(rand() * 5) : 0, member_count: 2, can_send: true, archived: false, support: false,
    })
  }
  for (let i = 1; i <= sc.bands; i++) {
    const name = `Band ${BANDS[(i - 1) % BANDS.length]}${i > BANDS.length ? ' ' + Math.ceil(i / BANDS.length) : ''}`
    const has = rand() < 0.85
    const at = has ? new Date(now - i * 5.5 * 3600_000 - Math.floor(rand() * 900_000)).toISOString() : null
    rows.push({
      conv_key: `band:77777777-0000-4000-8000-${pad(i)}`, kind: 'band', peer_id: null, name, avatar_url: null, cover_path: null,
      project_id: `11111111-0000-4000-8000-${pad(i)}`, project_avatar_path: null, peer_role: null, last_seq: has ? 9 : 0,
      last_body: has ? 'Tối nay tập tổng duyệt, mang đàn nhé cả nhà' : '', last_sender_name: has ? TEN[Math.floor(rand() * TEN.length)] : null, last_mine: false,
      last_at: at ?? '', sort_at: at ?? '1970-01-01T00:00:00Z', unread: has && rand() < 0.3 ? 1 + Math.floor(rand() * 8) : 0, member_count: 4 + Math.floor(rand() * 7),
      can_send: true, archived: false, support: false,
    })
  }
  for (let i = 1; i <= sc.support; i++) {
    const name = `Band ${BANDS[(i + 3) % BANDS.length]} · Lớp ${100 + i}`
    const has = i % 3 !== 0
    const at = has ? new Date(now - i * 9 * 3600_000).toISOString() : null
    rows.push({
      conv_key: `band:66666666-0000-4000-8000-${pad(i)}`, kind: 'band', peer_id: null, name, avatar_url: null, cover_path: null,
      project_id: `11111111-0000-4000-8000-${pad(1000 + i)}`, project_avatar_path: null, peer_role: null, last_seq: has ? 3 : 0,
      last_body: has ? 'Em xin phép nghỉ buổi sau ạ' : '', last_sender_name: has ? 'Thành viên' : null, last_mine: false, last_at: at ?? '',
      sort_at: at ?? '1970-01-01T00:00:00Z', unread: 0, member_count: 5, can_send: false, archived: false, support: true,
    })
  }
  return rows
}

export class MockChatServer {
  rows: Row[]
  pins: { key: string; at: number }[] = []
  sent: Record<string, { seq: number; mine: boolean; body: string; at: string }[]> = {}
  sc: Scenario
  constructor(sc: Scenario) {
    this.sc = sc
    this.rows = buildRows(sc)
    const mine = this.rows.filter(r => !r.support)
    for (let i = 0; i < sc.pins && i < mine.length; i++) this.pins.push({ key: mine[i * 2 % mine.length].conv_key, at: Date.now() - i * 1000 })
  }
  private base(scope: string) { return this.rows.filter(r => (scope === 'support' ? r.support : !r.support)) }
  private withPin(r: Row) { return { ...r, pinned: this.pins.some(p => p.key === r.conv_key) } }

  chat_inbox(a: Record<string, unknown>) {
    const kind = String(a.p_kind ?? 'all'), pinnedMode = String(a.p_pinned ?? 'exclude')
    const q = foldVi(String(a.p_query ?? '')).trim()
    const lim = Math.min(Math.max(Number(a.p_limit ?? 30), 1), 50)
    const curAt = a.p_cursor_at ? Date.parse(String(a.p_cursor_at)) : null, curKey = a.p_cursor_key ? String(a.p_cursor_key) : null
    let list = this.base(String(a.p_scope ?? 'mine')).map(r => this.withPin(r)).filter(r =>
      (kind === 'all' || r.kind === kind) && (!a.p_unread || r.unread > 0) && (!q || foldVi(r.name).includes(q)) &&
      (pinnedMode === 'only' ? r.pinned : pinnedMode === 'exclude' ? !r.pinned : true))
    if (pinnedMode === 'only') list.sort((x, y) => (this.pins.find(p => p.key === y.conv_key)!.at - this.pins.find(p => p.key === x.conv_key)!.at))
    else {
      list.sort((x, y) => Date.parse(y.sort_at) - Date.parse(x.sort_at) || (x.conv_key < y.conv_key ? -1 : 1))
      if (curAt !== null && curKey !== null) list = list.filter(r => { const t = Date.parse(r.sort_at); return t < curAt || (t === curAt && r.conv_key > curKey) })
    }
    return list.slice(0, lim)
  }
  chat_inbox_summary() {
    const m = this.base('mine')
    return [{
      dm_total: m.filter(r => r.kind === 'dm').length, band_total: m.filter(r => r.kind === 'band').length, class_total: 0,
      unread_dm: m.filter(r => r.kind === 'dm' && r.unread > 0).length, unread_band: m.filter(r => r.kind === 'band' && r.unread > 0).length, unread_class: 0,
      pinned_total: this.pins.length, support_total: this.base('support').length,
    }]
  }
  chat_conversation_info(a: Record<string, unknown>) {
    const r = this.rows.find(x => x.conv_key === a.p_key)
    return r ? [this.withPin(r)] : []
  }
  chat_pin_set(a: Record<string, unknown>) {
    const key = String(a.p_key)
    if (a.p_pinned) {
      if (!this.rows.some(r => r.conv_key === key && !r.support)) throw { code: 'P0002', message: 'Không tìm thấy cuộc trò chuyện' }
      if (!this.pins.some(p => p.key === key)) {
        if (this.pins.length >= 10) throw { code: '54000', message: 'Chỉ ghim tối đa 10 cuộc trò chuyện' }
        this.pins.push({ key, at: Date.now() })
      }
    } else this.pins = this.pins.filter(p => p.key !== key)
    return this.pins.length
  }
  private thread(key: string) {
    const r = this.rows.find(x => x.conv_key === key)
    const base = Array.from({ length: Math.min(r?.last_seq ?? 0, 12) }, (_, i) => ({
      seq: i + 1, mine: i % 3 === 1, body: PREVIEWS[(i * 3) % PREVIEWS.length], at: new Date(Date.now() - (12 - i) * 3600_000).toISOString(),
    }))
    return [...base, ...(this.sent[key] ?? [])]
  }
  dm_messages_safe(a: Record<string, unknown>) {
    return this.thread(String(a.p_conversation)).filter(m => (a.p_after_seq == null || m.seq > Number(a.p_after_seq))).map(m => ({ seq: m.seq, mine: m.mine, body: m.body, created_at: m.at }))
  }
  bandchat_messages_safe(a: Record<string, unknown>) {
    const key = 'band:' + String(a.p_band)
    return this.thread(key).filter(m => (a.p_after_seq == null || m.seq > Number(a.p_after_seq))).map(m => ({
      seq: m.seq, sender_id: m.mine ? 'me' : 'u1', sender_name: m.mine ? 'Bạn' : 'Hoàng Minh', sender_avatar_url: null, mine: m.mine, body: m.body, created_at: m.at }))
  }
  private send(key: string, body: string) {
    const arr = (this.sent[key] ??= [])
    const seq = this.thread(key).length + 1
    arr.push({ seq, mine: true, body, at: new Date().toISOString() })
    return seq
  }
  dm_send(a: Record<string, unknown>) { return this.send(String(a.p_conversation), String(a.p_body)) }
  bandchat_send(a: Record<string, unknown>) { return this.send('band:' + String(a.p_band), String(a.p_body)) }
  bandchat_members() { return [{ user_id: 'u1', name: 'Hoàng Minh', avatar_url: null, role: 'student', group_role: 'owner' }, { user_id: 'me', name: 'Bạn', avatar_url: null, role: 'student', group_role: 'member' }] }
  dm_conversations_safe() { return [] }
  bandchat_rooms() { return [] }
  dm_unread_count() { return 0 }
  bandchat_unread_count() { return 0 }
  class_system_notice_summary() { return [] }
}

/** Thay window.fetch: chỉ chặn /rest/v1/rpc/<hàm>; mọi thứ khác trả rỗng (không bao giờ ra mạng thật) */
export function installMockFetch(server: MockChatServer) {
  const real = window.fetch.bind(window)
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  ;(window as unknown as { __mockCalls: string[] }).__mockCalls = []
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const m = /\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(url)
    if (!m) {
      if (/supabase\.co|\/auth\/v1\//.test(url)) return json(200, {})
      return real(input, init)
    }
    const fn = m[1]
    ;(window as unknown as { __mockCalls: string[] }).__mockCalls.push(fn)
    if (server.sc.latency) await new Promise(r => setTimeout(r, server.sc.latency))
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(String(init?.body ?? '{}')) } catch { /* rỗng */ }
    if (server.sc.fail && fn === 'chat_inbox') return json(500, { code: 'XX000', message: 'boom' })
    if (server.sc.legacy && (fn.startsWith('chat_'))) return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn })
    const impl = (server as unknown as Record<string, (a: Record<string, unknown>) => unknown>)[fn]
    if (!impl) return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn })
    try {
      if (server.sc.legacy && fn === 'dm_conversations_safe') return json(200, server.rows.filter(r => r.kind === 'dm').slice(0, 100).map(r => ({
        conversation_id: r.conv_key, peer_id: r.peer_id, peer_name: r.name, peer_avatar_url: null, peer_role: r.peer_role, last_seq: r.last_seq, last_body: r.last_body,
        last_mine: r.last_mine, last_at: r.last_at, unread: r.unread, can_send: true })))
      if (server.sc.legacy && fn === 'bandchat_rooms') return json(200, server.rows.filter(r => r.kind === 'band').slice(0, 100).map(r => ({
        band_id: r.conv_key.slice(5), band_name: r.name, cover_path: null, project_id: r.project_id, project_avatar_path: null, last_seq: r.last_seq, last_body: r.last_body,
        last_sender_name: r.last_sender_name, last_mine: false, last_at: r.last_at || null, unread: r.unread, member_count: r.member_count, can_send: r.can_send, archived: false, support: r.support })))
      return json(200, impl.call(server, args))
    } catch (e) {
      const err = e as { code?: string; message?: string }
      return json(400, { code: err.code ?? 'XX000', message: err.message ?? 'lỗi' })
    }
  }
}
