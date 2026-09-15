/**
 * Xoá thành lặng · nhập nốt bằng chữ cái — Giai đoạn 4B.1.
 *
 * Bất biến lớn nhất của cả giai đoạn: SỐ CON CỦA Ô NHỊP KHÔNG ĐỔI. Cả hai lệnh
 * chỉ thay ruột đúng một `<note>`; không thêm, không bớt, không dời chỗ ai. Nhờ
 * vậy đường dẫn cấu trúc — tức danh tính nguồn của MỌI phần tử phía sau — đứng
 * yên, và đó là lý do 4B.1 chưa đụng tới việc chèn nốt mới.
 *
 * Mọi phép chặn (hợp âm, dấu nối, lặng cả ô, nốt hoa mỹ) đều phải FAIL TRƯỚC
 * khi bản nháp bị đụng tới — không có lệnh nào được áp một nửa.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand, Pitch } from "../../src/nhipphach/edit/commands.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import {
  applyToDraft,
  createDraft,
  isDirty,
  rebuildDraft,
  redo,
  undo,
} from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { rhythmIssues, structuralIssues } from "../../src/nhipphach/edit/validation.ts";
import { EditError, elementChildren, parseStrict, resolveSourcePath } from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import { capDoNhap, ghiNhoThamChieu, NHAP_BAN_DAU, nuaCung } from "../../src/nhipphach/editor/noteEntry.ts";
import type { NoteEntryState } from "../../src/nhipphach/editor/noteEntry.ts";

const doc = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const FIX = doc("./fixtures/rest-entry.musicxml");
const B = "../musicxml-beats/fixtures/";

/** Sự kiện trong fixture, gọi theo tên cho dễ đọc. */
const E = {
  notC4: "/score-partwise/part[1]/measure[1]/*[2]",
  langDen: "/score-partwise/part[1]/measure[1]/*[3]",
  notE4Cham: "/score-partwise/part[1]/measure[1]/*[4]",
  langMoc: "/score-partwise/part[1]/measure[1]/*[5]",
  noiBatDau: "/score-partwise/part[1]/measure[2]/*[1]",
  noiKetThuc: "/score-partwise/part[1]/measure[2]/*[2]",
  hopAmGoc: "/score-partwise/part[1]/measure[2]/*[3]",
  hopAmCon: "/score-partwise/part[1]/measure[2]/*[4]",
  langCaO: "/score-partwise/part[1]/measure[3]/*[1]",
  be2: "/score-partwise/part[1]/measure[4]/*[4]",
  langChamBe1: "/score-partwise/part[1]/measure[4]/*[2]",
  notTab: "/score-partwise/part[2]/measure[1]/*[2]",
  langTab: "/score-partwise/part[2]/measure[1]/*[3]",
};
const P = (step: string, octave: number, alter = 0): Pitch =>
  ({ step, alter, octave }) as Pitch;
const ap = (xml: string, cmd: MusicXmlEditCommand) => applyCommand(xml, cmd).xml;
const not = (xml: string, path: string) => {
  const el = resolveSourcePath(parseStrict(xml), path)!;
  return elementChildren(el).map((c) => c.localName);
};
const chu = (xml: string, path: string, name: string) =>
  elementChildren(resolveSourcePath(parseStrict(xml), path)!, name)[0]?.textContent?.trim() ?? null;
const boLoi = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e as EditError;
  }
};
/** Số con của MỌI ô nhịp — bất biến số một của 4B.1. */
function demConMoiO(xml: string): number[] {
  const d = parseStrict(xml);
  return elementChildren(d.documentElement!, "part").flatMap((p) =>
    elementChildren(p, "measure").map((m) => elementChildren(m).length)
  );
}

// ── MakeRest ──────────────────────────────────────────────────────────────

test("MakeRest: nốt thành lặng, giữ trường độ / bè / khuông / chỗ ngồi", () => {
  const sau = ap(FIX, { type: "MakeRest", path: E.notC4 });
  assert.deepEqual(not(sau, E.notC4), ["rest", "duration", "voice", "type", "lyric"]);
  assert.equal(chu(sau, E.notC4, "duration"), "4");
  assert.equal(chu(sau, E.notC4, "type"), "quarter");
  assert.equal(chu(sau, E.notC4, "voice"), "1");
  assert.equal(readNoteFields(sau, E.notC4)!.kind, "rest");
});

