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
import { applyCommand, nangPhanChia } from "../../src/nhipphach/edit/applyCommand.ts";
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
  assert.match(page, /\[moThuocTinh, setMoThuocTinh\] = useState\(true\)/);
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

// ══ Vòng 2 ══════════════════════════════════════════════════════════════════

test("vòng 2: `-` dài ra, `=` ngắn lại, đứng yên ở biên, giữ chấm dôi", () => {
  const f = (xml: string) => readNoteFields(xml, P(2));
  const buoc = (xml: string, dir: 1 | -1) => toCommand({ type: "STEP_DURATION", dir }, P(2), f(xml), undefined as never, null);
  const den = buoc(BON, 1);
  assert.deepEqual(den, { kind: "command", command: { type: "ChangeDurationAndRebalance", path: P(2), noteType: "half", dots: 0 } });
  const ngan = buoc(BON, -1);
  assert.equal(ngan.kind === "command" && ngan.command.type === "ChangeDurationAndRebalance" && ngan.command.noteType, "eighth");
  const TRON = doc(n("C", "", 1, "whole", 4));
  assert.deepEqual(buoc(TRON, 1), { kind: "noop" }, "tròn bấm - đứng yên");
  const KEP = doc(n("C", "<beam number=\"1\">begin</beam>", 1, "16th", 1));
  const kep = buoc(KEP.replace("<divisions>1</divisions>", "<divisions>4</divisions>"), -1);
  assert.equal(kep.kind === "refused" || kep.kind === "noop", true, "móc kép bấm = không đi tiếp");
  // Chấm dôi đi theo khi đổi bậc.
  const CHAM = doc(n("C", "<dot/>", 1, "quarter", 1).replace("<duration>1</duration>", "<duration>3</duration>").replace("<divisions>1</divisions>", "<divisions>2</divisions>"));
  const ch = toCommand({ type: "STEP_DURATION", dir: -1 }, P(2), readNoteFields(CHAM, P(2)), undefined as never, null);
  assert.equal(ch.kind === "command" && ch.command.type === "ChangeDurationAndRebalance" && ch.command.dots, 1);
});

test("vòng 2: ở dấu lặng, `-`/`=` chỉ đổi cây bút (không lệnh)", () => {
  const LANG = doc(r() + n("D") + n("E") + n("F"));
  const nhap = { currentDuration: { noteType: "quarter", dots: 0 } } as never;
  const ra = toCommand({ type: "STEP_DURATION", dir: -1 }, P(2), readNoteFields(LANG, P(2)), nhap, null);
  assert.deepEqual(ra, { kind: "toolState", truongDo: { noteType: "eighth", dots: 0 } });
});

test("vòng 2: `-`/`=` hoàn tác từng bước", () => {
  const GOC = doc(n("C") + r() + r() + r());
  let d = createDraft(GOC);
  for (const dir of [1, 1] as const) {
    const ra = toCommand({ type: "STEP_DURATION", dir }, P(2), readNoteFields(d.xml, P(2)), undefined as never, null);
    if (ra.kind === "command") d = applyToDraft(d, ra.command);
  }
  assert.equal(readNoteFields(d.xml, P(2))!.noteType, "whole");
  d = undo(d);
  assert.equal(readNoteFields(d.xml, P(2))!.noteType, "half");
  d = undo(d);
  assert.equal(d.xml, GOC);
});

test("vòng 2: phím kiểu Guitar Pro — H luyến, Ctrl+Y làm lại, Ctrl+→ ô nhịp, Backspace xoá", () => {
  const k = (key: string, ctrl = false, shift = false) => ({ key, ctrl, shift, alt: false });
  assert.deepEqual(traPhim(k("h")), { type: "TOGGLE_SLUR" });
  assert.deepEqual(traPhim(k("y", true)), { type: "REDO" });
  assert.deepEqual(traPhim(k("+", false, true)), { type: "STEP_DURATION", dir: -1 });
  assert.deepEqual(traPhim(k("ArrowRight", true)), { type: "MOVE", where: "nextMeasure" });
  assert.deepEqual(traPhim(k("ArrowLeft", true)), { type: "MOVE", where: "prevMeasure" });
  assert.deepEqual(traPhim(k("Backspace")), { type: "MAKE_REST" });
  assert.deepEqual(traPhim(k("ArrowRight", false, true)), { type: "EXTEND_SELECTION", where: "next" });
  // Ô nhập đang có focus thì Backspace/-/= là của ô nhập.
  for (const key of ["Backspace", "-", "="])
    assert.deepEqual(dispatch({ key, target: GO_INPUT }, { choSua: true }), { kind: "blocked", why: "typing" }, key);
});

