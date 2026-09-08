import { createAnnotations } from "../annotations.ts";
import { add, div, rational } from "../rational.ts";
import type { Rational } from "../rational.ts";
import type { BeatMapDocument } from "../beatMap.ts";
import type { Diagnostic } from "../model.ts";
import type { ScoreSettings, TemporalAnchor } from "./types.ts";
import { all, direct, id, MEI, parse, serialize, XML } from "./xml.ts";
function timestamp(value: Rational): string {
  let [n, d] = value.split("/").map(BigInt);
  let residual = d;
  while (residual % 2n === 0n) residual /= 2n;
  while (residual % 5n === 0n) residual /= 5n;
  if (residual !== 1n) throw new Error("NON_TERMINATING_TIMESTAMP");
  const integer = n / d;
  n %= d;
  let tail = "";
  while (n) {
    n *= 10n;
    tail += String(n / d);
    n %= d;
  }
  return `${integer}${tail ? "." + tail : ""}`;
}
export function applyTemporalAnnotations(
  mei: string,
  map: BeatMapDocument,
  settings: ScoreSettings
) {
  const doc = parse(mei),
    measures = all(doc, "measure");
  const diagnostics: Diagnostic[] = map.measures.flatMap((m) => m.diagnostics);
  const anchors: TemporalAnchor[] = [];
  const issue = (sourceId: string, code: string, message: string) =>
    diagnostics.push({ sourceId, code, message });
  // Verovio merges simultaneous parts into one MEI measure. Explicitly avoid a guessed mapping.
  if (new Set(map.measures.map((m) => m.partId)).size !== 1) {
    issue(
      "score",
      "MULTIPART_ANNOTATION_NOT_SUPPORTED",
      "MVP chưa gắn số cho bản nhiều part; bản nhạc gốc vẫn được hiển thị."
    );
    return { mei, anchors, diagnostics };
  }
  if (measures.length !== map.measures.length) {
    issue(
      "score",
      "MEASURE_MAPPING_MISMATCH",
      "Không khớp ô nhịp giữa MusicXML và MEI; giữ bản nhạc, bỏ số phách."
    );
    return { mei, anchors, diagnostics };
  }
  const annotations = createAnnotations(
    map,
    settings.countingLevel,
    settings.compoundCountingMode
  );
  if (settings.showBeats)
    for (const def of all(doc, "staffDef"))
      def.setAttribute("dir.dist", String(4 + settings.distance));
  if (settings.showBeats)
    measures.forEach((m, mi) => {
      const bm = map.measures[mi];
      if (bm.diagnostics.length) return;
      if (m.getAttribute("n") !== bm.measureNumber) {
        issue(
          bm.measureId,
          "MEASURE_MAPPING_MISMATCH",
          "Số ô trong MEI không khớp nguồn."
        );
        return;
      }
      const staves = direct(m, "staff");
      if (!staves.length) {
        issue(
          bm.measureId,
          "TEMPORAL_ANCHOR_NOT_RESOLVED",
          "Không tìm thấy staff."
        );
        return;
      }
      for (const staff of staves)
        for (const a of annotations.filter(
          (a) => a.sourceMeasureId === bm.measureId
        )) {
          let stamp: string;
          try {
            // MEI tstamp counts denominator units, NOT quarter-note units.
            if (!bm.meter) throw new Error("MISSING_METER");
            stamp = timestamp(
              add(div(a.offset, rational(4, bm.meter.beatType)), rational(1))
            );
          } catch {
            issue(
              a.sourceMeasureId,
              "TEMPORAL_ANCHOR_NOT_RESOLVED",
              `Phách ${a.label}: timestamp không biểu diễn chính xác trong MEI.`
            );
            continue;
          }
          const staffNumber = staff.getAttribute("n") || "1";
          const anchor: TemporalAnchor = {
            ...a,
            id: `${a.id}-s${staffNumber}`,
            measureId: id(m),
            staff: staffNumber,
            timestamp: stamp,
          };
          const dir = doc.createElementNS(MEI, "dir");
          dir.setAttributeNS(XML, "xml:id", anchor.id);
          for (const [k, v] of Object.entries({
            staff: staffNumber,
            tstamp: stamp,
            place: "below",
            vgrp: String(900 + Number(staffNumber)),
            color: settings.color,
          }))
            dir.setAttribute(k, v);
          const rend = doc.createElementNS(MEI, "rend");
          rend.setAttribute("fontsize", `${settings.sizePt}pt`);
          rend.setAttribute("fontweight", "bold");
          rend.setAttribute("fontstyle", "normal");
          rend.appendChild(doc.createTextNode(a.label));
          dir.appendChild(rend);
          m.appendChild(dir);
          anchors.push(anchor);
        }
    });
  return { mei: serialize(doc), anchors, diagnostics };
}
