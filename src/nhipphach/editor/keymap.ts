import type { EditorAction } from "./actions.ts";
import type { Step } from "../edit/commands.ts";

/**
 * Bảng phím tắt — Giai đoạn 4A.
 *
 * ═══ GHI CÔNG ═══
 * Cấu trúc bảng (một dòng = phím + ba cờ phụ + tên hành động) và phần lớn các
 * phím điều hướng lấy từ **Smoosic** — MIT License.
 * Copyright (c) 2021 Aaron David Newman. Hai file nguồn:
 *     src/ui/keyBindings/default/trackerKeys.ts
 *     src/ui/keyBindings/default/editorKeys.ts
 * Xem `THIRD_PARTY_NOTICES.md`. KHÔNG kéo thư viện Smoosic vào bundle — chỉ
 * mượn quy ước.
 *
 * Chỗ CỐ Ý LỆCH Smoosic, theo quy ước **MuseScore 4** vì thầy quen MuseScore:
 *   ↑ ↓        = ±nửa cung   (Smoosic dùng Shift+↑↓ cho việc này)
 *   3–7        = hình nốt    (Smoosic dùng `,` `.` chia đôi/gấp đôi)
 *   .          = chấm dôi    (Smoosic dùng Shift+>)
 * Vì `.` đã nhận nghĩa "chấm dôi", 4A **bỏ hẳn** phím chia đôi/gấp đôi trường
 * độ — một phím không được mang hai nghĩa.
 *
 * Bảng này là DỮ LIỆU THUẦN: không import gì ngoài kiểu `EditorAction`, không
 * biết MusicXML, không biết Verovio, không biết React.
 */
export interface KeyBinding {
  /**
   * `KeyboardEvent.key`. Với phím MỘT KÝ TỰ thì so sánh KHÔNG phân biệt hoa
   * thường — cờ `shift` mới là thứ quyết. Lý do đo được: bàn phím thật gửi
   * `key:"E"` khi giữ Shift, nhưng một số đường vào (bàn phím ảo, điều khiển từ
   * xa, bộ tự động hoá) gửi `key:"e"` kèm `shiftKey:true`. Bắt cứng chữ hoa là
   * phím tắt lúc chạy lúc không.
   */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: EditorAction;
  /** Hiện trong bảng trợ giúp. */
  mo: string;
  /** Nhóm trong bảng trợ giúp (`?`). */
  nhom: NhomPhim;
}

/** Thứ tự nhóm trong bảng trợ giúp. */
export const NHOM_PHIM = ["Di chuyển", "Chọn vùng", "Nhập nốt", "Trường độ", "Chỉnh sửa"] as const;
export type NhomPhim = (typeof NHOM_PHIM)[number];

const D = (noteType: "16th" | "eighth" | "quarter" | "half" | "whole", key: string, ten: string): KeyBinding => ({
  key,
  action: { type: "SET_DURATION", noteType },
  mo: `Hình nốt: ${ten}`,
  nhom: "Trường độ",
});

