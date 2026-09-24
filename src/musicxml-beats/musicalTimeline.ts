import { createAnnotations } from "./annotations.ts";
import type { BeatMapDocument } from "./beatMap.ts";
import { groupStarts, groupStartsOf, meterGrouping, pulseMeter } from "./meterGrouping.ts";
import type { Meter, NormalizedScore } from "./model.ts";
import { compilePlaybackSequence } from "./navigation.ts";
import type { PlaybackSequence } from "./navigation.ts";
import { add, compare, sub, ZERO } from "./rational.ts";
import type { Rational } from "./rational.ts";

export interface MusicalGridPoint {
  label: string;
  /** Exact offset from this written measure's first performed instant. */
  offset: Rational;
}

export interface TimelineOccurrence {
  playbackIndex: number;
  writtenMeasureIndex: number;
  writtenMeasureId: string;
  writtenMeasureNumber: string;
  meter: Meter;
  actualDuration: Rational;
  pickup: boolean;
  pickupOffset: Rational;
  beatPositions: readonly MusicalGridPoint[];
  subdivisionPositions: readonly MusicalGridPoint[];
  /** 6/8 has eighth-note pulses, but no finer subdivisions from the engine yet. */
  subdivisionCoverage: "sixteenths" | "pulse-only";
  startQuarter: Rational;
  endQuarter: Rational;
}

export interface TimelinePosition {
  performanceQuarter: Rational;
  playbackIndex: number;
  writtenMeasureIndex: number;
  writtenMeasureId: string;
  writtenMeasureNumber: string;
  offset: Rational;
  beat: number;
  subdivision: string | null;
}

export interface MusicalTimeline {
  readonly occurrences: readonly TimelineOccurrence[];
  readonly totalQuarter: Rational;
  /** Half-open axis: the end position returns null. */
  positionAt(performanceQuarter: Rational): TimelinePosition | null;
  /** Half-open offset within one playback occurrence. */
  positionOf(playbackIndex: number, offset: Rational): TimelinePosition;
}

export type MusicalTimelineResult =
  | { status: "ready"; timeline: MusicalTimeline; diagnostics: readonly [] }
  | { status: "navigation-fallback" | "invalid"; timeline: null; diagnostics: readonly { code: string; message: string }[] };

function lastAtOrBefore(points: readonly MusicalGridPoint[], offset: Rational): MusicalGridPoint | null {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(points[mid].offset, offset) <= 0) low = mid + 1;
    else high = mid;
  }
  return points[low - 1] ?? null;
}

function beatAt(occurrence: TimelineOccurrence, offset: Rational): number {
  const pulse = pulseMeter(occurrence.meter);
  const starts = pulse
    ? groupStartsOf(Array(pulse.count).fill(1), pulse.unit)
    : groupStarts(meterGrouping(occurrence.meter)!);
  const phase = add(offset, occurrence.pickupOffset);
  let beat = 1;
  for (const [index, start] of starts.entries()) {
    if (compare(start, phase) > 0) break;
    beat = index + 1;
  }
  return beat;
}

