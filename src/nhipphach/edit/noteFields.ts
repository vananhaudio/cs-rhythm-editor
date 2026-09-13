import type { Pitch } from "./commands.ts";
import { readNoteContext } from "./noteContext.ts";
import { decideAccidental } from "./accidentals.ts";
import type { AccidentalChoice } from "./accidentals.ts";
import { enharmonics, STEP_SEMITONE as STEP } from "./pitchModel.ts";
import { isNoteType } from "./durationModel.ts";
import type { NoteType } from "./durationModel.ts";
import { elementChildren, parseStrict, resolveSourcePath } from "./xmlPatch.ts";

/**
 * Mọi thứ panel biên tập cần cho MỘT nốt, đọc từ đúng bản nháp đang hiện.
 * Chỉ đọc; không đụng gì. Panel không tự suy luận nhạc lý — nó hỏi ở đây.
 */
export interface NoteLyric {
  /** Thứ tự `<lyric>` trong nốt, 1-based — ĐÂY là địa chỉ của lệnh sửa lời. */
  index: number;
  /** Thuộc tính `number` nguyên văn; rỗng khi nguồn không ghi. Chỉ để hiện. */
  number: string;
  text: string;
  /** `single`/`begin`/`middle`/`end`; null khi nguồn không ghi. Sửa chữ KHÔNG đụng nó. */
  syllabic: string | null;
  /** Có `<extend>` (ngân dài qua nhiều nốt). Sửa chữ KHÔNG đụng nó. */
  extend: boolean;
  /** Âm tiết ghép (nhiều phần chữ) — chưa sửa trực tiếp được. */
  compound: boolean;
}

export interface NoteFields {
  kind: "note" | "rest";
  pitch: Pitch | null;
  /** Dấu hoá đang được VẼ ra, nếu nguồn có ghi. */
  accidental: string | null;
  /**
   * Mỗi lựa chọn "Dấu hiển thị" sẽ dẫn tới dấu nào, cho CHÍNH cao độ hiện tại.
   * Có bảng này thì panel biết lúc nào lựa chọn ấy thật sự đổi được gì mà không
   * phải tự suy luận nhạc lý.
   */
  accidentalTarget: Record<AccidentalChoice, string | null>;
  noteType: NoteType | null;
  /** Hình nốt nguồn ghi mà công cụ chưa sửa được (chùm ba, hình quá nhỏ…). */
  rawNoteType: string | null;
  dots: number;
  grace: boolean;
  chord: "none" | "head" | "member";
  ties: string[];
  tab: { string: number; fret: number } | null;
  /** Thế bấm TAB có còn khớp cao độ không; `null` = bản nhạc không ghi cách lên dây. */
  tabKhop: boolean | null;
  /** Vì sao chưa sửa được trường độ; `null` = sửa được. */
  duongTruongDo: string | null;
  /** Các cách ghi khác cho cùng một tiếng (chỉ loại một dấu hoá). */
  respell: Pitch[];
  lyrics: NoteLyric[];
}

export function readNoteFields(xml: string, path: string): NoteFields | null {
  let doc;
  try {
    doc = parseStrict(xml);
  } catch {
    return null;
  }
  const note = resolveSourcePath(doc, path);
  if (!note || note.localName !== "note") return null;
  const ngu = readNoteContext(doc, path);
  if (!ngu) return null;

  const duongTruongDo =
    ngu.tuplet
      ? "Nốt này nằm trong chùm nghịch phách — trường độ chưa hỗ trợ sửa trực tiếp."
      : ngu.chord !== "none"
        ? "Các nốt trong một hợp âm phải cùng trường độ — chưa sửa trực tiếp ở bước này."
        : elementChildren(note, "rest")[0]?.getAttribute("measure") === "yes"
          ? "Đây là dấu lặng cả ô nhịp — trường độ đi theo ô."
          : !ngu.divisions
            ? "Bản nhạc không ghi rõ cách chia trường độ."
            : null;

  return {
    kind: ngu.kind,
    pitch: ngu.pitch,
    accidental: ngu.accidental,
    accidentalTarget: {
      auto: ngu.pitch ? decideAccidental(ngu.pitch, ngu.fifths, ngu.written, "auto") : null,
      hien: ngu.pitch ? decideAccidental(ngu.pitch, ngu.fifths, ngu.written, "hien") : null,
      an: null,
    },
    noteType: isNoteType(ngu.noteType) ? ngu.noteType : null,
    rawNoteType: ngu.noteType,
    dots: ngu.dots,
    grace: ngu.grace,
    chord: ngu.chord,
    ties: ngu.ties,
    tab: ngu.tab,
    tabKhop:
      ngu.tab && ngu.tabSounding !== null && ngu.pitch
        ? ngu.tabSounding === (ngu.pitch.octave + 1) * 12 + STEP[ngu.pitch.step] + ngu.pitch.alter
        : null,
    duongTruongDo,
    // Chỉ mời những cách ghi người ta thật sự dùng: một dấu hoá là cùng.
    // `enharmonics` vẫn trả về đủ, lệnh vẫn nhận dấu kép nếu thầy cần.
    respell: ngu.pitch ? enharmonics(ngu.pitch).filter((p) => Math.abs(p.alter) <= 1) : [],
    lyrics: elementChildren(note, "lyric").map((l, i) => {
      const texts = elementChildren(l, "text");
      return {
        index: i + 1,
        number: l.getAttribute("number") || "",
        // Âm tiết ghép hiện cả phần nối (<elision>) để thầy đọc được như trên bản nhạc.
        text: elementChildren(l)
          .filter((x) => x.localName === "text" || x.localName === "elision")
          .map((x) => x.textContent ?? "")
          .join(""),
        syllabic: elementChildren(l, "syllabic")[0]?.textContent?.trim() || null,
        extend: elementChildren(l, "extend").length > 0,
        compound: texts.length !== 1,
      };
    }),
  };
}
