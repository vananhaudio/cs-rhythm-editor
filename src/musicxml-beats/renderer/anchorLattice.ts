import {
  COMPOUND_COUNTING_MODES,
  COUNTING_LEVELS,
  createAnnotations,
} from "../annotations.ts";
import { add, compare, div, rational } from "../rational.ts";
import type { Rational } from "../rational.ts";
import type { BeatMapDocument } from "../beatMap.ts";
import type { Diagnostic } from "../model.ts";
import type { ScoreSettings } from "./types.ts";
import { all, direct, id, MEI, parse, serialize, XML } from "./xml.ts";

export function timestamp(value: Rational): string {
  const [numerator, d] = value.split("/").map(BigInt);
  let n = numerator;
  let residual = d;
  while (residual % 2n === 0n) residual /= 2n;
  while (residual % 5n === 0n) residual /= 5n;
  if (residual !== 1n) throw new Error("NON_TERMINATING_TIMESTAMP");
  const integer = n / d;
  n %= d;
  let tail = "";
  while (n) {
    n *= 10n;
    tail += String(n / d);
    n %= d;
  }
  return `${integer}${tail ? "." + tail : ""}`;
}

/** MEI tstamp đếm theo đơn vị mẫu số, KHÔNG phải nốt đen. */
export function stampOf(offset: Rational, beatType: number): string {
  return timestamp(add(div(offset, rational(4, beatType)), rational(1)));
}

export const anchorKey = (measureIndex: number, staff: string, stamp: string) =>
  `${measureIndex}|${staff}|${stamp}`;

export interface Lattice {
  mei: string;
  /** chỉ số ô → xml:id của <measure> trong MEI */
  measureIds: Map<number, string>;
  /** Ô nguồn đại diện cho mỗi measure MEI; multipart chỉ lấy part đầu. */
  sourceMeasureIds: Map<number, string>;
  /** khoá (ô, khuông, tstamp) → xml:id của neo rỗng trong MEI */
  byKey: Map<string, string>;
  staves: Map<number, string[]>;
  diagnostics: Diagnostic[];
  /** false khi bản nhạc không gắn số được; khi đó không có neo nào. */
  annotatable: boolean;
}

/**
 * Pass 1 — khắc nhạc nền.
 *
 * Chèn một LƯỚI NEO RỖNG: `<dir>` không có nội dung, đặt theo tstamp. Verovio vẫn
 * resolve toạ độ x cho chúng, nhưng vì không có chữ nào để tránh đè, nó KHÔNG nới
 * rộng ô nhịp. Lưới là hợp của mọi mức đếm nên MEI — và do đó toàn bộ layout —
 * giống hệt nhau dù thầy chọn Không hiện, Phách, Chia đôi hay Chia tư.
 */
