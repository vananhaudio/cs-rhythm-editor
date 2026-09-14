import type { NoteType } from "../edit/durationModel.ts";

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
  | { type: "UNDO" }
  | { type: "REDO" };

/** Hành động chỉ dời con trỏ — trang dùng để biết lúc nào KHÔNG cần khắc lại. */
export const laDieuHuong = (a: EditorAction): a is { type: "MOVE"; where: MoveWhere } =>
  a.type === "MOVE";

/** Hành động thuộc về ngăn xếp nháp, không phải về một nốt cụ thể. */
export const laNganXep = (a: EditorAction) => a.type === "UNDO" || a.type === "REDO";

/** Tên tiếng Việt để hiện trên nút và trong thông báo. */
export const TEN_HANH_DONG: Record<EditorAction["type"], string> = {
  MOVE: "Di chuyển",
  TRANSPOSE: "Đổi cao độ",
  SET_DURATION: "Đổi trường độ",
  TOGGLE_DOT: "Chấm dôi",
  RESPELL: "Đổi cách ghi",
  SET_ALTER: "Đổi dấu hoá",
  UNDO: "Hoàn tác",
  REDO: "Làm lại",
};
