// ============================================================
// Song Builder V1 — Tap Tempo fit
// Trục chuẩn = lưới beat đều (single global grid).
// Tap chỉ là số đo; sự thật là lưới sau khi fit.
//   1 tap = 1 beat. 1 beat = 480 tick. tick = beatIndex * 480.
// ============================================================

export const TICKS_PER_BEAT = 480;

export interface TempoFit {
  ok: boolean;
  reason?: "need_more_taps";
  fitted: boolean;        // true = đã hồi quy; false = fallback (ít tap)
  bpm: number;
  beatDuration: number;   // giây/beat
  gridOffset: number;     // giây của beatIndex 0 (≈ youtubeOffset)
  validTaps: number;
  rejected: number;       // số interval bị loại (>tol, coi như nghỉ tap)
  avgError: number;       // sai số trung bình tap↔lưới (giây)
  maxError: number;
  assign: { t: number; n: number }[]; // mỗi tap → beatIndex đã gán
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function linreg(xs: number[], ys: number[]) {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const b = den === 0 ? 0 : num / den;
  return { a: my - b * mx, b };
}

/**
 * Fit lưới beat đều từ danh sách thời điểm tap (giây).
 * @param tapTimes  giây của mỗi cú tap (so với gốc bất kỳ; thường so với lúc bắt đầu)
 * @param tol       ngưỡng lệch interval (mặc định 0.10 = 10%)
 */
export function fitTempo(tapTimes: number[], tol = 0.10): TempoFit {
  const taps = [...tapTimes].sort((a, b) => a - b);
  if (taps.length < 2) return blank("need_more_taps", taps.length);

  // 1. intervals giữa các tap liên tiếp
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);

  // 2. mồi beatDuration = trung vị toàn bộ interval (chịu nhiễu, không dùng mean)
  let beatDur = median(intervals);
  if (beatDur <= 0) return blank("need_more_taps", taps.length);

  // 3. lọc interval lệch > tol (interval bắc qua khoảng nghỉ bị loại) → tinh chỉnh beatDur
  const validIv = intervals.filter((iv) => Math.abs(iv - beatDur) / beatDur <= tol);
  const rejected = intervals.length - validIv.length;
  if (validIv.length) beatDur = median(validIv);

  // 4. gán mỗi tap một beatIndex nguyên (cho phép nhảy 2,3 khi bỏ nhịp)
  const t0 = taps[0];
  let assign = taps.map((t) => ({ t, n: Math.round((t - t0) / beatDur) }));
  let gridOffset = t0;

  // 5. hồi quy tuyến tính + fit lặp (khử lệch beatIndex tích lũy ở bài dài)
  let fitted = false;
  if (taps.length >= 4) {
    for (let iter = 0; iter < 3; iter++) {
      const reg = linreg(assign.map((a) => a.n), assign.map((a) => a.t)); // t ≈ a + b·n
      if (reg.b <= 0) break;
      beatDur = reg.b;
      gridOffset = reg.a;
      assign = taps.map((t) => ({ t, n: Math.round((t - gridOffset) / beatDur) }));
      fitted = true;
    }
  }
  // (taps < 4) → fallback: giữ beatDur trung vị + gridOffset = tap đầu

  const errs = assign.map((a) => Math.abs(a.t - (gridOffset + a.n * beatDur)));
  return {
    ok: true, fitted, bpm: 60 / beatDur, beatDuration: beatDur, gridOffset,
    validTaps: taps.length, rejected, avgError: mean(errs), maxError: Math.max(0, ...errs), assign,
  };
}

function blank(reason: TempoFit["reason"], validTaps: number): TempoFit {
  return { ok: false, reason, fitted: false, bpm: 0, beatDuration: 0, gridOffset: 0, validTaps, rejected: 0, avgError: 0, maxError: 0, assign: [] };
}

// ── Tiện ích lưới ──────────────────────────────────────────
/** Thời gian (giây) của một beatIndex trên lưới chuẩn. */
export const beatToTime = (beatIndex: number, fit: TempoFit) => fit.gridOffset + beatIndex * fit.beatDuration;
/** Snap một thời điểm (giây) về beatIndex gần nhất. */
export const timeToBeat = (time: number, fit: TempoFit) => Math.round((time - fit.gridOffset) / fit.beatDuration);
/** beatIndex (có thể lẻ) → tick. */
export const beatToTick = (beat: number) => Math.round(beat * TICKS_PER_BEAT);
