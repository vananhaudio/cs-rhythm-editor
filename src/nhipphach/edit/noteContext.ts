import type { Document, Element } from "@xmldom/xmldom";
import type { Pitch, Step } from "./commands.ts";
import { accidentalKey, ALTER_FOR_ACCIDENTAL } from "./accidentals.ts";
import { STEP_SEMITONE } from "./pitchModel.ts";
import { elementChildren, resolveSourcePath, SOURCE_PATH } from "./xmlPatch.ts";

/**
 * Ngữ cảnh thật của MỘT nốt, đọc từ chính tài liệu — không suy đoán, không mặc định.
 *
 * Mọi thứ ở đây đều là thứ mà sửa một nốt phải biết trước khi ra tay: bản nhạc
 * chia trường độ thế nào, đang ở bộ khoá gì, trong ô nhịp này đã có dấu hoá nào
 * được viết, nốt có nằm trong hợp âm / chùm ba / dấu nối / TAB hay không.
 */
export interface NoteContext {
  staff: string;
  voice: string;
  divisions: number;
  fifths: number;
  /** Dấu hoá ĐÃ VIẾT trước nốt này trong cùng ô nhịp, cùng khuông: "F4" → alter. */
  written: Map<string, number>;
  kind: "note" | "rest";
  pitch: Pitch | null;
  accidental: string | null;
  noteType: string | null;
  dots: number;
  grace: boolean;
  /** "member" = nốt phụ của hợp âm; "head" = nốt cái, có nốt phụ đi kèm. */
  chord: "none" | "head" | "member";
  tuplet: boolean;
  ties: string[];
  tab: { string: number; fret: number } | null;
  /** Cao độ mà dây + phím TAB thật sự phát ra, nếu bản nhạc ghi cách lên dây. */
  tabSounding: number | null;
  isTabStaff: boolean;
  beams: number;
}

const text = (e: Element | undefined, name: string) =>
  e ? elementChildren(e, name)[0]?.textContent?.trim() ?? "" : "";
const firstChild = (e: Element, name: string) => elementChildren(e, name)[0];

const readPitch = (note: Element): Pitch | null => {
  const p = firstChild(note, "pitch");
  if (!p) return null;
  const step = text(p, "step") as Step;
  if (!(step in STEP_SEMITONE)) return null;
  return { step, alter: Number(text(p, "alter") || "0"), octave: Number(text(p, "octave")) };
};

const noteStaff = (note: Element) => text(note, "staff") || "1";

/** Cách lên dây của khuông TAB, theo `<staff-details>` — không có thì không đoán. */
function tuningOf(attributes: Element[], staff: string): Map<number, number> | null {
  for (let i = attributes.length - 1; i >= 0; i--) {
    for (const sd of elementChildren(attributes[i], "staff-details")) {
      if ((sd.getAttribute("number") || "1") !== staff) continue;
      const tunings = elementChildren(sd, "staff-tuning");
      if (!tunings.length) continue;
      const lines = Number(text(sd, "staff-lines") || String(tunings.length));
      const map = new Map<number, number>();
      for (const t of tunings) {
        const line = Number(t.getAttribute("line"));
        const step = text(t, "tuning-step") as Step;
        const octave = Number(text(t, "tuning-octave"));
        const alter = Number(text(t, "tuning-alter") || "0");
        if (!line || !(step in STEP_SEMITONE) || !Number.isFinite(octave)) continue;
        // Dây số 1 là dây cao nhất = dòng trên cùng; `line` đếm từ dòng dưới lên.
        map.set(lines + 1 - line, (octave + 1) * 12 + STEP_SEMITONE[step] + alter);
      }
      if (map.size) return map;
    }
  }
  return null;
}

/**
 * Đọc ngữ cảnh tại `path`. Đi tuần tự từ ô nhịp đầu của bè tới đúng nốt đó, vì
 * `divisions`, bộ khoá và dấu hoá trong ô đều là thứ tích luỹ theo thứ tự đọc.
 */
