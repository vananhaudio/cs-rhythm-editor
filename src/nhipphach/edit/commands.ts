/**
 * Lệnh biên tập MusicXML — Giai đoạn Nội dung 3.
 *
 * Mỗi thao tác sửa là MỘT lệnh độc lập, chỉ nói "sửa gì, ở nút nào". Nút được
 * gọi bằng đường dẫn cấu trúc (`SourceNote.path` từ Nội dung 2), KHÔNG BAO GIỜ
 * bằng cao độ cũ hay toạ độ. Lệnh không biết XML là chuỗi; việc vá nằm ở
 * `applyCommand.ts`. Thêm công cụ mới (trường độ, hợp âm, TAB, dấu nối…) là
 * thêm một nhánh vào union này và một handler — không đụng draft/undo/save.
 */
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
}

export interface ChangeLyricText {
  type: "ChangeLyricText";
  path: string;
  /** Thuộc tính `number` của `<lyric>`; không có thì là "1". */
  lyricNumber: string;
  /** Giữ nguyên văn, kể cả Unicode tiếng Việt và khoảng trắng. */
  text: string;
}

export type MusicXmlEditCommand = ChangePitch | ChangeLyricText;

/** Nhóm công cụ (mục 2 của spec) — để panel biết lệnh thuộc nhóm nào. */
export const COMMAND_GROUP: Record<MusicXmlEditCommand["type"], "note" | "lyric"> = {
  ChangePitch: "note",
  ChangeLyricText: "lyric",
};

export const CHANGE_NOTE_MAX = 300;

/** Ghi chú phiên bản tự sinh: "Sửa cao độ 3 nốt · sửa lời 1 chỗ". Thầy sửa lại được trước khi lưu. */
export function describeCommands(commands: readonly MusicXmlEditCommand[]): string {
  const dem = new Map<MusicXmlEditCommand["type"], Set<string>>();
  for (const c of commands) {
    const s = dem.get(c.type) ?? new Set<string>();
    s.add(c.type === "ChangeLyricText" ? `${c.path}#${c.lyricNumber}` : c.path);
    dem.set(c.type, s);
  }
  const phan: string[] = [];
  const not = dem.get("ChangePitch")?.size ?? 0;
  const loi = dem.get("ChangeLyricText")?.size ?? 0;
  if (not) phan.push(`Sửa cao độ ${not} nốt`);
  if (loi) phan.push(`${phan.length ? "s" : "S"}ửa lời ${loi} chỗ`);
  return phan.join(" · ").slice(0, CHANGE_NOTE_MAX);
}
