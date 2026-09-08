import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { createSpikeRenderer } from "../../src/musicxml-beats/renderer/spikeRenderer.ts";
import {
  all,
  parse,
  serialize,
} from "../../src/musicxml-beats/renderer/xml.ts";
export const CASES = [
  "whole-note",
  "whole-measure-rest",
  "syncopation",
  "pickup-quarter",
  "lyrics-harmony",
];
const TITLES: Record<string, string> = {
  "whole-note": "1. Nốt tròn 4/4 — đủ 1 2 3 4",
  "whole-measure-rest": "2. Lặng cả ô 4/4 — đủ 1 2 3 4",
  syncopation: "3. Đảo phách — số không bám đầu nốt",
  "pickup-quarter": "4. Lấy đà một phách — ô đầu chỉ có 4",
  "lyrics-harmony": "5. Giữ lời tiếng Việt và hợp âm C",
};
/** Review artifact only: original renderer SVGs embedded without coordinate edits. */
function reviewSheet(out: URL) {
  let y = 55;
  const panels: string[] = [];
  for (const name of CASES) {
    const doc = parse(readFileSync(new URL(`${name}.A.svg`, out), "utf8"));
    const root = doc.documentElement!;
    const height = parseFloat(root.getAttribute("height")!);
    root.setAttribute("x", "20");
    root.setAttribute("y", String(y + 22));
    // Verovio seed is fixed for comparison. Namespace IDs when assembling one document.
    const ids = [root, ...all(root, "*")]
      .map((e) => e.getAttribute("id"))
      .filter((s): s is string => !!s);
    let svg = serialize(doc);
    for (const value of ids) {
      svg = svg
        .replaceAll(`id="${value}"`, `id="${name}-${value}"`)
        .replaceAll(`#${value}`, `#${name}-${value}`);
    }
    panels.push(
      `<text x="30" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="#18181b">${TITLES[name]}</text>${svg}`
    );
    y += height + 75;
  }
  writeFileSync(
    new URL("review.svg", out),
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="760" height="${y}" viewBox="0 0 760 ${y}"><rect width="760" height="${y}" fill="white"/>${panels.join(
      ""
    )}</svg>`
  );
}
export async function runSpike() {
  const out = new URL(
    "../../docs/musicxml-renderer-spike/output/",
    import.meta.url
  );
  mkdirSync(out, { recursive: true });
  const renderer = await createSpikeRenderer();
  const reports = [];
  try {
    for (const name of CASES) {
      const xml = readFileSync(
        new URL(`./fixtures/${name}.musicxml`, import.meta.url),
        "utf8"
      );
      const map = musicXMLToBeatMap(xml),
        r = renderer.render(xml, map);
      for (const [suffix, data] of Object.entries({
        "source.musicxml": xml,
        "baseline.svg": r.baselineSVG,
        "A.svg": r.a.svg,
        "B.svg": r.b.svg,
        "baseline.mei": r.originalMEI,
        "A.mei": r.annotatedMEI,
        "beat-map.json": JSON.stringify(map, null, 2),
      }))
        writeFileSync(new URL(`${name}.${suffix}`, out), data);
      const report = {
        name,
        version: r.version,
        a: { resolved: r.a.resolved, unresolved: r.a.unresolved },
        b: { resolved: r.b.resolved, unresolved: r.b.unresolved },
        timemap: r.timemap,
        preservation: r.preservation,
        logs: r.logs,
      };
      writeFileSync(
        new URL(`${name}.report.json`, out),
        JSON.stringify(report, null, 2) + "\n"
      );
      reports.push(report);
      console.log(
        `${name}: A ${r.a.resolved.length}/${
          r.a.resolved.length + r.a.unresolved.length
        }, B ${r.b.resolved.length}/${
          r.b.resolved.length + r.b.unresolved.length
        }, changed=${
          r.preservation.changedNotationCategories.join(",") || "none"
        }`
      );
    }
  } finally {
    renderer.destroy();
  }
  writeFileSync(
    new URL("summary.json", out),
    JSON.stringify(
      reports.map((r) => ({
        name: r.name,
        version: r.version,
        aResolved: r.a.resolved.length,
        aUnresolved: r.a.unresolved,
        bResolved: r.b.resolved.length,
        bUnresolved: r.b.unresolved.map((b) => ({
          measure: b.measureIndex + 1,
          beat: b.label,
          reason: b.reason,
        })),
        changed: r.preservation.changedNotationCategories,
        logs: r.logs,
      })),
      null,
      2
    ) + "\n"
  );
  reviewSheet(out);
  return reports;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await runSpike();
