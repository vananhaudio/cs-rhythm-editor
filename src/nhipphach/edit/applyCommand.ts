import type { Document, Element } from "@xmldom/xmldom";
import type { MusicXmlEditCommand, ChangePitch, ChangeLyricText, Pitch } from "./commands.ts";
import { STEPS } from "./commands.ts";
import {
  EditError,
  applyPatches,
  canonical,
  elementChildren,
  escapeXmlText,
  locate,
  openTagOf,
  resolveSourcePath,
  serialize,
} from "./xmlPatch.ts";
import type { LocatedXml, TextPatch } from "./xmlPatch.ts";

/**
 * Áp MỘT lệnh lên MusicXML → MusicXML mới. Thuần, không trạng thái, không I/O.
 *
 * Sổ kép: mỗi handler vừa tính các mảnh vá trên chuỗi, vừa làm y hệt thay đổi
 * đó trên DOM. Sau khi vá, chuỗi mới được đọc lại và so với DOM đã sửa; lệch
 * một ký tự là lệnh bị từ chối (`EDIT_PATCH_MISMATCH`) — không bao giờ để một
 * bản nháp mà máy vá không hiểu chính nó lọt tới bước lưu.
 */
export interface AppliedCommand {
  xml: string;
  /** Có gì thay đổi không; lệnh trùng trạng thái hiện tại là lệnh rỗng. */
  changed: boolean;
  /** Đường dẫn các nút đã đụng tới — để test diff và để panel nói thật. */
  touched: string[];
}

interface Ctx {
  located: LocatedXml;
  doc: Document;
  patches: TextPatch[];
  touched: string[];
}

const child = (e: Element, name: string) => elementChildren(e, name)[0];
const textOf = (e: Element | undefined) => (e ? e.textContent ?? "" : "");

function setText(doc: Document, el: Element, value: string) {
  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(doc.createTextNode(value));
}

/** Ghi chữ vào nút lá — mảnh vá chỉ phủ đúng phần nội dung của nút đó. */
function patchLeafText(ctx: Ctx, el: Element, value: string) {
  const range = ctx.located.leafRange(el);
  if (range.content)
    ctx.patches.push({ start: range.content.start, end: range.content.end, text: escapeXmlText(value) });
  else
    ctx.patches.push({
      start: range.start,
      end: range.end,
      text: `${openTagOf(range)}${escapeXmlText(value)}</${el.tagName}>`,
    });
  setText(ctx.doc, el, value);
}

/** Chèn một nút lá mới ngay sau `after`, thụt lề như hàng xóm nếu file có xuống dòng. */
function insertLeafAfter(ctx: Ctx, after: Element, name: string, value: string) {
  const range = ctx.located.leafRange(after);
  const indent = ctx.located.indentOf(after);
  const markup = `<${name}>${escapeXmlText(value)}</${name}>`;
  ctx.patches.push({
    start: range.end,
    end: range.end,
    text: indent === null ? markup : `${ctx.located.eol}${indent}${markup}`,
  });
  const el = ctx.doc.createElement(name);
  el.appendChild(ctx.doc.createTextNode(value));
  const parent = after.parentNode!;
  parent.insertBefore(el, after.nextSibling);
  if (indent !== null) parent.insertBefore(ctx.doc.createTextNode(`\n${indent}`), el);
}

/** Bỏ một nút lá cùng khoảng trắng đầu dòng của nó, để không để lại dòng trống. */
function removeLeaf(ctx: Ctx, el: Element) {
  const range = ctx.located.leafRange(el);
  let start = range.start;
  while (start > 0 && /[ \t]/.test(ctx.located.xml[start - 1])) start--;
  const prev = el.previousSibling;
  const anDauDong =
    start > 0 && ctx.located.xml[start - 1] === "\n" && prev?.nodeType === 3 && /^\s*$/.test(textOf(prev as Element));
  if (anDauDong) {
    start--;
    if (ctx.located.xml[start - 1] === "\r") start--;
  } else start = range.start;
  ctx.patches.push({ start, end: range.end, text: "" });
  const parent = el.parentNode!;
  if (anDauDong && prev) {
    // Chuỗi trước nút là "\n" + thụt lề của CHÍNH nút này; phần còn lại của nút
    // chữ (nếu có) vẫn giữ để DOM khớp đúng với chuỗi đã vá.
    const giu = textOf(prev as Element).replace(/\n[ \t]*$/, "");
    if (giu) (prev as unknown as { data: string }).data = giu;
    else parent.removeChild(prev);
  }
  parent.removeChild(el);
}

