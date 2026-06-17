// Chuyển notes[] (model đơn âm của ScoreTabViewer) → chuỗi alphaTex để AlphaTab render.
// Quy ước dây của ta: 0 = Mi trầm (dây 6) … 5 = Mi cao (dây 1).
// alphaTab: dây 1 = Mi cao, dây 6 = Mi trầm  ⇒  alphaString = 6 - ourString.
import type { ScoreNote } from '../scoreData';
import { SCORE_BEATS_PER_MEASURE } from '../scoreData';

const BASE_BEATS = [4, 2, 1, 0.5, 0.25];
const spb = (bpm: number) => 60 / bpm;

interface DurClass { base: number; dotted: boolean; triplet: boolean }

function classify(beats: number): DurClass {
  for (const base of BASE_BEATS) {
    if (Math.abs(beats - base)        < 0.01) return { base, dotted: false, triplet: false };
    if (Math.abs(beats - base * 1.5)  < 0.01) return { base, dotted: true,  triplet: false };
    if (Math.abs(beats - base * 2 / 3) < 0.02) return { base, dotted: false, triplet: true };
  }
  return { base: 1, dotted: false, triplet: false };
}

// base beats → giá trị trường độ alphaTex (4=đen, 2=trắng, 1=tròn, 8=móc đơn, 16=móc đôi)
const ALPHA_DUR: Record<number, number> = { 4: 1, 2: 2, 1: 4, 0.5: 8, 0.25: 16 };

export function notesToAlphaTex(notes: ScoreNote[], bpm = 80): string {
  const secPerBar = spb(bpm) * SCORE_BEATS_PER_MEASURE;

  // Gom nốt theo từng ô nhịp
  const bars: ScoreNote[][] = [];
  for (const n of notes) {
    const bar = Math.floor((n.time + 1e-6) / secPerBar);
    (bars[bar] ||= []).push(n);
  }
  if (bars.length === 0) bars.push([]);

  const barStrs = bars.map(barNotes => {
    if (!barNotes || barNotes.length === 0) return 'r.1';   // ô trống = lặng tròn

    // Gom nốt cùng thời điểm thành hợp âm (chord)
    const groups: ScoreNote[][] = [];
    for (const n of barNotes) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last[0].time - n.time) < 1e-6) last.push(n);
      else groups.push([n]);
    }

    return groups.map(g => {
      const cls = classify(g[0].duration / spb(bpm));
      const dur = ALPHA_DUR[cls.base] ?? 4;
      const dot = cls.dotted ? ' {d}' : '';
      let body: string;
      if (g.length === 1) {
        const n = g[0];
        body = n.string < 0 ? `r.${dur}` : `${n.fret}.${6 - n.string}.${dur}`;
      } else {
        // Hợp âm: (fret.str fret.str).dur — bỏ dấu lặng nếu có nốt thật
        const noteStrs = g.filter(n => n.string >= 0).map(n => `${n.fret}.${6 - n.string}`);
        body = noteStrs.length > 0 ? `(${noteStrs.join(' ')}).${dur}` : `r.${dur}`;
      }
      return cls.triplet ? `${body} {tu 3}` : `${body}${dot}`;
    }).join(' ');
  });

  return `\\tempo ${bpm} \\ts ${SCORE_BEATS_PER_MEASURE} 4 .\n` + barStrs.join(' | ');
}
