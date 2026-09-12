/**
 * Đọc tên bài và tác giả từ chính MusicXML.
 *
 * Chỉ đọc những thẻ mà chuẩn MusicXML đã định nghĩa. KHÔNG đoán tên bài từ nội
 * dung, không nhờ AI, không suy từ tên part. Không có thì trả rỗng và để tên
 * file làm nhãn tạm — người dùng sửa lại được.
 */
import { DOMParser } from "@xmldom/xmldom";
import type { Document } from "@xmldom/xmldom";

export interface ScoreMetadata {
  title: string;
  composer: string | null;
  lyricist: string | null;
}

/**
 * Dùng chính bộ đọc XML mà renderer đang dùng (`@xmldom/xmldom`) thay vì
 * `DOMParser` của trình duyệt: cùng một hành vi ở trình duyệt, trong WKWebView
 * và trong test Node, nên thứ test chứng minh đúng là thứ người dùng chạy.
 */
const text = (doc: Document, tag: string): string => {
  const node = doc.getElementsByTagNameNS("*", tag)[0];
  return node?.textContent?.trim() ?? "";
};

/** Bỏ đuôi và gạch nối của tên file để làm nhãn tạm dễ đọc. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").split(/[\\/]/).pop() ?? "";
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Bản nhạc hỏng thì bỏ qua, không ném lỗi lên màn hình nạp file. */
function parseQuiet(xml: string): Document {
  return new DOMParser({ onError: () => undefined }).parseFromString(
    xml,
    "application/xml"
  );
}

function creator(doc: Document, type: string): string | null {
  for (const node of Array.from(doc.getElementsByTagNameNS("*", "creator"))) {
    if ((node.getAttribute("type") ?? "").toLowerCase() === type) {
      const value = node.textContent?.trim() ?? "";
      if (value) return value;
    }
  }
  return null;
}

/**
 * `filename` chỉ dùng khi bản nhạc không khai tên. Nó là nhãn hiển thị, không
 * bao giờ được ghi ngược vào MusicXML.
 */
export function readScoreMetadata(xml: string, filename = ""): ScoreMetadata {
  let doc: Document;
  try {
    doc = parseQuiet(xml);
  } catch {
    return { title: titleFromFilename(filename), composer: null, lyricist: null };
  }

  const title =
    text(doc, "work-title") ||
    text(doc, "movement-title") ||
    titleFromFilename(filename);
  return {
    title,
    composer: creator(doc, "composer"),
    lyricist: creator(doc, "lyricist") ?? creator(doc, "poet"),
  };
}

/** Nhịp đầu tiên của bản nhạc, chỉ để hiện trong danh sách ("4/4 · 3 phiên bản"). */
export function readPrimaryMeter(xml: string): string | null {
  try {
    const doc = parseQuiet(xml);
    const time = doc.getElementsByTagNameNS("*", "time")[0];
    const beats = time?.getElementsByTagNameNS("*", "beats")[0]?.textContent?.trim();
    const unit = time?.getElementsByTagNameNS("*", "beat-type")[0]?.textContent?.trim();
    return beats && unit ? `${beats}/${unit}` : null;
  } catch {
    return null;
  }
}
