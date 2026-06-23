// ChordPractice — luyện hợp âm với chord detection thật (PCP chroma + YIN)
// Dùng useChordDetector (gảy cả chord → nhận dạng ngay)
// và useStringDetector (rải từng dây → chấm từng dây một)

import { useState } from 'react'
import { useChordDetector } from './useChordDetector'
import {
  useStringDetector,
  AM_SEQUENCE, EM_SEQUENCE, DM_SEQUENCE,
  E_SEQUENCE, C_SEQUENCE, G_SEQUENCE,
  type ChordStep,
  RATING_LABELS, RATING_COLORS,
} from './useStringDetector'

export interface ChordPracticeCfg {
  chord?: string      // 'Am' | 'C' | 'Dm' | 'Em' | 'E' | 'G'
  chords?: string[]   // luyện nhiều hợp âm tuần tự
  mode?: 'strum' | 'rai'  // 'strum' = gảy chord → nhận dạng ngay; 'rai' = rải từng dây
}

// ── Chord metadata ────────────────────────────────────────────────────────────
const CHORD_META: Record<string, {
  label: string; color: string; frets: number[]; sequence: ChordStep[]
}> = {
  Am: { label: 'La thứ',     color: '#C0392B', frets: [-1,0,2,2,1,0], sequence: AM_SEQUENCE },
  Em: { label: 'Mi thứ',     color: '#27AE60', frets: [0,2,2,0,0,0],  sequence: EM_SEQUENCE },
  Dm: { label: 'Rê thứ',     color: '#8E44AD', frets: [-1,-1,0,2,3,1],sequence: DM_SEQUENCE },
  E:  { label: 'Mi trưởng',  color: '#16A085', frets: [0,2,2,1,0,0],  sequence: E_SEQUENCE  },
  C:  { label: 'Đô trưởng',  color: '#2980B9', frets: [-1,3,2,0,1,0], sequence: C_SEQUENCE  },
  G:  { label: 'Sol trưởng', color: '#D35400', frets: [3,2,0,0,0,3],  sequence: G_SEQUENCE  },
  G7: { label: 'Sol bảy',    color: '#B45309', frets: [3,2,0,0,0,1],  sequence: G_SEQUENCE  },
}

// ── Chord diagram ─────────────────────────────────────────────────────────────
function Diagram({ name, frets, color, highlightStep }: {
  name: string; frets: number[]; color: string; highlightStep?: number
}) {
  const xs = [16, 36, 56, 76, 96, 116]
  const validFrets = frets.filter(f => f > 0)
  const minFret = validFrets.length ? Math.min(...validFrets) : 1
  const offset = minFret > 3 ? minFret - 1 : 0
  return (
    <svg viewBox="0 0 132 160" width="148" style={{ display: 'block' }}>
      <text x={66} y={13} textAnchor="middle" fontSize={17} fontWeight="800" fill={color}>{name}</text>
      <rect x={14} y={26} width={104} height={4} rx={2} fill="#2A2622" />
      {[0,1,2,3].map(r => (
        <line key={r} x1={16} x2={116} y1={30+r*28} y2={30+r*28} stroke="#C9BBA4" strokeWidth={1.4}/>
      ))}
      {xs.map((x,i) => (
        <line key={i} x1={x} x2={x} y1={26} y2={142} stroke="#B8AD9C" strokeWidth={i===0?2.6:1.6}/>
      ))}
      {frets.map((f,i) => f===0
        ? <circle key={'o'+i} cx={xs[i]} cy={18} r={5} fill="none" stroke="#9A8F7E" strokeWidth={1.5}/>
        : f<0 ? <text key={'x'+i} x={xs[i]} y={22} textAnchor="middle" fontSize={11} fill="#9A8F7E">✕</text>
        : null
      )}
      {frets.map((f,i) => f>0 ? (
        <circle key={'d'+i} cx={xs[i]} cy={30+(f-offset-0.5)*28} r={8}
          fill={highlightStep === i ? '#FFD700' : color}
          opacity={highlightStep !== undefined && highlightStep !== i ? 0.4 : 1}/>
      ) : null)}
      {offset>0 && <text x={9} y={44} textAnchor="end" fontSize={10} fill="#9A8F7E">{offset+1}fr</text>}
    </svg>
  )
}

