import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types";
import type { CompoundCountingMode } from "../../src/musicxml-beats/annotations";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport";
import {
  exportScorePDF,
  exportPagePNG,
  downloadBlob,
  loadScoreFonts,
} from "../../src/musicxml-beats/renderer/printExport";
import { zipSync } from "fflate";
const cases: [string, CompoundCountingMode][] = [
  ["sustained", "pulses"],
  ["sustained", "compound"],
  ["whole-rest", "pulses"],
  ["whole-rest", "compound"],
  ["pickup-one", "pulses"],
  ["pickup-one", "compound"],
  ["pickup-three", "pulses"],
  ["pickup-three", "compound"],
  ["lyrics-harmony", "pulses"],
  ["lyrics-harmony", "compound"],
  ["meter-change", "pulses"],
  ["meter-change", "compound"],
  ["long-lyrics", "pulses"],
  ["long-lyrics", "compound"],
];
const results = document.querySelector("#results")!;
const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
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
        compoundCountingMode: level,
      });
      check(
        !score.diagnostics.length,
        `${key}: no diagnostics (${score.anchors.length} anchors)`
      );
      if (name === "long-lyrics")
        check(score.pages.length >= 2, "compound A4 pagination");
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
        const boxes = nodes.map((g) => g.getBoundingClientRect());
        const boundary = svg.getBoundingClientRect();
        check(
          boxes.every((b, i) =>
            boxes.slice(i + 1).every((other) => !intersects(b, other))
          ),
          `${key}/${page.number}: annotation pairs never overlap`
        );
        const lyrics = [...svg.querySelectorAll("g.syl")].map((g) =>
          g.getBoundingClientRect()
        );
        check(
          boxes.every((b) => lyrics.every((l) => !intersects(b, l))),
          `${key}/${page.number}: no lyric collision`
        );
        check(
          boxes.every(
            (b) =>
              b.width > 0 &&
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
        if (page.number === 1 && ["sustained", "pickup-one"].includes(name)) {
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
    "musicxml-compound-acceptance.zip"
  );
});
