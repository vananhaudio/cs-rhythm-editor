import type { MusicXmlEditCommand } from "./commands.ts";
import { applyCommand } from "./applyCommand.ts";
import { apDelta, danhTinhGoc } from "./draftIdentity.ts";
import type { DraftIdentity } from "./draftIdentity.ts";
import { tagSourceIds } from "../../musicxml-beats/sourceTags.ts";

/**
 * Bản nháp = bản gốc + ngăn xếp lệnh. Đó là ĐỊNH NGHĨA: hoàn tác là bỏ lệnh cuối
 * rồi dựng lại từ gốc; làm lại là áp lại lệnh. Không có diff engine. Từ 4D.P5A,
 * hoàn tác đi tắt qua một bộ đệm mốc DẪN XUẤT (xem `DraftCheckpointCache` bên
 * dưới) — luôn được kiểm lại, và bỏ đi thì kết quả vẫn y hệt.
 *
 * Trạng thái bất biến: mọi hàm trả về trạng thái mới, không sửa cái cũ.
 * Không có I/O ở đây: không Storage, không database.
 */
export interface DraftState {
  readonly original: string;
  /** Toàn bộ ngăn xếp, kể cả phần đã hoàn tác (để còn làm lại). */
  readonly commands: readonly MusicXmlEditCommand[];
  /** Số lệnh đang được áp. */
  readonly cursor: number;
  /** MusicXML nháp hiện tại = rebuild(original, commands[0..cursor)). */
  readonly xml: string;
  /**
   * Bản đồ danh tính — Giai đoạn 4B.2.
   *
   * Sửa cấu trúc làm đổi chỉ số con, tức là đổi `tva-src-…` của mọi sự kiện
   * đứng sau. Ngăn xếp lệnh không hề gì (toạ độ trong lệnh là toạ độ tại lúc
   * ghi, và phát lại dựng đúng lại hình dạng ấy), nhưng con trỏ và vùng chọn
   * thì CÓ — chúng cầm một id bắc qua nhiều lệnh. Bản đồ này cho chúng một id
   * logic bền, và cũng được dựng lại tất định từ (gốc, dãy lệnh).
   */
  readonly identity: DraftIdentity;
}

export function rebuildDraft(
  original: string,
  commands: readonly MusicXmlEditCommand[]
): string {
  return commands.reduce((xml, cmd) => applyCommand(xml, cmd).xml, original);
}

/** Bản đồ danh tính của bản gốc: mọi sự kiện, id logic sinh từ chỗ ngồi ban đầu. */
export const danhTinhCuaGoc = (original: string): DraftIdentity =>
  danhTinhGoc(tagSourceIds(original).notes);

/**
 * Dựng lại CẢ nháp lẫn bản đồ danh tính từ gốc + dãy lệnh. Một hàm thuần, không
 * trạng thái ẩn: hoàn tác chỉ là gọi lại nó với một tiền tố ngắn hơn.
 */
export function rebuildAll(
  original: string,
  commands: readonly MusicXmlEditCommand[]
): { xml: string; identity: DraftIdentity } {
  let xml = original;
  let identity = danhTinhCuaGoc(original);
  commands.forEach((cmd, i) => {
    const r = applyCommand(xml, cmd);
    xml = r.xml;
    if (r.structural.length) identity = apDelta(identity, r.structural, i);
  });
  return { xml, identity };
}

/* ── DraftCheckpointCache (4D.P5A) ─────────────────────────────────────────
 *
 * CHỈ LÀ BỘ ĐỆM DẪN XUẤT. Định nghĩa của bản nháp vẫn là (gốc, ngăn xếp lệnh,
 * con trỏ); `rebuildAll` vẫn là đường chuẩn. Bộ đệm này nhớ (xml, danh tính) của
 * vài vị trí trong lịch sử để hoàn tác không phải phát lại từ lệnh đầu tiên.
 *
 * - Gắn với CHÍNH mảng `commands` (WeakMap). Áp lệnh mới sau khi hoàn tác tạo
 *   mảng mới — mốc của nhánh cũ không bao giờ được dùng cho nhánh mới. Phần
 *   tiền tố giống hệt thì được chép sang.
 * - Có giới hạn: vài vị trí gần nhất + vài mốc định kỳ.
 * - Mọi lần dùng đều KIỂM: áp lại đúng lệnh kế tiếp lên mốc phải ra đúng trạng
 *   thái đang có (xml từng byte + danh tính). Lệch → bỏ hết mốc, dựng chuẩn.
 * - Xoá lúc nào cũng được (`xoaCheckpoint`); kết quả không đổi, chỉ chậm hơn.
 */
