import type { MusicXmlEditCommand } from "../edit/commands.ts";
import type { NoteFields } from "../edit/noteFields.ts";
import { transposeSemitone, pitchName, samePitch, withAlter } from "../edit/pitchModel.ts";
import type { EditorAction } from "./actions.ts";

/**
 * Ý ĐỊNH → LỆNH — Giai đoạn 4A.
 *
 * Lớp mỏng nhất của cả tầng tương tác: mỗi hành động đổi lấy đúng MỘT lệnh đã
 * có sẵn từ 3A/3B/3C. KHÔNG có model bản nhạc thứ hai, KHÔNG có lệnh mới nào
 * được phát minh ở đây.
 *
 *   TRANSPOSE     → ChangePitch      (kèm dấu hoá "auto", như panel vẫn làm)
 *   SET_ALTER     → ChangePitch
 *   SET_DURATION  → ChangeDuration
 *   TOGGLE_DOT    → ChangeDuration
 *   RESPELL       → RespellNote
 *
 * Facade đọc trạng thái hiện tại qua `NoteFields` — thứ trang đã tính sẵn cho
 * panel — nên nó KHÔNG cần đụng XML, không parse, không serialize. Đó cũng là
 * cách giữ cho tầng bàn phím không bao giờ biết tới xmldom.
 *
 * Từ chối thì nói rõ lý do bằng tiếng Việt; im lặng là thứ tệ nhất khi người
 * dùng đang gõ nhanh.
 */
export type FacadeResult =
  | { kind: "command"; command: MusicXmlEditCommand }
  /** Không có gì để làm (giá trị mới trùng giá trị cũ). Không phải lỗi. */
  | { kind: "noop" }
  | { kind: "refused"; message: string };

const tuChoi = (message: string): FacadeResult => ({ kind: "refused", message });

export function toCommand(
  action: EditorAction,
  path: string,
  fields: NoteFields | null
): FacadeResult {
  if (action.type === "MOVE" || action.type === "UNDO" || action.type === "REDO")
    return { kind: "noop" };
  if (!fields) return tuChoi("Chưa chọn nốt nào trên bản nhạc.");

  switch (action.type) {
    case "TRANSPOSE": {
      if (!fields.pitch)
        return tuChoi(
          fields.kind === "rest" ? "Dấu lặng không có cao độ." : "Nốt này không có cao độ để sửa."
        );
      const moi = transposeSemitone(fields.pitch, action.semitones);
      if (!moi) return tuChoi("Đã hết tầm cao độ ghi được.");
      return {
        kind: "command",
        command: { type: "ChangePitch", path, pitch: moi, accidental: "auto" },
      };
    }
    case "SET_ALTER": {
      if (!fields.pitch) return tuChoi("Chỗ này không có cao độ để đổi dấu hoá.");
      const moi = withAlter(fields.pitch, action.alter);
      if (samePitch(moi, fields.pitch)) return { kind: "noop" };
      return {
        kind: "command",
        command: { type: "ChangePitch", path, pitch: moi, accidental: "auto" },
      };
    }
    case "SET_DURATION": {
      if (fields.duongTruongDo) return tuChoi(fields.duongTruongDo);
      if (fields.noteType === action.noteType && fields.dots === 0) return { kind: "noop" };
      // Đổi hình nốt thì bỏ chấm dôi cũ — giữ lại là ra một trường độ thầy
      // không hề chọn (móc đơn chấm ≠ móc đơn).
      return {
        kind: "command",
        command: { type: "ChangeDuration", path, noteType: action.noteType, dots: 0 },
      };
    }
    case "TOGGLE_DOT": {
      if (fields.duongTruongDo) return tuChoi(fields.duongTruongDo);
      if (!fields.noteType)
        return tuChoi(
          fields.rawNoteType
            ? `Nguồn ghi hình nốt “${fields.rawNoteType}” — chưa sửa được ở bước này.`
            : "Nốt này không ghi hình nốt."
        );
      return {
        kind: "command",
        command: {
          type: "ChangeDuration",
          path,
          noteType: fields.noteType,
          dots: fields.dots ? 0 : 1,
        },
      };
    }
    case "RESPELL": {
      if (!fields.pitch) return tuChoi("Chỗ này không có cao độ để đổi cách ghi.");
      const khac = fields.respell[0];
      if (!khac) return tuChoi(`${pitchName(fields.pitch)} không có cách ghi nào khác.`);
      return { kind: "command", command: { type: "RespellNote", path, pitch: khac, accidental: "auto" } };
    }
    default: {
      const never: never = action;
      return tuChoi(`Hành động lạ: ${JSON.stringify(never)}`);
    }
  }
}
