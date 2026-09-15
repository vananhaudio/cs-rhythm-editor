import type { Document, Element } from "@xmldom/xmldom";
import type {
  ChangeDuration,
  ChangeDurationAndRebalance,
  ChangeHarmony,
  ChangeLyricText,
  ChangePitch,
  MakeRest,
  MusicXmlEditCommand,
  Pitch,
  ReplaceRestWithNote,
  RespellNote,
} from "./commands.ts";
import type { HarmonyRoot } from "./harmonyModel.ts";
import { isHarmonyKind } from "./harmonyModel.ts";
import { STEPS } from "./commands.ts";
import { decideAccidental } from "./accidentals.ts";
import { coTheChum, durationFor, isNoteType, NOTE_TYPES } from "./durationModel.ts";
import { lapKhoangTrong, quartersOf, RestFillError } from "./restFill.ts";
import { musicXMLToBeatMap } from "../../musicxml-beats/beatMap.ts";
import { parseMusicXML } from "../../musicxml-beats/parser.ts";
import { ZERO, add, compare, rational, sub } from "../../musicxml-beats/rational.ts";
import type { Rational } from "../../musicxml-beats/rational.ts";
import type { StructuralDelta } from "./draftIdentity.ts";
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
  SOURCE_PATH,
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
  /**
   * Lệnh này làm đổi SỐ con của ô nhịp ở đâu, bao nhiêu — Giai đoạn 4B.2.
   * Rỗng với mọi lệnh chỉ sửa tại chỗ. `draftIdentity.ts` cộng dồn cái này để
   * con trỏ và vùng chọn không trỏ nhầm sang sự kiện khác sau khi chèn/bỏ.
   */
  structural: StructuralDelta[];
}

