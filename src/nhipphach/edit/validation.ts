import { nhoTheoNguon } from "../../musicxml-beats/sourceCache.ts";
import { musicXMLToBeatMap } from "../../musicxml-beats/beatMap.ts";
import { parseMusicXML } from "../../musicxml-beats/parser.ts";
import { laKindMusicXml } from "./harmonyModel.ts";
import { EditError, elementChildren, parseStrict } from "./xmlPatch.ts";
import type { Document } from "@xmldom/xmldom";

/**
 * Cổng kiểm tra trước khi lưu — bốn tầng, hỏng tầng nào dừng ở tầng đó:
 *
 *   XML đọc được → cấu trúc MusicXML → chẩn đoán nhịp (Beat Engine) → khắc thử
 *
 * Tầng nhịp so với BẢN GỐC: bài vốn đã có ô thiếu/thừa phách thì vẫn được sửa
 * lời; chỉ lỗi nhịp MỚI do bản nháp gây ra mới chặn. Tầng khắc thử dùng chính
 * bộ khắc đang chạy (được tiêm vào), không có bộ khắc thứ hai.
 */
export type StageId = "wellFormed" | "structural" | "rhythm" | "render";

export interface StageResult {
  id: StageId;
  label: string;
  ok: boolean;
  /** Không chạy tới vì tầng trước đã hỏng. */
  skipped: boolean;
  messages: string[];
}

export interface ValidationReport {
  ok: boolean;
  stages: StageResult[];
}

export interface ValidationDeps {
  /** Khắc thử; ném lỗi là hỏng. Bắt buộc — không có bộ khắc thì không có "đã kiểm tra". */
  render: (xml: string) => Promise<unknown> | unknown;
}

const LABEL: Record<StageId, string> = {
  wellFormed: "File đọc được",
  structural: "Cấu trúc bản nhạc",
  rhythm: "Nhịp và phách",
  render: "Khắc thử bản nhạc",
};

const NHIP_VI: Record<string, string> = {
  OVERFULL_MEASURE: "thừa phách",
  UNDERFULL_MEASURE_UNCLASSIFIED: "thiếu phách",
  UNSUPPORTED_METER: "số chỉ nhịp chưa hỗ trợ",
  MISSING_OR_UNSUPPORTED_METER: "thiếu số chỉ nhịp",
  MID_MEASURE_METER_CHANGE: "đổi nhịp giữa ô",
  CHORD_DURATION_EXCEEDS_ANCHOR: "trường độ hợp âm không khớp",
  INVALID_GROUPING: "cách chia nhịp không hợp lệ",
  IRREGULAR_GROUPING_REQUIRED: "cần chọn cách chia nhịp lẻ",
};

const oNhip = (sourceId: string) => {
  const m = /measure\[(\d+)\]/.exec(sourceId);
  return m ? `Ô nhịp thứ ${m[1]}` : sourceId;
};

