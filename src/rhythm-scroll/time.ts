import type { RhythmScrollMeter } from "./types.ts";
import { meterIssue } from "./validate.ts";

/**
 * Đổi thời gian đã trôi (giây) sang vị trí ô nhịp liên tục, cho consumer chỉ có đồng hồ giây.
 *
 * Quy ước BPM — giống transport của TeamLab: một nhịp BPM là MỘT đơn vị `beatType` của số chỉ nhịp.
 *   4/4, BPM 60 → 1 ô = 4 giây.   3/4, BPM 60 → 1 ô = 3 giây.
 *   6/8, BPM 60 → BPM đếm theo MÓC ĐƠN → 1 ô = 6 giây (không phải 2 nhịp chấm).
 *
 * Tempo không nằm trong RhythmScrollData: cùng một bài, mỗi nhóm tập một tốc độ.
 * Giây âm cho kết quả âm (đang đếm vào) — `locate` sẽ trả state "before".
 */
export function measuresAtSeconds(seconds: number, bpm: number, meter: RhythmScrollMeter): number {
  if (!Number.isFinite(seconds)) throw new RangeError("seconds phải là số hữu hạn.");
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError("bpm phải là số dương hữu hạn.");
  const issue = meterIssue(meter);
  if (issue) throw new RangeError(issue);
  return (seconds * bpm) / (60 * meter.beats);
}