test("MakeRest: chấm dôi và bè/khuông của nốt khác đều nguyên vẹn", () => {
  const sau = ap(FIX, { type: "MakeRest", path: E.notE4Cham });
  assert.deepEqual(not(sau, E.notE4Cham), ["rest", "duration", "voice", "type", "dot"]);
  assert.equal(readNoteFields(sau, E.notE4Cham)!.dots, 1);
  // Nốt bè 2 ở ô 4 không bị đụng một chữ nào.
  assert.equal(chu(sau, E.be2, "voice"), "2");
  assert.equal(chu(sau, E.be2, "type"), "whole");
});

test("MakeRest: bỏ dữ liệu TAB không còn nghĩa, KHÔNG đụng nốt nguồn nào khác", () => {
  const truoc = readNoteFields(FIX, E.notTab)!;
  assert.ok(truoc.tab, "nốt TAB trong fixture phải có string/fret");
  const sau = ap(FIX, { type: "MakeRest", path: E.notTab });
  const con = not(sau, E.notTab);
  assert.deepEqual(con, ["rest", "duration", "voice", "type"]);
  assert.equal(con.includes("notations"), false, "<notations> rỗng phải bị bỏ");
  assert.equal(con.includes("stem"), false, "<stem> không có nghĩa trên dấu lặng");
  assert.equal(readNoteFields(sau, E.notTab)!.tab, null);
  // Nốt trên khuông nhạc thường là MỘT NỐT NGUỒN KHÁC — tuyệt đối không tự sửa.
  assert.equal(chu(sau, E.notC4, "duration"), "4");
  assert.equal(readNoteFields(sau, E.notC4)!.pitch!.step, "C");
});

test("MakeRest: nốt đã là lặng → lệnh rỗng, không một byte nào đổi", () => {
  const r = applyCommand(FIX, { type: "MakeRest", path: E.langDen });
  assert.equal(r.changed, false);
  assert.equal(r.xml, FIX);
});

// ── Các cổng chặn ─────────────────────────────────────────────────────────

test("MakeRest bị CHẶN trên nốt trong hợp âm — cả nốt con lẫn nốt gốc", () => {
  const con = boLoi(() => applyCommand(FIX, { type: "MakeRest", path: E.hopAmCon }));
  assert.equal(con?.code, "EDIT_MAKE_REST_CHORD");
  assert.match(con!.message, /riêng một nốt trong hợp âm/);
  const goc = boLoi(() => applyCommand(FIX, { type: "MakeRest", path: E.hopAmGoc }));
  assert.equal(goc?.code, "EDIT_MAKE_REST_CHORD");
  assert.match(goc!.message, /bỏ rơi/);
});

test("MakeRest bị CHẶN trên nốt có dấu nối — không để dấu nối treo lơ lửng", () => {
  for (const path of [E.noiBatDau, E.noiKetThuc]) {
    const e = boLoi(() => applyCommand(FIX, { type: "MakeRest", path }));
    assert.equal(e?.code, "EDIT_MAKE_REST_TIED");
  }
});

test("ReplaceRestWithNote bị CHẶN trên lặng cả ô nhịp", () => {
  const e = boLoi(() =>
    applyCommand(FIX, { type: "ReplaceRestWithNote", path: E.langCaO, pitch: P("D", 4) })
  );
  assert.equal(e?.code, "EDIT_REST_WHOLE_MEASURE");
});

test("ReplaceRestWithNote bị CHẶN khi chỗ đó vốn đã là nốt", () => {
  const e = boLoi(() =>
    applyCommand(FIX, { type: "ReplaceRestWithNote", path: E.notC4, pitch: P("D", 4) })
  );
  assert.equal(e?.code, "EDIT_NOT_A_REST");
});

test("lệnh bị chặn thì bản nháp KHÔNG đổi một byte — không có lệnh áp nửa chừng", () => {
  let nhap = createDraft(FIX);
  for (const cmd of [
    { type: "MakeRest", path: E.hopAmCon },
    { type: "MakeRest", path: E.noiBatDau },
    { type: "ReplaceRestWithNote", path: E.langCaO, pitch: P("D", 4) },
  ] as MusicXmlEditCommand[]) {
    assert.throws(() => (nhap = applyToDraft(nhap, cmd)));
  }
  assert.equal(nhap.xml, FIX);
  assert.equal(isDirty(nhap), false);
  assert.equal(nhap.commands.length, 0);
});

// ── ReplaceRestWithNote ───────────────────────────────────────────────────

