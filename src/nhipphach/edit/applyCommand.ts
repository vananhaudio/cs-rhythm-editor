import type { Document, Element } from "@xmldom/xmldom";
import type {
  ChangeDuration,
  ChangeHarmony,
  ChangeLyricText,
  ChangePitch,
  MusicXmlEditCommand,
  Pitch,
  RespellNote,
} from "./commands.ts";
import type { HarmonyRoot } from "./harmonyModel.ts";
import { isHarmonyKind } from "./harmonyModel.ts";
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
  parseStrict,
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

/** Bỏ một phần tử cùng khoảng trắng đầu dòng của nó, để không để lại dòng trống. */
function removeLeaf(ctx: Ctx, el: Element) {
  const range = ctx.located.range(el);
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

/**
 * Thứ tự con của `<harmony>` theo chuẩn MusicXML: (root|numeral|function), kind,
 * inversion?, bass?, degree*, rồi frame/offset/footnote/level/staff.
 */
const HARMONY_CHILD_ORDER = [
  "root", "numeral", "function", "kind", "inversion", "bass", "degree",
  "frame", "offset", "footnote", "level", "staff",
];

/** Thứ tự con của `<root>`/`<bass>`: bậc rồi mới tới dấu hoá. */
const BAC_CHILD_ORDER = (prefix: string) => [
  `${prefix}-separator`, `${prefix}-step`, `${prefix}-alter`,
];

/** Chèn một nút con vào ĐÚNG vị trí chuẩn. `value === null` → thẻ rỗng tự đóng. */
function insertOrderedChild(
  ctx: Ctx,
  parent: Element,
  order: readonly string[],
  name: string,
  value: string | null,
  count = 1
) {
  const bac = order.indexOf(name);
  const kids = elementChildren(parent);
  const sau = kids.find((k) => {
    const i = order.indexOf(k.localName ?? "");
    return i >= 0 && i > bac;
  });
  const moc = sau ?? kids[kids.length - 1];
  if (!moc) throw new EditError("EDIT_NOTE_EMPTY", "Phần tử này không có nội dung.");
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
  // Phía DOM luôn dùng "\n": bộ đọc XML chuẩn hoá CRLF thành LF khi đọc lại, nên
  // nhét "\r\n" vào cây sẽ làm sổ kép lệch trên chính file CRLF (đã xảy ra thật).
  const cach = indent === null ? null : `\n${indent}`;
  for (let i = 0; i < count; i++) {
    if (!sau && cach) parent.insertBefore(ctx.doc.createTextNode(cach), moc2);
    const el = ctx.doc.createElement(name);
    if (value !== null) el.appendChild(ctx.doc.createTextNode(value));
    parent.insertBefore(el, moc2);
    if (sau && cach) parent.insertBefore(ctx.doc.createTextNode(cach), moc2);
  }
}

/** Như trên, nhưng chèn cả một khối có con (ví dụ `<bass>`), nguyên văn markup. */
function insertOrderedMarkup(
  ctx: Ctx,
  parent: Element,
  order: readonly string[],
  name: string,
  markup: string
) {
  const bac = order.indexOf(name);
  const kids = elementChildren(parent);
  const sau = kids.find((k) => {
    const i = order.indexOf(k.localName ?? "");
    return i >= 0 && i > bac;
  });
  const moc = sau ?? kids[kids.length - 1];
  if (!moc) throw new EditError("EDIT_NOTE_EMPTY", "Phần tử này không có nội dung.");
  const indent = ctx.located.indentOf(moc);
  const cach = indent === null ? null : `${ctx.located.eol}${indent}`;
  const at = sau ? ctx.located.range(moc).start : ctx.located.range(moc).end;
  ctx.patches.push({
    start: at,
    end: at,
    text: sau
      ? cach === null ? markup : `${markup}${cach}`
      : cach === null ? markup : `${cach}${markup}`,
  });
  // Như trên: cây DOM dùng "\n"; markup được đọc lại nên tự chuẩn hoá.
  const cachDom = indent === null ? null : `\n${indent}`;
  // Phía DOM dựng lại ĐÚNG chuỗi vừa viết bằng cách đọc chính chuỗi ấy: cây con
  // và mọi nút chữ xuống dòng bên trong khớp từng ký tự, nên sổ kép so được.
  const khoi = ctx.doc.importNode(parseStrict(markup).documentElement!, true);
  const moc2 = sau ?? moc.nextSibling;
  if (!sau && cachDom) parent.insertBefore(ctx.doc.createTextNode(cachDom), moc2);
  parent.insertBefore(khoi, moc2);
  if (sau && cachDom) parent.insertBefore(ctx.doc.createTextNode(cachDom), moc2);
}

/** Bỏ một thuộc tính khỏi thẻ mở, chỉ đụng đúng thẻ ấy. */
function dropAttribute(ctx: Ctx, el: Element, name: string) {
  if (!el.hasAttribute(name)) return;
  const range = ctx.located.range(el);
  const re = new RegExp(`\\s+${name}\\s*=\\s*("[^"]*"|'[^']*')`);
  if (!re.test(range.openTag))
    throw new EditError("EDIT_PATCH_MISMATCH", `Không đọc được thuộc tính ${name}.`);
  ctx.patches.push({
    start: range.start,
    end: range.openEnd,
    text: range.openTag.replace(re, ""),
  });
  el.removeAttribute(name);
}

/** Ghi dấu hoá hiển thị: thêm, sửa, hoặc bỏ hẳn. `want === null` = không vẽ dấu nào. */
function setAccidental(ctx: Ctx, note: Element, want: string | null) {
  const hien = elementChildren(note, "accidental")[0];
  const cu = hien?.textContent?.trim() ?? null;
  if (cu === want) return;
  if (want === null) removeLeaf(ctx, hien!);
  else if (hien) patchLeafText(ctx, hien, want);
  else insertOrderedChild(ctx, note, NOTE_CHILD_ORDER, "accidental", want);
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
    else insertOrderedChild(ctx, note, NOTE_CHILD_ORDER, "type", cmd.noteType);
  }
  if (ngu.dots !== cmd.dots) {
    for (const d of elementChildren(note, "dot")) removeLeaf(ctx, d);
    if (cmd.dots > 0) insertOrderedChild(ctx, note, NOTE_CHILD_ORDER, "dot", null, cmd.dots);
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
  // Địa chỉ là THỨ TỰ, không phải `number`: xem chú thích của lệnh.
  const lyric = elementChildren(note, "lyric")[cmd.lyricIndex - 1];
  if (!lyric || cmd.lyricIndex < 1)
    throw new EditError("EDIT_LYRIC_NOT_FOUND", "Nốt này không có dòng lời đó.");
  const texts = elementChildren(lyric, "text");
  if (texts.length !== 1)
    throw new EditError(
      "EDIT_LYRIC_COMPOUND",
      texts.length ? "Âm tiết ghép (nhiều phần chữ) chưa sửa được ở bước này." : "Dòng lời không có chữ."
    );
  if (textOf(texts[0]) === cmd.text) return;
  // CHỈ phần chữ đổi: `<syllabic>`, `<extend>`, thuộc tính của `<text>` và mọi
  // dòng lời khác của chính nốt này đều không bị đụng tới.
  patchLeafText(ctx, texts[0], cmd.text);
  ctx.touched.push(`${cmd.path}/lyric[${cmd.lyricIndex}]/text`);
}

/** Ghi `<root>`/`<bass>`: bậc, rồi dấu hoá (thêm/sửa/bỏ). Không đụng gì khác. */
function writeBac(ctx: Ctx, container: Element, prefix: string, value: HarmonyRoot) {
  const order = BAC_CHILD_ORDER(prefix);
  const stepEl = child(container, `${prefix}-step`);
  if (!stepEl)
    throw new EditError("EDIT_HARMONY_MALFORMED", `Hợp âm thiếu <${prefix}-step> trong nguồn.`);
  if (textOf(stepEl) !== value.step) patchLeafText(ctx, stepEl, value.step);
  const alterEl = child(container, `${prefix}-alter`);
  const alterCu = alterEl ? Number(textOf(alterEl) || "0") : 0;
  if (alterCu === value.alter) return;
  if (value.alter === 0 && alterEl) removeLeaf(ctx, alterEl);
  else if (alterEl) patchLeafText(ctx, alterEl, String(value.alter));
  else insertOrderedChild(ctx, container, order, `${prefix}-alter`, String(value.alter));
}

const bacHopLe = (r: HarmonyRoot) =>
  STEPS.includes(r.step) && Number.isInteger(r.alter) && r.alter >= -2 && r.alter <= 2;

function changeHarmony(ctx: Ctx, harmony: Element, cmd: ChangeHarmony) {
  const { root, kind, bass } = cmd.value;
  if (!bacHopLe(root) || (bass && !bacHopLe(bass)))
    throw new EditError("EDIT_HARMONY_ROOT_INVALID", "Bậc của hợp âm không hợp lệ.");
  if (!isHarmonyKind(kind))
    throw new EditError(
      "EDIT_HARMONY_KIND_UNSUPPORTED",
      `Loại hợp âm “${kind}” chưa hỗ trợ — bản nhạc sẽ không hiện đúng ký hiệu.`
    );
  const rootEl = child(harmony, "root");
  if (!rootEl)
    throw new EditError(
      "EDIT_HARMONY_NOT_ROOT_BASED",
      "Hợp âm này ghi bằng bậc công năng (function/numeral) — chưa sửa được ở bước này."
    );
  writeBac(ctx, rootEl, "root", root);

  const kindEl = child(harmony, "kind");
  const kindCu = kindEl ? textOf(kindEl).trim() : null;
  if (kindCu !== kind) {
    if (kindEl) {
      // Thuộc tính `text` là thứ bộ khắc VẼ RA. Giữ lại `text` cũ sau khi đổi loại
      // là để bản nhạc hiện một đằng, nội dung một nẻo — đúng cái bẫy `<accidental>`
      // ở 3B. Nên đổi loại thì bỏ `text`, để ký hiệu về đúng loại mới.
      dropAttribute(ctx, kindEl, "text");
      patchLeafText(ctx, kindEl, kind);
    } else insertOrderedChild(ctx, harmony, HARMONY_CHILD_ORDER, "kind", kind);
  }

  const bassEl = child(harmony, "bass");
  if (!bass && bassEl) removeLeaf(ctx, bassEl);
  else if (bass && bassEl) writeBac(ctx, bassEl, "bass", bass);
  else if (bass && !bassEl) {
    // Thụt lề của khối mới lấy từ chính `<root-step>` — con của một khối cùng bậc.
    const trong = ctx.located.indentOf(child(rootEl, "root-step")!);
    const ngoai = ctx.located.indentOf(rootEl);
    const eol = ctx.located.eol;
    const dong = (t: string) => (trong === null ? t : `${eol}${trong}${t}`);
    const markup =
      trong === null || ngoai === null
        ? `<bass><bass-step>${bass.step}</bass-step>${
            bass.alter ? `<bass-alter>${bass.alter}</bass-alter>` : ""
          }</bass>`
        : `<bass>${dong(`<bass-step>${bass.step}</bass-step>`)}${
            bass.alter ? dong(`<bass-alter>${bass.alter}</bass-alter>`) : ""
          }${eol}${ngoai}</bass>`;
    insertOrderedMarkup(ctx, harmony, HARMONY_CHILD_ORDER, "bass", markup);
  }
  if (ctx.patches.length) ctx.touched.push(`${cmd.path}/harmony`);
}

export function applyCommand(xml: string, cmd: MusicXmlEditCommand): AppliedCommand {
  const located = locate(xml);
  const target = resolveSourcePath(located.doc, cmd.path);
  if (!target)
    throw new EditError("EDIT_TARGET_NOT_FOUND", "Không tìm thấy nốt này trong bản nhạc.");
  const ctx: Ctx = { located, doc: located.doc, patches: [], touched: [] };
  if (cmd.type === "ChangeHarmony") {
    if (target.localName !== "harmony")
      throw new EditError(
        "EDIT_TARGET_NOT_HARMONY",
        "Phần tử được chọn không phải là ký hiệu hợp âm."
      );
    changeHarmony(ctx, target, cmd);
    return ketThuc(xml, located, ctx);
  }
  if (target.localName !== "note")
    throw new EditError("EDIT_TARGET_NOT_NOTE", "Phần tử được chọn không phải là nốt.");
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
  return ketThuc(xml, located, ctx);
}

/** Vá chuỗi rồi ĐỐI CHIẾU SỔ KÉP. Mọi lệnh đều đi qua đúng cửa này. */
function ketThuc(xml: string, located: LocatedXml, ctx: Ctx): AppliedCommand {
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
