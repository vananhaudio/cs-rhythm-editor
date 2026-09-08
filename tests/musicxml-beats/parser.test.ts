import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import {
  rational,
  decimal,
  add,
  sub,
  div,
  compare,
} from "../../src/musicxml-beats/rational.ts";
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.musicxml`, import.meta.url), "utf8");
const measure = (name: string) =>
  parseMusicXML(fixture(name)).parts[0].measures[0];
const minimal = (body: string) =>
  `<score-partwise><part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${body}</measure></part></score-partwise>`;
test("canonical exact arithmetic, huge integers and decimal source units", () => {
  assert.equal(rational(2, 6), "1/3");
  assert.equal(rational(0, -5), "0/1");
  assert.equal(rational(2, -6), "-1/3");
  assert.equal(add("1/3", "2/3"), "1/1");
  assert.equal(sub("1/2", "2/3"), "-1/6");
  assert.equal(div("3/2", "3/4"), "2/1");
  assert.equal(decimal("0.125"), "1/8");
  assert.equal(decimal("-1.25"), "-5/4");
  assert.equal(rational("900719925474099300", 3), "300239975158033100/1");
  assert.equal(compare("1/3", "1/2"), -1);
  assert.throws(() => rational(1, 0));
  assert.throws(() => rational(0.1));
  assert.throws(() => decimal("1e-3"));
});
test("duration is authoritative for dotted notation", () => {
  const e = measure("dotted").events;
  assert.equal(e[0].duration, "3/2");
  assert.equal(e[0].dots, 1);
  assert.equal(e[1].onset, "3/2");
  assert.equal(e[2].onset, "2/1");
});
test("triplet and quintuplet retain notation without multiplying timing again", () => {
  const t = measure("triplet").events;
  assert.equal(t[0].duration, "1/3");
  assert.equal(t[11].onset, "11/3");
  assert.equal(t[0].timeModification?.actualNotes, "3");
  const q = measure("quintuplet").events;
  assert.equal(q[0].duration, "2/5");
  assert.equal(q[9].onset, "18/5");
});
test("rest events remain in normalized timeline", () => {
  assert.deepEqual(
    measure("rests").events.map((e) => [e.kind, e.onset, e.duration]),
    [
      ["rest", "0/1", "1/1"],
      ["note", "1/1", "1/1"],
      ["rest", "2/1", "2/1"],
    ]
  );
});
test("syncopated onsets remain fractional", () => {
  assert.deepEqual(
    measure("syncopation").events.map((e) => e.onset),
    ["0/1", "1/2", "3/2", "5/2", "7/2"]
  );
});
test("ties and notation ties stay attached to individual source notes", () => {
  const ms = parseMusicXML(fixture("tie-across-barline")).parts[0].measures;
  assert.equal(ms[0].events.length, 1);
  assert.equal(ms[1].events.length, 2);
  assert.deepEqual(ms[0].events[0].ties, ["start"]);
  assert.deepEqual(ms[1].events[0].tied, ["stop"]);
  assert.notEqual(ms[0].events[0].source.id, ms[1].events[0].source.id);
});
test("backup rewinds cursor, preserves both voices and maximum extent", () => {
  const m = measure("two-voices-backup");
  assert.equal(m.actualDuration, "4/1");
  assert.deepEqual(
    m.events.filter((e) => e.kind === "note").map((e) => [e.voice, e.onset]),
    [
      ["1", "0/1"],
      ["2", "0/1"],
      ["2", "2/1"],
    ]
  );
});
test("chord notes share onset and do not advance cursor", () => {
  const e = measure("chord-notes").events;
  assert.equal(e.length, 8);
  assert.deepEqual(
    e.map((n) => n.onset),
    ["0/1", "0/1", "1/1", "1/1", "2/1", "2/1", "3/1", "3/1"]
  );
  assert.equal(e[1].chord, true);
});
test("divisions change mid-measure and inherit into the next measure", () => {
  const ms = parseMusicXML(fixture("divisions-change")).parts[0].measures;
  assert.deepEqual(
    ms[0].events.map((e) => e.duration),
    ["1/1", "1/1", "1/1", "1/1"]
  );
  assert.equal(ms[1].events[0].duration, "4/1");
});
test("meter change between measures", () =>
  assert.deepEqual(
    parseMusicXML(fixture("meter-change")).parts[0].measures.map(
      (m) => m.meter
    ),
    [
      { beats: 2, beatType: 4 },
      { beats: 3, beatType: 4 },
      { beats: 4, beatType: 4 },
    ]
  ));
test("grace occupies no time and forward does advance time", () => {
  const m = measure("forward-grace");
  assert.equal(m.events[0].grace, true);
  assert.equal(m.events[0].duration, "0/1");
  assert.deepEqual(
    m.events.map((e) => e.onset),
    ["0/1", "0/1", "1/1", "2/1"]
  );
  assert.equal(m.actualDuration, "4/1");
});
test("lyrics and harmony retained with identity and exact offset", () => {
  const score = parseMusicXML(fixture("lyrics-harmony"));
  const e = score.parts[0].measures[0].events;
  assert.equal(e[0].kind, "harmony");
  assert.equal(e[0].onset, "1/1");
  assert.match(e[0].source.xml, /<kind>major<\/kind>/);
  assert.deepEqual(
    e[1].lyrics.map((l) => l.text),
    [["Thầy Văn Anh"], ["Âm nhạc"]]
  );
  assert.match(e[1].lyrics[1].xml, /<extend\s*\/>/);
  assert.equal(score.sourceXml, fixture("lyrics-harmony"));
  assert.match(e[1].source.path, /part\[1\]\/measure\[1\]/);
});
test("parts have independent inherited divisions and meter; namespaces and XML ids survive", () => {
  const xml = fixture("simple-2-4")
    .replace("<note>", '<note id="note-original">')
    .replace(
      "</score-partwise>",
      '<part id="P2"><measure number="1"><attributes><divisions>1</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes><note><rest/><duration>3</duration><staff>2</staff></note></measure></part></score-partwise>'
    )
    .replace(
      'version="4.0"',
      'version="4.0" xmlns="http://www.musicxml.org/ns/musicxml"'
    );
  const s = parseMusicXML(xml);
  assert.equal(s.parts.length, 2);
  assert.equal(s.parts[1].measures[0].actualDuration, "3/1");
  assert.equal(s.parts[1].measures[0].events[0].staff, "2");
  assert.equal(s.parts[0].measures[0].events[0].source.xmlId, "note-original");
});
test("duplicate measure numbers still have unique source paths", () => {
  const s = parseMusicXML(
    fixture("tie-across-barline").replace('number="2"', 'number="1"')
  );
  assert.notEqual(
    s.parts[0].measures[0].source.id,
    s.parts[0].measures[1].source.id
  );
});
test("reject malformed XML rather than HTML fallback", () =>
  assert.throws(() =>
    parseMusicXML("<score-partwise><part></score-partwise>")
  ));
test("reject unsupported root", () =>
  assert.throws(() => parseMusicXML("<score-timewise/>"), /UNSUPPORTED_ROOT/));
test("reject missing duration and invalid divisions", () => {
  assert.throws(
    () => parseMusicXML(minimal("<note><rest/></note>")),
    /MISSING_DURATION/
  );
  assert.throws(
    () => parseMusicXML(minimal("").replace("<divisions>4", "<divisions>0")),
    /INVALID_DIVISIONS/
  );
});
test("reject negative cursor and orphan chord", () => {
  assert.throws(
    () => parseMusicXML(minimal("<backup><duration>4</duration></backup>")),
    /NEGATIVE_CURSOR/
  );
  assert.throws(
    () =>
      parseMusicXML(
        minimal(
          "<note><chord/><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>"
        )
      ),
    /INVALID_CHORD_ANCHOR/
  );
});

test("XML decimal lexical forms remain exact, including fractional divisions", () => {
  assert.equal(decimal(".5"), "1/2");
  assert.equal(decimal("4."), "4/1");
  assert.equal(decimal("-.25"), "-1/4");
  const xml = minimal("<note><rest/><duration>2</duration></note>").replace(
    "<divisions>4</divisions>",
    "<divisions>.5</divisions>"
  );
  assert.equal(parseMusicXML(xml).parts[0].measures[0].actualDuration, "4/1");
});

test("chord members may have different durations bounded by the main note", () => {
  const main =
    "<note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration></note>";
  const member = (d: number) =>
    `<note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>${d}</duration></note>`;
  const m = parseMusicXML(minimal(main + member(4) + member(8))).parts[0]
    .measures[0];
  assert.equal(m.actualDuration, "4/1");
  assert.deepEqual(
    m.events.map((e) => e.onset),
    ["0/1", "0/1", "0/1"]
  );
  assert.deepEqual(m.diagnostics, []);
});

test("grace chords do not move the subsequent regular note", () => {
  const grace =
    "<note><grace/><pitch><step>D</step><octave>4</octave></pitch><type>eighth</type></note>";
  const xml = minimal(
    grace +
      grace.replace("<grace/>", "<grace/><chord/>") +
      "<note><rest/><duration>16</duration></note>"
  );
  const m = parseMusicXML(xml).parts[0].measures[0];
  assert.deepEqual(
    m.events.map((e) => e.onset),
    ["0/1", "0/1", "0/1"]
  );
  assert.equal(m.actualDuration, "4/1");
});

test("sevenths remain exact after 28 tuplet notes", () => {
  const n =
    "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><time-modification><actual-notes>7</actual-notes><normal-notes>4</normal-notes></time-modification></note>";
  const xml = minimal(n.repeat(28)).replace(
    "<divisions>4</divisions>",
    "<divisions>7</divisions>"
  );
  const m = parseMusicXML(xml).parts[0].measures[0];
  assert.equal(m.actualDuration, "4/1");
  assert.equal(m.events[27].onset, "27/7");
});

test("part without measures is rejected", () => {
  assert.throws(
    () => parseMusicXML('<score-partwise><part id="P1"/></score-partwise>'),
    /MISSING_MEASURE/
  );
});
