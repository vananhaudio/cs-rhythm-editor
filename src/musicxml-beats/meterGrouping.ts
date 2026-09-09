import type { Meter } from "./model.ts";
import { add, rational, ZERO } from "./rational.ts";
import type { Rational } from "./rational.ts";
export type BeatGrouping =
  | { type: "simple"; unit: Rational; count: number }
  | { type: "compound"; unit: Rational; groups: readonly number[] }
  | { type: "irregular"; unit: Rational; groups: readonly number[] };
export type MeterProfile = "simple" | "simple-and-compound";
/** Ai đã quyết cách chia nhịp cho ô này. "unresolved" = chưa ai quyết, KHÔNG phải lỗi. */
export type GroupingSource = "musicxml" | "user" | "unresolved";
// Deliberate support registry. Meters outside it are NOT enabled implicitly by
// divisibility, beaming or note events.
const SIMPLE_BEATS: readonly number[] = [2, 3, 4];
const COMPOUND_BEATS: readonly number[] = [6, 9, 12];
/**
 * Nhịp lẻ: cách chia KHÔNG suy được từ tử số. 5 móc đơn có thể là 2+3 hoặc 3+2 —
 * hai bản nhạc khác nhau. Vì vậy registry liệt kê các cách chia HỢP LỆ, còn việc
 * chọn cách nào phải do nguồn khai báo (MusicXML) hoặc người dùng.
 */
const IRREGULAR_PARTITIONS: Readonly<Record<number, readonly (readonly number[])[]>> =
  {
    5: [
      [2, 3],
      [3, 2],
    ],
    7: [
      [2, 2, 3],
      [2, 3, 2],
      [3, 2, 2],
    ],
  };
/** Human-readable support lists; single source for diagnostics and UI copy. */
export const SUPPORTED_SIMPLE = SIMPLE_BEATS.map((b) => `${b}/4`);
export const SUPPORTED_COMPOUND = COMPOUND_BEATS.map((b) => `${b}/8`);
export const SUPPORTED_IRREGULAR = Object.keys(IRREGULAR_PARTITIONS).map(
  (b) => `${b}/8`
);
export const meterCode = (m: Meter) => `${m.beats}/${m.beatType}`;
export const partitionCode = (groups: readonly number[]) => groups.join("+");
/** Đơn vị móc đơn theo mẫu số của chính ô nhịp. */
const eighthUnit = (meter: Meter) => rational(4, meter.beatType);
export function isCompoundMeter(meter: Meter | null): boolean {
  return !!meter && meter.beatType === 8 && COMPOUND_BEATS.includes(meter.beats);
}
export function isIrregularMeter(meter: Meter | null): boolean {
  return !!meter && meter.beatType === 8 && meter.beats in IRREGULAR_PARTITIONS;
}
/** Nhịp mà một nhãn = một móc đơn: dùng chung cho mọi nhịp kép và nhịp lẻ đã bật. */
export function pulseMeter(
  meter: Meter | null
): { unit: Rational; count: number } | null {
  if (!isCompoundMeter(meter) && !isIrregularMeter(meter)) return null;
  return { unit: eighthUnit(meter!), count: meter!.beats };
}
/** Các cách chia được phép của một nhịp lẻ; null nếu không phải nhịp lẻ. */
export function allowedPartitions(
  meter: Meter | null
): readonly (readonly number[])[] | null {
  return isIrregularMeter(meter)
    ? IRREGULAR_PARTITIONS[meter!.beats]
    : null;
}
/**
 * Cách chia có dùng được cho ô nhịp này không. Kiểm bất biến chung trước
 * (mọi nhóm > 0, tổng đúng bằng số phách) rồi mới tới registry — phần bất biến
 * đã sẵn sàng cho additive meter tuỳ ý, phần registry giữ phạm vi Giai đoạn 8.
 */
export function isValidPartition(
  meter: Meter | null,
  groups: readonly number[] | null | undefined
): groups is readonly number[] {
  if (!meter || !groups || !groups.length) return false;
  if (!groups.every((g) => Number.isSafeInteger(g) && g > 0)) return false;
  if (groups.reduce((a, b) => a + b, 0) !== meter.beats) return false;
  const allowed = allowedPartitions(meter);
  return !!allowed && allowed.some((p) => partitionCode(p) === partitionCode(groups));
}
/**
 * One generic rule for every enabled compound meter: n eighths grouped in threes.
 * 6/8 → [3,3] · 9/8 → [3,3,3] · 12/8 → [3,3,3,3]. No per-meter branch downstream.
 */