export function applyAnchorLattice(
  mei: string,
  map: BeatMapDocument,
  settings: ScoreSettings
): Lattice {
  const doc = parse(mei),
    measures = all(doc, "measure");
  const diagnostics: Diagnostic[] = map.measures.flatMap((m) => m.diagnostics);
  const byKey = new Map<string, string>();
  const staves = new Map<number, string[]>();
  const measureIds = new Map<number, string>();
  const sourceMeasureIds = new Map<number, string>();
  const issue = (sourceId: string, code: string, message: string) =>
    diagnostics.push({ sourceId, code, message });

  const partIds = [...new Set(map.measures.map((m) => m.partId))];
  const reference = map.measures.filter((m) => m.partId === partIds[0]);
  const multipart = partIds.length > 1;
  const sameTimeline = partIds.every((partId) => {
    const part = map.measures.filter((m) => m.partId === partId);
    return part.length === reference.length && part.every((m, index) => {
      const first = reference[index];
      return m.measureNumber === first.measureNumber &&
        m.meter?.beats === first.meter?.beats &&
        m.meter?.beatType === first.meter?.beatType &&
        JSON.stringify(m.grouping ?? null) === JSON.stringify(first.grouping ?? null) &&
        compare(m.actualDuration, first.actualDuration) === 0 &&
        m.pickup === first.pickup &&
        compare(m.pickupOffset, first.pickupOffset) === 0 &&
        m.diagnostics.length === 0 &&
        JSON.stringify(m.beatsMap) === JSON.stringify(first.beatsMap);
    });
  });
  if (multipart && !sameTimeline) {
    issue("score", "MULTIPART_TIMELINE_MISMATCH", "Các part không cùng ranh giới ô nhịp/phách; giữ bản nhạc, bỏ số phách.");
    return { mei, measureIds, sourceMeasureIds, byKey, staves, diagnostics, annotatable: false };
  }
  // Verovio gộp các part vào cùng measure MEI; chỉ đối chiếu với part đại diện.
  if (measures.length !== reference.length) {
    issue(
      "score",
      "MEASURE_MAPPING_MISMATCH",
      "Không khớp ô nhịp giữa MusicXML và MEI; giữ bản nhạc, bỏ số phách."
    );
    return { mei, measureIds, sourceMeasureIds, byKey, staves, diagnostics, annotatable: false };
  }
  if (multipart && measures.some((m, i) => m.getAttribute("n") !== reference[i].measureNumber)) {
    issue("score", "MEASURE_MAPPING_MISMATCH", "Số ô trong MEI không khớp nguồn; giữ bản nhạc, bỏ số phách.");
    return { mei, measureIds, sourceMeasureIds, byKey, staves, diagnostics, annotatable: false };
  }

  for (const def of all(doc, "staffDef"))
    def.setAttribute("dir.dist", String(4 + settings.distance));

  let serial = 0;
  measures.forEach((m, mi) => {
    const bm = reference[mi];
    if (bm.diagnostics.length) return;
    if (m.getAttribute("n") !== bm.measureNumber) {
      issue(
        bm.measureId,
        "MEASURE_MAPPING_MISMATCH",
        "Số ô trong MEI không khớp nguồn."
      );
      return;
    }
    const staffElements = direct(m, "staff");
    if (!staffElements.length) {
      issue(
        bm.measureId,
        "TEMPORAL_ANCHOR_NOT_RESOLVED",
        "Không tìm thấy staff."
      );
      return;
    }
    const staffNumbers = staffElements.map((s) => s.getAttribute("n") || "1");
    // Một hàng phách đại diện cho timeline chung của các part; một part giữ
    // hành vi cũ (mọi staff) để không đổi bản khắc đã nghiệm thu.
    const annotatedStaves = multipart ? staffNumbers.slice(0, 1) : staffNumbers;
    staves.set(mi, annotatedStaves);
    measureIds.set(mi, id(m));
    sourceMeasureIds.set(mi, bm.measureId);
    if (!bm.meter) return;

    // Hợp của mọi mức đếm: lưới không phụ thuộc lựa chọn hiển thị.
    const stamps = new Set<string>();
    // HỢP của mọi mức đếm và cách đếm — lưới không biết thầy đang chọn mức nào.
    for (const level of COUNTING_LEVELS)
      for (const mode of COMPOUND_COUNTING_MODES)
        for (const a of createAnnotations(map, level, mode))
          if (a.sourceMeasureId === bm.measureId) {
            try {
              stamps.add(stampOf(a.offset, bm.meter.beatType));
            } catch {
              /* điểm không biểu diễn được sẽ được báo ở pass gắn nhãn */
            }
          }

    for (const staff of annotatedStaves)
      for (const stamp of [...stamps].sort((a, b) => Number(a) - Number(b))) {
        const anchorId = `tva-anchor-${++serial}`;
        const dir = doc.createElementNS(MEI, "dir");
        dir.setAttributeNS(XML, "xml:id", anchorId);
        dir.setAttribute("staff", staff);
        dir.setAttribute("tstamp", stamp);
        dir.setAttribute("place", "below");
        dir.setAttribute("vgrp", String(900 + Number(staff)));
        // CỐ Ý không có nội dung: có chữ là có bề rộng, có bề rộng là đụng engraving.
        m.appendChild(dir);
        byKey.set(anchorKey(mi, staff, stamp), anchorId);
      }
  });
  return { mei: serialize(doc), measureIds, sourceMeasureIds, byKey, staves, diagnostics, annotatable: true };
}
