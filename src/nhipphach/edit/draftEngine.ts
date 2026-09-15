import type { MusicXmlEditCommand } from "./commands.ts";
import { applyCommand } from "./applyCommand.ts";
import { apDelta, danhTinhGoc } from "./draftIdentity.ts";
import type { DraftIdentity } from "./draftIdentity.ts";
import { tagSourceIds } from "../../musicxml-beats/sourceTags.ts";

/**
 * Bản nháp = bản gốc + ngăn xếp lệnh. Đó là ĐỊNH NGHĨA, không phải cách tối ưu:
 * hoàn tác là bỏ lệnh cuối rồi DỰNG LẠI từ gốc; làm lại là áp lại lệnh. Không có
 * diff engine, không có snapshot ngầm — thứ duy nhất được lưu là gốc và lệnh.
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

export const createDraft = (original: string): DraftState => ({
  original,
  commands: [],
  cursor: 0,
  xml: original,
  identity: danhTinhCuaGoc(original),
});

export const appliedCommands = (s: DraftState) => s.commands.slice(0, s.cursor);
export const isDirty = (s: DraftState) => s.cursor > 0;
export const canUndo = (s: DraftState) => s.cursor > 0;
export const canRedo = (s: DraftState) => s.cursor < s.commands.length;

/** Áp lệnh lên nháp. Lệnh không đổi gì thì không vào ngăn xếp. Áp lệnh mới là mất phần "làm lại". */
export function applyToDraft(s: DraftState, cmd: MusicXmlEditCommand): DraftState {
  const applied = applyCommand(s.xml, cmd);
  if (!applied.changed) return s;
  const commands = [...appliedCommands(s), cmd];
  return {
    original: s.original,
    commands,
    cursor: commands.length,
    xml: applied.xml,
    // Chỉ số lệnh đi vào id của sự kiện mới, nên id ấy cũng tất định theo lịch sử.
    identity: applied.structural.length
      ? apDelta(s.identity, applied.structural, commands.length - 1)
      : s.identity,
  };
}

export function undo(s: DraftState): DraftState {
  if (!canUndo(s)) return s;
  const cursor = s.cursor - 1;
  return { ...s, cursor, ...rebuildAll(s.original, s.commands.slice(0, cursor)) };
}

export function redo(s: DraftState): DraftState {
  if (!canRedo(s)) return s;
  const cursor = s.cursor + 1;
  const r = applyCommand(s.xml, s.commands[cursor - 1]);
  return {
    ...s,
    cursor,
    xml: r.xml,
    identity: r.structural.length ? apDelta(s.identity, r.structural, cursor - 1) : s.identity,
  };
}

/** Huỷ: về bản gốc, quên hết lệnh. Không ghi gì ở đâu. */
export const cancelDraft = (s: DraftState): DraftState => createDraft(s.original);
