import { createAnnotations } from "../annotations.ts";
import type { ScoreAnnotation } from "../annotations.ts";
import type { BeatMapDocument } from "../beatMap.ts";
import type { Diagnostic } from "../model.ts";
import type { ScoreSettings, TemporalAnchor } from "./types.ts";
import { anchorKey, stampOf } from "./anchorLattice.ts";
import type { Lattice } from "./anchorLattice.ts";

/**
 * Pass 2 — neo thời gian. Vẫn là Strategy A: mỗi nhãn có một tstamp CHÍNH XÁC,
 * tính từ beat-map, không suy từ nốt gần nhất và không nội suy.
 */
export function resolveLabels(
  map: BeatMapDocument,
  settings: ScoreSettings,
  lattice: Lattice
): { labels: TemporalAnchor[]; diagnostics: Diagnostic[] } {
  const labels: TemporalAnchor[] = [];
  const diagnostics: Diagnostic[] = [];
  if (!settings.showBeats || !lattice.annotatable)
    return { labels, diagnostics };
  const annotations: ScoreAnnotation[] = createAnnotations(
    map,
    settings.countingLevel,
    settings.compoundCountingMode
  );
  map.measures.forEach((bm, mi) => {
    if (bm.diagnostics.length) return;
    const staffNumbers = lattice.staves.get(mi);
    if (!staffNumbers) return;
    for (const a of annotations.filter((x) => x.sourceMeasureId === bm.measureId))
      for (const staff of staffNumbers) {
        let stamp: string;
        try {
          if (!bm.meter) throw new Error("MISSING_METER");
          stamp = stampOf(a.offset, bm.meter.beatType);
        } catch {
          diagnostics.push({
            sourceId: a.sourceMeasureId,
            code: "TEMPORAL_ANCHOR_NOT_RESOLVED",
            message: `Phách ${a.label}: timestamp không biểu diễn chính xác trong MEI.`,
          });
          continue;
        }
        const anchorId = lattice.byKey.get(anchorKey(mi, staff, stamp));
        if (!anchorId) {
          diagnostics.push({
            sourceId: a.sourceMeasureId,
            code: "TEMPORAL_ANCHOR_NOT_RESOLVED",
            message: `Phách ${a.label}, staff ${staff}: không có neo thời gian tương ứng; đã bỏ nhãn.`,
          });
          continue;
        }
        labels.push({
          ...a,
          id: `${a.id}-s${staff}`,
          measureId: lattice.measureIds.get(mi) ?? "",
          anchorId,
          staff,
          timestamp: stamp,
        });
      }
  });
  return { labels, diagnostics };
}
