import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { musicXMLToBeatMap } from "../beatMap.ts";
import { tagSourceIds } from "../sourceTags.ts";
import type { Diagnostic } from "../model.ts";
import { applyAnchorLattice } from "./anchorLattice.ts";
import { resolveLabels } from "./labelResolution.ts";
import { fitLabelPt, paintPage, preparePage } from "./labelOverlay.ts";
import { DEFAULT_SCORE_SETTINGS } from "./types.ts";
import type { AnnotatedScore, ScorePage, ScoreSettings } from "./types.ts";
import { parse } from "./xml.ts";
let wasm: Promise<unknown> | undefined;
export async function createAnnotatedScoreRenderer() {
  wasm ??= createVerovioModule().catch((error) => {
    wasm = undefined;
    throw error;
  });
  const toolkit = new VerovioToolkit(await wasm);
  let cached:
    | {
        xml: string;
        layoutKey: string;
        map: ReturnType<typeof musicXMLToBeatMap>;
        lattice: ReturnType<typeof applyAnchorLattice>;
        /** SVG nền chưa phủ nhãn — dùng lại cho mọi mức đếm. */
        base: string[];
        log: string;
        renderedMEI: string;
        sourceMEI: string;
        tagged: ReturnType<typeof tagSourceIds>;
        /** Nốt nguồn mà SVG không có phần tử tương ứng — không bao giờ chọn đại. */
        unresolved: string[];
      }
    | undefined;
  // Đếm thật, không phải suy đoán: mỗi lần Verovio khắc lại bản nhạc và mỗi lần chỉ
  // phủ lại nhãn. Đây là cách duy nhất chứng minh đổi mức đếm KHÔNG khắc lại gì.
  const counters = { engravings: 0, overlays: 0 };
  return {
    stats: () => ({ ...counters }),
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
      // Bản khắc nền CHỈ phụ thuộc bản nhạc và khổ giấy. Mức đếm, màu, cỡ chữ đổi
      // thì chỉ lớp phủ vẽ lại — bản nhạc bên dưới không khắc lại lần nào.
      const layoutKey = JSON.stringify({
        groupingKey,
        distance: settings.distance,
        orientation: settings.orientation ?? "portrait",
      });
      if (!(cached?.xml === xml && cached.layoutKey === layoutKey)) {
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
          // KHÔNG có option spacing nào phụ thuộc mức đếm. Giãn bản nhạc để nhét
          // chữ vào là đổi chính bản khắc; chỗ cho chữ là việc của lớp phủ.
        });
        counters.engravings++;
        const map = musicXMLToBeatMap(xml, settings.grouping);
        // Tiêm id nguồn vào từng <note> TRƯỚC khi Verovio đọc: Verovio giữ nguyên
        // nó thành xml:id rồi thành id của <g class="note"> trong SVG. Đây là đường
        // duy nhất để click trên bản nhạc biết đích danh nốt nguồn. Không đổi bố
        // cục — id không tham gia khắc nhạc (bất biến layout vẫn được test).
        const tagged = tagSourceIds(xml);
        toolkit.resetXmlIdSeed(1);
        if (!toolkit.loadData(tagged.xml))
          throw new Error("Verovio không đọc được bản nhạc.");
        const sourceMEI = toolkit.getMEI();
        const loadLog = toolkit.getLog();
        const lattice = applyAnchorLattice(sourceMEI, map, settings);
        if (!toolkit.loadData(lattice.mei))
          throw new Error("Không render được bản nhạc đã đánh dấu phách.");
        const base: string[] = [];
        for (let number = 1; number <= toolkit.getPageCount(); number++)
          base.push(toolkit.renderToSVG(number));
        // Nốt nguồn nào không xuất hiện trong SVG nào thì KHÔNG resolve — báo rõ.
        const svgAll = base.join("\n");
        const unresolved = tagged.notes
          .filter((n) => !svgAll.includes(`id="${n.svgId}"`))
          .map((n) => n.svgId);
        cached = {
          xml,
          layoutKey,
          map,
          lattice,
          base,
          tagged,
          unresolved,
          log: [loadLog, toolkit.getLog()].filter(Boolean).join("\n"),
          renderedMEI: toolkit.getMEI(),
          sourceMEI,
        };
      }
      const active = cached!;
      const { labels, diagnostics: labelDiagnostics } = resolveLabels(
        active.map,
        settings,
        active.lattice
      );
      const diagnostics: Diagnostic[] = [
        ...active.lattice.diagnostics,
        ...labelDiagnostics,
      ];
      const notices: Diagnostic[] = active.map.measures.flatMap(
        (m) => m.notices ?? []
      );
      for (const svgId of active.unresolved)
        diagnostics.push({
          sourceId: active.tagged.byId.get(svgId)?.path ?? svgId,
          code: "NOTE_SOURCE_NOT_RESOLVED",
          message: `Nốt ${svgId} không có phần tử tương ứng trong bản khắc; không thể chọn.`,
        });
      if (active.log)
        diagnostics.push({
          sourceId: "score",
          code: "RENDERER_WARNING",
          message: active.log,
        });
      const pages: ScorePage[] = [],
        resolved = new Set<string>();
      const prepared = active.base.map((raw) =>
        preparePage(raw, labels, settings)
      );
      // Chữ nhường chỗ cho bản nhạc, không bao giờ ngược lại.
      const fit = fitLabelPt(prepared, settings);
      if (fit.shrunk && labels.length)
        notices.push({
          sourceId: "score",
          code: "ANNOTATION_FONT_REDUCED",
          message: `Nhãn đếm dày nên đã giảm cỡ số xuống ${fit.pt
            .toFixed(2)
            .replace(/\.?0+$/, "")
            .replace(".", ",")}pt cho vừa bản nhạc. Bản nhạc giữ nguyên bố cục.`,
        });
      counters.overlays++;
      for (const [index, page] of prepared.entries()) {
        const svg = paintPage(page, fit.pt, settings, diagnostics, resolved),
          root = parse(svg).documentElement!;
        pages.push({
          number: index + 1,
          svg,
          width: parseFloat(root.getAttribute("width")!),
          height: parseFloat(root.getAttribute("height")!),
        });
      }
      for (const a of labels)
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
        anchors: labels.filter((a) => resolved.has(a.id)),
        version: toolkit.getVersion(),
        originalMEI: active.sourceMEI,
        renderedMEI: active.renderedMEI,
        sourceNotes: active.tagged.notes,
        noteIndex: active.tagged.byId,
      };
    },
  };
}
