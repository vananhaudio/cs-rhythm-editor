import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { createAnnotations } from "../../src/musicxml-beats/annotations.ts";
import type { CompoundCountingMode } from "../../src/musicxml-beats/annotations.ts";
import {
  meterGrouping,
  groupStarts,
  SUPPORTED_COMPOUND,
} from "../../src/musicxml-beats/meterGrouping.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import { all, parse } from "../../src/musicxml-beats/renderer/xml.ts";

const fixture = (n: string) =>
  readFileSync(new URL(`./fixtures/${n}.musicxml`, import.meta.url), "utf8");
const source = (p: string) =>
  readFileSync(new URL(`../../src/musicxml-beats/${p}`, import.meta.url), "utf8");
const expected = JSON.parse(
  readFileSync(new URL("./expected/grids.json", import.meta.url), "utf8")
);
const modes: CompoundCountingMode[] = ["pulses", "compound"];
const COMPOUND = ["6/8", "9/8", "12/8"] as const;
const grid = (xml: string, mode: CompoundCountingMode) => {
  const map = musicXMLToBeatMap(xml);
  return map.measures.map((m) =>
    createAnnotations(map, "beats", mode)
      .filter((a) => a.sourceMeasureId === m.measureId)
      .map((a) => [a.label, a.offset])
  );
};

// ── A. Generic grouping: one rule produces every enabled compound meter ──────────
test("registry exposes exactly the enabled compound meters", () =>
  assert.deepEqual([...SUPPORTED_COMPOUND], [...COMPOUND]));

for (const name of COMPOUND) {
  const beats = Number(name.split("/")[0]);
  test(`${name}: grouping is n threes at the denominator unit`, () => {
    const g = meterGrouping({ beats, beatType: 8 });
    assert.deepEqual(g, {
      type: "compound",
      unit: "1/2",
      groups: Array<number>(beats / 3).fill(3),
    });
    assert.deepEqual(
      groupStarts(g!),
      expected.full[name].compound.map((e: string[]) => e[1])
    );
  });
}

test("6/8 has no dedicated code path: no meter literal branches downstream", () => {
  // The only place a meter name may appear is the deliberate support registry.
  for (const file of [
    "annotations.ts",
    "beatEngine.ts",
    "beatMap.ts",
    "renderer/temporalAnnotations.ts",
    "renderer/verovioAdapter.ts",
  ])
    assert.equal(
      /\b(6|9|12)\s*\/\s*8\b|beats\s*===?\s*(6|9|12)\b/.test(source(file)),
      false,
      `${file} branches on a specific compound meter`
    );
  const registry = source("meterGrouping.ts");
  assert.equal(/COMPOUND_BEATS.*=.*\[\s*6,\s*9,\s*12\s*\]/.test(registry), true);
  // 6/8 and 12/8 must be the same object shape produced by the same call.
  const shapes = COMPOUND.map(
    (n) => meterGrouping({ beats: Number(n.split("/")[0]), beatType: 8 })!.type
  );
  assert.deepEqual(shapes, ["compound", "compound", "compound"]);
});

// ── Grids per fixture, both modes ────────────────────────────────────────────────
const byMeter: Record<string, string[]> = {
  "9/8": [
    "basic-9-8",
    "whole-rest-9-8",
    "sustained-9-8",
    "dotted-quarters-9-8",
    "syncopation-9-8",
    "tuplet-9-8",
    "lyrics-harmony-9-8",
  ],
  "12/8": [
    "basic-12-8",
    "whole-rest-12-8",
    "sustained-12-8",
    "dotted-quarters-12-8",
    "syncopation-12-8",
    "tuplet-12-8",
    "two-voices-12-8",
    "lyrics-harmony-12-8",
  ],
};
for (const [meter, names] of Object.entries(byMeter))
  for (const name of names)
    for (const mode of modes)
      test(`${name}/${mode}: hand-written grid`, () =>
        assert.deepEqual(grid(fixture(name), mode)[0], expected.full[meter][mode]));

// ── C. Note independence: rests, ties, syncopation and tuplets never move the grid ─
for (const [meter, names] of Object.entries(byMeter))
  for (const mode of modes)
    test(`note/voice independence ${meter}: ${mode}`, () => {
      const grids = names.map((n) => grid(fixture(n), mode)[0]);
      for (const g of grids) assert.deepEqual(g, expected.full[meter][mode]);
    });

// ── B. Divisions independence ────────────────────────────────────────────────────
for (const meter of ["9/8", "12/8"] as const)
  for (const mode of modes)
    test(`divisions independence ${meter}: ${mode}`, () => {
      const base = fixture(meter === "9/8" ? "basic-9-8" : "basic-12-8");
      for (const d of [1, 4, 24, 480]) {
        const eighth = d / 2;
        const xml = base
          .replace("<divisions>12</divisions>", `<divisions>${d}</divisions>`)
          .replaceAll("<duration>6</duration>", `<duration>${eighth}</duration>`);
        assert.deepEqual(grid(xml, mode)[0], expected.full[meter][mode]);
      }
    });

// ── Pickup phase ────────────────────────────────────────────────────────────────
for (const name of ["pickup-9-8", "pickup-12-8"] as const) {
  const meter = name === "pickup-9-8" ? "9/8" : "12/8";
  for (const mode of modes)
    test(`${name}/${mode}: keeps full-bar phase, invents no new big beat`, () => {
      const map = musicXMLToBeatMap(fixture(name));
      assert.equal(map.measures[0].pickupOffset, meter === "9/8" ? "4/1" : "5/1");
      assert.deepEqual(grid(fixture(name), mode), [
        expected[name][mode],
        expected.full[meter][mode],
      ]);
    });
}

