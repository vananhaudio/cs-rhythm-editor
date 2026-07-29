// Các trang đích của tab "Sống" — mỗi trang là 1 overlay toàn màn, nội dung tĩnh, KHÔNG feed.
// Triết lý: Lớp = đơn vị đào tạo · Band = đơn vị cộng đồng (lập sau các khoá nâng cao).
// Giai đoạn này chỉ giới thiệu + điều hướng; chưa có chức năng ghép Band / bảng tin.
import type { CSSProperties } from 'react'

const S = {
  bg: '#F0F2F5', surface: '#FFFFFF', surface2: '#F7F8FA', border: '#E8EAF0',
  p1: '#4338CA', p2: '#EEF2FF', a1: '#EA580C', a2: '#FFF7ED',
  t1: '#111827', t2: '#6B7280', t3: '#9CA3AF',
  shadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
}

export type LivePage = 'band' | 'community' | 'festival' | 'classgroup'

export interface Grp { id: string; name: string; group_type: string; zalo_url: string | null; facebook_url: string | null }

const TITLES: Record<LivePage, string> = {
  band: '🎸 Band của tôi',
  community: '👥 Cộng đồng Hành trình',
  festival: '🎸 Đại hội Guitar',
  classgroup: '💬 Nhóm lớp của tôi',
}

const openUrl = (u: string) => { try { window.open(u, '_system') } catch { window.open(u, '_blank') } }

const card: CSSProperties = { background: S.surface, borderRadius: 16, padding: '16px 18px', boxShadow: S.shadow, marginBottom: 12 }
const h2: CSSProperties = { fontSize: 16, fontWeight: 800, color: S.t1, marginBottom: 8 }
const p: CSSProperties = { fontSize: 14.5, color: S.t2, lineHeight: 1.7 }

export default function LivePageView({ page, groups, onClose }: { page: LivePage; groups: Grp[]; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: S.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}>
      {/* header */}
      <div style={{ flexShrink: 0, background: S.surface, borderBottom: `1px solid ${S.border}`, padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} aria-label="Quay lại"
          style={{ background: S.p2, border: 'none', borderRadius: 10, width: 36, height: 36, fontSize: 18, color: S.p1, cursor: 'pointer', flexShrink: 0 }}>‹</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: S.t1, lineHeight: 1.3 }}>{TITLES[page]}</div>
      </div>

      {/* nội dung — cuộn được (đây là trang đọc, không phải slide) */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px 32px' }}>
        {page === 'band' && <BandPage />}
        {page === 'community' && <CommunityPage />}
        {page === 'festival' && <FestivalPage />}
        {page === 'classgroup' && <ClassGroupPage groups={groups} />}
      </div>
    </div>
  )
}

// ── Band: giới thiệu, chưa có chức năng ghép ──
function BandPage() {
  return (
    <>
      <div style={{ ...card, background: S.p1, color: '#fff', boxShadow: 'none' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Band là nơi bạn đi đường dài</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.7, color: 'rgba(255,255,255,.88)' }}>
          Lớp học giúp bạn có kỹ năng. Band giúp bạn giữ được cây đàn trong đời sống — có bạn cùng chơi,
          có lý do để tập, có sân khấu để bước lên.
        </div>
      </div>

      <div style={card}>
        <div style={h2}>Band hình thành thế nào?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['1', 'Học xong các khoá nâng cao', 'Bạn cần đủ nền tảng để chơi cùng người khác: giữ nhịp chắc, chuyển hợp âm mượt, nghe được bạn diễn.'],
            ['2', 'Thầy tư vấn ghép Band', 'Ghép theo trình độ, gu nhạc và thời gian rảnh — để cả nhóm đi cùng nhau được lâu.'],
            ['3', 'Cùng tập · cùng diễn', 'Band sinh hoạt đều, chuẩn bị tiết mục và tham gia các buổi biểu diễn, Đại hội Guitar.'],
          ].map(([n, t, d]) => (
            <div key={n} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: S.p2, color: S.p1, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: S.t1 }}>{t}</div>
                <div style={{ fontSize: 13.5, color: S.t2, lineHeight: 1.6, marginTop: 2 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, background: S.a2, boxShadow: 'none', border: '1px solid #FED7AA' }}>
        <div style={{ fontSize: 14.5, color: '#9A3412', lineHeight: 1.7 }}>
          Bạn chưa cần đăng ký gì cả. Cứ học cho chắc — khi tới lúc, thầy sẽ chủ động mời bạn vào Band phù hợp.
        </div>
      </div>
    </>
  )
}

