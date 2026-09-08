import { exportScoreSVG } from "./svgExport.ts";
import type { ScoreExportSource, ScorePage } from "./types.ts";
import { scoreFonts } from "./fontData.ts";

/** Verovio at scale 50: five SVG units per physical millimetre. */
export function pageDimensions(page: ScorePage) {
  return { widthMm: page.width / 5, heightMm: page.height / 5 };
}
export function pngDimensions(page: ScorePage, scale: 1 | 2) {
  if (scale !== 1 && scale !== 2) throw new Error("PNG chỉ hỗ trợ 1x hoặc 2x.");
  const mm = pageDimensions(page);
  return {
    width: Math.round((mm.widthMm * 96) / 25.4) * scale,
    height: Math.round((mm.heightMm * 96) / 25.4) * scale,
  };
}
let ready: Promise<void> | undefined;
export function loadScoreFonts() {
  return (ready ??= Promise.all(
    Object.entries(scoreFonts).map(async ([style, data]) => {
      const face = new FontFace(
        "ScoreSerif",
        `url(data:font/ttf;base64,${data})`,
        {
          style: style.includes("italic") ? "italic" : "normal",
          weight: style.includes("bold") ? "bold" : "normal",
        }
      );
      document.fonts.add(await face.load());
    })
  )
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));
}
/** Vector paths + embedded Unicode text; no screenshot/raster page in the PDF. */
export async function exportScorePDF(source: ScoreExportSource): Promise<Blob> {
  if (!source.pages.length) throw new Error("Không có trang để xuất.");
  const [{ jsPDF }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
    loadScoreFonts(),
  ]);
  const first = pageDimensions(source.pages[0]);
  const pdf = new jsPDF({
    unit: "mm",
    format: [first.widthMm, first.heightMm],
    orientation: first.widthMm > first.heightMm ? "landscape" : "portrait",
    compress: true,
    putOnlyUsedFonts: true,
  });
  for (const [style, data] of Object.entries(scoreFonts)) {
    pdf.addFileToVFS(`${style}.ttf`, data);
    pdf.addFont(`${style}.ttf`, "ScoreSerif", style);
  }
  for (const [index, page] of source.pages.entries()) {
    const mm = pageDimensions(page);
    if (index)
      pdf.addPage(
        [mm.widthMm, mm.heightMm],
        mm.widthMm > mm.heightMm ? "landscape" : "portrait"
      );
    const svg = new DOMParser().parseFromString(
      page.svg,
      "image/svg+xml"
    ).documentElement;
    // svg2pdf does not inherit the outer viewBox viewport for nested SVGs.
    // Make the existing 100% viewport explicit, without altering music coordinates.
    for (const nested of svg.querySelectorAll("svg.definition-scale")) {
      nested.setAttribute("width", String(page.width));
      nested.setAttribute("height", String(page.height));
    }
    // Work on a detached artifact; never clone the React preview or its CSS.
    await pdf.svg(svg, { x: 0, y: 0, width: mm.widthMm, height: mm.heightMm });
  }
  return pdf.output("blob");
}
/** Browser SVG rasterizer uses the exact SVG page and its embedded font data. */
export async function exportPagePNG(
  page: ScorePage,
  scale: 1 | 2
): Promise<Blob> {
  const size = pngDimensions(page, scale);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Thiết bị không hỗ trợ xuất PNG.");
  const url = URL.createObjectURL(
    new Blob([page.svg], { type: "image/svg+xml" })
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Không tạo được PNG.")),
        "image/png"
      )
    );
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
export async function exportScorePNG(
  source: ScoreExportSource,
  scale: 1 | 2
): Promise<{ blob: Blob; extension: string }> {
  if (!source.pages.length) throw new Error("Không có trang để xuất.");
  if (source.pages.length === 1)
    return {
      blob: await exportPagePNG(source.pages[0], scale),
      extension: "png",
    };
  const { zipSync } = await import("fflate");
  const pages: Record<string, Uint8Array> = {};
  for (const page of source.pages)
    pages[`trang-${String(page.number).padStart(3, "0")}.png`] = new Uint8Array(
      await (await exportPagePNG(page, scale)).arrayBuffer()
    );
  return {
    blob: new Blob([zipSync(pages, { level: 0 }) as Uint8Array<ArrayBuffer>], {
      type: "application/zip",
    }),
    extension: "zip",
  };
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Separate A4 SVG artifacts per page; the legacy combined SVG remains available for debugging. */
export async function exportSVGPages(
  source: ScoreExportSource
): Promise<{ blob: Blob; extension: string }> {
  if (!source.pages.length) throw new Error("Không có trang để xuất.");
  if (source.pages.length === 1)
    return {
      blob: new Blob([exportScoreSVG(source)], { type: "image/svg+xml" }),
      extension: "svg",
    };
  const { zipSync } = await import("fflate");
  const files = Object.fromEntries(
    source.pages.map((page) => [
      `trang-${String(page.number).padStart(3, "0")}.svg`,
      new TextEncoder().encode(exportScoreSVG({ pages: [page] })),
    ])
  );
  return {
    blob: new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
      type: "application/zip",
    }),
    extension: "zip",
  };
}
