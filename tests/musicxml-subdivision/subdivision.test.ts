import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotations } from "../../src/musicxml-beats/annotations.ts";
import type { CountingLevel } from "../../src/musicxml-beats/annotations.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import { all, parse } from "../../src/musicxml-beats/renderer/xml.ts";
const fixture = (n: string) =>
  readFileSync(new URL(`./fixtures/${n}.musicxml`, import.meta.url), "utf8");
// This table is authored from the counting rules, not captured from engine output.
const expected = JSON.parse(
  readFileSync(new URL("./expected/grids.json", import.meta.url), "utf8")
);
const levels: CountingLevel[] = ["beats", "eighths", "sixteenths"];
const grid = (xml: string, level: CountingLevel) => {
  const map = musicXMLToBeatMap(xml);
  return createAnnotations(map, level)
    .filter((a) => a.sourceMeasureId === map.measures[0].measureId)
    .map((a) => [a.label, a.offset]);
};
for (const [name, key] of [
  ["simple-2-4", "2/4"],
  ["simple-3-4", "3/4"],
  ["simple-4-4", "4/4"],
  ["whole-note", "4/4"],
  ["whole-measure-rest", "4/4"],
  ["syncopation", "4/4"],
  ["dotted", "4/4"],
  ["triplet", "4/4"],
  ["two-voices-backup", "4/4"],
  ["pickup-quarter", "pickup-quarter"],
  ["pickup-eighth", "pickup-eighth"],
  ["lyrics-harmony", "4/4"],
])
  for (const level of levels)
    test(`${name}: ${level} matches hand-authored grid`, () =>
      assert.deepEqual(grid(fixture(name), level), expected[key][level]));
for (const level of levels) {
  test(`note independence: ${level}`, () => {
    const whole = grid(fixture("whole-note"), level);
    for (const n of [
      "whole-measure-rest",
      "syncopation",
      "dotted",
      "triplet",
      "two-voices-backup",
    ])
      assert.deepEqual(grid(fixture(n), level), whole);
  });
  test(`divisions independence 1/4/24/480: ${level}`, () => {
    for (const divisions of [1, 4, 24, 480]) {
      const xml = fixture("whole-note")
        .replace(
          "<divisions>4</divisions>",
          `<divisions>${divisions}</divisions>`
        )
        .replace(
          "<duration>16</duration>",
          `<duration>${divisions * 4}</duration>`
        );
      assert.deepEqual(grid(xml, level), expected["4/4"][level]);
    }
  });
  test(`tie independence: ${level}`, () =>
    assert.deepEqual(
      grid(fixture("tie-across-beat"), level),
      grid(fixture("whole-note"), level)
    ));
}
test("subbeats have exact canonical fractions and discriminated kind, without modifying map", () => {
  const map = musicXMLToBeatMap(fixture("pickup-eighth"));
  const before = JSON.stringify(map);
  const values = createAnnotations(map, "sixteenths");
  assert.deepEqual(
    values.slice(0, 2).map((a) => a.kind),
    ["subbeat", "subbeat"]
  );
  assert.equal(JSON.stringify(map), before);
  assert.equal(new Set(values.map((a) => a.id)).size, values.length);
  for (const a of values)
    assert.equal(a.kind, /^[1-4]$/.test(a.label) ? "beat" : "subbeat");
});
test("invalid level rejected instead of silently selecting another grid", () =>
  assert.throws(() =>
    createAnnotations(
      musicXMLToBeatMap(fixture("whole-note")),
      "triplets" as CountingLevel
    )
  ));
test("unclassified short measure gets no subdivisions", () => {
  const map = musicXMLToBeatMap(
    fixture("pickup-eighth").replace('implicit="yes"', "")
  );
  assert.equal(
    map.measures[0].diagnostics[0].code,
    "UNDERFULL_MEASURE_UNCLASSIFIED"
  );
  assert.ok(
    createAnnotations(map, "sixteenths").every(
      (a) => a.sourceMeasureId !== map.measures[0].measureId
    )
  );
});
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
for (const level of levels)
  test(`MEI and SVG keep every whole note anchor: ${level}`, () => {
    const score = renderer.render(fixture("whole-note"), {
      ...DEFAULT_SCORE_SETTINGS,
      countingLevel: level,
    });
    assert.deepEqual(score.diagnostics, []);
    assert.equal(score.anchors.length, expected["4/4"][level].length);
    const svg = parse(score.pages[0].svg);
    for (const a of score.anchors)
      assert.ok(all(svg, "g").find((g) => g.getAttribute("id") === a.id));
    assert.equal(all(parse(score.renderedMEI), "note").length, 1);
  });
test("pickup eighth sixteenths uses tstamp 1,1.25 but labels &,a", () => {
  const score = renderer.render(fixture("pickup-eighth"), {
    ...DEFAULT_SCORE_SETTINGS,
    countingLevel: "sixteenths",
  });
  assert.deepEqual(
    score.anchors.slice(0, 2).map((a) => [a.label, a.timestamp]),
    [
      ["&", "1"],
      ["a", "1.25"],
    ]
  );
});
for (const level of ["eighths", "sixteenths"] as const)
  test(`mode ${level} preserves source note/lyric/harmony semantics and can be hidden`, () => {
    const xml = fixture("lyrics-harmony");
    const score = renderer.render(xml, {
      ...DEFAULT_SCORE_SETTINGS,
      countingLevel: level,
    });
    const hidden = renderer.render(xml, {
      ...DEFAULT_SCORE_SETTINGS,
      countingLevel: level,
      showBeats: false,
    });
    const music = (mei: string) =>
      ["note", "syl", "harm", "verse", "tie", "tuplet"].map((tag) =>
        all(parse(mei), tag).map((e) => ({
          text: e.textContent,
          attrs: Array.from(e.attributes)
            .filter((a) => a.name !== "xml:id")
            .map((a) => [a.name, a.value]),
        }))
      );
    assert.deepEqual(music(score.renderedMEI), music(hidden.renderedMEI));
    assert.equal(hidden.anchors.length, 0);
    assert.ok(!hidden.pages[0].svg.includes("tva-beat-"));
  });
test("largest font sixteenths keeps sparse notes, rests and pickup anchors", () => {
  for (const n of [
    "whole-note",
    "whole-measure-rest",
    "syncopation",
    "pickup-eighth",
  ]) {
    const map = musicXMLToBeatMap(fixture(n));
    const score = renderer.render(fixture(n), {
      ...DEFAULT_SCORE_SETTINGS,
      countingLevel: "sixteenths",
      sizePt: 14,
      distance: 8,
    });
    assert.deepEqual(score.diagnostics, []);
    assert.equal(
      score.anchors.length,
      createAnnotations(map, "sixteenths").length
    );
  }
});