function validPitch(p: Pitch) {
  return (
    STEPS.includes(p.step) &&
    Number.isInteger(p.alter) &&
    p.alter >= -2 &&
    p.alter <= 2 &&
    Number.isInteger(p.octave) &&
    p.octave >= 0 &&
    p.octave <= 9
  );
}

function changePitch(ctx: Ctx, note: Element, cmd: ChangePitch) {
  if (!validPitch(cmd.pitch))
    throw new EditError("EDIT_PITCH_INVALID", "Cao độ không hợp lệ.");
  const pitch = child(note, "pitch");
  if (!pitch)
    throw new EditError(
      "EDIT_NOTE_HAS_NO_PITCH",
      child(note, "rest") ? "Dấu lặng không có cao độ." : "Nốt này không có cao độ để sửa."
    );
  const step = child(pitch, "step");
  const octave = child(pitch, "octave");
  if (!step || !octave)
    throw new EditError("EDIT_PITCH_MALFORMED", "Nốt thiếu bậc hoặc quãng tám trong nguồn.");
  const alter = child(pitch, "alter");
  const alterCu = alter ? Number(textOf(alter) || "0") : 0;

  if (textOf(step) !== cmd.pitch.step) patchLeafText(ctx, step, cmd.pitch.step);
  if (Number(textOf(octave)) !== cmd.pitch.octave)
    patchLeafText(ctx, octave, String(cmd.pitch.octave));
  if (alterCu !== cmd.pitch.alter) {
    if (cmd.pitch.alter === 0 && alter) removeLeaf(ctx, alter);
    else if (alter) patchLeafText(ctx, alter, String(cmd.pitch.alter));
    else insertLeafAfter(ctx, step, "alter", String(cmd.pitch.alter));
  }
  if (ctx.patches.length) ctx.touched.push(`${cmd.path}/pitch`);
}

function changeLyricText(ctx: Ctx, note: Element, cmd: ChangeLyricText) {
  if (cmd.text.trim() === "")
    throw new EditError("EDIT_LYRIC_EMPTY", "Lời không được để trống — xoá lời là một thao tác khác.");
  const lyric = elementChildren(note, "lyric").find(
    (l) => (l.getAttribute("number") || "1") === cmd.lyricNumber
  );
  if (!lyric)
    throw new EditError("EDIT_LYRIC_NOT_FOUND", "Nốt này không có dòng lời đó.");
  const texts = elementChildren(lyric, "text");
  if (texts.length !== 1)
    throw new EditError(
      "EDIT_LYRIC_COMPOUND",
      texts.length ? "Âm tiết ghép (nhiều phần chữ) chưa sửa được ở bước này." : "Dòng lời không có chữ."
    );
  if (textOf(texts[0]) === cmd.text) return;
  patchLeafText(ctx, texts[0], cmd.text);
  ctx.touched.push(`${cmd.path}/lyric[${cmd.lyricNumber}]/text`);
}

export function applyCommand(xml: string, cmd: MusicXmlEditCommand): AppliedCommand {
  const located = locate(xml);
  const target = resolveSourcePath(located.doc, cmd.path);
  if (!target)
    throw new EditError("EDIT_TARGET_NOT_FOUND", "Không tìm thấy nốt này trong bản nhạc.");
  if (target.localName !== "note")
    throw new EditError("EDIT_TARGET_NOT_NOTE", "Phần tử được chọn không phải là nốt.");
  const ctx: Ctx = { located, doc: located.doc, patches: [], touched: [] };
  switch (cmd.type) {
    case "ChangePitch":
      changePitch(ctx, target, cmd);
      break;
    case "ChangeLyricText":
      changeLyricText(ctx, target, cmd);
      break;
    default: {
      const never: never = cmd;
      throw new EditError("EDIT_UNKNOWN_COMMAND", `Lệnh lạ: ${JSON.stringify(never)}`);
    }
  }
  if (!ctx.patches.length) return { xml, changed: false, touched: [] };
  const patched = applyPatches(xml, ctx.patches);
  // Sổ kép: chuỗi đã vá phải đọc ra đúng DOM đã sửa. Không khớp là không dùng.
  let doc2: string;
  try {
    doc2 = canonical(patched);
  } catch (e) {
    throw new EditError(
      "EDIT_PATCH_MISMATCH",
      `Chỗ vá làm hỏng file: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (doc2 !== serialize(located.doc))
    throw new EditError("EDIT_PATCH_MISMATCH", "Chỗ vá không khớp với thay đổi dự kiến.");
  return { xml: patched, changed: true, touched: ctx.touched };
}
