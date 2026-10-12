// Tiếng "ting" cho thông báo Class 2.0 (Sound V1). Không mạng, không server: chỉ lắng nghe tóm tắt đã được polling sẵn
// (useChatUnread). Web Audio tự tổng hợp — không tài sản âm thanh, không thư viện.
//   • gate: lần đầu thấy tóm tắt = mốc im lặng; chỉ kêu khi lastSeq TĂNG so với mốc và còn chưa đọc → một tiếng/đợt
//   • autoplay: AudioContext chỉ được tạo/resume sau một thao tác thật của người dùng (iOS Safari); chưa mở khoá → im lặng
//   • mọi lỗi nuốt hết — thông báo bằng hình (badge/hàng Class 2.0) không phụ thuộc âm thanh

export const SOUND_KEY = 'cs.chat.noticeSound'

/** Cổng chống phát trùng, THUẦN (test được trong Node). observe() trả true = nên kêu một tiếng. */
export function createNoticeSoundGate() {
  let baseline: number | null = null
  return {
    observe(s: { lastSeq: number; unread: number } | null): boolean {
      if (!s) return false
      if (baseline === null) { baseline = s.lastSeq; return false }
      const fresh = s.lastSeq > baseline && s.unread > 0
      if (s.lastSeq > baseline) baseline = s.lastSeq
      return fresh
    },
  }
}

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

// ── Phát tiếng ───────────────────────────────────────────────────────────────────────────────────────
type AC = typeof AudioContext
let ctx: AudioContext | null = null
let lastAt = 0
const MIN_GAP_MS = 1500

function ctxClass(): AC | null {
  const w = globalThis as unknown as { AudioContext?: AC; webkitAudioContext?: AC }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** Gọi trong sự kiện người dùng (pointerdown/keydown/touchend): tạo/resume AudioContext để lần kêu sau được phép. */
export function unlockNoticeAudio(): void {
  try {
    const C = ctxClass()
    if (!C) return
    ctx ??= new C()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  } catch { /* trình duyệt chặn: im lặng */ }
}

/** Cài lắng nghe thao tác đầu tiên để mở khoá âm thanh (một lần). Trả về hàm gỡ. */
export function installAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => {}
  const evs = ['pointerdown', 'touchend', 'keydown'] as const
  const off = () => evs.forEach(e => window.removeEventListener(e, on, true))
  const on = () => { unlockNoticeAudio(); if (ctx && ctx.state === 'running') off() }
  evs.forEach(e => window.addEventListener(e, on, true))
  return off
}

/** Một tiếng "ting" ngắn (~0.35 s, hai nốt sin, biên độ nhỏ). Trả true nếu đã phát. */
export function playNoticePing(now: number = Date.now()): boolean {
  try {
    if (!getSoundEnabled()) return false
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
    if (now - lastAt < MIN_GAP_MS) return false          // không phát chồng
    if (!ctx || ctx.state !== 'running') return false    // chưa có thao tác hợp lệ / bị chặn
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
