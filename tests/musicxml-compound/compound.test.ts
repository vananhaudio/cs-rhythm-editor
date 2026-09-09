import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { buildBeatMap } from "../../src/musicxml-beats/beatEngine.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { createAnnotations } from "../../src/musicxml-beats/annotations.ts";
import type { CompoundCountingMode } from "../../src/musicxml-beats/annotations.ts";
import {
  meterGrouping,
  groupStarts,
} from "../../src/musicxml-beats/meterGrouping.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import { all, parse } from "../../src/musicxml-beats/renderer/xml.ts";
const fixture = (n: string) =>
  readFileSync(new URL(`./fixtures/${n}.musicxml`, import.meta.url), "utf8");
const expected = JSON.parse(
  readFileSync(new URL("./expected/grids.json", import.meta.url), "utf8")
);
const modes: CompoundCountingMode[] = ["pulses", "compound"];
const grid = (xml: string, mode: CompoundCountingMode) => {
  const map = musicXMLToBeatMap(xml);
  return map.measures.map((m) =>
    createAnnotations(map, "beats", mode)
      .filter((a) => a.sourceMeasureId === m.measureId)
      .map((a) => [a.label, a.offset])
  );
};
for (const name of [
  "simple-6-8",
  "whole-rest",
  "sustained",
  "two-dotted-quarters",
  "six-eighths",
  "syncopation",
  "triplet",
  "duplet",
  "two-voices",
  "lyrics-harmony",
  "beam-3-3",
  "beam-2-2-2",
])
  for (const mode of modes)
    test(`${name}/${mode}: hand-written grid`, () =>
      assert.deepEqual(grid(fixture(name), mode)[0], expected.full[mode]));
for (const name of ["pickup-one", "pickup-three"])
  for (const mode of modes)
    test(`${name}/${mode}: preserves full-bar phase`, () => {
      const map = musicXMLToBeatMap(fixture(name));
      assert.equal(
        map.measures[0].pickupOffset,
        name === "pickup-one" ? "5/2" : "3/2"
      );
      assert.deepEqual(grid(fixture(name), mode), [
        expected[name][mode],
        expected.full[mode],
      ]);
    });
