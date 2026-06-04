// ============================================================
// Song Builder V1 — Word ↔ Beat mapping (thuần, không UI)
// Nguồn sự thật: words[] + anchors[]. Mọi vị trí từ nội suy là
// DERIVED — tính lại bằng computeMapping mỗi khi anchors đổi.
//   beatIndex là canonical. tick = round(beatPosition * 480).
// ============================================================

import { beatToTick } from "./tempoFit";

export interface Word {
  index: number; // index duy nhất, kể cả từ lặp lại
  text: string;
  line: number;  // dòng trong lời (để xuống dòng khi render)
}

export interface Anchor {
  id: string;
  wordIndex: number;
  word: string;
  beatIndex: number; // canonical — đã snap về lưới
  tick: number;      // beatIndex * 480
  source: "anchor";
}

export type WordSource = "anchor" | "interpolated" | "unmapped";

export interface MappedWord {
  index: number;
  text: string;
  line: number;
  source: WordSource;
  beatPosition?: number; // beat lẻ (phân số) cho interpolated; nguyên cho anchor
  tick?: number;         // round(beatPosition * 480)
}

/** Tách lời thành từng từ; mỗi từ một index duy nhất. Giữ dòng để render xuống hàng. */
export function splitWords(text: string): Word[] {
  const words: Word[] = [];
  let index = 0;
  text.split(/\r?\n/).forEach((lineText, line) => {
    for (const token of lineText.split(/\s+/)) {
      if (!token) continue;
      words.push({ index: index++, text: token, line });
    }
  });
  return words;
}

/** Tạo một anchor từ wordIndex + beatIndex (đã snap về lưới). */
export function makeAnchor(wordIndex: number, word: string, beatIndex: number): Anchor {
  return {
    id: `anchor_${String(wordIndex).padStart(3, "0")}_b${beatIndex}`,
    wordIndex,
    word,
    beatIndex,
    tick: beatToTick(beatIndex),
    source: "anchor",
  };
}

/**
 * Nội suy tuyến tính word → beat. KHÔNG lưu kết quả — gọi lại mỗi khi anchors đổi.
 * - Từ trùng wordIndex của anchor   → "anchor".
 * - Giữa 2 anchor liền kề           → "interpolated" (beat lẻ hợp lệ).
 * - Ngoài [anchor đầu .. anchor cuối] → "unmapped" (CHỐT TẠM: chưa ngoại suy).
 */
export function computeMapping(words: Word[], anchors: Anchor[]): MappedWord[] {
  const sorted = [...anchors].sort((a, b) => a.wordIndex - b.wordIndex);
  const byWord = new Map<number, Anchor>();
  for (const a of sorted) byWord.set(a.wordIndex, a);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return words.map((w) => {
    const exact = byWord.get(w.index);
    if (exact) {
      return { index: w.index, text: w.text, line: w.line, source: "anchor", beatPosition: exact.beatIndex, tick: exact.tick };
    }
    // ngoài khoảng có anchor → unmapped (không ngoại suy ở đợt này)
    if (!first || !last || w.index < first.wordIndex || w.index > last.wordIndex) {
      return { index: w.index, text: w.text, line: w.line, source: "unmapped" };
    }
    // tìm anchor liền trước (A) & liền sau (B) bao quanh w.index
    let A = first, B = last;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].wordIndex <= w.index && w.index <= sorted[i + 1].wordIndex) {
        A = sorted[i]; B = sorted[i + 1]; break;
      }
    }
    const span = B.wordIndex - A.wordIndex;
    const ratio = span === 0 ? 0 : (w.index - A.wordIndex) / span;
    const beatPosition = A.beatIndex + ratio * (B.beatIndex - A.beatIndex);
    return { index: w.index, text: w.text, line: w.line, source: "interpolated", beatPosition, tick: beatToTick(beatPosition) };
  });
}