// ── Strum mode: gảy cả chord → nhận dạng ─────────────────────────────────────
function StrumPractice({ chordName, color, onPass }: {
  chordName: string; color: string; onPass: () => void
}) {
  const { state, start, reset } = useChordDetector(chordName)
  const { phase, score, confirmedFrames, topGuess, rogueNotes } = state

  const CONFIRM_FRAMES = 6
  const progressPct = Math.min(100, (confirmedFrames / CONFIRM_FRAMES) * 100)

  if (phase === 'correct') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ padding:'16px', borderRadius:14, background:'#D1FAE5', color:'#065F46', fontSize:17, fontWeight:800, textAlign:'center' }}>
          ✓ Đúng rồi! Hợp âm {chordName} chuẩn!
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={reset} style={{ flex:1, padding:'13px', borderRadius:12, border:'1.5px solid #E4E4E7', background:'#fff', color:'#52525B', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            ↺ Gảy lại
          </button>
          <button onClick={onPass} style={{ flex:2, padding:'13px', borderRadius:12, border:'none', background:'#4338CA', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Tiếp theo →
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'incorrect') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ padding:'14px', borderRadius:14, background:'#FEF3C7', color:'#92400E', fontSize:15, fontWeight:700, textAlign:'center' }}>
          Chưa nhận ra hợp âm {chordName} — thử lại nhé!
        </div>
        <button onClick={reset} style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:color, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          🎤 Thử lại
        </button>
      </div>
    )
  }

  if (phase === 'listening') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Progress bar */}
        <div style={{ height:8, background:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progressPct}%`, background:color, borderRadius:4, transition:'width 0.1s' }}/>
        </div>

        {topGuess && (
          <div style={{ textAlign:'center', fontSize:14, color:'#6B7280' }}>
            Đang nghe: <strong style={{ color: topGuess===chordName ? '#16A34A' : '#DC2626' }}>{topGuess || '—'}</strong>
            {' '}· Cần: <strong>{chordName}</strong>
          </div>
        )}

        {rogueNotes.length > 0 && (
          <div style={{ textAlign:'center', fontSize:13, color:'#B45309' }}>
            ⚠ Nghe thấy nốt lạ: {rogueNotes.join(', ')} — kiểm tra lại ngón bấm
          </div>
        )}

        <div style={{ padding:'14px', borderRadius:14, background:'#1C1B19', color:'#F4ECDF', fontSize:16, fontWeight:700, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <span style={{ fontSize:22, animation:'pulse 0.8s infinite' }}>🎤</span>
          Đang nghe… gảy hợp âm {chordName}
        </div>

        <div style={{ textAlign:'center', fontSize:13, color:'#9CA3AF' }}>
          Độ khớp: {Math.round(score * 100)}%
        </div>
      </div>
    )
  }

  // idle
  return (
    <button onClick={start} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:color, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
      🎤 Gảy hợp âm {chordName} — bắt đầu nghe
    </button>
  )
}

// ── Rải mode: từng dây một ───────────────────────────────────────────────────
function RaiPractice({ chordName, meta, onPass }: {
  chordName: string
  meta: typeof CHORD_META[string]
  onPass: () => void
}) {
  const { state, start, resetAndStart } = useStringDetector(meta.sequence)
  const { status, currentStep, listening, done, lastRating, detectedFreq } = state

  const curString = meta.sequence[currentStep]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Dây đang cần gảy */}
      {!done && (
        <div style={{ background:'#F8F4EE', borderRadius:12, padding:'12px 16px' }}>
          <div style={{ fontSize:13, color:'#9A8F7E', marginBottom:4 }}>Gảy dây tiếp theo:</div>
          <div style={{ fontSize:17, fontWeight:700, color:meta.color }}>
            Dây {curString?.stringNum} — {curString?.note}
            {curString?.finger && <span style={{ marginLeft:8, fontSize:13, color:'#6B7280' }}>Ngón {curString.finger} · {curString?.fretLabel}</span>}
          </div>
        </div>
      )}

      {/* Dây status */}
      <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
        {meta.sequence.map((step, i) => (
          <div key={i} style={{
            width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, fontWeight:700,
            background: status[i]==='correct' ? '#D1FAE5' : status[i]==='current' ? meta.color : '#E5E7EB',
            color: status[i]==='correct' ? '#065F46' : status[i]==='current' ? '#fff' : '#6B7280',
            border: status[i]==='current' ? `2px solid ${meta.color}` : '2px solid transparent'
          }}>
            {status[i]==='correct' ? '✓' : step.stringNum}
          </div>
        ))}
      </div>

      {/* Rating */}
      {lastRating && (
        <div style={{ textAlign:'center', fontSize:14, fontWeight:700, color: RATING_COLORS[lastRating] }}>
          {RATING_LABELS[lastRating]}
        </div>
      )}

      {listening && detectedFreq > 0 && (
        <div style={{ textAlign:'center', fontSize:13, color:'#9CA3AF' }}>
          Phát hiện: {detectedFreq.toFixed(1)} Hz
        </div>
      )}

      {done ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ padding:'16px', borderRadius:14, background:'#D1FAE5', color:'#065F46', fontSize:17, fontWeight:800, textAlign:'center' }}>
            ✓ Rải đúng hợp âm {chordName}!
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => resetAndStart()} style={{ flex:1, padding:'13px', borderRadius:12, border:'1.5px solid #E4E4E7', background:'#fff', color:'#52525B', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              ↺ Rải lại
            </button>
            <button onClick={onPass} style={{ flex:2, padding:'13px', borderRadius:12, border:'none', background:'#4338CA', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Tiếp theo →
            </button>
          </div>
        </div>
      ) : listening ? (
        <div style={{ padding:'14px', borderRadius:14, background:'#1C1B19', color:'#F4ECDF', fontSize:16, fontWeight:700, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <span style={{ fontSize:22, animation:'pulse 0.8s infinite' }}>🎤</span>
          Đang nghe… rải từng dây
        </div>
      ) : (
        <button onClick={start} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:meta.color, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          🎤 Bắt đầu rải từng dây
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ChordPractice({ cfg, onPass }: { cfg: ChordPracticeCfg; onPass?: () => void }) {
  const chordList = cfg.chords ?? [cfg.chord ?? 'Am']
  const mode = cfg.mode ?? 'strum'
  const [chordIdx, setChordIdx] = useState(0)
  const [passed, setPassed] = useState(false)

  const chordName = chordList[chordIdx]
  const meta = CHORD_META[chordName] ?? CHORD_META.Am
  const isLast = chordIdx === chordList.length - 1

  const handlePass = () => {
    if (!isLast) {
      setChordIdx(i => i + 1)
    } else {
      setPassed(true)
      onPass?.()
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, padding:'4px 0' }}>

      {/* Tiến trình nhiều hợp âm */}
      {chordList.length > 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {chordList.map((c, i) => (
            <div key={c+i} style={{
              padding:'4px 12px', borderRadius:20, fontSize:13, fontWeight:700,
              background: i < chordIdx ? '#D1FAE5' : i===chordIdx ? (CHORD_META[c]?.color ?? '#4338CA') : '#E5E7EB',
              color: i < chordIdx ? '#065F46' : i===chordIdx ? '#fff' : '#6B7280'
            }}>{c} {i < chordIdx ? '✓' : ''}</div>
          ))}
        </div>
      )}

      {/* Sơ đồ */}
      <div style={{ display:'flex', justifyContent:'center', background:'#F8F4EE', borderRadius:16, padding:'16px 24px' }}>
        <div style={{ textAlign:'center' }}>
          <Diagram name={chordName} frets={meta.frets} color={meta.color} />
          <div style={{ fontSize:13, color:'#9A8F7E', marginTop:6 }}>{meta.label}</div>
        </div>
      </div>

      {/* Practice area */}
      {passed ? (
        <div style={{ padding:'16px', borderRadius:14, background:'#D1FAE5', color:'#065F46', fontSize:17, fontWeight:800, textAlign:'center' }}>
          🎉 Hoàn thành tất cả {chordList.length} hợp âm!
        </div>
      ) : mode === 'strum' ? (
        <StrumPractice key={chordName} chordName={chordName} color={meta.color} onPass={handlePass} />
      ) : (
        <RaiPractice key={chordName} chordName={chordName} meta={meta} onPass={handlePass} />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
