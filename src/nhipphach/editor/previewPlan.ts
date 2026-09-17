/**
 * 4D.P3 — Phân loại một phép sửa để quyết định bản xem trước vẽ lại bao nhiêu.
 *
 * DANH SÁCH TRẮNG, không suy đoán. Chỉ một trường hợp được vẽ lại MỘT trang:
 *
 *   lệnh = ChangeTabPosition
 *   + bản đang xem trước và bản nháp mới khác nhau ĐÚNG trong <note> đó
 *   + cùng dây
 *   + dấu hoá ghi ra (`<accidental>`) không đổi và `alter` không đổi
 *   + nốt có danh tính nguồn
 *
 * Mọi thứ khác — đổi dây, dấu hoá thêm/bớt, đổi cách viết cao độ, lệnh khác,
 * danh tính không rõ, bản xem trước lạc nhịp — đều vẽ đầy đủ.
 *
 * Căn cứ đo được (spike 4D.P2, file mẫu + bài 237 KB): đổi phím cùng dây, dấu
 * hoá không đổi → 0 lệch bố cục, SVG và lớp phủ các trang khác giống từng byte.
 * Thêm/bớt dấu hoá → Verovio thêm/bớt một phần tử, id tự sinh dịch cả bài. Đổi dây
 * → có ca dấu luyến xê dịch. Renderer VẪN tự kiểm lại mọi chốt khi vẽ; phân loại
 * ở đây chỉ là điều kiện cần.
 */
import type { MusicXmlEditCommand } from "../edit/commands.ts";
import { readNoteFields } from "../edit/noteFields.ts";
import { locate, resolveSourcePath } from "../edit/xmlPatch.ts";
import { tagSourceIds } from "../../musicxml-beats/sourceTags.ts";

export type KeHoachXemTruoc =
  | { kind: "partial"; sourceId: string }
  | { kind: "full"; reason: string };

const full = (reason: string): KeHoachXemTruoc => ({ kind: "full", reason });

/** Khoảng byte mà hai chuỗi khác nhau: [đầu, cuốiCũ) trong `a`, [đầu, cuốiMới) trong `b`. */
function khoangKhac(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let dau = 0;
  while (dau < n && a.charCodeAt(dau) === b.charCodeAt(dau)) dau++;
  let duoi = 0;
  while (
    duoi < n - dau &&
    a.charCodeAt(a.length - 1 - duoi) === b.charCodeAt(b.length - 1 - duoi)
  )
    duoi++;
  return { dau, cuoiCu: a.length - duoi, cuoiMoi: b.length - duoi };
}

export function keHoachXemTruoc(
  cmd: MusicXmlEditCommand | null | undefined,
  xmlDangXem: string | null,
  xmlMoi: string
): KeHoachXemTruoc {
  if (!cmd || cmd.type !== "ChangeTabPosition") return full("NOT_TAB_POSITION");
  if (!xmlDangXem) return full("NO_PREVIEW");
  if (xmlDangXem === xmlMoi) return full("SAME_REVISION");
  const a = readNoteFields(xmlDangXem, cmd.path);
  const b = readNoteFields(xmlMoi, cmd.path);
  if (!a || !b || !a.khuongTab || !b.khuongTab || !a.tab || !b.tab || !a.pitch || !b.pitch)
    return full("NOT_A_TAB_NOTE");
  if (a.tab.string !== b.tab.string) return full("STRING_CHANGED");
  if (a.accidental !== b.accidental) return full("ACCIDENTAL_CHANGED");
  if (a.pitch.alter !== b.pitch.alter) return full("SPELLING_CHANGED");

  // Bản đang xem và bản mới chỉ được khác nhau BÊN TRONG đúng nốt này.
  let bien;
  try {
    const loc = locate(xmlMoi);
    const el = resolveSourcePath(loc.doc, cmd.path);
    if (!el) return full("TARGET_NOT_FOUND");
    bien = loc.range(el);
  } catch {
    return full("TARGET_NOT_FOUND");
  }
  const k = khoangKhac(xmlDangXem, xmlMoi);
  const lech = xmlMoi.length - xmlDangXem.length;
  if (k.dau < bien.start || k.cuoiMoi > bien.end || k.cuoiCu > bien.end - lech)
    return full("DIFF_OUTSIDE_NOTE");

  const sourceId = tagSourceIds(xmlMoi).notes.find((n) => n.path === cmd.path)?.svgId;
  if (!sourceId) return full("IDENTITY_UNRESOLVED");
  return { kind: "partial", sourceId };
}
