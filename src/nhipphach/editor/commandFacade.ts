import type { MusicXmlEditCommand } from "../edit/commands.ts";
import type { NoteFields } from "../edit/noteFields.ts";
import { transposeSemitone, pitchName, samePitch, withAlter } from "../edit/pitchModel.ts";
import type { EditorAction } from "./actions.ts";
import { capDoNhap } from "./noteEntry.ts";
import type { EntryDuration, NoteEntryState } from "./noteEntry.ts";

/**
 * Ý ĐỊNH → LỆNH — Giai đoạn 4A.
 *
 * Lớp mỏng nhất của cả tầng tương tác: mỗi hành động đổi lấy đúng MỘT lệnh đã
 * có sẵn từ 3A/3B/3C. KHÔNG có model bản nhạc thứ hai, KHÔNG có lệnh mới nào
 * được phát minh ở đây.
 *
 *   TRANSPOSE     → ChangePitch      (kèm dấu hoá "auto", như panel vẫn làm)
 *   SET_ALTER     → ChangePitch
 *   SET_DURATION  → ChangeDurationAndRebalance (4B.2)
 *   TOGGLE_DOT    → ChangeDurationAndRebalance (4B.2)
 *   RESPELL       → RespellNote
 *   MAKE_REST     → MakeRest            (4B.1)
 *   ENTER_PITCH   → ReplaceRestWithNote  khi trường độ đang cầm bằng đúng dấu
 *                                        lặng đích (4B.1, không đụng cấu trúc)
 *                 → InsertNoteIntoRest   mọi trường hợp còn lại (4B.3)
 *
 * 4B.3 thêm một loại kết quả thứ tư: `toolState`. Khi con trỏ đứng trên một dấu
 * lặng, phím trường độ KHÔNG sinh lệnh nào — nó chỉ đổi cây bút đang cầm. Đó là
 * ranh giới giữa SỬA NỐT CÓ SẴN và NHẬP NỐT MỚI, và nó phải hiện rõ trong mã.
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
  /** Đổi thứ đang cầm trên tay, KHÔNG đụng bản nhạc — 4B.3. */
  | { kind: "toolState"; truongDo: EntryDuration }
  /** Không có gì để làm (giá trị mới trùng giá trị cũ). Không phải lỗi. */
  | { kind: "noop" }
  | { kind: "refused"; message: string };

const tuChoi = (message: string): FacadeResult => ({ kind: "refused", message });

export function toCommand(
  action: EditorAction,
  path: string,
  fields: NoteFields | null,
  nhap?: NoteEntryState
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
      // Con trỏ ở DẤU LẶNG → chỉ đổi cây bút. Dấu lặng không bị đụng tới: thầy
      // đang chuẩn bị nhập, chưa sửa gì cả.
      if (fields.kind === "rest")
        return { kind: "toolState", truongDo: { noteType: action.noteType, dots: 0 } };
      if (fields.duongTruongDo) return tuChoi(fields.duongTruongDo);
      if (fields.noteType === action.noteType && fields.dots === 0) return { kind: "noop" };
      // Đổi hình nốt thì bỏ chấm dôi cũ — giữ lại là ra một trường độ thầy
      // không hề chọn (móc đơn chấm ≠ móc đơn).
      //
      // 4B.2: bàn phím và thanh công cụ LUÔN đi đường cân lại ô nhịp. Không có
      // chuyện cùng một phím lúc thì cân lúc thì không — cân được thì cân, không
      // cân được thì từ chối và nói rõ, chứ không lặng lẽ tụt về lệnh cũ để lại
      // một ô nhịp thiếu phách. Panel thủ công vẫn giữ `ChangeDuration`.
      return {
        kind: "command",
        command: { type: "ChangeDurationAndRebalance", path, noteType: action.noteType, dots: 0 },
      };
    }
    case "TOGGLE_DOT": {
      if (fields.kind === "rest") {
        if (!nhap) return tuChoi("Chưa sẵn sàng nhập nốt.");
        return {
          kind: "toolState",
          truongDo: { noteType: nhap.currentDuration.noteType, dots: nhap.currentDuration.dots ? 0 : 1 },
        };
      }
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
          type: "ChangeDurationAndRebalance",
          path,
          noteType: fields.noteType,
          dots: fields.dots ? 0 : 1,
        },
      };
    }
    case "MAKE_REST": {
      if (fields.kind === "rest") return { kind: "noop" };
      if (fields.chord !== "none")
        return tuChoi(
          fields.chord === "member"
            ? "Chưa hỗ trợ xoá riêng một nốt trong hợp âm."
            : "Đây là nốt gốc của một hợp âm — chưa hỗ trợ xoá."
        );
      if (fields.ties.length)
        return tuChoi("Nốt này nằm trong một dấu nối — chưa hỗ trợ xoá.");
      if (fields.grace) return tuChoi("Nốt hoa mỹ không có dấu lặng tương ứng.");
      return { kind: "command", command: { type: "MakeRest", path } };
    }
    case "ENTER_PITCH": {
      // 4B.1 KHÔNG ghi đè một nốt đã có chỉ vì người dùng gõ một chữ cái. Gõ
      // nhanh mà nuốt mất nốt thật là thứ không hoàn tác lại được trong đầu
      // người dùng, kể cả khi Ctrl+Z hoàn tác được trong máy.
      if (fields.kind !== "rest")
        return tuChoi("Chỗ này đã có nốt — bấm 0 để chuyển thành lặng trước, rồi nhập.");
      if (fields.laLangCaO)
        return tuChoi(
          "Đây là dấu lặng cả ô nhịp — biến nó thành nốt phải viết lại trường độ của cả ô, chưa hỗ trợ ở bước này."
        );
      // Khuông TAB: chặn ở đây, TRƯỚC khi chọn đường nào. Nếu chỉ chặn trong
      // `InsertNoteIntoRest` thì trường hợp "bằng đúng trường độ" sẽ lách qua
      // `ReplaceRestWithNote` và ghi ra một nốt TAB thiếu dây/phím.
      if (fields.khuongTab)
        return tuChoi(
          "Chưa hỗ trợ nhập nốt trực tiếp trên khuông TAB. Hãy nhập trên khuông nhạc; công cụ nhập dây/phím TAB sẽ được làm riêng."
        );
      if (fields.duongTruongDo) return tuChoi(fields.duongTruongDo);
      if (!nhap) return tuChoi("Chưa sẵn sàng nhập nốt.");
      const pitch = capDoNhap(nhap, action.step);
      const { noteType, dots } = nhap.currentDuration;
      // Bằng đúng trường độ dấu lặng thì đi đường 4B.1: chỉ đổi ruột, không
      // đụng một con nào của ô nhịp. Khác thì mới cần giao dịch cân lại 4B.3.
      return fields.noteType === noteType && fields.dots === dots
        ? { kind: "command", command: { type: "ReplaceRestWithNote", path, pitch, accidental: "auto" } }
        : {
            kind: "command",
            command: { type: "InsertNoteIntoRest", path, pitch, noteType, dots, accidental: "auto" },
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
