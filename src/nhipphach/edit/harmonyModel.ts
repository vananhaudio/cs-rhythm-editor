import type { Step } from "./commands.ts";

/**
 * Hợp âm theo MusicXML — Giai đoạn Nội dung 3C.
 *
 * KHÔNG có bộ đọc tên hợp âm ở đây. `<kind>` của MusicXML là một TỪ VỰNG ĐÓNG,
 * nên chọn trong bảng là cách ánh xạ duy nhất chắc chắn; đoán từ chuỗi "F#m7b5"
 * là việc thừa và sai được. Panel vì thế hỏi ba ô: Bậc gốc · Loại · Bậc trầm.
 *
 * Bảng ký hiệu dưới đây KHÔNG do ta nghĩ ra: nó là thứ Verovio THẬT SỰ VẼ RA khi
 * `<kind>` không kèm thuộc tính `text` (đo trên cả 33 giá trị của từ vựng). Nhờ
 * thế panel và bản nhạc luôn nói cùng một chuyện — cùng luật với dấu hoá ở 3B.
 */
export interface HarmonyRoot {
  step: Step;
  /** -2…2 nửa cung. `<root-alter>`/`<bass-alter>`. */
  alter: number;
}

export interface HarmonyValue {
  root: HarmonyRoot;
  kind: string;
  /** Không có bậc trầm thì `null` — lệnh sẽ bỏ hẳn `<bass>`. */
  bass: HarmonyRoot | null;
}

/**
 * Các `<kind>` mà Verovio vẽ ra ký hiệu riêng. Đo được: `pedal`, `Neapolitan`,
 * `Italian`, `French`, `German`, `Tristan`, `other`, `none` đều chỉ vẽ trơ bậc
 * gốc ("C"), nên KHÔNG mời thầy chọn — chọn vào là bản nhạc hiện sai.
 */
export const HARMONY_KINDS: readonly { id: string; hau: string; ten: string }[] = [
  { id: "major", hau: "", ten: "Trưởng" },
  { id: "minor", hau: "m", ten: "Thứ" },
  { id: "dominant", hau: "7", ten: "Bảy át" },
  { id: "major-seventh", hau: "Maj7", ten: "Trưởng bảy" },
  { id: "minor-seventh", hau: "m7", ten: "Thứ bảy" },
  { id: "major-sixth", hau: "6", ten: "Trưởng sáu" },
  { id: "minor-sixth", hau: "m6", ten: "Thứ sáu" },
  { id: "suspended-fourth", hau: "sus4", ten: "Treo bốn" },
  { id: "suspended-second", hau: "sus2", ten: "Treo hai" },
  { id: "power", hau: "5", ten: "Quãng năm" },
  { id: "augmented", hau: "aug", ten: "Tăng" },
  { id: "diminished", hau: "dim", ten: "Giảm" },
  { id: "diminished-seventh", hau: "dim7", ten: "Giảm bảy" },
  { id: "half-diminished", hau: "m7♭5", ten: "Nửa giảm" },
  { id: "augmented-seventh", hau: "aug7", ten: "Tăng bảy" },
  { id: "major-minor", hau: "mMaj7", ten: "Thứ trưởng bảy" },
  { id: "dominant-ninth", hau: "9", ten: "Chín át" },
  { id: "major-ninth", hau: "Maj9", ten: "Trưởng chín" },
  { id: "minor-ninth", hau: "m9", ten: "Thứ chín" },
  { id: "dominant-11th", hau: "11", ten: "Mười một át" },
  { id: "major-11th", hau: "Maj11", ten: "Trưởng mười một" },
  { id: "minor-11th", hau: "m11", ten: "Thứ mười một" },
  { id: "dominant-13th", hau: "13", ten: "Mười ba át" },
  { id: "major-13th", hau: "Maj13", ten: "Trưởng mười ba" },
  { id: "minor-13th", hau: "m13", ten: "Thứ mười ba" },
];

const HAU = new Map(HARMONY_KINDS.map((k) => [k.id, k.hau]));
export const isHarmonyKind = (kind: string) => HAU.has(kind);

/** Từ vựng `kind` đầy đủ của MusicXML — để BIẾT nguồn ghi gì, không để mời chọn. */
export const HARMONY_KINDS_KHAC: readonly string[] = [
  "pedal",
  "Neapolitan",
  "Italian",
  "French",
  "German",
  "Tristan",
  "other",
  "none",
];
export const laKindMusicXml = (kind: string) =>
  isHarmonyKind(kind) || HARMONY_KINDS_KHAC.includes(kind);

export const ALTER_KY_HIEU: Record<number, string> = {
  [-2]: "𝄫",
  [-1]: "♭",
  0: "",
  1: "♯",
  2: "𝄪",
};

const bacText = (r: HarmonyRoot) => `${r.step}${ALTER_KY_HIEU[r.alter] ?? `(${r.alter})`}`;

/**
 * Ký hiệu hiện ra. `hau` là thứ Verovio vẽ khi `<kind>` không có `text`; nguồn
 * nào ĐÃ ghi `text` thì bản nhạc vẽ theo `text`, nên truyền vào để panel nói
 * đúng thứ thầy đang nhìn thấy chứ không phải thứ đáng lẽ phải thế.
 */
export function harmonySymbol(value: HarmonyValue, kindText?: string | null): string {
  const hau = kindText ?? HAU.get(value.kind) ?? "";
  return `${bacText(value.root)}${hau}${value.bass ? `/${bacText(value.bass)}` : ""}`;
}

export const sameHarmonyRoot = (a: HarmonyRoot | null, b: HarmonyRoot | null) =>
  a === null || b === null ? a === b : a.step === b.step && a.alter === b.alter;

export const sameHarmony = (a: HarmonyValue, b: HarmonyValue) =>
  sameHarmonyRoot(a.root, b.root) && a.kind === b.kind && sameHarmonyRoot(a.bass, b.bass);
