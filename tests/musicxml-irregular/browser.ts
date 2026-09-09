import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types";
import type { CompoundCountingMode } from "../../src/musicxml-beats/annotations";
import type { GroupingSelection } from "../../src/musicxml-beats/meterGrouping";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport";
import {
  exportScorePDF,
  exportPagePNG,
  downloadBlob,
  loadScoreFonts,
} from "../../src/musicxml-beats/renderer/printExport";
import { zipSync } from "fflate";
const modes: CompoundCountingMode[] = ["pulses", "compound"];
// Số nhãn suy từ nhịp + cách chia, KHÔNG lấy từ bản khắc đang kiểm.
const cases: {
  name: string;
  totals: Record<CompoundCountingMode, number>;
  grouping?: GroupingSelection;
}[] = [
  { name: "five-2-3", totals: { pulses: 5, compound: 2 } },
  { name: "five-3-2", totals: { pulses: 5, compound: 2 } },
  { name: "five-plain", totals: { pulses: 5, compound: 0 } },
  {
    name: "five-plain",
    totals: { pulses: 5, compound: 2 },
    grouping: { byMeter: { "5/8": [3, 2] } },
  },
  { name: "seven-2-2-3", totals: { pulses: 7, compound: 3 } },
  { name: "seven-2-3-2", totals: { pulses: 7, compound: 3 } },
  { name: "seven-3-2-2", totals: { pulses: 7, compound: 3 } },
  { name: "seven-plain", totals: { pulses: 7, compound: 0 } },
  // Lặng cả ô: dùng nhịp ghi thường + người dùng chọn cách chia. Bản ghi dạng cộng
  // (five-2-3-whole-rest) vướng giới hạn tstamp của Verovio với mRest — đã khoá
  // bằng test Node riêng, không đưa vào bộ artifact.
  {
    name: "five-plain-whole-rest",
    totals: { pulses: 5, compound: 2 },
    grouping: { byMeter: { "5/8": [2, 3] } },
  },
  {
    name: "seven-plain-whole-rest",
    totals: { pulses: 7, compound: 3 },
    grouping: { byMeter: { "7/8": [3, 2, 2] } },
  },
  { name: "five-2-3-sustained", totals: { pulses: 5, compound: 2 } },
  { name: "five-2-3-syncopation", totals: { pulses: 5, compound: 2 } },
  { name: "five-2-3-two-voices", totals: { pulses: 5, compound: 2 } },
  { name: "five-2-3-tuplet", totals: { pulses: 5, compound: 2 } },
  { name: "five-2-3-lyrics", totals: { pulses: 5, compound: 2 } },
  { name: "seven-2-2-3-lyrics", totals: { pulses: 7, compound: 3 } },
  { name: "pickup-five-2-2-3", totals: { pulses: 7, compound: 2 } },
  { name: "pickup-five-2-3-2", totals: { pulses: 7, compound: 3 } },
  { name: "pickup-seven-2-2-3", totals: { pulses: 11, compound: 4 } },
  { name: "pickup-seven-2-3-2", totals: { pulses: 11, compound: 4 } },
  { name: "pickup-seven-3-2-2", totals: { pulses: 11, compound: 5 } },
  { name: "grouping-change", totals: { pulses: 14, compound: 6 } },
  { name: "mixed-meter", totals: { pulses: 49, compound: 23 } },
  { name: "stress-seven", totals: { pulses: 700, compound: 300 } },
];
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
    for (const item of cases)
      for (const mode of modes) {
        const suffix = item.grouping ? "-user" : "";
        const key = `${item.name}${suffix}-${mode}`;
        const xml = await (
          await fetch(`./fixtures/${item.name}.musicxml`)
        ).text();
        const score = renderer.render(xml, {
          ...DEFAULT_SCORE_SETTINGS,
          compoundCountingMode: mode,
          grouping: item.grouping,
        });
        check(!score.diagnostics.length, `${key}: no diagnostics`);
        check(
          score.anchors.length === item.totals[mode],
          `${key}: ${score.anchors.length}/${item.totals[mode]} anchors from meter+grouping alone`
        );
        // Chưa chọn cách chia thì KHÔNG được có nhãn phách lớn nào, và phải có notice.
        if (item.totals[mode] === 0 && mode === "compound")
          check(
            score.notices.some((n) => n.code === "IRREGULAR_GROUPING_REQUIRED"),
            `${key}: notice IRREGULAR_GROUPING_REQUIRED`
          );
        if (item.name === "stress-seven")
          check(
            score.pages.length >= 2,
            `${key}: A4 pagination (${score.pages.length} trang)`
          );
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
            ["five-2-3", "five-3-2", "seven-3-2-2", "grouping-change"].includes(
              item.name
            )
          ) {
            const panel = document.createElement("section");
            panel.style.cssText =
              "background:white;margin:20px 0;padding:16px;max-width:1100px";
            const title = document.createElement("h2");
            title.textContent = `${item.name} · ${mode}`;
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
          placement.length === item.totals[mode],
          `${key}: ${placement.length}/${item.totals[mode]} labels engraved across all pages`
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
              notices: score.notices,
              groups: score.beatMap.measures.map((m) => m.groups ?? null),
              groupingSource: score.beatMap.measures.map(
                (m) => m.groupingSource ?? null
              ),
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
  const sink = new URLSearchParams(location.search).get("sink");
  if (sink)
    await fetch(sink, {
      method: "POST",
      body: new Blob([await zip.arrayBuffer()], { type: "text/plain" }),
    }).catch(() => {});
  else downloadBlob(zip, "musicxml-irregular-acceptance.zip");
}
document.querySelector("#run")!.addEventListener("click", run);
if (new URLSearchParams(location.search).has("auto")) run();
