import type { Project } from '../xmlTypes';

const TICKS_PER_BEAT = 480

function positionToTick(bar: number, beat: number, timeSig: number, subTick = 0): number {
  return ((bar - 1) * timeSig + (beat - 1)) * TICKS_PER_BEAT + subTick
}

// Export JSON v2 chuẩn — dùng tick thay time
export function exportV2(project: Project): string {
  const { metadata, words, chords } = project

  const lyrics = words.map(w => ({
    id: w.id,
    text: w.text,
    tick: positionToTick(w.bar, w.beat, metadata.timeSignature),
    bar: w.bar,
    beat: w.beat,
  }))

  const chordList = chords.map(c => ({
    id: c.id,
    name: c.name,
    tick: positionToTick(c.bar, c.beat, metadata.timeSignature),
    bar: c.bar,
    beat: c.beat,
  }))

  return JSON.stringify({
    version: '2.1',
    title: metadata.title,
    artist: metadata.artist,
    tone: metadata.tone,
    tempo: metadata.tempo,
    timeSignature: metadata.timeSignature,
    totalBars: metadata.totalBars,
    ticksPerBeat: TICKS_PER_BEAT,
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
