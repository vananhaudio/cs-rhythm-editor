// Studio TeamLab ngay trong Class Mobile (iOS) — iframe CÙNG ORIGIN tới bản TeamLab đóng gói chung (ios-embed/README.md).
// Cùng phiên (localStorage), không Safari, không Header/tab thứ hai của TeamLab (TeamLab ẩn khi có ?classapp=1).
// Quay lại: một nút của khung → nhờ Studio lùi một cấp (Band → bài → phòng), hết cấp thì Studio báo `exit` và khung quay về Ban Nhạc.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { BackBar } from './chrome'
import {
  INITIAL_STUDIO, STUDIO_READY_TIMEOUT_MS, TO_STUDIO, backAction, parseStudioMessage, reduceStudio, showShellBack, studioSrc,
} from './studioBridge'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export default function StudioPage({ projectId, onExit }: { projectId?: string | null; onExit: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [st, dispatch] = useReducer(reduceStudio, INITIAL_STUDIO)
  const [attempt, setAttempt] = useState(0)   // đổi → nạp lại iframe

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const m = parseStudioMessage(ev, frame.current?.contentWindow, window.location.origin)
      if (!m) return
      if (m.type === 'exit') onExit()
      else dispatch(m)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onExit])

  // Không thấy `ready` đúng hạn (mạng/Supabase lỗi) → báo lỗi; mất mạng → báo ngay
  useEffect(() => {
    if (!online()) { dispatch({ type: 'offline' }); return }
    const t = window.setTimeout(() => dispatch({ type: 'timeout' }), STUDIO_READY_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [attempt])

  const back = useCallback(() => {
    if (backAction(st) === 'ask-studio') frame.current?.contentWindow?.postMessage({ source: TO_STUDIO, type: 'back' }, window.location.origin)
    else onExit()
  }, [st, onExit])
  const retry = () => { dispatch({ type: 'retry' }); setAttempt(a => a + 1) }

  const failed = st.status === 'error' || st.status === 'offline' || st.status === 'auth'
  return (
    <div className="cm-studio-wrap">
      {showShellBack(st) && <BackBar onBack={back} />}
      {failed && (
        <div className="cm-error" role="alert" style={{ margin: '12px 16px' }}>
          <span>
            {st.status === 'offline' && 'Không có mạng. Kiểm tra kết nối rồi thử lại.'}
            {st.status === 'error' && 'Chưa mở được Studio. Kiểm tra mạng rồi thử lại.'}
            {st.status === 'auth' && 'Studio chưa nhận được phiên đăng nhập của bạn (hết hạn hoặc không đủ quyền). Quay lại rồi đăng nhập lại nếu cần.'}
          </span>
          <button type="button" onClick={retry}>Thử lại</button>
        </div>
      )}
      {st.status === 'loading' && <div className="cm-skeleton" role="status" aria-label="Đang mở Studio" style={{ margin: '12px 16px' }} />}
      {st.status !== 'offline' && st.status !== 'auth' && (
        <iframe
          key={attempt}
          ref={frame}
          className={'cm-studio' + (st.status === 'ready' ? ' is-ready' : '')}
          title="Studio TeamLab"
          src={studioSrc(projectId)}
          allow="microphone; autoplay; fullscreen"
        />
      )}
    </div>
  )
}
