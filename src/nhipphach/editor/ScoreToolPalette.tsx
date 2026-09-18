import type { ReactNode } from "react";
import { TYPE_LABEL } from "../edit/durationModel.ts";
import type { NoteType } from "../edit/durationModel.ts";
import { BANG_TRO_GIUP, NHOM_PHIM, phimCua } from "./keymap.ts";
import type { EditorAction } from "./actions.ts";
import type { NoteFields } from "../edit/noteFields.ts";
import type { EntryDuration } from "./noteEntry.ts";

/**
 * Bảng ký hiệu gọn — Editor UX (thay thanh công cụ nhiều chữ của 4A).
 *
 * Nhìn bản nhạc là chính; công cụ là một hàng ký hiệu nhỏ như Guitar Pro /
 * MuseScore. Nút CHỈ có ký hiệu; tên và phím tắt nằm trong `title` và
 * `aria-label` ("Nốt đen · 5").
 *
 * Mỗi nút phát ra ĐÚNG cái `EditorAction` mà phím tắt tương ứng phát ra — bàn
 * phím và bảng ký hiệu hội tụ tại một chỗ. Bảng không biết MusicXML, không vá gì.
 *
 * Ký hiệu nhạc là glyph SMuFL của font Bravura (đã nạp sẵn cho cả app, giấy phép
 * SIL OFL) — không tải thêm bộ icon nào, không dùng artwork của phần mềm khác.
 */
export interface ScoreToolPaletteProps {
  /** Ô của nốt đang chọn; `null` = chưa chọn gì → mọi nút sửa tắt. */
  fields: NoteFields | null;
  /**
   * Trường độ đang CẦM TRÊN TAY — Giai đoạn 4B.3. Con trỏ ở dấu lặng thì hàng
   * hình nốt tả cây bút sắp dùng, không tả dấu lặng.
   */
  truongDoNhap: EntryDuration;
  /** Vùng chọn có từ hai sự kiện trở lên (luyến cần hai đầu). */
  coVung: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Bảng Thuộc tính đang mở. */
  moThuocTinh: boolean;
  onAction(action: EditorAction): void;
}

/** Glyph SMuFL (Bravura). Mã điểm theo SMuFL 1.4 — không vẽ tay ký hiệu nhạc. */
const G = {
  "16th": "",
  eighth: "",
  quarter: "",
  half: "",
  whole: "",
  dot: "",
  flat: "",
  natural: "",
  sharp: "",
  rest: "",
} as const;

const HINH_NOT: readonly NoteType[] = ["16th", "eighth", "quarter", "half", "whole"];

const DAU_HOA: readonly { alter: number; glyph: string; ten: string }[] = [
  { alter: -1, glyph: G.flat, ten: "Dấu giáng" },
  { alter: 0, glyph: G.natural, ten: "Dấu bình" },
  { alter: 1, glyph: G.sharp, ten: "Dấu thăng" },
];

/** Biểu tượng đơn giản cho thứ không có glyph nhạc — vẽ nội bộ, dùng màu chữ. */
const Icon = {
  slur: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M3 15 C 7 6, 17 6, 21 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  xoa: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M8 5h12v14H8L3 12z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M11 9l6 6M17 9l-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  loi: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 6h14M12 6v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
    </svg>
  ),
  hopAm: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 9h14M5 14h14M9.7 4v16M14.3 4v16" stroke="currentColor" strokeWidth="1" />
      <circle cx="9.7" cy="11.5" r="1.6" fill="currentColor" />
      <circle cx="14.3" cy="16.5" r="1.6" fill="currentColor" />
    </svg>
  ),
  thuocTinh: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="17" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
};

/**
 * Một nút = một `EditorAction`. Tên hiện ra (tooltip, aria-label) = tên + phím
 * lấy từ CHÍNH bảng phím (`phimCua`) — không gõ tay chuỗi phím nào ở đây.
 *
 * `onMouseDown` chặn mặc định để nút KHÔNG giành focus: bấm nút xong thầy gõ
 * phím tiếp được ngay trên bản nhạc (bộ phân phối phím coi `<button>` đang giữ
 * focus là "đang gõ chữ" và bỏ qua phím tắt).
 */
function PBtn({
  action,
  ten,
  children,
  pressed,
  disabled,
  glyph,
  onAction,
}: {
  action: EditorAction;
  ten: string;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  /** Nội dung là glyph Bravura (cỡ chữ nhạc), không phải biểu tượng SVG. */
  glyph?: boolean;
  onAction: ScoreToolPaletteProps["onAction"];
}) {
  const phim = phimCua(action);
  const nhan = phim ? `${ten} · ${phim}` : ten;
  return (
    <button
      type="button"
      className={glyph ? "np-pbtn np-pbtn-glyph" : "np-pbtn"}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={nhan}
      aria-keyshortcuts={phim ?? undefined}
      title={nhan}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onAction(action)}
    >
      {children}
    </button>
  );
}

