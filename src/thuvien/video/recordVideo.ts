// Ghi canvas → MP4 bằng MediaRecorder (phương án spike đã kiểm chứng). Chỉ nhận MP4 thật: không có MP4 thì BÁO LỖI,
// không bao giờ đổi tên WebM thành MP4. Ghi theo THỜI GIAN THỰC; tab bị ẩn → tự huỷ.
import type { VideoRenderer } from './videoRenderer.ts'
import { beatsAtSeconds } from '../chordTimeline.ts'

export type VideoErrorCode = 'unsupported' | 'unsupported_mp4' | 'nothing' | 'interrupted' | 'cancelled' | 'failed'
export class VideoExportError extends Error {
  readonly code: VideoErrorCode
  constructor(code: VideoErrorCode, message: string) { super(message); this.name = 'VideoExportError'; this.code = code }
}
export const VIDEO_ERROR_TEXT: Record<VideoErrorCode, string> = {
  unsupported: 'Thiết bị này chưa hỗ trợ tạo video trong trình duyệt.',
  unsupported_mp4: 'Thiết bị này chưa xuất được MP4 nên chưa thể tạo video. Hãy thử bằng Safari hoặc Chrome bản mới.',
  nothing: 'Không còn đoạn nào để tạo video từ vị trí này.',
  interrupted: 'Đã dừng vì bạn rời khỏi màn hình khi đang tạo video. Hãy giữ màn hình này cho tới khi xong.',
  cancelled: 'Đã huỷ.',
  failed: 'Không tạo được video. Hãy thử lại.',
}

const MP4_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
export const pickMp4Type = (recorder: { isTypeSupported?: (t: string) => boolean } | undefined): string | null =>
  MP4_TYPES.find(t => recorder?.isTypeSupported?.(t)) ?? null

export type RecordOptions = {
  startBeat: number
  /** Tối đa bao nhiêu giây (14 cho video thường; số lớn cho toàn bài). */
  maxSeconds: number
  fps?: number
  videoBitsPerSecond?: number
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
}

/** Số giây video sẽ dài (đã cắt theo cuối bài) — để hiện trước cho người dùng. */
export const clipSeconds = (renderer: Pick<VideoRenderer, 'timeline' | 'bpm'>, startBeat: number, maxSeconds: number): number =>
  Math.max(0, Math.min(maxSeconds, ((renderer.timeline.totalBeats - startBeat) * 60) / renderer.bpm))

export async function recordVideo(renderer: VideoRenderer, canvas: HTMLCanvasElement, options: RecordOptions): Promise<{ blob: Blob; mime: string; seconds: number }> {
  const MR = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
  if (!MR || typeof canvas.captureStream !== 'function') throw new VideoExportError('unsupported', VIDEO_ERROR_TEXT.unsupported)
  const mime = pickMp4Type(MR)
  if (!mime) throw new VideoExportError('unsupported_mp4', VIDEO_ERROR_TEXT.unsupported_mp4)
  const seconds = clipSeconds(renderer, options.startBeat, options.maxSeconds)
  if (seconds < 0.5) throw new VideoExportError('nothing', VIDEO_ERROR_TEXT.nothing)
  const endBeat = options.startBeat + beatsAtSeconds(seconds, renderer.bpm)

  let interrupted = false
  const onHide = () => { if (document.hidden) interrupted = true }
  document.addEventListener('visibilitychange', onHide)
  let lock: { release(): Promise<void> } | null = null
  try { lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { /* không bắt buộc */ }

  const stream = canvas.captureStream(options.fps ?? 30)
  const recorder = new MR(stream, { mimeType: mime, videoBitsPerSecond: options.videoBitsPerSecond ?? 4_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
  const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve() })
  try {
    renderer.draw(options.startBeat, 0)
    const t0 = performance.now()
    recorder.start(500)
    await new Promise<void>(resolve => {
      const tick = () => {
        const elapsed = (performance.now() - t0) / 1000
        renderer.draw(Math.min(options.startBeat + beatsAtSeconds(elapsed, renderer.bpm), endBeat), elapsed)
        options.onProgress?.(Math.min(1, elapsed / seconds))
        if (interrupted || options.signal?.aborted || elapsed >= seconds) { resolve(); return }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await new Promise(resolve => setTimeout(resolve, 150))   // để khung cuối kịp vào bộ mã hoá
    recorder.stop()
    await stopped
  } catch (cause) {
    try { if (recorder.state !== 'inactive') recorder.stop() } catch { /* bỏ qua */ }
    throw new VideoExportError('failed', cause instanceof Error ? cause.message : VIDEO_ERROR_TEXT.failed)
  } finally {
    document.removeEventListener('visibilitychange', onHide)
    try { await lock?.release() } catch { /* bỏ qua */ }
  }
  if (options.signal?.aborted) throw new VideoExportError('cancelled', VIDEO_ERROR_TEXT.cancelled)
  if (interrupted) throw new VideoExportError('interrupted', VIDEO_ERROR_TEXT.interrupted)
  const blob = new Blob(chunks, { type: mime })
  if (!blob.size) throw new VideoExportError('failed', VIDEO_ERROR_TEXT.failed)
  return { blob, mime, seconds }
}
