import { musicXMLToBeatMap } from "../../musicxml-beats/beatMap.ts";
import { parseMusicXML } from "../../musicxml-beats/parser.ts";
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
          if (!elementChildren(lyric, "text").length)
            issues.push(`${where}: một dòng lời không có chữ.`);
      }
    });
  });
  return issues;
}

/** Tập chẩn đoán nhịp của một bản: "mã@ô" — để so bản nháp với bản gốc. */
export function rhythmIssues(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const map = musicXMLToBeatMap(xml);
  for (const m of map.measures)
    for (const d of m.diagnostics)
      out.set(`${d.code}@${d.sourceId}`, `${oNhip(d.sourceId)}: ${NHIP_VI[d.code] ?? "chưa đọc được nhịp"}.`);
  return out;
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

  let cu: Map<string, string>;
  try {
    cu = rhythmIssues(original);
  } catch {
    cu = new Map();
  }
  let moi: Map<string, string>;
  try {
    moi = rhythmIssues(draft);
  } catch (e) {
    return fail("rhythm", [e instanceof Error ? e.message : "Không đọc được nhịp."]);
  }
  const phatSinh = [...moi].filter(([k]) => !cu.has(k)).map(([, msg]) => msg);
  if (phatSinh.length) return fail("rhythm", phatSinh);
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
