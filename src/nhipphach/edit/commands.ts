/**
 * Lệnh biên tập MusicXML — Giai đoạn Nội dung 3.
 *
 * Mỗi thao tác sửa là MỘT lệnh độc lập, chỉ nói "sửa gì, ở nút nào". Nút được
 * gọi bằng đường dẫn cấu trúc (`SourceNote.path` từ Nội dung 2), KHÔNG BAO GIỜ
 * bằng cao độ cũ hay toạ độ. Lệnh không biết XML là chuỗi; việc vá nằm ở
 * `applyCommand.ts`. Thêm công cụ mới (trường độ, hợp âm, TAB, dấu nối…) là
 * thêm một nhánh vào union này và một handler — không đụng draft/undo/save.
 */
import type { AccidentalChoice } from "./accidentals.ts";
import type { NoteType } from "./durationModel.ts";

export type Step = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export const STEPS: readonly Step[] = ["C", "D", "E", "F", "G", "A", "B"];

export interface Pitch {
  step: Step;
  /** Số nửa cung so với nốt tự nhiên: -2…2. Là cao độ VANG LÊN (`<alter>`),
   *  không phải dấu hoá hiển thị (`<accidental>` — công cụ Dấu hoá lo riêng). */
  alter: number;
  octave: number;
}

export interface ChangePitch {
  type: "ChangePitch";
  /** `/score-partwise/part[i]/measure[j]/*[k]` — đúng như parser đếm. */
  path: string;
  pitch: Pitch;
  /**
   * Dấu hoá HIỂN THỊ đi kèm. Mặc định "auto" = theo luật ký âm (bộ khoá + các
   * dấu đã viết trong ô nhịp). Đổi cao độ mà bỏ mặc `<accidental>` cũ là tạo ra
   * bản nhạc nhìn một đằng vang một nẻo, nên lệnh này luôn quyết cả hai.
   */
  accidental?: AccidentalChoice;
}

/**
 * Đổi CÁCH GHI, giữ nguyên tiếng: G♯4 → A♭4. Không phải dịch giọng, không phải
 * sửa cao độ — cố ý tách thành lệnh riêng để ghi chú phiên bản nói đúng việc.
 */
export interface RespellNote {
  type: "RespellNote";
  path: string;
  pitch: Pitch;
  accidental?: AccidentalChoice;
}

/**
 * Đổi trường độ. Ba trường `<duration>`, `<type>`, `<dot>` luôn được ghi lại
 * cùng nhau theo `divisions` của chính bản nhạc — không sửa mỗi hình nốt rồi để
 * số đo cũ lại.
 */
export interface ChangeDuration {
  type: "ChangeDuration";
  path: string;
  noteType: NoteType;
  dots: number;
}

export interface ChangeLyricText {
  type: "ChangeLyricText";
  path: string;
  /** Thuộc tính `number` của `<lyric>`; không có thì là "1". */
  lyricNumber: string;
  /** Giữ nguyên văn, kể cả Unicode tiếng Việt và khoảng trắng. */
  text: string;
}

export type MusicXmlEditCommand =
  | ChangePitch
  | RespellNote
  | ChangeDuration
  | ChangeLyricText;

/** Nhóm công cụ (mục 2 của spec) — để panel biết lệnh thuộc nhóm nào. */
export const COMMAND_GROUP: Record<MusicXmlEditCommand["type"], "note" | "lyric"> = {
  ChangePitch: "note",
  RespellNote: "note",
  ChangeDuration: "note",
  ChangeLyricText: "lyric",
};

export const CHANGE_NOTE_MAX = 300;

/** Ghi chú phiên bản tự sinh: "Sửa cao độ 2 nốt · sửa trường độ 1 nốt". Thầy sửa lại được trước khi lưu. */
const MO_TA: Record<MusicXmlEditCommand["type"], (n: number) => string> = {
  ChangePitch: (n) => `sửa cao độ ${n} nốt`,
  RespellNote: (n) => `đổi cách ghi ${n} nốt`,
  ChangeDuration: (n) => `sửa trường độ ${n} nốt`,
  ChangeLyricText: (n) => `sửa lời ${n} chỗ`,
};
const KHOA = (c: MusicXmlEditCommand) =>
  c.type === "ChangeLyricText" ? `${c.path}#${c.lyricNumber}` : c.path;

export function describeCommands(commands: readonly MusicXmlEditCommand[]): string {
  const dem = new Map<MusicXmlEditCommand["type"], Set<string>>();
  for (const c of commands) {
    const s = dem.get(c.type) ?? new Set<string>();
    s.add(KHOA(c));
    dem.set(c.type, s);
  }
  const phan = (Object.keys(MO_TA) as MusicXmlEditCommand["type"][])
    .filter((t) => dem.get(t)?.size)
    .map((t) => MO_TA[t](dem.get(t)!.size));
  if (!phan.length) return "";
  return (phan[0][0].toUpperCase() + phan[0].slice(1) + (phan.length > 1 ? " · " + phan.slice(1).join(" · ") : "")).slice(
    0,
    CHANGE_NOTE_MAX
  );
}
