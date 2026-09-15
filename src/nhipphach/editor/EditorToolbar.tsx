import { NOTE_TYPES, TYPE_LABEL } from "../edit/durationModel.ts";
import type { NoteType } from "../edit/durationModel.ts";
import { BANG_TRO_GIUP, phimCua } from "./keymap.ts";
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

/** Thứ tự trên thanh: từ ngắn tới dài. Phím tắt KHÔNG khai ở đây — hỏi keymap. */
const HINH_NOT: readonly NoteType[] = ["16th", "eighth", "quarter", "half", "whole"];

/**
 * Một nút = một `EditorAction` + nhãn phím lấy từ CHÍNH bảng phím.
 *
 * Không có chuỗi phím nào được gõ tay trong JSX: `phimCua` là nguồn sự thật duy
 * nhất, nên đổi bảng phím là nhãn trên nút đổi theo. Hành động chưa có phím thì
 * không hiện nhãn — thà trống còn hơn hiện một phím không tồn tại.
 */
function TBtn({
  action,
  ten,
  mo,
  pressed,
  disabled,
  onAction,
}: {
  action: EditorAction;
  ten: string;
  mo: string;
  pressed?: boolean;
  disabled?: boolean;
  onAction: EditorToolbarProps["onAction"];
}) {
  const phim = phimCua(action);
  return (
    <button
      type="button"
      className="np-tbtn"
      disabled={disabled}
      aria-pressed={pressed}
      aria-keyshortcuts={phim ?? undefined}
      title={phim ? `${mo} (phím ${phim})` : mo}
      onClick={() => onAction(action)}
    >
      <span>{ten}</span>
      {phim && <span className="np-tkey" aria-hidden="true">{phim}</span>}
    </button>
  );
}

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
        {HINH_NOT.map((type) => (
          <TBtn
            key={type}
            action={{ type: "SET_DURATION", noteType: type }}
            ten={TYPE_LABEL[type]}
            mo={TYPE_LABEL[type]}
            pressed={fields?.noteType === type}
            disabled={!suaDuocTruongDo}
            onAction={onAction}
          />
        ))}
        <TBtn
          action={{ type: "TOGGLE_DOT" }}
          ten="·"
          mo="Thêm / bỏ chấm dôi"
          pressed={!!fields && fields.dots > 0}
          disabled={!suaDuocTruongDo}
          onAction={onAction}
        />
      </span>

      <span className="np-toolbar-group" role="group" aria-label="Dấu hoá">
        {DAU_HOA.map((d) => (
          // Ba nút này CHƯA có phím tắt ở 4A — `phimCua` trả null nên nút không
          // hiện nhãn, thay vì bịa ra một phím không bấm được.
          <TBtn
            key={d.ky}
            action={{ type: "SET_ALTER", alter: d.alter }}
            ten={d.ky}
            mo={`${d.ten} — đổi dấu hoá của chính bậc này`}
            pressed={fields?.pitch?.alter === d.alter}
            disabled={!suaDuocCaoDo}
            onAction={onAction}
          />
        ))}
        <TBtn
          action={{ type: "RESPELL" }}
          ten="♯↔♭"
          mo="Đổi cách ghi, giữ nguyên tiếng"
          disabled={!suaDuocCaoDo || !fields?.respell.length}
          onAction={onAction}
        />
      </span>

      <span className="np-toolbar-group" role="group" aria-label="Dấu lặng">
        {/* Nhãn phím do keymap trả — 4B.1 gắn bốn phím vào MAKE_REST, nút hiện
            phím ĐẦU TIÊN trong bảng. Không gõ tay chuỗi phím lần thứ hai. */}
        <TBtn
          action={{ type: "MAKE_REST" }}
          ten="Lặng"
          mo="Xoá nốt → chuyển thành lặng để giữ nhịp"
          pressed={fields?.kind === "rest"}
          disabled={!fields || fields.kind === "rest" || fields.chord !== "none" || !!fields.ties.length || fields.grace}
          onAction={onAction}
        />
      </span>

      <span className="np-toolbar-group" role="group" aria-label="Ngăn xếp">
        <TBtn action={{ type: "UNDO" }} ten="↶" mo="Hoàn tác" disabled={!canUndo} onAction={onAction} />
        <TBtn action={{ type: "REDO" }} ten="↷" mo="Làm lại" disabled={!canRedo} onAction={onAction} />
      </span>

      <span className="np-toolbar-hint" title={troGiup}>
        ← → đi nốt · ↑ ↓ đổi cao độ · 3–7 hình nốt · A–G nhập nốt · phím ? xem đủ
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
