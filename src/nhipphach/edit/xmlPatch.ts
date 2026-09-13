import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document, Element, Node } from "@xmldom/xmldom";

/**
 * Vá MusicXML ĐÚNG CHỖ, theo vị trí mà parser báo — không serialize lại cả tài liệu.
 *
 * Đã đo: xmldom serialize lại toàn bộ làm đổi vài chỗ vô nghĩa (`<x></x>` → `<x/>`,
 * khoảng trắng trong processing instruction, dòng trống cuối). Phiên bản vN+1 mà
 * lệch cả trăm dòng chỉ vì đổi một nốt thì lịch sử phiên bản vô dụng. Nên ở đây:
 * DOM (có locator dòng/cột) chỉ để TÌM nút và tính toạ độ; thay đổi được cắt-dán
 * thành từng mảnh nhỏ trên chuỗi gốc. Mọi byte khác giữ nguyên.
 *
 * Không có "tìm và thay" theo nội dung: vị trí luôn đi từ nút DOM đã resolve.
 */
export class EditError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EditError";
    this.code = code;
  }
}

export interface TextPatch {
  start: number;
  end: number;
  text: string;
}

interface Located {
  lineNumber?: number;
  columnNumber?: number;
}

export interface LeafRange {
  /** Vị trí `<` mở thẻ. */
  start: number;
  /** Ngay sau `>` đóng thẻ (hoặc sau `/>`). */
  end: number;
  /** Nội dung chữ bên trong; `null` khi thẻ tự đóng. */
  content: { start: number; end: number } | null;
  /** Thẻ mở nguyên văn, để giữ nguyên thuộc tính khi phải viết lại. */
  openTag: string;
}

export interface LocatedXml {
  readonly xml: string;
  readonly doc: Document;
  /** Kiểu xuống dòng của file — dòng chèn thêm phải giống hàng xóm, kể cả CRLF. */
  readonly eol: "\n" | "\r\n";
  offsetOf(node: Node): number;
  leafRange(el: Element): LeafRange;
  /** Khoảng trắng đầu dòng trước phần tử, hoặc `null` nếu phần tử không đứng đầu dòng. */
  indentOf(el: Element): string | null;
}

/** Đọc chặt: bất kỳ lỗi cú pháp nào cũng là lỗi — bản nháp không được mơ hồ. */
export function parseStrict(xml: string): Document {
  const errors: string[] = [];
  let doc: Document;
  try {
    doc = new DOMParser({
      locator: true,
      onError: (level, message) => {
        if (level !== "warning") errors.push(String(message).split("\n")[0]);
      },
    }).parseFromString(xml, "application/xml");
  } catch (e) {
    throw new EditError(
      "XML_NOT_WELL_FORMED",
      e instanceof Error ? e.message.split("\n")[0] : "XML hỏng"
    );
  }
  if (errors.length) throw new EditError("XML_NOT_WELL_FORMED", errors[0]);
  if (!doc.documentElement) throw new EditError("XML_NOT_WELL_FORMED", "Tài liệu rỗng");
  return doc;
}

export const serialize = (node: Node) => new XMLSerializer().serializeToString(node);

/** Dạng chuẩn để so hai tài liệu: cùng parser, cùng serializer. */
export const canonical = (xml: string) => serialize(parseStrict(xml));

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
export function escapeXmlText(text: string): string {
  let out = "";
  for (const ch of text) out += ESC[ch] ?? ch;
  return out;
}

