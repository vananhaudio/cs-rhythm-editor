import type { NavigationMark, NormalizedScore } from "./model.ts";

export interface PlaybackOccurrence {
  /** Unique position in performed time; never use this as a written measure index. */
  playbackIndex: number;
  writtenMeasureIndex: number;
  writtenMeasureNumber: string;
  sourceMeasureIds: readonly string[];
}

export interface NavigationDiagnostic {
  code: string;
  message: string;
  writtenMeasureIndex: number | null;
}

export interface PlaybackSequence {
  status: "compiled" | "linear-fallback";
  occurrences: readonly PlaybackOccurrence[];
  diagnostics: readonly NavigationDiagnostic[];
  hasNavigation: boolean;
}

interface RepeatSection { start: number; end: number; times: number; afterJump: boolean }
interface EndingRange { start: number; end: number; numbers: readonly number[]; repeatEnd: number }

class NavigationFailure extends Error {
  readonly code: string;
  readonly index: number | null;
  constructor(code: string, message: string, index: number | null = null) {
    super(message);
    this.code = code;
    this.index = index;
  }
}

function fail(code: string, message: string, index: number | null = null): never {
  throw new NavigationFailure(code, message, index);
}

function single<T extends NavigationMark["kind"]>(marks: readonly NavigationMark[], kind: T, index: number): (NavigationMark & { kind: T }) | null {
  const found = marks.filter((mark) => mark.kind === kind);
  if (found.length > 1) fail("NAVIGATION_AMBIGUOUS", `Nhiều dấu ${kind} tại cùng ô nhịp.`, index);
  return (found[0] ?? null) as (NavigationMark & { kind: T }) | null;
}

function occurrence(score: NormalizedScore, writtenMeasureIndex: number, playbackIndex: number): PlaybackOccurrence {
  return {
    playbackIndex,
    writtenMeasureIndex,
    writtenMeasureNumber: score.parts[0].measures[writtenMeasureIndex].number,
    sourceMeasureIds: score.parts.map((part) => part.measures[writtenMeasureIndex].source.id),
  };
}

