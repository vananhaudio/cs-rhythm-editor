// Công tắc "Âm thanh thông báo" gọn: nút loa cạnh ô tìm kiếm (iOS: biểu tượng, trạng thái đọc được bằng aria-checked + nhãn ẩn).
// Giữ nguyên hành vi/lưu trữ của useNoticeSound; chỉ đổi vị trí và hình thức. Vùng chạm 44×44.
import { Volume2, VolumeX } from 'lucide-react'

export default function SoundSwitch({ enabled, onChange }: { enabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="cs-chat-sound">
      <button type="button" role="switch" aria-checked={enabled} className={'cs-sound-btn' + (enabled ? ' is-on' : '')}
        title={enabled ? 'Âm thanh thông báo: Bật' : 'Âm thanh thông báo: Tắt'} onClick={() => onChange(!enabled)}>
        {enabled ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
        <span className="cs-sr-only">Âm thanh thông báo: {enabled ? 'Bật' : 'Tắt'}</span>
      </button>
    </div>
  )
}
