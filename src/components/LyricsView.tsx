import { useMemo } from 'react'
import type { WordData, ChordData, MappingData, ProjectMetadata } from '../xmlTypes'

interface Props {
  metadata: ProjectMetadata
  words: WordData[]
  chords: ChordData[]
  mappings: MappingData[]
  selectedWordId?: string | null
  onSelectWord?: (id: string) => void
}

const C = {
  bg:      '#0F1117',
  surface: '#1A1E2A',
  surface2:'#232838',
  border:  '#2D3447',
  text:    '#F1F5F9',
  text2:   '#94A3B8',
  text3:   '#64748B',
  green:   '#10B981',
  amber:   '#F59E0B',
  blue:    '#60A5FA',
  red:     '#F87171',
}

function fmtTime(ticks: number, tempo: number, ppq = 480): string {
  const sec = ticks * 60 / (tempo * ppq)
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LyricsView({ metadata, words, chords, mappings, selectedWordId, onSelectWord }: Props) {
  const { tempo, timeSignature, totalBars } = metadata

  // Map wordId → chords
  const wordChordMap = useMemo(() => {
    const map: Record<string, ChordData[]> = {}
    chords.forEach(c => {
      // Tìm word gần nhất với chord này (theo bar+beat)
      const near = words.find(w => w.bar === c.bar && w.beat <= c.beat && w.beat + 1 > c.beat)
        || words.find(w => w.bar === c.bar)
      if (near) {
        if (!map[near.id]) map[near.id] = []
        map[near.id].push(c)
      }
    })
    return map
  }, [words, chords])

  // Nhóm words theo bar
  const barMap = useMemo(() => {
    const map: Record<number, WordData[]> = {}
    words.forEach(w => {
      if (!map[w.bar]) map[w.bar] = []
      map[w.bar].push(w)
    })
    // Sort mỗi bar theo beat
    Object.keys(map).forEach(b => {
      map[Number(b)].sort((a, z) => a.beat - z.beat || a.time - z.time)
    })
    return map
  }, [words])

  const bars = useMemo(() => {
    const maxBar = Math.max(totalBars, ...words.map(w => w.bar), 1)
    return Array.from({ length: maxBar }, (_, i) => i + 1)
  }, [words, totalBars])

  // matched set
  const matchedIds = useMemo(() => new Set(mappings.flatMap(m => [m.wordId])), [mappings])
  const unmatchedCount = words.filter(w => !matchedIds.has(w.id)).length

  // Chia rows 2 bars/hàng
  const rows: number[][] = []
  for (let i = 0; i < bars.length; i += 2) {
    rows.push(bars.slice(i, i + 2))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Stats */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: C.text2 }}>
          <span style={{ color: C.green, fontWeight: 700 }}>{mappings.length}</span>/{words.length} từ khớp
        </div>
        <div style={{ fontSize: 12, color: C.text2 }}>
          <span style={{ color: C.amber, fontWeight: 700 }}>{chords.length}</span> hợp âm
        </div>
        <div style={{ fontSize: 12, color: C.text2 }}>
          <span style={{ color: C.blue, fontWeight: 700 }}>{bars.length}</span> bars
        </div>
        {unmatchedCount > 0 && (
          <div style={{ fontSize: 12, color: C.red, marginLeft: 'auto' }}>
            ⚠ {unmatchedCount} từ chưa khớp
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
            {row.map(barNum => {
              const barWords = barMap[barNum] ?? []
              const barStartTick = (barNum - 1) * timeSignature * 480
              return (
                <div key={barNum} style={{
                  borderRight: `1px solid ${C.border}`,
                  borderBottom: `1px solid ${C.border}`,
                  padding: '6px 10px',
                  minHeight: 64,
                }}>
                  {/* Bar header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '.06em' }}>M{barNum}</span>
                    <span style={{ fontSize: 9, color: C.text3 }}>{fmtTime(barStartTick, tempo)}</span>
                    {/* Beat grid */}
                    <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                      {Array.from({ length: timeSignature }, (_, b) => {
                        const hasBeat = barWords.some(w => Math.floor(w.beat) === b + 1)
                        return (
                          <div key={b} style={{
                            width: 8, height: 3, borderRadius: 99,
                            background: b === 0 ? (hasBeat ? '#6366F1' : C.border) : (hasBeat ? C.green : C.border),
                          }} />
                        )
                      })}
                    </div>
                  </div>

                  {/* Words */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 4px', alignItems: 'flex-end' }}>
                    {barWords.map(w => {
                      const wChords = wordChordMap[w.id] ?? []
                      const isMatched = matchedIds.has(w.id)
                      const isSelected = w.id === selectedWordId
                      return (
                        <div key={w.id}
                          onClick={() => onSelectWord?.(w.id)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                          {/* Hợp âm */}
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, minHeight: 14, lineHeight: '14px' }}>
                            {wChords.map(c => c.name).join(' ')}
                          </div>
                          {/* Từ */}
                          <div style={{
                            fontSize: 12, fontWeight: 500,
                            padding: '2px 5px', borderRadius: 5,
                            background: isSelected ? '#6366F1' : isMatched ? C.surface2 : '#2A1A1A',
                            color: isSelected ? '#fff' : isMatched ? C.text : C.red,
                            border: `1px solid ${isSelected ? '#6366F1' : isMatched ? C.border : C.red + '44'}`,
                            transition: 'all .15s',
                          }}>
                            {w.text}
                          </div>
                        </div>
                      )
                    })}
                    {barWords.length === 0 && (
                      <div style={{ fontSize: 10, color: C.text3, fontStyle: 'italic' }}>—</div>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Fill nếu row lẻ */}
            {row.length < 2 && <div style={{ borderBottom: `1px solid ${C.border}` }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
