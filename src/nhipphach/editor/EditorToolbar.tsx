import { NOTE_TYPES, TYPE_LABEL } from "../edit/durationModel.ts";
import type { NoteType } from "../edit/durationModel.ts";
import { BANG_TRO_GIUP } from "./keymap.ts";
import type { EditorAction } from "./actions.ts";
import type { NoteFields } from "../edit/noteFields.ts";

/**
 * Thanh công cụ tối thiểu — Giai đoạn 4A.
 *
 * Mỗi nút phát ra ĐÚNG cái `EditorAction` mà phím tắt tương ứng phát ra. Không
 * có nhánh logic riêng cho chuột: bàn phím và thanh công cụ hội tụ tại một chỗ,
 * nên không thể có chuyện bấm nút ra một đằng, bấm phím ra một nẻo.
 *
 * Nút nào hiện đang là trạng thái của nốt thì được đánh dấu, để thanh công cụ
 * vừa là chỗ bấm vừa là chỗ đọc.
 */
export interface EditorToolbarProps {
  /** Ô của nốt đang chọn; `null` = chưa chọn gì → mọi nút tắt. */
  fields: NoteFields | null;
  canUndo: boolean;
  canRedo: boolean;
  onAction(action: EditorAction): void;
}

/** Thứ tự trên thanh: từ ngắn tới dài, đúng như phím 3 → 7. */
const HINH_NOT: readonly { type: NoteType; phim: string }[] = [
  { type: "16th", phim: "3" },
  { type: "eighth", phim: "4" },
  { type: "quarter", phim: "5" },
  { type: "half", phim: "6" },
  { type: "whole", phim: "7" },
];

const DAU_HOA: readonly { alter: number; ky: string; ten: string }[] = [
  { alter: -1, ky: "♭", ten: "Giáng" },
  { alter: 0, ky: "♮", ten: "Bình" },
  { alter: 1, ky: "♯", ten: "Thăng" },
];

export function EditorToolbar({ fields, canUndo, canRedo, onAction }: EditorToolbarProps) {
  const suaDuocTruongDo = !!fields && !fields.duongTruongDo;
  const suaDuocCaoDo = !!fields?.pitch;
  const troGiup = BANG_TRO_GIUP.map((b) => `${b.phim} — ${b.mo}`).join("\n");
  return (
    <div className="np-toolbar" role="toolbar" aria-label="Công cụ biên tập">
      <span className="np-toolbar-group" role="group" aria-label="Hình nốt">
        {HINH_NOT.map((h) => (
          <button
            key={h.type}
            type="button"
            className="np-tbtn"
            disabled={!suaDuocTruongDo}
            aria-pressed={fields?.noteType === h.type}
            title={`${TYPE_LABEL[h.type]} (phím ${h.phim})`}
            onClick={() => onAction({ type: "SET_DURATION", noteType: h.type })}
          >
            {TYPE_LABEL[h.type]}
          </button>
        ))}
        <button
          type="button"
          className="np-tbtn"
          disabled={!suaDuocTruongDo}
          aria-pressed={!!fields && fields.dots > 0}
          title="Chấm dôi (phím .)"
          onClick={() => onAction({ type: "TOGGLE_DOT" })}
        >
          ·
        </button>
      </span>

      <span className="np-toolbar-group" role="group" aria-label="Dấu hoá">
        {DAU_HOA.map((d) => (
          <button
            key={d.ky}
            type="button"
            className="np-tbtn"
            disabled={!suaDuocCaoDo}
            aria-pressed={fields?.pitch?.alter === d.alter}
            title={`${d.ten} — đổi dấu hoá của chính bậc này`}
            onClick={() => onAction({ type: "SET_ALTER", alter: d.alter })}
          >
            {d.ky}
          </button>
        ))}
        <button
          type="button"
          className="np-tbtn"
          disabled={!suaDuocCaoDo || !fields?.respell.length}
          title="Đổi cách ghi, giữ nguyên tiếng (Shift+E)"
          onClick={() => onAction({ type: "RESPELL" })}
        >
          ♯↔♭
        </button>
      </span>

      <span className="np-toolbar-group" role="group" aria-label="Ngăn xếp">
        <button
          type="button"
          className="np-tbtn"
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
          onClick={() => onAction({ type: "UNDO" })}
        >
          ↶
        </button>
        <button
          type="button"
          className="np-tbtn"
          disabled={!canRedo}
          title="Làm lại (Ctrl+Shift+Z)"
          onClick={() => onAction({ type: "REDO" })}
        >
          ↷
        </button>
      </span>

      <span className="np-toolbar-hint" title={troGiup}>
        ← → đi nốt · ↑ ↓ đổi cao độ · 3–7 hình nốt · phím ? xem đủ
      </span>
    </div>
  );
}

/** Bảng phím đầy đủ — hiện khi bấm `?`. Không có logic, chỉ là danh sách. */
export function KeymapHelp({ onClose }: { onClose(): void }) {
  return (
    <div className="np-keyhelp" role="dialog" aria-label="Phím tắt bản nhạc">
      <div className="np-keyhelp-head">
        <strong>Phím tắt</strong>
        <button type="button" className="np-zbtn" onClick={onClose}>
          Đóng
        </button>
      </div>
      <ul>
        {BANG_TRO_GIUP.map((b) => (
          <li key={`${b.phim}|${b.mo}`}>
            <kbd>{b.phim}</kbd>
            <span>{b.mo}</span>
          </li>
        ))}
      </ul>
      <p className="np-muted">
        Quy ước phím theo MuseScore 4 và Smoosic (MIT) — xem THIRD_PARTY_NOTICES.md.
      </p>
    </div>
  );
}

export { NOTE_TYPES };