/** Các lỗi cấu trúc mà parser không nói rõ. Chỉ kiểm điều có thể kiểm chắc. */
export function structuralIssues(doc: Document): string[] {
  const issues: string[] = [];
  const root = doc.documentElement;
  if (!root || root.localName !== "score-partwise")
    return ["Không phải MusicXML dạng score-partwise."];
  const parts = elementChildren(root, "part");
  if (!parts.length) issues.push("Bản nhạc không có bè nào.");
  const partList = elementChildren(root, "part-list")[0];
  const declared = new Set(
    partList ? elementChildren(partList, "score-part").map((p) => p.getAttribute("id")) : []
  );
  parts.forEach((part, pi) => {
    const id = part.getAttribute("id");
    if (declared.size && !declared.has(id))
      issues.push(`Bè ${id ?? pi + 1} không có trong danh sách bè.`);
    const measures = elementChildren(part, "measure");
    if (!measures.length) issues.push(`Bè ${id ?? pi + 1} không có ô nhịp nào.`);
    measures.forEach((measure, mi) => {
      for (const note of elementChildren(measure, "note")) {
        const kinds = ["pitch", "rest", "unpitched"].filter((k) => elementChildren(note, k).length);
        const where = `Ô nhịp thứ ${mi + 1}, bè ${id ?? pi + 1}`;
        if (kinds.length !== 1) issues.push(`${where}: một nốt không rõ là nốt hay lặng.`);
        const pitch = elementChildren(note, "pitch")[0];
        if (pitch) {
          const step = elementChildren(pitch, "step")[0]?.textContent ?? "";
          const octave = elementChildren(pitch, "octave")[0]?.textContent ?? "";
          const alter = elementChildren(pitch, "alter")[0]?.textContent ?? undefined;
          if (!/^[A-G]$/.test(step)) issues.push(`${where}: bậc nốt "${step}" không hợp lệ.`);
          if (!/^\d$/.test(octave)) issues.push(`${where}: quãng tám "${octave}" không hợp lệ.`);
          if (alter !== undefined && !/^-?\d+(\.\d+)?$/.test(alter))
            issues.push(`${where}: dấu hoá "${alter}" không hợp lệ.`);
        }
        if (!elementChildren(note, "grace").length && !elementChildren(note, "duration").length)
          issues.push(`${where}: một nốt không có trường độ.`);
        for (const lyric of elementChildren(note, "lyric"))
          if (!elementChildren(lyric, "text").length && !elementChildren(lyric, "extend").length)
            issues.push(`${where}: một dòng lời không có chữ.`);
      }
      // Hợp âm: mỗi ký hiệu phải nói được nó là hợp âm gì, nếu không bản nhạc sẽ
      // in ra một chỗ trống mà không ai biết vì sao.
      for (const harmony of elementChildren(measure, "harmony")) {
        const where = `Ô nhịp thứ ${mi + 1}, bè ${id ?? pi + 1}`;
        const root = elementChildren(harmony, "root")[0];
        const congNang =
          elementChildren(harmony, "function")[0] ?? elementChildren(harmony, "numeral")[0];
        if (!root && !congNang) issues.push(`${where}: một hợp âm không có bậc gốc.`);
        if (root) {
          const step = elementChildren(root, "root-step")[0]?.textContent?.trim() ?? "";
          const alter = elementChildren(root, "root-alter")[0]?.textContent?.trim();
          if (!/^[A-G]$/.test(step)) issues.push(`${where}: bậc gốc “${step}” không hợp lệ.`);
          if (alter !== undefined && !/^-?\d+(\.\d+)?$/.test(alter))
            issues.push(`${where}: dấu hoá của bậc gốc “${alter}” không hợp lệ.`);
        }
        const bass = elementChildren(harmony, "bass")[0];
        if (bass) {
          const step = elementChildren(bass, "bass-step")[0]?.textContent?.trim() ?? "";
          if (!/^[A-G]$/.test(step)) issues.push(`${where}: bậc trầm “${step}” không hợp lệ.`);
        }
        const kind = elementChildren(harmony, "kind")[0]?.textContent?.trim();
        if (kind === undefined) issues.push(`${where}: một hợp âm không ghi loại.`);
        else if (!laKindMusicXml(kind))
          issues.push(`${where}: loại hợp âm “${kind}” không có trong chuẩn MusicXML.`);
      }
    });
  });
  return issues;
}

const boNhoNhip = nhoTheoNguon<ReadonlyMap<string, string>>();
/**
 * Tập chẩn đoán nhịp của một bản: "mã@ô" — để so bản nháp với bản gốc.
 * Tính MỘT lần cho mỗi chuỗi nguồn (4D.P); mỗi nơi gọi nhận bản sao của riêng mình.
 */
export function rhythmIssues(xml: string): Map<string, string> {
  return new Map(
    boNhoNhip.lay(xml, () => boNhoTheoNhip.lay(khoaNhip(xml), () => tinhRhythmIssues(xml)))
  );
}

/**
 * HÌNH CHIẾU NHỊP (4D.P5B): bản MusicXML với NỘI DUNG cao độ, dây/phím và dấu
 * hoá bị làm rỗng (thẻ vẫn giữ để sự có mặt của chúng không lẫn). Nhịp và phách
 * chỉ phụ thuộc trường độ, hình nốt, chấm, bè, ô nhịp, khoá nhịp — không phụ
 * thuộc cao độ hay thế bấm (đã soát: bộ tính phách không đọc `pitch`).
 *
 * Nên sửa phím TAB, đổi cao độ… cho CÙNG một hình chiếu → dùng lại lỗi nhịp đã
 * tính, không đọc lại cả bài. Đổi trường độ thì hình chiếu khác → tính lại.
 */
const LAM_RONG: readonly (readonly [mo: string, dong: string, thay: string])[] = [
  ["<pitch>", "</pitch>", "<pitch/>"],
  ["<technical>", "</technical>", "<technical/>"],
  ["<accidental", "</accidental>", "<accidental/>"],
];
/**
 * Chỉ dựng KHOÁ bộ đệm — không bao giờ ghi ra bản nhạc (việc sửa XML chỉ đi qua
 * vá theo vị trí ở `xmlPatch`). Quét tuần tự, cắt ghép từng đoạn.
 */
