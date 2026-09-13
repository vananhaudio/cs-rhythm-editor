import type { Step } from "./commands.ts";
import { STEPS } from "./commands.ts";
import { harmonySymbol, isHarmonyKind, laKindMusicXml } from "./harmonyModel.ts";
import type { HarmonyRoot, HarmonyValue } from "./harmonyModel.ts";
import { elementChildren, parseStrict, resolveSourcePath } from "./xmlPatch.ts";
import type { Element } from "@xmldom/xmldom";

/**
 * Mọi thứ panel cần cho MỘT ký hiệu hợp âm, đọc từ đúng bản nháp đang hiện.
 * Chỉ đọc. Panel không tự dịch tên hợp âm — nó hỏi ở đây.
 */
export interface HarmonyFields {
  value: HarmonyValue;
  /** Thuộc tính `text` của `<kind>` — nếu nguồn có, bản nhạc vẽ theo nó. */
  kindText: string | null;
  /** Ký hiệu ĐANG hiện trên bản nhạc. */
  symbol: string;
  /** Vì sao chưa sửa được; `null` = sửa được. */
  duong: string | null;
  /** Loại hợp âm nguồn ghi mà công cụ chưa dựng lại được ký hiệu cho. */
  rawKind: string | null;
}

const child = (e: Element, name: string) => elementChildren(e, name)[0];
const textOf = (e: Element | undefined) => (e ? (e.textContent ?? "").trim() : "");

function readBac(container: Element | undefined, prefix: string): HarmonyRoot | null {
  if (!container) return null;
  const step = textOf(child(container, `${prefix}-step`));
  if (!STEPS.includes(step as Step)) return null;
  const alterText = textOf(child(container, `${prefix}-alter`));
  const alter = alterText ? Number(alterText) : 0;
  return { step: step as Step, alter: Number.isInteger(alter) ? alter : 0 };
}

export function readHarmonyFields(xml: string, path: string): HarmonyFields | null {
  let doc;
  try {
    doc = parseStrict(xml);
  } catch {
    return null;
  }
  const harmony = resolveSourcePath(doc, path);
  if (!harmony || harmony.localName !== "harmony") return null;

  const rootEl = child(harmony, "root");
  const root = readBac(rootEl, "root");
  const kindEl = child(harmony, "kind");
  const kind = textOf(kindEl);
  const bass = readBac(child(harmony, "bass"), "bass");
  const kindText = kindEl?.getAttribute("text") ?? null;

  // Mặc định an toàn khi nguồn ghi kiểu ta chưa dựng lại được: vẫn cho thầy nhìn
  // thấy ký hiệu thật, và ô chọn mở sẵn ở Trưởng — nhưng lệnh chỉ chạy khi thầy
  // thật sự bấm, nên không có chuyện lặng lẽ biến hợp âm lạ thành hợp âm trưởng.
  const value: HarmonyValue = {
    root: root ?? { step: "C", alter: 0 },
    kind: isHarmonyKind(kind) ? kind : "major",
    bass,
  };
  const duong = !rootEl
    ? "Hợp âm này ghi bằng bậc công năng (function/numeral) — chưa sửa được ở bước này."
    : !root
      ? "Bậc gốc trong nguồn không đọc được."
      : null;

  return {
    value,
    kindText,
    symbol: root
      ? harmonySymbol({ root, kind, bass }, kindText)
      : textOf(harmony) || "—",
    duong,
    rawKind: isHarmonyKind(kind) ? null : kind || (laKindMusicXml(kind) ? kind : "—"),
  };
}
