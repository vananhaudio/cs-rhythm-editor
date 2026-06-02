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

const PPQ = 480

function fmtTime(ticks: number, tempo: number): string {
  const sec = ticks * 60 / (tempo * PPQ)
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LyricsView({ metadata, words, chords, mappings, selectedWordId, onSelectWord }: Props) {
  const { tempo, timeSignature, totalBars } = metadata

  const matchedIds = useMemo(() => new Set(mappings.map(m => m.wordId)), [mappings])

  // Map tick → chord name (lấy chord gần nhất)
  const chordAtTick = useMemo(() => {
    const map: Record<number, string> = {}
    chords.forEach(c => { map[c.time] = c.name })
    return map
  }, [chords])

  // Nhóm words theo bar
  const barMap = useMemo(() => {
    const map: Record<number, WordData[]> = {}
    words.forEach(w => {
      if (!map[w.bar]) map[w.bar] = []
      map[w.bar].push(w)
    })
    Object.keys(map).forEach(b => {
      map[Number(b)].sort((a, z) => a.time - z.time)
    })
    return map
  }, [words])

  // Chord gần nhất cho mỗi word
  const wordChordMap = useMemo(() => {
    const sorted = [...chords].sort((a, b) => a.time - b.time)
    const map: Record<string, string> = {}
    words.forEach(w => {
      // Tìm chord có cùng bar+beat hoặc trước word gần nhất
      const match = sorted.find(c => c.bar === w.bar && c.beat === w.beat)
        || sorted.findLast(c => c.time <= w.time)
      if (match && match.bar === w.bar) map[w.id] = match.name
    })
    return map
  }, [words, chords])

  const bars = useMemo(() => {
    const max = Math.max(totalBars, ...words.map(w => w.bar), 1)
    return Array.from({ length: max }, (_, i) => i + 1)
  }, [words, totalBars])

  const rows: number[][] = []
  for (let i = 0; i < bars.length; i += 2) rows.push(bars.slice(i, i + 2))

  const unmatchedCount = words.filter(w => !matchedIds.has(w.id)).length

  const C = {
    bg: '#0F1117', surface: '#1A1E2A', surface2: '#232838',
    border: '#2D3447', text: '#F1F5F9', text2: '#94A3B8', text3: '#4B5563',
    green: '#10B981', amber: '#F59E0B', blue: '#60A5FA', red: '#F87171',
    indigo: '#6366F1',
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* Stats bar */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0, background: C.surface }}>
        <span style={{ fontSize: 11, color: C.text2 }}><span style={{ color: C.green, fontWeight: 600 }}>{mappings.length}</span>/{words.length} từ</span>
        <span style={{ fontSize: 11, color: C.text2 }}><span style={{ color: C.blue, fontWeight: 600 }}>{chords.length}</span> hợp âm</span>
        <span style={{ fontSize: 11, color: C.text2 }}><span style={{ color: C.amber, fontWeight: 600 }}>{bars.length}</span> bars · {tempo} BPM · {timeSignature}/4</span>
        {unmatchedCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.red, fontWeight: 600 }}>⚠ {unmatchedCount} từ chưa khớp</span>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.border}` }}>
            {row.map(barNum => {
              const barWords = barMap[barNum] ?? []
              const barStartTick = (barNum - 1) * timeSignature * PPQ

              return (
                <div key={barNum} style={{ borderRight: `1px solid ${C.border}`, padding: '8px 12px', minHeight: 80 }}>
                  {/* Bar header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.text3, letterSpacing: '.08em' }}>M{barNum}</span>
                    <span style={{ fontSize: 9, color: C.text3 }}>{fmtTime(barStartTick, tempo)}</span>
                  </div>

                  {/* Phách + chord + lời — mỗi cột = 1 từ */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flexWrap: 'wrap', rowGap: 4 }}>
                    {barWords.map((w, wi) => {
                      const isStrong = w.beat === 1
                      const isMatched = matchedIds.has(w.id)
                      const isSelected = w.id === selectedWordId
                      const chord = wordChordMap[w.id]

                      return (
                        <div key={w.id}
                          onClick={() => onSelectWord?.(w.id)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 28, paddingRight: 4, cursor: 'pointer' }}>
                          {/* Chấm phách */}
                          <div style={{
                            width: 9, height: 9, borderRadius: '50%', marginBottom: 4, flexShrink: 0,
                            background: isStrong ? C.amber : C.indigo,
                            border: `1.5px solid ${isStrong ? C.amber : C.indigo}`,
                          }} />
                          {/* Hợp âm */}
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, height: 14, lineHeight: '14px', whiteSpace: 'nowrap' }}>
                            {chord ?? ''}
                          </div>
                          {/* Từ */}
                          <div style={{
                            padding: '2px 6px', borderRadius: 5, fontSize: 12, fontWeight: 400,
                            background: isSelected ? C.indigo : isMatched ? C.surface2 : '#2A1212',
                            color: isSelected ? '#fff' : isMatched ? C.text : C.red,
                            border: `1px solid ${isSelected ? C.indigo : isMatched ? C.border : C.red + '44'}`,
                            whiteSpace: 'nowrap', transition: 'all .1s',
                          }}>
                            {w.text}
                          </div>
                        </div>
                      )
                    })}

                    {/* Phách trống (không có từ) */}
                    {Array.from({ length: Math.max(0, timeSignature - barWords.length) }, (_, i) => (
                      <div key={`empty-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20, paddingRight: 4 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', marginBottom: 4, background: 'transparent', border: `1.5px solid ${C.border}` }} />
                        <div style={{ height: 14 }} />
                        <div style={{ width: 18, height: 22 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {row.length < 2 && <div style={{ borderRight: 'none' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
