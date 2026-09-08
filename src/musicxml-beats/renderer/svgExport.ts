import { scoreFonts } from "./fontData.ts";
import type { ScoreExportSource } from "./types.ts";
import { all, parse, serialize, SVG } from "./xml.ts";
/** Export and preview share self-contained SVG; source XML never becomes HTML. */
export function cleanSVG(svg: string): string {
  const doc = parse(svg),
    root = doc.documentElement!;
  for (const e of all(root, "*")) {
    if (
      ["script", "foreignObject", "image", "a"].includes(e.localName || "") ||
      (e.getAttribute("class") || "")
        .split(/\s+/)
        .some((c) => c.endsWith("bounding-box"))
    ) {
      e.parentNode?.removeChild(e);
      continue;
    }
    for (const a of Array.from(e.attributes)) {
      if (
        /^on/i.test(a.name) ||
        ((a.localName === "href" || a.name === "href") &&
          !a.value.startsWith("#"))
      )
        e.removeAttribute(a.name);
    }
  }
  // Explicitly pin ALL text to a bundled, Times-metric-compatible font.
  for (const e of [root, ...all(root, "*")]) {
    if (e.hasAttribute("font-family"))
      e.setAttribute("font-family", "ScoreSerif");
  }
  const fonts = doc.createElementNS(SVG, "style");
  fonts.textContent = Object.entries(scoreFonts)
    .map(
      ([style, data]) =>
        `@font-face{font-family:ScoreSerif;font-style:${
          style.includes("italic") ? "italic" : "normal"
        };font-weight:${
          style.includes("bold") ? "bold" : "normal"
        };src:url(data:font/ttf;base64,${data}) format('truetype');}`
    )
    .join("");
  root.insertBefore(fonts, root.firstChild);
  root.setAttribute("xmlns", SVG);
  root.setAttribute("style", "background:white");
  const width = parseFloat(root.getAttribute("width") || "0"),
    height = parseFloat(root.getAttribute("height") || "0");
  root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return serialize(doc);
}
/** One download for a multipage score: vertically stack unchanged SVG pages at native sizes. */
export function exportScoreSVG(source: ScoreExportSource): string {
  if (!source.pages.length) throw new Error("Không có trang để xuất.");
  if (source.pages.length === 1) {
    const doc = parse(source.pages[0].svg);
    doc.documentElement!.setAttribute(
      "width",
      `${source.pages[0].width / 5}mm`
    );
    doc.documentElement!.setAttribute(
      "height",
      `${source.pages[0].height / 5}mm`
    );
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(doc);
  }
  const width = Math.max(...source.pages.map((p) => p.width));
  const height = source.pages.reduce((sum, p) => sum + p.height, 0);
  const doc = parse(
      `<svg xmlns="${SVG}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"/>`
    ),
    root = doc.documentElement!;
  const bg = doc.createElementNS(SVG, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "white");
  root.appendChild(bg);
  let y = 0;
  for (const page of source.pages) {
    const parsed = parse(page.svg);
    let xml = serialize(parsed);
    for (const e of [parsed.documentElement!, ...all(parsed, "*")]) {
      const value = e.getAttribute("id");
      if (!value) continue;
      xml = xml
        .replaceAll(`id="${value}"`, `id="page-${page.number}-${value}"`)
        .replaceAll(`#${value}`, `#page-${page.number}-${value}`);
    }
    const nested = parse(xml).documentElement!;
    nested.setAttribute("x", "0");
    nested.setAttribute("y", String(y));
    root.appendChild(doc.importNode(nested, true));
    y += page.height;
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(doc);
}
export function downloadText(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
