// Ranh giới lỗi CHỈ cho lỗi tải chunk (import động). Lỗi khác được ném tiếp lên ranh giới cha (không nuốt lỗi thật).
// Khi chunk không tải được: gọi onRecover() để GIỮ bản nháp (vùng khoanh, câu hỏi đang soạn…), rồi tải lại trang MỘT lần (có chốt chống vòng lặp);
// nếu không được phép tự tải lại thì hiện thẻ có nút "Cập nhật & tiếp tục". Không bao giờ thay cả trang bằng màn hình lỗi.
import { Component, type ReactNode } from 'react'
import { claimAutoReload, isChunkLoadError } from './chunkRecovery'

type Props = {
  children: ReactNode
  /** Gọi ngay trước khi tải lại: ghi bản nháp bằng stashDraft */
  onRecover?: () => void
  /** Tự tải lại một lần khi lỗi (mặc định bật). Tắt khi người dùng đã gõ dở và muốn tự bấm. */
  auto?: boolean
  /** Bấm "Để sau" (đóng thẻ, quay về trạng thái trước) */
  onDismiss?: () => void
  /** Hiện dạng lớp phủ (cho khung modal) thay vì thẻ trong dòng */
  overlay?: boolean
}
type State = { error: Error | null; reloading: boolean }

export default class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false }
  static getDerivedStateFromError(error: Error): Partial<State> { return { error } }
  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return
    if (this.props.auto !== false && claimAutoReload()) this.reload()
  }
  reload = () => {
    this.setState({ reloading: true })
    try { this.props.onRecover?.() } catch { /* giữ nháp là cố gắng tối đa, không chặn tải lại */ }
    window.location.reload()
  }
  render() {
    const { error, reloading } = this.state
    if (!error) return this.props.children
    if (!isChunkLoadError(error)) throw error          // lỗi thật → ranh giới cha
    const card = (
      <div role="alert" data-testid="chunk-update-card" style={{ background: '#fff', color: '#16161a', borderRadius: 14, padding: '14px 16px', maxWidth: 420, boxShadow: '0 6px 24px rgba(0,0,0,.25)', fontFamily: `'Be Vietnam Pro',system-ui,sans-serif`, fontSize: 14.5, lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16 }}>{reloading ? 'Đang cập nhật…' : 'Lớp học vừa có bản cập nhật'}</p>
        <p style={{ margin: '0 0 12px', color: '#5b5b66' }}>Bấm cập nhật để tiếp tục — vùng bạn đã khoanh và nội dung đang soạn được giữ nguyên.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={reloading} onClick={this.reload} style={{ minHeight: 40, padding: '0 16px', border: 'none', borderRadius: 12, background: '#4338CA', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cập nhật &amp; tiếp tục</button>
          {this.props.onDismiss && <button type="button" disabled={reloading} onClick={this.props.onDismiss} style={{ minHeight: 40, padding: '0 14px', border: '1px solid #d8d8de', borderRadius: 12, background: '#fff', color: '#16161a', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Để sau</button>}
        </div>
      </div>
    )
    return this.props.overlay
      ? <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,10,16,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>{card}</div>
      : card
  }
}