/** Compiles notated navigation once; the clock and transport can later read occurrences. */
export function compilePlaybackSequence(score: NormalizedScore, maxSteps = 10000): PlaybackSequence {
  const count = score.parts[0]?.measures.length ?? 0;
  const fallback = (diagnostic: NavigationDiagnostic): PlaybackSequence => ({
    status: "linear-fallback",
    occurrences: Array.from({ length: count }, (_, index) => occurrence(score, index, index)),
    diagnostics: [diagnostic],
    hasNavigation: true,
  });
  if (!count || score.parts.some((part) => part.measures.length !== count)) {
    return fallback({ code: "NAVIGATION_PARTS", message: "Các part không cùng số ô nhịp.", writtenMeasureIndex: null });
  }
  const marks: NavigationMark[][] = Array.from({ length: count }, () => []);
  for (const part of score.parts) for (const [index, measure] of part.measures.entries()) {
    for (const mark of measure.navigation ?? []) {
      if (!marks[index].some((existing) => JSON.stringify(existing) === JSON.stringify(mark))) marks[index].push(mark);
    }
  }
  const hasNavigation = marks.some((row) => row.length > 0);
  if (!hasNavigation) return {
    status: "compiled",
    occurrences: Array.from({ length: count }, (_, index) => occurrence(score, index, index)),
    diagnostics: [], hasNavigation: false,
  };

  try {
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) fail("NAVIGATION_LIMIT", "Giới hạn bước navigation không hợp lệ.");
    for (const [index, row] of marks.entries()) {
      const unsupported = row.find((mark) => mark.kind === "unsupported");
      if (unsupported?.kind === "unsupported") fail("NAVIGATION_UNSUPPORTED", unsupported.reason, index);
      for (const visual of row.filter((mark) => mark.kind === "visual")) {
        if (visual.kind !== "visual") continue;
        const hasSound = row.some((mark) => mark.kind === visual.mark);
        if (!hasSound) fail("NAVIGATION_UNSUPPORTED", `Dấu ${visual.mark} chỉ có hình/chữ, thiếu sound navigation.`, index);
      }
    }

    const sections: RepeatSection[] = [];
    const openRepeats: number[] = [];
    for (let index = 0; index < count; index++) {
      if (single(marks[index], "repeat-start", index)) openRepeats.push(index);
      const end = single(marks[index], "repeat-end", index);
      if (end) {
        const start = openRepeats.pop() ?? 0;
        if (start > index) fail("NAVIGATION_REPEAT", "Dấu lặp ngược nằm trước dấu mở.", index);
        sections.push({ start, end: index, times: end.times ?? 2, afterJump: end.afterJump });
      }
    }
    if (openRepeats.length) fail("NAVIGATION_REPEAT", "Dấu mở lặp thiếu dấu đóng.", openRepeats.at(-1)!);
    const byEnd = new Map(sections.map((section) => [section.end, section]));

    const endings: EndingRange[] = [];
    let openEnding: { start: number; numbers: readonly number[] } | null = null;
    for (let index = 0; index < count; index++) {
      const start = single(marks[index], "ending-start", index);
      if (start) {
        if (openEnding) fail("NAVIGATION_ENDING", "Hai volta chồng lên nhau.", index);
        openEnding = { start: index, numbers: start.numbers };
      }
      const end = single(marks[index], "ending-end", index);
      if (end) {
        if (!openEnding || JSON.stringify(openEnding.numbers) !== JSON.stringify(end.numbers)) {
          fail("NAVIGATION_ENDING", "Volta mở/đóng không khớp.", index);
        }
        endings.push({ ...openEnding, end: index, repeatEnd: -1 });
        openEnding = null;
      }
    }
    if (openEnding) fail("NAVIGATION_ENDING", "Volta chưa đóng.", openEnding.start);
    for (const section of sections) {
      const first = endings.find((range) => range.start <= section.end && section.end <= range.end && range.numbers.includes(1));
      if (!first) continue;
      if (section.times !== 2) fail("NAVIGATION_ENDING", "Volta 1/2 chỉ hỗ trợ hai lượt lặp.", section.end);
      first.repeatEnd = section.end;
      const second = endings.find((range) => range.start === first.end + 1 && range.numbers.includes(2));
      if (!second) fail("NAVIGATION_ENDING", "Volta 1 thiếu volta 2 ngay sau dấu lặp.", first.end);
      second.repeatEnd = section.end;
    }
    if (endings.some((range) => range.repeatEnd < 0)) {
      fail("NAVIGATION_ENDING", "Volta không gắn rõ với một cặp dấu lặp.");
    }

    const segnos = new Map<string, number>();
    const codas = new Map<string, number>();
    let jumpCount = 0;
    let fineCount = 0;
    let toCodaCount = 0;
    for (let index = 0; index < count; index++) {
      for (const mark of marks[index]) {
        if (mark.kind === "segno" || mark.kind === "coda") {
          const targets = mark.kind === "segno" ? segnos : codas;
          if (targets.has(mark.label)) fail("NAVIGATION_TARGET", `${mark.kind} trùng tên ${mark.label}.`, index);
          targets.set(mark.label, index);
        }
        if (mark.kind === "dc" || mark.kind === "ds") jumpCount++;
        if (mark.kind === "fine") fineCount++;
        if (mark.kind === "to-coda") toCodaCount++;
      }
    }
    if (jumpCount > 1 || fineCount > 1 || toCodaCount > 1 || (fineCount && toCodaCount)) {
      fail("NAVIGATION_AMBIGUOUS", "Nhiều lệnh nhảy/kết bài hoặc vừa Fine vừa To Coda.");
    }
    if (toCodaCount && !jumpCount) {
      fail("NAVIGATION_TARGET", "To Coda cần một lệnh D.C. hoặc D.S. rõ ràng.");
    }
    for (const [index, row] of marks.entries()) {
      if (row.some((mark) => mark.kind === "expect-fine") && !fineCount) {
        fail("NAVIGATION_TARGET", "Chỉ dẫn al Fine nhưng thiếu Fine.", index);
      }
      if (row.some((mark) => mark.kind === "expect-coda") && !toCodaCount) {
        fail("NAVIGATION_TARGET", "Chỉ dẫn al Coda nhưng thiếu To Coda.", index);
      }
    }
    for (let index = 0; index < count; index++) for (const mark of marks[index]) {
      if (mark.kind === "ds" && !segnos.has(mark.target)) fail("NAVIGATION_TARGET", `Thiếu Segno ${mark.target}.`, index);
      if (mark.kind === "to-coda" && (!codas.has(mark.target) || codas.get(mark.target)! <= index)) {
        fail("NAVIGATION_TARGET", `Thiếu Coda phía sau cho ${mark.target}.`, index);
      }
    }

    const occurrences: PlaybackOccurrence[] = [];
    const passes = new Map<number, number>();
    const visits = new Map<number, number>();
    let index = 0;
    let jumped = false;
    let usedCoda = false;
    let endedByFine = false;
    let lastPass = 1;
    for (let step = 0; index < count; step++) {
      if (step >= maxSteps) fail("NAVIGATION_LOOP_GUARD", "Playback order vượt giới hạn bước; có thể có vòng lặp vô hạn.", index);
      const ending = endings.find((range) => range.start === index);
      if (ending) {
        const pass = passes.get(ending.repeatEnd) ?? lastPass;
        if (!ending.numbers.includes(pass)) {
          index = ending.end + 1;
          continue;
        }
      }
      const row = marks[index];
      visits.set(index, (visits.get(index) ?? 0) + 1);
      const visit = visits.get(index)!;
      occurrences.push(occurrence(score, index, occurrences.length));
      const fine = single(row, "fine", index);
      if (fine && (fine.timeOnly ? fine.timeOnly.includes(visit) : jumped || !jumpCount)) {
        endedByFine = true;
        break;
      }
      const toCoda = single(row, "to-coda", index);
      if (toCoda && jumped && !usedCoda && (!toCoda.timeOnly || toCoda.timeOnly.includes(visit))) {
        usedCoda = true;
        index = codas.get(toCoda.target)!;
        continue;
      }
      const section = byEnd.get(index);
      if (section) {
        const pass = passes.get(index) ?? 1;
        if ((!jumped || section.afterJump) && pass < section.times) {
          passes.set(index, pass + 1);
          for (const inner of sections) if (inner !== section && inner.start >= section.start && inner.end < section.end) passes.delete(inner.end);
          index = section.start;
          continue;
        }
        lastPass = pass;
      }
      const dc = single(row, "dc", index);
      const ds = single(row, "ds", index);
      if (!jumped && ((dc && (dc.timeOnly ? dc.timeOnly.includes(visit) : !section || lastPass >= section.times)) ||
          (ds && (ds.timeOnly ? ds.timeOnly.includes(visit) : !section || lastPass >= section.times)))) {
        jumped = true;
        for (const repeat of sections) if (repeat.afterJump) passes.delete(repeat.end);
        index = dc ? 0 : segnos.get(ds!.target)!;
        continue;
      }
      index++;
    }
    if (fineCount && !endedByFine) fail("NAVIGATION_UNREACHED", "Không tới được Fine sau lệnh quay lại.");
    if (toCodaCount && !usedCoda) fail("NAVIGATION_UNREACHED", "Không tới được To Coda ở lượt cần nhảy.");
    return { status: "compiled", occurrences, diagnostics: [], hasNavigation };
  } catch (error) {
    if (!(error instanceof NavigationFailure)) throw error;
    return fallback({ code: error.code, message: error.message, writtenMeasureIndex: error.index });
  }
}
