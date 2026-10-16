// Ghi canvas → MP4 bằng MediaRecorder (phương án spike đã kiểm chứng). Chỉ nhận MP4 thật: không có MP4 thì BÁO LỖI,
// không bao giờ đổi tên WebM thành MP4. Ghi theo THỜI GIAN THỰC; tab bị ẩn → tự huỷ.
import type { VideoRenderer } from './videoRenderer.ts'
import { beatsAtSeconds } from '../chordTimeline.ts'
import { playClick } from '../beatClick.ts'

export type VideoErrorCode = 'unsupported' | 'unsupported_mp4' | 'unsupported_audio' | 'nothing' | 'interrupted' | 'cancelled' | 'failed'
export class VideoExportError extends Error {
  readonly code: VideoErrorCode
  constructor(code: VideoErrorCode, message: string) { super(message); this.name = 'VideoExportError'; this.code = code }
}
export const VIDEO_ERROR_TEXT: Record<VideoErrorCode, string> = {
  unsupported: 'Thiết bị này chưa hỗ trợ tạo video trong trình duyệt.',
  unsupported_mp4: 'Thiết bị này chưa xuất được MP4 nên chưa thể tạo video. Hãy thử bằng Safari hoặc Chrome bản mới.',
  unsupported_audio: 'Thiết bị này chưa ghi được MP4 có tiếng đập nhịp nên chưa thể tạo video. Hãy cập nhật iOS/Safari hoặc thử bằng Chrome.',
  nothing: 'Không còn đoạn nào để tạo video từ vị trí này.',
  interrupted: 'Đã dừng vì bạn rời khỏi màn hình khi đang tạo video. Hãy giữ màn hình này cho tới khi xong.',
  cancelled: 'Đã huỷ.',
  failed: 'Không tạo được video. Hãy thử lại.',
}

const MP4_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
export const pickMp4Type = (recorder: { isTypeSupported?: (t: string) => boolean } | undefined): string | null =>
  MP4_TYPES.find(t => recorder?.isTypeSupported?.(t)) ?? null

// MP4 có AAC: tiếng đập nhịp luôn đi cùng video; thiết bị không ghi được audio → BÁO LỖI, không xuất video câm.
const MP4_AUDIO_TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a', 'video/mp4;codecs=avc1,mp4a']
export const pickMp4AudioType = (recorder: { isTypeSupported?: (t: string) => boolean } | undefined): string | null =>
  MP4_AUDIO_TYPES.find(t => recorder?.isTypeSupported?.(t)) ?? null

/** Lịch click theo ĐÚNG timeline của video: mỗi phách nguyên trong [startBeat, endBeat), nhấn ở phách đầu ô. `t` = giây kể từ lúc bắt đầu ghi. */
export function clickPlan(timeline: VideoRenderer['timeline'], bpm: number, startBeat: number, endBeat: number): { t: number; accent: boolean }[] {
  const downbeats = new Set(timeline.measures.map(m => m.startBeat))
  const plan: { t: number; accent: boolean }[] = []
  for (let beat = Math.ceil(startBeat - 1e-9); beat < endBeat - 1e-9; beat += 1) {
    plan.push({ t: ((beat - startBeat) * 60) / bpm + 0, accent: downbeats.has(beat) })
  }
  return plan
}

