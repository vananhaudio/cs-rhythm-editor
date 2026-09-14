import type { SourceNote } from "../../musicxml-beats/sourceTags.ts";
import type { MoveWhere } from "./actions.ts";

/**
 * Con trỏ trên bản nhạc — Giai đoạn 4A.
 *
 * Con trỏ là MỘT DANH TÍNH NGUỒN, không phải một điểm trên màn hình. Nó đi từ
 * cú bấm chuột đầu tiên (đã resolve đích danh ở Nội dung 2) rồi sau đó chỉ chạy
 * theo THỨ TỰ TÀI LIỆU của `SourceNote[]` — mảng vốn đã đúng thứ tự.
 *
 * KHÔNG có toạ độ ở đây. Không hộp bao, không "nốt gần nhất", không x/y. Đó là
 * bất biến B của Nội dung 3C, và nó tiếp tục đúng cho cả bàn phím.
 *
 * `sourceIndex` chỉ là chỗ ngồi trong mảng để đi tới/lui cho nhanh; `sourceId`
 * mới là sự thật. Sau mỗi lần khắc lại, trang dựng lại index TỪ id.
 */
export interface ScoreCaret {
  sourceId: string;
  sourceIndex: number;
}

/**
 * Vùng chọn tách khỏi con trỏ ngay từ 4A, dù 4A chỉ dùng một nốt.
 *
 * `anchor` là chỗ vùng chọn bắt đầu, `caret` là đầu đang chạy. 4A luôn giữ hai
 * cái bằng nhau; 4C mở `Shift+←/→` chỉ cần cho chúng khác nhau, KHÔNG phải viết
 * lại cấu trúc. Đó là lý do có `anchor` ngay bây giờ.
 */
export interface ScoreSelection {
  caret: ScoreCaret | null;
  anchor: ScoreCaret | null;
}

export const RONG: ScoreSelection = { caret: null, anchor: null };

/** Chọn đúng một nốt: neo trùng đầu chạy. */
export const chonMot = (caret: ScoreCaret): ScoreSelection => ({ caret, anchor: caret });

/** Danh sách nốt đang được chọn, theo thứ tự tài liệu. 4A luôn trả 0 hoặc 1. */
export function idDangChon(sel: ScoreSelection, notes: readonly SourceNote[]): string[] {
  if (!sel.caret || !sel.anchor) return [];
  const a = Math.min(sel.anchor.sourceIndex, sel.caret.sourceIndex);
  const b = Math.max(sel.anchor.sourceIndex, sel.caret.sourceIndex);
  return notes.slice(a, b + 1).map((n) => n.svgId);
}

/**
 * Nốt nào đi được. Nốt nguồn mà bản khắc không vẽ ra (lặng cả ô — Verovio không
 * giữ id, đã đo ở Nội dung 2) bị loại: con trỏ không được nhảy tới chỗ không
 * nhìn thấy. Bỏ chúng khỏi danh sách trung thực hơn là tô sáng vào hư không.
 *
 * Từng nốt của một HỢP ÂM là từng phần tử riêng, đúng như danh tính nguồn đang
 * có — nên `←/→` đi qua Đô, rồi Mi, rồi Sol. Không gộp hợp âm thành một chặng:
 * gộp thì mất đường chọn riêng một nốt trong hợp âm.
 */
export function dsDiDuoc(
  notes: readonly SourceNote[],
  khongVeDuoc?: ReadonlySet<string>
): SourceNote[] {
  return khongVeDuoc?.size ? notes.filter((n) => !khongVeDuoc.has(n.svgId)) : [...notes];
}

export const caretTaiId = (notes: readonly SourceNote[], sourceId: string): ScoreCaret | null => {
  const i = notes.findIndex((n) => n.svgId === sourceId);
  return i < 0 ? null : { sourceId, sourceIndex: i };
};

const tai = (notes: readonly SourceNote[], i: number): ScoreCaret | null => {
  const n = notes[i];
  return n ? { sourceId: n.svgId, sourceIndex: i } : null;
};

/**
 * Dời con trỏ. Trả `null` khi không có chỗ để đi — trang giữ nguyên chỗ cũ chứ
 * KHÔNG cuộn vòng về đầu: cuộn vòng làm người ta mất dấu mình đang ở đâu.
 */
export function diChuyen(
  notes: readonly SourceNote[],
  caret: ScoreCaret | null,
  where: MoveWhere
): ScoreCaret | null {
  if (!notes.length) return null;
  if (where === "first") return tai(notes, 0);
  if (where === "last") return tai(notes, notes.length - 1);
  if (!caret) return tai(notes, 0);
  // Chỗ ngồi có thể trôi sau khi khắc lại; luôn tìm lại theo id trước.
  const i = notes.findIndex((n) => n.svgId === caret.sourceId);
  if (i < 0) return tai(notes, Math.min(caret.sourceIndex, notes.length - 1));
  if (where === "next") return i + 1 < notes.length ? tai(notes, i + 1) : null;
  if (where === "prev") return i > 0 ? tai(notes, i - 1) : null;

  const ns = notes[i];
  if (where === "nextMeasure") {
    const j = notes.findIndex(
      (n, k) =>
        k > i && (n.partIndex > ns.partIndex || (n.partIndex === ns.partIndex && n.measureIndex > ns.measureIndex))
    );
    return j < 0 ? null : tai(notes, j);
  }
  // prevMeasure: về ĐẦU ô nhịp trước đó, không phải về nốt liền trước.
  let j = -1;
  for (let k = i - 1; k >= 0; k--) {
    const n = notes[k];
    if (n.partIndex !== ns.partIndex || n.measureIndex !== ns.measureIndex) {
      j = k;
      break;
    }
  }
  if (j < 0) return null;
  const dich = notes[j];
  while (j > 0 && notes[j - 1].partIndex === dich.partIndex && notes[j - 1].measureIndex === dich.measureIndex)
    j--;
  return tai(notes, j);
}