export const CHECKPOINT_GAN_NHAT = 32;
export const CHECKPOINT_MOC_MOI = 16;
export const CHECKPOINT_MOC_TOI_DA = 16;
interface Moc {
  readonly xml: string;
  readonly identity: DraftIdentity;
}
type BangMoc = Map<number, Moc>;
let boNhoMoc = new WeakMap<readonly MusicXmlEditCommand[], BangMoc>();
export const thongKeLichSu = { trungMoc: 0, phatDuoi: 0, dungLai: 0, lechMoc: 0 };

/** Bỏ toàn bộ mốc — an toàn bất cứ lúc nào. */
export function xoaCheckpoint() {
  boNhoMoc = new WeakMap();
}

function tiaMoc(bang: BangMoc) {
  const dinhKy = [...bang.keys()].filter((k) => k % CHECKPOINT_MOC_MOI === 0).sort((a, b) => a - b);
  // Mốc định kỳ: giữ mốc 0 (bản gốc) và những mốc MỚI nhất.
  while (dinhKy.length > CHECKPOINT_MOC_TOI_DA) {
    const bo = dinhKy.splice(1, 1)[0];
    bang.delete(bo);
  }
  // Vị trí gần đây (không phải mốc định kỳ): giữ theo thứ tự ghi, mới nhất sau cùng.
  const ganDay = [...bang.keys()].filter((k) => k % CHECKPOINT_MOC_MOI !== 0);
  for (let i = 0; i < ganDay.length - CHECKPOINT_GAN_NHAT; i++) bang.delete(ganDay[i]);
}

function ghiMoc(s: DraftState, tu?: { commands: readonly MusicXmlEditCommand[]; denCursor: number }) {
  let bang = boNhoMoc.get(s.commands);
  if (!bang) {
    bang = new Map();
    // Nhánh mới có cùng tiền tố với nhánh cũ tới `denCursor`: mốc tiền tố còn đúng.
    const cu = tu ? boNhoMoc.get(tu.commands) : undefined;
    if (cu) for (const [k, v] of cu) if (k <= tu!.denCursor) bang.set(k, v);
    boNhoMoc.set(s.commands, bang);
  }
  bang.delete(s.cursor);
  bang.set(s.cursor, Object.freeze({ xml: s.xml, identity: s.identity }));
  tiaMoc(bang);
}

export function cungDanhTinh(a: DraftIdentity, b: DraftIdentity): boolean {
  if (a === b) return true;
  if (a.slots.size !== b.slots.size) return false;
  for (const [k, x] of a.slots) {
    const y = b.slots.get(k);
    if (!y || y.partIndex !== x.partIndex || y.measureIndex !== x.measureIndex || y.childIndex !== x.childIndex)
      return false;
  }
  return true;
}

/**
 * Áp lệnh thứ `i` (0-based) lên (xml, danh tính) — đúng như `rebuildAll` làm.
 * Mọi lệnh trong ngăn xếp đều từng LÀM ĐỔI bản nháp (`applyToDraft` bỏ lệnh
 * không đổi gì), nên phát lại từ đúng tiền tố cũng phải làm đổi. Một bước không
 * đổi gì nghĩa là mốc sai — ví dụ mốc chứa sẵn kết quả của chính lệnh ấy, thứ
 * mà phép so "áp tiếp rồi so" một mình không bắt được (lệnh kiểu "đặt giá trị").
 */
class MocSai extends Error {}
function buoc(xml: string, identity: DraftIdentity, cmd: MusicXmlEditCommand, i: number): Moc {
  const r = applyCommand(xml, cmd);
  if (!r.changed) throw new MocSai();
  return { xml: r.xml, identity: r.structural.length ? apDelta(identity, r.structural, i) : identity };
}

/**
 * Trạng thái tại `cursor` (nhỏ hơn `hienTai.cursor`) từ mốc gần nhất, được KIỂM
 * bằng cách áp tiếp tới `hienTai`. Không có mốc dùng được → dựng chuẩn.
 */
