import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Element } from "@xmldom/xmldom";

/**
 * Danh tính nguồn của một nốt/lặng — thuần CẤU TRÚC, không dính cao độ.
 *
 * Verovio giữ nguyên thuộc tính `id` của `<note>` MusicXML thành `xml:id` MEI và
 * thành `id` của `<g class="note">` trong SVG (đã đo trên hợp âm, grace, từng đoạn
 * dấu nối, bè 2, lặng, TAB). Nên chỉ cần tiêm một id sinh từ VỊ TRÍ trong tài
 * liệu là click vào SVG biết đích danh nốt nguồn — không cần hình học, không
 * "nốt gần nhất". Cao độ cố ý không tham gia vào id: mai sau chính cao độ là
 * thứ sẽ bị sửa.
 */
export interface SourceNote {
  /** id tiêm vào MusicXML và xuất hiện y nguyên trong SVG. NCName-an toàn. */
  svgId: string;
  /** Đường dẫn cấu trúc — trùng với `SourceIdentity.path` của parser. */
  path: string;
  /** `id` gốc nếu MusicXML tự có; chỉ để tham khảo, KHÔNG dùng làm khoá. */
  xmlId: string | null;
  partId: string;
  partIndex: number;
  measureIndex: number;
  measureNumber: string;
  /** Vị trí trong số MỌI con của <measure> (1-based), như parser đếm. */
  childIndex: number;
  kind: "note" | "rest";
  voice: string;
  staff: string;
  chord: boolean;
  grace: boolean;
  dots: number;
  noteType: string | null;
  pitch: { step: string; alter: number; octave: number } | null;
  /** `start`/`stop`/`continue` từ <tie> và <notations><tied>. */
  ties: string[];
  /** Chỉ khi nguồn thật sự ghi <technical><string>/<fret>. Không đoán. */
  tab: { string: number; fret: number } | null;
}

export interface TaggedScore {
  xml: string;
  notes: SourceNote[];
  byId: Map<string, SourceNote>;
}

const children = (e: Element, name?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!name || n.localName === name)
  );
const first = (e: Element, name: string) => children(e, name)[0];
const text = (e: Element, name: string) =>
  first(e, name)?.textContent?.trim() ?? "";

export const sourceSvgId = (
  partIndex: number,
  measureIndex: number,
  childIndex: number
) => `tva-src-p${partIndex}-m${measureIndex}-c${childIndex}`;

export const sourcePath = (
  partIndex: number,
  measureIndex: number,
  childIndex: number
) => `/score-partwise/part[${partIndex}]/measure[${measureIndex}]/*[${childIndex}]`;

/** Ngược lại của sourceSvgId; null nếu không phải id nguồn. */
export function parseSourceSvgId(id: string) {
  const m = /^tva-src-p(\d+)-m(\d+)-c(\d+)$/.exec(id);
  return m
    ? { partIndex: +m[1], measureIndex: +m[2], childIndex: +m[3] }
    : null;
}

/**
 * Gắn id nguồn vào mọi <note> (kể cả lặng). Chuỗi trả về là thứ đưa cho Verovio;
 * MusicXML gốc trong thư viện không bị đụng tới.
 */
export function tagSourceIds(xml: string): TaggedScore {
  const notes: SourceNote[] = [];
  const byId = new Map<string, SourceNote>();
  let doc: ReturnType<DOMParser["parseFromString"]>;
  try {
    doc = new DOMParser({ onError: () => undefined }).parseFromString(
      xml,
      "application/xml"
    );
  } catch {
    // Nguồn hỏng: trả nguyên văn, không nốt nào — Verovio sẽ tự báo lỗi đọc.
    return { xml, notes, byId };
  }
  const root = doc.documentElement;
  if (!root || root.localName !== "score-partwise")
    return { xml, notes, byId };

  children(root, "part").forEach((part, pi) => {
    const partIndex = pi + 1;
    const partId = part.getAttribute("id") || `P${partIndex}`;
    children(part, "measure").forEach((measure, mi) => {
      const measureIndex = mi + 1;
      const measureNumber = measure.getAttribute("number") || String(measureIndex);
      children(measure).forEach((el, ci) => {
        if (el.localName !== "note") return;
        const childIndex = ci + 1;
        const svgId = sourceSvgId(partIndex, measureIndex, childIndex);
        const pitch = first(el, "pitch");
        const technical = first(el, "notations")
          ? first(first(el, "notations")!, "technical")
          : undefined;
        const str = technical ? text(technical, "string") : "";
        const fret = technical ? text(technical, "fret") : "";
        const note: SourceNote = {
          svgId,
          path: sourcePath(partIndex, measureIndex, childIndex),
          xmlId: el.getAttribute("id") || null,
          partId,
          partIndex,
          measureIndex,
          measureNumber,
          childIndex,
          kind: first(el, "rest") ? "rest" : "note",
          voice: text(el, "voice") || "1",
          staff: text(el, "staff") || "1",
          chord: !!first(el, "chord"),
          grace: !!first(el, "grace"),
          dots: children(el, "dot").length,
          noteType: text(el, "type") || null,
          pitch: pitch
            ? {
                step: text(pitch, "step"),
                alter: Number(text(pitch, "alter") || "0"),
                octave: Number(text(pitch, "octave")),
              }
            : null,
          ties: [
            ...children(el, "tie").map((t) => t.getAttribute("type") || ""),
            ...children(el, "notations").flatMap((n) =>
              children(n, "tied").map((t) => t.getAttribute("type") || "")
            ),
          ],
          tab: /^\d+$/.test(str) && /^\d+$/.test(fret)
            ? { string: Number(str), fret: Number(fret) }
            : null,
        };
        // Luôn ghi đè: id của mình sinh từ vị trí, không thể trùng, không thể chứa
        // ký tự lạ. id gốc (nếu có) được giữ trong `xmlId` để tham khảo.
        el.setAttribute("id", svgId);
        notes.push(note);
        byId.set(svgId, note);
      });
    });
  });
  return { xml: new XMLSerializer().serializeToString(doc), notes, byId };
}
