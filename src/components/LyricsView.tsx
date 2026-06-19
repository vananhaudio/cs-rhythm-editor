import { useMemo } from 'react'
import type { WordData, ChordData, MappingData, ProjectMetadata } from '../xmlTypes'
import { PPQ } from '../xmlTypes'

interface Props {
  metadata: ProjectMetadata
  words: WordData[]
  chords: ChordData[]
  mappings: MappingData[]
  selectedWordId?: string | null
  onSelectWord?: (id: string) => void
}

function fmtTime(ticks: number, tempo: number): string {
  const sec = ticks * 60 / (tempo * PPQ)
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Chia beat thành subdivision (1/4 beat = 1/16 note)
const SUBS = 4 // mỗi phách chia 4 sub
// Grid: mỗi bar = timeSignature × SUBS slots

export default function LyricsView({ metadata, words, chords, mappings, selectedWordId, onSelectWord }: Props) {
  const { tempo, timeSignature, totalBars } = metadata
  const ticksPerBeat = PPQ
  const ticksPerBar  = ticksPerBeat * timeSignature

  const matchedIds = useMemo(() => new Set(mappings.map(m => m.wordId)), [mappings])

  // Nhóm words theo bar
  const barWordMap = useMemo(() => {
    const map: Record<number, WordData[]> = {}
    words.forEach(w => {
      if (!map[w.bar]) map[w.bar] = []
      map[w.bar].push(w)
    })
    return map
  }, [words])

  // Nhóm chords theo bar
  const barChordMap = useMemo(() => {
    const map: Record<number, ChordData[]> = {}
    chords.forEach(c => {
      if (!map[c.bar]) map[c.bar] = []
      map[c.bar].push(c)
    })
    return map
  }, [chords])

  const bars = useMemo(() => {
    const max = Math.max(totalBars, ...words.map(w => w.bar), 1)
    return Array.from({ length: max }, (_, i) => i + 1)
  }, [words, totalBars])

  const rows: number[][] = []
  for (let i = 0; i < bars.length; i += 2) rows.push(bars.slice(i, i + 2))

  const unmatchedCount = words.filter(w => !matchedIds.has(w.id)).length

  // Tìm chord tại beat position trong bar
  function chordAtBeat(barNum: number, beat: number): string | null {
    const barChords = barChordMap[barNum] ?? []
    // Chord gần nhất có beat <= beat này
    const match = barChords
      .filter(c => c.beat <= beat + 0.1)
      .sort((a, b) => b.beat - a.beat)[0]
    return match?.name ?? null
  }

  const C = {
    bg: '#0F1117', surface: '#1A1E2A', surface2: '#1E2330',
    border: '#2D3447', text: '#F1F5F9', text2: '#94A3B8', text3: '#4B5563',
    green: '#10B981', amber: '#F59E0B', blue: '#60A5FA',
    red: '#F87171', indigo: '#6366F1',
  }

  // Chiều rộng mỗi sub-slot (% trong bar)
  const slotPct = 100 / (timeSignature * SUBS)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* Stats */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0, background: C.surface }}>
        <span style={{ fontSize: 12, color: C.text2 }}><span style={{ color: C.green, fontWeight: 600 }}>{mappings.length}</span>/{words.length} từ</span>
        <span style={{ fontSize: 12, color: C.text2 }}><span style={{ color: C.blue, fontWeight: 600 }}>{chords.length}</span> hợp âm</span>
        <span style={{ fontSize: 12, color: C.text2 }}><span style={{ color: C.amber, fontWeight: 600 }}>{bars.length}</span> bars · {Math.round(tempo)} BPM · {timeSignature}/4</span>
        {unmatchedCount > 0 && <span style={{ marginLeft: 'auto', fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ {unmatchedCount} từ chưa khớp</span>}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.border}` }}>
            {row.map(barNum => {
              const barWords  = barWordMap[barNum] ?? []
              const barStartTick = (barNum - 1) * ticksPerBar
              const totalSlots = timeSignature * SUBS

              return (
                <div key={barNum} style={{ borderRight: `1px solid ${C.border}`, padding: '8px 12px', minHeight: 90 }}>

                  {/* Bar label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '.08em' }}>M{barNum}</span>
                    <span style={{ fontSize: 9, color: C.text3 }}>{fmtTime(barStartTick, tempo)}</span>
                  </div>

                  {/* Timeline grid — position relative */}
                  <div style={{ position: 'relative', height: 72 }}>

                      {/* Grid lines phách */}
                    {Array.from({ length: timeSignature }, (_, b) => (
                      <div key={b} style={{
                        position: 'absolute', left: `${(b / timeSignature) * 100}%`,
                        top: 0, bottom: 0, width: 1,
                        background: b === 0 ? C.border : C.border + '60',
                        pointerEvents: 'none',
                      }} />
                    ))}

                    {/* 4 chấm cố định — đặc nếu phách đó có từ matched */}
                    {Array.from({ length: timeSignature }, (_, b) => {
                      const beat = b + 1
                      const pct  = (b / timeSignature) * 100
                      const wordAtBeat = barWords.find(w => Math.abs(w.beat - beat) < 0.5)
                      const isMatched  = wordAtBeat ? matchedIds.has(wordAtBeat.id) : false
                      const isStrong   = b === 0
                      return (
                        <div key={`dot-${b}`} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', top: 0 }}>
                          <div style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: isMatched ? (isStrong ? C.amber : C.indigo) : 'transparent',
                            border: `1.5px solid ${isStrong ? C.amber : C.indigo}`,
                            opacity: isMatched ? 1 : 0.35,
                          }} />
                        </div>
                      )
                    })}

                    {/* Chord + Từ theo vị trí tick */}
                    {barWords.map(w => {
                      const pct        = ((w.beat - 1) / timeSignature) * 100
                      const isMatched  = matchedIds.has(w.id)
                      const isSelected = w.id === selectedWordId
                      const chord = (barChordMap[barNum] ?? [])
                        .filter(ch => Math.abs(ch.beat - w.beat) < 0.5)
                        .sort((a, b) => Math.abs(a.beat - w.beat) - Math.abs(b.beat - w.beat))[0]
                      return (
                        <div key={w.id}
                          onClick={() => onSelectWord?.(w.id)}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(pct, 94)}%`,
                            transform: 'translateX(-50%)',
                            top: 14, cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, height: 13, lineHeight: '13px', whiteSpace: 'nowrap' }}>
                            {chord?.name ?? ''}
                          </div>
                          <div style={{
                            padding: '2px 6px', borderRadius: 5, fontSize: 13, whiteSpace: 'nowrap',
                            background: isSelected ? C.indigo : isMatched ? C.surface2 : '#2A1212',
                            color: isSelected ? '#fff' : isMatched ? C.text : C.red,
                            border: `1px solid ${isSelected ? C.indigo : isMatched ? C.border : C.red + '44'}`,
                          }}>
                            {w.text}
                          </div>
                        </div>
                      )
                    })}


                  </div>
                </div>
              )
            })}
            {row.length < 2 && <div />}
          </div>
        ))}
      </div>
    </div>
  )
}