function trangThaiTai(hienTai: DraftState, cursor: number): Moc {
  const bang = boNhoMoc.get(hienTai.commands);
  let k = -1;
  if (bang) for (const key of bang.keys()) if (key <= cursor && key > k) k = key;
  if (bang && k >= 0) {
    try {
      let st = bang.get(k)!;
      if (k === cursor) thongKeLichSu.trungMoc++;
      else thongKeLichSu.phatDuoi++;
      for (let i = k; i < cursor; i++) st = buoc(st.xml, st.identity, hienTai.commands[i], i);
      // Kiểm: đi thêm các bước tới trạng thái hiện tại phải ra đúng nó.
      let kiem = st;
      for (let i = cursor; i < hienTai.cursor; i++) kiem = buoc(kiem.xml, kiem.identity, hienTai.commands[i], i);
      if (kiem.xml === hienTai.xml && cungDanhTinh(kiem.identity, hienTai.identity)) return st;
    } catch {
      /* mốc hỏng tới mức lệnh không áp được — rơi xuống đường chuẩn */
    }
    thongKeLichSu.lechMoc++;
    boNhoMoc.delete(hienTai.commands);
  }
  thongKeLichSu.dungLai++;
  return rebuildAll(hienTai.original, hienTai.commands.slice(0, cursor));
}

/** Chỉ dùng trong kiểm thử: nhìn và CỐ Ý LÀM HỎNG bộ đệm. */
export const __checkpointThuNghiem = {
  soMoc: (s: DraftState) => [...(boNhoMoc.get(s.commands)?.keys() ?? [])].sort((a, b) => a - b),
  kichThuoc: (s: DraftState) =>
    [...(boNhoMoc.get(s.commands)?.values() ?? [])].reduce((n, m) => n + m.xml.length, 0),
  chenSai(s: DraftState, cursor: number, moc: { xml: string; identity: DraftIdentity }) {
    let bang = boNhoMoc.get(s.commands);
    if (!bang) boNhoMoc.set(s.commands, (bang = new Map()));
    bang.set(cursor, moc);
  },
};

export const createDraft = (original: string): DraftState => {
  const s: DraftState = {
    original,
    commands: [],
    cursor: 0,
    xml: original,
    identity: danhTinhCuaGoc(original),
  };
  ghiMoc(s);
  return s;
};

export const appliedCommands = (s: DraftState) => s.commands.slice(0, s.cursor);
export const isDirty = (s: DraftState) => s.cursor > 0;
export const canUndo = (s: DraftState) => s.cursor > 0;
export const canRedo = (s: DraftState) => s.cursor < s.commands.length;

/** Áp lệnh lên nháp. Lệnh không đổi gì thì không vào ngăn xếp. Áp lệnh mới là mất phần "làm lại". */
export function applyToDraft(s: DraftState, cmd: MusicXmlEditCommand): DraftState {
  const applied = applyCommand(s.xml, cmd);
  if (!applied.changed) return s;
  const commands = [...appliedCommands(s), cmd];
  const moi: DraftState = {
    original: s.original,
    commands,
    cursor: commands.length,
    xml: applied.xml,
    // Chỉ số lệnh đi vào id của sự kiện mới, nên id ấy cũng tất định theo lịch sử.
    identity: applied.structural.length
      ? apDelta(s.identity, applied.structural, commands.length - 1)
      : s.identity,
  };
  // Mảng lệnh mới: chỉ mốc của TIỀN TỐ (≤ con trỏ cũ) được mang sang.
  ghiMoc(s, undefined);
  ghiMoc(moi, { commands: s.commands, denCursor: s.cursor });
  return moi;
}

export function undo(s: DraftState): DraftState {
  if (!canUndo(s)) return s;
  const cursor = s.cursor - 1;
  const moi: DraftState = { ...s, cursor, ...trangThaiTai(s, cursor) };
  ghiMoc(moi);
  return moi;
}

export function redo(s: DraftState): DraftState {
  if (!canRedo(s)) return s;
  const cursor = s.cursor + 1;
  const r = applyCommand(s.xml, s.commands[cursor - 1]);
  const moi: DraftState = {
    ...s,
    cursor,
    xml: r.xml,
    identity: r.structural.length ? apDelta(s.identity, r.structural, cursor - 1) : s.identity,
  };
  ghiMoc(moi);
  return moi;
}

/** Huỷ: về bản gốc, quên hết lệnh. Không ghi gì ở đâu. */
export const cancelDraft = (s: DraftState): DraftState => createDraft(s.original);
