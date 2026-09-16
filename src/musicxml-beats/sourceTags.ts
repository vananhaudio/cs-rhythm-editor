import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Element } from "@xmldom/xmldom";
import { nhoTheoNguon } from "./sourceCache.ts";

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

/**
 * Danh tính nguồn của MỘT dòng lời trên một nốt — Giai đoạn Nội dung 3C.
 *
 * ĐO ĐƯỢC (không suy đoán): Verovio KHÔNG giữ thuộc tính `id` của `<lyric>`; nó
 * sinh `xml:id` mới cho `<verse>`/`<syl>` trong MEI. Nhưng MEI đặt `<verse>` làm
 * CON của chính `<note>` đã mang id nguồn của ta, và giữ nguyên THỨ TỰ các
 * `<lyric>` của nốt đó. Vì vậy danh tính là (nốt nguồn, thứ tự dòng lời trong
 * nốt) — exact, không hình học.
 *
 * Khoá là THỨ TỰ chứ không phải thuộc tính `number`: đo được rằng hai `<lyric>`
 * không ghi `number` trên cùng một nốt đều ra `<verse n="1">`. Lấy `number` làm
 * khoá thì sửa dòng 2 sẽ đổi nhằm dòng 1 — đúng cái bẫy mà 3C phải chặn.
 */
export interface SourceLyric {
  /** id TIÊM VÀO MEI (không vào MusicXML — Verovio không giữ id của `<lyric>`). */
  svgId: string;
  /** Nốt mang dòng lời này. */
  notePath: string;
  noteSvgId: string;
  /** Thứ tự `<lyric>` trong nốt, 1-based. ĐÂY là khoá, không phải `number`. */
  lyricIndex: number;
  /** Thuộc tính `number` nguyên văn (rỗng khi nguồn không ghi) — chỉ để hiện. */
  number: string;
  /** Chữ hiện ra, nối cả `<elision>` — nguyên văn Unicode, không chuẩn hoá. */
  text: string;
  /** `single`/`begin`/`middle`/`end` của phần chữ đầu; null khi nguồn không ghi. */
  syllabic: string | null;
  /** Có `<extend>` (melisma) hay không — 3C giữ nguyên, không đụng tới. */
  extend: boolean;
  /** Nhiều phần chữ (elision) → chưa sửa trực tiếp được ở bước này. */
  compound: boolean;
  partIndex: number;
  measureIndex: number;
  measureNumber: string;
}

/**
 * Danh tính nguồn của MỘT ký hiệu hợp âm — Giai đoạn Nội dung 3C.
 *
 * `<harmony>` là con trực tiếp của `<measure>`, nên nó đã có sẵn đường dẫn cấu
 * trúc y như nốt (`/part[p]/measure[m]/*[c]`) — không cần khoá phụ.
 *
 * ĐO ĐƯỢC: MEI gom mọi part vào một `<measure>` và đặt các `<harm>` ở CUỐI ô,
 * theo đúng thứ tự tài liệu nguồn, part này nối tiếp part kia (đo cả với part
 * hai khuông và hai hợp âm cùng một `tstamp`). Nên dãy `<harm>` của một ô MEI
 * bằng đúng phép nối các `<harmony>` của từng part trong ô đó. Số lượng phải
 * khớp; lệch một cái là KHÔNG gán id nào cho ô ấy, báo rõ thay vì đoán.
 */
export interface SourceHarmony {
  /** id TIÊM VÀO MEI (Verovio không giữ id của `<harmony>`). */
  svgId: string;
  /** `/score-partwise/part[p]/measure[m]/*[c]` — như mọi lệnh biên tập khác. */
  path: string;
  partIndex: number;
  partId: string;
  measureIndex: number;
  measureNumber: string;
  childIndex: number;
  /** Thứ tự `<harmony>` trong ô của CHÍNH part này, 1-based. */
  harmonyIndex: number;
  /** `<root-step>`; null khi hợp âm ghi bằng `<function>`/`<numeral>` (chưa sửa được). */
  rootStep: string | null;
  rootAlter: number;
  /** Giá trị `<kind>` theo từ vựng MusicXML, ví dụ `dominant`, `half-diminished`. */
  kind: string;
  /** Thuộc tính `text` của `<kind>` — Verovio VẼ theo nó khi có. */
  kindText: string | null;
  bassStep: string | null;
  bassAlter: number;
}

