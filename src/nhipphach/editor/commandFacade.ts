import type { MusicXmlEditCommand } from "../edit/commands.ts";
import type { NoteFields } from "../edit/noteFields.ts";
import { transposeSemitone, pitchName, samePitch, soundingPitch, withAlter } from "../edit/pitchModel.ts";
import { doiDayGiuCaoDo, viTri } from "../edit/tabModel.ts";
import type { EditorAction } from "./actions.ts";
import { capDoNhap } from "./noteEntry.ts";
import type { EntryDuration, NoteEntryState } from "./noteEntry.ts";
import type { Clipboard } from "../edit/clipboard.ts";

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
 *   SET_TAB_FRET    → ChangeTabPosition  giữ dây, đổi phím (cao độ đổi theo) — 4D
 *   MOVE_TAB_STRING → ChangeTabPosition  giữ cao độ, đổi dây (phím tính lại) — 4D
 *   PASTE         → PasteSequence       (4C, một lệnh = một lần hoàn tác)
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
  | { kind: "refused"; message: string; code?: string };

const tuChoi = (message: string, code?: string): FacadeResult => ({ kind: "refused", message, code });

/** Nốt dưới con trỏ có phải một nốt TAB sửa được không. Trả câu từ chối, hoặc vị trí hiện tại. */
function kiemTab(fields: NoteFields): string | { string: number; fret: number } {
  if (!fields.khuongTab) return "Nốt này không nằm trên khuông TAB.";
  if (fields.kind !== "note" || !fields.pitch)
    return "Chưa hỗ trợ nhập nốt trực tiếp trên khuông TAB. Hãy nhập trên khuông nhạc; công cụ nhập dây/phím TAB sẽ được làm riêng.";
  if (!fields.tab) return "Nốt TAB này không ghi dây/phím trong nguồn — chưa sửa được.";
  if (!fields.tabTuning?.size)
    return "Bài này không ghi cách lên dây cho khuông TAB — chưa tính được phím và cao độ.";
  if (fields.chord !== "none")
    return "Nốt này thuộc một hợp âm trên TAB — chưa hỗ trợ đổi dây/phím.";
  return fields.tab;
}

export function toCommand(
  action: EditorAction,
  path: string,
  fields: NoteFields | null,
  nhap?: NoteEntryState,
  /** Bảng ghi tạm — chỉ `PASTE` cần. 4C. */
  ghiTam?: Clipboard | null
): FacadeResult {
  // Ba hành động này chỉ đụng con trỏ hoặc ngăn xếp, không phải bản nhạc; và
  // hai hành động 4C dưới đây chỉ đụng vùng chọn / bảng ghi tạm. Trang tự lo.
  if (
    action.type === "MOVE" ||
    action.type === "UNDO" ||
    action.type === "REDO" ||
    action.type === "EXTEND_SELECTION" ||
    action.type === "COPY" ||
    // Chữ số TAB chưa phải lệnh: trang gom chúng thành SET_TAB_FRET trước.
    action.type === "TAB_DIGIT"
  )
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
    case "PASTE": {
      if (!ghiTam?.items.length) return tuChoi("Chưa chép đoạn nào.");
      if (fields.kind !== "rest")
        return tuChoi("Chỗ dán phải là một dấu lặng — xoá thành lặng (phím 0) trước đã.");
      if (fields.khuongTab) return tuChoi("Chưa hỗ trợ dán vào khuông TAB.");
      if (fields.laLangCaO)
        return tuChoi("Đây là dấu lặng cả ô nhịp — chưa hỗ trợ dán vào đây.");
      return { kind: "command", command: { type: "PasteSequence", path, items: ghiTam.items } };
    }
    // ── 4D: khuông TAB — hai ý định, một lệnh tuyệt đối ────────────────────
    case "SET_TAB_FRET": {
      const tab = kiemTab(fields);
      if (typeof tab === "string") return tuChoi(tab);
      // Giữ DÂY, đổi PHÍM → cao độ đổi theo cách lên dây.
      const vt = viTri(fields.tabTuning, tab.string, action.fret);
      if (!vt.ok) return tuChoi(vt.message, vt.code);
      if (vt.fret === tab.fret) return { kind: "noop" };
      return {
        kind: "command",
        command: { type: "ChangeTabPosition", path, string: vt.string, fret: vt.fret },
      };
    }
    case "MOVE_TAB_STRING": {
      const tab = kiemTab(fields);
      if (typeof tab === "string") return tuChoi(tab);
      // Giữ CAO ĐỘ, đổi DÂY → phím tính lại cho đúng tiếng cũ.
      const dayMoi = tab.string + action.delta;
      if (!fields.tabTuning?.has(dayMoi))
        return tuChoi(
          action.delta < 0 ? "Đã ở dây cao nhất." : "Đã ở dây thấp nhất.",
          "TAB_STRING_INVALID"
        );
      const midi = soundingPitch(fields.pitch!);
      const vt = doiDayGiuCaoDo(fields.tabTuning, midi, dayMoi);
      if (!vt.ok) return tuChoi(vt.message, vt.code);
      return {
        kind: "command",
        command: { type: "ChangeTabPosition", path, string: vt.string, fret: vt.fret },
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
