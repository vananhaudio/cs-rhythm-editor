import { PPQ } from '../xmlTypes';
import type { Project } from '../xmlTypes';

// Export JSON v2.1 — tick-based (time field = ticks, PPQ = 480)
export function exportV2(project: Project): string {
  const { metadata, words, chords } = project

  const lyrics = words.map(w => ({
    id: w.id,
    text: w.text,
    tick: w.time,        // time đã là ticks (PPQ=480)
    bar: w.bar,
    beat: w.beat,
    duration: w.duration,
  }))

  const chordList = chords.map(c => ({
    id: c.id,
    name: c.name,
    tick: c.time,        // time đã là ticks
    bar: c.bar,
    beat: c.beat,
  }))

  return JSON.stringify({
    version: '2.1',
    ppq: PPQ,
    title: metadata.title,
    artist: metadata.artist,
    tone: metadata.tone,
    tempo: metadata.tempo,
    timeSignature: metadata.timeSignature,
    totalBars: metadata.totalBars,
    lyrics,
    chords: chordList,
  }, null, 2)
}

// Export đầy đủ v3 (internal use)
export function exportV3(project: Project): string {
  return JSON.stringify({ version: 3, ppq: PPQ, ...project }, null, 2)
}

export function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