export function readNoteContext(doc: Document, path: string): NoteContext | null {
  const m = SOURCE_PATH.exec(path);
  const note = resolveSourcePath(doc, path);
  if (!m || !note || note.localName !== "note") return null;
  const partIndex = +m[1];
  const measureIndex = +m[2];
  const childIndex = +m[3];
  const part = elementChildren(doc.documentElement!, "part")[partIndex - 1]!;
  const measures = elementChildren(part, "measure");
  const staff = noteStaff(note);

  let divisions = 0;
  let fifths = 0;
  const attributes: Element[] = [];
  const written = new Map<string, number>();

  for (let mi = 0; mi < measureIndex; mi++) {
    const measure = measures[mi];
    if (!measure) break;
    const cuoiO = mi === measureIndex - 1;
    if (!cuoiO) written.clear();
    const children = elementChildren(measure);
    for (let ci = 0; ci < children.length; ci++) {
      if (cuoiO && ci === childIndex - 1) break;
      const el = children[ci];
      if (el.localName === "attributes") {
        attributes.push(el);
        const d = text(el, "divisions");
        if (d) divisions = Number(d);
        // Bộ khoá có thể ghi riêng cho từng khuông; không ghi số thì áp cho cả bè.
        const keys = elementChildren(el, "key");
        const key =
          keys.find((k) => (k.getAttribute("number") || "") === staff) ??
          keys.find((k) => !k.getAttribute("number"));
        if (key) fifths = Number(text(key, "fifths") || "0");
      } else if (cuoiO && el.localName === "note" && noteStaff(el) === staff) {
        // Dấu hoá đã VIẾT ra mới đổi kỳ vọng của người đọc; `alter` đơn thuần thì không.
        const accid = text(el, "accidental");
        const p = readPitch(el);
        if (accid && p && accid in ALTER_FOR_ACCIDENTAL)
          written.set(accidentalKey(p.step, p.octave), ALTER_FOR_ACCIDENTAL[accid]);
      }
    }
  }

  const sau = elementChildren(note.parentNode as Element)[childIndex];
  const pitch = readPitch(note);
  const tech = firstChild(note, "notations")
    ? firstChild(firstChild(note, "notations")!, "technical")
    : undefined;
  const str = tech ? text(tech, "string") : "";
  const fret = tech ? text(tech, "fret") : "";
  const tab =
    /^\d+$/.test(str) && /^\d+$/.test(fret)
      ? { string: Number(str), fret: Number(fret) }
      : null;
  const tuning = tab ? tuningOf(attributes, staff) : null;
  const day = tab && tuning ? tuning.get(tab.string) : undefined;

  let isTabStaff = false;
  for (const attr of attributes)
    for (const clef of elementChildren(attr, "clef"))
      if ((clef.getAttribute("number") || "1") === staff)
        isTabStaff = text(clef, "sign") === "TAB";

  return {
    isTabStaff,
    staff,
    voice: text(note, "voice") || "1",
    divisions,
    fifths,
    written,
    kind: firstChild(note, "rest") ? "rest" : "note",
    pitch,
    accidental: text(note, "accidental") || null,
    noteType: text(note, "type") || null,
    dots: elementChildren(note, "dot").length,
    grace: !!firstChild(note, "grace"),
    chord: firstChild(note, "chord")
      ? "member"
      : sau && sau.localName === "note" && firstChild(sau, "chord")
        ? "head"
        : "none",
    tuplet: !!firstChild(note, "time-modification"),
    ties: [
      ...elementChildren(note, "tie").map((t) => t.getAttribute("type") || ""),
      ...elementChildren(note, "notations").flatMap((n) =>
        elementChildren(n, "tied").map((t) => t.getAttribute("type") || "")
      ),
    ].filter(Boolean),
    tab,
    tabSounding: day === undefined ? null : day + tab!.fret,
    beams: elementChildren(note, "beam").length,
  };
}

/**
 * Nốt ĐỨNG SAU trong cùng ô nhịp, cùng khuông, cùng tên nốt và quãng tám, mà
 * không tự mang dấu hoá — những nốt này đọc theo dấu hoá của nốt trước, nên đổi
 * nốt trước là đổi cách đọc chúng. Không tự sửa; chỉ để cảnh báo.
 */
export function laterInMeasure(
  doc: Document,
  path: string
): { path: string; pitch: Pitch; accidental: string | null }[] {
  const m = SOURCE_PATH.exec(path);
  const note = resolveSourcePath(doc, path);
  if (!m || !note) return [];
  const staff = noteStaff(note);
  const goc = readPitch(note);
  if (!goc) return [];
  const measure = note.parentNode as Element;
  const children = elementChildren(measure);
  const out: { path: string; pitch: Pitch; accidental: string | null }[] = [];
  for (let ci = +m[3]; ci < children.length; ci++) {
    const el = children[ci];
    if (el.localName !== "note" || noteStaff(el) !== staff) continue;
    const p = readPitch(el);
    if (!p || p.step !== goc.step || p.octave !== goc.octave) continue;
    out.push({
      path: `/score-partwise/part[${m[1]}]/measure[${m[2]}]/*[${ci + 1}]`,
      pitch: p,
      accidental: text(el, "accidental") || null,
    });
  }
  return out;
}