/** Tệp fMP4 có track AAC thật không (hộp 'mp4a' nằm trong phần khởi tạo ở đầu tệp). */
export async function mp4HasAudio(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 262144).arrayBuffer())
  const needle = [0x6d, 0x70, 0x34, 0x61]   // 'mp4a'
  for (let i = 0; i + 4 <= head.length; i += 1) if (head[i] === needle[0] && head[i + 1] === needle[1] && head[i + 2] === needle[2] && head[i + 3] === needle[3]) return true
  return false
}

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
  if (!pickMp4Type(MR)) throw new VideoExportError('unsupported_mp4', VIDEO_ERROR_TEXT.unsupported_mp4)
  const mime = pickMp4AudioType(MR)
  if (!mime) throw new VideoExportError('unsupported_audio', VIDEO_ERROR_TEXT.unsupported_audio)
  // AudioContext phải được tạo/resume NGAY trong lượt bấm của người dùng (iOS Safari) — trước mọi await.
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new VideoExportError('unsupported_audio', VIDEO_ERROR_TEXT.unsupported_audio)
  let audio: AudioContext
  let sink: MediaStreamAudioDestinationNode
  try {
    audio = new Ctor()
    void audio.resume().catch(() => {})
    sink = audio.createMediaStreamDestination()
  } catch { throw new VideoExportError('unsupported_audio', VIDEO_ERROR_TEXT.unsupported_audio) }
  const closeAudio = () => { try { sink.stream.getTracks().forEach(t => t.stop()) } catch { /* bỏ qua */ } try { void audio.close().catch(() => {}) } catch { /* bỏ qua */ } }
  const seconds = clipSeconds(renderer, options.startBeat, options.maxSeconds)
  if (seconds < 0.5) { closeAudio(); throw new VideoExportError('nothing', VIDEO_ERROR_TEXT.nothing) }
  const endBeat = options.startBeat + beatsAtSeconds(seconds, renderer.bpm)

  let interrupted = false
  const onHide = () => { if (document.hidden) interrupted = true }
  document.addEventListener('visibilitychange', onHide)
  let lock: { release(): Promise<void> } | null = null
  try { lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { /* không bắt buộc */ }

  let videoStream: MediaStream
  let recorder: MediaRecorder
  try {
    videoStream = canvas.captureStream(options.fps ?? 30)
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...sink.stream.getAudioTracks()])
    recorder = new MR(stream, { mimeType: mime, videoBitsPerSecond: options.videoBitsPerSecond ?? 4_000_000 })
  } catch (cause) {
    document.removeEventListener('visibilitychange', onHide)
    try { await lock?.release() } catch { /* bỏ qua */ }
    closeAudio()
    throw new VideoExportError('failed', cause instanceof Error ? cause.message : VIDEO_ERROR_TEXT.failed)
  }
  const chunks: Blob[] = []
  let keepAlive: OscillatorNode | null = null
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
  const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve() })
  try {
    renderer.draw(options.startBeat, 0)
    try { await audio.resume() } catch { /* kiểm tra trạng thái bên dưới */ }
    if (audio.state !== 'running') throw new Error('audio_not_running')
    // Tín hiệu liên tục không nghe thấy: Safari cắt track audio khi luồng im lặng giữa các click → MP4 bị ngắn hơn ~1 giây (đã đo).
    keepAlive = audio.createOscillator()
    const keepGain = audio.createGain()
    keepGain.gain.value = 0.00002
    keepAlive.connect(keepGain); keepGain.connect(sink)
    keepAlive.start()
    const plan = clickPlan(renderer.timeline, renderer.bpm, options.startBeat, endBeat)
    let next = 0
    // Hai đồng hồ (hình: performance.now, tiếng: audio.currentTime) cùng bắt đầu sau một độ trễ khởi động CHUNG 50 ms,
    // để tiếng click đầu (phách mạnh) không rơi vào quá khứ và bị mất. Không phải hằng bù lệch hình–tiếng.
    const LEAD = 0.05
    const t0 = performance.now() + LEAD * 1000
    const audioT0 = audio.currentTime + LEAD
    recorder.start(500)
    const scheduleAhead = (elapsed: number) => {
      while (next < plan.length && plan[next].t < elapsed + 1) { playClick(audio, sink, audioT0 + plan[next].t, plan[next].accent); next += 1 }
    }
    scheduleAhead(0)
    await new Promise<void>(resolve => {
      const tick = () => {
        const elapsed = Math.max(0, (performance.now() - t0) / 1000)
        renderer.draw(Math.min(options.startBeat + beatsAtSeconds(elapsed, renderer.bpm), endBeat), elapsed)
        scheduleAhead(elapsed)
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
    if ((cause as Error)?.message === 'audio_not_running') throw new VideoExportError('unsupported_audio', VIDEO_ERROR_TEXT.unsupported_audio)
    throw new VideoExportError('failed', cause instanceof Error ? cause.message : VIDEO_ERROR_TEXT.failed)
  } finally {
    document.removeEventListener('visibilitychange', onHide)
    try { videoStream.getTracks().forEach(t => t.stop()) } catch { /* bỏ qua */ }
    try { keepAlive?.stop() } catch { /* bỏ qua */ }
    closeAudio()
    try { await lock?.release() } catch { /* bỏ qua */ }
  }
  if (options.signal?.aborted) throw new VideoExportError('cancelled', VIDEO_ERROR_TEXT.cancelled)
  if (interrupted) throw new VideoExportError('interrupted', VIDEO_ERROR_TEXT.interrupted)
  const blob = new Blob(chunks, { type: mime })
  if (!blob.size) throw new VideoExportError('failed', VIDEO_ERROR_TEXT.failed)
  if (!(await mp4HasAudio(blob))) throw new VideoExportError('unsupported_audio', VIDEO_ERROR_TEXT.unsupported_audio)
  return { blob, mime, seconds }
}
