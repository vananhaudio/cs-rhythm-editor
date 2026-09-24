import assert from "node:assert/strict";
import test from "node:test";
import { buildBeatMap } from "../../src/musicxml-beats/beatEngine.ts";
import { createMusicalTimeline } from "../../src/musicxml-beats/musicalTimeline.ts";
import { compilePlaybackSequence } from "../../src/musicxml-beats/navigation.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import type { MusicalTimeline } from "../../src/musicxml-beats/musicalTimeline.ts";

type Mark = { left?: string; before?: string; after?: string; right?: string; duration?: number; implicit?: boolean };
const sound = (attributes: string) => `<direction><sound ${attributes}/></direction>`;
const left = (body: string) => `<barline location="left">${body}</barline>`;
const right = (body: string) => `<barline location="right">${body}</barline>`;
const repeatStart = left('<repeat direction="forward"/>');
const repeatEnd = right('<repeat direction="backward"/>');
const endingStart = (n: number) => left(`<ending type="start" number="${n}"/>`);
const endingEnd = (n: number, repeat = false) => right(`<ending type="stop" number="${n}"/>${repeat ? '<repeat direction="backward"/>' : ""}`);

function make(rows: Mark[], meter = "4/4") {
  const [beats, beatType] = meter.split("/").map(Number);
  const fullDuration = beats * 16 / beatType;
  const xml = `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>One</part-name></score-part></part-list><part id="P1">${rows.map((row, index) =>
    `<measure number="${index + 1}"${row.implicit ? ' implicit="yes"' : ""}>${index === 0 ? `<attributes><divisions>4</divisions><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time></attributes>` : ""}${row.left ?? ""}${row.before ?? ""}<note><rest/><duration>${row.duration ?? fullDuration}</duration></note>${row.after ?? ""}${row.right ?? ""}</measure>`
  ).join("")}</part></score-partwise>`;
  const score = parseMusicXML(xml);
  const beatMap = { schemaVersion: 1 as const, timeUnit: "quarter-note" as const,
    rationalFormat: "numerator/denominator" as const,
    measures: buildBeatMap(score, "simple-and-compound") };
  return { score, beatMap, sequence: compilePlaybackSequence(score), result: createMusicalTimeline(score, beatMap) };
}

function ready(rows: Mark[], meter = "4/4"): MusicalTimeline {
  const result = make(rows, meter).result;
  assert.equal(result.status, "ready", JSON.stringify(result.diagnostics));
  return result.timeline;
}

test("repeat creates separate occurrence identities and exact performance starts", () => {
  const timeline = ready([{}, { left: repeatStart }, { right: repeatEnd }, {}]);
  assert.deepEqual(timeline.occurrences.map((item) => item.writtenMeasureIndex), [0, 1, 2, 1, 2, 3]);
  assert.deepEqual(timeline.occurrences.map((item) => item.startQuarter),
    ["0/1", "4/1", "8/1", "12/1", "16/1", "20/1"]);
  assert.equal(timeline.totalQuarter, "24/1");
  assert.equal(timeline.occurrences[1].writtenMeasureId, timeline.occurrences[3].writtenMeasureId);
  assert.notEqual(timeline.occurrences[1].playbackIndex, timeline.occurrences[3].playbackIndex);
  assert.deepEqual(timeline.occurrences[1].beatPositions.map((point) => point.label), ["1", "2", "3", "4"]);
  assert.deepEqual(timeline.positionAt("13/1"), timeline.positionOf(3, "1/1"));
  assert.deepEqual([timeline.positionOf(1, "0/1").writtenMeasureId, timeline.positionOf(3, "0/1").writtenMeasureId],
    [timeline.occurrences[1].writtenMeasureId, timeline.occurrences[1].writtenMeasureId]);
  assert.equal(timeline.positionOf(3, "1/1").beat, 2);
  assert.equal(timeline.positionAt("24/1"), null);
  assert.throws(() => timeline.positionOf(3, "4/1"), RangeError);
});

test("volta keeps written identity while skipping the first ending on pass two", () => {
  const timeline = ready([
    { left: repeatStart }, {},
    { left: endingStart(1), right: endingEnd(1, true) },
    { left: endingStart(2), right: endingEnd(2) },
  ]);
  assert.deepEqual(timeline.occurrences.map((item) => item.writtenMeasureIndex + 1), [1, 2, 3, 1, 2, 4]);
  assert.equal(timeline.positionAt("20/1")?.writtenMeasureNumber, "4");
});