export function locate(xml: string): LocatedXml {
  const doc = parseStrict(xml);
  const lineStarts = [0];
  for (let i = 0; i < xml.length; i++) if (xml.charCodeAt(i) === 10) lineStarts.push(i + 1);

  const offsetOf = (node: Node): number => {
    const { lineNumber, columnNumber } = node as unknown as Located;
    if (!lineNumber || !columnNumber)
      throw new EditError("XML_NO_LOCATOR", "Không xác định được vị trí nút trong file.");
    return lineStarts[lineNumber - 1] + columnNumber - 1;
  };

  const leafRange = (el: Element): LeafRange => {
    for (const child of Array.from(el.childNodes))
      if (child.nodeType !== 3)
        throw new EditError(
          "XML_LEAF_EXPECTED",
          `<${el.tagName}> không phải nút lá đơn giản.`
        );
    const start = offsetOf(el);
    if (xml[start] !== "<")
      throw new EditError("XML_NO_LOCATOR", `Vị trí <${el.tagName}> không khớp nội dung file.`);
    let i = start + 1;
    let quote: string | null = null;
    for (; i < xml.length; i++) {
      const c = xml[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
    }
    if (i >= xml.length) throw new EditError("XML_NOT_WELL_FORMED", "Thẻ mở không đóng.");
    const openTag = xml.slice(start, i + 1);
    if (xml[i - 1] === "/") return { start, end: i + 1, content: null, openTag };
    const contentStart = i + 1;
    const contentEnd = xml.indexOf("</", contentStart);
    if (contentEnd < 0) throw new EditError("XML_NOT_WELL_FORMED", "Thiếu thẻ đóng.");
    const close = xml.indexOf(">", contentEnd);
    if (close < 0 || xml.slice(contentEnd + 2, close).trim() !== el.tagName)
      throw new EditError("XML_NO_LOCATOR", `Thẻ đóng của <${el.tagName}> không ở chỗ mong đợi.`);
    return { start, end: close + 1, content: { start: contentStart, end: contentEnd }, openTag };
  };

  const indentOf = (el: Element): string | null => {
    const start = offsetOf(el);
    let i = start;
    while (i > 0 && (xml[i - 1] === " " || xml[i - 1] === "\t")) i--;
    if (i === 0 || xml[i - 1] !== "\n") return null;
    return xml.slice(i, start);
  };

  return { xml, doc, eol: xml.includes("\r\n") ? "\r\n" : "\n", offsetOf, leafRange, indentOf };
}

/** Cắt-dán các mảnh; mảnh không được chồng lên nhau. Áp từ cuối lên để vị trí không trôi. */
export function applyPatches(xml: string, patches: readonly TextPatch[]): string {
  const sorted = [...patches].sort((a, b) => b.start - a.start);
  let out = xml;
  let limit = Infinity;
  for (const p of sorted) {
    if (p.start > p.end || p.end > limit)
      throw new EditError("XML_PATCH_OVERLAP", "Hai chỗ sửa chồng lên nhau.");
    out = out.slice(0, p.start) + p.text + out.slice(p.end);
    limit = p.start;
  }
  return out;
}

export const SOURCE_PATH =
  /^\/score-partwise\/part\[(\d+)\]\/measure\[(\d+)\]\/\*\[(\d+)\]$/;

export const elementChildren = (e: Element | Document, name?: string): Element[] =>
  Array.from(e.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!name || (n as Element).localName === name)
  );

/**
 * Đường dẫn cấu trúc → phần tử. Đếm y hệt parser và `tagSourceIds`: part thứ i,
 * measure thứ j, con thứ k trong số MỌI con của measure. Không có bước tìm theo
 * nội dung nào.
 */
export function resolveSourcePath(doc: Document, path: string): Element | null {
  const m = SOURCE_PATH.exec(path);
  if (!m) return null;
  const root = doc.documentElement;
  if (!root || root.localName !== "score-partwise") return null;
  const part = elementChildren(root, "part")[+m[1] - 1];
  if (!part) return null;
  const measure = elementChildren(part, "measure")[+m[2] - 1];
  if (!measure) return null;
  return elementChildren(measure)[+m[3] - 1] ?? null;
}

/** Thẻ mở tự đóng → thẻ mở thường, giữ nguyên thuộc tính: `<text a="1"/>` → `<text a="1">`. */
export const openTagOf = (range: LeafRange) =>
  range.content ? range.openTag : range.openTag.slice(0, -2).trimEnd() + ">";
