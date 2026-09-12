import type { Diagnostic } from "../model.ts";
import type { ScoreSettings, TemporalAnchor } from "./types.ts";
import { all, classes, direct, parse, serialize, SVG } from "./xml.ts";
import type { Document, Element } from "@xmldom/xmldom";
import { cleanSVG } from "./svgExport.ts";

/**
 * Verovio ở scale 50 dựng chữ 7pt thành font-size 247px trong hệ toạ độ nhạc.
 * Hằng số này ĐO từ chính bản khắc cũ, không suy từ công thức điểm–milimét.
 */
const UNITS_PER_PT = 247 / 7;
/** Bề rộng glyph theo em, font Times mà bộ xuất nhúng sẵn. */
const GLYPH_WIDTH: Record<string, number> = { "&": 0.778, e: 0.444, a: 0.444 };
const widthEm = (label: string) =>
  [...label].reduce((sum, ch) => sum + (GLYPH_WIDTH[ch] ?? 0.5), 0);
const ASCENT = 0.72;
const DESCENT = 0.08;
/** Khoảng thở giữa hai nhãn liền nhau. */
const BREATH = 1.1;
/** Nhỏ hơn mức này thì số không còn đọc được trên giấy; thà ẩn bớt còn hơn. */
export const MIN_LABEL_PT = 4;
/** Verovio unit = nửa khoảng cách hai dòng kẻ; đo từ chính khuông, không đoán. */
const DEFAULT_UNIT = 90;
/** Lề tối thiểu giữa mực thấp nhất của khuông và mép trên hàng nhãn. */
const INK_PADDING = 1.5;
/** Phần chữ thò xuống dưới baseline — bỏ qua nó là đặt nhãn chạm gáy chữ lời hát. */
const TEXT_DESCENT = 0.25;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

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
const isStaff = (g: Element) =>
  classes(g).includes("staff") && !classes(g).includes("bounding-box");

