import type { EditorAction } from "./actions.ts";

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
}

const D = (noteType: "16th" | "eighth" | "quarter" | "half" | "whole", key: string, ten: string): KeyBinding => ({
  key,
  action: { type: "SET_DURATION", noteType },
  mo: `Hình nốt: ${ten}`,
});

export const KEYMAP: readonly KeyBinding[] = [
  // ── Điều hướng (Smoosic trackerKeys) ─────────────────────────────────────
  { key: "ArrowRight", action: { type: "MOVE", where: "next" }, mo: "Nốt sau" },
  { key: "ArrowLeft", action: { type: "MOVE", where: "prev" }, mo: "Nốt trước" },
  { key: "ArrowRight", ctrl: true, action: { type: "MOVE", where: "nextMeasure" }, mo: "Ô nhịp sau" },
  { key: "ArrowLeft", ctrl: true, action: { type: "MOVE", where: "prevMeasure" }, mo: "Ô nhịp trước" },
  { key: "Home", action: { type: "MOVE", where: "first" }, mo: "Nốt đầu bài" },
  { key: "End", action: { type: "MOVE", where: "last" }, mo: "Nốt cuối bài" },

  // ── Cao độ (MuseScore) ───────────────────────────────────────────────────
  { key: "ArrowUp", action: { type: "TRANSPOSE", semitones: 1 }, mo: "Lên nửa cung" },
  { key: "ArrowDown", action: { type: "TRANSPOSE", semitones: -1 }, mo: "Xuống nửa cung" },
  { key: "ArrowUp", ctrl: true, action: { type: "TRANSPOSE", semitones: 12 }, mo: "Lên một quãng tám" },
  { key: "ArrowDown", ctrl: true, action: { type: "TRANSPOSE", semitones: -12 }, mo: "Xuống một quãng tám" },

  // ── Trường độ (MuseScore 3–7) ────────────────────────────────────────────
  D("16th", "3", "móc kép"),
  D("eighth", "4", "móc đơn"),
  D("quarter", "5", "nốt đen"),
  D("half", "6", "nốt trắng"),
  D("whole", "7", "nốt tròn"),
  { key: ".", action: { type: "TOGGLE_DOT" }, mo: "Thêm / bỏ chấm dôi" },

  // ── Cách ghi (Smoosic editorKeys: Shift+E toggleEnharmonic) ──────────────
  { key: "E", shift: true, action: { type: "RESPELL" }, mo: "Đổi cách ghi (G♯ ↔ A♭)" },

  // ── Ngăn xếp nháp (cả ba editor lớn đều giống nhau) ──────────────────────
  { key: "z", ctrl: true, action: { type: "UNDO" }, mo: "Hoàn tác" },
  { key: "z", ctrl: true, shift: true, action: { type: "REDO" }, mo: "Làm lại" },
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

/** Danh sách để hiện bảng trợ giúp; gộp các phím trùng hành động. */
export const BANG_TRO_GIUP = KEYMAP.map((b) => ({ phim: nhanPhim(b), mo: b.mo }));