test("ReplaceRestWithNote: lặng thành nốt, giữ trường độ và chỗ ngồi", () => {
  const sau = ap(FIX, { type: "ReplaceRestWithNote", path: E.langDen, pitch: P("D", 4) });
  assert.deepEqual(not(sau, E.langDen), ["pitch", "duration", "voice", "type"]);
  assert.equal(chu(sau, E.langDen, "duration"), "4");
  const f = readNoteFields(sau, E.langDen)!;
  assert.equal(f.kind, "note");
  assert.deepEqual(f.pitch, { step: "D", alter: 0, octave: 4 });
});

test("ReplaceRestWithNote: dấu hoá hiển thị do LUẬT 3B quyết, không có bộ luật thứ hai", () => {
  // Bộ khoá fifths=2 (Rê trưởng) đã có Fa♯ và Đô♯ sẵn.
  const fa = ap(FIX, { type: "ReplaceRestWithNote", path: E.langDen, pitch: P("F", 4, 1), accidental: "auto" });
  assert.equal(chu(fa, E.langDen, "accidental"), null, "Fa♯ nằm trong bộ khoá thì không vẽ dấu");
  assert.equal(elementChildren(resolveSourcePath(parseStrict(fa), E.langDen)!, "pitch")[0].textContent?.replace(/\s+/g, ""), "F14");
  const faBinh = ap(FIX, { type: "ReplaceRestWithNote", path: E.langDen, pitch: P("F", 4), accidental: "auto" });
  assert.equal(chu(faBinh, E.langDen, "accidental"), "natural", "Fa bình trong giọng Rê phải có dấu bình");
});

test("ReplaceRestWithNote giữ nguyên chấm dôi của dấu lặng", () => {
  const sau = ap(FIX, { type: "ReplaceRestWithNote", path: E.langChamBe1, pitch: P("B", 4) });
  assert.deepEqual(not(sau, E.langChamBe1), ["pitch", "duration", "voice", "type", "dot", "staff"]);
  assert.equal(readNoteFields(sau, E.langChamBe1)!.dots, 1);
  assert.equal(chu(sau, E.langChamBe1, "staff"), "1");
});

// ── Bất biến: số con, danh tính, nhịp, phạm vi diff ───────────────────────

test("BẤT BIẾN: số con của mọi ô nhịp không đổi, qua cả hai lệnh", () => {
  const goc = demConMoiO(FIX);
  let xml = FIX;
  for (const cmd of [
    { type: "MakeRest", path: E.notC4 },
    { type: "MakeRest", path: E.notE4Cham },
    { type: "ReplaceRestWithNote", path: E.langDen, pitch: P("D", 4) },
    { type: "ReplaceRestWithNote", path: E.langMoc, pitch: P("A", 4) },
  ] as MusicXmlEditCommand[]) {
    xml = ap(xml, cmd);
    assert.deepEqual(demConMoiO(xml), goc);
  }
});

test("BẤT BIẾN: danh tính nguồn của MỌI sự kiện đứng yên, kể cả các sự kiện phía sau", () => {
  const truoc = tagSourceIds(FIX).notes;
  let xml = FIX;
  for (const cmd of [
    { type: "MakeRest", path: E.notC4 },
    { type: "ReplaceRestWithNote", path: E.langMoc, pitch: P("A", 4) },
    { type: "MakeRest", path: E.notTab },
  ] as MusicXmlEditCommand[])
    xml = ap(xml, cmd);
  const sau = tagSourceIds(xml).notes;
  assert.deepEqual(
    sau.map((n) => n.svgId),
    truoc.map((n) => n.svgId)
  );
  assert.deepEqual(
    sau.map((n) => n.path),
    truoc.map((n) => n.path)
  );
});

