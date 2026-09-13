import type { Document, Element } from "@xmldom/xmldom";
import type {
  ChangeDuration,
  ChangeLyricText,
  ChangePitch,
  MusicXmlEditCommand,
  Pitch,
  RespellNote,
} from "./commands.ts";
import { STEPS } from "./commands.ts";
import { decideAccidental } from "./accidentals.ts";
import { coTheChum, durationFor, isNoteType } from "./durationModel.ts";
import { readNoteContext } from "./noteContext.ts";
import type { NoteContext } from "./noteContext.ts";
import { pitchName, soundingPitch } from "./pitchModel.ts";
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

/**
 * Thứ tự con của `<note>` theo chuẩn MusicXML. Chèn sai chỗ thì file vẫn "đọc
 * được" nhưng không còn đúng chuẩn — phần mềm khác mở ra sẽ bỏ qua hoặc báo lỗi.
 */
const NOTE_CHILD_ORDER = [
  "grace", "chord", "pitch", "unpitched", "rest", "cue", "duration", "tie",
  "instrument", "footnote", "level", "voice", "type", "dot", "accidental",
  "time-modification", "stem", "notehead", "notehead-text", "staff", "beam",
  "notations", "lyric", "play", "listen",
];

/** Chèn một nút con vào ĐÚNG vị trí chuẩn trong `<note>`. `value === null` → thẻ rỗng tự đóng. */
function insertNoteChild(ctx: Ctx, note: Element, name: string, value: string | null, count = 1) {
  const bac = NOTE_CHILD_ORDER.indexOf(name);
  const kids = elementChildren(note);
  const sau = kids.find((k) => {
    const i = NOTE_CHILD_ORDER.indexOf(k.localName ?? "");
    return i >= 0 && i > bac;
  });
  const moc = sau ?? kids[kids.length - 1];
  if (!moc) throw new EditError("EDIT_NOTE_EMPTY", "Nốt này không có nội dung.");
  const indent = ctx.located.indentOf(moc);
  const mot = value === null ? `<${name}/>` : `<${name}>${escapeXmlText(value)}</${name}>`;
  const markup = Array.from({ length: count }, () => mot).join(
    indent === null ? "" : `${ctx.located.eol}${indent}`
  );
  const at = sau ? ctx.located.range(moc).start : ctx.located.range(moc).end;
  ctx.patches.push({
    start: at,
    end: at,
    text: sau
      ? indent === null ? markup : `${markup}${ctx.located.eol}${indent}`
      : indent === null ? markup : `${ctx.located.eol}${indent}${markup}`,
  });
  // Phía DOM phải dựng ĐÚNG dãy mà phía chuỗi vừa viết ra, kể cả chỗ đặt khoảng
  // trắng: chèn trước một nút thì cách nằm SAU mỗi phần tử, còn nối vào cuối thì
  // cách nằm TRƯỚC. Lệch một chỗ là sổ kép báo ngay (EDIT_PATCH_MISMATCH).
  // Nối vào cuối = chèn ngay sau `moc`, KHÔNG phải cuối danh sách con: sau `moc`
  // thường còn một nút chữ xuống dòng trước `</note>`.
  const moc2 = sau ?? moc.nextSibling;
  const cach = indent === null ? null : `${ctx.located.eol}${indent}`;
  for (let i = 0; i < count; i++) {
    if (!sau && cach) note.insertBefore(ctx.doc.createTextNode(cach), moc2);
    const el = ctx.doc.createElement(name);
    if (value !== null) el.appendChild(ctx.doc.createTextNode(value));
    note.insertBefore(el, moc2);
    if (sau && cach) note.insertBefore(ctx.doc.createTextNode(cach), moc2);
  }
}

/** Ghi dấu hoá hiển thị: thêm, sửa, hoặc bỏ hẳn. `want === null` = không vẽ dấu nào. */
function setAccidental(ctx: Ctx, note: Element, want: string | null) {
  const hien = elementChildren(note, "accidental")[0];
  const cu = hien?.textContent?.trim() ?? null;
  if (cu === want) return;
  if (want === null) removeLeaf(ctx, hien!);
  else if (hien) patchLeafText(ctx, hien, want);
  else insertNoteChild(ctx, note, "accidental", want);
}

