import {
  meterGrouping,
  groupStarts,
  SUPPORTED_COMPOUND,
  SUPPORTED_SIMPLE,
} from "./meterGrouping.ts";
import type { BeatGrouping, MeterProfile } from "./meterGrouping.ts";
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
  profile: MeterProfile = "simple"
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
  const grouping = meterGrouping(m.meter, profile);
  if (!grouping) {
    issue(
      "UNSUPPORTED_METER",
      profile === "simple"
        ? `Phase 1 supports only ${SUPPORTED_SIMPLE.join(", ")}`
        : `Supported meters: ${[...SUPPORTED_SIMPLE, ...SUPPORTED_COMPOUND].join(", ")}`
    );
    return out;
  }
  if (grouping.type === "compound") out.grouping = grouping;
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
  for (const [i, start] of groupStarts(grouping).entries()) {
    const offset = sub(start, out.pickupOffset);
    if (compare(offset, ZERO) >= 0 && compare(offset, m.actualDuration) < 0)
      out.beatsMap.push({ label: String(i + 1), offset });
  }
  return out;
}
export function buildBeatMap(
  score: NormalizedScore,
  profile: MeterProfile = "simple"
): MeasureBeatMap[] {
  return score.parts.flatMap((p) =>
    p.measures.map((m) => measureBeatMap(p.id, m, profile))
  );
}
