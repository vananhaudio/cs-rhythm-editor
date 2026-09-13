import type { Pitch, Step } from "./commands.ts";

/**
 * Dấu hoá HIỂN THỊ — thứ duy nhất người đọc nhìn thấy.
 *
 * Luật ký âm chuẩn: một nốt phải mang dấu hoá khi tiếng của nó KHÁC với thứ mà
 * bộ khoá cộng các dấu hoá đã viết trước đó trong cùng ô nhịp khiến người đọc
 * chờ đợi. Ở đây không đoán gì ngoài luật ấy; muốn ghi rõ (dấu nhắc) thì thầy
 * chọn tay, còn không thì để "Tự động".
 */
export type AccidentalChoice = "auto" | "hien" | "an";

export const ACCIDENTAL_FOR_ALTER: Record<number, string> = {
  [-2]: "flat-flat",
  [-1]: "flat",
  0: "natural",
  1: "sharp",
  2: "double-sharp",
};

export const ALTER_FOR_ACCIDENTAL: Record<string, number> = {
  "flat-flat": -2,
  "double-flat": -2,
  flat: -1,
  natural: 0,
  sharp: 1,
  "double-sharp": 2,
  sharp_sharp: 2,
};

/** Thứ tự dấu thăng/giáng của bộ khoá — luật cố định, không phụ thuộc bài nào. */
const SHARP_ORDER: Step[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: Step[] = ["B", "E", "A", "D", "G", "C", "F"];

/** Bộ khoá `fifths` khiến bậc này mặc định mang mấy nửa cung. */
export function keyAlter(step: Step, fifths: number): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, Math.min(fifths, 7)).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, Math.min(-fifths, 7)).includes(step) ? -1 : 0;
  return 0;
}

export const accidentalKey = (step: Step, octave: number) => `${step}${octave}`;

/**
 * Tiếng mà người đọc CHỜ ĐỢI ở vị trí này: dấu hoá đã viết trong ô nhịp thắng
 * bộ khoá; không có gì thì theo bộ khoá.
 */
export function impliedAlter(
  pitch: Pick<Pitch, "step" | "octave">,
  fifths: number,
  written: ReadonlyMap<string, number>
): number {
  const trong = written.get(accidentalKey(pitch.step, pitch.octave));
  return trong ?? keyAlter(pitch.step, fifths);
}

/**
 * Dấu hoá cần viết cho nốt này: `null` nghĩa là không viết gì.
 * "Tự động" = viết khi và chỉ khi tiếng khác điều người đọc chờ đợi.
 */
export function decideAccidental(
  pitch: Pitch,
  fifths: number,
  written: ReadonlyMap<string, number>,
  choice: AccidentalChoice = "auto"
): string | null {
  if (choice === "an") return null;
  if (choice === "hien") return ACCIDENTAL_FOR_ALTER[pitch.alter] ?? null;
  return pitch.alter === impliedAlter(pitch, fifths, written)
    ? null
    : ACCIDENTAL_FOR_ALTER[pitch.alter] ?? null;
}
