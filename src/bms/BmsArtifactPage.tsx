// /song-builder?artifact=<id> — mở bài BMS người khác (hoặc chính mình) đã chia sẻ, chế độ CHỈ LUYỆN:
// xem · nghe · luyện đúng bài (lưới nhịp, mốc, hợp âm). Không lưu, không sửa bản gốc, không ghi vào "Bài của tôi".
// Chủ bài: thấy "Bài của bạn" + "Gỡ chia sẻ" (xoá artifact + bài Feed). Bài đã gỡ / không có quyền → thông báo nhẹ.
import { useEffect, useState } from 'react'
import PracticePlayer from '../PracticePlayer'
import { deleteBmsArtifact, loadBmsArtifact, type LoadedArtifact } from './bmsArtifact'

const C = { bg: '#0B0E14', surface: '#131823', border: 'rgba(255,255,255,0.09)', text: '#E6EAF2', muted: '#8A93A6', accent: '#6C63FF', red: '#F43F5E' }
const FONT = `'Be Vietnam Pro',system-ui,sans-serif`

export default function BmsArtifactPage({ artifactId }: { artifactId: string }) {
  const [state, setState] = useState<LoadedArtifact | { status: 'loading' }>({ status: 'loading' })
  const [removing, setRemoving] = useState<'idle' | 'confirm' | 'busy' | 'error'>('idle')
  useEffect(() => { void loadBmsArtifact(artifactId).then(setState) }, [artifactId])

  const close = () => { if (window.history.length > 1) window.history.back(); else window.location.href = '/me' }

  if (state.status !== 'ready') {
    const msg = state.status === 'loading' ? 'Đang mở bài…'
      : state.status === 'signed_out' ? 'Đăng nhập Class để luyện bài này.'
      : state.status === 'missing' ? 'Bài này không còn được chia sẻ hoặc bạn chưa có quyền xem.'
      : 'Chưa mở được bài. Kiểm tra mạng rồi thử lại.'
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, color: C.text, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>BMS · Bài chia sẻ</div>
          <p className="bms-artifact-msg" style={{ fontSize: 17, fontWeight: 700, margin: '0 0 18px' }}>{msg}</p>
          {state.status === 'signed_out' && <a href="/me" style={{ color: '#fff', background: C.accent, padding: '11px 18px', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>Đăng nhập</a>}
          {state.status === 'error' && <button onClick={() => window.location.reload()} style={{ color: '#fff', background: C.accent, padding: '11px 18px', borderRadius: 12, fontWeight: 700, border: 'none', fontFamily: FONT }}>Thử lại</button>}
          {(state.status === 'missing') && <a href="/me" style={{ color: C.muted, fontWeight: 700 }}>Về Trang chủ</a>}
        </div>
      </div>
    )
  }

  const remove = async () => {
    if (removing !== 'confirm') { setRemoving('confirm'); return }
    setRemoving('busy')
    if (await deleteBmsArtifact(artifactId)) setState({ status: 'missing' })
    else setRemoving('error')
  }
  const banner = (
    <div className="bms-artifact-banner" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 16px 10px', padding: '8px 12px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, fontFamily: FONT }}>
      <span style={{ flex: 1, minWidth: 180 }}>
        {state.isMine ? <><b style={{ color: C.text }}>Bài của bạn</b> · đang chia sẻ cho Class</> : <><b style={{ color: C.text }}>Bài chia sẻ</b> · chỉ luyện, không sửa bài gốc</>}
      </span>
      {state.isMine && (
        <button onClick={() => void remove()} disabled={removing === 'busy'} style={{ border: `1px solid ${removing === 'confirm' ? C.red : C.border}`, background: 'transparent', color: removing === 'confirm' ? C.red : C.muted, borderRadius: 10, padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          {removing === 'confirm' ? 'Xác nhận gỡ' : removing === 'busy' ? 'Đang gỡ…' : 'Gỡ chia sẻ'}
        </button>
      )}
      {removing === 'confirm' && <span style={{ width: '100%', fontSize: 12 }}>Bài và thẻ trên Feed sẽ bị xoá. Nháp trong máy bạn vẫn giữ nguyên.</span>}
      {removing === 'error' && <span role="alert" style={{ width: '100%', color: C.red, fontSize: 12 }}>Chưa gỡ được. Hãy thử lại.</span>}
    </div>
  )
  return <PracticePlayer draft={state.draft} onClose={close} banner={banner} />
}
