import type { Meter } from "./model.ts";
import { add, rational, ZERO } from "./rational.ts";
import type { Rational } from "./rational.ts";
export type BeatGrouping =
  | { type: "simple"; unit: Rational; count: number }
  | { type: "compound"; unit: Rational; groups: readonly number[] };
export type MeterProfile = "simple" | "simple-and-compound";
// Deliberate support registry. Meters outside it — 5/8, 7/8, additive and irregular
// groupings — are NOT enabled implicitly by divisibility, beaming or note events.
const SIMPLE_BEATS: readonly number[] = [2, 3, 4];
const COMPOUND_BEATS: readonly number[] = [6, 9, 12];
/** Human-readable support list; single source for diagnostics and UI copy. */
export const SUPPORTED_SIMPLE = SIMPLE_BEATS.map((b) => `${b}/4`);
export const SUPPORTED_COMPOUND = COMPOUND_BEATS.map((b) => `${b}/8`);
/**
 * One generic rule for every enabled compound meter: n eighths grouped in threes.
 * 6/8 → [3,3] · 9/8 → [3,3,3] · 12/8 → [3,3,3,3]. No per-meter branch anywhere downstream.
 */
function compoundGroupsFor(meter: Meter): readonly number[] | null {
  if (meter.beatType !== 8 || !COMPOUND_BEATS.includes(meter.beats))
    return null;
  return Array<number>(meter.beats / 3).fill(3);
}
export function meterGrouping(
  meter: Meter | null,
  profile: MeterProfile = "simple-and-compound"
): BeatGrouping | null {
  if (!meter) return null;
  if (meter.beatType === 4 && SIMPLE_BEATS.includes(meter.beats))
    return { type: "simple", unit: rational(1), count: meter.beats };
  const groups = compoundGroupsFor(meter);
  return profile === "simple-and-compound" && groups
    ? {
        type: "compound",
        unit: rational(4, meter.beatType),
        groups,
      }
    : null;
}
/** Structural beats, independent of teaching labels, beaming or note events. */
export function groupStarts(grouping: BeatGrouping): Rational[] {
  const groups =
    grouping.type === "compound"
      ? grouping.groups
      : Array<number>(grouping.count).fill(1);
  let offset = ZERO;
  return groups.map((size) => {
    const start = offset;
    for (let i = 0; i < size; i++) offset = add(offset, grouping.unit);
    return start;
  });
}
