import { nhoTheoNguon } from "../../musicxml-beats/sourceCache.ts";
import type { Document, Element } from "@xmldom/xmldom";
import type { Step } from "./commands.ts";
import { accidentalKey, ALTER_FOR_ACCIDENTAL, keyAlter } from "./accidentals.ts";
import { STEP_SEMITONE } from "./pitchModel.ts";
import { elementChildren, parseStrict } from "./xmlPatch.ts";

/**
 * Những chỗ bản nhạc "nhìn một đằng, vang một nẻo" — thứ mà sửa một nốt rất dễ
 * gây ra mà không ai thấy ngay:
 *
 *  - TAB ghi dây/phím không còn khớp cao độ của chính nốt đó;
 *  - một nốt sau trong cùng ô nhịp không mang dấu hoá, nên người đọc đọc nó
 *    theo dấu của nốt trước — mà nốt trước vừa bị đổi.
 *
 * KHÔNG tự sửa hộ (mục "chỉ thay đúng node cần sửa"), chỉ nói ra. Và giống tầng
 * nhịp: chỉ những chỗ MỚI phát sinh mới đáng báo, lỗi vốn có của bản gốc thì không.
 */
export const TAB_MISMATCH = "TAB_POSITION_MAY_NOT_MATCH_PITCH";
export const ACCIDENTAL_READING = "ACCIDENTAL_READING_CHANGED";

export interface NoteWarning {
  code: typeof TAB_MISMATCH | typeof ACCIDENTAL_READING;
  path: string;
  message: string;
}

const text = (e: Element | undefined, name: string) =>
  e ? elementChildren(e, name)[0]?.textContent?.trim() ?? "" : "";
const firstOf = (e: Element, name: string) => elementChildren(e, name)[0];

/** Một lượt duyệt cả bản nhạc; mọi trạng thái tích luỹ (divisions, khoá, dấu hoá) đi theo thứ tự đọc. */
export function scoreProblems(doc: Document): NoteWarning[] {
  const out: NoteWarning[] = [];
  const root = doc.documentElement;
  if (!root || root.localName !== "score-partwise") return out;

  elementChildren(root, "part").forEach((part, pi) => {
    const fifths = new Map<string, number>();
    const tunings = new Map<string, Map<number, number>>();
    elementChildren(part, "measure").forEach((measure, mi) => {
      const written = new Map<string, Map<string, number>>();
      elementChildren(measure).forEach((el, ci) => {
        if (el.localName === "attributes") {
          for (const key of elementChildren(el, "key"))
            fifths.set(key.getAttribute("number") || "*", Number(text(key, "fifths") || "0"));
          for (const sd of elementChildren(el, "staff-details")) {
            const day = elementChildren(sd, "staff-tuning");
            if (!day.length) continue;
            const lines = Number(text(sd, "staff-lines") || String(day.length));
            const map = new Map<number, number>();
            for (const t of day) {
              const line = Number(t.getAttribute("line"));
              const step = text(t, "tuning-step") as Step;
              const octave = Number(text(t, "tuning-octave"));
              if (!line || !(step in STEP_SEMITONE) || !Number.isFinite(octave)) continue;
              map.set(
                lines + 1 - line,
                (octave + 1) * 12 + STEP_SEMITONE[step] + Number(text(t, "tuning-alter") || "0")
              );
            }
            if (map.size) tunings.set(sd.getAttribute("number") || "1", map);
          }
          return;
        }
        if (el.localName !== "note") return;
        const pitchEl = firstOf(el, "pitch");
        if (!pitchEl) return;
        const step = text(pitchEl, "step") as Step;
        if (!(step in STEP_SEMITONE)) return;
        const alter = Number(text(pitchEl, "alter") || "0");
        const octave = Number(text(pitchEl, "octave"));
        const staff = text(el, "staff") || "1";
        const path = `/score-partwise/part[${pi + 1}]/measure[${mi + 1}]/*[${ci + 1}]`;
        const oNhip = measure.getAttribute("number") || String(mi + 1);

        // ── Cách người đọc sẽ đọc nốt này ────────────────────────────────────
        const khoa = fifths.get(staff) ?? fifths.get("*") ?? 0;
        const daViet = written.get(staff) ?? new Map<string, number>();
        const accid = text(el, "accidental");
        const key = accidentalKey(step, octave);
        if (accid && accid in ALTER_FOR_ACCIDENTAL) {
          daViet.set(key, ALTER_FOR_ACCIDENTAL[accid]);
          written.set(staff, daViet);
        } else {
          const doc = daViet.get(key) ?? keyAlter(step, khoa);
          if (doc !== alter)
            out.push({
              code: ACCIDENTAL_READING,
              path,
              message: `Ô nhịp ${oNhip}: một nốt ${step}${octave} không mang dấu hoá nên sẽ được đọc khác tiếng thật của nó.`,
            });
        }

        // ── TAB có còn khớp cao độ không ─────────────────────────────────────
        const tech = firstOf(el, "notations")
          ? firstOf(firstOf(el, "notations")!, "technical")
          : undefined;
        const day = tech ? text(tech, "string") : "";
        const phim = tech ? text(tech, "fret") : "";
        if (/^\d+$/.test(day) && /^\d+$/.test(phim)) {
          const tuning = tunings.get(staff);
          const goc = tuning?.get(Number(day));
          if (goc !== undefined && goc + Number(phim) !== (octave + 1) * 12 + STEP_SEMITONE[step] + alter)
            out.push({
              code: TAB_MISMATCH,
              path,
              message: `Ô nhịp ${oNhip}: thế bấm trên khuông TAB (dây ${day}, phím ${phim}) không còn khớp cao độ của nốt.`,
            });
        }
      });
    });
  });
  return out;
}

/**
 * Vấn đề của một chuỗi nguồn, tính MỘT lần (4D.P). Bản gốc không bao giờ đổi,
 * vậy mà trước đây mỗi phím lại đọc lại nó. Kết quả dùng chung nên đóng băng.
 */
const boNhoVanDe = nhoTheoNguon<readonly NoteWarning[]>();
const vanDeCua = (xml: string): readonly NoteWarning[] =>
  boNhoVanDe.lay(xml, () =>
    Object.freeze(scoreProblems(parseStrict(xml)).map((w) => Object.freeze(w)))
  );

const khoaCanh = (w: NoteWarning) => `${w.code}@${w.path}`;

/** Chỉ những chỗ bản nháp MỚI gây ra. Bản gốc vốn đã vậy thì không phải việc của lần sửa này. */
export function newWarnings(original: string, draft: string): NoteWarning[] {
  let cu: Set<string>;
  try {
    cu = new Set(vanDeCua(original).map(khoaCanh));
  } catch {
    cu = new Set();
  }
  try {
    return vanDeCua(draft).filter((w) => !cu.has(khoaCanh(w)));
  } catch {
    return [];
  }
}
