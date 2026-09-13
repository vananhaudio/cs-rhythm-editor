import type { Element } from "@xmldom/xmldom";
import { elementChildren, parseStrict, resolveSourcePath } from "./xmlPatch.ts";
import type { Pitch, Step } from "./commands.ts";

/**
 * Đọc các ô mà panel biên tập cần cho MỘT nốt, từ đúng bản nháp đang hiện.
 * Chỉ đọc; không đụng gì. `SourceNote` của Nội dung 2 đủ để chọn, nhưng không
 * mang lời — và sau mỗi lệnh thì cao độ trong nháp đã khác nguồn.
 */
export interface NoteFields {
  kind: "note" | "rest";
  pitch: Pitch | null;
  lyrics: { number: string; text: string; compound: boolean }[];
}

export function readNoteFields(xml: string, path: string): NoteFields | null {
  let doc;
  try {
    doc = parseStrict(xml);
  } catch {
    return null;
  }
  const note = resolveSourcePath(doc, path);
  if (!note || note.localName !== "note") return null;
  const pitchEl = elementChildren(note, "pitch")[0];
  const t = (e: Element | undefined, name: string) =>
    e ? elementChildren(e, name)[0]?.textContent ?? "" : "";
  return {
    kind: elementChildren(note, "rest").length ? "rest" : "note",
    pitch: pitchEl
      ? {
          step: (t(pitchEl, "step") || "C") as Step,
          alter: Number(t(pitchEl, "alter") || "0"),
          octave: Number(t(pitchEl, "octave") || "4"),
        }
      : null,
    lyrics: elementChildren(note, "lyric").map((l) => {
      const texts = elementChildren(l, "text");
      return {
        number: l.getAttribute("number") || "1",
        // Âm tiết ghép hiện cả phần nối (<elision>) để thầy đọc được như trên bản nhạc.
        text: elementChildren(l)
          .filter((x) => x.localName === "text" || x.localName === "elision")
          .map((x) => x.textContent ?? "")
          .join(""),
        compound: texts.length !== 1,
      };
    }),
  };
}
