import { add, rational } from "../rational.ts";
import type { Rational } from "../rational.ts";
import type { BeatMapDocument } from "../beatMap.ts";
import { all, direct, id, MEI, parse, serialize, XML } from "./xml.ts";
export interface BeatAnchor {
  id: string;
  sourceMeasureId: string;
  measureId: string;
  measureIndex: number;
  label: string;
  offset: Rational;
  timestamp: string;
  staff: string;
}
export interface AnnotationOptions {
  color: string;
  sizePt: number;
}
export const DEFAULT_ANNOTATION: AnnotationOptions = {
  color: "#dc2626",
  sizePt: 7,
};
function exactTimestamp(value: Rational): string {
  // MVP stamps are integers or halves; never silently round a nonterminating fraction.
  const [n, d] = value.split("/").map(BigInt);
  if (d === 1n) return String(n);
  if (d === 2n) return `${n / 2n}.5`;
  throw new Error(`UNREPRESENTABLE_MEI_TIMESTAMP: ${value}`);
}
/** One-part, one-staff proof-of-concept. Fail explicitly before unsupported mapping. */
export function annotateMEI(
  mei: string,
  map: BeatMapDocument,
  options = DEFAULT_ANNOTATION
) {
  const doc = parse(mei),
    measures = all(doc, "measure"),
    staffDefs = all(doc, "staffDef");
  if (
    new Set(map.measures.map((m) => m.partId)).size !== 1 ||
    staffDefs.length !== 1
  )
    throw new Error("SPIKE_REQUIRES_ONE_PART_ONE_STAFF");
  if (measures.length !== map.measures.length)
    throw new Error("MEASURE_MAPPING_MISMATCH");
  const anchors: BeatAnchor[] = [];
  measures.forEach((m, mi) => {
    const bm = map.measures[mi];
    if (bm.diagnostics.length)
      throw new Error(`BEAT_MAP_DIAGNOSTICS: ${bm.measureId}`);
    if (bm.meter?.beatType !== 4) throw new Error("UNSUPPORTED_METER");
    if (m.getAttribute("n") !== bm.measureNumber)
      throw new Error("MEASURE_NUMBER_MISMATCH");
    const staves = direct(m, "staff");
    if (staves.length !== 1) throw new Error("SPIKE_REQUIRES_ONE_STAFF");
    const staff = staves[0].getAttribute("n") || "1";
    for (const [bi, beat] of bm.beatsMap.entries()) {
      const anchor: BeatAnchor = {
        id: `tva-beat-${mi + 1}-${bi + 1}`,
        sourceMeasureId: bm.measureId,
        measureId: id(m),
        measureIndex: mi,
        label: beat.label,
        offset: beat.offset,
        timestamp: exactTimestamp(add(beat.offset, rational(1))),
        staff,
      };
      anchors.push(anchor);
      const dir = doc.createElementNS(MEI, "dir");
      for (const [key, value] of Object.entries({
        staff,
        tstamp: anchor.timestamp,
        place: "below",
        vgrp: "987",
        color: options.color,
      }))
        dir.setAttribute(key, value);
      dir.setAttributeNS(XML, "xml:id", anchor.id);
      const rend = doc.createElementNS(MEI, "rend");
      rend.setAttribute("fontsize", `${options.sizePt}pt`);
      rend.setAttribute("fontweight", "bold");
      rend.setAttribute("fontstyle", "normal");
      rend.appendChild(doc.createTextNode(beat.label));
      dir.appendChild(rend);
      m.appendChild(dir);
    }
  });
  return { mei: serialize(doc), anchors };
}
