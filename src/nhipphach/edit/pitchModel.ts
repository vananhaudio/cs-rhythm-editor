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
 * Dịch một cao độ đi `nuaCung` nửa cung, rồi CHỌN CÁCH GHI.
 *
 * Hai việc khác nhau, ở đây làm cùng lúc vì không tách được: đi lên nửa cung từ
 * Đô ra một tiếng, nhưng viết nó là Đô♯ hay Rê♭ là một quyết định nữa. Luật
 * chọn (theo cách MuseScore vẫn làm, để thầy không phải học lại):
 *   1. ít dấu hoá nhất
 *   2. đi LÊN thì ưu tiên dấu thăng, đi XUỐNG thì ưu tiên dấu giáng
 *   3. gần bậc cũ nhất
 * Ra ngoài tầm quãng tám 0…9 thì trả `null` — không cuộn vòng, không kẹp biên.
 */
export function transposeSemitone(p: Pitch, nuaCung: number): Pitch | null {
  // Nhảy trọn quãng tám thì GIỮ NGUYÊN mặt chữ: Mi♭4 lên một quãng tám là Mi♭5,
  // không phải Rê♯5. Luật "đi lên ưu tiên dấu thăng" chỉ dành cho bước lẻ.
  if (nuaCung % 12 === 0) {
    const octave = p.octave + nuaCung / 12;
    return octave < 0 || octave > 9 ? null : { ...p, octave };
  }
  const dich = soundingPitch(p) + nuaCung;
  const bacCu = STEPS.indexOf(p.step);
  const ungVien: Pitch[] = [];
  for (const step of STEPS)
    for (let octave = 0; octave <= 9; octave++) {
      const alter = dich - ((octave + 1) * 12 + STEP_SEMITONE[step]);
      if (alter < -2 || alter > 2) continue;
      ungVien.push({ step, alter, octave });
    }
  if (!ungVien.length) return null;
  const huong = nuaCung >= 0 ? -1 : 1;
  ungVien.sort(
    (a, b) =>
      Math.abs(a.alter) - Math.abs(b.alter) ||
      huong * (a.alter - b.alter) ||
      Math.abs(STEPS.indexOf(a.step) - bacCu) - Math.abs(STEPS.indexOf(b.step) - bacCu)
  );
  return ungVien[0];
}

/**
 * Đổi dấu hoá của CHÍNH bậc đang có: Đô → Đô♯ / Đô♭ / Đô♮. Không phải dịch
 * giọng — mặt chữ giữ nguyên, chỉ tiếng đổi. Đây là việc của ba nút ♭ ♮ ♯.
 */
export const withAlter = (p: Pitch, alter: number): Pitch => ({ ...p, alter });

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
