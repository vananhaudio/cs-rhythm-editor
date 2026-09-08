import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport.ts";
import {
  pngDimensions,
  pageDimensions,
  exportSVGPages,
} from "../../src/musicxml-beats/renderer/printExport.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import { unzipSync } from "fflate";
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
const xml = readFileSync(
  new URL("./fixtures/lyrics-harmony.musicxml", import.meta.url),
  "utf8"
);
test("A4 portrait and landscape physical size from same layout", () => {
  for (const orientation of ["portrait", "landscape"] as const) {
    const score = renderer.render(xml, {
      ...DEFAULT_SCORE_SETTINGS,
      orientation,
    });
    assert.deepEqual(
      pageDimensions(score.pages[0]),
      orientation === "portrait"
        ? { widthMm: 210, heightMm: 297 }
        : { widthMm: 297, heightMm: 210 }
    );
    assert.equal(score.anchors.length, 4);
    assert.deepEqual(score.diagnostics, []);
  }
});
test("PNG dimensions 1x and 2x, no timeline rounding involved", () => {
  const page = renderer.render(xml).pages[0];
  assert.deepEqual(pngDimensions(page, 1), { width: 794, height: 1123 });
  assert.deepEqual(pngDimensions(page, 2), { width: 1588, height: 2246 });
  assert.throws(() => pngDimensions(page, 3 as 1));
});
test("standalone SVG pins physical paper, embeds font and keeps Unicode", () => {
  const svg = exportScoreSVG(renderer.render(xml));
  assert.match(svg, /width="210mm"/);
  assert.match(svg, /height="297mm"/);
  assert.match(svg, /data:font\/ttf;base64,/);
  assert.match(svg, /Thầy Văn Anh/);
  assert.doesNotMatch(svg, /font-family="Times/);
  assert.doesNotMatch(svg, /href="https?:/);
});
test("multipage SVG download contains independent A4 pages", async () => {
  const score = renderer.render(
    readFileSync(
      new URL("./fixtures/long-a4.musicxml", import.meta.url),
      "utf8"
    )
  );
  const result = await exportSVGPages(score);
  assert.equal(result.extension, "zip");
  const pages = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal(Object.keys(pages).length, score.pages.length);
  for (const page of Object.values(pages))
    assert.match(new TextDecoder().decode(page), /width="210mm"/);
});
