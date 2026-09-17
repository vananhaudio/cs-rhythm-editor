import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { createSpikeRenderer } from "../../src/musicxml-beats/renderer/spikeRenderer.ts";
import {
  all,
  byId,
  classes,
  parse,
} from "../../src/musicxml-beats/renderer/xml.ts";
import { staffBottom } from "../../src/musicxml-beats/renderer/svgMapping.ts";
const renderer = await createSpikeRenderer();
after(() => renderer.destroy());
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.musicxml`, import.meta.url), "utf8");
const render = (name: string) => {
  const xml = fixture(name);
  return renderer.render(xml, musicXMLToBeatMap(xml));
};
const expected: Record<string, string[]> = {
  "whole-note": ["1", "2", "3", "4"],
  "whole-measure-rest": ["1", "2", "3", "4"],
  syncopation: ["1", "2", "3", "4"],
  "pickup-quarter": ["4", "1", "2", "3", "4"],
  "lyrics-harmony": ["1", "2", "3", "4"],
};
for (const [name, labels] of Object.entries(expected)) {
  test(`A: ${name} resolves every timestamp below staff without changing imported notation`, () => {
    const r = render(name),
      doc = parse(r.a.svg),
      mei = parse(r.annotatedMEI);
    assert.equal(r.version, "6.3.0-425dd7b");
    assert.deepEqual(
      r.a.resolved.map((b) => b.label),
      labels
    );
    assert.deepEqual(r.a.unresolved, []);
    assert.deepEqual(r.preservation.changedNotationCategories, []);
    assert.deepEqual(r.logs, { import: "", annotation: "" });
    for (const beat of r.a.resolved) {
      const dir = byId(mei, beat.id)!;
      assert.equal(dir.getAttribute("tstamp"), beat.timestamp);
      assert.equal(dir.hasAttribute("startid"), false);
      assert.equal(dir.getAttribute("color"), "#dc2626");
      assert.ok(beat.y > staffBottom(doc, beat.measureId, beat.staff)!);
      const same = r.a.resolved.filter((b) => b.measureId === beat.measureId);
      assert.ok(same.every((b, i) => i === 0 || b.x > same[i - 1].x));
      assert.equal(new Set(same.map((b) => b.y)).size, 1);
    }
  });
}
test("whole-measure rest remains an mRest, with four separate timestamp positions", () => {
  const r = render("whole-measure-rest");
  assert.equal(all(parse(r.originalMEI), "mRest").length, 1);
  assert.equal(all(parse(r.reimportedMEI), "mRest").length, 1);
  assert.equal(new Set(r.a.resolved.map((b) => b.x)).size, 4);
});
test("syncopation beats 2–4 fall between adjacent note origins, never on nearest note", () => {
  const r = render("syncopation"),
    doc = parse(r.a.svg);
  const notes = all(doc, "g").filter(
    (g) => classes(g).includes("note") && !classes(g).includes("bounding-box")
  );
  const xs = notes.map((g) => {
    const head = all(g, "g").find((e) => classes(e).includes("notehead"))!;
    return Number(
      all(head, "use")[0]
        .getAttribute("transform")!
        .match(/translate\(([-\d.]+)/)![1]
    );
  });
  for (let i = 1; i < 4; i++) {
    const x = r.a.resolved[i].x;
    assert.ok(xs[i - 1] < x && x < xs[i]);
    assert.ok(!xs.includes(x));
  }
  const gaps = r.a.resolved.slice(1).map((b, i) => b.x - r.a.resolved[i].x);
  assert.ok(
    new Set(gaps).size > 1,
    "Nonuniform engraving is preserved rather than equal measure-width slicing"
  );
});
test("pickup uses timestamp 1 in the partial measure but displays beat label 4", () => {
  const r = render("pickup-quarter");
  const pickup = r.a.resolved.filter((b) => b.measureIndex === 0);
  assert.equal(pickup.length, 1);
  assert.equal(pickup[0].label, "4");
  assert.equal(pickup[0].timestamp, "1");
  assert.equal(pickup[0].offset, "0/1");
});
test("source lyrics, verses, chord offset, dotted note and lyric extender survive XML import and annotation", () => {
  const r = render("lyrics-harmony"),
    source = parse(fixture("lyrics-harmony")),
    mei = parse(r.reimportedMEI),
    svg = parse(r.a.svg);
  assert.deepEqual(
    all(mei, "syl").map((s) => s.textContent?.trim()),
    all(source, "lyric").flatMap((l) =>
      all(l, "text").map((t) => t.textContent?.trim())
    )
  );
  assert.deepEqual(
    all(mei, "verse").map((v) => v.getAttribute("n")),
    ["1", "2"]
  );
  assert.equal(all(mei, "syl")[1].getAttribute("con"), "u");
  assert.equal(all(mei, "harm")[0].textContent?.trim(), "C");
  assert.equal(all(mei, "harm")[0].getAttribute("tstamp"), "2");
  assert.equal(all(mei, "note")[1].getAttribute("dots"), "1");
  for (const text of ["Thầy Văn Anh", "Âm nhạc"])
    assert.ok(svg.documentElement!.textContent?.includes(text));
  const harmony = all(svg, "g").find(
    (g) => classes(g).includes("harm") && !classes(g).includes("bounding-box")
  )!;
  const harmonyY = Number(all(harmony, "text")[0].getAttribute("y"));
  assert.ok(harmonyY < staffBottom(svg, r.a.resolved[0].measureId, "1")! - 720);
  const lyricYs = all(svg, "g")
    .filter(
      (g) => classes(g).includes("syl") && !classes(g).includes("bounding-box")
    )
    .flatMap((g) => all(g, "text").map((t) => Number(t.getAttribute("y"))));
  assert.ok(
    lyricYs.every((y) => y > r.a.resolved[0].y),
    "Lyrics retain their own lane below annotation"
  );
});
test("B reports missing exact temporal anchors instead of fabricating positions", () => {
  const counts: Record<string, number> = {
    "whole-note": 1,
    "whole-measure-rest": 0,
    syncopation: 1,
    "pickup-quarter": 2,
    "lyrics-harmony": 2,
  };
  for (const [name, n] of Object.entries(counts)) {
    const r = render(name);
    assert.equal(r.b.resolved.length, n);
    assert.equal(r.b.unresolved.length, expected[name].length - n);
    assert.ok(
      r.b.unresolved.every((b) =>
        ["NO_EXACT_TIMEMAP_ONSET", "NO_TEMPORAL_LAYOUT_ORIGIN"].includes(
          b.reason
        )
      )
    );
  }
});
test("renderer refuses a beat-map with diagnostics", () => {
  const xml = fixture("whole-note"),
    map = musicXMLToBeatMap(xml);
  map.measures[0].diagnostics.push({
    code: "TEST",
    sourceId: "test",
    message: "test",
  });
  assert.throws(() => renderer.render(xml, map), /BEAT_MAP_DIAGNOSTICS/);
});
