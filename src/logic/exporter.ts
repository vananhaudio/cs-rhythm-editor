import { PPQ } from '../xmlTypes';
import type { Project } from '../xmlTypes';

// Tính tick chuẩn từ bar + beat (không dùng w.time vì có thể có offset)
function barBeatToTick(bar: number, beat: number, timeSig: number): number {
  return Math.round(((bar - 1) * timeSig + (beat - 1)) * PPQ)
}

export function exportV2(project: Project): string {
  const { metadata, words, chords } = project
  const { timeSignature } = metadata

  const lyrics = words.map(w => ({
    id: w.id,
    text: w.text,
    tick: barBeatToTick(w.bar, w.beat, timeSignature),
    bar: w.bar,
    beat: parseFloat(w.beat.toFixed(3)),
    duration: w.duration,
  }))

  const chordList = chords.map(c => ({
    id: c.id,
    name: c.name,
    tick: barBeatToTick(c.bar, c.beat, timeSignature),
    bar: c.bar,
    beat: parseFloat(c.beat.toFixed(3)),
  }))

  return JSON.stringify({
    version: '2.1',
    ppq: PPQ,
    title: metadata.title,
    artist: metadata.artist,
    tone: metadata.tone,
    tempo: Math.round(metadata.tempo),
    timeSignature: metadata.timeSignature,
    totalBars: metadata.totalBars,
    lyrics,
    chords: chordList,
  }, null, 2)
}

export function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
