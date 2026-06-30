// GrooveBackingPad — "Nền tập quạt" (port từ Groove Lab app/(tabs)/tap.tsx sang web inline styles).
// Engine trống+bass tái dùng src/elearn/backing/backingEngine.ts (Web Audio thuần, đã có sẵn).
// Chọn điệu + vòng hợp âm + tempo + bật/tắt track → quạt theo ô đang sáng.
import { useCallback, useEffect, useRef, useState } from 'react'
import { STYLES, PRESETS, getStyle } from '../elearn/backing/backingStyles'
import { BackingEngine, type Mutes } from '../elearn/backing/backingEngine'

const ACCENT = '#2E7D52'
const MIN_T = 40, MAX_T = 220

export default function GrooveBackingPad() {
  const [styleId, setStyleId] = useState('ballad')
  const [chords, setChords]   = useState<string[]>(['C', 'Am', 'F', 'G'])
  const [tempo, setTempo]     = useState(70)
  const [mutes, setMutes]     = useState<Mutes>({ drums: false, bass: false, click: true })
  const [playing, setPlaying] = useState(false)
  const [curBar, setCurBar]   = useState(-1)

  // refs cho engine đọc live
  const styleIdRef = useRef(styleId); styleIdRef.current = styleId
  const chordsRef  = useRef(chords);  chordsRef.current  = chords
  const tempoRef   = useRef(tempo);   tempoRef.current   = tempo
  const mutesRef   = useRef(mutes);   mutesRef.current   = mutes

  const engineRef  = useRef<BackingEngine | null>(null)
  const rafRef     = useRef<number | null>(null)
  const playingRef = useRef(false); playingRef.current = playing

  if (!engineRef.current) {
    engineRef.current = new BackingEngine({
      getStyle:  () => getStyle(styleIdRef.current),
      getChords: () => chordsRef.current,
      getTempo:  () => tempoRef.current,
      getMutes:  () => mutesRef.current,
    })
  }

  useEffect(() => () => {
    engineRef.current?.dispose()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const loop = useCallback(() => {
    setCurBar(engineRef.current?.getBarIndex() ?? -1)
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const play = useCallback(() => {
    engineRef.current?.start()
    setPlaying(true)
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setPlaying(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setCurBar(-1)
  }, [])

  const toggle = () => (playing ? stop() : play())

  // đổi cấu trúc (điệu / vòng hợp âm) khi đang chạy -> restart engine
  const restartIfPlaying = useCallback(() => {
    if (playingRef.current) { engineRef.current?.stop(); engineRef.current?.start() }
  }, [])

  const pickStyle = (id: string) => {
    setStyleId(id); styleIdRef.current = id
    const t = getStyle(id).defaultTempo; setTempo(t); tempoRef.current = t
    restartIfPlaying()
  }
  const pickPreset = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid); if (!p) return
    setStyleId(p.styleId); styleIdRef.current = p.styleId
    setChords(p.chords);   chordsRef.current  = p.chords
    const t = p.tempo ?? getStyle(p.styleId).defaultTempo; setTempo(t); tempoRef.current = t
    restartIfPlaying()
  }
  const changeTempo = (d: number) => {
    const t = Math.max(MIN_T, Math.min(MAX_T, tempo + d))
    setTempo(t); tempoRef.current = t // engine đọc live -> mượt, không cần restart
  }
  const toggleMute = (k: keyof Mutes) => setMutes((m) => ({ ...m, [k]: !m[k] }))

  const style = getStyle(styleId)

  return (
    <div style={{ padding: '4px 2px 28px' }}>
      {/* Điệu */}
      <div style={S.label}>ĐIỆU</div>
      <div style={S.chips}>
        {STYLES.map((s) => {
          const on = s.id === styleId
          return (
            <button key={s.id} onClick={() => pickStyle(s.id)}
              style={{ ...S.chip, ...(on ? S.chipOn : null) }}>
              {s.name}
            </button>
          )
        })}
      </div>

      {/* Vòng hợp âm + highlight */}
      <div style={S.label}>VÒNG HỢP ÂM · quạt theo ô sáng</div>
      <div style={S.card}>
        <div style={S.barsRow}>
          {chords.map((c, i) => {
            const on = playing && i === curBar
            return (
              <div key={i} style={{ ...S.bar, ...(on ? S.barOn : null) }}>
                <span style={{ ...S.barChord, ...(on ? S.barChordOn : null) }}>{c}</span>
              </div>
            )
          })}
        </div>
        <div style={S.presetRow}>
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => pickPreset(p.id)} style={S.presetChip}>{p.name}</button>
          ))}
        </div>
      </div>

      {/* Tempo */}
      <div style={S.card}>
        <div style={S.tempoRow}>
          <button onClick={() => changeTempo(-2)} style={S.tBtn}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={S.tempoLabel}>Tempo · {style.beatsPerBar}/4{style.feel === 'triplet' ? ' bộ ba' : ''}</div>
            <div style={S.tempoVal}>{tempo}</div>
          </div>
          <button onClick={() => changeTempo(2)} style={S.tBtn}>+</button>
        </div>
      </div>

      {/* Mute từng track */}
      <div style={S.muteRow}>
        {([['drums', 'Trống'], ['bass', 'Bass'], ['click', 'Click']] as [keyof Mutes, string][]).map(([k, lbl]) => {
          const off = mutes[k]
          return (
            <button key={k} onClick={() => toggleMute(k)}
              style={{ ...S.muteBtn, ...(!off ? S.muteOn : null) }}>
              <span style={{ ...S.muteText, ...(!off ? S.muteTextOn : null) }}>{lbl}</span>
              <span style={{ ...S.muteState, ...(!off ? S.muteTextOn : null) }}>{off ? 'tắt' : 'bật'}</span>
            </button>
          )
        })}
      </div>

      {/* Play / Stop */}
      <button onClick={toggle}
        style={{ ...S.play, background: playing ? '#B91C1C' : ACCENT }}>
        {playing ? '■ DỪNG' : '▶ CHẠY NỀN'}
      </button>

      <div style={S.hint}>Chọn điệu + vòng hợp âm, bấm Chạy nền rồi quạt hợp âm theo ô đang sáng.</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  label:      { fontSize: 11, fontWeight: 800, color: '#A89F90', letterSpacing: 1, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  chips:      { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:       { padding: '10px 16px', borderRadius: 12, background: '#FFF', border: '1.5px solid #E8E2D6', fontSize: 13.5, fontWeight: 600, color: '#5A5650', cursor: 'pointer', fontFamily: 'inherit' },
  chipOn:     { background: ACCENT, border: `1.5px solid ${ACCENT}`, color: '#FFF' },
  card:       { background: '#FFF', borderRadius: 16, padding: 14, marginTop: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' },
  barsRow:    { display: 'flex', gap: 8 },
  bar:        { flex: 1, aspectRatio: '1', maxWidth: 84, borderRadius: 12, background: '#F4F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid transparent' },
  barOn:      { background: ACCENT + '18', border: `2px solid ${ACCENT}` },
  barChord:   { fontSize: 20, fontWeight: 800, color: '#3A3A3A' },
  barChordOn: { color: ACCENT },
  presetRow:  { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  presetChip: { padding: '7px 11px', borderRadius: 9, background: '#F4F0E8', border: 'none', fontSize: 12, fontWeight: 600, color: '#6B6F76', cursor: 'pointer', fontFamily: 'inherit' },
  tempoRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' },
  tBtn:       { width: 46, height: 46, borderRadius: 23, border: '1.5px solid #E0DAD0', background: '#FFF', color: ACCENT, fontSize: 24, fontWeight: 700, cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit' },
  tempoLabel: { fontSize: 11.5, color: '#9A958C' },
  tempoVal:   { fontSize: 34, fontWeight: 800, color: ACCENT, lineHeight: '40px' },
  muteRow:    { display: 'flex', gap: 8, marginTop: 14 },
  muteBtn:    { flex: 1, padding: '12px 0', borderRadius: 12, background: '#FFF', border: '1.5px solid #E8E2D6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer', fontFamily: 'inherit' },
  muteOn:     { border: `1.5px solid ${ACCENT}`, background: ACCENT + '12' },
  muteText:   { fontSize: 13.5, fontWeight: 600, color: '#8A8B90' },
  muteState:  { fontSize: 10.5, color: '#B0AAA0' },
  muteTextOn: { color: ACCENT },
  play:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, padding: '16px 0', marginTop: 18, width: '100%', border: 'none', color: '#FFF', fontSize: 16, fontWeight: 800, letterSpacing: 0.5, cursor: 'pointer', fontFamily: 'inherit' },
  hint:       { fontSize: 12.5, color: '#9A958C', textAlign: 'center', marginTop: 14, lineHeight: 1.5 },
}
