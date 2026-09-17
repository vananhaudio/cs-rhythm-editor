import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { musicXMLToBeatMap } from "../beatMap.ts";
import { tagSourceIds } from "../sourceTags.ts";
import type { Diagnostic } from "../model.ts";
import { applyAnchorLattice } from "./anchorLattice.ts";
import { applySourceIdentity } from "./meiIdentity.ts";
import { resolveLabels } from "./labelResolution.ts";
import { fitLabelPt, paintPage, preparePage } from "./labelOverlay.ts";
import { DEFAULT_SCORE_SETTINGS } from "./types.ts";
import type { AnnotatedScore, ScorePage, ScoreSettings } from "./types.ts";
import { parse } from "./xml.ts";
/**
 * Tuỳ chọn khắc nhạc — MỘT chỗ khai báo duy nhất.
 *
 * Xuất ra ngoài để phép kiểm bất biến dựng lại đúng lượt khắc của sản phẩm, chứ
 * không phải để gọi nơi khác: bản khắc chỉ được sinh ra từ `render()`.
 * KHÔNG có tuỳ chọn spacing nào phụ thuộc mức đếm — giãn bản nhạc để nhét chữ
 * vào là đổi chính bản khắc; chỗ cho chữ là việc của lớp phủ.
 */
export const layoutOptions = (settings: ScoreSettings) => ({
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
});

let wasm: Promise<unknown> | undefined;
/** Dàn trang của MỘT bản nguồn — dùng chung cho đường chuẩn và đường xem trước. */
interface BoCuc {
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
  identity: ReturnType<typeof applySourceIdentity>;
  /** Nốt nguồn mà SVG không có phần tử tương ứng — không bao giờ chọn đại. */
  unresolved: string[];
}
/** Lớp phủ đã vẽ của một trang — để trang KHÔNG đổi được dùng lại nguyên vẹn. */
interface PhuTrang {
  page: ScorePage;
  /** Cỡ chữ lớn nhất mà riêng trang này chịu được (cỡ chung = nhỏ nhất các trang). */
  pt: number;
  shrunk: boolean;
  diagnostics: Diagnostic[];
  resolved: string[];
}
/**
 * PreviewRenderCache (4D.P3) — ảnh chụp lần xem trước gần nhất. CHỈ phục vụ xem
 * trước; `render()` chuẩn, xuất file và lưu không bao giờ đọc từ đây.
 */
interface PreviewRenderCache {
  xml: string;
  layoutKey: string;
  overlayKey: string;
  boCuc: BoCuc;
  phu: PhuTrang[];
  pt: number;
  labelsKey: string;
  latticeKey: string;
  identityKey: string;
}

export interface PreviewHint {
  /** Nốt TAB duy nhất mà bản nháp mới khác bản đang xem trước. */
  sourceId: string;
}

const hopLe = (settings: ScoreSettings) => {
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
};
// Cách chia nhịp lẻ đổi thì beat-map đổi theo, nên nó phải nằm trong khóa cache.
// Bản khắc nền CHỈ phụ thuộc bản nhạc và khổ giấy. Mức đếm, màu, cỡ chữ đổi
// thì chỉ lớp phủ vẽ lại — bản nhạc bên dưới không khắc lại lần nào.
function khoaBoCuc(settings: ScoreSettings) {
  const groupingKey = JSON.stringify(settings.grouping ?? null);
  const layoutKey = JSON.stringify({
    groupingKey,
    distance: settings.distance,
    orientation: settings.orientation ?? "portrait",
  });
  return layoutKey;
}
const khoaLuoi = (l: ReturnType<typeof applyAnchorLattice>) =>
  JSON.stringify({
    k: [...l.byKey],
    m: [...l.measureIds],
    s: [...l.staves],
    d: l.diagnostics,
    a: l.annotatable,
  });
/**
 * Chữ ký bố cục của một trang SVG nền: dãy (lớp, hộp bao) theo thứ tự tài liệu,
 * bỏ riêng hộp của nốt vừa sửa, cộng số phần tử có id. Không đoán, không toạ độ
 * gần đúng: khác một con số là khác chữ ký.
 */
