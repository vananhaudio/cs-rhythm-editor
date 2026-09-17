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
  /**
   * Một chữ số gõ trên KHUÔNG TAB — Giai đoạn 4D. Chưa phải lệnh: trang gom
   * chữ số lại (`tabEntry`) để "1" rồi "2" ra phím 12, rồi mới đổi thành
   * `SET_TAB_FRET`.
   */
  | { type: "TAB_DIGIT"; digit: number }
  /** Đặt phím trên CHÍNH dây đang có. Cao độ đổi theo cách lên dây. */
  | { type: "SET_TAB_FRET"; fret: number }
  /** Sang dây bên cạnh mà GIỮ NGUYÊN cao độ. −1 = dây cao hơn, +1 = dây thấp hơn. */
  | { type: "MOVE_TAB_STRING"; delta: -1 | 1 }
  | { type: "UNDO" }
  | { type: "REDO" };

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
  MAKE_REST: "Chuyển thành lặng",
  EXTEND_SELECTION: "Mở rộng vùng chọn",
  COPY: "Chép",
  PASTE: "Dán",
  TAB_DIGIT: "Gõ số phím",
  SET_TAB_FRET: "Đặt phím",
  MOVE_TAB_STRING: "Đổi dây",
  ENTER_PITCH: "Nhập nốt",
  UNDO: "Hoàn tác",
  REDO: "Làm lại",
};