test("BẤT BIẾN: chẩn đoán nhịp TRƯỚC và SAU giống hệt nhau — không sinh thiếu/thừa phách", () => {
  const nhipKhac: [string, string][] = [
    ["4/4 + 3/4 + 6/8 (fixture 4B.1)", FIX],
    ["4/4", doc(B + "simple-4-4.musicxml")],
    ["3/4", doc(B + "simple-3-4.musicxml")],
    ["6/8", doc(B + "pickup-eighth.musicxml")],
    ["lấy đà", doc(B + "pickup-quarter.musicxml")],
    ["lặng đủ kiểu", doc(B + "rests.musicxml")],
    ["5/8 (2+3)", doc("../musicxml-irregular/fixtures/five-2-3.musicxml")],
    ["5/8 hai bè", doc("../musicxml-irregular/fixtures/five-2-3-two-voices.musicxml")],
    ["7/8", doc("../musicxml-irregular/fixtures/seven-2-2-3.musicxml")],
    ["7/8 lấy đà", doc("../musicxml-irregular/fixtures/pickup-seven-3-2-2.musicxml")],
  ];
  for (const [ten, xml] of nhipKhac) {
    const truoc = rhythmIssues(xml);
    for (const n of tagSourceIds(xml).notes) {
      // Chỉ thử những sự kiện mà lệnh nhận; chỗ bị chặn đã có test riêng.
      const f = readNoteFields(xml, n.path);
      if (!f) continue;
      const cmd: MusicXmlEditCommand =
        f.kind === "note"
          ? { type: "MakeRest", path: n.path }
          : { type: "ReplaceRestWithNote", path: n.path, pitch: P("D", 4) };
      let sau: string;
      try {
        sau = ap(xml, cmd);
      } catch {
        continue;
      }
      assert.deepEqual(rhythmIssues(sau), truoc, `${ten} · ${n.svgId}`);
      assert.deepEqual(
        structuralIssues(parseStrict(sau)),
        structuralIssues(parseStrict(xml)),
        `${ten} · ${n.svgId}`
      );
    }
  }
});

test("BẤT BIẾN: chỉ vùng <note> đích đổi; hàng xóm trước/sau y hệt từng byte", () => {
  for (const cmd of [
    { type: "MakeRest", path: E.notE4Cham },
    { type: "ReplaceRestWithNote", path: E.langMoc, pitch: P("A", 4) },
  ] as MusicXmlEditCommand[]) {
    const sau = ap(FIX, cmd);
    // Cắt đúng ô nhịp 1 ra khỏi hai bản rồi so từng `<note>`: chỉ MỘT khác.
    const cat = (s: string) => s.match(/<measure number="1">[\s\S]*?<\/measure>/)![0].split(/(?=<note>)/);
    const a = cat(FIX);
    const b = cat(sau);
    assert.equal(a.length, b.length);
    const khac = a.map((x, i) => (x === b[i] ? null : i)).filter((i) => i !== null);
    assert.equal(khac.length, 1, "đúng một khối <note> được đụng tới");
    // Và phần còn lại của file — ba ô nhịp kia, part 2 — không đổi.
    const duoi = (s: string) => s.slice(s.indexOf('<measure number="2">'));
    assert.equal(duoi(sau), duoi(FIX));
  }
});

// ── Hoàn tác / làm lại ────────────────────────────────────────────────────

test("C4 → lặng → E4, hoàn tác ngược từng bước, làm lại đúng đường cũ", () => {
  let d = createDraft(FIX);
  d = applyToDraft(d, { type: "MakeRest", path: E.notC4 });
  const langRoi = d.xml;
  d = applyToDraft(d, { type: "ReplaceRestWithNote", path: E.notC4, pitch: P("E", 4) });
  assert.deepEqual(readNoteFields(d.xml, E.notC4)!.pitch, { step: "E", alter: 0, octave: 4 });

  d = undo(d);
  assert.equal(d.xml, langRoi, "E4 → lặng");
  assert.equal(readNoteFields(d.xml, E.notC4)!.kind, "rest");
  d = undo(d);
  assert.equal(d.xml, FIX, "lặng → C4");
  assert.deepEqual(readNoteFields(d.xml, E.notC4)!.pitch, { step: "C", alter: 0, octave: 4 });

  d = redo(d);
  assert.equal(d.xml, langRoi);
  d = redo(d);
  assert.deepEqual(readNoteFields(d.xml, E.notC4)!.pitch, { step: "E", alter: 0, octave: 4 });
  // Nháp luôn bằng đúng bản gốc dựng lại từ ngăn xếp lệnh.
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
});

test("ghi chú phiên bản tự sinh gọi đúng tên hai việc mới", () => {
  assert.equal(
    describeCommands([
      { type: "MakeRest", path: E.notC4 },
      { type: "MakeRest", path: E.notE4Cham },
      { type: "ReplaceRestWithNote", path: E.langDen, pitch: P("D", 4) },
    ]),
    "Chuyển 2 nốt thành lặng · nhập 1 nốt vào chỗ lặng"
  );
});

// ── Mặt tiền lệnh + quãng tám nhập ────────────────────────────────────────

const F = (path: string, xml = FIX) => readNoteFields(xml, path);

