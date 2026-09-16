import { PHIM_TOI_DA_UI } from "../edit/tabModel.ts";

/**
 * Gom chữ số thành số phím — Giai đoạn 4D.
 *
 * Quy ước Guitar Pro: gõ `1` rồi `2` liền nhau là phím 12, không phải phím 1
 * rồi phím 2. Trạng thái ở đây CHỈ có ba thứ — dãy chữ số đang gõ, nốt nào
 * đang được gõ vào, và lúc gõ chữ số trước — không có mô hình bản nhạc nào.
 *
 * Luật nối, tất định:
 *   · cùng nốt, trong `CHO_NOI` mili-giây, và số ghép vẫn ≤ trần ô nhập
 *     → NỐI vào dãy cũ ("1" + "2" = 12)
 *   · khác đi → BẮT ĐẦU dãy mới bằng đúng chữ số vừa gõ
 * Nhờ vậy gõ `2` rồi `5` ra 25 thì vượt trần nên thành phím 5 — không bao giờ
 * ra một số phím không nhập được.
 */
export const CHO_NOI = 700;

export interface TabEntryState {
  /** Nốt TAB đang được gõ vào (id nguồn). */
  nguon: string | null;
  /** Dãy chữ số đang gõ. */
  day: string;
  /** Lúc gõ chữ số trước (ms). */
  luc: number;
}

export const TAB_TRONG: TabEntryState = { nguon: null, day: "", luc: 0 };

export interface KetQuaGo {
  state: TabEntryState;
  /** Số phím sau cú gõ này. */
  phim: number;
  /** `true` khi cú gõ này NỐI vào dãy trước — trang thay lệnh cũ thay vì thêm lệnh mới. */
  noiTiep: boolean;
}

export function goSo(
  state: TabEntryState,
  nguon: string,
  so: number,
  bayGio: number
): KetQuaGo {
  const coTheNoi =
    state.nguon === nguon && state.day.length > 0 && bayGio - state.luc <= CHO_NOI;
  if (coTheNoi) {
    const ghep = state.day + String(so);
    if (Number(ghep) <= PHIM_TOI_DA_UI)
      return { state: { nguon, day: ghep, luc: bayGio }, phim: Number(ghep), noiTiep: true };
  }
  return { state: { nguon, day: String(so), luc: bayGio }, phim: so, noiTiep: false };
}
