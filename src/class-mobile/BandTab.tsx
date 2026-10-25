// Tab Ban Nhạc. Ban Nhạc = NHÓM NGƯỜI chơi nhạc cùng nhau. TeamLab = CÔNG CỤ THU ÂM (Studio) — hai thứ khác nhau, giao diện tách rõ.
// Dữ liệu: "Band của tôi" của Class Social (fetchMyBands: teamlab_project_members ⨝ projects, chỉ đọc, RLS hiện có). Không viết lại nghiệp vụ Band.
// Chat Band đã có sẵn trong Trò chuyện (bandchat_*): nút "Chat Band" chỉ chuyển sang tab Trò chuyện.
import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Drum, MessageCircle, Mic, Users } from 'lucide-react'
import { fetchMyBands } from '../class-social/mybands/myBandsApi'
import { bandHomeHref, type MyBand } from '../class-social/mybands/myBandsModel'
import { IS_NATIVE_CAPACITOR } from '../supabase'
import { proxiedHref } from './config'

const LOAD_TIMEOUT_MS = 10000
type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; bands: MyBand[] }

export default function BandTab({ userId, isTeacher, onOpenChat, onOpenBands }: {
  userId: string
  isTeacher: boolean
  onOpenChat: () => void
  onOpenBands: () => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const reload = useCallback(() => {
    setLoad({ status: 'loading' })
    // Mạng treo (không lỗi hẳn, không trả về) → quá hạn thì báo lỗi + Thử lại, không quay tải mãi
    const timeout = new Promise<{ ok: false; message: string }>(res => setTimeout(() => res({ ok: false, message: 'Chưa tải được Band của bạn. Kiểm tra mạng rồi thử lại.' }), LOAD_TIMEOUT_MS))
    void Promise.race([fetchMyBands(userId), timeout]).then(r => setLoad(r.ok ? { status: 'ready', bands: r.value } : { status: 'error', message: r.message }))
  }, [userId])
  useEffect(() => { reload() }, [reload])

  return (
    <div className="cm-page">
      <h1 className="cm-title">Ban Nhạc</h1>

      {load.status === 'loading' && <div role="status" aria-label="Đang tải Ban Nhạc"><div className="cm-skeleton" /><div className="cm-skeleton" /></div>}

      {load.status === 'error' && (
        <div className="cm-error" role="alert"><span>{load.message}</span><button type="button" onClick={reload}>Thử lại</button></div>
      )}

      {load.status === 'ready' && load.bands.length === 0 && (
        <div className="cm-empty">
          <div className="cm-empty-ic"><Drum aria-hidden="true" /></div>
          <h2>Bạn chưa thuộc Ban Nhạc nào</h2>
          <p>Ban Nhạc là nhóm người chơi nhạc cùng nhau. Thầy hoặc Trưởng nhóm sẽ thêm bạn vào Ban Nhạc.</p>
        </div>
      )}

      {load.status === 'ready' && load.bands.map(b => {
        const studio = proxiedHref(bandHomeHref(b.id), IS_NATIVE_CAPACITOR)
        return (
          <section key={b.id} className="cm-card" aria-label={`Ban Nhạc ${b.name}`}>
            <h2 className="cm-band-name">{b.name}</h2>
            <p className="cm-band-meta">Nhóm người chơi nhạc của bạn</p>
            <ul className="cm-list" style={{ boxShadow: 'none', background: 'transparent', marginBottom: 0 }}>
              <li>
                <button type="button" className="cm-row" onClick={onOpenChat}>
                  <span className="cm-row-ic" aria-hidden="true"><MessageCircle /></span>
                  <span className="cm-row-body"><div className="cm-row-t">Chat Band</div><div className="cm-row-s">Nhóm chat của Ban Nhạc trong Trò chuyện</div></span>
                  <ChevronRight className="cm-row-chev" aria-hidden="true" />
                </button>
              </li>
              <li>
                <a className="cm-row" href={studio.href} {...(studio.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  <span className="cm-row-ic" aria-hidden="true"><Mic /></span>
                  <span className="cm-row-body"><div className="cm-row-t">Mở Studio (TeamLab)</div><div className="cm-row-s">Công cụ thu âm: Take, Track, bài hát của Band</div></span>
                  <ChevronRight className="cm-row-chev" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </section>
        )
      })}

      {load.status === 'ready' && load.bands.length > 0 && (
        <p className="cm-note">Thành viên, chức danh, kho bài và bản thu của Ban Nhạc nằm trong TeamLab. Bản này chưa nhúng các màn đó vào ứng dụng.</p>
      )}

      {isTeacher && (
        <>
          <h2 className="cm-h2">Dành cho Thầy</h2>
          <ul className="cm-list">
            <li>
              <button type="button" className="cm-row" onClick={onOpenBands}>
                <span className="cm-row-ic" aria-hidden="true"><Users /></span>
                <span className="cm-row-body"><div className="cm-row-t">Quản lý Band & tuyển thành viên</div></span>
                <ChevronRight className="cm-row-chev" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
