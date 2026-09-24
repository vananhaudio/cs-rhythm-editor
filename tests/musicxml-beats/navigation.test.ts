import assert from "node:assert/strict";
import test from "node:test";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { compilePlaybackSequence } from "../../src/musicxml-beats/navigation.ts";

type Marks = { before?: string; after?: string; left?: string; right?: string };
const sound = (attributes: string) => `<direction><sound ${attributes}/></direction>`;
const left = (content: string) => `<barline location="left">${content}</barline>`;
const right = (content: string) => `<barline location="right">${content}</barline>`;
const forward = left('<repeat direction="forward"/>');
const backward = (times = "") => right(`<repeat direction="backward"${times ? ` times="${times}"` : ""}/>`);
const endingStart = (number: string) => left(`<ending type="start" number="${number}"/>`);
const endingStop = (number: string, repeat = false) => right(`<ending type="stop" number="${number}"/>${repeat ? '<repeat direction="backward"/>' : ""}`);
const endingDiscontinue = (number: string) => right(`<ending type="discontinue" number="${number}"/>`);

function score(rows: Marks[], secondPart?: Marks[]) {
  const part = (id: string, marks: Marks[]) => `<part id="${id}">${marks.map((mark, index) =>
    `<measure number="${index + 1}">${index === 0 ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' : ""}${mark.left || ""}${mark.before || ""}<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>${mark.after || ""}${mark.right || ""}</measure>`
  ).join("")}</part>`;
  return `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>One</part-name></score-part>${secondPart ? '<score-part id="P2"><part-name>Two</part-name></score-part>' : ""}</part-list>${part("P1", rows)}${secondPart ? part("P2", secondPart) : ""}</score-partwise>`;
}

function result(rows: Marks[], secondPart?: Marks[], maxSteps?: number) {
  return compilePlaybackSequence(parseMusicXML(score(rows, secondPart)), maxSteps);
}

function order(rows: Marks[], secondPart?: Marks[]) {
  const sequence = result(rows, secondPart);
  assert.equal(sequence.status, "compiled", JSON.stringify(sequence.diagnostics));
  return sequence.occurrences.map((item) => item.writtenMeasureIndex + 1);
}

test("linear score keeps distinct written and playback indexes", () => {
  const sequence = result([{}, {}, {}]);
  assert.equal(sequence.hasNavigation, false);
  assert.deepEqual(sequence.occurrences.map((item) => [item.playbackIndex, item.writtenMeasureIndex]), [[0, 0], [1, 1], [2, 2]]);
});

test("forward/backward repeats, explicit times and implicit beginning", () => {
  const rows = Array.from({ length: 10 }, () => ({} as Marks));
  rows[4].left = forward;
  rows[7].right = backward();
  assert.deepEqual(order(rows), [1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 7, 8, 9, 10]);
  const repeated = result(rows);
  assert.notEqual(repeated.occurrences[4].playbackIndex, repeated.occurrences[8].playbackIndex);
  assert.equal(repeated.occurrences[4].writtenMeasureIndex, repeated.occurrences[8].writtenMeasureIndex);
  rows[7].right = backward("3");
  assert.deepEqual(order(rows).slice(4, 16), [5, 6, 7, 8, 5, 6, 7, 8, 5, 6, 7, 8]);
  assert.deepEqual(order([{},{ right: backward() },{}]), [1, 2, 1, 2, 3]);
});

test("first and second endings skip the first ending on pass two", () => {
  const rows: Marks[] = [
    { left: forward }, {},
    { left: endingStart("1"), right: endingStop("1", true) },
    { left: endingStart("2"), right: endingDiscontinue("2") },
    {},
  ];
  assert.deepEqual(order(rows), [1, 2, 3, 1, 2, 4, 5]);
});

test("multi-measure endings preserve every written occurrence", () => {
  const rows: Marks[] = [
    { left: forward }, {},
    { left: endingStart("1") }, { right: endingStop("1", true) },
    { left: endingStart("2") }, { right: endingDiscontinue("2") },
    {},
  ];
  assert.deepEqual(order(rows), [1, 2, 3, 4, 1, 2, 5, 6, 7]);
});

test("nested repeat counters restart within the outer repeat", () => {
  const rows: Marks[] = [
    { left: forward }, { left: forward }, { right: backward() },
    {}, { right: backward() }, {},
  ];
  assert.deepEqual(order(rows), [1, 2, 3, 2, 3, 4, 5, 1, 2, 3, 2, 3, 4, 5, 6]);
});

test("repeat times one plays only once", () => {
  assert.deepEqual(order([{ left: forward }, { right: backward("1") }, {}]), [1, 2, 3]);
});

test("D.C. and D.C. al Fine follow written targets only once", () => {
  assert.deepEqual(order([{}, {}, { after: sound('dacapo="yes"') }, {}]), [1, 2, 3, 1, 2, 3, 4]);
  assert.deepEqual(order([{}, { after: sound('fine="yes"') }, { after: sound('dacapo="yes"') }, {}]), [1, 2, 3, 1, 2]);
});

test("D.C. al Coda uses To Coda on second visit", () => {
  const rows: Marks[] = [
    {}, { after: sound('tocoda="A"') }, {}, { after: sound('dacapo="yes"') },
    { before: sound('coda="A"') }, {},
  ];
  assert.deepEqual(order(rows), [1, 2, 3, 4, 1, 2, 5, 6]);
});

test("To Coda waits for the D.C. jump even when a repeat visits it twice", () => {
  const rows: Marks[] = [
    { left: forward }, { after: sound('tocoda="C"'), right: backward() },
    { after: sound('dacapo="yes"') }, { before: sound('coda="C"') },
  ];
  assert.deepEqual(order(rows), [1, 2, 1, 2, 3, 1, 2, 4]);
});

test("a D.C. on a backward repeat waits until the repeat is finished", () => {
  const rows: Marks[] = [
    { left: forward }, { after: sound('dacapo="yes"'), right: backward() }, {},
  ];
  assert.deepEqual(order(rows), [1, 2, 1, 2, 1, 2, 3]);
});

test("D.S., D.S. al Fine and D.S. al Coda use the matching Segno", () => {
  const base: Marks[] = [{}, { before: sound('segno="S"') }, {}, { after: sound('dalsegno="S"') }, {}];
  assert.deepEqual(order(base), [1, 2, 3, 4, 2, 3, 4, 5]);
  const fine = base.map((row) => ({ ...row }));
  fine[2].after = sound('fine="yes"');
  assert.deepEqual(order(fine), [1, 2, 3, 4, 2, 3]);
  const coda = base.map((row) => ({ ...row }));
  coda[2].after = sound('tocoda="C"');
  coda[4].before = sound('coda="C"');
  assert.deepEqual(order(coda), [1, 2, 3, 4, 2, 3, 5]);
});

test("standalone Fine ends at its written measure", () => {
  assert.deepEqual(order([{}, { after: sound('fine="yes"') }, {}]), [1, 2]);
});

test("repeat after a D.C. jump follows after-jump only when explicitly yes", () => {
  const rows: Marks[] = [{ left: forward }, { right: backward() }, { after: sound('dacapo="yes"') }, {}];
  assert.deepEqual(order(rows), [1, 2, 1, 2, 3, 1, 2, 3, 4]);
  rows[1].right = right('<repeat direction="backward" after-jump="yes"/>');
  assert.deepEqual(order(rows), [1, 2, 1, 2, 3, 1, 2, 1, 2, 3, 4]);
});

test("sound time-only can delay D.C. until the second pass", () => {
  const rows: Marks[] = [
    { left: forward },
    { after: sound('dacapo="yes" time-only="2"'), right: backward() },
    {},
  ];
  assert.deepEqual(order(rows), [1, 2, 1, 2, 1, 2, 3]);
});

test("implied forward repeat and visual glyph with matching sound are explicit", () => {
  assert.deepEqual(order([{ before: sound('forward-repeat="yes"') }, { right: backward() }]), [1, 2, 1, 2]);
  const rows: Marks[] = [
    { before: '<direction><direction-type><segno/></direction-type><sound segno="S"/></direction>' },
    { after: sound('dalsegno="S"') },
  ];
  assert.deepEqual(order(rows), [1, 2, 1, 2]);
});

test("matching marks across parts compile one shared sequence", () => {
  const rows = [{ left: forward }, { right: backward() }];
  const sequence = result(rows, rows);
  assert.equal(sequence.status, "compiled");
  assert.deepEqual(sequence.occurrences.map((item) => item.sourceMeasureIds.length), [2, 2, 2, 2]);
});

test("conflicting navigation across parts is rejected rather than guessed", () => {
  const first: Marks[] = [{ left: forward }, { right: backward("2") }, {}];
  const second: Marks[] = [{ left: forward }, { right: backward("3") }, {}];
  const sequence = result(first, second);
  assert.equal(sequence.status, "linear-fallback");
  assert.equal(sequence.diagnostics[0].code, "NAVIGATION_AMBIGUOUS");
});

test("missing targets, malformed volta and unsupported visual instructions fall back clearly", () => {
  for (const rows of [
    [{ after: sound('dalsegno="S"') }],
    [{ after: sound('tocoda="C"') }],
    [{ left: forward }, {}],
    [{ left: endingStart("1") }, { right: endingStop("1", true) }],
    [{ before: '<direction><direction-type><segno/></direction-type></direction>' }],
    [{ after: '<direction><direction-type><words>D.C. al Fine</words></direction-type></direction>' }],
    [{ after: '<direction><direction-type><words>D.C.</words></direction-type><sound dalsegno="S"/></direction>', before: sound('segno="S"') }],
    [{ after: '<direction><direction-type><words>D.C. al Fine</words></direction-type><sound dacapo="yes"/></direction>' }],
    [{ after: '<direction><direction-type><words>D.S. al Coda</words></direction-type><sound dalsegno="S"/></direction>', before: sound('segno="S"') }],
    [{ after: '<direction><sound dacapo="yes"><offset>1</offset></sound></direction>' }],
    [{ before: sound('segno="S"') }, { after: sound('tocoda="C"') }, { before: sound('coda="C"') }],
    [{ before: sound('segno="S"') }, { before: sound('segno="S"') }],
    [{ before: '<note><rest/><duration>1</duration><type>quarter</type></note>' + sound('segno="S"') }],
    [{ after: sound('dacapo="yes"') + '<note><rest/><duration>1</duration><type>quarter</type></note>' }],
  ]) {
    const sequence = result(rows);
    assert.equal(sequence.status, "linear-fallback");
    assert.equal(sequence.occurrences.length, rows.length);
    assert.match(sequence.diagnostics[0].code, /^NAVIGATION_/);
  }
});

test("repeat times cannot hang playback", () => {
  const sequence = result([{ left: forward }, { right: backward("999") }], undefined, 20);
  assert.equal(sequence.status, "linear-fallback");
  assert.equal(sequence.diagnostics[0].code, "NAVIGATION_LOOP_GUARD");
  assert.deepEqual(sequence.occurrences.map((item) => item.writtenMeasureIndex), [0, 1]);
});
