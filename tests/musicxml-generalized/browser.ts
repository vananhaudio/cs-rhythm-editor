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
const names = [
  "basic-9-8",
  "basic-12-8",
  "whole-rest-9-8",
  "whole-rest-12-8",
  "sustained-12-8",
  "syncopation-12-8",
  "tuplet-9-8",
  "two-voices-12-8",
  "pickup-9-8",
  "pickup-12-8",
  "lyrics-harmony-9-8",
  "lyrics-harmony-12-8",
  "mixed-meter",
  "stress-12-8",
];
const modes: CompoundCountingMode[] = ["pulses", "compound"];
const cases: [string, CompoundCountingMode][] = names.flatMap((n) =>
  modes.map((m) => [n, m] as [string, CompoundCountingMode])
);
// Label totals derived from the meter alone, never from the rendered output.
const totals: Record<string, Record<CompoundCountingMode, number>> = {
  "basic-9-8": { pulses: 9, compound: 3 },
  "basic-12-8": { pulses: 12, compound: 4 },
  "whole-rest-9-8": { pulses: 9, compound: 3 },
  "whole-rest-12-8": { pulses: 12, compound: 4 },
  "sustained-12-8": { pulses: 12, compound: 4 },
  "syncopation-12-8": { pulses: 12, compound: 4 },
  "tuplet-9-8": { pulses: 9, compound: 3 },
  "two-voices-12-8": { pulses: 12, compound: 4 },
  "pickup-9-8": { pulses: 10, compound: 3 },
  "pickup-12-8": { pulses: 14, compound: 4 },
  "lyrics-harmony-9-8": { pulses: 9, compound: 3 },
  "lyrics-harmony-12-8": { pulses: 12, compound: 4 },
  "mixed-meter": { pulses: 40, compound: 18 },
  "stress-12-8": { pulses: 1200, compound: 400 },
};
const results = document.querySelector("#results")!;
const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
async function run() {
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
    for (const [name, mode] of cases) {
      const key = `${name}-${mode}`;
      const xml = await (await fetch(`./fixtures/${name}.musicxml`)).text();
      const score = renderer.render(xml, {
        ...DEFAULT_SCORE_SETTINGS,
        compoundCountingMode: mode,
      });
      check(!score.diagnostics.length, `${key}: no diagnostics`);
      check(
        score.anchors.length === totals[name][mode],
        `${key}: ${score.anchors.length}/${totals[name][mode]} anchors from meter alone`
      );
      if (name === "stress-12-8")
        check(score.pages.length >= 2, `${key}: A4 pagination (${score.pages.length} trang)`);
      const placement: { page: number; label: string; x: number; y: number }[] =
        [];
      files[`${key}/score.svg`] = new TextEncoder().encode(
        exportScoreSVG(score)
      );
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
        for (const [sel, what] of [
          ["g.syl", "lyric"],
          ["g.harm", "harmony"],
        ] as const) {
          const others = [...svg.querySelectorAll(sel)].map((g) =>
            g.getBoundingClientRect()
          );
          check(
            boxes.every((b) => others.every((o) => !intersects(b, o))),
            `${key}/${page.number}: no ${what} collision`
          );
        }
        check(
          boxes.every(
            (b) =>
              b.width > 0 &&
              b.left >= boundary.left &&
              b.right <= boundary.right &&
              b.top >= boundary.top &&
              b.bottom <= boundary.bottom
          ),
          `${key}/${page.number}: inside page, no clipping`
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
          ["basic-9-8", "basic-12-8", "pickup-12-8", "mixed-meter"].includes(
            name
          )
        ) {
          const panel = document.createElement("section");
          panel.style.cssText =
            "background:white;margin:20px 0;padding:16px;max-width:1100px";
          const title = document.createElement("h2");
          title.textContent = `${name} · ${mode}`;
          panel.append(title);
          const crop = document.createElement("div");
          crop.style.cssText = "height:210px;overflow:hidden";
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
        placement.length === totals[name][mode],
        `${key}: ${placement.length}/${totals[name][mode]} labels engraved across all pages`
      );
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
  const zip = new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
  (window as unknown as Record<string, unknown>).__ACCEPTANCE__ = {
    pass,
    fail,
    text: results.textContent,
  };
  // Optional sink so the artifacts can land on disk without a manual download.
  const sink = new URLSearchParams(location.search).get("sink");
  if (sink)
    await fetch(sink, {
      method: "POST",
      body: new Blob([await zip.arrayBuffer()], { type: "text/plain" }),
    }).catch(() => {});
  else downloadBlob(zip, "musicxml-generalized-acceptance.zip");
}
document.querySelector("#run")!.addEventListener("click", run);
if (new URLSearchParams(location.search).has("auto")) run();