/** Pure MusicXML performance axis. No Team timing, DOM, transport or seconds. */
export function createMusicalTimeline(
  score: NormalizedScore,
  beatMap: BeatMapDocument,
  sequence: PlaybackSequence = compilePlaybackSequence(score),
): MusicalTimelineResult {
  if (sequence.status !== "compiled" || sequence.diagnostics.length) return {
    status: "navigation-fallback", timeline: null,
    diagnostics: sequence.diagnostics.map(({ code, message }) => ({ code, message })),
  };
  const invalid = (code: string, message: string): MusicalTimelineResult => ({
    status: "invalid", timeline: null, diagnostics: [{ code, message }],
  });
  if (beatMap.timeUnit !== "quarter-note" || score.diagnostics.length || !score.parts.length) {
    return invalid("TIMELINE_SOURCE", "Score hoặc BeatMap không có trục quarter-note an toàn.");
  }
  const reference = score.parts[0];
  const count = reference.measures.length;
  if (!count || sequence.occurrences.length === 0 ||
      beatMap.measures.length !== score.parts.length * count ||
      score.parts.some((part) => part.measures.length !== count)) {
    return invalid("TIMELINE_PARTS", "Score, BeatMap và route không cùng tập ô nhịp.");
  }
  const mapsByPart = score.parts.map((part) => beatMap.measures.filter((map) => map.partId === part.id));
  if (mapsByPart.some((maps) => maps.length !== count)) {
    return invalid("TIMELINE_PARTS", "BeatMap thiếu part hoặc ô nhịp.");
  }
  for (const [partIndex, part] of score.parts.entries()) for (let index = 0; index < count; index++) {
    const measure = part.measures[index];
    const map = mapsByPart[partIndex][index];
    const first = mapsByPart[0][index];
    if (measure.diagnostics.length || map.diagnostics.length || !map.meter ||
        compare(map.actualDuration, ZERO) <= 0 ||
        map.measureId !== measure.source.id || map.measureNumber !== measure.number ||
        compare(map.actualDuration, measure.actualDuration) !== 0 ||
        !meterGrouping(map.meter) || (!map.pickup && !map.beatsMap.length)) {
      return invalid("TIMELINE_MEASURE", `Ô nhịp ${index + 1} không có BeatMap tương thích.`);
    }
    if (map.measureNumber !== first.measureNumber ||
        JSON.stringify(map.meter) !== JSON.stringify(first.meter) ||
        compare(map.actualDuration, first.actualDuration) !== 0 ||
        map.pickup !== first.pickup || compare(map.pickupOffset, first.pickupOffset) !== 0 ||
        JSON.stringify(map.beatsMap) !== JSON.stringify(first.beatsMap)) {
      return invalid("TIMELINE_PARTS", `Các part khác musical grid tại ô ${index + 1}.`);
    }
  }

  const firstPartId = reference.id;
  const annotations = createAnnotations(beatMap, "sixteenths", "pulses")
    .filter((point) => point.partId === firstPartId);
  const grids = mapsByPart[0].map((map) => {
    const points = annotations.filter((point) => point.sourceMeasureId === map.measureId);
    const pulse = pulseMeter(map.meter);
    return {
      beatPositions: pulse
        ? points.map(({ label, offset }) => ({ label, offset }))
        : map.beatsMap.map(({ label, offset }) => ({ label, offset })),
      subdivisionPositions: pulse ? [] : points.filter((point) => point.kind === "subbeat")
        .map(({ label, offset }) => ({ label, offset })),
      subdivisionCoverage: pulse ? "pulse-only" as const : "sixteenths" as const,
    };
  });

  let startQuarter: Rational = ZERO;
  const occurrences: TimelineOccurrence[] = [];
  for (const [playbackIndex, route] of sequence.occurrences.entries()) {
    const index = route.writtenMeasureIndex;
    const map = mapsByPart[0][index];
    if (!map || route.playbackIndex !== playbackIndex ||
        route.writtenMeasureNumber !== map.measureNumber ||
        JSON.stringify(route.sourceMeasureIds) !== JSON.stringify(score.parts.map((part) => part.measures[index].source.id))) {
      return invalid("TIMELINE_ROUTE", "Playback sequence không khớp written measure identity.");
    }
    const endQuarter = add(startQuarter, map.actualDuration);
    occurrences.push({
      playbackIndex, writtenMeasureIndex: index, writtenMeasureId: map.measureId,
      writtenMeasureNumber: map.measureNumber, meter: map.meter!,
      actualDuration: map.actualDuration, pickup: map.pickup, pickupOffset: map.pickupOffset,
      ...grids[index], startQuarter, endQuarter,
    });
    startQuarter = endQuarter;
  }

  function positionOf(playbackIndex: number, offset: Rational): TimelinePosition {
    const item = occurrences[playbackIndex];
    if (!item || !Number.isSafeInteger(playbackIndex) ||
        compare(offset, ZERO) < 0 || compare(offset, item.actualDuration) >= 0) {
      throw new RangeError("Vị trí ngoài playback occurrence.");
    }
    const beatPoint = lastAtOrBefore(item.beatPositions, offset);
    const subPoint = lastAtOrBefore(item.subdivisionPositions, offset);
    return {
      performanceQuarter: add(item.startQuarter, offset),
      playbackIndex, writtenMeasureIndex: item.writtenMeasureIndex,
      writtenMeasureId: item.writtenMeasureId, writtenMeasureNumber: item.writtenMeasureNumber,
      offset, beat: beatPoint ? Number(beatPoint.label) : beatAt(item, offset),
      subdivision: subPoint && (!beatPoint || compare(subPoint.offset, beatPoint.offset) > 0)
        ? subPoint.label : null,
    };
  }

  return { status: "ready", diagnostics: [], timeline: {
    occurrences, totalQuarter: startQuarter, positionOf,
    positionAt(performanceQuarter: Rational): TimelinePosition | null {
      if (compare(performanceQuarter, ZERO) < 0 || compare(performanceQuarter, startQuarter) >= 0) return null;
      let low = 0;
      let high = occurrences.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (compare(occurrences[mid].startQuarter, performanceQuarter) <= 0) low = mid + 1;
        else high = mid;
      }
      const item = occurrences[low - 1];
      return positionOf(item.playbackIndex, sub(performanceQuarter, item.startQuarter));
    },
  } };
}
