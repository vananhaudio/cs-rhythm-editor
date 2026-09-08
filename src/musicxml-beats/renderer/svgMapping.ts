import type { Document, Element } from "@xmldom/xmldom";
import { all, byId, classes, direct, parse, serialize, SVG } from "./xml.ts";
import type { BeatAnchor } from "./annotations.ts";
export interface ResolvedBeat extends BeatAnchor {
  x: number;
  y: number;
  method: string;
}
export interface UnresolvedBeat extends BeatAnchor {
  reason: string;
}
export function resolveTimestampSVG(svg: string, anchors: BeatAnchor[]) {
  const doc = parse(svg),
    resolved: ResolvedBeat[] = [],
    unresolved: UnresolvedBeat[] = [];
  for (const anchor of anchors) {
    const g = byId(doc, anchor.id),
      text = g && all(g, "text")[0];
    if (!text || text.textContent?.trim() !== anchor.label) {
      unresolved.push({ ...anchor, reason: "NO_TIMESTAMP_LAYOUT" });
      continue;
    }
    const x = Number(text.getAttribute("x")),
      y = Number(text.getAttribute("y"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      unresolved.push({ ...anchor, reason: "INVALID_COORDINATES" });
      continue;
    }
    resolved.push({ ...anchor, x, y, method: "Verovio MEI dir@tstamp" });
  }
  return { resolved, unresolved };
}
function layoutOrigin(g: Element): number | null {
  // Use a glyph's renderer origin at an EXACT onset, not its nearest note.
  // An mRest glyph is centered in the measure and is NOT a temporal anchor.
  if (classes(g).includes("mRest")) return null;
  const head = all(g, "g").find((e) => classes(e).includes("notehead"));
  const use = all(head || g, "use")[0];
  const match = use
    ?.getAttribute("transform")
    ?.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
  return match ? Number(match[1]) : null;
}
export function staffBottom(
  doc: Document,
  measureId: string,
  staff: string
): number | null {
  const measure = byId(doc, measureId);
  const g =
    measure &&
    all(measure, "g").find(
      (e) =>
        classes(e).includes("staff") &&
        !classes(e).includes("bounding-box") &&
        (!e.getAttribute("data-n") || e.getAttribute("data-n") === staff)
    );
  if (!g) return null;
  const ys = direct(g, "path")
    .map((p) => p.getAttribute("d")?.match(/^M\s*[-\d.]+\s+([-\d.]+)/)?.[1])
    .filter(Boolean)
    .map(Number);
  return ys.length ? Math.max(...ys) : null;
}
export interface TimemapEvent {
  qstamp: number;
  on?: string[];
  restsOn?: string[];
}
/** Strategy B intentionally refuses to interpolate or borrow a neighbour's x. */
export function overlayFromTimemap(
  svg: string,
  anchors: BeatAnchor[],
  timemap: TimemapEvent[],
  measureStarts: number[],
  color = "#dc2626"
) {
  const doc = parse(svg),
    resolved: ResolvedBeat[] = [],
    unresolved: UnresolvedBeat[] = [];
  for (const anchor of anchors) {
    const [n, d] = anchor.offset.split("/").map(Number);
    const target = measureStarts[anchor.measureIndex] + n / d;
    const event = timemap.find((t) => t.qstamp === target);
    const ids = [...(event?.on || []), ...(event?.restsOn || [])];
    const origins = ids
      .map((value) => {
        const g = byId(doc, value);
        return g ? layoutOrigin(g) : null;
      })
      .filter((x): x is number => x !== null);
    const bottom = staffBottom(doc, anchor.measureId, anchor.staff);
    if (!origins.length || bottom === null) {
      unresolved.push({
        ...anchor,
        reason: ids.length
          ? "NO_TEMPORAL_LAYOUT_ORIGIN"
          : "NO_EXACT_TIMEMAP_ONSET",
      });
      continue;
    }
    const x = origins[0],
      y = bottom + 900;
    const measure = byId(doc, anchor.measureId)!;
    const text = doc.createElementNS(SVG, "text");
    text.setAttribute("id", `${anchor.id}-overlay`);
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("fill", color);
    text.setAttribute("font-size", "247");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("font-style", "normal");
    text.appendChild(doc.createTextNode(anchor.label));
    measure.appendChild(text);
    resolved.push({
      ...anchor,
      x,
      y,
      method: "Exact Verovio timemap onset → SVG glyph origin",
    });
  }
  return { svg: serialize(doc), resolved, unresolved };
}