export function chuKyTrang(svg: string, boQuaId: string): string {
  const out: string[] = [];
  const re =
    /<g id="bbox-([^"]+)" class="([^"]*)"[^>]*>\s*<rect x="([-\d.]+)" y="([-\d.]+)" height="([-\d.]+)" width="([-\d.]+)"/g;
  for (const m of svg.matchAll(re))
    out.push(m[1] === boQuaId ? `${m[2]}@*` : `${m[2]}@${m[3]},${m[4]},${m[6]},${m[5]}`);
  out.push(`ids=${(svg.match(/<g id="/g) ?? []).length}`);
  return out.join("|");
}

export async function createAnnotatedScoreRenderer() {
  wasm ??= createVerovioModule().catch((error) => {
    wasm = undefined;
    throw error;
  });
  const toolkit = new VerovioToolkit(await wasm);
  let cached: BoCuc | undefined;
  let preview: PreviewRenderCache | undefined;
  // Đếm thật, không phải suy đoán: mỗi lần Verovio khắc lại bản nhạc và mỗi lần chỉ
  // phủ lại nhãn. Đây là cách duy nhất chứng minh đổi mức đếm KHÔNG khắc lại gì.
  // 4D.P3: thêm số trang thật sự vẽ, số trang phủ nhãn, và mỗi lần xem trước đi
  // đường nào — để chứng minh sửa phím chỉ vẽ lại đúng một trang.
  const counters = {
    engravings: 0,
    overlays: 0,
    pagesRendered: 0,
    overlayPages: 0,
    previewFull: 0,
    previewPartial: 0,
    partialFallbacks: {} as Record<string, number>,
  };

  /** Lượt 1 + tiêm danh tính + lưới neo + lượt 2 (dàn trang). Không vẽ trang nào. */
  function danTrang(xml: string, settings: ScoreSettings, map: BoCuc["map"]) {
    toolkit.resetOptions();
    toolkit.setOptions(layoutOptions(settings));
    // Tiêm id nguồn vào từng <note> TRƯỚC khi Verovio đọc: Verovio giữ nguyên
    // nó thành xml:id rồi thành id của <g class="note"> trong SVG. Đây là đường
    // duy nhất để click trên bản nhạc biết đích danh nốt nguồn. Không đổi bố
    // cục — id không tham gia khắc nhạc (bất biến layout vẫn được test).
    const tagged = tagSourceIds(xml);
    toolkit.resetXmlIdSeed(1);
    if (!toolkit.loadData(tagged.xml))
      throw new Error("Verovio không đọc được bản nhạc.");
    // Lời và hợp âm mất id khi qua Verovio, nên danh tính của chúng được gắn
    // ở MEI ngay đây — trước lượt khắc, cùng chỗ với lưới neo. Xem meiIdentity.ts.
    const identity = applySourceIdentity(toolkit.getMEI(), tagged);
    const sourceMEI = identity.mei;
    const loadLog = toolkit.getLog();
    const lattice = applyAnchorLattice(sourceMEI, map, settings);
    if (!toolkit.loadData(lattice.mei))
      throw new Error("Không render được bản nhạc đã đánh dấu phách.");
    return { tagged, identity, sourceMEI, loadLog, lattice };
  }
  function veTrang(number: number) {
    counters.pagesRendered++;
    return toolkit.renderToSVG(number);
  }
  function hoanTat(
    xml: string,
    layoutKey: string,
    map: BoCuc["map"],
    d: ReturnType<typeof danTrang>,
    base: string[]
  ): BoCuc {
    // Nốt nguồn nào không xuất hiện trong SVG nào thì KHÔNG resolve — báo rõ.
    const svgAll = base.join("\n");
    const unresolved = d.tagged.notes
      .filter((n) => !svgAll.includes(`id="${n.svgId}"`))
      .map((n) => n.svgId);
    return {
      xml,
      layoutKey,
      map,
      lattice: d.lattice,
      base,
      tagged: d.tagged,
      unresolved,
      identity: d.identity,
      log: [d.loadLog, toolkit.getLog()].filter(Boolean).join("\n"),
      renderedMEI: toolkit.getMEI(),
      sourceMEI: d.sourceMEI,
    };
  }
  /** Bản khắc chuẩn: dàn trang và vẽ MỌI trang. */
  function khacDayDu(xml: string, settings: ScoreSettings, layoutKey: string): BoCuc {
    counters.engravings++;
    const map = musicXMLToBeatMap(xml, settings.grouping);
    const d = danTrang(xml, settings, map);
    const base: string[] = [];
    for (let number = 1; number <= toolkit.getPageCount(); number++)
      base.push(veTrang(number));
    return hoanTat(xml, layoutKey, map, d, base);
  }

  /**
   * Lớp phủ nhãn. `dungLai[i]` có mặt = trang i y hệt lần trước (đã chứng minh),
   * dùng lại nguyên kết quả vẽ; chỉ khi cỡ chữ chung KHÔNG đổi.
   */
  function phuNhan(
    active: BoCuc,
    settings: ScoreSettings,
    dungLai?: Map<number, PhuTrang>,
    ptCu?: number
  ) {
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
    diagnostics.push(...active.identity.diagnostics);
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
    const prepared = active.base.map((raw, i) => {
      if (dungLai?.has(i)) return null;
      counters.overlayPages++;
      return preparePage(raw, labels, settings);
    });
    // Cỡ chữ của từng trang riêng. `fitLabelPt` lấy giới hạn NHỎ NHẤT qua các
    // trang rồi làm tròn xuống — hàm đơn điệu — nên cỡ chung đúng bằng cỡ nhỏ
    // nhất của các trang, và "đã thu nhỏ" đúng bằng "có trang nào thu nhỏ".
    const rieng = prepared.map((pg, i) => {
      if (pg) return fitLabelPt([pg], settings);
      const cu = dungLai!.get(i)!;
      return { pt: cu.pt, shrunk: cu.shrunk };
    });
    // Chữ nhường chỗ cho bản nhạc, không bao giờ ngược lại.
    const fit = dungLai?.size
      ? { pt: Math.min(...rieng.map((r) => r.pt)), shrunk: rieng.some((r) => r.shrunk) }
      : fitLabelPt(prepared as NonNullable<(typeof prepared)[number]>[], settings);
    // Cỡ chung đổi → trang dùng lại đã vẽ ở cỡ khác: không được ghép.
    if (dungLai?.size && fit.pt !== ptCu) return null;
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
    const phu: PhuTrang[] = [];
    for (const [index, page] of prepared.entries()) {
      const cu = dungLai?.get(index);
      if (cu) {
        diagnostics.push(...cu.diagnostics);
        for (const id of cu.resolved) resolved.add(id);
        pages.push(cu.page);
        phu.push(cu);
        continue;
      }
      const diagTrang: Diagnostic[] = [];
      const resTrang = new Set<string>();
      const svg = paintPage(page!, fit.pt, settings, diagTrang, resTrang),
        root = parse(svg).documentElement!;
      const sp: ScorePage = {
        number: index + 1,
        svg,
        width: parseFloat(root.getAttribute("width")!),
        height: parseFloat(root.getAttribute("height")!),
      };
      diagnostics.push(...diagTrang);
      for (const id of resTrang) resolved.add(id);
      pages.push(sp);
      phu.push({ page: sp, pt: rieng[index].pt, shrunk: rieng[index].shrunk, diagnostics: diagTrang, resolved: [...resTrang] });
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
    const score: AnnotatedScore = {
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
      lyricIndex: active.tagged.lyricById,
      harmonyIndex: active.tagged.harmonyById,
      unresolvedIdentity: new Set(active.identity.unresolved),
      unresolvedNotes: new Set(active.unresolved),
    };
    return { score, phu, pt: fit.pt, labelsKey: JSON.stringify(labels) };
  }

  const truot = (ly: string) => {
    counters.partialFallbacks[ly] = (counters.partialFallbacks[ly] ?? 0) + 1;
    return null;
  };
  /**
   * PARTIAL_PAGE_RENDER — chỉ khi bản xem trước trước đó khác bản mới ĐÚNG ở một
   * nốt TAB đã được phân loại LAYOUT_STABLE. Dàn trang vẫn chạy đủ; chỉ trang chứa
   * nốt đó được vẽ lại và phủ nhãn lại. Bất kỳ chốt nào hỏng → `null` (vẽ đầy đủ).
   */
  function thuVeMotTrang(
    xml: string,
    settings: ScoreSettings,
    prev: PreviewRenderCache,
    sourceId: string
  ) {
    const trangCu = prev.boCuc.base.flatMap((svg, i) =>
      svg.includes(`id="${sourceId}"`) ? [i] : []
    );
    if (trangCu.length !== 1) return truot("SOURCE_ID_NOT_ON_ONE_PAGE");
    const cu = trangCu[0];
    // Nốt TAB đổi phím không đổi thời gian: bản đồ phách của bản trước dùng lại.
    // Lưới neo vẫn dựng trên MEI MỚI — dùng lại DỮ LIỆU neo, không dùng lại MEI cũ.
    const map = prev.boCuc.map;
    const d = danTrang(xml, settings, map);
    if (toolkit.getPageCount() !== prev.boCuc.base.length) return truot("PAGE_COUNT_CHANGED");
    if (khoaLuoi(d.lattice) !== prev.latticeKey) return truot("LATTICE_CHANGED");
    if (
      JSON.stringify([d.identity.diagnostics, d.identity.unresolved]) !== prev.identityKey
    )
      return truot("IDENTITY_CHANGED");
    const trangMoi = Number(toolkit.getPageWithElement(sourceId));
    if (trangMoi !== cu + 1) return truot("PAGE_ASSIGNMENT_CHANGED");
    const raw = veTrang(trangMoi);
    if (!raw.includes(`id="${sourceId}"`)) return truot("SOURCE_ID_MISSING");
    if (chuKyTrang(raw, sourceId) !== chuKyTrang(prev.boCuc.base[cu], sourceId))
      return truot("LAYOUT_SIGNATURE_CHANGED");
    const base = prev.boCuc.base.map((s, i) => (i === cu ? raw : s));
    const boCuc = hoanTat(xml, prev.layoutKey, map, d, base);
    const dungLai = new Map(prev.phu.map((p, i) => [i, p] as const));
    dungLai.delete(cu);
    const kq = phuNhan(boCuc, settings, dungLai, prev.pt);
    if (!kq) return truot("LABEL_PT_CHANGED");
    if (kq.labelsKey !== prev.labelsKey) return truot("LABELS_CHANGED");
    return { boCuc, kq, lattice: d.lattice, identity: d.identity };
  }

  function chup(xml: string, settings: ScoreSettings, boCuc: BoCuc, kq: NonNullable<ReturnType<typeof phuNhan>>) {
    preview = {
      xml,
      layoutKey: boCuc.layoutKey,
      overlayKey: JSON.stringify(settings),
      boCuc,
      phu: kq.phu,
      pt: kq.pt,
      labelsKey: kq.labelsKey,
      latticeKey: khoaLuoi(boCuc.lattice),
      identityKey: JSON.stringify([boCuc.identity.diagnostics, boCuc.identity.unresolved]),
    };
  }

  return {
    stats: () => ({ ...counters, partialFallbacks: { ...counters.partialFallbacks } }),
    destroy() {
      toolkit.destroy();
    },
    /** Bản XML mà lần xem trước gần nhất đã vẽ — để phân loại phép sửa kế tiếp. */
    previewXml: () => preview?.xml ?? null,
    /** Bỏ ảnh chụp xem trước (dữ liệu tạm; mất nó thì lần sau vẽ đầy đủ). */
    clearPreview() {
      preview = undefined;
    },
    /**
     * BẢN KHẮC CHUẨN. Xuất file, lưu và mọi phép kiểm dùng đường này; nó không
     * bao giờ đọc ảnh chụp xem trước.
     */
    render(
      xml: string,
      settings: ScoreSettings = DEFAULT_SCORE_SETTINGS
    ): AnnotatedScore {
      hopLe(settings);
      const layoutKey = khoaBoCuc(settings);
      if (!(cached?.xml === xml && cached.layoutKey === layoutKey))
        cached = khacDayDu(xml, settings, layoutKey);
      return phuNhan(cached, settings)!.score;
    },
    /**
     * XEM TRƯỚC (4D.P3). `hint` chỉ được đưa khi phép sửa đã được phân loại
     * LAYOUT_STABLE so với `previewXml()`; renderer vẫn tự kiểm lại mọi chốt.
     */
    renderPreview(
      xml: string,
      settings: ScoreSettings = DEFAULT_SCORE_SETTINGS,
      hint?: PreviewHint | null
    ): AnnotatedScore {
      hopLe(settings);
      const layoutKey = khoaBoCuc(settings);
      const prev = preview;
      if (
        hint &&
        prev &&
        prev.xml !== xml &&
        prev.layoutKey === layoutKey &&
        prev.overlayKey === JSON.stringify(settings)
      ) {
        let thu: ReturnType<typeof thuVeMotTrang> = null;
        try {
          thu = thuVeMotTrang(xml, settings, prev, hint.sourceId);
        } catch {
          thu = truot("RENDERER_EXCEPTION");
        }
        if (thu) {
          counters.previewPartial++;
          chup(xml, settings, thu.boCuc, thu.kq);
          return thu.kq.score;
        }
      }
      // FULL_RENDER: bản chuẩn, rồi chụp làm nền cho lần sửa sau.
      counters.previewFull++;
      if (!(cached?.xml === xml && cached.layoutKey === layoutKey))
        cached = khacDayDu(xml, settings, layoutKey);
      const kq = phuNhan(cached, settings)!;
      chup(xml, settings, cached, kq);
      return kq.score;
    },
  };
}

/**
 * Bản khắc CHUẨN cho xuất file (4D.P3): bộ khắc mới, khắc đầy đủ từ đúng XML đưa
 * vào, rồi huỷ. Không dùng chung trạng thái, cache hay ảnh chụp xem trước nào.
 */
export async function renderCanonicalForExport(
  xml: string,
  settings: ScoreSettings = DEFAULT_SCORE_SETTINGS
): Promise<AnnotatedScore> {
  const r = await createAnnotatedScoreRenderer();
  try {
    return r.render(xml, settings);
  } finally {
    r.destroy();
  }
}