// ── Mixed meter: 4/4 → 6/8 → 9/8 → 3/4 → 12/8 → 6/8 ─────────────────────────────
for (const mode of modes)
  test(`mixed meter uses each bar's own meter: ${mode}`, () =>
    assert.deepEqual(grid(fixture("mixed-meter"), mode), [
      expected["simple-four"],
      expected.full["6/8"][mode],
      expected.full["9/8"][mode],
      expected["simple-three"],
      expected.full["12/8"][mode],
      expected.full["6/8"][mode],
    ]));
test("mixed meter label counts", () => {
  assert.equal(grid(fixture("mixed-meter"), "pulses").flat().length, 40);
  assert.equal(grid(fixture("mixed-meter"), "compound").flat().length, 18);
});

// ── Still out of scope ──────────────────────────────────────────────────────────
// 5/8 và 7/8 được bật ở Giai đoạn 8; 10/8, 11/8, 15/8 vẫn ngoài phạm vi.
test("meters outside the registry stay unsupported; divisibility alone enables nothing", () => {
  for (const beats of [10, 11, 15]) {
    assert.equal(meterGrouping({ beats, beatType: 8 }), null);
    const m = musicXMLToBeatMap(
      fixture("basic-9-8").replace("<beats>9</beats>", `<beats>${beats}</beats>`)
    );
    assert.ok(
      m.measures[0].diagnostics.some((d) => d.code === "UNSUPPORTED_METER")
    );
  }
});

// ── Stress: 100 bars of 12/8 in pulse mode = 1.200 labels ───────────────────────
test("stress 12/8 pulses: 1.200 labels, no drift, no diagnostics", () => {
  const map = musicXMLToBeatMap(fixture("stress-12-8"));
  assert.equal(map.measures.length, 100);
  assert.deepEqual(
    map.measures.flatMap((m) => m.diagnostics),
    []
  );
  const a = createAnnotations(map, "beats", "pulses");
  assert.equal(a.length, 1200);
  assert.equal(new Set(a.map((x) => x.id)).size, 1200);
  // Exact rationals: every bar repeats the same 12 offsets, none drifts.
  for (let i = 0; i < 100; i++)
    assert.deepEqual(
      a.slice(i * 12, i * 12 + 12).map((x) => [x.label, x.offset]),
      expected.full["12/8"].pulses
    );
  assert.equal(
    createAnnotations(map, "beats", "compound").length,
    400
  );
});

// ── Renderer: MEI timestamps and export parity ──────────────────────────────────
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
const stamps = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
for (const [name, meter] of [
  ["lyrics-harmony-9-8", "9/8"],
  ["lyrics-harmony-12-8", "12/8"],
] as const)
  for (const mode of modes)
    test(`${name}/${mode}: denominator tstamp, notation untouched`, () => {
      const beats = Number(meter.split("/")[0]);
      const s = renderer.render(fixture(name), {
        ...DEFAULT_SCORE_SETTINGS,
        compoundCountingMode: mode,
      });
      assert.deepEqual(s.diagnostics, []);
      assert.deepEqual(
        s.anchors.map((a) => a.timestamp),
        mode === "pulses"
          ? stamps(beats)
          : Array.from({ length: beats / 3 }, (_, i) => String(1 + i * 3))
      );
      const off = renderer.render(fixture(name), {
        ...DEFAULT_SCORE_SETTINGS,
        showBeats: false,
      });
      for (const tag of ["note", "syl", "harm", "verse"])
        assert.deepEqual(
          all(parse(s.renderedMEI), tag).map((e) => e.toString()),
          all(parse(off.renderedMEI), tag).map((e) => e.toString())
        );
    });

test("mixed meter tstamps convert per bar, never a stale denominator", () => {
  const s = renderer.render(fixture("mixed-meter"));
  assert.deepEqual(s.diagnostics, []);
  assert.deepEqual(s.anchors.map((a) => a.timestamp), [
    ...stamps(4),
    ...stamps(6),
    ...stamps(9),
    ...stamps(3),
    ...stamps(12),
    ...stamps(6),
  ]);
});

for (const name of ["pickup-9-8", "pickup-12-8"] as const)
  test(`${name}: pickup label keeps its bar phase at fragment tstamp 1`, () => {
    const s = renderer.render(fixture(name));
    assert.deepEqual(
      [s.anchors[0].label, s.anchors[0].timestamp],
      name === "pickup-9-8" ? ["9", "1"] : ["11", "1"]
    );
  });

// ── D. Export parity + engraving alignment ──────────────────────────────────────
for (const [name, meter] of [
  ["basic-9-8", "9/8"],
  ["basic-12-8", "12/8"],
] as const)
  for (const mode of modes)
    test(`${name}/${mode}: anchors sit on independently engraved eighth onsets`, () => {
      const beats = Number(meter.split("/")[0]);
      const s = renderer.render(fixture(name), {
        ...DEFAULT_SCORE_SETTINGS,
        compoundCountingMode: mode,
      });
      assert.deepEqual(s.diagnostics, []);
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
      assert.equal(heads.length, beats);
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
        mode === "pulses"
          ? heads
          : heads.filter((_, i) => i % 3 === 0)
      );
    });