export interface TaggedScore {
  xml: string;
  notes: SourceNote[];
  byId: Map<string, SourceNote>;
  /** Số ô nhịp nhiều nhất trong một part — để đối chiếu với số `<measure>` của MEI. */
  measureCount: number;
  lyrics: SourceLyric[];
  lyricById: Map<string, SourceLyric>;
  harmonies: SourceHarmony[];
  harmonyById: Map<string, SourceHarmony>;
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

export const lyricSvgId = (
  partIndex: number,
  measureIndex: number,
  childIndex: number,
  lyricIndex: number
) => `tva-lyr-p${partIndex}-m${measureIndex}-c${childIndex}-l${lyricIndex}`;

export const harmonySvgId = (
  partIndex: number,
  measureIndex: number,
  childIndex: number
) => `tva-harm-p${partIndex}-m${measureIndex}-c${childIndex}`;

export const sourcePath = (
  partIndex: number,
  measureIndex: number,
  childIndex: number
) => `/score-partwise/part[${partIndex}]/measure[${measureIndex}]/*[${childIndex}]`;

/** Ngược lại của lyricSvgId; null nếu không phải id lời. */
export function parseLyricSvgId(id: string) {
  const m = /^tva-lyr-p(\d+)-m(\d+)-c(\d+)-l(\d+)$/.exec(id);
  return m
    ? { partIndex: +m[1], measureIndex: +m[2], childIndex: +m[3], lyricIndex: +m[4] }
    : null;
}

/** Ngược lại của harmonySvgId; null nếu không phải id hợp âm. */
export function parseHarmonySvgId(id: string) {
  const m = /^tva-harm-p(\d+)-m(\d+)-c(\d+)$/.exec(id);
  return m ? { partIndex: +m[1], measureIndex: +m[2], childIndex: +m[3] } : null;
}

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
function tinhTagSourceIds(xml: string): TaggedScore {
  const notes: SourceNote[] = [];
  const byId = new Map<string, SourceNote>();
  const lyrics: SourceLyric[] = [];
  const lyricById = new Map<string, SourceLyric>();
  const harmonies: SourceHarmony[] = [];
  const harmonyById = new Map<string, SourceHarmony>();
  let measureCount = 0;
  const empty = () => ({
    notes,
    byId,
    measureCount,
    lyrics,
    lyricById,
    harmonies,
    harmonyById,
  });
  let doc: ReturnType<DOMParser["parseFromString"]>;
  try {
    doc = new DOMParser({ onError: () => undefined }).parseFromString(
      xml,
      "application/xml"
    );
  } catch {
    // Nguồn hỏng: trả nguyên văn, không nốt nào — Verovio sẽ tự báo lỗi đọc.
    return { xml, ...empty() };
  }
  const root = doc.documentElement;
  if (!root || root.localName !== "score-partwise") return { xml, ...empty() };

  children(root, "part").forEach((part, pi) => {
    const partIndex = pi + 1;
    const partId = part.getAttribute("id") || `P${partIndex}`;
    const partMeasures = children(part, "measure");
    if (partMeasures.length > measureCount) measureCount = partMeasures.length;
    partMeasures.forEach((measure, mi) => {
      const measureIndex = mi + 1;
      const measureNumber = measure.getAttribute("number") || String(measureIndex);
      let harmonyIndex = 0;
      children(measure).forEach((el, ci) => {
        const childIndex = ci + 1;
        if (el.localName === "harmony") {
          harmonyIndex++;
          const rootEl = first(el, "root");
          const bassEl = first(el, "bass");
          const kindEl = first(el, "kind");
          const harmony: SourceHarmony = {
            svgId: harmonySvgId(partIndex, measureIndex, childIndex),
            path: sourcePath(partIndex, measureIndex, childIndex),
            partIndex,
            partId,
            measureIndex,
            measureNumber,
            childIndex,
            harmonyIndex,
            rootStep: rootEl ? text(rootEl, "root-step") || null : null,
            rootAlter: rootEl ? Number(text(rootEl, "root-alter") || "0") : 0,
            kind: kindEl?.textContent?.trim() ?? "",
            kindText: kindEl?.getAttribute("text") ?? null,
            bassStep: bassEl ? text(bassEl, "bass-step") || null : null,
            bassAlter: bassEl ? Number(text(bassEl, "bass-alter") || "0") : 0,
          };
          harmonies.push(harmony);
          harmonyById.set(harmony.svgId, harmony);
          return;
        }
        if (el.localName !== "note") return;
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
        // Dòng lời: khoá là THỨ TỰ trong nốt. `number` chỉ để hiện cho người đọc.
        children(el, "lyric").forEach((ly, li) => {
          const parts = children(ly).filter(
            (x) => x.localName === "text" || x.localName === "elision"
          );
          const lyric: SourceLyric = {
            svgId: lyricSvgId(partIndex, measureIndex, childIndex, li + 1),
            notePath: note.path,
            noteSvgId: svgId,
            lyricIndex: li + 1,
            number: ly.getAttribute("number") || "",
            text: parts.map((x) => x.textContent ?? "").join(""),
            syllabic: text(ly, "syllabic") || null,
            extend: !!first(ly, "extend"),
            compound: children(ly, "text").length !== 1,
            partIndex,
            measureIndex,
            measureNumber,
          };
          lyrics.push(lyric);
          lyricById.set(lyric.svgId, lyric);
        });
      });
    });
  });
  return { xml: new XMLSerializer().serializeToString(doc), ...empty() };
}

/**
 * Cùng một chuỗi nguồn → cùng một kết quả, tính MỘT lần (4D.P). Kết quả dùng
 * chung nên bị ĐÓNG BĂNG: ai lỡ sửa một nốt trong danh sách là lỗi ngay, không
 * lặng lẽ làm bẩn lần đọc sau.
 */
const boNhoTag = nhoTheoNguon<TaggedScore>();
export function tagSourceIds(xml: string): TaggedScore {
  return boNhoTag.lay(xml, () => {
    const t = tinhTagSourceIds(xml);
    for (const ds of [t.notes, t.lyrics, t.harmonies]) {
      for (const x of ds) Object.freeze(x);
      Object.freeze(ds);
    }
    return Object.freeze(t);
  });
}
