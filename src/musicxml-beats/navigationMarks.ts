import type { Element } from "@xmldom/xmldom";
import type { NavigationMark } from "./model.ts";

const children = (element: Element, name?: string): Element[] =>
  Array.from(element.childNodes).filter(
    (node): node is Element => node.nodeType === 1 && (!name || node.localName === name)
  );

function numbers(raw: string | null): number[] | null {
  if (!raw) return null;
  const result: number[] = [];
  for (const token of raw.split(",")) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(token);
    if (!match) return null;
    const first = Number(match[1]);
    const last = match[2] ? Number(match[2]) : first;
    if (!Number.isSafeInteger(first) || first < 1 || last < first || last > 32) return null;
    for (let value = first; value <= last; value++) if (!result.includes(value)) result.push(value);
  }
  return result.length ? result : null;
}

/** Read navigation while the canonical parser already owns the MusicXML DOM. */
export function readNavigationMarks(element: Element): NavigationMark[] {
  const marks: NavigationMark[] = [];
  if (element.localName === "barline") {
    const location = element.getAttribute("location") || "right";
    for (const repeat of children(element, "repeat")) {
      const direction = repeat.getAttribute("direction");
      if (direction === "forward" && location === "left") marks.push({ kind: "repeat-start" });
      else if (direction === "backward" && location === "right") {
        const rawTimes = repeat.getAttribute("times");
        const times = rawTimes === null ? null : Number(rawTimes);
        const afterJump = repeat.getAttribute("after-jump");
        if ((rawTimes !== null && (!/^\d+$/.test(rawTimes) || !Number.isSafeInteger(times) || times === null || times < 1)) ||
            (afterJump !== null && afterJump !== "yes" && afterJump !== "no")) {
          marks.push({ kind: "unsupported", reason: "repeat times/after-jump không hợp lệ" });
        } else marks.push({ kind: "repeat-end", times, afterJump: afterJump === "yes" });
      } else marks.push({ kind: "unsupported", reason: "repeat direction/location không hợp lệ" });
    }
    for (const ending of children(element, "ending")) {
      const values = numbers(ending.getAttribute("number"));
      const type = ending.getAttribute("type");
      if (!values || values.some((value) => value > 2) ||
          (type === "start" && location !== "left") ||
          ((type === "stop" || type === "discontinue") && location !== "right") ||
          !["start", "stop", "discontinue"].includes(type || "")) {
        marks.push({ kind: "unsupported", reason: "volta chỉ hỗ trợ ending 1/2 ở barline tương ứng" });
      } else marks.push({ kind: type === "start" ? "ending-start" : "ending-end", numbers: values });
    }
    if (element.hasAttribute("segno") || children(element, "segno").length) marks.push({ kind: "visual", mark: "segno" });
    if (element.hasAttribute("coda") || children(element, "coda").length) marks.push({ kind: "visual", mark: "coda" });
    return marks;
  }

  const sounds = element.localName === "sound" ? [element] :
    element.localName === "direction" ? children(element, "sound") : [];
  for (const sound of sounds) {
    const nonzeroOffset = (offset: Element) => Number((offset.textContent || "").trim()) !== 0;
    if (children(sound, "offset").some(nonzeroOffset) ||
        (element.localName === "direction" && children(element, "offset").some(nonzeroOffset))) {
      marks.push({ kind: "unsupported", reason: "Navigation giữa ô nhịp hoặc sound offset chưa được hỗ trợ" });
      continue;
    }
    const timeOnly = sound.hasAttribute("time-only") ? numbers(sound.getAttribute("time-only")) : null;
    if (sound.hasAttribute("time-only") && !timeOnly) {
      marks.push({ kind: "unsupported", reason: "sound time-only không hợp lệ" });
      continue;
    }
    if (sound.getAttribute("segno")) marks.push({ kind: "segno", label: sound.getAttribute("segno")! });
    if (sound.getAttribute("coda")) marks.push({ kind: "coda", label: sound.getAttribute("coda")! });
    if (sound.hasAttribute("forward-repeat")) {
      if (sound.getAttribute("forward-repeat") === "yes") marks.push({ kind: "repeat-start" });
      else marks.push({ kind: "unsupported", reason: "sound forward-repeat phải là yes" });
    }
    if (sound.hasAttribute("dacapo")) {
      if (sound.getAttribute("dacapo") === "yes") marks.push({ kind: "dc", timeOnly });
      else marks.push({ kind: "unsupported", reason: "sound dacapo phải là yes" });
    }
    if (sound.hasAttribute("dalsegno")) {
      const target = sound.getAttribute("dalsegno")!;
      marks.push(target ? { kind: "ds", target, timeOnly } : { kind: "unsupported", reason: "D.S. thiếu Segno target" });
    }
    if (sound.hasAttribute("tocoda")) {
      const target = sound.getAttribute("tocoda")!;
      marks.push(target ? { kind: "to-coda", target, timeOnly } : { kind: "unsupported", reason: "To Coda thiếu Coda target" });
    }
    if (sound.hasAttribute("fine")) marks.push({ kind: "fine", timeOnly });
  }
  if (element.localName === "direction") {
    const visual = children(element, "direction-type").flatMap((type) => children(type));
    for (const node of visual) {
      if (node.localName === "segno" || node.localName === "coda") marks.push({ kind: "visual", mark: node.localName });
      else if (node.localName === "words") {
        const words = node.textContent || "";
        if (/D\s*\.\s*C\s*\.?/i.test(words)) marks.push({ kind: "visual", mark: "dc" });
        else if (/D\s*\.\s*S\s*\.?/i.test(words)) marks.push({ kind: "visual", mark: "ds" });
        else if (/\b(?:To|al)\s+Coda\b/i.test(words)) marks.push({ kind: "visual", mark: "to-coda" });
        else if (/\bFine\b/i.test(words)) marks.push({ kind: "visual", mark: "fine" });
        else if (/\bCoda\b/i.test(words)) marks.push({ kind: "visual", mark: "coda" });
        if (/\bal\s+Fine\b/i.test(words)) marks.push({ kind: "expect-fine" });
        if (/\bal\s+Coda\b/i.test(words)) marks.push({ kind: "expect-coda" });
      }
    }
  }
  return marks;
}