function compoundGroupsFor(meter: Meter): readonly number[] | null {
  if (meter.beatType !== 8 || !COMPOUND_BEATS.includes(meter.beats)) return null;
  return Array<number>(meter.beats / 3).fill(3);
}
export function meterGrouping(
  meter: Meter | null,
  profile: MeterProfile = "simple-and-compound"
): BeatGrouping | null {
  if (!meter) return null;
  // Nhịp cộng (2+3, 2+2+3…) chỉ hợp lệ khi là nhịp lẻ đã bật; ngoài ra vẫn không hỗ trợ.
  if (meter.additive && !isValidPartition(meter, meter.additive)) return null;
  if (meter.beatType === 4 && !meter.additive && SIMPLE_BEATS.includes(meter.beats))
    return { type: "simple", unit: rational(1), count: meter.beats };
  const groups = compoundGroupsFor(meter);
  if (profile !== "simple-and-compound") return null;
  if (groups) return { type: "compound", unit: eighthUnit(meter), groups };
  // Nhịp lẻ: KHÔNG tự chọn cách chia ở đây. resolveGrouping() mới quyết.
  return null;
}
/** Cách chia do người dùng chọn: mặc định theo mã nhịp + đè theo từng ô nhịp. */
export interface GroupingSelection {
  /** ví dụ { "5/8": [2,3], "7/8": [2,2,3] } */
  byMeter?: Readonly<Record<string, readonly number[]>>;
  /** đè theo measureId — mô hình dữ liệu hỗ trợ mỗi ô một kiểu chia */
  byMeasure?: Readonly<Record<string, readonly number[]>>;
}
export interface ResolvedGrouping {
  grouping: BeatGrouping | null;
  source: GroupingSource;
  /** Cách chia bị bỏ vì không hợp lệ, để báo cho người dùng biết. */
  rejected: readonly number[] | null;
}
/**
 * Thứ tự ưu tiên, cố ý và không có đường đoán:
 *   1. người dùng đè riêng cho ô nhịp này  → "user"
 *   2. cách chia ghi rõ trong MusicXML     → "musicxml"
 *   3. mặc định người dùng chọn cho mã nhịp → "user"
 *   4. không có gì                          → "unresolved"
 * KHÔNG suy từ beam, note, dấu nhấn, dấu lặng, hợp âm hay số lượng nốt.
 */
export function resolveGrouping(
  meter: Meter | null,
  measureId: string,
  selection?: GroupingSelection
): ResolvedGrouping {
  const none: ResolvedGrouping = {
    grouping: null,
    source: "unresolved",
    rejected: null,
  };
  if (!isIrregularMeter(meter)) return none;
  const unit = eighthUnit(meter!);
  const make = (groups: readonly number[], source: GroupingSource) => ({
    grouping: { type: "irregular" as const, unit, groups: [...groups] },
    source,
    rejected: null,
  });
  let rejected: readonly number[] | null = null;
  const consider = (
    groups: readonly number[] | undefined,
    source: GroupingSource
  ) => {
    if (!groups) return null;
    if (isValidPartition(meter, groups)) return make(groups, source);
    rejected ??= groups;
    return null;
  };
  return (
    consider(selection?.byMeasure?.[measureId], "user") ??
    consider(meter!.additive ?? undefined, "musicxml") ??
    consider(selection?.byMeter?.[meterCode(meter!)], "user") ?? {
      ...none,
      rejected,
    }
  );
}
/** Structural beats, independent of teaching labels, beaming or note events. */
export function groupStarts(grouping: BeatGrouping): Rational[] {
  const groups =
    grouping.type === "simple"
      ? Array<number>(grouping.count).fill(1)
      : grouping.groups;
  return groupStartsOf(groups, grouping.unit);
}
/** Mốc đầu mỗi nhóm = cộng dồn đúng theo nhóm, không chia đều, không theo nốt. */
export function groupStartsOf(
  groups: readonly number[],
  unit: Rational
): Rational[] {
  let offset = ZERO;
  return groups.map((size) => {
    const start = offset;
    for (let i = 0; i < size; i++) offset = add(offset, unit);
    return start;
  });
}
