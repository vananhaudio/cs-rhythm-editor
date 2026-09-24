import test from "node:test";
import assert from "node:assert/strict";
import { parseMusicXML, musicXMLToBeatMap, tagSourceIds, rational, compilePlaybackSequence, createMusicalTimeline } from "@vananhaudio/musicxml-beats/core";
import { createAnnotatedScoreRenderer, DEFAULT_SCORE_SETTINGS } from "@vananhaudio/musicxml-beats/render";

const xml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note></measure></part></score-partwise>`;

test("public core and render exports use one MusicXML score", async () => {
  assert.equal(rational(1n, 2n), "1/2");
  assert.equal(parseMusicXML(xml).parts[0].measures[0].events.length, 1);
  assert.deepEqual(musicXMLToBeatMap(xml).measures[0].beatsMap.map((beat) => beat.label), ["1", "2", "3", "4"]);
  const id = tagSourceIds(xml).notes[0].svgId;
  const renderer = await createAnnotatedScoreRenderer();
  try {
    const score = renderer.render(xml, DEFAULT_SCORE_SETTINGS);
    assert.ok(score.pages[0].svg.includes(`id="${id}"`));
    assert.ok(score.noteIndex.has(id));
  } finally {
    renderer.destroy();
  }
});

test("published render API annotates two aligned parts", async () => {
  const twoParts = xml
    .replace('</part-list>', '<score-part id="P2"><part-name>Second</part-name></score-part></part-list>')
    .replace('</score-partwise>', '<part id="P2"><measure number="1"><attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note></measure></part></score-partwise>');
  const renderer = await createAnnotatedScoreRenderer();
  try {
    const score = renderer.render(twoParts);
    assert.deepEqual(score.anchors.map((anchor) => anchor.label), ['1', '2', '3', '4']);
    assert.deepEqual(score.diagnostics, []);
  } finally {
    renderer.destroy();
  }
});

test("public navigation and musical timeline compile a repeat with distinct occurrences", () => {
  const repeated = xml.replace('</attributes>', '</attributes><barline location="left"><repeat direction="forward"/></barline>')
    .replace('</note></measure>', '</note><barline location="right"><repeat direction="backward"/></barline></measure>');
  const score = parseMusicXML(repeated);
  const sequence = compilePlaybackSequence(score);
  const result = createMusicalTimeline(score, musicXMLToBeatMap(repeated), sequence);
  assert.equal(sequence.status, "compiled");
  assert.deepEqual(sequence.occurrences.map((item) => item.writtenMeasureIndex), [0, 0]);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.timeline.occurrences.map((item) => item.startQuarter), ["0/1", "4/1"]);
  assert.equal(result.timeline.positionAt("5/1").beat, 2);
});
