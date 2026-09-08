import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import type { BeatMapDocument } from "../beatMap.ts";
import { annotateMEI } from "./annotations.ts";
import { overlayFromTimemap, resolveTimestampSVG } from "./svgMapping.ts";
import { all, parse, serialize } from "./xml.ts";
export const SPIKE_OPTIONS = {
  pageWidth: 1800,
  pageHeight: 800,
  scale: 100,
  adjustPageHeight: true,
  breaks: "none",
  header: "none",
  footer: "none",
  svgBoundingBoxes: true,
  svgAdditionalAttribute: ["note@dur", "dir@tstamp", "staff@n"],
};
function withWhiteBackground(svg: string): string {
  return svg.replace("<svg ", '<svg style="background:white" ');
}
function reserveOverlayHeight(svg: string): string {
  const doc = parse(svg),
    root = doc.documentElement!;
  const inner = all(root, "svg")[0],
    vb = inner.getAttribute("viewBox")!.split(" ").map(Number);
  const scale = parseFloat(root.getAttribute("width")!) / vb[2];
  root.setAttribute(
    "height",
    `${parseFloat(root.getAttribute("height")!) + 900 * scale}px`
  );
  vb[3] += 900;
  inner.setAttribute("viewBox", vb.join(" "));
  return serialize(doc);
}
/** Compare original MEI music structure against re-import after annotation, ignoring generated IDs. */
function notationInventory(mei: string) {
  const doc = parse(mei);
  const music = all(doc, "music")[0];
  for (const app of all(music, "dir").filter((e) =>
    e.getAttribute("xml:id")?.startsWith("tva-beat-")
  ))
    app.parentNode?.removeChild(app);
  const tags = [
    "note",
    "rest",
    "mRest",
    "chord",
    "tie",
    "slur",
    "tuplet",
    "verse",
    "syl",
    "harm",
    "clef",
    "meterSig",
    "keySig",
    "beam",
    "artic",
  ];
  return Object.fromEntries(
    tags.map((tag) => [
      tag,
      all(music, tag).map((e) => {
        const attrs = Array.from(e.attributes)
          .filter((a) => !["xml:id", "id"].includes(a.name))
          .map((a) => [a.name, a.value])
          .sort(([a], [b]) => a.localeCompare(b));
        return {
          attrs,
          text: (e.textContent || "").trim().replace(/\s+/g, " "),
        };
      }),
    ])
  );
}
export async function createSpikeRenderer() {
  const toolkit = new VerovioToolkit(await createVerovioModule());
  return {
    version: toolkit.getVersion(),
    destroy: () => toolkit.destroy(),
    render(xml: string, map: BeatMapDocument) {
      toolkit.setOptions(SPIKE_OPTIONS);
      toolkit.resetXmlIdSeed(1);
      if (!toolkit.loadData(xml))
        throw new Error("VEROVIO_MUSICXML_IMPORT_FAILED");
      const importLog = toolkit.getLog(),
        originalMEI = toolkit.getMEI();
      const baselineSVG = withWhiteBackground(toolkit.renderToSVG(1));
      const timemap = toolkit.renderToTimemap({ includeRests: true });
      const annotated = annotateMEI(originalMEI, map);
      const starts: number[] = [];
      let current = 0;
      for (const m of map.measures) {
        starts.push(current);
        const [n, d] = m.actualDuration.split("/").map(Number);
        current += n / d;
      }
      const b = overlayFromTimemap(
        reserveOverlayHeight(baselineSVG),
        annotated.anchors,
        timemap,
        starts
      );
      if (!toolkit.loadData(annotated.mei))
        throw new Error("VEROVIO_ANNOTATED_MEI_FAILED");
      if (toolkit.getPageCount() !== 1)
        throw new Error("SPIKE_REQUIRES_ONE_PAGE");
      const aSVG = withWhiteBackground(toolkit.renderToSVG(1));
      const reimportedMEI = toolkit.getMEI();
      const a = resolveTimestampSVG(aSVG, annotated.anchors);
      const before = notationInventory(originalMEI),
        after = notationInventory(reimportedMEI);
      const changed = Object.keys(before).filter(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
      );
      return {
        version: toolkit.getVersion(),
        baselineSVG,
        originalMEI,
        annotatedMEI: annotated.mei,
        reimportedMEI,
        timemap,
        a: { svg: aSVG, ...a },
        b,
        preservation: { changedNotationCategories: changed, before, after },
        logs: { import: importLog, annotation: toolkit.getLog() },
      };
    },
  };
}