export function khoaNhip(xml: string): string {
  const timTu = (l: (typeof LAM_RONG)[number], tu: number) => {
    let k = xml.indexOf(l[0], tu);
    // `<accidental` không được khớp nhầm `<accidental-mark`.
    while (k >= 0 && l[0] === "<accidental") {
      const c = xml.charCodeAt(k + l[0].length);
      if (c === 62 || c === 32 || c === 47 || c === 9 || c === 10 || c === 13) break; // > dấu cách / tab xuống dòng
      k = xml.indexOf(l[0], k + 1);
    }
    return k;
  };
  const ke = LAM_RONG.map((l) => timTu(l, 0));
  const out: string[] = [];
  let i = 0;
  for (;;) {
    let chon = -1;
    for (let n = 0; n < ke.length; n++)
      if (ke[n] >= 0 && (chon < 0 || ke[n] < ke[chon])) chon = n;
    if (chon < 0) break;
    const luat = LAM_RONG[chon];
    const ket = xml.indexOf(luat[1], ke[chon]);
    if (ket < 0) break;
    out.push(xml.slice(i, ke[chon]), luat[2]);
    i = ket + luat[1].length;
    for (let n = 0; n < ke.length; n++) if (ke[n] >= 0 && ke[n] < i) ke[n] = timTu(LAM_RONG[n], i);
  }
  out.push(xml.slice(i));
  return out.join("");
}
const boNhoTheoNhip = nhoTheoNguon<ReadonlyMap<string, string>>();
function tinhRhythmIssues(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const map = musicXMLToBeatMap(xml);
  for (const m of map.measures)
    for (const d of m.diagnostics)
      out.set(`${d.code}@${d.sourceId}`, `${oNhip(d.sourceId)}: ${NHIP_VI[d.code] ?? "chưa đọc được nhịp"}.`);
  return out;
}

/** Những ô nhịp mà bản nháp MỚI làm hỏng — dùng cho cảnh báo trực tiếp lẫn cổng lưu. */
export function newRhythmIssues(original: string, draft: string): string[] {
  let cu: Map<string, string>;
  try {
    cu = rhythmIssues(original);
  } catch {
    cu = new Map();
  }
  try {
    return [...rhythmIssues(draft)].filter(([k]) => !cu.has(k)).map(([, msg]) => msg);
  } catch (e) {
    return [e instanceof Error ? e.message : "Không đọc được nhịp."];
  }
}

export async function validateDraft(
  original: string,
  draft: string,
  deps: ValidationDeps
): Promise<ValidationReport> {
  const stages: StageResult[] = (["wellFormed", "structural", "rhythm", "render"] as StageId[]).map(
    (id) => ({ id, label: LABEL[id], ok: false, skipped: true, messages: [] })
  );
  const stage = (id: StageId) => stages.find((s) => s.id === id)!;
  const fail = (id: StageId, messages: string[]) => {
    const s = stage(id);
    s.skipped = false;
    s.ok = false;
    s.messages = messages;
    return { ok: false, stages };
  };
  const pass = (id: StageId, messages: string[] = []) => {
    const s = stage(id);
    s.skipped = false;
    s.ok = true;
    s.messages = messages;
  };

  let doc: Document;
  try {
    doc = parseStrict(draft);
  } catch (e) {
    return fail("wellFormed", [e instanceof EditError ? e.message : "XML hỏng."]);
  }
  pass("wellFormed");

  const issues = structuralIssues(doc);
  if (!issues.length) {
    try {
      parseMusicXML(draft);
    } catch (e) {
      issues.push(e instanceof Error ? `Bộ đọc bản nhạc từ chối: ${e.message}` : "Bộ đọc bản nhạc từ chối.");
    }
  }
  if (issues.length) return fail("structural", issues);
  pass("structural");

  const phatSinh = newRhythmIssues(original, draft);
  if (phatSinh.length) return fail("rhythm", phatSinh);
  let moi: Map<string, string>;
  try {
    moi = rhythmIssues(draft);
  } catch {
    moi = new Map();
  }
  pass(
    "rhythm",
    [...moi].map(([, msg]) => `${msg} (đã có sẵn trong bản gốc)`)
  );

  try {
    await deps.render(draft);
  } catch (e) {
    return fail("render", [e instanceof Error ? e.message : "Không khắc được bản nháp."]);
  }
  pass("render");
  return { ok: true, stages };
}
