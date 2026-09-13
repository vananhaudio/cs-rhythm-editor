import { XML, all, direct, id, parse, serialize } from "./xml.ts";
import { parseSourceSvgId } from "../sourceTags.ts";
import type { TaggedScore } from "../sourceTags.ts";
import type { Diagnostic } from "../model.ts";
import type { Element } from "@xmldom/xmldom";

/**
 * Tiêm danh tính nguồn cho LỜI và HỢP ÂM vào MEI — Giai đoạn Nội dung 3C.
 *
 * Nốt thì không cần bước này: Verovio giữ nguyên `id` của `<note>` MusicXML, nên
 * `sourceTags.ts` tiêm thẳng vào nguồn đưa cho Verovio. ĐO ĐƯỢC rằng `<lyric>` và
 * `<harmony>` KHÔNG được như vậy — Verovio bỏ `id` của chúng và sinh `xml:id`
 * mới. Nên danh tính phải gắn ở bản MEI, ngay trước lượt khắc, theo đúng hai
 * tương ứng cấu trúc đã đo:
 *
 *   `<verse>` là con của chính `<note>` mang id nguồn, GIỮ NGUYÊN THỨ TỰ các
 *   `<lyric>` của nốt ấy  ⇒  (nốt, thứ tự) là identity.
 *
 *   Dãy `<harm>` trong một `<measure>` MEI bằng đúng phép nối các `<harmony>`
 *   của từng part trong ô đó, part này tiếp part kia, mỗi part theo thứ tự tài
 *   liệu  ⇒  thứ tự là identity.
 *
 * Cả hai đều được KIỂM ĐẾM trước khi gán: số `<verse>` phải bằng số `<lyric>`,
 * số `<harm>` phải bằng số `<harmony>`. Lệch một cái thì KHÔNG gán id nào cho
 * chỗ đó và báo chẩn đoán — click vào sẽ nói "không xác định được", đúng như
 * `mRest` ở Nội dung 2. Không có "gần nhất", không có toạ độ.
 *
 * Module này KHÔNG sửa MusicXML nguồn: nó chỉ nhận và trả chuỗi MEI.
 */
export interface IdentityResult {
  mei: string;
  /** Lời/hợp âm nguồn không gắn được id — không bao giờ chọn đại. */
  unresolved: string[];
  diagnostics: Diagnostic[];
}

const setId = (el: Element, value: string) => el.setAttributeNS(XML, "xml:id", value);

export function applySourceIdentity(mei: string, tagged: TaggedScore): IdentityResult {
  const unresolved: string[] = [];
  const diagnostics: Diagnostic[] = [];
  if (!tagged.lyrics.length && !tagged.harmonies.length)
    return { mei, unresolved, diagnostics };

  let doc;
  try {
    doc = parse(mei);
  } catch {
    // MEI không đọc được là việc của lớp khắc; ở đây trả nguyên văn, không id nào.
    for (const l of tagged.lyrics) unresolved.push(l.svgId);
    for (const h of tagged.harmonies) unresolved.push(h.svgId);
    return { mei, unresolved, diagnostics };
  }

  const bo = (svgId: string, sourceId: string, message: string) => {
    unresolved.push(svgId);
    diagnostics.push({ sourceId, code: "SOURCE_IDENTITY_NOT_RESOLVED", message });
  };

  // ── Lời ────────────────────────────────────────────────────────────────
  // Nhóm theo nốt để so ĐẾM, không so từng cái một: thiếu hay thừa một dòng lời
  // đều làm cả nốt ấy mất danh tính, chứ không phải "lệch một bậc rồi gán tiếp".
  const theoNot = new Map<string, typeof tagged.lyrics>();
  for (const l of tagged.lyrics)
    theoNot.set(l.noteSvgId, [...(theoNot.get(l.noteSvgId) ?? []), l]);
  const daGap = new Set<string>();
  for (const el of all(doc, "*")) {
    const meiId = id(el);
    if (!meiId || !parseSourceSvgId(meiId)) continue;
    const nguon = theoNot.get(meiId);
    const verses = direct(el, "verse");
    if (!nguon) {
      // Nốt không có lời trong nguồn mà MEI lại có `<verse>`: không đoán chủ nào.
      if (verses.length)
        diagnostics.push({
          sourceId: meiId,
          code: "SOURCE_IDENTITY_NOT_RESOLVED",
          message: `Nốt ${meiId} có dòng lời trong bản khắc mà nguồn không ghi; không gắn danh tính.`,
        });
      continue;
    }
    daGap.add(meiId);
    if (verses.length !== nguon.length) {
      for (const l of nguon)
        bo(
          l.svgId,
          l.notePath,
          `Nốt ${meiId}: nguồn có ${nguon.length} dòng lời, bản khắc vẽ ${verses.length}; không gắn danh tính.`
        );
      continue;
    }
    nguon.forEach((l, i) => setId(verses[i], l.svgId));
  }
  for (const [noteSvgId, nguon] of theoNot)
    if (!daGap.has(noteSvgId))
      for (const l of nguon)
        bo(
          l.svgId,
          l.notePath,
          `Nốt ${noteSvgId} không có mặt trong bản khắc nên dòng lời của nó không chọn được.`
        );

  // ── Hợp âm ─────────────────────────────────────────────────────────────
  if (tagged.harmonies.length) {
    const meiMeasures = all(doc, "measure");
    const theoO = new Map<number, typeof tagged.harmonies>();
    for (const h of tagged.harmonies)
      theoO.set(h.measureIndex, [...(theoO.get(h.measureIndex) ?? []), h]);
    // Thứ tự nguồn: part theo thứ tự, trong part theo thứ tự tài liệu. Đúng thứ
    // tự Verovio xếp `<harm>` — đã đo, kể cả part hai khuông và hai hợp âm cùng
    // một `tstamp`.
    for (const list of theoO.values())
      list.sort((a, b) => a.partIndex - b.partIndex || a.harmonyIndex - b.harmonyIndex);

    const soOKhop = meiMeasures.length === tagged.measureCount;
    for (const [measureIndex, nguon] of theoO) {
      const mei = meiMeasures[measureIndex - 1];
      // Bằng chứng ô nhịp lấy từ CHÍNH id nốt bên trong: không tin vào vị trí suông.
      const chung = mei
        ? all(mei, "*")
            .map((e) => parseSourceSvgId(id(e))?.measureIndex)
            .filter((x): x is number => x !== undefined)
        : [];
      const hopLe = mei && (chung.length ? chung.every((x) => x === measureIndex) : soOKhop);
      const harms = mei ? direct(mei, "harm") : [];
      if (!hopLe || harms.length !== nguon.length) {
        for (const h of nguon)
          bo(
            h.svgId,
            h.path,
            !hopLe
              ? `Ô nhịp thứ ${measureIndex}: không khớp được ô nhịp trong bản khắc; hợp âm không chọn được.`
              : `Ô nhịp thứ ${measureIndex}: nguồn có ${nguon.length} hợp âm, bản khắc vẽ ${harms.length}; không gắn danh tính.`
          );
        continue;
      }
      nguon.forEach((h, i) => setId(harms[i], h.svgId));
    }
  }

  return { mei: serialize(doc), unresolved, diagnostics };
}