test("vòng 2: khoang sửa cao CỐ ĐỊNH, cuộn bên trong, không bôi chọn chữ giao diện", () => {
  assert.match(NP_CSS, /\.np-editor-dock\{[^}]*position:sticky[^}]*height:clamp\([^}]*overflow-y:auto[^}]*overflow-anchor:none/);
  assert.match(NP_CSS, /\.np-editor-dock,[^{]*\.np-select-mode\{-webkit-user-select:none;user-select:none;\}/);
  assert.match(NP_CSS, /\.np-editor-dock input,[^{]*textarea,[^{]*\{-webkit-user-select:text;user-select:text;\}/);
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Palette, "Đang chọn", trợ giúp, Thuộc tính đều nằm TRONG khoang.
  const a = page.indexOf('className="np-editor-dock"');
  const b = page.indexOf("ref={prevBody}");
  assert.ok(a > 0 && b > a);
  for (const moc of ['className="np-note-panel"', "<ScoreToolPalette", "<KeymapHelp", "<EditPanel"]) {
    const i = page.indexOf(moc);
    assert.ok(i > a && i < b, `${moc} phải nằm trong khoang cố định`);
  }
});

test("vòng 2: ← → và Shift+→ ở LẠI trong dòng — không rơi sang khuông TAB", () => {
  const TAB = readFileSync(new URL("../nhipphach-layout/fixtures/guitar-tab.musicxml", import.meta.url), "utf8");
  const ds = dsDiDuoc(tagSourceIds(TAB).notes);
  const dau = ds[0];
  let c = caretTaiId(ds, dau.svgId)!;
  let v = chonMot(c);
  for (;;) {
    const t = diChuyen(ds, c, "next");
    if (!t) break;
    c = t;
    const n = ds[t.sourceIndex];
    assert.equal(`${n.partIndex}/${n.staff}/${n.voice}`, `${dau.partIndex}/${dau.staff}/${dau.voice}`);
  }
  for (let k = 0; k < 6; k++) v = moRong(ds, v, "next");
  for (const id of idDangChon(v, ds)) {
    const n = ds.find((x) => x.svgId === id)!;
    assert.equal(n.staff, dau.staff, "vùng chọn không lẫn khuông khác");
  }
  // Ctrl+→ cũng giữ dòng.
  const m = diChuyen(ds, caretTaiId(ds, dau.svgId), "nextMeasure");
  if (m) assert.equal(ds[m.sourceIndex].staff, dau.staff);
});

test("vòng 2: phím nóng nghe ở cấp cửa sổ — focus ở nút/ô chọn panel không làm tắt phím", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.match(page, /window\.addEventListener\("keydown", nghe\)/);
  assert.match(page, /window\.removeEventListener\("keydown", nghe\)/);
  // Nhường cho ô nhập thật sự, và cho chính khung bản nhạc (tránh chạy hai lần).
  assert.match(page, /INPUT\|TEXTAREA\|SELECT/);
  assert.match(page, /prevBody\.current\?\.contains\(t\)/);
  // Vẫn sau cổng quyền.
  assert.match(page, /if \(!choChonNot \|\| !chonNot\) return;\s*const nghe/);
  // Bấm nốt thì kéo focus về bản nhạc.
  assert.match(page, /prevBody\.current\?\.focus\(\{ preventScroll: true \}\)/);
  // Nút đang giữ focus không chặn phím nóng trên đường cửa sổ.
  assert.deepEqual(dispatch({ key: "s", target: null }, { choSua: true, focused: null }), { kind: "action", action: { type: "TOGGLE_SLUR" } });
});

test("vòng 2: bộ gõ tiếng Việt (key=Process) vẫn ra đúng phím nhờ `code`; lời báo hiện trên hàng ký hiệu", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.match(page, /key: phimThat\(e\)/);
  assert.match(page, /Minus: \["-", "_"\]/);
  assert.match(page, /Equal: \["=", "\+"\]/);
  assert.match(page, /\/\^Key\(\[A-Z\]\)\$\//);
  assert.match(page, /code: e\.code/);
  assert.match(page, /thongBao=\{nhapNote\}/);
  const pal = stripComments(src("nhipphach/editor/ScoreToolPalette.tsx"));
  assert.match(pal, /className="np-pal-msg" role="status"/);
});

test("nâng phần chia: `=` xuống móc đơn/móc kép trên bài chia thô → tự nâng, MỘT lần hoàn tác", () => {
  // BON chia 1 phần mỗi nốt đen — không ghi nổi móc đơn.
  let d = createDraft(BON);
  const buoc = () => {
    const ra = toCommand({ type: "STEP_DURATION", dir: -1 }, P(2), readNoteFields(d.xml, P(2)), undefined as never, null);
    assert.equal(ra.kind, "command");
    if (ra.kind === "command") d = applyToDraft(d, ra.command);
  };
  buoc();
  assert.equal(readNoteFields(d.xml, P(2))!.noteType, "eighth");
  assert.match(d.xml, /<divisions>2<\/divisions>/);
  buoc();
  assert.equal(readNoteFields(d.xml, P(2))!.noteType, "16th");
  assert.match(d.xml, /<divisions>4<\/divisions>/);
  // Các nốt khác: trường độ nhân theo, hình nốt giữ nguyên → tiếng nhạc giữ nguyên.
  // 3 nốt đen D E F còn nguyên hình nốt, trường độ ×4.
  assert.equal((d.xml.match(/<duration>4<\/duration><voice>1<\/voice><type>quarter<\/type>/g) ?? []).length, 3);
  assert.equal(d.cursor, 2, "mỗi phím một lệnh — nâng phần chia không thành lệnh riêng");
  d = undo(d);
  assert.match(d.xml, /<divisions>2<\/divisions>/);
  d = undo(d);
  assert.equal(d.xml, BON);
});

test("nâng phần chia: chỉ nhân số đo, không đụng byte nào khác; part khác đứng yên", () => {
  const X = BON.replace("<backup>", "<backup>");
  const ra = nangPhanChia(X, P(2), 3);
  const bo = ra.xml.replace(/<(divisions|duration)>(\d+)<\/\1>/g, (_m, t, n) => `<${t}>${Number(n) / 3}</${t}>`);
  assert.equal(bo, X);
  const HAI = doc(n("C") + `<backup><duration>1</duration></backup>` + n("G", "", 2) + n("D") + n("E") + n("F"));
  const r2 = nangPhanChia(HAI, P(2), 2);
  assert.match(r2.xml, /<backup><duration>2<\/duration><\/backup>/);
});
