// Sơ đồ bấm ngón hợp âm (port từ ChordDiagramView.swift). SVG thuần, inline style.
import type { ChordShape } from './logic/chordLibrary'

const STRINGS = 6
const FRET_ROWS = 4

export default function ChordDiagram({ shape, width = 132 }: { shape: ChordShape; width?: number }) {
  const w = width
  const h = w * 1.25
  const padX = w * 0.12
  const padTop = h * 0.16
  const padBottom = h * 0.06
  const gridW = w - padX * 2
  const gridH = h - padTop - padBottom
  const colGap = gridW / (STRINGS - 1)
  const rowGap = gridH / FRET_ROWS
  const line = 'rgba(255,255,255,0.35)'

  const els: React.ReactNode[] = []
  // các phím (ngang)
  for (let r = 0; r <= FRET_ROWS; r++) {
    const y = padTop + rowGap * r
    els.push(<line key={`f${r}`} x1={padX} y1={y} x2={padX + gridW} y2={y} stroke={line} strokeWidth={r === 0 ? 3 : 1} />)
  }
  // các dây (dọc)
  for (let s = 0; s < STRINGS; s++) {
    const x = padX + colGap * s
    els.push(<line key={`s${s}`} x1={x} y1={padTop} x2={x} y2={padTop + gridH} stroke={line} strokeWidth={1} />)
  }
  // O / X + nốt bấm
  for (let s = 0; s < STRINGS; s++) {
    const x = padX + colGap * s
    const fret = shape.frets[s]
    if (fret <= 0) {
      const sym = fret === 0 ? 'O' : '✕'
      els.push(
        <text key={`m${s}`} x={x} y={padTop * 0.62} fill={fret === 0 ? '#E6EAF2' : '#8A93A6'}
          fontSize={w * 0.12} fontWeight={700} textAnchor="middle">{sym}</text>
      )
    } else {
      const y = padTop + rowGap * (fret - 0.5)
      els.push(<circle key={`d${s}`} cx={x} cy={y} r={colGap * 0.34} fill="#F59E0B" />)
    }
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">{els}</svg>
  )
}
