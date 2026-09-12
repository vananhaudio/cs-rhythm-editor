import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types";
import type { CountingLevel } from "../../src/musicxml-beats/annotations";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport";
import {
  exportScorePDF,
  exportPagePNG,
  downloadBlob,
  loadScoreFonts,
} from "../../src/musicxml-beats/renderer/printExport";
import { zipSync } from "fflate";
const cases: [string, CountingLevel][] = [
  ["whole-note", "beats"],
  ["whole-note", "eighths"],
  ["whole-note", "sixteenths"],
  ["whole-measure-rest", "sixteenths"],
  ["syncopation", "sixteenths"],
  ["triplet", "sixteenths"],
  ["pickup-eighth", "beats"],
  ["pickup-eighth", "eighths"],
  ["pickup-eighth", "sixteenths"],
  ["lyrics-harmony", "beats"],
  ["lyrics-harmony", "eighths"],
  ["lyrics-harmony", "sixteenths"],
  ["page-bottom", "sixteenths"],
];
const results = document.querySelector("#results")!;
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const intersects = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/**
 * Toạ độ SVG thật, KHÔNG phải getBoundingClientRect: trong shadow DOM, client rect
 * của phần tử SVG trả số không đáng tin — hai nhãn nằm cùng một hàng vẫn cho hai
 * client-top lệch nhau, đủ để báo đè nhầm. getBBox đọc thẳng hệ toạ độ bản nhạc.
 */
const bbox = (el: SVGGraphicsElement): Box => {
  const b = el.getBBox();
  return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height };
};
document.querySelector("#run")!.addEventListener("click", async () => {
  const logs: string[] = [];
  let pass = 0,
    fail = 0;
  const files: Record<string, Uint8Array> = {};
  const check = (ok: boolean, message: string) => {
    ok ? pass++ : fail++;
    logs.push(`${ok ? "PASS" : "FAIL"} ${message}`);
    results.textContent = logs.join("\n");
  };
  const renderer = await createAnnotatedScoreRenderer();
  await loadScoreFonts();
  try {
    for (const [name, level] of cases) {
      const key = `${name}-${level}`;
      const xml = await (await fetch(`./fixtures/${name}.musicxml`)).text();
      const score = renderer.render(xml, {
        ...DEFAULT_SCORE_SETTINGS,
        countingLevel: level,
      });
      check(
        !score.diagnostics.length,
        `${key}: no diagnostics (${score.anchors.length} anchors)`
      );
      if (name === "page-bottom")
        check(score.pages.length >= 2, "sixteenth A4 pagination");
      const placement: { page: number; label: string; x: number; y: number }[] =
        [];
      const serialized = exportScoreSVG(score);
      files[`${key}/score.svg`] = new TextEncoder().encode(serialized);
      for (const page of score.pages) {
        const host = document.createElement("div");
        document.body.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        const svg = new DOMParser().parseFromString(
          page.svg,
          "image/svg+xml"
        ).documentElement;
        shadow.append(svg);
        const nodes = [...svg.querySelectorAll('g[id^="tva-beat-"]')];
        const boxes = nodes.map((g) => bbox(g as SVGGraphicsElement));
        // Mép trang cũng phải đọc trong hệ toạ độ bản nhạc: viewBox của
        // definition-scale, dời đi đúng translate của page-margin.
        const view = (
          svg
            .querySelector("svg.definition-scale")
            ?.getAttribute("viewBox") || "0 0 0 0"
        )
          .split(/\s+/)
          .map(Number);
        const shift = /translate\(\s*([\d.]+)[ ,]+([\d.]+)/.exec(
          svg.querySelector("g.page-margin")?.getAttribute("transform") || ""
        );
        const boundary = {
          left: -Number(shift?.[1] ?? 0),
          top: -Number(shift?.[2] ?? 0),
          right: view[2] - Number(shift?.[1] ?? 0),
          bottom: view[3] - Number(shift?.[2] ?? 0),
        };
        check(
          boxes.every((b, i) =>
            boxes.slice(i + 1).every((other) => !intersects(b, other))
          ),
          `${key}/${page.number}: annotation pairs never overlap`
        );
        const lyricNodes = [...svg.querySelectorAll("g.syl")];
        const lyrics = lyricNodes.map((g) => bbox(g as SVGGraphicsElement));
        const lyricHit = boxes.flatMap((b, i) =>
          lyrics.flatMap((l) =>
            intersects(b, l)
              ? [
                  `${nodes[i].id} y=${nodes[i]
                    .querySelector("text")
                    ?.getAttribute("y")} size=${nodes[i]
                    .querySelector("text")
                    ?.getAttribute("font-size")} [${b.top.toFixed(
                    1
                  )}–${b.bottom.toFixed(1)}] × lời y=${lyricNodes[lyrics.indexOf(l)]?.querySelector("text")?.getAttribute("y")} [${l.top.toFixed(
                    1
                  )}–${l.bottom.toFixed(1)}]`,
                ]
              : []
          )
        );
        check(
          lyricHit.length === 0,
          `${key}/${page.number}: no lyric collision${
            lyricHit.length ? " — " + lyricHit[0] : ""
          }`
        );
        check(
          boxes.every(
            (b) =>
              b.right > b.left &&
              b.left >= boundary.left &&
              b.right <= boundary.right &&
              b.top >= boundary.top &&
              b.bottom <= boundary.bottom
          ),
          `${key}/${page.number}: inside page`
        );
        for (const node of nodes) {
          const text = node.querySelector("text") as SVGTextElement;
          const point = new DOMPoint(
            Number(text.getAttribute("x")),
            Number(text.getAttribute("y"))
          ).matrixTransform(text.getCTM()!);
          placement.push({
            page: page.number,
            label: text.textContent!.trim(),
            x: point.x,
            y: point.y,
          });
        }
        const png = await exportPagePNG(page, 1);
        files[`${key}/page-${page.number}.png`] = new Uint8Array(
          await png.arrayBuffer()
        );
        if (
          page.number === 1 &&
          ["whole-note", "pickup-eighth"].includes(name)
        ) {
          const panel = document.createElement("section");
          panel.style.cssText =
            "background:white;margin:20px 0;padding:16px;max-width:1100px";
          const title = document.createElement("h2");
          title.textContent = `${name} · ${level}`;
          panel.append(title);
          const crop = document.createElement("div");
          crop.style.cssText = "height:220px;overflow:hidden";
          const img = new Image();
          img.src = URL.createObjectURL(png);
          img.style.cssText = "width:794px;max-width:none";
          crop.append(img);
          panel.append(crop);
          document.querySelector("#gallery")!.append(panel);
        }
        host.remove();
      }
      check(
        JSON.stringify(placement.map((p) => p.label)) ===
          JSON.stringify(score.anchors.map((a) => a.label)),
        `${key}: preview/SVG all labels in order`
      );
      files[`${key}/score.pdf`] = new Uint8Array(
        await (await exportScorePDF(score)).arrayBuffer()
      );
      files[`${key}/manifest.json`] = new TextEncoder().encode(
        JSON.stringify(
          {
            pages: score.pages.length,
            placement,
            anchors: score.anchors,
            diagnostics: score.diagnostics,
          },
          null,
          2
        )
      );
    }
  } catch (e) {
    check(false, String(e));
  } finally {
    renderer.destroy();
  }
  logs.push(`TOTAL ${pass} PASS, ${fail} FAIL`);
  results.textContent = logs.join("\n");
  files["browser-results.txt"] = new TextEncoder().encode(results.textContent);
  downloadBlob(
    new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
      type: "application/zip",
    }),
    "musicxml-subdivision-acceptance.zip"
  );
});