export function ScoreToolPalette({
  fields,
  truongDoNhap,
  coVung,
  canUndo,
  canRedo,
  moThuocTinh,
  onAction,
}: ScoreToolPaletteProps) {
  // Con trỏ ở dấu lặng = đang NHẬP NỐT: hàng hình nốt chọn cây bút.
  const dangNhap = fields?.kind === "rest";
  const suaDuocTruongDo = !!fields && (dangNhap || !fields.duongTruongDo);
  const suaDuocCaoDo = !!fields?.pitch;
  const coNot = !!fields && fields.kind !== "rest";
  return (
    <div className="np-palette" role="toolbar" aria-label="Công cụ biên tập">
      <span className="np-pal-group" role="group" aria-label="Trường độ">
        {HINH_NOT.map((type) => (
          <PBtn
            key={type}
            glyph
            action={{ type: "SET_DURATION", noteType: type }}
            ten={dangNhap ? `Nhập bằng ${TYPE_LABEL[type]}` : TYPE_LABEL[type]}
            pressed={dangNhap ? truongDoNhap.noteType === type : fields?.noteType === type}
            disabled={!suaDuocTruongDo}
            onAction={onAction}
          >
            {G[type as keyof typeof G]}
          </PBtn>
        ))}
        <PBtn
          glyph
          action={{ type: "TOGGLE_DOT" }}
          ten={dangNhap ? "Nhập có chấm dôi" : "Chấm dôi"}
          pressed={dangNhap ? truongDoNhap.dots > 0 : !!fields && fields.dots > 0}
          disabled={!suaDuocTruongDo}
          onAction={onAction}
        >
          {G.dot}
        </PBtn>
      </span>

      <span className="np-pal-group" role="group" aria-label="Dấu hoá">
        {DAU_HOA.map((d) => (
          <PBtn
            key={d.alter}
            glyph
            action={{ type: "SET_ALTER", alter: d.alter }}
            ten={d.ten}
            pressed={fields?.pitch?.alter === d.alter}
            disabled={!suaDuocCaoDo}
            onAction={onAction}
          >
            {d.glyph}
          </PBtn>
        ))}
        <PBtn
          glyph
          action={{ type: "RESPELL" }}
          ten="Đổi cách ghi (giữ nguyên tiếng)"
          disabled={!suaDuocCaoDo || !fields?.respell.length}
          onAction={onAction}
        >
          {G.sharp}
          <span className="np-pal-small">⇄</span>
          {G.flat}
        </PBtn>
      </span>

      <span className="np-pal-group" role="group" aria-label="Cấu trúc">
        <PBtn
          action={{ type: "MAKE_REST" }}
          ten={coVung ? "Xoá cả vùng" : "Xoá nốt"}
          disabled={!coNot && !coVung}
          onAction={onAction}
        >
          {Icon.xoa}
        </PBtn>
        <PBtn action={{ type: "TOGGLE_SLUR" }} ten="Luyến / bỏ luyến" disabled={!coVung} onAction={onAction}>
          {Icon.slur}
        </PBtn>
        {dangNhap && (
          // Không phải nút: chỉ báo rằng con trỏ đang đứng ở chỗ lặng = đang nhập nốt.
          <span
            className="np-pal-mode np-pbtn-glyph"
            role="status"
            aria-label="Đang nhập nốt — gõ A–G"
            title="Đang nhập nốt — gõ A–G"
          >
            {G.rest}
          </span>
        )}
      </span>

      <span className="np-pal-group" role="group" aria-label="Chữ">
        <PBtn action={{ type: "OPEN_LYRIC" }} ten="Sửa lời" disabled={!fields?.lyrics.length} onAction={onAction}>
          {Icon.loi}
        </PBtn>
        <PBtn action={{ type: "OPEN_HARMONY" }} ten="Sửa hợp âm" disabled={!fields} onAction={onAction}>
          {Icon.hopAm}
        </PBtn>
      </span>

      <span className="np-pal-group" role="group" aria-label="Lịch sử">
        <PBtn action={{ type: "UNDO" }} ten="Hoàn tác" disabled={!canUndo} onAction={onAction}>
          <span className="np-pal-txt">↶</span>
        </PBtn>
        <PBtn action={{ type: "REDO" }} ten="Làm lại" disabled={!canRedo} onAction={onAction}>
          <span className="np-pal-txt">↷</span>
        </PBtn>
      </span>

      <span className="np-pal-group np-pal-end" role="group" aria-label="Khác">
        <PBtn action={{ type: "TOGGLE_INSPECTOR" }} ten="Thuộc tính" pressed={moThuocTinh} onAction={onAction}>
          {Icon.thuocTinh}
        </PBtn>
        <PBtn action={{ type: "SHOW_HELP" }} ten="Phím tắt (?)" onAction={onAction}>
          <span className="np-pal-txt">?</span>
        </PBtn>
      </span>
    </div>
  );
}

/** Bảng phím đầy đủ — hiện khi bấm `?`. Không có logic, chỉ là danh sách theo nhóm. */
export function KeymapHelp({ onClose }: { onClose(): void }) {
  return (
    <div className="np-keyhelp" role="dialog" aria-label="Phím tắt bản nhạc">
      <div className="np-keyhelp-head">
        <strong>Phím tắt</strong>
        <button type="button" className="np-zbtn" onClick={onClose}>
          Đóng
        </button>
      </div>
      {NHOM_PHIM.map((nhom) => (
        <section key={nhom} className="np-keyhelp-group" aria-label={nhom}>
          <h4>{nhom}</h4>
          <ul>
            {BANG_TRO_GIUP.filter((b) => b.nhom === nhom).map((b) => (
              <li key={`${b.phim}|${b.mo}`}>
                <kbd>{b.phim}</kbd>
                <span>{b.mo}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="np-muted">
        Quy ước phím theo MuseScore 4 và Smoosic (MIT) — xem THIRD_PARTY_NOTICES.md.
      </p>
    </div>
  );
}
