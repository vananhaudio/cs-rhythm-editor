// Tiếng "ting" cho thông báo Class 2.0 (Sound V1 + V1.1). Không mạng, không server: chỉ lắng nghe tóm tắt đã được polling sẵn
// (useChatUnread). Web Audio tự tổng hợp — không tài sản âm thanh, không thư viện.
//   • gate: lần đầu thấy tóm tắt = mốc im lặng; lastSeq TĂNG so với mốc và còn chưa đọc → "đang chờ kêu" (tối đa MỘT tiếng/đợt)
//   • chờ ≠ mất: tab ẩn / âm thanh chưa sẵn sàng thì GIỮ chờ; kêu khi tab hiện + âm thanh chạy; quá hạn hoặc đã đọc/tắt tiếng → bỏ
//   • autoplay (iOS Safari): AudioContext chỉ tạo/resume trong thao tác thật của người dùng; iOS ngắt context khi khoá màn hình/
//     đổi app → lắng nghe thao tác LIÊN TỤC và resume lại (không gỡ listener sau lần đầu)
//   • mọi lỗi nuốt hết — thông báo bằng hình (badge/hàng Class 2.0) không phụ thuộc âm thanh

export const SOUND_KEY = 'cs.chat.noticeSound'
/** Chờ kêu bù tối đa từ lúc phát hiện (tab ẩn / âm thanh chưa mở khoá) */
export const PENDING_MAX_WAIT_MS = 3 * 60_000
/** Thông báo tạo quá lâu rồi (so với đồng hồ máy) thì không kêu bù — tránh tiếng chuông bất ngờ */
export const NOTICE_MAX_AGE_MS = 10 * 60_000

type SummaryLike = { lastSeq: number; unread: number; lastAt?: string }

/** Cổng chống phát trùng, THUẦN (test được trong Node). */
export function createNoticeSoundGate() {
  let baseline: number | null = null
  let pending: { at: number } | null = null
  const alive = (now: number) => {
    if (pending && now - pending.at > PENDING_MAX_WAIT_MS) pending = null
    return pending !== null
  }
  return {
    /** Ghi nhận tóm tắt mới. Không tự "tiêu thụ": thông báo mới chỉ thành trạng thái chờ kêu. */
    observe(s: SummaryLike | null, now: number = Date.now()): void {
      if (!s) return
      if (baseline === null) { baseline = s.lastSeq; return }       // lần đầu = mốc im lặng (thông báo cũ không kêu)
      if (s.lastSeq > baseline) {
        baseline = s.lastSeq
        const created = s.lastAt ? Date.parse(s.lastAt) : NaN
        const stale = Number.isFinite(created) && now - created > NOTICE_MAX_AGE_MS
        if (s.unread > 0 && !stale) pending = { at: now }
      }
      if (s.unread === 0) pending = null                             // đã đọc (ở đâu cũng vậy) → không kêu bù
    },
    hasPending(now: number = Date.now()): boolean { return alive(now) },
    /** true = có thông báo đang chờ và đã được lấy (gọi đúng lúc ĐÃ phát được) — mỗi đợt chỉ một lần */
    take(now: number = Date.now()): boolean {
      if (!alive(now)) return false
      pending = null
      return true
    },
    clear(): void { pending = null },
  }
}
export type NoticeSoundGate = ReturnType<typeof createNoticeSoundGate>

/** DM (Sound V1.2): theo dõi lastSeq TỪNG hội thoại. Sự kiện = hội thoại có lastSeq tăng, tin cuối của NGƯỜI KHÁC, còn chưa đọc.
 *  Lần quan sát đầu chỉ lập mốc. Kết quả đưa vào một gate riêng (cùng hạn chờ/tuổi/chống chồng với System Chat). THUẦN. */
type DmRow = { id: string; lastSeq: number; lastMine: boolean; unread: number; lastAt?: string }
export function createDmSoundTracker() {
  const seen = new Map<string, number>()
  let first = true
  let tick = 0
  const gate = createNoticeSoundGate()
  return {
    gate,
    observe(rows: DmRow[], now: number = Date.now()): void {
      let fresh = false
      let newest: string | undefined
      let unread = 0
      for (const r of rows) {
        if (r.unread > 0) unread++
        const prev = seen.get(r.id)
        if (!first && r.lastSeq > (prev ?? 0) && !r.lastMine && r.unread > 0) {
          fresh = true
          if (!newest || (r.lastAt && Date.parse(r.lastAt) > Date.parse(newest))) newest = r.lastAt
        }
        if (prev === undefined || r.lastSeq > prev) seen.set(r.id, r.lastSeq)
      }
      first = false
      if (fresh) tick++
      gate.observe({ lastSeq: tick, unread, lastAt: newest }, now)
    },
  }
}
export type DmSoundTracker = ReturnType<typeof createDmSoundTracker>

// ── Tuỳ chọn Bật/Tắt (lưu trên thiết bị; mặc định BẬT) ──────────────────────────────────────────────
type Store = Pick<Storage, 'getItem' | 'setItem'>
const store = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

