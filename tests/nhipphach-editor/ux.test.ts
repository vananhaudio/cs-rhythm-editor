/**
 * EDITOR UX — bảng ký hiệu gọn · luyến · xoá vùng · điều hướng.
 *
 * Luyến (`ToggleSlur`) và xoá vùng (`MakeRestSequence`) là LỆNH của DraftEngine:
 * một lệnh, một lần hoàn tác, vá theo locator. Bảng ký hiệu chỉ phát
 * `EditorAction` — đúng cái mà phím tắt phát.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import { applyToDraft, createDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { toCommand, toCommandVung } from "../../src/nhipphach/editor/commandFacade.ts";
import { dispatch } from "../../src/nhipphach/editor/dispatcher.ts";
import { BANG_TRO_GIUP, KEYMAP, NHOM_PHIM, phimCua, traPhim } from "../../src/nhipphach/editor/keymap.ts";
import { NP_CSS } from "../../src/nhipphach/theme.ts";
import { caretTaiId, diChuyen, dsDiDuoc, idDangChon, moRong, chonMot } from "../../src/nhipphach/editor/caret.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";

const GO_INPUT = { tagName: "input" };
const src = (p: string) => readFileSync(new URL("../../src/" + p, import.meta.url), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const n = (step: string, extra = "", voice = 1, type = "quarter", dur = 1) =>
  `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${dur}</duration><voice>${voice}</voice><type>${type}</type>${extra}</note>`;
const r = (voice = 1) => `<note><rest/><duration>1</duration><voice>${voice}</voice><type>quarter</type></note>`;
const doc = (m1: string, m2 = "") =>
  `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${m1}</measure>${
    m2 ? `<measure number="2">${m2}</measure>` : ""
  }</part></score-partwise>`;
const P = (c: number, m = 1) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
// ô 1: con 1 = attributes, 2..5 = bốn nốt đen bè 1
const BON = doc(n("C") + n("D") + n("E") + n("F"));
const slurs = (xml: string) => [...xml.matchAll(/<slur type="(start|stop)" number="(\d+)"/g)].map((m) => `${m[1]}${m[2]}`);
const ma = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
  return "OK";
};
const slur = (a: string, b: string): MusicXmlEditCommand => ({ type: "ToggleSlur", path: a, denPath: b });

test("luyến 2 nốt: start trên nốt đầu, stop trên nốt cuối, ngoài ra không byte nào đổi", () => {
  const ra = applyCommand(BON, slur(P(2), P(3)));
  assert.ok(ra.changed);
  assert.deepEqual(slurs(ra.xml), ["start1", "stop1"]);
  // Bỏ đúng phần thêm vào thì trả về nguyên văn bản gốc.
  const bo = ra.xml.replace(/<notations><slur type="(start|stop)" number="1"[^>]*\/><\/notations>/g, "");
  assert.equal(bo, BON);
});

test("luyến 4 nốt: chỉ hai đầu mang dấu, nốt giữa không đụng", () => {
  const ra = applyCommand(BON, slur(P(2), P(5)));
  assert.deepEqual(slurs(ra.xml), ["start1", "stop1"]);
  const f = (c: number) => ra.xml.split("<note>")[c - 1];
  assert.doesNotMatch(f(3) + f(4), /slur/);
});

test("bấm lại cùng vùng = bỏ luyến → trả đúng nguyên văn", () => {
  const co = applyCommand(BON, slur(P(2), P(5))).xml;
  const bo = applyCommand(co, slur(P(2), P(5)));
  assert.ok(bo.changed);
  assert.equal(bo.xml, BON);
});

test("luyến nối vào <notations> sẵn có, không tạo cái thứ hai", () => {
  const X = doc(n("C", "<notations><fermata/></notations>") + n("D") + n("E") + n("F"));
  const ra = applyCommand(X, slur(P(2), P(3))).xml;
  assert.equal((ra.split("<note>")[1].match(/<notations>/g) ?? []).length, 1);
  assert.equal(applyCommand(ra, slur(P(2), P(3))).xml, X, "bỏ luyến giữ lại fermata, trả nguyên văn");
});

test("luyến chặn: vắt bè, một nốt, đầu là lặng, chồng chéo mơ hồ", () => {
  const HAI_BE = doc(n("C") + n("D") + n("E") + n("F") + `<backup><duration>4</duration></backup>` + n("G", "", 2, "whole", 4));
  assert.equal(ma(() => applyCommand(HAI_BE, slur(P(2), P(7)))), "SLUR_CROSS_VOICE");
  assert.equal(ma(() => applyCommand(BON, slur(P(2), P(2)))), "SLUR_NEED_TWO_NOTES");
  const LANG = doc(r() + n("D") + n("E") + n("F"));
  assert.equal(ma(() => applyCommand(LANG, slur(P(2), P(4)))), "SLUR_ENDPOINT_REST");
  // Đã có luyến 2→4; luyến 3→5 cắt ngang → chặn, không đoán.
  const co = applyCommand(BON, slur(P(2), P(4))).xml;
  assert.equal(ma(() => applyCommand(co, slur(P(3), P(5)))), "SLUR_AMBIGUOUS");
  // Luyến lồng bên trong một luyến lớn cũng chặn.
  const lon = applyCommand(BON, slur(P(2), P(5))).xml;
  assert.equal(ma(() => applyCommand(lon, slur(P(3), P(4)))), "SLUR_AMBIGUOUS");
});

test("luyến nối tiếp chung nốt: số luyến mới không trùng số đang mở", () => {
  const a = applyCommand(BON, slur(P(2), P(3))).xml;
  const b = applyCommand(a, slur(P(3), P(5))).xml;
  assert.deepEqual(slurs(b), ["start1", "stop1", "start1", "stop1"]);
});

test("luyến: hoàn tác / làm lại qua DraftEngine", () => {
  let d = createDraft(BON);
  d = applyToDraft(d, slur(P(2), P(5)));
  assert.deepEqual(slurs(d.xml), ["start1", "stop1"]);
  d = undo(d);
  assert.equal(d.xml, BON);
  d = redo(d);
  assert.deepEqual(slurs(d.xml), ["start1", "stop1"]);
});

test("xoá vùng: MỘT lệnh, MỘT lần hoàn tác, nhịp giữ nguyên", () => {
  let d = createDraft(BON);
  d = applyToDraft(d, { type: "MakeRestSequence", path: P(3), paths: [P(3), P(4)] });
  assert.equal(d.cursor, 1);
  assert.equal((d.xml.match(/<rest\/>/g) ?? []).length, 2);
  assert.equal((d.xml.match(/<duration>1<\/duration>/g) ?? []).length, 4);
  d = undo(d);
  assert.equal(d.xml, BON);
});

test("xoá: đầu luyến lẻ bị chặn; xoá trọn cả luyến thì luyến đi theo", () => {
  const co = applyCommand(BON, slur(P(2), P(4))).xml;
  assert.equal(ma(() => applyCommand(co, { type: "MakeRest", path: P(2) } as MusicXmlEditCommand)), "EDIT_MAKE_REST_SLUR");
  assert.equal(
    ma(() => applyCommand(co, { type: "MakeRestSequence", path: P(2), paths: [P(2), P(3)] })),
    "DELETE_SLUR_PARTIAL"
  );
  const ra = applyCommand(co, { type: "MakeRestSequence", path: P(2), paths: [P(2), P(3), P(4)] }).xml;
  assert.deepEqual(slurs(ra), []);
  assert.doesNotMatch(ra, /<notations>/);
});

test("facade: vùng → ToggleSlur(đầu, cuối) / MakeRestSequence; một nốt → MakeRest", () => {
  const vung = [2, 3, 4].map((c) => ({ path: P(c), fields: readNoteFields(BON, P(c)) }));
  const s = toCommandVung({ type: "TOGGLE_SLUR" }, vung);
  assert.deepEqual(s, { kind: "command", command: slur(P(2), P(4)) });
  const x = toCommandVung({ type: "MAKE_REST" }, vung);
  assert.equal(x.kind === "command" && x.command.type, "MakeRestSequence");
  const mot = toCommandVung({ type: "MAKE_REST" }, vung.slice(0, 1));
  assert.equal(mot.kind === "command" && mot.command.type, "MakeRest");
  assert.equal(toCommandVung({ type: "TOGGLE_SLUR" }, vung.slice(0, 1)).kind, "refused");
  // Một nốt đơn không có vùng → luyến từ chối bằng lời, không im lặng.
  assert.equal(toCommand({ type: "TOGGLE_SLUR" }, P(2), vung[0].fields, undefined as never, null).kind, "refused");
});

test("phím: S = luyến (như MuseScore), Delete = xoá nốt; trợ giúp chia nhóm đủ 5", () => {
  const k = (key: string) => ({ key, ctrl: false, shift: false, alt: false });
  assert.deepEqual(traPhim(k("s")), { type: "TOGGLE_SLUR" });
  assert.equal(phimCua({ type: "TOGGLE_SLUR" }), "S");
  assert.equal(phimCua({ type: "MAKE_REST" }), "Delete");
  // A–G vẫn là nhập nốt; S không đè lên chữ nào của nốt.
  for (const step of "ABCDEFG") assert.equal(traPhim(k(step.toLowerCase()))?.type, "ENTER_PITCH");
  const nhom = new Set(BANG_TRO_GIUP.map((x) => x.nhom));
  assert.deepEqual([...NHOM_PHIM].filter((g) => nhom.has(g)), [...NHOM_PHIM]);
  for (const b of KEYMAP) assert.ok(NHOM_PHIM.includes(b.nhom), `${b.key} thiếu nhóm`);
});

test("ô nhập chữ giữ phím: S/Delete gõ trong input không thành lệnh", () => {
  for (const key of ["s", "Delete", "c"])
    assert.deepEqual(dispatch({ key, target: GO_INPUT }, { choSua: true }), { kind: "blocked", why: "typing" }, key);
  // Ngoài ô nhập, S ra đúng lệnh luyến — cùng action mà nút bảng ký hiệu phát.
  const ra = dispatch({ key: "s" }, { choSua: true });
  assert.equal(ra.kind === "action" && ra.action.type, "TOGGLE_SLUR");
});

test("bảng ký hiệu: chỉ ký hiệu, tên+phím trong title/aria, không giành focus, một cửa onAction", () => {
  const tb = stripComments(src("nhipphach/editor/ScoreToolPalette.tsx"));
  assert.match(tb, /title=\{nhan\}/);
  assert.match(tb, /aria-label=\{nhan\}/);
  assert.match(tb, /\$\{ten\} · \$\{phim\}/);
  assert.match(tb, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.doesNotMatch(tb, /applyCommand|applyToDraft|ToggleSlur|MakeRestSequence/);
  // Không chữ tiếng Việt nào nằm TRỰC TIẾP làm nhãn nút (chỉ glyph / SVG).
  const conNut = tb
    .split("</PBtn>")
    .slice(0, -1)
    .map((p) => p.slice(p.lastIndexOf("<PBtn")))
    .map((p) => p.slice(p.search(/\n\s*>\n/)).replace(/^\s*>/, ""));
  assert.ok(conNut.length >= 10);
  for (const c of conNut) assert.doesNotMatch(c.replace(/\{[^}]*\}|<[^>]*>/g, ""), /[A-Za-zÀ-ỹ]{3,}/, c);
  // Không kéo bộ icon ngoài.
  assert.doesNotMatch(tb, /from "(lucide|react-icons|@heroicons|@mui)/);
});

test("bảng ký hiệu: điện thoại cuộn ngang, desktop gói hàng", () => {
  assert.match(NP_CSS, /\.np-palette\{display:flex;flex-wrap:wrap/);
  assert.match(NP_CSS, /@media \(max-width:720px\)\{[^}]*\.np-palette\{flex-wrap:nowrap;overflow-x:auto/);
  assert.match(NP_CSS, /\.np-pbtn\{[^}]*width:32px;height:32px/);
  assert.match(NP_CSS, /\.np-pbtn\[aria-pressed="true"\]/);
});

test("trang: bảng ký hiệu thay thanh cũ, Thuộc tính gập mặc định, vùng đi qua toCommandVung", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.doesNotMatch(page, /EditorToolbar/);
  assert.match(page, /\[moThuocTinh, setMoThuocTinh\] = useState\(false\)/);
  assert.match(page, /moChiTiet=\{moThuocTinh\}/);
  assert.match(page, /onDoubleClick=\{choChonNot && chonNot/);
  assert.match(page, /toCommandVung\(action, vung\)/);
});

test("điều hướng: → đi theo thứ tự tài liệu; Shift+→ mở vùng; không toạ độ", () => {
  const ds = dsDiDuoc(tagSourceIds(BON).notes);
  let c = caretTaiId(ds, ds[0].svgId)!;
  const thu: string[] = [c.sourceId];
  for (let i = 0; i < 3; i++) {
    c = diChuyen(ds, c, "next")!;
    thu.push(c.sourceId);
  }
  assert.deepEqual(thu, ds.map((x) => x.svgId));
  let v = chonMot(caretTaiId(ds, ds[1].svgId)!);
  v = moRong(ds, v, "next");
  v = moRong(ds, v, "next");
  assert.deepEqual(idDangChon(v, ds), [ds[1].svgId, ds[2].svgId, ds[3].svgId]);
  const car = stripComments(src("nhipphach/editor/caret.ts"));
  assert.doesNotMatch(car, /getBBox|getBoundingClientRect|\.x\b|offsetLeft/);
});

test("điều hướng bỏ qua sự kiện không vẽ được — theo id, tất định", () => {
  const all = tagSourceIds(BON).notes;
  const ds = dsDiDuoc(all, new Set([all[1].svgId]));
  const c = diChuyen(ds, caretTaiId(ds, all[0].svgId)!, "next")!;
  assert.equal(c.sourceId, all[2].svgId);
  assert.deepEqual(dsDiDuoc(all, new Set([all[1].svgId])).map((x) => x.svgId), ds.map((x) => x.svgId));
});
