import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { buildBeatMap } from "../../src/musicxml-beats/beatEngine.ts";
import {
  musicXMLToBeatMap,
  serializeBeatMap,
} from "../../src/musicxml-beats/beatMap.ts";
import { add } from "../../src/musicxml-beats/rational.ts";
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.musicxml`, import.meta.url), "utf8");
const map = (xml: string) => buildBeatMap(parseMusicXML(xml));
for (const file of readdirSync(new URL("./fixtures/", import.meta.url)).filter(
  (f) => f.endsWith(".musicxml")
)) {
  test(`hand-authored expected: ${file}`, () => {
    const expected = JSON.parse(
      readFileSync(
        new URL(
          `./expected/${file.replace(".musicxml", ".json")}`,
          import.meta.url
        ),
        "utf8"
      )
    );
    assert.deepEqual(map(fixture(file.replace(".musicxml", ""))), expected);
  });
}
test("A: replacing quarter with two tied eighths preserves beat-map", () => {
  const xml = fixture("simple-4-4");
  const note =
    "<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>";
  const eighth = (tie: string) =>
    `<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><tie type="${tie}"/><notations><tied type="${tie}"/></notations></note>`;
  assert.ok(xml.includes(note));
  assert.deepEqual(
    map(xml.replace(note, eighth("start") + eighth("stop"))),
    map(xml)
  );
});
test("B: adding second voice leaves duration and beat-map unchanged", () => {
  assert.deepEqual(
    map(fixture("two-voices-backup")),
    map(fixture("whole-note-4-4"))
  );
});
test("C: divisions 1, 4, 24, 480 encode identical beats", () => {
  const original = fixture("simple-4-4");
  for (const d of [1, 4, 24, 480]) {
    const xml = original
      .replace("<divisions>4</divisions>", `<divisions>${d}</divisions>`)
      .replaceAll("<duration>4</duration>", `<duration>${d}</duration>`);
    assert.deepEqual(map(xml), map(original));
  }
});
test("D: 1200 consecutive triplets sum to exact boundary across 100 measures", () => {
  const xml = fixture("triplet");
  const body = xml.match(/<measure[\s\S]*?<\/measure>/)![0];
  const repeated = xml.replace(
    body,
    Array.from({ length: 100 }, (_, i) =>
      body.replace('number="1"', `number="${i + 1}"`)
    ).join("")
  );
  const s = parseMusicXML(repeated);
  let sum: `${bigint}/${bigint}` = "0/1";
  for (const m of s.parts[0].measures) {
    assert.equal(m.actualDuration, "4/1");
    for (const e of m.events) sum = add(sum, e.duration);
  }
  assert.equal(sum, "400/1");
  assert.equal(buildBeatMap(s).length, 100);
});
test("whole note, rests, syncopation, dotted notes and tuplets produce same beat grid", () => {
  const base = map(fixture("whole-note-4-4"))[0].beatsMap;
  for (const name of [
    "rests",
    "syncopation",
    "dotted",
    "triplet",
    "quintuplet",
  ])
    assert.deepEqual(map(fixture(name))[0].beatsMap, base);
});
test("initial implicit two-quarter pickup labels 3 and 4", () => {
  const xml = fixture("pickup-quarter").replace(
    "<duration>4</duration>",
    "<duration>8</duration>"
  );
  const m = map(xml)[0];
  assert.equal(m.pickupOffset, "2/1");
  assert.deepEqual(m.beatsMap, [
    { label: "3", offset: "0/1" },
    { label: "4", offset: "1/1" },
  ]);
});
test("implicit measure later in score is not automatically pickup", () => {
  const xml = fixture("pickup-quarter")
    .replace(' implicit="yes"', "")
    .replace('<measure number="1">', '<measure number="1" implicit="yes">')
    .replace("<duration>16</duration>", "<duration>4</duration>");
  for (const m of map(xml)) {
    assert.equal(m.pickup, false);
    assert.equal(m.diagnostics[0].code, "UNDERFULL_MEASURE_UNCLASSIFIED");
  }
});
test("full initial implicit measure is not pickup", () => {
  assert.equal(
    map(
      fixture("simple-4-4").replace(
        '<measure number="1">',
        '<measure number="1" implicit="yes">'
      )
    )[0].pickup,
    false
  );
});
test("6/8 produces diagnostic without guessed beat grid", () => {
  const xml = fixture("simple-3-4").replace(
    "<beats>3</beats><beat-type>4",
    "<beats>6</beats><beat-type>8"
  );
  const m = map(xml)[0];
  assert.equal(m.expectedDuration, "3/1");
  assert.equal(m.diagnostics[0].code, "UNSUPPORTED_METER");
  assert.deepEqual(m.beatsMap, []);
});
test("mid-measure meter change suppresses unreliable beat-map", () => {
  const xml = fixture("divisions-change").replace(
    "<attributes><divisions>24</divisions>",
    "<attributes><time><beats>3</beats><beat-type>4</beat-type></time><divisions>24</divisions>"
  );
  const m = map(xml)[0];
  assert.ok(m.diagnostics.some((d) => d.code === "MID_MEASURE_METER_CHANGE"));
  assert.deepEqual(m.beatsMap, []);
});
test("roundtrip JSON has canonical fractions and no bigint serialization errors", () => {
  const doc = musicXMLToBeatMap(fixture("pickup-eighth"));
  assert.deepEqual(JSON.parse(serializeBeatMap(doc)), doc);
  assert.equal(doc.timeUnit, "quarter-note");
  assert.equal(doc.measures[0].actualDuration, "1/2");
});

test("missing meter yields a diagnostic, not an assumed 4/4 grid", () => {
  const xml = fixture("whole-note-4-4").replace(
    "<time><beats>4</beats><beat-type>4</beat-type></time>",
    ""
  );
  const m = map(xml)[0];
  assert.equal(m.expectedDuration, null);
  assert.equal(m.diagnostics[0].code, "MISSING_OR_UNSUPPORTED_METER");
  assert.deepEqual(m.beatsMap, []);
});

test("empty implicit first measure is not a pickup", () => {
  const xml = fixture("whole-note-4-4")
    .replace(/<note>[\s\S]*?<\/note>/, "")
    .replace('<measure number="1">', '<measure number="1" implicit="yes">');
  const m = map(xml)[0];
  assert.equal(m.actualDuration, "0/1");
  assert.equal(m.pickup, false);
  assert.equal(m.diagnostics[0].code, "UNDERFULL_MEASURE_UNCLASSIFIED");
});

test("composite and staff-specific meters are explicitly unsupported", () => {
  for (const time of [
    "<time><beats>2+2</beats><beat-type>4</beat-type></time>",
    '<time number="1"><beats>4</beats><beat-type>4</beat-type></time>',
  ]) {
    const xml = fixture("whole-note-4-4").replace(
      "<time><beats>4</beats><beat-type>4</beat-type></time>",
      time
    );
    const m = map(xml)[0];
    assert.ok(m.diagnostics.some((d) => d.code === "UNSUPPORTED_METER"));
    assert.deepEqual(m.beatsMap, []);
  }
});