/** Mực thấp nhất của một khuông: dòng kẻ, vạch phụ, đuôi nốt, đầu nốt — tất cả. */
function inkBottom(staff: Element): number {
  let bottom = -Infinity;
  for (const p of all(staff, "path"))
    for (const m of (p.getAttribute("d") || "").matchAll(
      /[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g
    ))
      bottom = Math.max(bottom, Number(m[2]));
  for (const u of all(staff, "use")) {
    const m = /translate\(\s*(-?[\d.]+),?\s+(-?[\d.]+)/.exec(
      u.getAttribute("transform") || ""
    );
    if (m) bottom = Math.max(bottom, Number(m[2]));
  }
  // Lời hát nằm dưới khuông và cũng là mực: bỏ qua nó là đặt số đè lên lời.
  // `y` của <text> là baseline, nên phải cộng phần chữ thò xuống dưới nó. Cỡ chữ
  // thật nằm ở <tspan> con — chính <text> của Verovio mang font-size 0.
  for (const t of all(staff, "text")) {
    const parts = [t, ...all(t, "tspan")];
    // Lời nhiều lời ca đặt tung độ trên <tspan>, không phải trên <text>: đọc mỗi
    // <text> là hụt hẳn những dòng dưới và đặt số đè lên chúng.
    const baseline = Math.max(
      ...parts
        .map((e) => Number(e.getAttribute("y")))
        .filter((v) => Number.isFinite(v))
    );
    if (!Number.isFinite(baseline)) continue;
    const sizes = parts
      .map((e) => parseFloat(e.getAttribute("font-size") || ""))
      .filter((v) => Number.isFinite(v) && v > 0);
    bottom = Math.max(
      bottom,
      baseline + (sizes.length ? Math.max(...sizes) : 0) * TEXT_DESCENT
    );
  }
  return bottom;
}

/** Dòng kẻ cuối cùng của khuông — không tính vạch phụ hay đuôi nốt. */
function staffLineBottom(staff: Element): number {
  const ys = direct(staff, "path")
    .map((p) =>
      /^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+L\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(
        p.getAttribute("d") || ""
      )
    )
    .filter((m) => m && m[2] === m[4])
    .map((m) => Number(m![2]));
  return ys.length ? Math.max(...ys) : -Infinity;
}

function unitOf(doc: Document): number {
  for (const staff of all(doc, "g").filter(isStaff)) {
    const ys = direct(staff, "path")
      .map((p) =>
        /^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+L\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(
          p.getAttribute("d") || ""
        )
      )
      .filter((m) => m && m[2] === m[4])
      .map((m) => Number(m![2]));
    const sorted = [...new Set(ys)].sort((a, b) => a - b);
    if (sorted.length >= 2 && sorted[1] > sorted[0])
      return (sorted[1] - sorted[0]) / 2;
  }
  return DEFAULT_UNIT;
}

interface Spot {
  label: TemporalAnchor;
  anchor: Element;
  x: number;
  /** Mép trên của hàng nhãn; baseline nằm dưới nó đúng một ascent. */
  top: number;
  /** Khoá hàng: nhãn cùng hàng mới có thể đè nhau theo chiều ngang. */
  row: string;
}
export interface PreparedPage {
  doc: Document;
  spots: Spot[];
  orphans: Element[];
  lyrics: Box[];
  staffs: Box[];
  clipped: (b: Box) => boolean;
}

/**
 * Pass 3a — đọc lưới neo trên bản khắc đã cố định.
 *
 * Neo chỉ cho HOÀNH ĐỘ. Tung độ của cả hàng nhãn tính từ mực thật của khuông trên
 * hệ đó, nên hàng luôn thẳng và không bao giờ đè vạch phụ hay đuôi nốt — và vì nó
 * chỉ phụ thuộc bản nhạc, đổi mức đếm không làm nó nhúc nhích.
 */
export function preparePage(
  svg: string,
  labels: TemporalAnchor[],
  settings: ScoreSettings
): PreparedPage {
  const doc = parse(svg);
  const unit = unitOf(doc);
  const byAnchor = new Map(
    labels.filter((l) => l.anchorId).map((l) => [l.anchorId!, l])
  );
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

  // Hàng nhãn nằm dưới dòng kẻ cuối đúng khoảng cách thầy chọn, và chỉ lùi thêm khi
  // ô nào đó trong hệ có mực chạm xuống — đúng luật Verovio vẫn dùng cho `dir`.
  const systems = all(doc, "g").filter((g) => classes(g).includes("system"));
  const rows = new Map<Element, Map<string, number>>();
  systems.forEach((system) => {
    const perStaff = new Map<string, { lines: number; ink: number }>();
    for (const staff of all(system, "g").filter(isStaff)) {
      const n = staff.getAttribute("data-n") || "1";
      const ink = inkBottom(staff);
      const lines = staffLineBottom(staff);
      const current = perStaff.get(n) ?? { lines: -Infinity, ink: -Infinity };
      perStaff.set(n, {
        lines: Math.max(current.lines, Number.isFinite(lines) ? lines : -Infinity),
        ink: Math.max(current.ink, Number.isFinite(ink) ? ink : -Infinity),
      });
    }
    const tops = new Map<string, number>();
    for (const [n, { lines, ink }] of perStaff)
      if (Number.isFinite(lines))
        tops.set(
          n,
          Math.max(
            lines + (4 + settings.distance) * unit,
            Number.isFinite(ink) ? ink + INK_PADDING * unit : -Infinity
          )
        );
    rows.set(system, tops);
  });
  const systemOf = (el: Element): Element | undefined => {
    for (let node: unknown = el; node; node = (node as Element).parentNode)
      if (
        node instanceof Object &&
        "getAttribute" in (node as Element) &&
        classes(node as Element).includes("system")
      )
        return node as Element;
    return undefined;
  };

  const spots: Spot[] = [];
  const orphans: Element[] = [];
  for (const anchor of all(doc, "g").filter((g) =>
    (g.getAttribute("id") || "").startsWith("tva-anchor-")
  )) {
    const label = byAnchor.get(anchor.getAttribute("id")!);
    if (!label) {
      orphans.push(anchor);
      continue;
    }
    const x = Number(all(anchor, "text")[0]?.getAttribute("x"));
    const system = systemOf(anchor);
    const top = system ? rows.get(system)?.get(label.staff) : undefined;
    if (!Number.isFinite(x) || top === undefined || !Number.isFinite(top)) {
      orphans.push(anchor);
      continue;
    }
    spots.push({
      label,
      anchor,
      x,
      top,
      row: `${systems.indexOf(system!)}|${label.staff}`,
    });
  }
  const lyrics = all(doc, "g")
    .filter(
      (g) => classes(g).includes("syl") && !classes(g).includes("bounding-box")
    )
    .flatMap(boxes);
  const staffs = all(doc, "g")
    .filter(isStaff)
    .map((g) => {
      const lines = direct(g, "path")
        .map((p) =>
          /^M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)/.exec(
            p.getAttribute("d") || ""
          )
        )
        .filter((m) => m && m[2] === m[4]);
      if (!lines.length) return null;
      const ys = lines.map((m) => Number(m![2]));
      return {
        x: Number(lines[0]![1]),
        y: Math.min(...ys),
        width: Number(lines[0]![3]) - Number(lines[0]![1]),
        height: Math.max(...ys) - Math.min(...ys),
      };
    })
    .filter((s): s is Box => s !== null);
  return { doc, spots, orphans, lyrics, staffs, clipped };
}

/**
 * Pass 3b — chọn cỡ chữ VỪA CHỖ SẴN CÓ.
 *
 * Bản nhạc đã khắc xong và không được nới ra, nên khi nhãn dày thì thứ phải nhường
 * là con chữ, không phải ô nhịp. Cỡ lớn nhất mà hai nhãn liền nhau còn không chạm
 * nhau là một phép chia, không phải phép thử.
 */
export function fitLabelPt(pages: PreparedPage[], settings: ScoreSettings) {
  let limit = settings.sizePt * UNITS_PER_PT;
  for (const page of pages) {
    const byRow = new Map<string, Spot[]>();
    for (const spot of page.spots)
      (byRow.get(spot.row) ?? byRow.set(spot.row, []).get(spot.row)!).push(spot);
    for (const row of byRow.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].x - sorted[i - 1].x;
        // Nhãn căn giữa: hai nhãn cạnh nhau chỉ chiếm nửa bề rộng mỗi bên.
        const need =
          ((widthEm(sorted[i - 1].label.label) +
            widthEm(sorted[i].label.label)) /
            2) *
          BREATH;
        if (gap > 0 && need > 0) limit = Math.min(limit, gap / need);
      }
    }
  }
  const pt = Math.min(settings.sizePt, limit / UNITS_PER_PT);
  return {
    pt: Math.max(MIN_LABEL_PT, Math.floor(pt * 4) / 4),
    shrunk: pt < settings.sizePt - 0.001,
  };
}