export const KEYMAP: readonly KeyBinding[] = [
  // ── Điều hướng (Smoosic trackerKeys) ─────────────────────────────────────
  { key: "ArrowRight", action: { type: "MOVE", where: "next" }, mo: "Nốt sau" , nhom: "Di chuyển" },
  { key: "ArrowLeft", action: { type: "MOVE", where: "prev" }, mo: "Nốt trước" , nhom: "Di chuyển" },
  { key: "ArrowRight", ctrl: true, action: { type: "MOVE", where: "nextMeasure" }, mo: "Ô nhịp sau" , nhom: "Di chuyển" },
  { key: "ArrowLeft", ctrl: true, action: { type: "MOVE", where: "prevMeasure" }, mo: "Ô nhịp trước" , nhom: "Di chuyển" },
  { key: "Home", action: { type: "MOVE", where: "first" }, mo: "Nốt đầu bài" , nhom: "Di chuyển" },
  { key: "End", action: { type: "MOVE", where: "last" }, mo: "Nốt cuối bài" , nhom: "Di chuyển" },

  // ── Cao độ (MuseScore) ───────────────────────────────────────────────────
  { key: "ArrowUp", action: { type: "TRANSPOSE", semitones: 1 }, mo: "Lên nửa cung" , nhom: "Chỉnh sửa" },
  { key: "ArrowDown", action: { type: "TRANSPOSE", semitones: -1 }, mo: "Xuống nửa cung" , nhom: "Chỉnh sửa" },
  { key: "ArrowUp", ctrl: true, action: { type: "TRANSPOSE", semitones: 12 }, mo: "Lên một quãng tám" , nhom: "Chỉnh sửa" },
  { key: "ArrowDown", ctrl: true, action: { type: "TRANSPOSE", semitones: -12 }, mo: "Xuống một quãng tám" , nhom: "Chỉnh sửa" },

  // ── Trường độ (MuseScore 3–7) ────────────────────────────────────────────
  D("16th", "3", "móc kép"),
  D("eighth", "4", "móc đơn"),
  D("quarter", "5", "nốt đen"),
  D("half", "6", "nốt trắng"),
  D("whole", "7", "nốt tròn"),
  { key: ".", action: { type: "TOGGLE_DOT" }, mo: "Thêm / bỏ chấm dôi" , nhom: "Trường độ" },

  // ── Cách ghi (Smoosic editorKeys: Shift+E toggleEnharmonic) ──────────────
  { key: "E", shift: true, action: { type: "RESPELL" }, mo: "Đổi cách ghi (G♯ ↔ A♭)" , nhom: "Chỉnh sửa" },

  // ── Vùng chọn và bảng ghi tạm (4C) ──────────────────────────────────────
  // Shift+mũi tên là quy ước chung của mọi trình soạn thảo, Smoosic cũng vậy.
  { key: "ArrowRight", shift: true, action: { type: "EXTEND_SELECTION", where: "next" }, mo: "Mở rộng vùng chọn sang phải" , nhom: "Chọn vùng" },
  { key: "ArrowLeft", shift: true, action: { type: "EXTEND_SELECTION", where: "prev" }, mo: "Mở rộng vùng chọn sang trái" , nhom: "Chọn vùng" },
  { key: "c", ctrl: true, action: { type: "COPY" }, mo: "Chép đoạn đang chọn" , nhom: "Chọn vùng" },
  { key: "v", ctrl: true, action: { type: "PASTE" }, mo: "Dán vào chỗ lặng" , nhom: "Chọn vùng" },

  // ── Xoá thành lặng (4B.1) ────────────────────────────────────────────────
  // Delete/Backspace là phản xạ của mọi người; `0` là quy ước MuseScore cho dấu
  // lặng; `R` là quy ước Smoosic. Bốn lối vào cùng MỘT nghĩa, và nghĩa ấy là
  // "giữ chỗ, giữ nhịp" chứ không phải "bỏ đi".
  { key: "Delete", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" , nhom: "Chỉnh sửa" },
  { key: "Backspace", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" , nhom: "Chỉnh sửa" },
  { key: "0", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" , nhom: "Chỉnh sửa" },
  { key: "r", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" , nhom: "Chỉnh sửa" },

  // ── Luyến (MuseScore 4: S = slur; Guitar Pro không có một phím chung cho
  //    luyến nên theo MuseScore). Dấu nối (tie, MuseScore "+") CHƯA có lệnh. ──
  { key: "s", action: { type: "TOGGLE_SLUR" }, mo: "Luyến / bỏ luyến vùng đang chọn", nhom: "Chỉnh sửa" },

  // ── Nhập nốt bằng chữ cái (MuseScore, Smoosic đều vậy) ───────────────────
  ...(["C", "D", "E", "F", "G", "A", "B"] as Step[]).map(
    (step): KeyBinding => ({ key: step.toLowerCase(), action: { type: "ENTER_PITCH", step }, mo: `Nhập nốt ${step}`, nhom: "Nhập nốt" })
  ),

  // ── Ngăn xếp nháp (cả ba editor lớn đều giống nhau) ──────────────────────
  { key: "z", ctrl: true, action: { type: "UNDO" }, mo: "Hoàn tác" , nhom: "Chỉnh sửa" },
  { key: "z", ctrl: true, shift: true, action: { type: "REDO" }, mo: "Làm lại" , nhom: "Chỉnh sửa" },
];

/** Dạng chuẩn hoá của một cú bấm — không phụ thuộc DOM, để test được. */
export interface Shortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

/**
 * Tra bảng. `Meta` (⌘ trên máy Mac) được coi như `Ctrl`: thầy dùng Mac, và mọi
 * editor trên Mac đều nhận ⌘Z. Alt chưa mang nghĩa nào ở 4A nên phím kèm Alt
 * bị bỏ qua — để dành cho các phase sau, không nuốt oan.
 */
const chuan = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

export function traPhim(s: Shortcut): EditorAction | null {
  if (s.alt) return null;
  const key = chuan(s.key);
  const hit = KEYMAP.find(
    (b) => chuan(b.key) === key && !!b.ctrl === s.ctrl && !!b.shift === s.shift && !!b.alt === s.alt
  );
  return hit ? hit.action : null;
}

/** Cách viết một phím cho người đọc: `Ctrl+ArrowRight`, `Shift+E`, `5`. */
export const nhanPhim = (b: KeyBinding) =>
  `${b.ctrl ? "Ctrl+" : ""}${b.shift ? "Shift+" : ""}${b.key.length === 1 ? b.key.toUpperCase() : b.key}`;

/** Hai hành động có cùng ý nghĩa không? So từng trường, không so chuỗi JSON. */
function cungHanhDong(a: EditorAction, b: EditorAction): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "MOVE":
      return a.where === (b as typeof a).where;
    case "TRANSPOSE":
      return a.semitones === (b as typeof a).semitones;
    case "SET_DURATION":
      return a.noteType === (b as typeof a).noteType;
    case "SET_ALTER":
      return a.alter === (b as typeof a).alter;
    case "ENTER_PITCH":
      return a.step === (b as typeof a).step;
    case "EXTEND_SELECTION":
      return a.where === (b as typeof a).where;
    default:
      return true;
  }
}

/**
 * Phím tắt của một hành động — MỘT NGUỒN SỰ THẬT.
 *
 * Thanh công cụ hỏi ở đây thay vì tự gõ lại chuỗi phím vào JSX; đổi bảng phím
 * là nhãn trên nút đổi theo, không có chuyện hai chỗ nói hai đằng. Hành động
 * chưa có phím (ví dụ ba nút ♭ ♮ ♯) trả `null` — nút KHÔNG hiện nhãn giả.
 */
export function phimCua(action: EditorAction): string | null {
  const hit = KEYMAP.find((b) => cungHanhDong(b.action, action));
  return hit ? nhanPhim(hit) : null;
}

/**
 * Danh sách để hiện bảng trợ giúp; GỘP các phím cùng một lời mô tả.
 *
 * Bốn phím cùng chuyển nốt thành lặng, và bảy chữ cái cùng là "nhập nốt" — liệt
 * kê rời ra thì bảng dài gấp đôi mà không nói thêm được gì.
 */
export const BANG_TRO_GIUP = (() => {
  const gop = new Map<string, { phims: string[]; nhom: NhomPhim }>();
  for (const b of KEYMAP) {
    const cu = gop.get(b.mo);
    gop.set(b.mo, { phims: [...(cu?.phims ?? []), nhanPhim(b)], nhom: b.nhom });
  }
  return [...gop].map(([mo, g]) => ({ phim: g.phims.join(" / "), mo, nhom: g.nhom }));
})();
