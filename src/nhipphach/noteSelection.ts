import type { SourceNote } from "../musicxml-beats/sourceTags.ts";
import { createAnnotations } from "../musicxml-beats/annotations.ts";
import type { BeatMapDocument } from "../musicxml-beats/beatMap.ts";
import { compare } from "../musicxml-beats/rational.ts";
import type { Rational } from "../musicxml-beats/rational.ts";

/**
 * Chọn nốt: từ phần tử SVG được click → đúng MỘT nốt nguồn, hoặc "không resolve".
 *
 * Nguồn sự thật là ID: Verovio đã đưa id nguồn vào `<g class="note">`. Ở đây chỉ
 * đi ngược cây DOM tới phần tử có id nằm trong bảng tra. KHÔNG có toạ độ, KHÔNG
 * "nốt gần nhất", KHÔNG nội suy. Toạ độ chỉ dùng để tô sáng, không để quyết.
 *
 * Module này không ghi gì: không Storage, không database, không khắc lại nhạc.
 */
export const NOTE_SOURCE_NOT_RESOLVED = "NOTE_SOURCE_NOT_RESOLVED";

/** Hình dạng tối thiểu của một phần tử — dùng được với DOM trình duyệt lẫn xmldom. */
export interface ElementLike {
  getAttribute(name: string): string | null;
  /** Cha có thể là Document/ParentNode không có getAttribute — sẽ dừng ở đó. */
  parentNode?: unknown;
  nodeType?: number;
}
const laPhanTu = (x: unknown): x is ElementLike =>
  !!x && typeof (x as ElementLike).getAttribute === "function";

export type Resolution =
  | { kind: "note"; note: SourceNote; element: ElementLike }
  | { kind: "unresolved"; code: typeof NOTE_SOURCE_NOT_RESOLVED; svgId: string }
  | { kind: "none" };

const classesOf = (el: ElementLike) =>
  (el.getAttribute("class") || "").split(/\s+/);

/**
 * Đi ngược từ chỗ click lên tới `<g>` nốt/lặng. Gặp id có trong bảng → nốt nguồn.
 * Gặp một `g.note`/`g.rest` mà id KHÔNG có trong bảng → báo rõ, không chọn đại.
 */
export function resolveNoteElement(
  target: ElementLike | null,
  index: ReadonlyMap<string, SourceNote>
): Resolution {
  for (let cur: unknown = target; laPhanTu(cur); cur = cur.parentNode) {
    const el: ElementLike = cur;
    if (el.nodeType !== undefined && el.nodeType !== 1) continue;
    const id = el.getAttribute("id");
    if (id) {
      const note = index.get(id);
      if (note) return { kind: "note", note, element: el };
    }
    const cls = classesOf(el);
    if (cls.includes("note") || cls.includes("rest")) {
      // Một nốt Verovio vẽ ra mà không có gốc: KHÔNG đoán.
      return { kind: "unresolved", code: NOTE_SOURCE_NOT_RESOLVED, svgId: id || "" };
    }
    // Ra khỏi khuông là bỏ chọn.
    if (cls.includes("system") || cls.includes("page-margin")) break;
  }
  return { kind: "none" };
}

const STEP_VI: Record<string, string> = {};
const ALTER: Record<number, string> = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" };
const DURATION_VI: Record<string, string> = {
  maxima: "maxima",
  long: "nốt dài",
  breve: "nốt vuông",
  whole: "nốt tròn",
  half: "nốt trắng",
  quarter: "nốt đen",
  eighth: "móc đơn",
  "16th": "móc kép",
  "32nd": "móc ba",
  "64th": "móc tư",
  "128th": "móc năm",
};

export function pitchText(pitch: SourceNote["pitch"]): string {
  if (!pitch) return "—";
  const step = STEP_VI[pitch.step] ?? pitch.step;
  return `${step}${ALTER[pitch.alter] ?? `(${pitch.alter})`}${pitch.octave}`;
}

export function durationText(note: SourceNote): string {
  const base = note.noteType ? DURATION_VI[note.noteType] ?? note.noteType : "—";
  const dots = note.dots ? " " + "chấm".repeat(1) + (note.dots > 1 ? ` ×${note.dots}` : "") : "";
  return `${note.grace ? "nốt hoa mỹ · " : ""}${base}${dots}`;
}

/**
 * Nhãn phách tại chỗ nốt bắt đầu — lấy từ CHÍNH lưới đếm của công cụ (mức Chia
 * tư, cùng cách chia nhịp lẻ đang chọn), không tính tay lần thứ hai.
 * Không có điểm khớp (ví dụ chùm ba) thì nói rõ là nằm giữa hai phách.
 */
export function beatText(
  note: SourceNote,
  map: BeatMapDocument,
  onset: Rational | null
): string {
  const measure = map.measures.find(
    (m) => m.measureId === `/score-partwise/part[${note.partIndex}]/measure[${note.measureIndex}]`
  );
  if (!measure || onset === null) return "—";
  const stamp = onset;
  const labels = createAnnotations(map, "sixteenths").filter(
    (a) => a.sourceMeasureId === measure.measureId
  );
  const hit = labels.find((a) => compare(a.offset, stamp) === 0);
  if (hit) {
    // "2 &": phách chính đứng trước nhãn phụ gần nhất.
    const beat = [...labels]
      .filter((a) => a.kind === "beat" && compare(a.offset, stamp) <= 0)
      .pop();
    return hit.kind === "beat" || !beat ? hit.label : `${beat.label} ${hit.label}`;
  }
  const truoc = [...labels].filter((a) => compare(a.offset, stamp) < 0).pop();
  return truoc ? `sau phách ${truoc.label}` : "—";
}

export interface NoteDescription {
  measure: string;
  beat: string;
  pitch: string;
  duration: string;
  voice: string;
  staff: string;
  tab: string | null;
  kind: SourceNote["kind"];
}

export function describeNote(
  note: SourceNote,
  map: BeatMapDocument,
  onset: Rational | null
): NoteDescription {
  return {
    measure: note.measureNumber,
    beat: beatText(note, map, onset),
    pitch: note.kind === "rest" ? "lặng" : pitchText(note.pitch),
    duration: durationText(note),
    voice: note.voice,
    staff: note.staff,
    tab: note.tab ? `dây ${note.tab.string} · phím ${note.tab.fret}` : null,
    kind: note.kind,
  };
}