test("D.C. and D.S. route through Fine and Coda on the performance axis", () => {
  const cases: Array<{ rows: Mark[]; expected: number[] }> = [
    { rows: [{}, { after: sound('fine="yes"') }, { after: sound('dacapo="yes"') }, {}],
      expected: [1, 2, 3, 1, 2] },
    { rows: [{}, { before: sound('segno="S"') }, { after: sound('fine="yes"') }, { after: sound('dalsegno="S"') }],
      expected: [1, 2, 3, 4, 2, 3] },
    { rows: [{}, { after: sound('tocoda="C"') }, { after: sound('dacapo="yes"') }, { before: sound('coda="C"') }],
      expected: [1, 2, 3, 1, 2, 4] },
    { rows: [{}, { before: sound('segno="S"') }, { after: sound('tocoda="C"') },
      { after: sound('dalsegno="S"') }, { before: sound('coda="C"') }],
      expected: [1, 2, 3, 4, 2, 3, 5] },
  ];
  for (const { rows, expected } of cases) {
    const timeline = ready(rows);
    assert.deepEqual(timeline.occurrences.map((item) => item.writtenMeasureIndex + 1), expected);
    assert.equal(timeline.totalQuarter, `${expected.length * 4}/1`);
  }
});

test("2/4, 3/4 and 4/4 beat and sixteenth offsets come from shared annotations", () => {
  for (const beats of [2, 3, 4]) {
    const timeline = ready([{}], `${beats}/4`);
    const item = timeline.occurrences[0];
    assert.deepEqual(item.beatPositions.map((point) => point.offset),
      Array.from({ length: beats }, (_, index) => `${index}/1`));
    assert.deepEqual(item.subdivisionPositions.slice(0, 3).map((point) => [point.offset, point.label]),
      [["1/4", "e"], ["1/2", "&"], ["3/4", "a"]]);
    assert.deepEqual([timeline.positionAt("1/4")?.beat, timeline.positionAt("1/4")?.subdivision], [1, "e"]);
    assert.deepEqual([timeline.positionAt("1/2")?.beat, timeline.positionAt("1/2")?.subdivision], [1, "&"]);
    assert.deepEqual([timeline.positionAt("1/1")?.beat, timeline.positionAt("1/1")?.subdivision], [2, null]);
  }
});

test("pickup starts at performance zero without inventing an earlier measure", () => {
  const timeline = ready([{ implicit: true, duration: 2 }, {}]);
  const pickup = timeline.occurrences[0];
  assert.equal(pickup.pickup, true);
  assert.equal(pickup.pickupOffset, "7/2");
  assert.equal(pickup.actualDuration, "1/2");
  assert.equal(timeline.occurrences[1].startQuarter, "1/2");
  assert.deepEqual([timeline.positionAt("0/1")?.beat, timeline.positionAt("0/1")?.subdivision], [4, "&"]);
  assert.equal(timeline.positionAt("1/2")?.writtenMeasureIndex, 1);
});

test("6/8 uses XML eighth pulses and declares missing finer subdivision coverage", () => {
  const timeline = ready([{}], "6/8");
  const item = timeline.occurrences[0];
  assert.equal(item.actualDuration, "3/1");
  assert.deepEqual(item.beatPositions.map((point) => [point.label, point.offset]),
    [["1", "0/1"], ["2", "1/2"], ["3", "1/1"], ["4", "3/2"], ["5", "2/1"], ["6", "5/2"]]);
  assert.equal(item.subdivisionCoverage, "pulse-only");
  assert.deepEqual(item.subdivisionPositions, []);
  assert.deepEqual([timeline.positionAt("5/2")?.beat, timeline.positionAt("5/2")?.subdivision], [6, null]);
});

test("invalid navigation is exposed; its linear fallback never becomes a ready timeline", () => {
  const { result, sequence } = make([{ after: sound('dalsegno="missing"') }, {}]);
  assert.equal(sequence.status, "linear-fallback");
  assert.equal(result.status, "navigation-fallback");
  assert.equal(result.timeline, null);
  assert.equal(result.diagnostics[0].code, "NAVIGATION_TARGET");
});

test("score and BeatMap mismatch returns a diagnostic without guessing grid", () => {
  const { score, beatMap, sequence } = make([{}, {}]);
  beatMap.measures[1].actualDuration = "3/1";
  const result = createMusicalTimeline(score, beatMap, sequence);
  assert.equal(result.status, "invalid");
  assert.equal(result.timeline, null);
  assert.equal(result.diagnostics[0].code, "TIMELINE_MEASURE");
});
