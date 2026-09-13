import type { Pitch, Step } from "./commands.ts";
import { STEPS } from "./commands.ts";

/**
 * Cao độ: tách bạch ba thứ mà MusicXML cố ý để riêng.
 *
 *   cao độ VANG LÊN   = step + alter + octave   (`<pitch>`; MEI `@accid.ges`)
 *   CÁCH GHI          = chọn step nào để viết   (G♯ hay A♭ — cùng tiếng, khác mặt chữ)
 *   DẤU HOÁ HIỂN THỊ  = `<accidental>`          (MEI `@accid`; CHỈ cái này được vẽ)
 *
 * Đã đo trên Verovio: `<alter>` một mình chỉ thành `@accid.ges` — đổi `alter` mà
 * không đụng `<accidental>` thì bản nhạc VANG LÊN khác nhưng NHÌN y như cũ; và
 * `<accidental>` còn sót lại thì vẽ ra dấu không đúng tiếng. Vì thế mọi lệnh sửa
 * cao độ ở đây đều phải trả lời luôn câu "vậy vẽ dấu gì".
 */
export const STEP_SEMITONE: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Số nửa cung tuyệt đối (chuẩn MIDI: C4 = 60). Dùng để so "cùng tiếng hay không". */
export const soundingPitch = (p: Pitch): number =>
  (p.octave + 1) * 12 + STEP_SEMITONE[p.step] + p.alter;

export const ALTER_SYMBOL: Record<number, string> = {
  [-2]: "♭♭",
  [-1]: "♭",
  0: "",
  1: "♯",
  2: "♯♯",
};

export const pitchName = (p: Pitch): string =>
  `${p.step}${ALTER_SYMBOL[p.alter] ?? `(${p.alter})`}${p.octave}`;

export const samePitch = (a: Pitch, b: Pitch) =>
  a.step === b.step && a.alter === b.alter && a.octave === b.octave;

/**
 * Các cách ghi khác cho CÙNG một tiếng (G♯4 ↔ A♭4). Không phải dịch giọng:
 * `soundingPitch` giữ nguyên. Chỉ nhận tối đa hai dấu hoá — quá nữa thì không ai đọc.
 */
export function enharmonics(p: Pitch): Pitch[] {
  const target = soundingPitch(p);
  const out: Pitch[] = [];
  for (const step of STEPS)
    for (let octave = p.octave - 1; octave <= p.octave + 1; octave++) {
      const alter = target - ((octave + 1) * 12 + STEP_SEMITONE[step]);
      if (alter < -2 || alter > 2 || !Number.isInteger(alter)) continue;
      const cand = { step, alter, octave };
      if (!samePitch(cand, p)) out.push(cand);
    }
  // Ưu tiên cách ghi ít dấu hoá nhất, rồi tới gần bậc cũ nhất.
  return out.sort(
    (a, b) => Math.abs(a.alter) - Math.abs(b.alter) || STEPS.indexOf(a.step) - STEPS.indexOf(b.step)
  );
}
