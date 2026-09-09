import {
  meterGrouping,
  groupStarts,
  resolveGrouping,
  isIrregularMeter,
  allowedPartitions,
  partitionCode,
  meterCode,
  SUPPORTED_COMPOUND,
  SUPPORTED_IRREGULAR,
  SUPPORTED_SIMPLE,
} from "./meterGrouping.ts";
import type {
  BeatGrouping,
  GroupingSelection,
  GroupingSource,
  MeterProfile,
} from "./meterGrouping.ts";
import { ZERO, rational, sub, compare } from "./rational.ts";
import type { Rational } from "./rational.ts";
import type {
  Diagnostic,
  Meter,
  NormalizedMeasure,
  NormalizedScore,
} from "./model.ts";
export interface MeasureBeatMap {
  partId: string;
  measureId: string;
  measureNumber: string;
  meter: Meter | null;
  grouping?: BeatGrouping;
  /**
   * CHỈ có ở nhịp lẻ (5/8, 7/8) — nơi cách chia không suy được từ tử số.
   * Nhịp đơn và nhịp kép không có hai trường này, nên beat-map của chúng
   * giữ nguyên từng byte như các giai đoạn đã nghiệm thu.
   */
  groupingSource?: GroupingSource;
  groups?: readonly number[] | null;
  /**
   * Cảnh báo KHÔNG chặn: ô vẫn khắc bình thường và phách nhỏ vẫn chạy,
   * chỉ riêng phách lớn là chưa dùng được. Khác hẳn `diagnostics` (chặn cả ô).
   * Chỉ xuất hiện khi thật sự có cảnh báo.
   */
  notices?: Diagnostic[];
  actualDuration: Rational;
  expectedDuration: Rational | null;
  pickup: boolean;
  pickupOffset: Rational;
  beatsMap: { label: string; offset: Rational }[];
  diagnostics: Diagnostic[];
}
export function measureBeatMap(
  partId: string,
  m: NormalizedMeasure,
  profile: MeterProfile = "simple",
  selection?: GroupingSelection
): MeasureBeatMap {
  const out: MeasureBeatMap = {
    partId,
    measureId: m.source.id,
    measureNumber: m.number,
    meter: m.meter,
    actualDuration: m.actualDuration,
    expectedDuration: null,
    pickup: false,
    pickupOffset: ZERO,
    beatsMap: [],
    diagnostics: [...m.diagnostics],
  };
  const issue = (code: string, message: string) =>
    out.diagnostics.push({ code, sourceId: m.source.id, message });
  if (!m.meter) return out;
  out.expectedDuration = rational(
    BigInt(m.meter.beats) * 4n,
    BigInt(m.meter.beatType)
  );
  // Nhịp lẻ đi đường riêng: cách chia phải do nguồn khai báo hoặc người dùng chọn.
  const irregular =
    profile === "simple-and-compound" && isIrregularMeter(m.meter);
  const resolved = irregular
    ? resolveGrouping(m.meter, m.source.id, selection)
    : null;
  const grouping = resolved?.grouping ?? meterGrouping(m.meter, profile);
  if (!grouping && !irregular) {
    issue(
      "UNSUPPORTED_METER",
      profile === "simple"
        ? `Phase 1 supports only ${SUPPORTED_SIMPLE.join(", ")}`
        : `Supported meters: ${[...SUPPORTED_SIMPLE, ...SUPPORTED_COMPOUND, ...SUPPORTED_IRREGULAR].join(", ")}`
    );
    return out;
  }
  if (grouping && grouping.type !== "simple") out.grouping = grouping;
  if (resolved) {
    const notices: Diagnostic[] = [];
    out.groupingSource = resolved.source;
    out.groups = grouping?.type === "irregular" ? grouping.groups : null;
    if (resolved.rejected)
      notices.push({
        code: "INVALID_GROUPING",
        sourceId: m.source.id,
        message: `${partitionCode(resolved.rejected)} không phải cách chia hợp lệ của ${meterCode(m.meter)}.`,
      });
    if (!grouping)
      notices.push({
        code: "IRREGULAR_GROUPING_REQUIRED",
        sourceId: m.source.id,
        message: `${meterCode(m.meter)} requires an explicit grouping such as ${(allowedPartitions(m.meter) ?? [])
          .slice(0, 2)
          .map(partitionCode)
          .join(" or ")} for large-beat counting.`,
      });
    if (notices.length) out.notices = notices;
  }
  if (out.diagnostics.length) return out;
  const relation = compare(m.actualDuration, out.expectedDuration);
  if (relation > 0) {
    issue("OVERFULL_MEASURE", "Duration exceeds meter");
    return out;
  }
  if (relation < 0) {
    // implicit=yes suppresses measure numbering generally. Require initial, positive,
    // structurally short measure too; later implicit measures are not pickups.
    if (m.index === 0 && m.implicit && compare(m.actualDuration, ZERO) > 0) {
      out.pickup = true;
      out.pickupOffset = sub(out.expectedDuration, m.actualDuration);
    } else {
      issue(
        "UNDERFULL_MEASURE_UNCLASSIFIED",
        "Short measure is not a confirmed initial implicit pickup"
      );
      return out;
    }
  }
  // Chưa có cách chia → không có phách lớn cấu trúc. KHÔNG đoán bừa.
  if (!grouping) return out;
  for (const [i, start] of groupStarts(grouping).entries()) {
    const offset = sub(start, out.pickupOffset);
    if (compare(offset, ZERO) >= 0 && compare(offset, m.actualDuration) < 0)
      out.beatsMap.push({ label: String(i + 1), offset });
  }
  return out;
}
export function buildBeatMap(
  score: NormalizedScore,
  profile: MeterProfile = "simple",
  selection?: GroupingSelection
): MeasureBeatMap[] {
  return score.parts.flatMap((p) =>
    p.measures.map((m) => measureBeatMap(p.id, m, profile, selection))
  );
}
