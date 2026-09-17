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
  /**
   * Ngữ cảnh mà phím này mang nghĩa — Giai đoạn 4D.
   *
   * Không ghi = khuông nhạc thường. `"tab"` = con trỏ đang ở một nốt trên khuông
   * TAB. Một phím có thể có nghĩa khác ở mỗi ngữ cảnh, nhưng TRONG một ngữ cảnh
   * thì chỉ một nghĩa — đó là cách giữ cho `3` vừa là "móc kép" ở khuông nhạc,
   * vừa là "phím 3" ở TAB, mà không bao giờ mơ hồ.
   */
  cheDo?: CheDo;
}

/** Ngữ cảnh bàn phím. Suy từ nốt dưới con trỏ, không phải một nút bật/tắt. */
export type CheDo = "notation" | "tab";

const D = (noteType: "16th" | "eighth" | "quarter" | "half" | "whole", key: string, ten: string): KeyBinding => ({
  key,
  action: { type: "SET_DURATION", noteType },
  mo: `Hình nốt: ${ten}`,
});

/**
 * ═══ KHUÔNG TAB (4D) — quy ước đã khảo sát ═══
 *   Guitar Pro — gõ chữ số là nhập PHÍM trên dây đang đứng; gõ hai chữ số liền
 *     nhau là phím hai chữ số (1 rồi 2 ra 12). ↑/↓ chuyển sang dây trên/dưới.
 *   MuseScore 4 (chế độ nhập TAB) — chữ số cũng là phím; hình nốt chuyển sang
 *     Shift+chữ số.
 * Nên ở ngữ cảnh TAB, chữ số là PHÍM và ↑/↓ là ĐỔI DÂY. Hình nốt lấy từ thanh
 * công cụ: phím tắt Shift+chữ số của MuseScore trả về `#`, `$`, `%` … tuỳ bố
 * cục bàn phím (kể cả bàn phím tiếng Việt), bắt theo `key` là lúc được lúc
 * không — thà chưa làm còn hơn làm chập chờn.
 */
const TAB: KeyBinding[] = [
  ...Array.from({ length: 10 }, (_, d): KeyBinding => ({
    key: String(d),
    cheDo: "tab",
    action: { type: "TAB_DIGIT", digit: d },
    mo: "Nhập số phím (gõ liền hai chữ số cho phím 10 trở lên)",
  })),
  { key: "ArrowUp", cheDo: "tab", action: { type: "MOVE_TAB_STRING", delta: -1 }, mo: "Sang dây cao hơn, giữ cao độ" },
  { key: "ArrowDown", cheDo: "tab", action: { type: "MOVE_TAB_STRING", delta: 1 }, mo: "Sang dây thấp hơn, giữ cao độ" },
];

export const KEYMAP: readonly KeyBinding[] = [
  ...TAB,
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

  // ── Vùng chọn và bảng ghi tạm (4C) ──────────────────────────────────────
  // Shift+mũi tên là quy ước chung của mọi trình soạn thảo, Smoosic cũng vậy.
  { key: "ArrowRight", shift: true, action: { type: "EXTEND_SELECTION", where: "next" }, mo: "Mở rộng vùng chọn sang phải" },
  { key: "ArrowLeft", shift: true, action: { type: "EXTEND_SELECTION", where: "prev" }, mo: "Mở rộng vùng chọn sang trái" },
  { key: "c", ctrl: true, action: { type: "COPY" }, mo: "Chép đoạn đang chọn" },
  { key: "v", ctrl: true, action: { type: "PASTE" }, mo: "Dán vào chỗ lặng" },

  // ── Xoá thành lặng (4B.1) ────────────────────────────────────────────────
  // Delete/Backspace là phản xạ của mọi người; `0` là quy ước MuseScore cho dấu
  // lặng; `R` là quy ước Smoosic. Bốn lối vào cùng MỘT nghĩa, và nghĩa ấy là
  // "giữ chỗ, giữ nhịp" chứ không phải "bỏ đi".
  { key: "Delete", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" },
  { key: "Backspace", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" },
  { key: "0", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" },
  { key: "r", action: { type: "MAKE_REST" }, mo: "Xoá nốt → chuyển thành lặng để giữ nhịp" },

  // ── Nhập nốt bằng chữ cái (MuseScore, Smoosic đều vậy) ───────────────────
  ...(["C", "D", "E", "F", "G", "A", "B"] as Step[]).map(
    (step): KeyBinding => ({ key: step.toLowerCase(), action: { type: "ENTER_PITCH", step }, mo: `Nhập nốt ${step}` })
  ),

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

export function traPhim(s: Shortcut, cheDo: CheDo = "notation"): EditorAction | null {
  if (s.alt) return null;
  const key = chuan(s.key);
  const khop = (b: KeyBinding) =>
    chuan(b.key) === key && !!b.ctrl === s.ctrl && !!b.shift === s.shift && !!b.alt === s.alt;
  // Ngữ cảnh TAB được hỏi TRƯỚC; phím không có nghĩa riêng ở TAB (Delete,
  // Ctrl+Z, ←/→ …) rơi xuống nghĩa chung của khuông nhạc.
  if (cheDo === "tab") {
    const rieng = KEYMAP.find((b) => b.cheDo === "tab" && khop(b));
    if (rieng) return rieng.action;
  }
  const hit = KEYMAP.find((b) => !b.cheDo && khop(b));
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
    case "TAB_DIGIT":
      return a.digit === (b as typeof a).digit;
    case "MOVE_TAB_STRING":
      return a.delta === (b as typeof a).delta;
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
export function phimCua(action: EditorAction, cheDo: CheDo = "notation"): string | null {
  // Một phím chỉ được hiện làm nhãn ở ngữ cảnh mà nó THẬT SỰ làm việc ấy. Ở TAB,
  // `3` là phím đàn — nút "móc kép" mà vẫn đeo nhãn `3` là nói sai với thầy.
  const biChe = (b: KeyBinding) =>
    cheDo === "tab" &&
    !b.cheDo &&
    KEYMAP.some(
      (t) =>
        t.cheDo === "tab" &&
        chuan(t.key) === chuan(b.key) &&
        !!t.ctrl === !!b.ctrl &&
        !!t.shift === !!b.shift &&
        !!t.alt === !!b.alt
    );
  const hit = KEYMAP.find(
    (b) =>
      cungHanhDong(b.action, action) &&
      (b.cheDo === undefined || b.cheDo === cheDo) &&
      !biChe(b)
  );
  return hit ? nhanPhim(hit) : null;
}

/**
 * Danh sách để hiện bảng trợ giúp; GỘP các phím cùng một lời mô tả.
 *
 * Bốn phím cùng chuyển nốt thành lặng, và bảy chữ cái cùng là "nhập nốt" — liệt
 * kê rời ra thì bảng dài gấp đôi mà không nói thêm được gì.
 */
export const BANG_TRO_GIUP = (() => {
  const gop = new Map<string, string[]>();
  for (const b of KEYMAP) gop.set(b.mo, [...(gop.get(b.mo) ?? []), nhanPhim(b)]);
  return [...gop].map(([mo, phims]) => ({ phim: phims.join(" / "), mo }));
})();