export function readSoundEnabled(s: Store | null = store()): boolean {
  try { return s?.getItem(SOUND_KEY) !== 'off' } catch { return true }
}
const listeners = new Set<() => void>()
export function writeSoundEnabled(on: boolean, s: Store | null = store()): void {
  try { s?.setItem(SOUND_KEY, on ? 'on' : 'off') } catch { /* không lưu được: vẫn đổi trong phiên */ }
  memo = on
  listeners.forEach(l => l())
}
let memo: boolean | null = null
export const getSoundEnabled = (): boolean => (memo ??= readSoundEnabled())
export function subscribeSound(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l) } }

// ── Web Audio: MỘT AudioContext dùng lại ─────────────────────────────────────────────────────────────
type AC = typeof AudioContext
let ctx: AudioContext | null = null
let lastAt = 0
const MIN_GAP_MS = 1500
const readyListeners = new Set<() => void>()

function ctxClass(): AC | null {
  const w = globalThis as unknown as { AudioContext?: AC; webkitAudioContext?: AC }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}
const running = (): boolean => !!ctx && ctx.state === 'running'
const notifyReady = () => { if (running()) readyListeners.forEach(l => { try { l() } catch { /* nuốt */ } }) }

/** Chỉ cho test: bỏ context/mốc phát đang giữ. */
export function resetNoticeAudioForTests(): void { ctx = null; lastAt = 0; readyListeners.clear() }

/** Gọi khi âm thanh vừa sẵn sàng (context chuyển sang running). Trả về hàm gỡ. */
export function onNoticeAudioReady(l: () => void): () => void { readyListeners.add(l); return () => { readyListeners.delete(l) } }

/** Tạo (một lần) / resume AudioContext. Trong thao tác người dùng thì được phép; ngoài thao tác trình duyệt có thể từ chối — nuốt lỗi. */
export function unlockNoticeAudio(): void {
  try {
    if (ctx && ctx.state === 'closed') ctx = null
    if (!ctx) {
      const C = ctxClass()
      if (!C) return
      ctx = new C()
      ctx.onstatechange = notifyReady          // iOS ngắt/phục hồi context (khoá màn hình, đổi app) → báo lại
    }
    if (ctx.state === 'running') { notifyReady(); return }
    void ctx.resume().then(notifyReady, () => { /* chưa có thao tác hợp lệ: thử lại ở lần chạm sau */ })
  } catch { /* trình duyệt chặn: im lặng */ }
}

/** Thử resume khi quay lại tab (một số bản iOS cho phép, bản khác từ chối — không sao). Không tạo context mới. */
export function tryResumeNoticeAudio(): void {
  try {
    if (!ctx || ctx.state === 'running') return
    if (ctx.state === 'closed') { ctx = null; return }
    void ctx.resume().then(notifyReady, () => {})
  } catch { /* nuốt */ }
}

/** Lắng nghe thao tác người dùng LIÊN TỤC để mở khoá/phục hồi âm thanh (iOS ngắt context sau khoá màn hình). Trả về hàm gỡ. */
export function installAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => {}
  const evs = ['pointerdown', 'touchend', 'keydown'] as const
  const on = () => unlockNoticeAudio()
  evs.forEach(e => window.addEventListener(e, on, true))
  return () => evs.forEach(e => window.removeEventListener(e, on, true))
}

const hidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden'

/** Một tiếng "ting" ngắn (~0.35 s, hai nốt sin, biên độ nhỏ). Trả true nếu đã phát. */
export function playNoticePing(now: number = Date.now()): boolean {
  try {
    if (!getSoundEnabled()) return false
    if (hidden()) return false
    if (now - lastAt < MIN_GAP_MS) return false          // không phát chồng
    if (!ctx || ctx.state !== 'running') return false    // chưa có thao tác hợp lệ / bị chặn / bị iOS ngắt
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, t)
    out.gain.exponentialRampToValueAtTime(0.12, t + 0.015)
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    out.connect(ctx.destination)
    for (const [f, at] of [[1175, 0], [1568, 0.09]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(out)
      o.start(t + at)
      o.stop(t + 0.4)
    }
    lastAt = now
    return true
  } catch { return false }
}

/**
 * Kêu bù thông báo đang chờ NẾU đủ điều kiện (tab hiện, âm thanh chạy, đang Bật). Gọi lại ở mọi thời điểm có thể đổi điều kiện:
 * tóm tắt mới, quay lại tab, focus, âm thanh vừa sẵn sàng. Tắt tiếng → bỏ chờ (không phát bù khi bật lại).
 */
export function playPendingNotice(gate: NoticeSoundGate, now: number = Date.now()): boolean {
  if (!gate.hasPending(now)) return false
  if (!getSoundEnabled()) { gate.clear(); return false }
  if (hidden() || !running()) return false               // GIỮ chờ — chưa tiêu thụ
  if (now - lastAt < MIN_GAP_MS) { gate.clear(); return false }   // vừa kêu xong: coi như cùng một đợt
  if (!playNoticePing(now)) return false
  gate.take(now)
  return true
}
