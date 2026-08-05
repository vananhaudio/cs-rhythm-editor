// ── "Bài hát của con" — thư viện bài đã chơi ─────────────────────────────────
// Hai người đọc màn này, nên bày hai lớp thông tin:
//   BÉ    → tên bài to, số sao, chạm là tập lại. Không cần biết đọc chữ.
//   PHỤ HUYNH → dải tổng kết trên đầu + mỗi bài có điểm, số lượt, ngày tập.

import { useState } from 'react'
import type { SavedSong } from './library'
import { listSongs, removeSong, starsOfSong, ngayGon, tongKet } from './library'
import { getLevel } from './rules'

const C = {
  bg: '#F7F8FA', card: '#FFFFFF',
  text: '#1F2430', dim: '#6B7280', muted: '#9CA3AF',
  line: '#EEF0F4', accent: '#F59E0B', accentDeep: '#D97706',
  green: '#059669', red: '#DC2626',
}
const SAFE_TOP = 'env(safe-area-inset-top, 0px)'
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'
const SHADOW = '0 2px 14px rgba(17,24,39,.05)'

interface Props {
  onBack: () => void
  onPlay: (song: SavedSong) => void
  /** Chưa có bài nào → mời bé đi nhờ Lyra soạn */
  onAskLyra: () => void
}

export default function SongLibrary({ onBack, onPlay, onAskLyra }: Props) {
  const [songs, setSongs] = useState<SavedSong[]>(listSongs)
  const [xoaId, setXoaId] = useState<string | null>(null)
  const tk = tongKet(songs)

  const xoa = (id: string) => { removeSong(id); setSongs(listSongs()); setXoaId(null) }

  return (
    <div style={{
      height: '100dvh', width: '100%', background: C.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', color: C.text,
      overflow: 'hidden', textAlign: 'left',
    }}>
      <div style={{ width: '100%', maxWidth: 480, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          padding: `calc(${SAFE_TOP} + 14px) 20px 10px`,
        }}>
          <button onClick={onBack} aria-label="Quay lại" style={{
            width: 40, height: 40, borderRadius: 14, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            touchAction: 'manipulation',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.2px' }}>🎵 Bài hát của con</div>
        </header>

        {/* Dải tổng kết — chủ yếu cho phụ huynh nhìn nhanh */}
        {songs.length > 0 && (
          <div style={{
            flexShrink: 0, margin: '2px 20px 12px', padding: '12px 8px',
            background: C.card, borderRadius: 18, boxShadow: SHADOW,
            display: 'flex',
          }}>
            <Oto so={tk.soBai} nhan="bài" />
            <Vach />
            <Oto so={tk.tongLuot} nhan="lượt tập" />
            <Vach />
            <Oto so={tk.soSao} nhan="sao" mau={C.accentDeep} />
          </div>
        )}

        {/* Danh sách */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: `0 20px calc(${SAFE_BOTTOM} + 24px)`,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {songs.length === 0 ? (
            <div style={{
              marginTop: 40, textAlign: 'center', display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <div style={{ fontSize: 52 }}>🎼</div>
              <div style={{ fontSize: 16, color: C.dim, lineHeight: 1.6, maxWidth: 260 }}>
                Chưa có bài nào cả.<br />Con nhờ Lyra soạn một bài nhé!
              </div>
              <button onClick={onAskLyra} style={{
                marginTop: 4, padding: '13px 26px', borderRadius: 16, border: 'none',
                background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`,
                color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
                cursor: 'pointer', boxShadow: '0 6px 18px rgba(217,119,6,.28)',
                touchAction: 'manipulation',
              }}>
                Hỏi Lyra
              </button>
            </div>
          ) : songs.map(s => {
            const sao = starsOfSong(s)
            const daChoi = s.plays > 0
            return (
              <div key={s.id} style={{
                background: C.card, borderRadius: 20, boxShadow: SHADOW,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {/* Chạm cả vùng này để tập lại */}
                <button onClick={() => onPlay(s)} style={{
                  flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                  padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  touchAction: 'manipulation',
                }}>
                  {/* Sao — bé nhìn là biết mình làm tốt tới đâu */}
                  <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        fontSize: 15, lineHeight: 1,
                        opacity: i < sao ? 1 : .18, filter: i < sao ? 'none' : 'grayscale(1)',
                      }}>⭐</span>
                    ))}
                    {!daChoi && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginLeft: 4 }}>chưa tập</span>
                    )}
                  </div>

                  <div style={{
                    fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {s.title}
                  </div>

                  {/* Dòng chi tiết — dành cho phụ huynh */}
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span>{getLevel(s.levelId).kind === 'exercise' ? 'Bài tập' : 'Bậc'} {s.levelId} · {getLevel(s.levelId).name}</span>
                    {daChoi && (
                      <span style={{ fontWeight: 700, color: sao >= 2 ? C.green : sao === 1 ? C.accentDeep : C.red }}>
                        {s.bestHit}/{s.bestTotal} nốt
                      </span>
                    )}
                    {daChoi && <span>{s.plays} lượt</span>}
                    <span>{ngayGon(s.lastPlayedAt)}</span>
                  </div>
                </button>

                {/* Nút tập lại */}
                <button onClick={() => onPlay(s)} aria-label={`Tập lại ${s.title}`} style={{
                  width: 46, height: 46, flexShrink: 0, borderRadius: '50%', border: 'none',
                  background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,119,6,.26)',
                  touchAction: 'manipulation',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                </button>

                {/* Xoá — hỏi lại một nhịp để bé không lỡ tay mất bài */}
                <button onClick={() => setXoaId(xoaId === s.id ? null : s.id)} aria-label="Xoá bài" style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: 10, border: 'none',
                  background: 'transparent', color: C.muted, fontSize: 16, cursor: 'pointer',
                  touchAction: 'manipulation',
                }}>
                  ⋯
                </button>

                {xoaId === s.id && (
                  <div style={{
                    position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(17,24,39,.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                  }} onClick={() => setXoaId(null)}>
                    <div onClick={e => e.stopPropagation()} style={{
                      background: C.card, borderRadius: 22, padding: 22, maxWidth: 300, width: '100%',
                      boxShadow: '0 12px 40px rgba(0,0,0,.2)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Xoá bài này?</div>
                      <div style={{ fontSize: 13, color: C.dim, marginBottom: 18, lineHeight: 1.5 }}>{s.title}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setXoaId(null)} style={{
                          flex: 1, height: 44, borderRadius: 14, border: `1px solid ${C.line}`,
                          background: '#fff', color: C.text, fontSize: 14, fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer',
                        }}>Giữ lại</button>
                        <button onClick={() => xoa(s.id)} style={{
                          flex: 1, height: 44, borderRadius: 14, border: 'none',
                          background: C.red, color: '#fff', fontSize: 14, fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer',
                        }}>Xoá</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Oto({ so, nhan, mau }: { so: number; nhan: string; mau?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: mau ?? C.text, lineHeight: 1.1 }}>{so}</div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{nhan}</div>
    </div>
  )
}

function Vach() {
  return <div style={{ width: 1, background: C.line, margin: '2px 0' }} />
}
