import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS as defaults } from "../../src/musicxml-beats/renderer/types.ts";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport.ts";
import { all, parse, classes } from "../../src/musicxml-beats/renderer/xml.ts";
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
const fixture = (name: string) =>
  readFileSync(
    new URL(`../musicxml-renderer/fixtures/${name}.musicxml`, import.meta.url),
    "utf8"
  );
const musical = (mei: string) =>
  Object.fromEntries(
    ["note", "syl", "harm", "verse", "mRest", "tie"].map((tag) => [
      tag,
      all(parse(mei), tag).map((e) => ({
        attributes: Array.from(e.attributes)
          .filter((a) => a.name !== "xml:id")
          .map((a) => [a.name, a.value]),
        text: e.textContent?.trim(),
      })),
    ])
  );
test("toggle annotation preserves notes, lyrics and harmony", () => {
  const xml = fixture("lyrics-harmony"),
    on = renderer.render(xml),
    off = renderer.render(xml, { ...defaults, showBeats: false });
  assert.deepEqual(musical(on.renderedMEI), musical(off.renderedMEI));
  assert.equal(on.anchors.length, 4);
  assert.equal(off.anchors.length, 0);
  assert.ok(!off.pages[0].svg.includes("tva-beat-"));
});
test("SVG export contains exactly expected red labels and no bbox debug groups", () => {
  const score = renderer.render(fixture("whole-note")),
    svg = exportScoreSVG(score),
    doc = parse(svg);
  const labels = all(doc, "g").filter((g) =>
    g.getAttribute("id")?.startsWith("tva-beat-")
  );
  assert.deepEqual(
    labels.map((g) => g.textContent?.trim()),
    ["1", "2", "3", "4"]
  );
  assert.ok(labels.every((g) => g.getAttribute("fill") === defaults.color));
  assert.ok(!svg.includes("bounding-box"));
  assert.equal(score.diagnostics.length, 0);
  assert.ok(svg.includes("viewBox"));
});
test("pickup quarter only displays 4 in its initial measure", () => {
  const score = renderer.render(fixture("pickup-quarter"));
  assert.deepEqual(
    score.anchors
      .filter((a) => a.sourceMeasureId.endsWith("measure[1]"))
      .map((a) => a.label),
    ["4"]
  );
});
test("underfull measure omitted while later valid measure remains annotated", () => {
  const xml = fixture("pickup-quarter").replace(' implicit="yes"', "");
  const score = renderer.render(xml);
  assert.ok(
    score.diagnostics.some((d) => d.code === "UNDERFULL_MEASURE_UNCLASSIFIED")
  );
  assert.equal(score.anchors.length, 4);
  assert.ok(
    score.anchors.every((a) => a.sourceMeasureId.endsWith("measure[2]"))
  );
  assert.ok(score.pages.length > 0);
});
test("size/color/distance alter annotation without changing note or lyric content", () => {
  const xml = fixture("lyrics-harmony"),
    base = renderer.render(xml, { ...defaults, distance: 0 }),
    changed = renderer.render(xml, {
      ...defaults,
      color: "#b91c1c",
      sizePt: 10,
      distance: 6,
    });
  assert.deepEqual(musical(base.renderedMEI), musical(changed.renderedMEI));
  assert.ok(changed.pages[0].svg.includes("#b91c1c"));
  assert.equal(changed.anchors.length, 4);
  assert.deepEqual(changed.diagnostics, []);
  const y = (svg: string) =>
    Number(
      all(parse(svg), "g")
        .filter((g) => g.getAttribute("id")?.startsWith("tva-beat-"))
        .flatMap((g) => all(g, "text"))[0]
        .getAttribute("y")
    );
  assert.ok(y(changed.pages[0].svg) > y(base.pages[0].svg));
});
test("multipage SVG export retains every label with unique ids", () => {
  const src = fixture("whole-note"),
    m = src.match(/<measure[\s\S]*?<\/measure>/)![0];
  const xml = src.replace(
    m,
    Array.from({ length: 90 }, (_, i) =>
      m.replace('number="1"', `number="${i + 1}"`)
    ).join("")
  );
  const s = renderer.render(xml);
  assert.ok(s.pages.length > 1);
  assert.equal(s.anchors.length, 360);
  assert.deepEqual(s.diagnostics, []);
  const doc = parse(exportScoreSVG(s)),
    ids = all(doc, "*")
      .map((e) => e.getAttribute("id"))
      .filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    all(doc, "g").filter((g) => g.getAttribute("id")?.includes("tva-beat-"))
      .length,
    360
  );
});
test("melisma keeps baseline syl con=u without editing source lyrics", () => {
  const xml = readFileSync(
    new URL("./fixtures/melisma.musicxml", import.meta.url),
    "utf8"
  );
  const on = renderer.render(xml),
    off = renderer.render(xml, { ...defaults, showBeats: false });
  assert.deepEqual(musical(on.renderedMEI), musical(off.renderedMEI));
  assert.ok(
    all(parse(on.renderedMEI), "syl").some((s) => s.getAttribute("con") === "u")
  );
  assert.equal(on.anchors.length, 8);
});
test("invalid annotation settings are rejected", () => {
  assert.throws(
    () =>
      renderer.render(fixture("whole-note"), {
        ...defaults,
        color: "url(http://x)",
      }),
    /không hợp lệ/
  );
});

test("two staves reserve separate lanes without colliding with the next staff", () => {
  const xml = readFileSync(
    new URL("./fixtures/two-staves.musicxml", import.meta.url),
    "utf8"
  );
  const s = renderer.render(xml);
  assert.equal(s.anchors.length, 8);
  assert.equal(new Set(s.anchors.map((a) => a.staff)).size, 2);
  assert.deepEqual(s.diagnostics, []);
});

test("nonterminating MEI timestamp reports unresolved without approximating it", () => {
  const xml = fixture("whole-note")
    .replace('<measure number="1">', '<measure number="1" implicit="yes">')
    .replace("<divisions>4</divisions>", "<divisions>3</divisions>")
    .replace("<duration>16</duration>", "<duration>4</duration>")
    .replace(
      "<type>whole</type>",
      "<type>half</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>"
    );
  const s = renderer.render(xml);
  assert.ok(s.pages.length > 0);
  assert.equal(s.anchors.length, 0);
  assert.ok(
    s.diagnostics.some((d) => d.code === "TEMPORAL_ANCHOR_NOT_RESOLVED")
  );
});
