import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Element } from "@xmldom/xmldom";
import { ZERO, add, sub, div, decimal, compare } from "./rational.ts";
import type { Rational } from "./rational.ts";
import type {
  NormalizedScore,
  NormalizedMeasure,
  SourceIdentity,
  TimedEvent,
  Meter,
} from "./model.ts";
const children = (e: Element, name?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!name || n.localName === name)
  );
const first = (e: Element, name: string) => children(e, name)[0];
const text = (e: Element, name: string) =>
  first(e, name)?.textContent?.trim() ?? "";
const serializer = new XMLSerializer();
const source = (e: Element, path: string): SourceIdentity => ({
  id: path,
  path,
  xmlId: e.getAttribute("id") || e.getAttribute("xml:id") || null,
  xml: serializer.serializeToString(e),
});
/** Structural source paths remain unique even when MusicXML repeats measure numbers. */
export function parseMusicXML(xml: string): NormalizedScore {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level, message) => {
      errors.push(`${level}: ${message}`);
    },
  }).parseFromString(xml, "application/xml");
  if (errors.length || !doc.documentElement)
    throw new Error(`INVALID_XML: ${errors.join("; ")}`);
  const root = doc.documentElement;
  if (root.localName !== "score-partwise")
    throw new Error("UNSUPPORTED_ROOT: expected score-partwise");
  const result: NormalizedScore = {
    sourceXml: xml,
    parts: [],
    diagnostics: [],
  };
  for (const [pi, part] of children(root, "part").entries()) {
    const path = `/score-partwise/part[${pi + 1}]`;
    const p = {
      id: part.getAttribute("id") || `P${pi + 1}`,
      source: source(part, path),
      measures: [] as NormalizedMeasure[],
    };
    result.parts.push(p);
    if (!children(part, "measure").length)
      throw new Error(`MISSING_MEASURE: ${path}`);
    let divisions: Rational | null = null,
      meter: Meter | null = null;
    for (const [mi, m] of children(part, "measure").entries()) {
      const mp = `${path}/measure[${mi + 1}]`;
      const measure: NormalizedMeasure = {
        source: source(m, mp),
        number: m.getAttribute("number") || String(mi + 1),
        index: mi,
        implicit: m.getAttribute("implicit") === "yes",
        meter,
        actualDuration: ZERO,
        events: [],
        diagnostics: [],
      };
      p.measures.push(measure);
      let cursor = ZERO,
        extent = ZERO;
      let previous: TimedEvent | null = null;
      const issue = (code: string, message: string, id = mp) =>
        measure.diagnostics.push({ code, sourceId: id, message });
      for (const [ci, el] of children(m).entries()) {
        const tag = el.localName ?? el.tagName,
          ep = `${mp}/*[${ci + 1}]`;
        if (tag === "attributes") {
          const dv = text(el, "divisions");
          if (dv) {
            divisions = decimal(dv);
            if (compare(divisions, ZERO) <= 0)
              throw new Error(`INVALID_DIVISIONS: ${ep}`);
          }
          for (const t of children(el, "time")) {
            const bs = text(t, "beats"),
              bt = text(t, "beat-type");
            // `<beats>2+3</beats>` là cách MusicXML ghi RÕ nhịp cộng. Chỉ đọc nguyên
            // văn ở đây; việc cách chia đó có được hỗ trợ hay không do meterGrouping
            // quyết, nên nhịp cộng ngoài phạm vi vẫn ra UNSUPPORTED_METER như cũ.
            const parts = /^\d+(\+\d+)*$/.test(bs) ? bs.split("+").map(Number) : null;
            if (
              t.hasAttribute("number") ||
              children(t, "beats").length !== 1 ||
              !parts ||
              !parts.every((n) => Number.isSafeInteger(n) && n > 0) ||
              !/^\d+$/.test(bt) ||
              !Number.isSafeInteger(Number(bt)) ||
              Number(bt) <= 0
            ) {
              issue(
                "UNSUPPORTED_METER",
                "Composite, staff-specific or missing meter"
              );
              meter = null;
            } else
              meter =
                parts.length > 1
                  ? {
                      beats: parts.reduce((a, b) => a + b, 0),
                      beatType: Number(bt),
                      additive: parts,
                    }
                  : { beats: parts[0], beatType: Number(bt) };
            if (
              compare(cursor, ZERO) !== 0 ||
              measure.events.some((e) => e.kind === "note" || e.kind === "rest")
            )
              issue(
                "MID_MEASURE_METER_CHANGE",
                "Meter change within measure is unsupported"
              );
            measure.meter = meter;
          }
          continue;
        }
        if (!["note", "harmony", "backup", "forward"].includes(tag)) continue;
        const grace = !!first(el, "grace"),
          chord = !!first(el, "chord");
        let duration = ZERO;
        if (tag !== "harmony" && !grace) {
          const raw = text(el, "duration");
          if (!raw || !divisions)
            throw new Error(`MISSING_DURATION_OR_DIVISIONS: ${ep}`);
          duration = div(decimal(raw), divisions);
          if (compare(duration, ZERO) <= 0)
            throw new Error(`INVALID_DURATION: ${ep}`);
        }
        let onset = cursor;
        const voice = text(el, "voice") || "1",
          staff = text(el, "staff") || "1";
        if (chord) {
          if (
            !previous ||
            previous.voice !== voice ||
            previous.grace !== grace ||
            previous.kind !== "note"
          )
            throw new Error(`INVALID_CHORD_ANCHOR: ${ep}`);
          onset = previous.onset;
          if (compare(duration, previous.duration) > 0)
            issue(
              "CHORD_DURATION_EXCEEDS_ANCHOR",
              "Chord tone exceeds anchor duration",
              ep
            );
        }
        if (tag === "harmony" && first(el, "offset")) {
          if (!divisions) throw new Error(`MISSING_DIVISIONS: ${ep}`);
          onset = add(cursor, div(decimal(text(el, "offset")), divisions));
        }
        const pitch = first(el, "pitch"),
          tm = first(el, "time-modification");
        const ev: TimedEvent = {
          source: source(el, ep),
          kind:
            tag === "note"
              ? first(el, "rest")
                ? "rest"
                : "note"
              : (tag as "harmony" | "forward" | "backup"),
          onset,
          duration,
          voice,
          staff,
          chord,
          grace,
          dots: children(el, "dot").length,
          noteType: text(el, "type") || null,
          pitch: pitch
            ? {
                step: text(pitch, "step"),
                alter: text(pitch, "alter") || "0",
                octave: text(pitch, "octave"),
              }
            : null,
          ties: children(el, "tie").map((t) => t.getAttribute("type") || ""),
          tied: children(el, "notations").flatMap((n) =>
            children(n, "tied").map((t) => t.getAttribute("type") || "")
          ),
          timeModification: tm
            ? {
                actualNotes: text(tm, "actual-notes"),
                normalNotes: text(tm, "normal-notes"),
                normalType: text(tm, "normal-type") || null,
                normalDots: children(tm, "normal-dot").length,
              }
            : null,
          lyrics: children(el, "lyric").map((l) => ({
            number: l.getAttribute("number"),
            name: l.getAttribute("name"),
            text: children(l, "text").map((t) => t.textContent || ""),
            syllabic: children(l, "syllabic").map((t) => t.textContent || ""),
            xml: serializer.serializeToString(l),
          })),
        };
        measure.events.push(ev);
        if (tag === "backup") {
          cursor = sub(cursor, duration);
          previous = null;
          if (compare(cursor, ZERO) < 0)
            throw new Error(`NEGATIVE_CURSOR: ${ep}`);
        } else if (tag === "forward") {
          cursor = add(cursor, duration);
          previous = null;
        } else if (tag === "note") {
          if (!chord && !grace) cursor = add(cursor, duration);
          if (!chord) previous = ev;
        }
        if (tag === "note" && !grace) {
          const end = add(onset, duration);
          if (compare(end, extent) > 0) extent = end;
        }
        if (compare(cursor, extent) > 0) extent = cursor;
      }
      measure.actualDuration = extent;
      if (!measure.meter)
        issue(
          "MISSING_OR_UNSUPPORTED_METER",
          "No usable meter for this measure"
        );
    }
  }
  if (!result.parts.length) throw new Error("MISSING_PART");
  return result;
}
