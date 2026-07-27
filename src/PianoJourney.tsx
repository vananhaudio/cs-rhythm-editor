import { useState } from 'react'

interface Props {
  onClose?: () => void
}

export default function PianoJourney({ onClose }: Props) {
  const [input, setInput] = useState('')

  const handleStart = () => {
    console.log('Piano Journey — nội dung đã nhập:', input)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 30%, #FEF9E7 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* Nút đóng */}
      {onClose && (
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.7)',
          border: 'none', borderRadius: 50,
          width: 44, height: 44,
          fontSize: 20, color: '#92400E',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>✕</button>
      )}

      {/* Icon lớn */}
      <div style={{ fontSize: 80, marginBottom: 16, lineHeight: 1 }}>
        🎹
      </div>

      {/* Tiêu đề */}
      <h1 style={{
        fontSize: 34,
        fontWeight: 800,
        color: '#78350F',
        margin: '0 0 8px',
        textAlign: 'center',
        letterSpacing: '-0.5px',
      }}>
        Piano Journey
      </h1>

      {/* Dòng chào */}
      <p style={{
        fontSize: 22,
        fontWeight: 500,
        color: '#A16207',
        margin: '0 0 48px',
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        Hôm nay con muốn chơi gì?
      </p>

      {/* Ô nhập */}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
        placeholder="........................................"
        autoFocus
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '20px 24px',
          fontSize: 20,
          fontWeight: 500,
          color: '#78350F',
          background: '#FFFFFF',
          border: '3px solid #FCD34D',
          borderRadius: 20,
          outline: 'none',
          fontFamily: 'inherit',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(251, 191, 36, 0.15)',
          transition: 'border-color .2s, box-shadow .2s',
        }}
      />

      {/* Khoảng trắng thoáng */}
      <div style={{ height: 32 }} />

      {/* Nút Bắt đầu */}
      <button
        onClick={handleStart}
        style={{
          width: '100%',
          maxWidth: 280,
          padding: '22px 32px',
          fontSize: 24,
          fontWeight: 800,
          color: '#FFFFFF',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          border: 'none',
          borderRadius: 20,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '0.5px',
          boxShadow: '0 6px 30px rgba(245, 158, 11, 0.35)',
          transition: 'transform .15s, box-shadow .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.03)'
          e.currentTarget.style.boxShadow = '0 8px 36px rgba(245, 158, 11, 0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 6px 30px rgba(245, 158, 11, 0.35)'
        }}
      >
        Bắt đầu
      </button>

      {/* Trang trí góc */}
      <div style={{
        position: 'absolute', top: 40, left: 20, fontSize: 48, opacity: 0.12,
        transform: 'rotate(-15deg)', pointerEvents: 'none',
      }}>🎵</div>
      <div style={{
        position: 'absolute', bottom: 60, right: 20, fontSize: 52, opacity: 0.12,
        transform: 'rotate(10deg)', pointerEvents: 'none',
      }}>🎶</div>
      <div style={{
        position: 'absolute', top: '50%', right: 12, fontSize: 36, opacity: 0.08,
        transform: 'rotate(25deg)', pointerEvents: 'none',
      }}>🎼</div>
    </div>
  )
}
