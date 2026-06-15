// Chuyển notes[] (model đơn âm của ScoreTabViewer) → chuỗi alphaTex để AlphaTab render.
// Quy ước dây của ta: 0 = Mi trầm (dây 6) … 5 = Mi cao (dây 1).
// alphaTab: dây 1 = Mi cao, dây 6 = Mi trầm  ⇒  alphaString = 6 - ourString.
import type { ScoreNote } from '../scoreData';
import { SCORE_BPM, SCORE_BEATS_PER_MEASURE } from '../scoreData';

const BASE_BEATS = [4, 2, 1, 0.5, 0.25];
const spb = () => 60 / SCORE_BPM;

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

export function notesToAlphaTex(notes: ScoreNote[]): string {
  const secPerBar = spb() * SCORE_BEATS_PER_MEASURE;

  // Gom nốt theo từng ô nhịp
  const bars: ScoreNote[][] = [];
  for (const n of notes) {
    const bar = Math.floor((n.time + 1e-6) / secPerBar);
    (bars[bar] ||= []).push(n);
  }
  if (bars.length === 0) bars.push([]);

  const barStrs = bars.map(barNotes => {
    if (!barNotes || barNotes.length === 0) return 'r.1';   // ô trống = lặng tròn
    return barNotes.map(n => {
      const cls   = classify(n.duration / spb());
      const dur   = ALPHA_DUR[cls.base] ?? 4;
      const dot   = cls.dotted ? ' {d}' : '';
      const body  = n.string < 0
        ? `r.${dur}`                                  // dấu lặng
        : `${n.fret}.${6 - n.string}.${dur}`;         // fret.dây.trường-độ
      return cls.triplet ? `${body} {tu 3}` : `${body}${dot}`;
    }).join(' ');
  });

  return `\\tempo ${SCORE_BPM} \\ts ${SCORE_BEATS_PER_MEASURE} 4 .\n` + barStrs.join(' | ');
}