test("mặt tiền: MAKE_REST từ chối có lý do, không im lặng", () => {
  assert.equal(toCommand({ type: "MAKE_REST" }, E.notC4, F(E.notC4)).kind, "command");
  assert.equal(toCommand({ type: "MAKE_REST" }, E.langDen, F(E.langDen)).kind, "noop");
  for (const [path, mau] of [
    [E.hopAmCon, /hợp âm/],
    [E.noiBatDau, /dấu nối/],
  ] as [string, RegExp][]) {
    const r = toCommand({ type: "MAKE_REST" }, path, F(path));
    assert.equal(r.kind, "refused");
    assert.match((r as { message: string }).message, mau);
  }
});

test("mặt tiền: gõ chữ cái KHÔNG ghi đè nốt đã có — nói rõ phải làm gì", () => {
  const r = toCommand({ type: "ENTER_PITCH", step: "D" }, E.notC4, F(E.notC4), NHAP_BAN_DAU);
  assert.equal(r.kind, "refused");
  assert.match((r as { message: string }).message, /đã có nốt/);
});

test("mặt tiền: gõ chữ cái trên lặng cả ô nhịp bị chặn với lời giải thích", () => {
  const r = toCommand({ type: "ENTER_PITCH", step: "D" }, E.langCaO, F(E.langCaO), NHAP_BAN_DAU);
  assert.equal(r.kind, "refused");
  assert.match((r as { message: string }).message, /cả ô nhịp/);
});

test("quãng tám nhập: chưa có mốc thì dùng quãng tám mặc định", () => {
  assert.deepEqual(capDoNhap(NHAP_BAN_DAU, "C"), { step: "C", alter: 0, octave: 4 });
  assert.deepEqual(capDoNhap(NHAP_BAN_DAU, "B"), { step: "B", alter: 0, octave: 4 });
});

test("quãng tám nhập: có mốc thì lấy quãng tám GẦN NHẤT theo mặt chữ (quy ước MuseScore)", () => {
  const tu = (p: Pitch): NoteEntryState => ghiNhoThamChieu(NHAP_BAN_DAU, p);
  // Mốc G4: lên B là quãng ba (gần), xuống B3 là quãng sáu (xa) → B4.
  assert.equal(capDoNhap(tu(P("G", 4)), "B").octave, 4);
  // Mốc G4: C4 cách 4 bậc, C5 cách 3 bậc → C5.
  assert.equal(capDoNhap(tu(P("G", 4)), "C").octave, 5);
  // Mốc C4: B3 cách 1 bậc, B4 cách 6 → B3.
  assert.equal(capDoNhap(tu(P("C", 4)), "B").octave, 3);
  // Không bao giờ quá một quãng bốn rưỡi so với mốc.
  for (const moc of [P("C", 4), P("G", 4), P("E", 5), P("A", 2)])
    for (const step of ["C", "D", "E", "F", "G", "A", "B"] as const)
      assert.ok(
        Math.abs(nuaCung(capDoNhap(tu(moc), step)) - nuaCung(moc)) <= 6,
        `${step} so với ${moc.step}${moc.octave}`
      );
});

test("quãng tám nhập: gõ chữ cái luôn ra nốt TỰ NHIÊN, không đoán theo bộ khoá", () => {
  for (const step of ["C", "F", "B"] as const)
    assert.equal(capDoNhap(NHAP_BAN_DAU, step).alter, 0);
});

test("nhập liên tục: năm chữ cái vào năm dấu lặng ra đúng năm nốt, mốc chạy theo", () => {
  // Bốn ô lặng liền nhau của part 2 (ô 2,3,4) + lặng ô 1 → đủ chỗ nhập liên tục.
  const paths = [E.langTab, "/score-partwise/part[2]/measure[2]/*[1]"];
  let d = createDraft(FIX);
  let nhapState = NHAP_BAN_DAU;
  const gõ = ["A", "C"] as const;
  paths.forEach((path, i) => {
    const r = toCommand({ type: "ENTER_PITCH", step: gõ[i] }, path, readNoteFields(d.xml, path), nhapState);
    assert.equal(r.kind, "command", path);
    const cmd = (r as { command: MusicXmlEditCommand }).command;
    d = applyToDraft(d, cmd);
    nhapState = ghiNhoThamChieu(nhapState, (cmd as { pitch: Pitch }).pitch);
  });
  assert.equal(readNoteFields(d.xml, paths[0])!.pitch!.step, "A");
  assert.equal(readNoteFields(d.xml, paths[1])!.pitch!.step, "C");
  assert.equal(d.commands.length, 2);
});
