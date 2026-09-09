import { groupStartsOf, pulseMeter } from "./meterGrouping.ts";
import type { BeatMapDocument } from "./beatMap.ts";
import { add, compare, rational, sub, ZERO } from "./rational.ts";
import type { Rational } from "./rational.ts";
export type CompoundCountingMode = "pulses" | "compound";
export type CountingLevel = "beats" | "eighths" | "sixteenths";
export interface ScoreAnnotation {
  id: string;
  kind: "beat" | "subbeat";
  partId: string;
  sourceMeasureId: string;
  label: string;
  /** Quarter-note units, relative to the actual fragment (not the full bar). */
  offset: Rational;
}
/** Exact meter grid; deliberately has no access to notes, voices, ties or divisions. */
export function createAnnotations(
  map: BeatMapDocument,
  level: CountingLevel = "beats",
  compoundMode: CompoundCountingMode = "pulses"
): ScoreAnnotation[] {
  if (!["beats", "eighths", "sixteenths"].includes(level))
    throw new Error("Cấp độ đếm không hợp lệ.");
  if (!["pulses", "compound"].includes(compoundMode))
    throw new Error("Cách đếm compound không hợp lệ.");
  return map.measures.flatMap((m, mi) => {
    if (m.diagnostics.length) return [];
    const values: {
      kind: "beat" | "subbeat";
      label: string;
      offset: Rational;
    }[] = [];
    // MỘT đường chung cho mọi nhịp mà một nhãn = một móc đơn, cả nhịp kép lẫn nhịp lẻ.
    // Phách nhỏ chỉ cần (số phách, đơn vị) nên chạy được cả khi chưa biết cách chia;
    // phách lớn bắt buộc phải có cách chia, không có thì KHÔNG hiện nhãn nào.
    const pulse = pulseMeter(m.meter);
    if (pulse) {
      const g = m.grouping;
      const groups = g && g.type !== "simple" ? g.groups : null;
      const starts = groups ? groupStartsOf(groups, pulse.unit) : [];
      let points: Rational[];
      if (compoundMode === "compound") {
        if (!groups) return [];
        points = starts;
      } else {
        points = [];
        let position = ZERO;
        for (let i = 0; i < pulse.count; i++) {
          points.push(position);
          position = add(position, pulse.unit);
        }
      }
      points.forEach((position, index) => {
        const offset = sub(position, m.pickup ? m.pickupOffset : ZERO);
        if (compare(offset, ZERO) >= 0 && compare(offset, m.actualDuration) < 0)
          values.push({
            kind: starts.length
              ? starts.includes(position)
                ? "beat"
                : "subbeat"
              : compare(position, ZERO) === 0
              ? "beat"
              : "subbeat",
            label: String(index + 1),
            offset,
          });
      });
    } else if (level === "beats") {
      // Preserve the approved Beat Engine output and IDs exactly for Level 1.
      values.push(...m.beatsMap.map((b) => ({ ...b, kind: "beat" as const })));
    } else {
      if (
        !m.meter ||
        m.meter.beatType !== 4 ||
        ![2, 3, 4].includes(m.meter.beats)
      )
        return [];
      const slots = level === "eighths" ? 2n : 4n;
      const phase = m.pickup ? m.pickupOffset : ZERO;
      for (let beat = 0n; beat < BigInt(m.meter.beats); beat++) {
        for (let slot = 0n; slot < slots; slot++) {
          const offset = sub(add(rational(beat), rational(slot, slots)), phase);
          if (
            compare(offset, ZERO) < 0 ||
            compare(offset, m.actualDuration) >= 0
          )
            continue;
          values.push({
            kind: slot === 0n ? "beat" : "subbeat",
            label:
              slot === 0n
                ? String(beat + 1n)
                : slots === 2n || slot === 2n
                ? "&"
                : slot === 1n
                ? "e"
                : "a",
            offset,
          });
        }
      }
    }
    return values.map((value, index) => ({
      ...value,
      id: `tva-beat-${mi + 1}-${index + 1}`,
      partId: m.partId,
      sourceMeasureId: m.measureId,
    }));
  });
}