test("grouping preserves 6/8 meter, denominator unit and two dotted-quarter beats", () => {
  const map = musicXMLToBeatMap(fixture("sustained"));
  const m = map.measures[0];
  assert.deepEqual(m.meter, { beats: 6, beatType: 8 });
  assert.equal(m.expectedDuration, "3/1");
  assert.equal(m.actualDuration, "3/1");
  assert.deepEqual(m.grouping, {
    type: "compound",
    unit: "1/2",
    groups: [3, 3],
  });
  assert.deepEqual(groupStarts(m.grouping!), ["0/1", "3/2"]);
  assert.deepEqual(m.beatsMap, [
    { label: "1", offset: "0/1" },
    { label: "2", offset: "3/2" },
  ]);
});
test("legacy low-level profile stays explicit; production facade opts into compound", () => {
  const normalized = parseMusicXML(fixture("sustained"));
  assert.equal(
    buildBeatMap(normalized)[0].diagnostics[0].code,
    "UNSUPPORTED_METER"
  );
  assert.deepEqual(
    buildBeatMap(normalized, "simple-and-compound"),
    musicXMLToBeatMap(fixture("sustained")).measures
  );
});
for (const mode of modes) {
  test(`note/voice/beam independence: ${mode}`, () => {
    for (const name of [
      "whole-rest",
      "sustained",
      "two-voices",
      "triplet",
      "beam-3-3",
      "beam-2-2-2",
    ])
      assert.deepEqual(grid(fixture(name), mode)[0], expected.full[mode]);
  });
  test(`divisions independence: ${mode}`, () => {
    for (const d of [1, 4, 24, 480]) {
      const xml = fixture("sustained")
        .replace("<divisions>12</divisions>", `<divisions>${d}</divisions>`)
        .replace("<duration>36</duration>", `<duration>${d * 3}</duration>`);
      assert.deepEqual(grid(xml, mode)[0], expected.full[mode]);
    }
  });
  test(`4/4 -> 6/8 -> 3/4 -> 6/8 switches every measure: ${mode}`, () =>
    assert.deepEqual(grid(fixture("meter-change"), mode), [
      expected["simple-four"],
      expected.full[mode],
      expected["simple-three"],
      expected.full[mode],
    ]));
}
test("simple subdivision level does not leak into compound modes", () => {
  const m = musicXMLToBeatMap(fixture("sustained"));
  for (const mode of modes)
    assert.deepEqual(
      createAnnotations(m, "sixteenths", mode),
      createAnnotations(m, "beats", mode)
    );
});
// 9/8 và 12/8 được bật ở Giai đoạn 7, 5/8 và 7/8 ở Giai đoạn 8;
// 10/8 và 11/8 vẫn cố ý nằm ngoài.
test("unsupported meters stay unsupported, not inferred from divisibility or beams", () => {
  for (const beats of [10, 11]) {
    assert.equal(meterGrouping({ beats, beatType: 8 }), null);
    const m = musicXMLToBeatMap(
      fixture("sustained").replace(
        "<beats>6</beats>",
        `<beats>${beats}</beats>`
      )
    );
    assert.ok(
      m.measures[0].diagnostics.some((d) => d.code === "UNSUPPORTED_METER")
    );
    assert.deepEqual(createAnnotations(m), []);
  }
});
test("underfull unclassified does not get a guessed compound phase", () => {
  const map = musicXMLToBeatMap(
    fixture("pickup-one").replace('implicit="yes"', "")
  );
  assert.equal(
    map.measures[0].diagnostics[0].code,
    "UNDERFULL_MEASURE_UNCLASSIFIED"
  );
  assert.ok(
    createAnnotations(map).every(
      (a) => a.sourceMeasureId !== map.measures[0].measureId
    )
  );
});
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
for (const mode of modes)
  test(`MEI denominator timestamp and no notation mutation: ${mode}`, () => {
    const xml = fixture("lyrics-harmony");
    const s = renderer.render(xml, {
      ...DEFAULT_SCORE_SETTINGS,
      compoundCountingMode: mode,
    });
    assert.deepEqual(s.diagnostics, []);
    assert.deepEqual(
      s.anchors.map((a) => a.timestamp),
      mode === "pulses" ? ["1", "2", "3", "4", "5", "6"] : ["1", "4"]
    );
    const off = renderer.render(xml, {
      ...DEFAULT_SCORE_SETTINGS,
      showBeats: false,
    });
    for (const tag of ["note", "syl", "harm", "verse"])
      assert.deepEqual(
        all(parse(s.renderedMEI), tag).map((e) => e.toString()),
        all(parse(off.renderedMEI), tag).map((e) => e.toString())
      );
  });
test("mixed meter MEI tstamp is converted per measure, never stale denominator", () => {
  const s = renderer.render(fixture("meter-change"));
  assert.deepEqual(s.diagnostics, []);
  assert.deepEqual(
    s.anchors.map((a) => a.timestamp),
    [
      "1",
      "2",
      "3",
      "4",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "1",
      "2",
      "3",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]
  );
});
test("pickup eighth pulse label 6 resolves to fragment tstamp 1", () => {
  const s = renderer.render(fixture("pickup-one"));
  assert.deepEqual(
    [s.anchors[0].label, s.anchors[0].timestamp, s.anchors[0].offset],
    ["6", "1", "0/1"]
  );
});
for (const mode of modes)
  test(`engraved timestamps align with independently known eighth onsets: ${mode}`, () => {
    const s = renderer.render(fixture("six-eighths"), {
      ...DEFAULT_SCORE_SETTINGS,
      compoundCountingMode: mode,
    });
    const doc = parse(s.pages[0].svg);
    const heads = all(doc, "g")
      .filter((g) => g.getAttribute("class") === "notehead")
      .map((g) =>
        Number(
          all(g, "use")[0]
            .getAttribute("transform")!
            .match(/translate\(([-\d.]+)/)![1]
        )
      );
    assert.equal(heads.length, 6);
    const positions = s.anchors.map((a) =>
      Number(
        all(
          all(doc, "g").find((g) => g.getAttribute("id") === a.id)!,
          "text"
        )[0].getAttribute("x")
      )
    );
    assert.deepEqual(
      positions,
      mode === "pulses" ? heads : [heads[0], heads[3]]
    );
  });
