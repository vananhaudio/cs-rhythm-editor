import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport";
import {
  exportScorePDF,
  exportPagePNG,
  downloadBlob,
  pngDimensions,
} from "../../src/musicxml-beats/renderer/printExport";
import { zipSync } from "fflate";
const names = [
  "short",
  "whole-note",
  "whole-measure-rest",
  "syncopation",
  "pickup-quarter",
  "lyrics-harmony",
  "two-lyrics",
  "long-a4",
  "page-bottom",
];
const results = document.querySelector("#results")!;
document.querySelector("#run")!.addEventListener("click", async () => {
  const logs: string[] = [];
  let pass = 0,
    fail = 0;
  const check = (ok: boolean, label: string) => {
    ok ? pass++ : fail++;
    logs.push(`${ok ? "PASS" : "FAIL"} ${label}`);
    results.textContent = logs.join("\n");
  };
  const artifacts: Record<string, Uint8Array> = {};
  const renderer = await createAnnotatedScoreRenderer();
  try {
    for (const name of names) {
      const xml = await (await fetch(`./fixtures/${name}.musicxml`)).text();
      const score = renderer.render(xml);
      check(score.diagnostics.length === 0, `${name}: no diagnostics`);
      check(
        score.pages.every((p) => p.width === 1050 && p.height === 1485),
        `${name}: A4 portrait dimensions`
      );
      if (name === "long-a4")
        check(score.pages.length >= 2, "long-a4: multiple pages");
      artifacts[`${name}/score.svg`] = new TextEncoder().encode(
        exportScoreSVG(score)
      );
      artifacts[`${name}/score.pdf`] = new Uint8Array(
        await (await exportScorePDF(score)).arrayBuffer()
      );
      check(
        new TextDecoder().decode(artifacts[`${name}/score.pdf`].slice(0, 5)) ===
          "%PDF-",
        `${name}: PDF created`
      );
      let labels = 0;
      const placement: { page: number; label: string; x: number; y: number }[] =
        [];
      for (const page of score.pages) {
        const svg = new DOMParser().parseFromString(
          page.svg,
          "image/svg+xml"
        ).documentElement;
        check(
          svg.querySelectorAll("style").length >= 1 &&
            page.svg.includes("data:font/ttf;base64,"),
          `${name}/${page.number}: font embedded`
        );
        // A separate shadow root isolates host React CSS; only the standalone artifact is measured.
        const host = document.createElement("div");
        document.body.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.append(svg);
        const boundary = svg.getBoundingClientRect();
        const annotations = [...svg.querySelectorAll('g[id^="tva-beat-"]')];
        labels += annotations.length;
        for (const g of annotations) {
          const text = g.querySelector("text") as SVGTextElement;
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
        check(
          annotations.every((g) => {
            const r = g.getBoundingClientRect();
            return (
              r.width > 0 &&
              r.left >= boundary.left &&
              r.top >= boundary.top &&
              r.right <= boundary.right &&
              r.bottom <= boundary.bottom
            );
          }),
          `${name}/${page.number}: no clipped annotations`
        );
        const png = await exportPagePNG(page, 1);
        artifacts[`${name}/page-${page.number}.png`] = new Uint8Array(
          await png.arrayBuffer()
        );
        const bitmap = await createImageBitmap(png);
        const size = pngDimensions(page, 1);
        check(
          bitmap.width === size.width && bitmap.height === size.height,
          `${name}/${page.number}: PNG dimensions`
        );
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] > 120 && pixels[i + 1] < 100 && pixels[i + 2] < 100)
            red++;
        check(red > 0, `${name}/${page.number}: PNG red annotations`);
        bitmap.close();
        host.remove();
      }
      check(labels === score.anchors.length, `${name}: all annotations in SVG`);
      artifacts[`${name}/manifest.json`] = new TextEncoder().encode(
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
      if (name === "lyrics-harmony") {
        check(
          score.pages[0].svg.includes("Thầy Văn Anh") &&
            score.pages[0].svg.includes("Âm nhạc"),
          "Vietnamese Unicode in standalone SVG"
        );
        const twice = await exportPagePNG(score.pages[0], 2);
        const bitmap = await createImageBitmap(twice);
        check(
          bitmap.width === 1588 && bitmap.height === 2246,
          "PNG 2x dimensions"
        );
        bitmap.close();
        artifacts[`${name}/page-1-2x.png`] = new Uint8Array(
          await twice.arrayBuffer()
        );
      }
    }
  } catch (e) {
    check(false, String(e));
  } finally {
    renderer.destroy();
  }
  logs.push(`TOTAL ${pass} PASS, ${fail} FAIL`);
  results.textContent = logs.join("\n");
  artifacts["browser-results.txt"] = new TextEncoder().encode(
    results.textContent
  );
  downloadBlob(
    new Blob([zipSync(artifacts) as Uint8Array<ArrayBuffer>], {
      type: "application/zip",
    }),
    "musicxml-print-acceptance.zip"
  );
});