interface Ctx {
  located: LocatedXml;
  doc: Document;
  patches: TextPatch[];
  touched: string[];
  structural: StructuralDelta[];
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

/**
 * Những con của `<note>` chỉ có nghĩa khi nốt CÓ CAO ĐỘ. Giữ lại trên một dấu
 * lặng là ghi ra file nói dối: `<accidental>` vẽ dấu thăng cạnh dấu lặng,
 * `<notehead>` tả hình đầu nốt không tồn tại, `<stem>` tả đuôi không tồn tại.
 *
 * `<stem>` nằm trong danh sách này là một quyết định có chủ ý, rộng hơn bốn thứ
 * spec liệt kê: chuẩn cho phép `<stem>` trên mọi `<note>`, nhưng không phần mềm
 * nào ghi đuôi cho dấu lặng, và để lại thì bộ khắc có thể vẽ ra một cái đuôi cụt.
 */
const CON_CHI_CUA_NOT_CO_CAO_DO = ["pitch", "unpitched", "accidental", "notehead", "notehead-text", "stem"];

/** `<technical>` tả thế bấm trên dây — không còn nghĩa gì khi không còn tiếng nào. */
function boTechnical(ctx: Ctx, note: Element) {
  for (const notations of elementChildren(note, "notations")) {
    const con = elementChildren(notations);
    const tech = con.filter((c) => c.localName === "technical");
    if (!tech.length) continue;
    // Bỏ cả `<notations>` khi trong đó CHỈ có technical — chuẩn đòi `<notations>`
    // phải có ít nhất một con. Một mảnh vá phủ trọn khối, KHÔNG vá lồng vào
    // nhau: vá `<technical>` rồi vá tiếp `<notations>` bao ngoài là hai vùng
    // chồng lên nhau, và `applyPatches` từ chối đúng như nó phải thế.
    if (tech.length === con.length) removeLeaf(ctx, notations);
    else for (const t of tech) removeLeaf(ctx, t);
  }
}

/**
 * Nốt → lặng. Không đụng `<duration>`, `<type>`, `<dot>`, `<voice>`, `<staff>`,
 * `<time-modification>`, `<beam>`, `<lyric>` — và tuyệt đối không đụng nốt nào
 * khác, kể cả nốt đối ứng trên khuông TAB: Nội dung 2 đã chứng minh chúng là hai
 * nốt nguồn riêng biệt, tự ý sửa nốt thứ hai là sửa thứ thầy không hề chọn.
 */
function makeRest(ctx: Ctx, note: Element, cmd: MakeRest, ngu: NoteContext) {
  if (ngu.kind === "rest") return; // đã là lặng rồi: lệnh rỗng, không phải lỗi
  if (ngu.chord !== "none")
    throw new EditError(
      "EDIT_MAKE_REST_CHORD",
      ngu.chord === "member"
        ? "Chưa hỗ trợ xoá riêng một nốt trong hợp âm."
        : "Đây là nốt gốc của một hợp âm — xoá nó sẽ bỏ rơi các nốt còn lại. Chưa hỗ trợ."
    );
  if (ngu.ties.length)
    throw new EditError(
      "EDIT_MAKE_REST_TIED",
      "Nốt này nằm trong một dấu nối — xoá nó sẽ để dấu nối treo lơ lửng. Chưa hỗ trợ."
    );
  if (ngu.grace)
    throw new EditError(
      "EDIT_MAKE_REST_GRACE",
      "Nốt hoa mỹ không có trường độ riêng nên không có dấu lặng tương ứng."
    );
  for (const ten of CON_CHI_CUA_NOT_CO_CAO_DO)
    for (const el of elementChildren(note, ten)) removeLeaf(ctx, el);
  boTechnical(ctx, note);
  // `<rest/>` đứng đúng chỗ `<pitch>` vừa rời đi, theo thứ tự con của chuẩn.
  insertOrderedChild(ctx, note, NOTE_CHILD_ORDER, "rest", null);
  ctx.touched.push(`${cmd.path}/rest`);
}

/** Lặng → nốt. Đối xứng với `makeRest`; cũng không thêm bớt con nào của ô nhịp. */
function replaceRestWithNote(
  ctx: Ctx,
  note: Element,
  cmd: ReplaceRestWithNote,
  ngu: NoteContext
) {
  if (!validPitch(cmd.pitch))
    throw new EditError("EDIT_PITCH_INVALID", "Cao độ không hợp lệ.");
  const rest = child(note, "rest");
  if (!rest)
    throw new EditError("EDIT_NOT_A_REST", "Chỗ này đã là một nốt có cao độ rồi.");
  if (rest.getAttribute("measure") === "yes")
    throw new EditError(
      "EDIT_REST_WHOLE_MEASURE",
      "Đây là dấu lặng cả ô nhịp — biến nó thành nốt phải viết lại trường độ của cả ô, chưa hỗ trợ ở bước này."
    );
  if (!child(note, "duration"))
    throw new EditError("EDIT_REST_NO_DURATION", "Dấu lặng này không ghi trường độ trong nguồn.");
  removeLeaf(ctx, rest);
  const { step, alter, octave } = cmd.pitch;
  const trong = ctx.located.indentOf(child(note, "duration")!);
  const eol = ctx.located.eol;
  const dong = (t: string) => (trong === null ? t : `${eol}${trong}  ${t}`);
  const markup =
    trong === null
      ? `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`
      : `<pitch>${dong(`<step>${step}</step>`)}${
          alter ? dong(`<alter>${alter}</alter>`) : ""
        }${dong(`<octave>${octave}</octave>`)}${eol}${trong}</pitch>`;
  insertOrderedMarkup(ctx, note, NOTE_CHILD_ORDER, "pitch", markup);
  // Dấu hoá hiển thị đi qua ĐÚNG luật ký âm của 3B — không có bộ luật thứ hai.
  setAccidental(ctx, note, decideAccidental(cmd.pitch, ngu.fifths, ngu.written, cmd.accidental));
  ctx.touched.push(`${cmd.path}/pitch`);
}

// ══ 4B.2: đổi trường độ + cân lại ô nhịp ══════════════════════════════════

/** Phần tử không chiếm thời gian — đứng xen giữa nốt và lặng thì bỏ qua được. */
const KHONG_CHIEM_THOI_GIAN = new Set(["harmony", "direction", "print", "barline", "sound", "bookmark", "link"]);

/** Chèn nguyên một `<note>` mới làm EM của `sau`, cùng thụt lề. */
function insertNoteSauKhi(ctx: Ctx, sau: Element, markups: readonly string[]) {
  if (!markups.length) return;
  const range = ctx.located.range(sau);
  const indent = ctx.located.indentOf(sau);
  const cach = indent === null ? "" : `${ctx.located.eol}${indent}`;
  ctx.patches.push({
    start: range.end,
    end: range.end,
    text: markups.map((m) => `${cach}${m}`).join(""),
  });
  // Phía DOM dựng lại ĐÚNG chuỗi ấy bằng cách đọc chính nó, nên sổ kép so được.
  // Luôn dùng "\n": bộ đọc chuẩn hoá CRLF khi đọc lại (đã vấp ở 3C).
  const cachDom = indent === null ? null : `\n${indent}`;
  let moc = sau.nextSibling;
  const parent = sau.parentNode!;
  for (const m of markups) {
    if (cachDom) parent.insertBefore(ctx.doc.createTextNode(cachDom), moc);
    parent.insertBefore(ctx.doc.importNode(parseStrict(m).documentElement!, true), moc);
  }
}

/**
 * Thay nguyên một DÃY phần tử liền nhau bằng một dãy markup mới — MỘT mảnh vá.
 *
 * Không tách thành "xoá từng cái rồi chèn vào chỗ cũ": chỗ chèn nằm ngay biên
 * của vùng bị xoá, và `applyPatches` từ chối hai vùng chồng nhau — đúng như nó
 * phải thế. Một mảnh vá phủ trọn vùng thì vừa không chồng, vừa giữ diff gọn.
 */
function thayTheDay(ctx: Ctx, els: readonly Element[], markups: readonly string[]) {
  if (!els.length) return;
  const dau = ctx.located.range(els[0]);
  const cuoi = ctx.located.range(els[els.length - 1]);
  const indent = ctx.located.indentOf(els[0]);
  // Nuốt cả khoảng trắng đầu dòng của phần tử đầu, để không để lại dòng trống.
  let start = dau.start;
  while (start > 0 && /[ \t]/.test(ctx.located.xml[start - 1])) start--;
  const anDauDong = start > 0 && ctx.located.xml[start - 1] === "\n";
  if (anDauDong) {
    start--;
    if (start > 0 && ctx.located.xml[start - 1] === "\r") start--;
  } else start = dau.start;
  const cach = indent === null || !anDauDong ? "" : `${ctx.located.eol}${indent}`;
  ctx.patches.push({
    start,
    end: cuoi.end,
    text: markups.map((m) => `${cach}${m}`).join(""),
  });
  // Phía DOM làm y hệt: bỏ đúng những nút ấy (kèm nút chữ xuống dòng đứng
  // trước), rồi dựng lại dãy mới từ chính markup vừa viết.
  const parent = els[0].parentNode!;
  const moc = els[els.length - 1].nextSibling;
  const cachDom = indent === null || !anDauDong ? null : `\n${indent}`;
  for (const el of els) {
    const truoc = el.previousSibling;
    if (truoc && truoc.nodeType === 3 && /^\s*$/.test(truoc.textContent ?? "")) parent.removeChild(truoc);
    parent.removeChild(el);
  }
  for (const m of markups) {
    if (cachDom) parent.insertBefore(ctx.doc.createTextNode(cachDom), moc);
    parent.insertBefore(ctx.doc.importNode(parseStrict(m).documentElement!, true), moc);
  }
}

/** Markup một dấu lặng, thụt lề bên trong theo hàng xóm. */
function markupLang(
  trong: string | null,
  ngoai: string | null,
  eol: string,
  noteType: string,
  dots: number,
  duration: number,
  voice: string | null,
  staff: string | null
) {
  const dong = (t: string) => (trong === null ? t : `${eol}${trong}${t}`);
  const than = [
    "<rest/>",
    `<duration>${duration}</duration>`,
    ...(voice ? [`<voice>${voice}</voice>`] : []),
    `<type>${noteType}</type>`,
    ...Array.from({ length: dots }, () => "<dot/>"),
    ...(staff ? [`<staff>${staff}</staff>`] : []),
  ];
  return trong === null || ngoai === null
    ? `<note>${than.join("")}</note>`
    : `<note>${than.map(dong).join("")}${eol}${ngoai}</note>`;
}

/** Mốc đầu mỗi nhóm phách của ô nhịp chứa `path` — lấy từ CHÍNH engine đếm phách. */
function mocPhachCua(xml: string, partIndex: number, measureIndex: number): Rational[] {
  // `buildBeatMap` trải part theo thứ tự, mỗi part trải measure theo thứ tự —
  // nên chỗ ngồi của một ô nhịp trong danh sách là tổng số ô của các part trước.
  const parts = parseMusicXML(xml).parts;
  let base = 0;
  for (let k = 0; k < partIndex - 1 && k < parts.length; k++) base += parts[k].measures.length;
  const m = musicXMLToBeatMap(xml).measures[base + measureIndex - 1];
  // Đây ĐÚNG là lưới mà số phách đang được vẽ lên — không có lưới thứ hai.
  return m ? m.beatsMap.map((b) => b.offset) : [];
}

/** Thời điểm bắt đầu của sự kiện tại `path`, tính từ đầu ô nhịp. */
function onsetCua(xml: string, path: string): Rational | null {
  for (const p of parseMusicXML(xml).parts)
    for (const m of p.measures)
      for (const e of m.events) if (e.source.path === path) return e.onset;
  return null;
}

const nhanRational = (a: Rational, b: Rational): Rational => {
  const [n, d] = a.split("/").map(BigInt);
  const [m, e] = b.split("/").map(BigInt);
  return rational(n * m, d * e);
};

/** Số `<duration>` cho một độ dài tính bằng nốt đen; null khi chia không hết. */
function donViCua(quarters: Rational, divisions: number): number | null {
  const [n, d] = quarters.split("/").map(BigInt);
  const tu = n * BigInt(divisions);
  return tu % d === 0n ? Number(tu / d) : null;
}

function changeDurationAndRebalance(
  ctx: Ctx,
  note: Element,
  cmd: ChangeDurationAndRebalance,
  ngu: NoteContext,
  xml: string
) {
  if (!isNoteType(cmd.noteType))
    throw new EditError("EDIT_DURATION_TYPE_INVALID", "Hình nốt không hợp lệ.");
  // ── Cổng chặn: TẤT CẢ đều phải nổ TRƯỚC khi chạm một mảnh vá nào ──────────
  if (ngu.chord !== "none")
    throw new EditError(
      "EDIT_REBALANCE_CHORD",
      "Cả hợp âm phải cùng trường độ — sửa trường độ hợp âm cần một lệnh riêng, chưa hỗ trợ."
    );
  if (ngu.ties.length)
    throw new EditError(
      "EDIT_REBALANCE_TIED",
      "Nốt này nằm trong một dấu nối — đổi trường độ sẽ đổi cả nghĩa của dấu nối. Chưa hỗ trợ."
    );
  if (ngu.grace)
    throw new EditError("EDIT_REBALANCE_GRACE", "Nốt hoa mỹ không có trường độ riêng để cân.");
  if (ngu.tuplet)
    throw new EditError(
      "EDIT_REBALANCE_TUPLET",
      "Nốt này nằm trong chùm nghịch phách — chưa hỗ trợ cân lại."
    );
  const rest = child(note, "rest");
  if (rest?.getAttribute("measure") === "yes")
    throw new EditError(
      "EDIT_REBALANCE_MEASURE_REST",
      "Đây là dấu lặng cả ô nhịp — trường độ đi theo ô, chưa hỗ trợ cân lại."
    );
  const durEl = child(note, "duration");
  if (!durEl) throw new EditError("EDIT_DURATION_MISSING", "Nốt này không ghi trường độ trong nguồn.");
  if (!ngu.divisions)
    throw new EditError("EDIT_DIVISIONS_UNKNOWN", "Bản nhạc không ghi rõ cách chia trường độ.");

  const m = SOURCE_PATH.exec(cmd.path)!;
  const partIndex = +m[1];
  const measureIndex = +m[2];
  const childIndex = +m[3];

  const cu = rational(Number(textOf(durEl)), ngu.divisions);
  const moi = quartersOf(cmd.noteType, cmd.dots);
  if (compare(cu, moi) === 0 && ngu.noteType === cmd.noteType && ngu.dots === cmd.dots) return;
  const donViMoi = donViCua(moi, ngu.divisions);
  if (donViMoi === null)
    throw new EditError(
      "EDIT_DURATION_NOT_REPRESENTABLE",
      "Bản nhạc này chưa chia đủ nhỏ để ghi trường độ ấy."
    );

  const onset = onsetCua(xml, cmd.path);
  if (onset === null)
    throw new EditError("EDIT_REBALANCE_NO_ONSET", "Không xác định được nốt này nằm ở phách nào.");
  const mocPhach = mocPhachCua(xml, partIndex, measureIndex);

  const anhEm = elementChildren(note.parentNode as Element);
  const voice = textOf(child(note, "voice")) || null;
  const staff = textOf(child(note, "staff")) || null;
  const trong = ctx.located.indentOf(durEl);
  const ngoai = ctx.located.indentOf(note);
  const eol = ctx.located.eol;
  const veLang = (pieces: { noteType: string; dots: number; quarters: Rational }[]) =>
    pieces.map((p) => {
      const dv = donViCua(p.quarters, ngu.divisions);
      if (dv === null)
        throw new EditError(
          "RHYTHM_REBALANCE_NOT_REPRESENTABLE",
          "Bản nhạc này chưa chia đủ nhỏ để ghi dấu lặng cần thiết."
        );
      return markupLang(trong, ngoai, eol, p.noteType, p.dots, dv, voice, staff);
    });

  let phanRa: { noteType: string; dots: number; quarters: Rational }[];
  try {
    phanRa =
      compare(moi, cu) < 0
        ? lapKhoangTrong(add(onset, moi), add(onset, cu), mocPhach)
        : [];
  } catch (e) {
    if (e instanceof RestFillError)
      throw new EditError("RHYTHM_REBALANCE_NOT_REPRESENTABLE", e.message);
    throw e;
  }

  // ── Viết trường độ mới lên chính nốt đích (dùng lại đúng đường của 3B) ────
  const ghiTruongDo = () => {
    const typeEl = child(note, "type");
    if (textOf(typeEl) !== cmd.noteType) {
      if (typeEl) patchLeafText(ctx, typeEl, cmd.noteType);
      else insertOrderedChild(ctx, note, NOTE_CHILD_ORDER, "type", cmd.noteType);
    }
    if (ngu.dots !== cmd.dots) {
      for (const d of elementChildren(note, "dot")) removeLeaf(ctx, d);
      if (cmd.dots > 0) insertOrderedChild(ctx, note, NOTE_CHILD_ORDER, "dot", null, cmd.dots);
    }
    if (Number(textOf(durEl)) !== donViMoi) patchLeafText(ctx, durEl, String(donViMoi));
    if (!coTheChum(cmd.noteType)) for (const b of elementChildren(note, "beam")) removeLeaf(ctx, b);
  };

  if (compare(moi, cu) < 0) {
    // ── NGẮN LẠI: sinh dấu lặng bù, ngay sau nốt, cùng bè cùng khuông ───────
    ghiTruongDo();
    insertNoteSauKhi(ctx, note, veLang(phanRa));
    if (phanRa.length)
      ctx.structural.push({ partIndex, measureIndex, atChildIndex: childIndex + 1, delta: phanRa.length });
    ctx.touched.push(`${cmd.path}/duration`, `${cmd.path}/+rest`);
    return;
  }

  // ── DÀI RA: CHỈ được ăn vào dấu lặng đứng liền sau ────────────────────────
  const can = sub(moi, cu);
  const an: Element[] = [];
  let co: Rational = ZERO;
  let i = childIndex; // 0-based chỉ số của phần tử ngay sau nốt đích
  let dauTien = -1;
  while (i < anhEm.length && compare(co, can) < 0) {
    const el = anhEm[i];
    const ten = el.localName ?? "";
    if (KHONG_CHIEM_THOI_GIAN.has(ten)) {
      i++;
      continue;
    }
    if (ten !== "note") break;
    const r = child(el, "rest");
    if (!r || r.getAttribute("measure") === "yes") break;
    if (child(el, "chord") || child(el, "grace")) break;
    if ((textOf(child(el, "voice")) || null) !== voice) break;
    if ((textOf(child(el, "staff")) || null) !== staff) break;
    const d = child(el, "duration");
    if (!d) break;
    if (dauTien < 0) dauTien = i;
    an.push(el);
    co = add(co, rational(Number(textOf(d)), ngu.divisions));
    i++;
  }
  if (compare(co, can) < 0)
    throw new EditError("EDIT_REBALANCE_NO_SPACE", "Không đủ khoảng trống để kéo dài nốt.");

  const thua = sub(co, can);
  let buLai: { noteType: string; dots: number; quarters: Rational }[] = [];
  if (compare(thua, ZERO) > 0) {
    try {
      buLai = lapKhoangTrong(add(onset, moi), add(add(onset, moi), thua), mocPhach);
    } catch (e) {
      if (e instanceof RestFillError)
        throw new EditError("RHYTHM_REBALANCE_NOT_REPRESENTABLE", e.message);
      throw e;
    }
  }
  const markups = veLang(buLai);

  ghiTruongDo();
  // Vùng dấu lặng bị ăn và chỗ đặt phần thừa là CÙNG một chỗ, nên phải đi bằng
  // đúng một mảnh vá (xem `thayTheDay`).
  thayTheDay(ctx, an, markups);
  // Hai bước: bỏ `an.length` con kể từ chỗ dấu lặng đầu tiên, rồi chèn lại
  // `markups.length` con vào đúng chỗ ấy. `draftIdentity` cộng dồn theo thứ tự.
  // Bỏ `an.length` con kể từ chỗ dấu lặng đầu tiên, rồi chèn lại `markups.length`
  // con vào đúng chỗ ấy. Phần dịch chuyển bằng 0 thì không ghi — bản đồ danh
  // tính chỉ nên chứa những thay đổi có thật.
  for (const d of [
    { partIndex, measureIndex, atChildIndex: dauTien + 1, delta: -an.length },
    { partIndex, measureIndex, atChildIndex: dauTien + 1, delta: markups.length },
  ])
    if (d.delta !== 0) ctx.structural.push(d);
  ctx.touched.push(`${cmd.path}/duration`, `${cmd.path}/-rest`);
}

export function applyCommand(xml: string, cmd: MusicXmlEditCommand): AppliedCommand {
  const located = locate(xml);
  const target = resolveSourcePath(located.doc, cmd.path);
  if (!target)
    throw new EditError("EDIT_TARGET_NOT_FOUND", "Không tìm thấy nốt này trong bản nhạc.");
  const ctx: Ctx = { located, doc: located.doc, patches: [], touched: [], structural: [] };
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
    case "MakeRest":
      makeRest(ctx, target, cmd, ngu);
      break;
    case "ReplaceRestWithNote":
      replaceRestWithNote(ctx, target, cmd, ngu);
      break;
    case "ChangeDurationAndRebalance":
      changeDurationAndRebalance(ctx, target, cmd, ngu, xml);
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
  if (!ctx.patches.length) return { xml, changed: false, touched: [], structural: [] };
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
  return { xml: patched, changed: true, touched: ctx.touched, structural: ctx.structural };
}
