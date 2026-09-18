import type { NoteType } from "../edit/durationModel.ts";
import type { Step } from "../edit/commands.ts";

/**
 * Ý ĐỊNH của một thao tác biên tập — Giai đoạn 4A.
 *
 * Đây là chỗ bàn phím và thanh công cụ GẶP NHAU. Cả hai chỉ phát ra `EditorAction`;
 * không bên nào tự biết MusicXML, không bên nào tự vá gì. Việc dịch ý định thành
 * `MusicXmlEditCommand` nằm ở `commandFacade.ts`, và chỉ ở đó.
 *
 * Quy tắc cứng: `EditorAction` KHÔNG BAO GIỜ mang XML thô, không mang toạ độ,
 * không mang phần tử SVG. Nó chỉ nói "muốn gì", không nói "làm thế nào".
 */
export type MoveWhere = "next" | "prev" | "nextMeasure" | "prevMeasure" | "first" | "last";

export type EditorAction =
  /** Chỉ dời con trỏ. KHÔNG sinh lệnh, KHÔNG khắc lại bản nhạc. */
  | { type: "MOVE"; where: MoveWhere }
  /** Dịch cao độ theo nửa cung (±1) hoặc quãng tám (±12). */
  | { type: "TRANSPOSE"; semitones: number }
  | { type: "SET_DURATION"; noteType: NoteType }
  | { type: "TOGGLE_DOT" }
  /** Đổi cách ghi, giữ nguyên tiếng (G♯ → A♭). */
  | { type: "RESPELL" }
  /** Ba nút ♭ ♮ ♯: đổi dấu hoá của chính bậc đang có, không dịch giọng. */
  | { type: "SET_ALTER"; alter: number }
  /**
   * Nốt → dấu lặng. CỐ Ý không đặt tên là DELETE: nó không xoá gì khỏi bản
   * nhạc, nó giữ chỗ và giữ nhịp. Tên đúng thì người đọc mã không hiểu nhầm.
   */
  | { type: "MAKE_REST" }
  /** Gõ một chữ cái A–G để nhập nốt vào chỗ lặng. Quãng tám do `noteEntry` quyết. */
  | { type: "ENTER_PITCH"; step: Step }
  /**
   * Mở rộng vùng chọn về một phía — Giai đoạn 4C. Neo đứng yên, đầu chạy đi.
   * KHÔNG sinh lệnh: chọn nhiều nốt chưa phải là sửa gì cả.
   */
  | { type: "EXTEND_SELECTION"; where: "next" | "prev" }
  /** Chép vùng chọn vào bảng ghi tạm. Tuyệt đối không đụng bản nhạc. */
  | { type: "COPY" }
  /** Dán vào chỗ lặng dưới con trỏ. */
  | { type: "PASTE" }
  | { type: "UNDO" }
  | { type: "REDO" }
  /**
   * Bật / tắt vòng luyến trên VÙNG CHỌN (từ nốt đầu tới nốt cuối) — Editor UX.
   * Luyến ≠ dấu nối: hai hành động, hai lệnh riêng.
   */
  | { type: "TOGGLE_SLUR" }
  /** Mở ô sửa lời của nốt đang chọn. Chỉ đụng giao diện. */
  | { type: "OPEN_LYRIC" }
  /** Mở ô sửa hợp âm gắn với nốt đang chọn. Chỉ đụng giao diện. */
  | { type: "OPEN_HARMONY" }
  /** Mở / đóng bảng Thuộc tính chi tiết. Chỉ đụng giao diện. */
  | { type: "TOGGLE_INSPECTOR" }
  /** Mở bảng phím tắt. Chỉ đụng giao diện. */
  | { type: "SHOW_HELP" };

/** Hành động CHỈ đụng giao diện — không bao giờ sinh lệnh sửa bản nhạc. */
export const laGiaoDien = (a: EditorAction) =>
  a.type === "OPEN_LYRIC" ||
  a.type === "OPEN_HARMONY" ||
  a.type === "TOGGLE_INSPECTOR" ||
  a.type === "SHOW_HELP";

/** Hành động chỉ dời con trỏ — trang dùng để biết lúc nào KHÔNG cần khắc lại. */
export const laDieuHuong = (a: EditorAction): a is { type: "MOVE"; where: MoveWhere } =>
  a.type === "MOVE";

/** Hành động thuộc về ngăn xếp nháp, không phải về một nốt cụ thể. */
export const laNganXep = (a: EditorAction) => a.type === "UNDO" || a.type === "REDO";

/** Hành động chỉ đụng VÙNG CHỌN hoặc bảng ghi tạm — không bao giờ sửa bản nhạc. */
export const laChonHoacChep = (a: EditorAction) =>
  a.type === "EXTEND_SELECTION" || a.type === "COPY";

/** Tên tiếng Việt để hiện trên nút và trong thông báo. */
export const TEN_HANH_DONG: Record<EditorAction["type"], string> = {
  MOVE: "Di chuyển",
  TRANSPOSE: "Đổi cao độ",
  SET_DURATION: "Đổi trường độ",
  TOGGLE_DOT: "Chấm dôi",
  RESPELL: "Đổi cách ghi",
  SET_ALTER: "Đổi dấu hoá",
  MAKE_REST: "Xoá nốt",
  EXTEND_SELECTION: "Mở rộng vùng chọn",
  COPY: "Chép",
  PASTE: "Dán",
  ENTER_PITCH: "Nhập nốt",
  UNDO: "Hoàn tác",
  REDO: "Làm lại",
  TOGGLE_SLUR: "Luyến",
  OPEN_LYRIC: "Lời",
  OPEN_HARMONY: "Hợp âm",
  TOGGLE_INSPECTOR: "Thuộc tính",
  SHOW_HELP: "Phím tắt",
};