/** Pass 3c — vẽ nhãn. Không một nốt, vạch nhịp hay ô nhịp nào dịch chuyển ở bước này. */
export function paintPage(
  page: PreparedPage,
  labelPt: number,
  settings: ScoreSettings,
  diagnostics: Diagnostic[],
  resolved: Set<string>
): string {
  const { doc } = page;
  const fontUnits = labelPt * UNITS_PER_PT;
  for (const orphan of page.orphans) orphan.parentNode?.removeChild(orphan);

  // Hai thời điểm khác nhau mà Verovio trả về CÙNG một hoành độ nghĩa là nó không
  // giải được tstamp trong ô đó (ô mRest với nhịp ghi dạng cộng là ca đã biết).
  // Giữ lại nhãn nào trong số đó cũng là đặt nhãn sai chỗ, nên bỏ cả ô.
  const unresolved = new Set<string>();
  const seen = new Map<string, Map<number, string>>();
  for (const spot of page.spots) {
    const key = `${spot.row}|${spot.label.sourceMeasureId}`;
    const slots = seen.get(key) ?? seen.set(key, new Map()).get(key)!;
    const at = Math.round(spot.x);
    const other = slots.get(at);
    if (other !== undefined && other !== spot.label.timestamp)
      unresolved.add(key);
    else slots.set(at, spot.label.timestamp);
  }

  const placed: { label: TemporalAnchor; g: Element; box: Box }[] = [];
  for (const spot of page.spots) {
    if (unresolved.has(`${spot.row}|${spot.label.sourceMeasureId}`)) {
      spot.anchor.parentNode?.removeChild(spot.anchor);
      diagnostics.push({
        sourceId: spot.label.sourceMeasureId,
        code: "TEMPORAL_ANCHOR_NOT_RESOLVED",
        message: `Phách ${spot.label.label}, staff ${spot.label.staff}: bộ khắc trả cùng một vị trí cho nhiều thời điểm trong ô này; đã bỏ nhãn thay vì đặt sai chỗ.`,
      });
      continue;
    }
    const g = doc.createElementNS(SVG, "g");
    g.setAttribute("id", spot.label.id);
    g.setAttribute("class", "dir");
    // Giữ nguyên hình dạng cũ của nhãn để bộ xuất và các phép kiểm tra đọc như trước.
    g.setAttribute("color", settings.color);
    g.setAttribute("fill", settings.color);
    const text = doc.createElementNS(SVG, "text");
    text.setAttribute("x", String(spot.x));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("y", (spot.top + fontUnits * ASCENT).toFixed(2));
    text.setAttribute("font-family", "Times");
    text.setAttribute("font-size", `${fontUnits.toFixed(2)}px`);
    text.setAttribute("font-weight", "bold");
    text.setAttribute("fill", settings.color);
    text.appendChild(doc.createTextNode(spot.label.label));
    g.appendChild(text);
    spot.anchor.parentNode?.replaceChild(g, spot.anchor);
    placed.push({
      label: spot.label,
      g,
      box: {
        x: spot.x - (widthEm(spot.label.label) * fontUnits) / 2,
        y: spot.top,
        width: widthEm(spot.label.label) * fontUnits,
        height: fontUnits * (ASCENT + DESCENT),
      },
    });
  }

  // Hết chỗ thì thứ nhường là con chữ, và nhường theo thứ bậc: phách chính "1 2 3 4"
  // được đặt trước và giữ nguyên; chỉ nhãn phụ "e & a" mới bị ẩn, và chỉ đúng cái
  // không còn chỗ — không ẩn oan cả ô như trước.
  const order = [...placed].sort(
    (a, b) =>
      (a.label.kind === "beat" ? 0 : 1) - (b.label.kind === "beat" ? 0 : 1) ||
      a.box.x - b.box.x
  );
  const kept: Box[] = [];
  for (const { label, g, box } of order) {
    const collision =
      page.lyrics.some((l) => intersects(box, l)) ||
      page.staffs.some((s) => intersects(box, s));
    const outside = page.clipped(box);
    const densityCollision =
      !collision && !outside && kept.some((b) => intersects(box, b));
    if (collision || outside || densityCollision) {
      g.parentNode?.removeChild(g);
      diagnostics.push({
        sourceId: label.sourceMeasureId,
        code: densityCollision
          ? "ANNOTATION_DENSITY_COLLISION"
          : outside
          ? "ANNOTATION_PAGE_CLIPPING"
          : "ANNOTATION_LAYOUT_COLLISION",
        message: `Phách ${label.label}, staff ${label.staff}: ${
          densityCollision
            ? "không còn chỗ cạnh nhãn bên trái; đã ẩn riêng nhãn này. Hãy giảm cỡ chữ hoặc chọn khổ ngang."
            : outside
            ? "vượt mép trang; đã ẩn số và cần kiểm tra bố cục."
            : "chưa đủ khoảng trống; đã ẩn số để tránh đè lời/khuông."
        }`,
      });
    } else {
      kept.push(box);
      resolved.add(label.id);
    }
  }
  return cleanSVG(serialize(doc));
}
