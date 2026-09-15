import { sourcePath } from "../../musicxml-beats/sourceTags.ts";

/**
 * DANH TÍNH SỐNG QUA SỬA CẤU TRÚC — Giai đoạn 4B.2.
 *
 * ═══ VẤN ĐỀ ═══
 * Danh tính tới giờ là VỊ TRÍ: `/part[i]/measure[j]/*[k]`. Chèn thêm một
 * `<note><rest/></note>` vào ô nhịp là mọi sự kiện đứng sau nó trong ô ấy tụt
 * chỉ số — đo được: chèn một cái thì c3 c4 c5 thành c4 c5 c6.
 *
 * ═══ NGĂN XẾP LỆNH THÌ KHÔNG SAO ═══
 * Điều này nghe ngược nhưng đúng, và nó quyết định toàn bộ kiến trúc: đường dẫn
 * trong một lệnh là toạ độ TẠI THỜI ĐIỂM GHI, tức là sau khi các lệnh trước nó
 * đã chạy. `rebuildDraft` phát lại đúng dãy ấy theo đúng thứ tự, nên khi tới
 * lượt lệnh thứ n, tài liệu đang ở đúng hình dạng mà lệnh n đã nhìn thấy lúc
 * được ghi. Hoàn tác chỉ cắt bớt phần ĐUÔI, không bao giờ bỏ một lệnh ở giữa,
 * nên không có chỗ nào cho toạ độ trượt. Vì vậy 4B.2 KHÔNG đổi cách lệnh lưu
 * đường dẫn — đổi là phá một thứ đang đúng.
 *
 * ═══ CÁI THẬT SỰ GÃY ═══
 * Là những thứ giữ một đường dẫn BẮC QUA một lệnh: con trỏ, vùng chọn, ô thông
 * tin, tô sáng. Chúng cầm `tva-src-p1-m1-c4` từ trước khi chèn; sau khi chèn,
 * cái id ấy vẫn tồn tại nhưng đã là MỘT SỰ KIỆN KHÁC. Im lặng trỏ nhầm là kiểu
 * hỏng tệ nhất.
 *
 * ═══ LỜI GIẢI ═══
 * Một bản đồ NGOÀI XML: `logicalId → đường dẫn hiện tại`. Không ghi id riêng của
 * công cụ vào MusicXML, vì hai lý do đo được:
 *   · Phiên bản trong thư viện là BẤT BIẾN và việc vá là byte-preserving. Nhét
 *     id vào mọi `<note>` là đổi hàng trăm dòng ngay lần lưu đầu, lịch sử phiên
 *     bản mất hết ý nghĩa.
 *   · File thật từ Guitar Pro / MuseScore có sẵn `id` của họ. Ghi đè là xoá dữ
 *     liệu của người dùng; không ghi đè thì không bảo đảm được tính duy nhất.
 *
 * Bản đồ được DỰNG LẠI tất định từ (bản gốc, dãy lệnh) — đúng một hàm thuần,
 * không trạng thái ẩn. Mỗi lệnh khai báo phần dịch chuyển cấu trúc của nó
 * (`StructuralDelta`); ở đây chỉ việc cộng dồn.
 *
 * KHÔNG có một dòng nào ở đây dùng toạ độ màn hình, cao độ, thời điểm, hay so
 * khớp chữ. Danh tính cấu trúc phải tất định.
 */

/** Một lệnh làm thay đổi SỐ con của một ô nhịp. */
export interface StructuralDelta {
  partIndex: number;
  measureIndex: number;
  /** Chèn/xoá xảy ra TẠI chỉ số con này (1-based). */
  atChildIndex: number;
  /** +n = thêm n con tại đó; -n = bỏ n con kể từ đó. */
  delta: number;
}

/** Chỗ ngồi hiện tại của một sự kiện. */
export interface EventSlot {
  partIndex: number;
  measureIndex: number;
  childIndex: number;
}

export interface DraftIdentity {
  /** logicalId → chỗ ngồi hiện tại. */
  readonly slots: ReadonlyMap<string, EventSlot>;
}