/**
 * Ghi cao độ + dấu hoá hiển thị đi kèm. Dùng chung cho "sửa cao độ" và "đổi cách
 * ghi": khác nhau ở Ý ĐỊNH (và ở phép kiểm giữ nguyên tiếng), không ở cách vá.
 */
function writePitch(
  ctx: Ctx,
  note: Element,
  cmd: ChangePitch | RespellNote,
  ngu: NoteContext
) {
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
  // Dấu hoá hiển thị luôn được quyết lại: `<accidental>` cũ để nguyên sau khi đổi
  // cao độ là vẽ ra dấu không đúng tiếng (đã đo trên Verovio).
  setAccidental(ctx, note, decideAccidental(cmd.pitch, ngu.fifths, ngu.written, cmd.accidental));
  if (ctx.patches.length) ctx.touched.push(`${cmd.path}/pitch`);
}

function changeDuration(ctx: Ctx, note: Element, cmd: ChangeDuration, ngu: NoteContext) {
  if (!isNoteType(cmd.noteType))
    throw new EditError("EDIT_DURATION_TYPE_INVALID", "Hình nốt không hợp lệ.");
  if (ngu.tuplet)
    throw new EditError(
      "EDIT_DURATION_TUPLET",
      "Trường độ này nằm trong chùm nghịch phách nên chưa hỗ trợ sửa trực tiếp."
    );
  if (ngu.chord !== "none")
    throw new EditError(
      "EDIT_DURATION_CHORD",
      "Các nốt trong một hợp âm phải cùng trường độ — chưa sửa trực tiếp ở bước này."
    );
  const rest = child(note, "rest");
  if (rest && rest.getAttribute("measure") === "yes")
    throw new EditError(
      "EDIT_DURATION_MEASURE_REST",
      "Đây là dấu lặng cả ô nhịp, trường độ đi theo ô — chưa sửa trực tiếp."
    );

  const typeEl = child(note, "type");
  if (textOf(typeEl) !== cmd.noteType) {
    if (typeEl) patchLeafText(ctx, typeEl, cmd.noteType);
    else insertNoteChild(ctx, note, "type", cmd.noteType);
  }
  if (ngu.dots !== cmd.dots) {
    for (const d of elementChildren(note, "dot")) removeLeaf(ctx, d);
    if (cmd.dots > 0) insertNoteChild(ctx, note, "dot", null, cmd.dots);
  }
  // Nốt hoa mỹ không có `<duration>` — đó là chuẩn, không phải thiếu sót.
  const durationEl = child(note, "duration");
  if (durationEl) {
    const moi = durationFor(cmd.noteType, cmd.dots, ngu.divisions);
    if (Number(textOf(durationEl)) !== moi) patchLeafText(ctx, durationEl, String(moi));
  } else if (!ngu.grace)
    throw new EditError("EDIT_DURATION_MISSING", "Nốt này không ghi trường độ trong nguồn.");
  // Dấu chùm chỉ tồn tại từ móc đơn trở xuống; giữ lại là ký âm sai.
  if (!coTheChum(cmd.noteType))
    for (const b of elementChildren(note, "beam")) removeLeaf(ctx, b);
  if (ctx.patches.length) ctx.touched.push(`${cmd.path}/duration`);
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
  const ngu = readNoteContext(located.doc, cmd.path);
  if (!ngu)
    throw new EditError("EDIT_CONTEXT_UNKNOWN", "Không đọc được ngữ cảnh của nốt này.");
  switch (cmd.type) {
    case "ChangePitch":
      writePitch(ctx, target, cmd, ngu);
      break;
    case "RespellNote":
      if (!ngu.pitch)
        throw new EditError("EDIT_NOTE_HAS_NO_PITCH", "Nốt này không có cao độ để đổi cách ghi.");
      if (soundingPitch(cmd.pitch) !== soundingPitch(ngu.pitch))
        throw new EditError(
          "EDIT_RESPELL_CHANGES_PITCH",
          `Đổi cách ghi phải giữ nguyên tiếng: ${pitchName(ngu.pitch)} không cùng tiếng với ${pitchName(cmd.pitch)}.`
        );
      writePitch(ctx, target, cmd, ngu);
      break;
    case "ChangeDuration":
      changeDuration(ctx, target, cmd, ngu);
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
