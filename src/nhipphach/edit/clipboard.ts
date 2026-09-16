import type { Pitch } from "./commands.ts";
import type { NoteType } from "./durationModel.ts";
import { isNoteType } from "./durationModel.ts";
import { readNoteContext } from "./noteContext.ts";
import { EditError, parseStrict } from "./xmlPatch.ts";

/**
 * BẢNG GHI TẠM — Giai đoạn 4C.
 *
 * Chỉ chứa Ý NGHĨA ÂM NHẠC của đoạn đã chép: mỗi sự kiện là một cao độ (hoặc
 * dấu lặng) cộng một trường độ. KHÔNG có đường dẫn, KHÔNG có danh tính logic,
 * KHÔNG có mảnh SVG hay XML nào. Lý do: một đoạn đã chép phải dán được vào chỗ
 * khác, ở ô nhịp khác, sau khi bản nhạc đã đổi — mọi thứ mang theo vị trí cũ sẽ
 * hoặc sai, hoặc buộc ta phải có một mô hình bản nhạc thứ hai để dịch lại.
 *
 * Dán thì đi bằng chính hai lệnh đã chạy production: `InsertNoteIntoRest` của
 * 4B.3 và `ChangeDurationAndRebalance` của 4B.2. Không có bộ máy thời gian thứ
 * hai, và danh tính của sự kiện mới vẫn do `StructuralDelta` cấp.
 */
export type ClipboardItem =
  | { kind: "note"; pitch: Pitch; noteType: NoteType; dots: number }
  | { kind: "rest"; noteType: NoteType; dots: number };

export interface Clipboard {
  items: ClipboardItem[];
  /** Để hiện cho người dùng: "4 nốt", "2 nốt · 1 lặng". */
  mo: string;
}

/**
 * Vì sao một đoạn CHƯA chép được. Trả `null` khi chép được.
 *
 * 4C.1 cố ý hẹp: chỉ một bè, một khuông, không dấu nối, không hợp âm, không
 * chùm nghịch phách, không nốt hoa mỹ, không lặng cả ô, không khuông TAB. Mỗi
 * thứ trong danh sách này đều cần một quyết định riêng khi dán, và đoán bừa thì
 * hỏng bản nhạc của thầy.
 */
export function vuongMac(xml: string, paths: readonly string[]): string | null {
  if (!paths.length) return "Chưa chọn đoạn nào để chép.";
  let doc;
  try {
    doc = parseStrict(xml);
  } catch {
    return "Không đọc được bản nhạc.";
  }
  let be: string | null = null;
  let khuong: string | null = null;
  for (const path of paths) {
    const ngu = readNoteContext(doc, path);
    if (!ngu) return "Không đọc được một sự kiện trong vùng chọn.";
    if (ngu.isTabStaff) return "Chưa hỗ trợ chép đoạn trên khuông TAB.";
    if (ngu.chord !== "none") return "Vùng chọn có hợp âm — chưa hỗ trợ chép ở bước này.";
    if (ngu.ties.length) return "Vùng chọn có dấu nối — chưa hỗ trợ chép ở bước này.";
    if (ngu.grace) return "Vùng chọn có nốt hoa mỹ — chưa hỗ trợ chép ở bước này.";
    if (ngu.tuplet) return "Vùng chọn có chùm nghịch phách — chưa hỗ trợ chép ở bước này.";
    if (!isNoteType(ngu.noteType))
      return "Vùng chọn có hình nốt mà công cụ chưa ghi lại được.";
    if (ngu.kind === "note" && !ngu.pitch) return "Một nốt trong vùng chọn không có cao độ.";
    if (be === null) be = ngu.voice;
    else if (be !== ngu.voice) return "Vùng chọn nằm trên hai bè — chưa hỗ trợ chép ở bước này.";
    if (khuong === null) khuong = ngu.staff;
    else if (khuong !== ngu.staff) return "Vùng chọn nằm trên hai khuông — chưa hỗ trợ chép ở bước này.";
  }
  return null;
}

/**
 * Đọc đoạn đã chọn thành bảng ghi tạm. Thuần đọc: không sửa một byte nào của
 * bản nhạc, không đụng ngăn xếp lệnh. `paths` phải theo thứ tự tài liệu.
 */
export function chepDoan(xml: string, paths: readonly string[]): Clipboard {
  const vm = vuongMac(xml, paths);
  if (vm) throw new EditError("COPY_UNSUPPORTED_SELECTION", vm);
  const doc = parseStrict(xml);
  const items: ClipboardItem[] = [];
  for (const path of paths) {
    const ngu = readNoteContext(doc, path)!;
    const noteType = ngu.noteType as NoteType;
    items.push(
      ngu.kind === "rest"
        ? { kind: "rest", noteType, dots: ngu.dots }
        : { kind: "note", pitch: ngu.pitch!, noteType, dots: ngu.dots }
    );
  }
  const soNot = items.filter((i) => i.kind === "note").length;
  const soLang = items.length - soNot;
  const mo = [soNot ? `${soNot} nốt` : "", soLang ? `${soLang} lặng` : ""]
    .filter(Boolean)
    .join(" · ");
  return { items, mo };
}
