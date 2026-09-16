import { traPhim } from "./keymap.ts";
import type { CheDo } from "./keymap.ts";
import type { EditorAction } from "./actions.ts";

/**
 * Từ một cú bấm phím → `EditorAction`, hoặc không gì cả — Giai đoạn 4A.
 *
 * Module này KHÔNG biết MusicXML, KHÔNG biết Verovio, KHÔNG biết React, KHÔNG
 * chạm Storage hay database. Nó chỉ trả lời hai câu: "cú bấm này có phải của
 * bản nhạc không" và "nó có nghĩa gì".
 *
 * Câu thứ nhất quan trọng hơn câu thứ hai: gõ chữ "a" vào ô Lời mà bản nhạc
 * nhảy sang nốt La thì công cụ hỏng. Nên mặc định là KHÔNG nhận, chỉ nhận khi
 * chắc chắn con trỏ chữ không ở đâu cả.
 */
export interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?(name: string): string | null;
}

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /** Nơi phím rơi vào; `null` khi không có (test thuần). */
  target?: ElementLike | null;
}

const O_GO_CHU = new Set(["input", "textarea", "select", "option", "button"]);

/**
 * Chỗ này đang nhận chữ của người dùng phải không?
 *
 * `button` cũng nằm trong danh sách: Space/Enter trên một nút là để bấm nút,
 * không phải để lái bản nhạc. Không có nút nào của công cụ nghe phím mũi tên,
 * nên chặn ở đây không mất gì.
 */
export function dangGoChu(el: ElementLike | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? "").toLowerCase();
  if (O_GO_CHU.has(tag)) return true;
  // `contenteditable` viết bằng thuộc tính (không qua thuộc tính DOM).
  const ce = el.getAttribute?.("contenteditable");
  return ce === "" || ce === "true";
}

export interface DispatchContext {
  /** Quyền `score.edit`. Không có quyền thì KHÔNG một phím nào có nghĩa. */
  choSua: boolean;
  /** Đang mở hộp thoại (thư viện, xác nhận…) — bản nhạc không nghe phím. */
  dangMoModal?: boolean;
  /** Phần tử đang giữ con trỏ chữ, nếu trang biết. */
  focused?: ElementLike | null;
  /**
   * Ngữ cảnh bàn phím (4D). Trang suy từ nốt dưới con trỏ: nốt trên khuông
   * TAB thì chữ số là PHÍM, không phải hình nốt. Không ghi = khuông nhạc.
   */
  cheDo?: CheDo;
}

export type DispatchResult =
  | { kind: "action"; action: EditorAction }
  /** Có phím tắt khớp nhưng bị chặn — trang KHÔNG được `preventDefault`. */
  | { kind: "blocked"; why: "capability" | "modal" | "typing" }
  | { kind: "none" };

/**
 * Cửa duy nhất từ bàn phím vào công cụ.
 *
 * Thứ tự kiểm là cố ý: gõ chữ chặn TRƯỚC cả quyền, vì đang gõ chữ thì kể cả
 * giáo viên cũng không được để `Ctrl+Z` của ô nhập bị cướp mất — chuẩn của mọi
 * trình soạn thảo là hoàn tác chữ đang gõ.
 */
export function dispatch(ev: KeyLike, ctx: DispatchContext): DispatchResult {
  const target = ev.target ?? ctx.focused ?? null;
  if (dangGoChu(target) || dangGoChu(ctx.focused)) return { kind: "blocked", why: "typing" };
  if (ctx.dangMoModal) return { kind: "blocked", why: "modal" };
  const action = traPhim(
    {
      key: ev.key,
      // ⌘ trên máy Mac đi cùng đường với Ctrl.
      ctrl: !!(ev.ctrlKey || ev.metaKey),
      shift: !!ev.shiftKey,
      alt: !!ev.altKey,
    },
    ctx.cheDo ?? "notation"
  );
  if (!action) return { kind: "none" };
  // Cổng quyền lặp lại ở đây có chủ ý: nút có thể bị ẩn mà bàn phím thì không.
  if (!ctx.choSua) return { kind: "blocked", why: "capability" };
  return { kind: "action", action };
}
