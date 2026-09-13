import { EditError } from "./xmlPatch.ts";

/**
 * Trường độ: ba trường phải luôn khớp nhau, không được sửa một cái rồi bỏ đó.
 *
 *   <duration>  số đơn vị, đo bằng `divisions` của chính bản nhạc  (máy dùng)
 *   <type>      hình nốt viết ra                                   (người đọc)
 *   <dot>       số chấm dôi
 *
 * `divisions` là của riêng từng bản nhạc (file thật của thầy: 12). Hình nốt nào
 * chia không hết `divisions` thì bản nhạc ấy KHÔNG ghi được — nói thẳng, không
 * làm tròn.
 */
export const NOTE_TYPES = ["whole", "half", "quarter", "eighth", "16th"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const TYPE_LABEL: Record<NoteType, string> = {
  whole: "nốt tròn",
  half: "nốt trắng",
  quarter: "nốt đen",
  eighth: "móc đơn",
  "16th": "móc kép",
};

/** Hình nốt bằng mấy nốt đen. */
export const QUARTERS: Record<NoteType, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  "16th": 0.25,
};

export const DOT_LABEL = ["không chấm", "chấm đơn", "chấm kép"] as const;

/** Chấm dôi: 1 chấm = ×1,5; 2 chấm = ×1,75. */
export const dotFactor = (dots: number) => 2 - Math.pow(2, -dots);

export const isNoteType = (t: string | null): t is NoteType =>
  !!t && (NOTE_TYPES as readonly string[]).includes(t);

/**
 * Số `<duration>` cho hình nốt này, hoặc lỗi rõ ràng nếu bản nhạc chia không đủ nhỏ.
 * KHÔNG làm tròn: một trường độ sai nửa đơn vị làm hỏng cả ô nhịp.
 */
export function durationFor(type: NoteType, dots: number, divisions: number): number {
  if (!Number.isInteger(divisions) || divisions <= 0)
    throw new EditError("EDIT_DIVISIONS_UNKNOWN", "Bản nhạc không ghi rõ cách chia trường độ.");
  if (!Number.isInteger(dots) || dots < 0 || dots > 2)
    throw new EditError("EDIT_DOTS_INVALID", "Số chấm dôi không hợp lệ.");
  const value = divisions * QUARTERS[type] * dotFactor(dots);
  if (!Number.isInteger(value))
    throw new EditError(
      "EDIT_DURATION_NOT_REPRESENTABLE",
      `Bản nhạc này chưa chia đủ nhỏ để ghi ${TYPE_LABEL[type]}${dots ? " " + DOT_LABEL[dots] : ""}.`
    );
  return value;
}

/** Hình nốt nào còn có dấu chùm (beam): từ móc đơn trở xuống. */
export const coTheChum = (type: NoteType) => QUARTERS[type] < 1;
