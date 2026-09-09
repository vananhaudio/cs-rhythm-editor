import { createAnnotations } from "../annotations.ts";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { musicXMLToBeatMap } from "../beatMap.ts";
import type { Diagnostic } from "../model.ts";
import { applyTemporalAnnotations } from "./temporalAnnotations.ts";
import { DEFAULT_SCORE_SETTINGS } from "./types.ts";
import type {
  AnnotatedScore,
  ScorePage,
  ScoreSettings,
  TemporalAnchor,
} from "./types.ts";
import { all, byId, classes, direct, parse, serialize } from "./xml.ts";
import type { Element } from "@xmldom/xmldom";
import { cleanSVG } from "./svgExport.ts";
let wasm: Promise<unknown> | undefined;
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
function boxes(e: Element): Box[] {
  return all(e, "rect")
    .map((r) => ({
      x: Number(r.getAttribute("x")),
      y: Number(r.getAttribute("y")),
      width: Number(r.getAttribute("width")),
      height: Number(r.getAttribute("height")),
    }))
    .filter((b) => b.width > 0 && b.height > 0);
}
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
function verifyPage(
  svg: string,
  anchors: TemporalAnchor[],
  diagnostics: Diagnostic[],
  resolved: Set<string>
) {
  const doc = parse(svg);
  const definition = all(doc, "svg").find((e) =>
    classes(e).includes("definition-scale")
  );
  const view = definition?.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const margin = all(doc, "g")
    .find((e) => classes(e).includes("page-margin"))
    ?.getAttribute("transform")
    ?.match(/translate\(\s*([\d.]+)[ ,]+([\d.]+)/);
  const clipped = (b: Box) =>
    view && margin
      ? b.x + Number(margin[1]) < 0 ||
        b.y + Number(margin[2]) < 0 ||
        b.x + b.width + Number(margin[1]) > view[2] ||
        b.y + b.height + Number(margin[2]) > view[3]
      : false;
  const lyrics = all(doc, "g")
    .filter(
      (g) => classes(g).includes("syl") && !classes(g).includes("bounding-box")
    )
    .flatMap(boxes);
  const staffs = all(doc, "g")
    .filter(
      (g) =>
        classes(g).includes("staff") && !classes(g).includes("bounding-box")
    )
    .map((g) => {
      const lines = direct(g, "path")
        .map((p) =>
          p
            .getAttribute("d")
            ?.match(/^M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)/)
        )
        .filter((m) => m !== undefined && m !== null);
      if (!lines.length) return null;
      const ys = lines.map((m) => Number(m![2]));
      return {
        g,
        box: {
          x: Number(lines[0]![1]),
          y: Math.min(...ys),
          width: Number(lines[0]![3]) - Number(lines[0]![1]),
          height: Math.max(...ys) - Math.min(...ys),
        },
      };
    })
    .filter((s) => s !== null);
  const candidates = anchors.flatMap((a) => {
    const g = byId(doc, a.id);
    return g ? [{ a, g, bounds: boxes(g) }] : [];
  });
  const crowded = new Set<string>();
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++)
      if (
        candidates[i].bounds.some((b) =>
          candidates[j].bounds.some((other) => intersects(b, other))
        )
      ) {
        crowded.add(candidates[i].a.sourceMeasureId);
        crowded.add(candidates[j].a.sourceMeasureId);
      }
  for (const a of anchors) {
    const g = byId(doc, a.id);
    if (!g) continue;
    const text = all(g, "text")[0];
    const valid =
      text?.hasAttribute("x") &&
      text.hasAttribute("y") &&
      text.textContent?.trim() === a.label &&
      Number.isFinite(Number(text.getAttribute("x"))) &&
      Number.isFinite(Number(text.getAttribute("y")));
    const annotationBoxes = boxes(g);
    const collision = annotationBoxes.some(
      (b) =>
        lyrics.some((l) => intersects(b, l)) ||
        staffs.some((s) => intersects(b, s.box))
    );
    const outside = annotationBoxes.some(clipped);
    const densityCollision = crowded.has(a.sourceMeasureId);
    if (!valid || collision || outside || densityCollision) {
      g.parentNode?.removeChild(g);
      diagnostics.push({
        sourceId: a.sourceMeasureId,
        code: densityCollision
          ? "ANNOTATION_DENSITY_COLLISION"
          : outside
          ? "ANNOTATION_PAGE_CLIPPING"
          : collision
          ? "ANNOTATION_LAYOUT_COLLISION"
          : "TEMPORAL_ANCHOR_NOT_RESOLVED",
        message: `Phách ${a.label}, staff ${a.staff}: ${
          densityCollision
            ? "nhãn đếm quá sát nhau; đã ẩn nhãn của ô này. Hãy giảm cỡ chữ hoặc chọn khổ ngang."
            : outside
            ? "vượt mép trang; đã ẩn số và cần kiểm tra bố cục."
            : collision
            ? "chưa đủ khoảng trống; đã ẩn số để tránh đè lời/khuông."
            : "không resolve được tọa độ; đã ẩn số."
        }`,
      });
    } else resolved.add(a.id);
  }
  return cleanSVG(serialize(doc));
}
export async function createAnnotatedScoreRenderer() {
  wasm ??= createVerovioModule().catch((error) => {
    wasm = undefined;
    throw error;
  });
  const toolkit = new VerovioToolkit(await wasm);
  let cached:
    | {
        xml: string;
        groupingKey: string;
        mei: string;
        map: ReturnType<typeof musicXMLToBeatMap>;
        log: string;
      }
    | undefined;
  return {
    destroy() {
      toolkit.destroy();
    },
    render(
      xml: string,
      settings: ScoreSettings = DEFAULT_SCORE_SETTINGS
    ): AnnotatedScore {
      if (
        !/^#[0-9a-f]{6}$/i.test(settings.color) ||
        settings.sizePt < 5 ||
        settings.sizePt > 14 ||
        !Number.isFinite(settings.sizePt) ||
        settings.distance < 0 ||
        settings.distance > 8 ||
        !Number.isFinite(settings.distance)
      )
        throw new Error("Thiết lập số phách không hợp lệ.");
      // Cách chia nhịp lẻ đổi thì beat-map đổi theo, nên nó phải nằm trong khóa cache.
      const groupingKey = JSON.stringify(settings.grouping ?? null);
      const fresh = cached?.xml === xml && cached.groupingKey === groupingKey;
      const sourceMap = fresh
        ? cached!.map
        : musicXMLToBeatMap(xml, settings.grouping);
      const hasSubbeats = createAnnotations(
        sourceMap,
        settings.countingLevel,
        settings.compoundCountingMode
      ).some((a) => a.kind === "subbeat");
      toolkit.resetOptions();
      toolkit.setOptions({
        pageWidth: settings.orientation === "landscape" ? 2970 : 2100,
        pageHeight: settings.orientation === "landscape" ? 2100 : 2970,
        pageMarginTop: 150,
        pageMarginBottom: 180,
        pageMarginLeft: 150,
        pageMarginRight: 150,
        scale: 50,
        adjustPageHeight: false,
        adjustPageWidth: false,
        breaks: "auto",
        footer: "none",
        svgBoundingBoxes: true,
        svgContentBoundingBoxes: true,
        svgAdditionalAttribute: ["staff@n"],
        spacingStaff: 18 + settings.distance,
        spacingSystem: 12 + settings.distance,
        lyricTopMinMargin: 4,
        ...(settings.showBeats && hasSubbeats
          ? {
              // Engraving spacing only: Verovio still resolves all x positions via tstamp.
              spacingLinear: 1,
              spacingNonLinear: 0.6 + Math.max(0, settings.sizePt - 7) * 0.015,
              measureMinWidth: 30,
            }
          : {}),
      });
      if (!fresh) {
        const map = sourceMap;
        toolkit.resetXmlIdSeed(1);
        if (!toolkit.loadData(xml))
          throw new Error("Verovio không đọc được bản nhạc.");
        cached = {
          xml,
          groupingKey,
          mei: toolkit.getMEI(),
          map,
          log: toolkit.getLog(),
        };
      }
      const active = cached!;
      const applied = applyTemporalAnnotations(active.mei, active.map, settings);
      if (!toolkit.loadData(applied.mei))
        throw new Error("Không render được bản nhạc đã đánh dấu phách.");
      const diagnostics = [...applied.diagnostics];
      const notices = active.map.measures.flatMap((m) => m.notices ?? []);
      for (const message of [active.log, toolkit.getLog()].filter(Boolean))
        diagnostics.push({
          sourceId: "score",
          code: "RENDERER_WARNING",
          message,
        });
      const pages: ScorePage[] = [],
        resolved = new Set<string>();
      for (let number = 1; number <= toolkit.getPageCount(); number++) {
        const svg = verifyPage(
            toolkit.renderToSVG(number),
            applied.anchors,
            diagnostics,
            resolved
          ),
          root = parse(svg).documentElement!;
        pages.push({
          number,
          svg,
          width: parseFloat(root.getAttribute("width")!),
          height: parseFloat(root.getAttribute("height")!),
        });
      }
      for (const a of applied.anchors)
        if (
          !resolved.has(a.id) &&
          !diagnostics.some(
            (d) =>
              d.sourceId === a.sourceMeasureId &&
              d.message.startsWith(`Phách ${a.label}, staff ${a.staff}:`)
          )
        )
          diagnostics.push({
            sourceId: a.sourceMeasureId,
            code: "TEMPORAL_ANCHOR_NOT_RESOLVED",
            message: `Phách ${a.label}, staff ${a.staff}: không tìm thấy trong SVG; không gắn số thay thế.`,
          });
      if (!pages.length) throw new Error("Bản nhạc không có trang hiển thị.");
      return {
        pages,
        diagnostics,
        notices,
        beatMap: active.map,
        anchors: applied.anchors.filter((a) => resolved.has(a.id)),
        version: toolkit.getVersion(),
        originalMEI: active.mei,
        renderedMEI: toolkit.getMEI(),
      };
    },
  };
}
