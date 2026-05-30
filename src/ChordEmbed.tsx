/**
 * ChordEmbed — nhúng vào bài học
 * Nhận prop `chord` (e.g. "Am", "Em", "G") và render ChordPractice
 * Không có header, không sidebar — chỉ component luyện tập
 */
import { useState } from 'react'
import {
  useStringDetector,
  E_SEQUENCE, EM_SEQUENCE,
  A_SEQUENCE, AM_SEQUENCE,
  D_SEQUENCE, DM_SEQUENCE,
  G_SEQUENCE, C_SEQUENCE, F_SEQUENCE,
  B7_SEQUENCE, E7_SEQUENCE, A7_SEQUENCE, D7_SEQUENCE, G7_SEQUENCE,
} from './useStringDetector'
import { Play, Square, Waves, Music2 } from 'lucide-react'

// Re-use chord configs from ChordsPage
const CHORD_MAP: Record<string, string> = {
  E: 'E', Em: 'Em', A: 'A', Am: 'Am',
  D: 'D', Dm: 'Dm', G: 'G', C: 'C', F: 'F',
  B7: 'B7', E7: 'E7', A7: 'A7', D7: 'D7', G7: 'G7',
}

interface Props {
  chord: string   // e.g. "Am", "Em", "G"
  mode?: 'pluck' | 'strum' | 'both'
}

export default function ChordEmbed({ chord, mode = 'both' }: Props) {
  const [activeMode, setActiveMode] = useState<'pluck' | 'strum'>(mode === 'strum' ? 'strum' : 'pluck')
  const chordName = CHORD_MAP[chord] ?? chord

  return (
    <div style={{
      background: '#040c16', borderRadius: 16, overflow: 'hidden',
      border: '1px solid #0a1828', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header mini */}
      <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid #0a1828', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{chordName}</span>
          <span style={{ fontSize: 12, color: '#3d5068', marginLeft: 10 }}>Luyện hợp âm</span>
        </div>
        {mode === 'both' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setActiveMode('pluck')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${activeMode === 'pluck' ? '#14532d' : '#0a1828'}`, background: activeMode === 'pluck' ? 'rgba(34,197,94,0.12)' : 'transparent', color: activeMode === 'pluck' ? '#4ade80' : '#3d5068', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Music2 size={12} /> Rải dây
            </button>
            <button onClick={() => setActiveMode('strum')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${activeMode === 'strum' ? '#92400e' : '#0a1828'}`, background: activeMode === 'strum' ? 'rgba(245,158,11,0.12)' : 'transparent', color: activeMode === 'strum' ? '#f59e0b' : '#3d5068', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Waves size={12} /> Quạt
            </button>
          </div>
        )}
      </div>

      {/* Redirect to full page for now - sẽ embed trực tiếp sau */}
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#4ade80', marginBottom: 12 }}>
          Luyện tập hợp âm <strong>{chordName}</strong> với microphone
        </div>
        <a href={`/chords?chord=${chordName}&mode=${activeMode}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid #14532d', color: '#4ade80', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
          <Music2 size={16} />
          Mở luyện tập {chordName}
        </a>
        <div style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>Sử dụng microphone để phát hiện âm thanh</div>
      </div>
    </div>
  )
}
