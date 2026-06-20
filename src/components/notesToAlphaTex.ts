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

export interface RepeatInfo {
  opens?: Set<number>;            // chỉ số ô nhịp (0-based) có dấu mở lặp ‖:
  closes?: Map<number, number>;   // ô nhịp → số lần lặp (dấu đóng :‖)
}

// fret.string của 1 nốt; dấu nối (tie) → '-' thay số phím (nối nốt cùng dây trước đó)
function noteToken(n: ScoreNote): string {
  return `${n.tie ? '-' : n.fret}.${6 - n.string}`;
}

export function notesToAlphaTex(notes: ScoreNote[], bpm = 80, keySig = 'c', repeats: RepeatInfo = {}): string {
  const secPerBar = spb(bpm) * SCORE_BEATS_PER_MEASURE;

  // Gom nốt theo từng ô nhịp
  const bars: ScoreNote[][] = [];
  for (const n of notes) {
    const bar = Math.floor((n.time + 1e-6) / secPerBar);
    (bars[bar] ||= []).push(n);
  }
  if (bars.length === 0) bars.push([]);

  const barStrs = bars.map((barNotes, bi) => {
    // Dấu lặp ở cấp ô nhịp: \ro mở, \rc N đóng (lặp N lần) — đặt đầu nội dung ô nhịp
    const ro = repeats.opens?.has(bi) ? '\\ro ' : '';
    const rc = repeats.closes?.has(bi) ? `\\rc ${repeats.closes.get(bi)} ` : '';
    const pre = ro + rc;

    if (!barNotes || barNotes.length === 0) return `${pre}r.1`;   // ô trống = lặng tròn

    // Gom nốt cùng thời điểm thành hợp âm (chord)
    const groups: ScoreNote[][] = [];
    for (const n of barNotes) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last[0].time - n.time) < 1e-6) last.push(n);
      else groups.push([n]);
    }

    const content = groups.map(g => {
      const cls = classify(g[0].duration / spb(bpm));
      const dur = ALPHA_DUR[cls.base] ?? 4;
      let body: string;
      if (g.length === 1) {
        const n = g[0];
        body = n.string < 0 ? `r.${dur}` : `${noteToken(n)}.${dur}`;
      } else {
        // Hợp âm: (fret.str fret.str).dur — bỏ dấu lặng nếu có nốt thật
        const real = g.filter(n => n.string >= 0);
        body = real.length > 0 ? `(${real.map(noteToken).join(' ')}).${dur}` : `r.${dur}`;
      }
      // Hiệu ứng cấp phách: chấm dôi {d}, liên 3 {tu 3}, luyến/hammer-pull {h}
      const fx: string[] = [];
      if (cls.dotted)  fx.push('d');
      if (cls.triplet) fx.push('tu 3');
      if (g.some(n => n.hopo)) fx.push('h');
      return fx.length ? `${body} {${fx.join(' ')}}` : body;
    }).join(' ');

    return pre + content;
  });

  return `\\ks ${keySig} \\tempo ${bpm} \\ts ${SCORE_BEATS_PER_MEASURE} 4 .\n` + barStrs.join(' | ');
}