// ── Cộng đồng Hành trình: placeholder ──
function CommunityPage() {
  return (
    <>
      <div style={card}>
        <div style={h2}>Ngôi nhà chung của học viên</div>
        <div style={p}>
          Đây sẽ là nơi toàn bộ học viên trong Hành trình gặp nhau: khoe thành quả, hỏi bài,
          rủ nhau luyện tập và tham gia các thử thách chung.
        </div>
      </div>
      <div style={{ ...card, textAlign: 'center', padding: '28px 20px' }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>🌱</div>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: S.t1, marginBottom: 6 }}>Đang xây dựng</div>
        <div style={{ fontSize: 14, color: S.t2, lineHeight: 1.7 }}>
          Sắp có: bảng tin · chia sẻ · thử thách · hoạt động chung.
          Trong lúc chờ, bạn giữ liên lạc qua nhóm lớp của mình nhé.
        </div>
      </div>
    </>
  )
}

// ── Đại hội Guitar: trang giới thiệu ──
function FestivalPage() {
  return (
    <>
      <div style={card}>
        <div style={h2}>Ngày hội của người chơi đàn</div>
        <div style={p}>
          Đại hội Guitar là dịp học viên các lớp gặp nhau ngoài màn hình: cùng biểu diễn,
          giao lưu và nhìn lại chặng đường mình đã đi.
        </div>
      </div>
      <div style={card}>
        <div style={h2}>Thường có gì?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['🎤', 'Tiết mục học viên', 'Ai cũng có thể đăng ký lên chơi — một mình hoặc theo Band.'],
            ['🤝', 'Giao lưu', 'Gặp bạn học cùng khoá, cùng nhánh Đệm hát / Tỉa nốt.'],
            ['🎓', 'Chia sẻ từ thầy', 'Nhìn lại hành trình và định hướng chặng tiếp theo.'],
          ].map(([ic, t, d]) => (
            <div key={t} style={{ display: 'flex', gap: 11 }}>
              <span style={{ fontSize: 19, flexShrink: 0 }}>{ic}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: S.t1 }}>{t}</div>
                <div style={{ fontSize: 13.5, color: S.t2, lineHeight: 1.6, marginTop: 1 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...card, background: S.surface2, boxShadow: 'none' }}>
        <div style={{ fontSize: 14, color: S.t2, lineHeight: 1.7 }}>
          Thời gian và địa điểm của kỳ Đại hội tới sẽ được thầy thông báo trong nhóm lớp và trên app.
        </div>
      </div>
    </>
  )
}

// ── Nhóm lớp của tôi: link Zalo / Facebook + thông báo lớp ──
function ClassGroupPage({ groups }: { groups: Grp[] }) {
  const zalo = groups.filter(g => g.group_type !== 'facebook' && g.zalo_url)
  const fb = groups.filter(g => g.group_type === 'facebook' && g.facebook_url)
  const hasAny = zalo.length > 0 || fb.length > 0

  return (
    <>
      {hasAny ? (
        <div style={card}>
          <div style={h2}>Vào nhóm lớp</div>
          {zalo.map(g => (
            <button key={g.id} onClick={() => openUrl(g.zalo_url!)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#E8F0FE', color: '#0068FF', border: '1px solid #C5DBFF', borderRadius: 12, padding: '13px 14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{g.name}</span>
              <span>›</span>
            </button>
          ))}
          {fb.map(g => (
            <button key={g.id} onClick={() => openUrl(g.facebook_url!)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#1877F2', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 18 }}>📘</span>
              <span style={{ flex: 1, minWidth: 0 }}>Cộng đồng Facebook</span>
              <span>›</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ ...card, textAlign: 'center', padding: '26px 20px' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.t1, marginBottom: 6 }}>Bạn chưa có nhóm lớp trên app</div>
          <div style={{ fontSize: 14, color: S.t2, lineHeight: 1.7 }}>
            Nếu đang học lớp Zoom với thầy, hãy bấm link xác nhận thầy gửi trong nhóm Zalo của lớp
            để nhóm hiện ở đây.
          </div>
        </div>
      )}

      <div style={card}>
        <div style={h2}>Thông báo lớp</div>
        <div style={{ fontSize: 14, color: S.t3, lineHeight: 1.7 }}>
          Chưa có thông báo mới. Thầy nhắc lịch học và giao bài trong nhóm Zalo của lớp.
        </div>
      </div>
    </>
  )
}