/** Id logic của một sự kiện CÓ SẴN trong bản gốc — sinh từ chỗ nó ngồi lúc đầu. */
export const logicalIdGoc = (p: number, m: number, c: number) => `g:${p}/${m}/${c}`;

/** Id logic của một sự kiện do lệnh thứ `lenh` (0-based) sinh ra, cái thứ `thu`. */
export const logicalIdMoi = (lenh: number, thu: number) => `n:${lenh}/${thu}`;

export const duongDan = (s: EventSlot) =>
  sourcePath(s.partIndex, s.measureIndex, s.childIndex);

const cungO = (s: EventSlot, d: StructuralDelta) =>
  s.partIndex === d.partIndex && s.measureIndex === d.measureIndex;

/**
 * Dịch một chỗ ngồi qua một thay đổi cấu trúc.
 * Trả `null` khi chính sự kiện ấy bị xoá — nó không còn chỗ nào để ngồi.
 */
export function dich(s: EventSlot, d: StructuralDelta): EventSlot | null {
  if (!cungO(s, d) || d.delta === 0) return s;
  if (d.delta > 0)
    return s.childIndex >= d.atChildIndex
      ? { ...s, childIndex: s.childIndex + d.delta }
      : s;
  const bo = -d.delta;
  if (s.childIndex < d.atChildIndex) return s;
  if (s.childIndex < d.atChildIndex + bo) return null; // nằm trong vùng bị xoá
  return { ...s, childIndex: s.childIndex - bo };
}

/** Bản đồ ban đầu: mọi sự kiện của bản gốc, id logic sinh từ chỗ ngồi gốc. */
export function danhTinhGoc(
  events: readonly { partIndex: number; measureIndex: number; childIndex: number }[]
): DraftIdentity {
  const slots = new Map<string, EventSlot>();
  for (const e of events)
    slots.set(logicalIdGoc(e.partIndex, e.measureIndex, e.childIndex), {
      partIndex: e.partIndex,
      measureIndex: e.measureIndex,
      childIndex: e.childIndex,
    });
  return { slots };
}

/**
 * Áp phần dịch chuyển của MỘT lệnh. `lenh` là chỉ số lệnh trong ngăn xếp — nó
 * đi vào id của sự kiện mới, nên id ấy cũng tất định theo lịch sử.
 */
export function apDelta(
  id: DraftIdentity,
  deltas: readonly StructuralDelta[],
  lenh: number
): DraftIdentity {
  let slots = new Map(id.slots);
  let thu = 0;
  for (const d of deltas) {
    const moi = new Map<string, EventSlot>();
    for (const [k, s] of slots) {
      const sau = dich(s, d);
      if (sau) moi.set(k, sau);
    }
    // Sự kiện vừa sinh ra ngồi ngay tại chỗ chèn, theo đúng thứ tự chèn.
    for (let i = 0; i < d.delta; i++)
      moi.set(logicalIdMoi(lenh, thu++), {
        partIndex: d.partIndex,
        measureIndex: d.measureIndex,
        childIndex: d.atChildIndex + i,
      });
    slots = moi;
  }
  return { slots };
}

/** Id logic đang ngồi ở chỗ này; `null` khi bản đồ không biết chỗ ấy. */
export function idTaiCho(id: DraftIdentity, s: EventSlot): string | null {
  for (const [k, v] of id.slots)
    if (v.partIndex === s.partIndex && v.measureIndex === s.measureIndex && v.childIndex === s.childIndex)
      return k;
  return null;
}

/**
 * Cùng một sự kiện, sau khi bản đồ đổi, giờ ngồi ở đâu?
 *
 * Đây là cửa mà con trỏ và vùng chọn đi qua sau mỗi lệnh sửa cấu trúc. Trả
 * `null` khi chính sự kiện ấy đã bị bỏ đi — lúc ấy trang phải nói thật là con
 * trỏ mất chỗ, chứ KHÔNG được nhảy sang cái gần nhất.
 */
export function theoDoi(
  truoc: DraftIdentity,
  sau: DraftIdentity,
  cho: EventSlot
): EventSlot | null {
  const id = idTaiCho(truoc, cho);
  return id ? (sau.slots.get(id) ?? null) : null;
}
