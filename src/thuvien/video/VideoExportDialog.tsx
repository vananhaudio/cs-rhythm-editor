// "Tạo video 14 giây" (Admin: thêm "Toàn bộ bài"): ghi theo thời gian thực từ timeline Play Scroll thật → MP4 → xem trước → lưu / chia sẻ.
// Không tự đăng TikTok, không gọi TikTok API. Không đổi engine Play Scroll: dialog dùng bộ vẽ riêng với đồng hồ riêng cho việc GHI.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createVideoRenderer } from './videoRenderer.ts'
import type { VideoRenderer, VideoSong } from './videoRenderer.ts'
import { VIDEO_ERROR_TEXT, VideoExportError, clipSeconds, recordVideo } from './recordVideo.ts'

export type VideoMode = 'clip' | 'full'
export const CLIP_SECONDS = 14
/** Trần độ dài khi xuất toàn bài (giây) — bảo vệ CPU/RAM/thời gian chờ. */
export const FULL_MAX_SECONDS = 6 * 60

const FONT = `'Be Vietnam Pro',system-ui,sans-serif`
const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(8,10,16,.66)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT } as const,
  card: { width: 'min(100%, 440px)', maxHeight: '92dvh', overflowY: 'auto', background: '#fff', color: '#16161a', borderRadius: '18px 18px 0 0', padding: '16px 16px max(16px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,.3)' } as const,
  btn: { minHeight: 48, border: 0, borderRadius: 14, background: '#EA580C', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, padding: '0 18px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const,
  ghost: { minHeight: 44, border: '1px solid #d8d8de', borderRadius: 12, background: '#fff', color: '#16161a', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: '0 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const,
}

type Phase = 'idle' | 'recording' | 'ready' | 'error'
const fileName = (title: string) => `${title.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'play-scroll'}.mp4`

export default function VideoExportDialog({ song, startBeat, canFull, onClose, onBall }: { song: VideoSong; startBeat: number; canFull: boolean; onClose: () => void; onBall?: Parameters<typeof createVideoRenderer>[2] extends infer O ? O extends { onBall?: infer F } ? F : never : never }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [mode, setMode] = useState<VideoMode>('clip')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<{ url: string; blob: Blob; mime: string; seconds: number } | null>(null)
  const [renderer, setRenderer] = useState<VideoRenderer | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const r = createVideoRenderer(song, canvas, { onBall })
      r.draw(startBeat, 0)
      setRenderer(r)
    } catch (cause) { setProblem(cause instanceof Error ? cause.message : VIDEO_ERROR_TEXT.failed) }
  }, [song, startBeat])
  useEffect(() => () => { controller.current?.abort(); if (result) URL.revokeObjectURL(result.url) }, [result])

  const maxSeconds = mode === 'full' ? FULL_MAX_SECONDS : CLIP_SECONDS
  const from = mode === 'full' ? 0 : startBeat
  const seconds = useMemo(() => (renderer ? Math.round(clipSeconds(renderer, from, maxSeconds)) : 0), [renderer, from, maxSeconds])

  const start = async () => {
    if (!renderer || !canvasRef.current || phase === 'recording') return
    const abort = new AbortController()
    controller.current = abort
    setPhase('recording'); setProgress(0); setMessage(null)
    try {
      const out = await recordVideo(renderer, canvasRef.current, { startBeat: from, maxSeconds, signal: abort.signal, onProgress: setProgress })
      setResult({ url: URL.createObjectURL(out.blob), blob: out.blob, mime: out.mime, seconds: out.seconds })
      setPhase('ready')
    } catch (cause) {
      const code = cause instanceof VideoExportError ? cause.code : 'failed'
      setMessage(VIDEO_ERROR_TEXT[code])
      setPhase(code === 'cancelled' ? 'idle' : 'error')
    } finally { controller.current = null }
  }
  const cancel = () => controller.current?.abort()

  const name = fileName(song.title)
  const share = async () => {
    if (!result) return
    const file = new File([result.blob], name, { type: result.mime.split(';')[0] })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: song.title })
      else setMessage('Thiết bị này chưa chia sẻ tệp trực tiếp được — hãy dùng "Lưu MP4".')
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setMessage('Không chia sẻ được. Hãy dùng "Lưu MP4".')
    }
  }

  return (
    <div style={S.overlay} onMouseDown={e => { if (e.target === e.currentTarget && phase !== 'recording') onClose() }}>
      <div style={S.card} role="dialog" aria-modal="true" aria-label="Tạo video">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Tạo video</div>
          <button type="button" style={{ ...S.ghost, minHeight: 36 }} onClick={() => { cancel(); onClose() }}>Đóng</button>
        </div>
        <div style={{ fontSize: 13.5, color: '#5b5b66', marginBottom: 10, overflowWrap: 'anywhere' }}>{song.title}</div>

        <div style={{ display: phase === 'ready' ? 'none' : 'block' }}>
          <canvas ref={canvasRef} aria-label="Xem trước khung hình đầu" style={{ width: 150, height: 267, borderRadius: 10, display: 'block', border: '1px solid #e0e0e6' }} />
        </div>
        {problem && <p role="alert" style={{ color: '#b42318', fontSize: 14 }}>{problem}</p>}

        {phase === 'ready' && result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <video src={result.url} controls playsInline muted data-testid="video-preview" style={{ width: 170, borderRadius: 10, background: '#000' }} />
            <p role="status" style={{ margin: 0, fontSize: 13.5, color: '#5b5b66' }}>Video MP4 · {Math.round(result.seconds)} giây · {(result.blob.size / 1e6).toFixed(1)} MB</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={result.url} download={name} style={S.btn}>Lưu MP4</a>
              <button type="button" style={S.ghost} onClick={() => void share()}>Chia sẻ…</button>
              <button type="button" style={S.ghost} onClick={() => { setResult(null); setPhase('idle') }}>Tạo lại</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {canFull && phase !== 'recording' && (
              <div role="group" aria-label="Độ dài" style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={{ ...S.ghost, borderColor: mode === 'clip' ? '#EA580C' : '#d8d8de', color: mode === 'clip' ? '#EA580C' : '#16161a' }} onClick={() => setMode('clip')} aria-pressed={mode === 'clip'}>14 giây</button>
                <button type="button" style={{ ...S.ghost, borderColor: mode === 'full' ? '#EA580C' : '#d8d8de', color: mode === 'full' ? '#EA580C' : '#16161a' }} onClick={() => setMode('full')} aria-pressed={mode === 'full'}>Toàn bộ bài</button>
              </div>
            )}
            {phase === 'recording' ? (
              <>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} style={{ height: 10, background: '#e6e6ec', borderRadius: 5 }}>
                  <div style={{ height: 10, width: `${Math.round(progress * 100)}%`, background: '#EA580C', borderRadius: 5 }} />
                </div>
                <p role="status" style={{ margin: 0, fontSize: 13.5, color: '#5b5b66' }}>Đang tạo video… giữ màn hình này cho tới khi xong (đừng chuyển ứng dụng hoặc khoá máy).</p>
                <button type="button" style={S.ghost} onClick={cancel}>Huỷ</button>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13.5, color: '#5b5b66' }}>
                  {renderer ? `Video dọc 9:16, khoảng ${seconds} giây, tính từ vị trí đang xem. Việc tạo mất đúng bằng thời lượng video.` : 'Đang chuẩn bị…'}
                </p>
                <button type="button" style={{ ...S.btn, opacity: renderer ? 1 : 0.5 }} disabled={!renderer} onClick={() => void start()}>Tạo video {mode === 'full' ? 'toàn bài' : `${CLIP_SECONDS} giây`}</button>
              </>
            )}
          </div>
        )}
        {message && <p role="alert" style={{ margin: '10px 0 0', fontSize: 14, color: phase === 'error' ? '#b42318' : '#5b5b66' }}>{message}</p>}
      </div>
    </div>
  )
}
