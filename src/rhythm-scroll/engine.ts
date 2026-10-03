import type { RhythmScroll, RhythmScrollPosition } from "./types.ts";
import { validateRhythmScrollData } from "./validate.ts";

/**
 * Dựng engine từ dữ liệu đã lưu. Dữ liệu sai → ném lỗi ngay ở đây, không để `locate` trả vị trí bịa.
 *
 * Engine thuần: không timer, không requestAnimationFrame, không play/pause, không giữ BPM.
 * Consumer có transport riêng thì đưa thẳng vị trí ô nhịp vào `locate`; chỉ có giây thì đổi bằng
 * `measuresAtSeconds`.
 */
export function createRhythmScroll(data: unknown): RhythmScroll {
  const checked = validateRhythmScrollData(data);
  if (!checked.ok) {
    throw new RangeError(`RhythmScrollData không hợp lệ: ${checked.issues.map(issue => `${issue.path || "(gốc)"}: ${issue.message}`).join(" ")}`);
  }
  const counts = checked.data.segments.map(segment => segment.measureCount);
  const totalMeasures = checked.data.totalMeasures;
  // starts[i] = ô đầu của segment i; chép số ra để dữ liệu gốc bị sửa sau này không làm lệch engine.
  const starts: number[] = [];
  let next = 0;
  for (const count of counts) { starts.push(next); next += count; }
  const last = counts.length - 1;

  return {
    totalMeasures,
    locate(measurePosition: number): RhythmScrollPosition {
      if (typeof measurePosition !== "number" || Number.isNaN(measurePosition)) {
        throw new RangeError("measurePosition phải là một số.");
      }
      if (measurePosition < 0) {
        return { state: "before", measureIndex: 0, measureProgress: 0, segmentIndex: 0, segmentProgress: 0, scrollProgress: 0 };
      }
      if (measurePosition >= totalMeasures) {
        return { state: "ended", measureIndex: totalMeasures - 1, measureProgress: 1, segmentIndex: last, segmentProgress: 1, scrollProgress: 1 };
      }
      const measureIndex = Math.floor(measurePosition);
      // Segment cuối cùng có ô đầu ≤ ô hiện tại (tìm nhị phân).
      let low = 0;
      let high = last;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (starts[middle] <= measureIndex) low = middle;
        else high = middle - 1;
      }
      return {
        state: "active",
        measureIndex,
        measureProgress: measurePosition - measureIndex,
        segmentIndex: low,
        segmentProgress: (measurePosition - starts[low]) / counts[low],
        scrollProgress: measurePosition / totalMeasures,
      };
    },
  };
}
