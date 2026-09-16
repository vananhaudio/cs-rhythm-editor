/**
 * NHẬP NỐT VÀO CHỖ LẶNG — Giai đoạn 4B.3.
 *
 * Trải nghiệm phải đạt: bấm một dấu lặng, bấm `4` để cầm móc đơn, rồi gõ
 * `C D E F` là ra bốn nốt — không mở form, không chạm chuột lần nữa.
 *
 * Hai điều được khoá chặt nhất ở đây:
 *   1. TRƯỜNG ĐỘ LÀ CÂY BÚT, không phải thao tác. Con trỏ ở dấu lặng thì phím
 *      3–7 KHÔNG đụng bản nhạc; con trỏ ở nốt thì vẫn sửa nốt ấy như 4B.2.
 *   2. Không có bộ máy thời gian hay danh tính nào mới: phần cân lại đi qua
 *      đúng cái lõi đã chạy production từ 4B.2.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand, Pitch } from "../../src/nhipphach/edit/commands.ts";
import {
  applyToDraft,
  createDraft,
  rebuildAll,
  rebuildDraft,
  redo,
  undo,
} from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { idTaiCho } from "../../src/nhipphach/edit/draftIdentity.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { rhythmIssues, structuralIssues } from "../../src/nhipphach/edit/validation.ts";
import { EditError, elementChildren, parseStrict } from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import type { FacadeResult } from "../../src/nhipphach/editor/commandFacade.ts";
import {
  NHAP_BAN_DAU,
  datTruongDo,
  ghiNhoThamChieu,
} from "../../src/nhipphach/editor/noteEntry.ts";
import type { EntryDuration, NoteEntryState } from "../../src/nhipphach/editor/noteEntry.ts";
import type { NoteType } from "../../src/nhipphach/edit/durationModel.ts";

const doc = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const FIX = doc("./fixtures/note-entry.musicxml");
const B = "../musicxml-beats/fixtures/";
const IRR = "../musicxml-irregular/fixtures/";
const GEN = "../musicxml-generalized/fixtures/";

const P = (part: number, measure: number, child: number) =>
  `/score-partwise/part[${part}]/measure[${measure}]/*[${child}]`;
const E = {
  langDen: P(1, 1, 2),
  langMoc1: P(1, 1, 3),
  langMoc2: P(1, 1, 4),
  langTrang: P(1, 1, 5),
  notG4: P(1, 2, 1),
  langGiuaHaiNot: P(1, 2, 2),
  langBe1: P(1, 3, 1),
  be2: P(1, 3, 4),
};
const p = (step: string, octave: number, alter = 0): Pitch => ({ step, alter, octave }) as Pitch;
const nhap = (
  path: string,
  step: string,
  octave: number,
  noteType: NoteType,
  dots = 0
): MusicXmlEditCommand =>
  ({
    type: "InsertNoteIntoRest",
    path,
    pitch: p(step, octave),
    noteType,
    dots,
    accidental: "auto",
  }) as MusicXmlEditCommand;
const ap = (xml: string, cmd: MusicXmlEditCommand) => applyCommand(xml, cmd).xml;
const boLoi = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e as EditError;
  }
};
const thoiLuong = (xml: string) =>
  musicXMLToBeatMap(xml).measures.map((m) => `${m.measureNumber}:${m.actualDuration}`);
const conCua = (xml: string, part: number, measure: number) =>
  elementChildren(
    elementChildren(elementChildren(parseStrict(xml).documentElement!, "part")[part - 1], "measure")[
      measure - 1
    ]
  ).map((c) => c.localName);
const sk = (xml: string) =>
  tagSourceIds(xml).notes.map((n) => `${n.svgId.replace("tva-src-", "")}:${n.kind}:${n.noteType}${n.dots ? "." + n.dots : ""}`);

// ── Ba trường hợp cốt lõi ─────────────────────────────────────────────────

test("BẰNG ĐÚNG: lặng móc đơn + móc đơn → chỉ đổi ruột, KHÔNG đụng số con ô nhịp", () => {
  const truoc = conCua(FIX, 1, 1).length;
  const r = applyCommand(FIX, nhap(E.langMoc1, "C", 5, "eighth"));
  assert.equal(r.changed, true);
  assert.deepEqual(r.structural, [], "không cần sửa cấu trúc thì không được sửa");
  assert.equal(conCua(r.xml, 1, 1).length, truoc);
  const f = readNoteFields(r.xml, E.langMoc1)!;
  assert.equal(f.kind, "note");
  assert.equal(f.noteType, "eighth");
  assert.deepEqual(f.pitch, { step: "C", alter: 0, octave: 5 });
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

test("NGẮN HƠN: lặng đen + móc đơn C → C móc đơn + lặng móc đơn (ví dụ của spec)", () => {
  const r = applyCommand(FIX, nhap(E.langDen, "C", 5, "eighth"));
  assert.deepEqual(r.structural, [{ partIndex: 1, measureIndex: 1, atChildIndex: 3, delta: 1 }]);
  assert.deepEqual(sk(r.xml).slice(0, 3), [
    "p1-m1-c2:note:eighth",
    "p1-m1-c3:rest:eighth",
    "p1-m1-c4:rest:eighth",
  ]);
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
  assert.deepEqual([...rhythmIssues(r.xml)], [...rhythmIssues(FIX)]);
});

test("DÀI HƠN: hai lặng móc đơn + nốt đen → đúng một nốt đen (ví dụ của spec)", () => {
  const r = applyCommand(FIX, nhap(E.langMoc1, "D", 5, "quarter"));
  assert.deepEqual(r.structural, [{ partIndex: 1, measureIndex: 1, atChildIndex: 4, delta: -1 }]);
  assert.deepEqual(sk(r.xml).slice(0, 3), [
    "p1-m1-c2:rest:quarter",
    "p1-m1-c3:note:quarter",
    "p1-m1-c4:rest:half",
  ]);
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

test("ăn MỘT PHẦN: lặng trắng + nốt đen → nốt đen + lặng đen", () => {
  const r = applyCommand(FIX, nhap(E.langTrang, "E", 5, "quarter"));
  const s = sk(r.xml);
  assert.equal(s[3], "p1-m1-c5:note:quarter");
  assert.equal(s[4], "p1-m1-c6:rest:quarter");
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

// ── Chặn ──────────────────────────────────────────────────────────────────

test("KHÔNG đủ chỗ: dừng lại, nói rõ, không đẩy và không xoá nốt thật", () => {
  // Lặng đen ở ô 2 kẹt giữa hai nốt: xin nốt trắng là đụng vào nốt A4.
  const e = boLoi(() => applyCommand(FIX, nhap(E.langGiuaHaiNot, "C", 5, "half")));
  assert.equal(e?.code, "EDIT_REBALANCE_NO_SPACE");
  assert.equal(e!.message, "Không đủ khoảng trống để nhập nốt này.");
});

test("KHÔNG vượt vạch nhịp: hết ô là dừng, không tự nối sang ô sau", () => {
  // Lặng trắng cuối ô 1: xin nốt tròn thì phải sang ô 2 mới đủ → chặn.
  const e = boLoi(() => applyCommand(FIX, nhap(E.langTrang, "C", 5, "whole")));
  assert.equal(e?.code, "EDIT_REBALANCE_NO_SPACE");
  // Và ô nhịp 2 không bị đụng một chữ nào.
  assert.deepEqual(conCua(FIX, 1, 2), ["note", "note", "note"]);
});

test("gõ vào chỗ ĐÃ CÓ NỐT thì lệnh từ chối — không bao giờ ghi đè", () => {
  const e = boLoi(() => applyCommand(FIX, nhap(E.notG4, "C", 5, "quarter")));
  assert.equal(e?.code, "EDIT_INSERT_NOT_A_REST");
  assert.match(e!.message, /đã có nốt/);
});

test("GIAO DỊCH: mọi phép chặn đều không để lại một byte, một lệnh nào", () => {
  let d = createDraft(FIX);
  for (const cmd of [
    nhap(E.langGiuaHaiNot, "C", 5, "half"),
    nhap(E.langTrang, "C", 5, "whole"),
    nhap(E.notG4, "C", 5, "quarter"),
  ])
    assert.throws(() => (d = applyToDraft(d, cmd)));
  assert.equal(d.xml, FIX);
  assert.equal(d.commands.length, 0);
  assert.deepEqual([...d.identity.slots], [...createDraft(FIX).identity.slots]);
});

// ── Dấu hoá đi qua đúng luật 3B ───────────────────────────────────────────

test("DẤU HOÁ theo ngữ cảnh: giọng Sol trưởng, Fa♯ không vẽ dấu, Fa bình có ♮", () => {
  const fis = applyCommand(FIX, nhap(E.langMoc1, "F", 5, "eighth"));
  // Bộ khoá fifths=1 đã có Fa♯; gõ `F` ra Fa TỰ NHIÊN nên phải vẽ dấu bình.
  assert.equal(readNoteFields(fis.xml, E.langMoc1)!.accidental, "natural");
  // Còn Fa♯ thật thì không cần dấu nào.
  const sharp = applyCommand(FIX, {
    type: "InsertNoteIntoRest",
    path: E.langMoc1,
    pitch: p("F", 5, 1),
    noteType: "eighth",
    dots: 0,
    accidental: "auto",
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(sharp.xml, E.langMoc1)!.accidental, null);
});

// ── Danh tính ─────────────────────────────────────────────────────────────

test("DANH TÍNH: nốt mới thừa hưởng chỗ ngồi của dấu lặng; lặng dôi ra có id riêng bền", () => {
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const d0 = createDraft(FIX);
  const idLang = idTaiCho(d0.identity, cho(2))!;
  const idSau = idTaiCho(d0.identity, cho(3))!;

  const d1 = applyToDraft(d0, nhap(E.langDen, "C", 5, "eighth"));
  // Nốt mới ngồi đúng chỗ dấu lặng cũ → giữ nguyên danh tính logic.
  assert.deepEqual(d1.identity.slots.get(idLang), cho(2));
  assert.equal(readNoteFields(d1.xml, P(1, 1, 2))!.kind, "note");
  // Dấu lặng dôi ra là sự kiện MỚI, có id riêng, và nó chen vào chỗ thứ 3.
  const idDoi = idTaiCho(d1.identity, cho(3))!;
  assert.notEqual(idDoi, idLang);
  assert.notEqual(idDoi, idSau);
  // Sự kiện cũ đứng sau lùi đúng một chỗ.
  assert.deepEqual(d1.identity.slots.get(idSau), cho(4));

  // Và cả hai id vẫn trúng đúng chỗ ở lệnh kế tiếp.
  const d2 = applyToDraft(d1, nhap(P(1, 1, d1.identity.slots.get(idDoi)!.childIndex), "D", 5, "eighth"));
  assert.equal(readNoteFields(d2.xml, P(1, 1, 3))!.pitch!.step, "D");
  assert.deepEqual(d2.identity.slots.get(idLang), cho(2));
});

test("DANH TÍNH TẤT ĐỊNH: dựng lại từ gốc cho ra ĐÚNG những id ấy, không phải id mới", () => {
  let d: DraftState = createDraft(FIX);
  d = applyToDraft(d, nhap(E.langDen, "C", 5, "eighth"));
  d = applyToDraft(d, nhap(P(1, 1, 3), "D", 5, "eighth"));
  d = applyToDraft(d, nhap(E.langTrang, "E", 5, "quarter"));
  const lai = rebuildAll(d.original, d.commands);
  assert.equal(lai.xml, d.xml);
  // Từng cặp (id logic → chỗ ngồi) phải trùng khít. Nếu id được sinh ngẫu nhiên
  // ở đâu đó trong lúc áp lệnh thì phép so này đỏ ngay.
  assert.deepEqual([...lai.identity.slots].sort(), [...d.identity.slots].sort());
});

// ── Hoàn tác / làm lại ────────────────────────────────────────────────────

test("HOÀN TÁC: lặng đen → C móc đơn + lặng → D vào chỗ lặng, đi về nhiều vòng", () => {
  let d = createDraft(FIX);
  d = applyToDraft(d, nhap(E.langDen, "C", 5, "eighth"));
  const buoc1 = d.xml;
  d = applyToDraft(d, nhap(P(1, 1, 3), "D", 5, "eighth"));
  const dinh = d.xml;
  assert.deepEqual(sk(d.xml).slice(0, 3), [
    "p1-m1-c2:note:eighth",
    "p1-m1-c3:note:eighth",
    "p1-m1-c4:rest:eighth",
  ]);

  d = undo(d);
  assert.equal(d.xml, buoc1, "D trở lại thành dấu lặng");
  d = undo(d);
  assert.equal(d.xml, FIX, "C trở lại thành dấu lặng đen ban đầu");
  d = redo(redo(d));
  assert.equal(d.xml, dinh);
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
});

test("CHUỖI LỆNH TRỘN: nhập, dịch cao độ, đổi trường độ, sửa lời — không lệnh nào trúng nhầm", () => {
  const cho = (m: number, c: number) => ({ partIndex: 1, measureIndex: m, childIndex: c });
  let d: DraftState = createDraft(FIX);
  const idA4 = idTaiCho(d.identity, cho(2, 3))!; // nốt A4 ở ô nhịp 2

  // 1. Nhập C vào lặng đen ô 1 → sinh thêm một dấu lặng.
  d = applyToDraft(d, nhap(E.langDen, "C", 5, "eighth"));
  const idDoi = idTaiCho(d.identity, cho(1, 3))!;
  // Sự kiện ở ô nhịp KHÁC không nhúc nhích.
  assert.deepEqual(d.identity.slots.get(idA4), cho(2, 3));

  // 2. Nhập D vào chính dấu lặng vừa sinh.
  d = applyToDraft(d, nhap(P(1, 1, d.identity.slots.get(idDoi)!.childIndex), "D", 5, "eighth"));

  // 3. Dịch cao độ nốt C vừa nhập.
  d = applyToDraft(d, {
    type: "ChangePitch",
    path: P(1, 1, 2),
    pitch: p("E", 5),
    accidental: "auto",
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(d.xml, P(1, 1, 2))!.pitch!.step, "E");

  // 4. Đổi trường độ nốt D — đi qua lệnh cân lại của 4B.2.
  d = applyToDraft(d, {
    type: "ChangeDurationAndRebalance",
    path: P(1, 1, 3),
    noteType: "16th",
    dots: 0,
  } as MusicXmlEditCommand);

  // 5. Nốt A4 ở ô 2 vẫn phải tìm được đích danh qua bản đồ, và vẫn là A4.
  const choA4 = d.identity.slots.get(idA4)!;
  assert.equal(choA4.measureIndex, 2);
  assert.equal(readNoteFields(d.xml, P(1, 2, choA4.childIndex))!.pitch!.step, "A");

  assert.equal(d.commands.length, 4);
  const dinh = d.xml;
  for (let i = 0; i < 4; i++) d = undo(d);
  assert.equal(d.xml, FIX);
  assert.deepEqual(d.identity.slots.get(idA4), cho(2, 3));
  for (let i = 0; i < 4; i++) d = redo(d);
  assert.equal(d.xml, dinh);
  assert.deepEqual(thoiLuong(d.xml), thoiLuong(FIX));
});

// ── Bè, hợp âm, dấu nối, TAB ──────────────────────────────────────────────

test("HAI BÈ: nhập vào lặng bè 1, bè 2 và <backup> không đổi một chữ", () => {
  const r = applyCommand(FIX, nhap(E.langBe1, "C", 5, "eighth"));
  assert.equal(readNoteFields(r.xml, E.langBe1)!.pitch!.step, "C");
  // `<backup>` còn nguyên, nốt bè 2 còn nguyên.
  assert.ok(conCua(r.xml, 1, 3).includes("backup"));
  const be2 = tagSourceIds(r.xml).notes.find((n) => n.voice === "2")!;
  assert.equal(be2.pitch!.step, "D");
  assert.equal(be2.noteType, "whole");
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

test("HỢP ÂM và DẤU NỐI: chỗ ấy không phải dấu lặng nên nhập bị chặn ngay", () => {
  const cho = doc("./fixtures/rest-entry.musicxml");
  for (const path of [P(1, 2, 4), P(1, 2, 1)]) {
    const e = boLoi(() =>
      applyCommand(cho, {
        type: "InsertNoteIntoRest",
        path,
        pitch: p("C", 5),
        noteType: "eighth",
        dots: 0,
      } as MusicXmlEditCommand)
    );
    assert.equal(e?.code, "EDIT_INSERT_NOT_A_REST", path);
  }
});

test("TAB: nhập nốt trên khuông TAB bị CHẶN — thà chưa hỗ trợ còn hơn đoán thế bấm", () => {
  // Nốt TAB không có <string>/<fret> thì không đọc được; mà chọn dây/phím nào
  // lại là quyết định ngón tay, phụ thuộc nốt trước nốt sau và thế tay đang
  // giữ. Đoán hộ là đoán sai, nên bước này nói thẳng là chưa hỗ trợ.
  const tab = doc("./fixtures/rest-entry.musicxml");
  const truoc = createDraft(tab);
  let sau = truoc;
  const e = boLoi(
    () =>
      (sau = applyToDraft(truoc, {
        type: "InsertNoteIntoRest",
        path: P(2, 1, 3),
        pitch: p("G", 4),
        noteType: "half",
        dots: 0,
        accidental: "auto",
      } as MusicXmlEditCommand))
  );
  assert.equal(e?.code, "TAB_NOTE_ENTRY_UNSUPPORTED");
  assert.match(e!.message, /khuông TAB/);
  assert.match(e!.message, /sẽ được làm riêng/);
  // GIAO DỊCH: không một byte, không một lệnh, bản đồ danh tính đứng yên.
  assert.equal(sau, truoc);
  assert.equal(sau.xml, tab);
  assert.equal(sau.commands.length, 0);
  assert.deepEqual([...sau.identity.slots], [...truoc.identity.slots]);
  // Nốt TAB có sẵn không bị đụng tới.
  assert.deepEqual(readNoteFields(sau.xml, P(2, 1, 2))!.tab, { string: 1, fret: 0 });
});

test("TAB: chặn ĐÚNG khuông TAB thôi — khuông nhạc thường vẫn nhập bình thường", () => {
  // Cùng một file, cùng một lệnh, chỉ khác khuông: hai kết quả khác nhau.
  const tab = doc("./fixtures/rest-entry.musicxml");
  const r = applyCommand(tab, {
    type: "InsertNoteIntoRest",
    path: P(1, 1, 3),
    pitch: p("G", 4),
    noteType: "eighth",
    dots: 0,
    accidental: "auto",
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(r.xml, P(1, 1, 3))!.pitch!.step, "G");
});

test("LẶNG CẢ Ô NHỊP vẫn bị chặn — chưa viết lại trường độ cả ô", () => {
  const cho = doc("./fixtures/rest-entry.musicxml");
  const e = boLoi(() =>
    applyCommand(cho, {
      type: "InsertNoteIntoRest",
      path: P(1, 3, 1),
      pitch: p("C", 5),
      noteType: "quarter",
      dots: 0,
    } as MusicXmlEditCommand)
  );
  assert.equal(e?.code, "EDIT_REBALANCE_MEASURE_REST");
});

// ── Phạm vi diff ──────────────────────────────────────────────────────────

test("DIFF chỉ nằm ở dấu lặng đích và các dấu lặng của chính giao dịch", () => {
  const r = applyCommand(FIX, nhap(E.langDen, "C", 5, "eighth"));
  const duoi = (s: string) => s.slice(s.indexOf('<measure number="2">'));
  assert.equal(duoi(r.xml), duoi(FIX), "ô nhịp 2 trở đi byte-identical");
  const attr = (s: string) => s.match(/<attributes>[\s\S]*?<\/attributes>/)![0];
  assert.equal(attr(r.xml), attr(FIX));
});

// ── Mọi loại nhịp ─────────────────────────────────────────────────────────

test("nhịp nào cũng nhập được, và không ô nào sinh thiếu / thừa phách", () => {
  const bai: [string, string][] = [
    ["4/4 (fixture 4B.3)", FIX],
    ["3/4", doc(B + "simple-3-4.musicxml")],
    ["lấy đà 4/4", doc(B + "pickup-quarter.musicxml")],
    ["6/8 lấy đà", doc(B + "pickup-eighth.musicxml")],
    ["9/8", doc(GEN + "basic-9-8.musicxml")],
    ["9/8 lặng tròn", doc(GEN + "whole-rest-9-8.musicxml")],
    ["12/8 lấy đà", doc(GEN + "pickup-12-8.musicxml")],
    ["5/8 (2+3)", doc(IRR + "five-2-3.musicxml")],
    ["5/8 (3+2)", doc(IRR + "five-3-2.musicxml")],
    ["7/8 (2+2+3)", doc(IRR + "seven-2-2-3.musicxml")],
    ["lặng đủ kiểu", doc(B + "rests.musicxml")],
  ];
  let thu = 0;
  for (const [ten, xml] of bai) {
    const truoc = thoiLuong(xml);
    const nhipTruoc = [...rhythmIssues(xml)];
    for (const n of tagSourceIds(xml).notes) {
      if (n.kind !== "rest") continue;
      for (const t of ["16th", "eighth", "quarter", "half"] as NoteType[]) {
        let sau: string;
        try {
          sau = ap(xml, nhap(n.path, "C", 5, t));
        } catch (e) {
          assert.ok(e instanceof EditError, `${ten}: lỗi lạ ${String(e)}`);
          continue;
        }
        thu++;
        assert.deepEqual(thoiLuong(sau), truoc, `${ten} · ${n.svgId} · ${t}`);
        assert.deepEqual([...rhythmIssues(sau)], nhipTruoc, `${ten} · ${n.svgId} · ${t}`);
        assert.deepEqual(
          structuralIssues(parseStrict(sau)),
          structuralIssues(parseStrict(xml)),
          `${ten} · ${n.svgId} · ${t}`
        );
      }
    }
  }
  assert.ok(thu > 30, `chỉ nhập thật được ${thu} lượt — quá ít để tin`);
  console.log(`    · đã nhập thật ${thu} lượt trên ${bai.length} loại nhịp`);
});

// ── Mặt tiền: hai chế độ của phím trường độ ───────────────────────────────

const F = (path: string, xml = FIX) => readNoteFields(xml, path);

test("PHÍM TRƯỜNG ĐỘ ở DẤU LẶNG: chỉ đổi cây bút, KHÔNG sinh lệnh nào", () => {
  for (const t of ["16th", "eighth", "quarter", "half", "whole"] as NoteType[]) {
    const r = toCommand({ type: "SET_DURATION", noteType: t }, E.langDen, F(E.langDen), NHAP_BAN_DAU);
    assert.equal(r.kind, "toolState", t);
    assert.deepEqual((r as { truongDo: EntryDuration }).truongDo, { noteType: t, dots: 0 });
  }
  // Chấm dôi cũng vậy: bật / tắt trên cây bút, không đụng dấu lặng.
  const bat = toCommand({ type: "TOGGLE_DOT" }, E.langDen, F(E.langDen), NHAP_BAN_DAU);
  assert.deepEqual((bat as { truongDo: EntryDuration }).truongDo, { noteType: "quarter", dots: 1 });
  const co = datTruongDo(NHAP_BAN_DAU, { noteType: "quarter", dots: 1 });
  const tat = toCommand({ type: "TOGGLE_DOT" }, E.langDen, F(E.langDen), co);
  assert.deepEqual((tat as { truongDo: EntryDuration }).truongDo, { noteType: "quarter", dots: 0 });
});

test("PHÍM TRƯỜNG ĐỘ ở NỐT: vẫn sửa chính nốt ấy như 4B.2 — hai chế độ tách bạch", () => {
  const r = toCommand({ type: "SET_DURATION", noteType: "eighth" }, E.notG4, F(E.notG4), NHAP_BAN_DAU);
  assert.equal(r.kind, "command");
  assert.equal(
    (r as { command: MusicXmlEditCommand }).command.type,
    "ChangeDurationAndRebalance"
  );
  const d = toCommand({ type: "TOGGLE_DOT" }, E.notG4, F(E.notG4), NHAP_BAN_DAU);
  assert.equal((d as { command: MusicXmlEditCommand }).command.type, "ChangeDurationAndRebalance");
});

test("mặt tiền chọn đúng lệnh: bằng đúng → 4B.1, khác → 4B.3", () => {
  const moc = datTruongDo(NHAP_BAN_DAU, { noteType: "eighth", dots: 0 });
  // Cây bút móc đơn, dấu lặng móc đơn → không cần giao dịch cấu trúc.
  const bang = toCommand({ type: "ENTER_PITCH", step: "C" }, E.langMoc1, F(E.langMoc1), moc);
  assert.equal((bang as { command: MusicXmlEditCommand }).command.type, "ReplaceRestWithNote");
  // Cây bút móc đơn, dấu lặng đen → phải cân lại.
  const khac = toCommand({ type: "ENTER_PITCH", step: "C" }, E.langDen, F(E.langDen), moc);
  const cmd = (khac as { command: MusicXmlEditCommand }).command;
  assert.equal(cmd.type, "InsertNoteIntoRest");
  assert.equal((cmd as { noteType: string }).noteType, "eighth");
});

test("mặt tiền: gõ chữ cái vào chỗ ĐÃ CÓ NỐT vẫn bị từ chối, có lời chỉ dẫn", () => {
  const r = toCommand({ type: "ENTER_PITCH", step: "C" }, E.notG4, F(E.notG4), NHAP_BAN_DAU);
  assert.equal(r.kind, "refused");
  assert.match((r as { message: string }).message, /đã có nốt/);
});

// ── Nhập liên tục và gõ nhanh ─────────────────────────────────────────────

/** Mô phỏng ĐÚNG vòng lặp của trang: mặt tiền → lệnh → nháp → con trỏ chạy. */
function goPhim(
  d: DraftState,
  caret: string,
  nhapState: NoteEntryState,
  action: Parameters<typeof toCommand>[0]
): { d: DraftState; caret: string; nhapState: NoteEntryState; ra: FacadeResult } {
  const truong = readNoteFields(d.xml, caret);
  const ra = toCommand(action, caret, truong, nhapState);
  if (ra.kind === "toolState") return { d, caret, nhapState: datTruongDo(nhapState, ra.truongDo), ra };
  if (ra.kind !== "command") return { d, caret, nhapState, ra };
  const sau = applyToDraft(d, ra.command);
  let st = nhapState;
  const cmd = ra.command as { pitch?: Pitch };
  if (cmd.pitch) st = ghiNhoThamChieu(st, cmd.pitch);
  // Con trỏ chạy tiếp, đọc từ NHÁP ĐỒNG BỘ — đúng như `dsSauLenh` của trang.
  const ds = tagSourceIds(sau.xml).notes;
  const i = ds.findIndex((n) => n.path === caret);
  const tiep = action.type === "ENTER_PITCH" && i >= 0 && i + 1 < ds.length ? ds[i + 1].path : caret;
  return { d: sau, caret: tiep, nhapState: st, ra };
}

test("NHẬP LIÊN TỤC: bấm 4 rồi gõ C D E F ra bốn móc đơn, con trỏ tự chạy", () => {
  let st = { d: createDraft(FIX), caret: E.langDen, nhapState: NHAP_BAN_DAU };
  // Bấm `4`: chỉ đổi cây bút, bản nhạc chưa đổi một byte.
  const sauBut = goPhim(st.d, st.caret, st.nhapState, { type: "SET_DURATION", noteType: "eighth" });
  assert.equal(sauBut.ra.kind, "toolState");
  assert.equal(sauBut.d.xml, FIX, "chọn cây bút KHÔNG được chạm bản nhạc");
  st = { d: sauBut.d, caret: sauBut.caret, nhapState: sauBut.nhapState };

  for (const step of ["C", "D", "E", "F"] as const)
    st = goPhim(st.d, st.caret, st.nhapState, { type: "ENTER_PITCH", step });

  assert.equal(st.d.commands.length, 4, "bốn chữ cái ra bốn lệnh");
  assert.deepEqual(sk(st.d.xml).slice(0, 5), [
    "p1-m1-c2:note:eighth",
    "p1-m1-c3:note:eighth",
    "p1-m1-c4:note:eighth",
    "p1-m1-c5:note:eighth",
    "p1-m1-c6:rest:half",
  ]);
  assert.deepEqual(thoiLuong(st.d.xml), thoiLuong(FIX));
  // Bốn nốt đi lên theo quy ước quãng tám gần nhất, không nhảy quãng tám.
  const cao = [2, 3, 4, 5].map((c) => readNoteFields(st.d.xml, P(1, 1, c))!.pitch!);
  assert.deepEqual(
    cao.map((x) => x.step),
    ["C", "D", "E", "F"]
  );
  assert.equal(new Set(cao.map((x) => x.octave)).size, 1, "cùng một quãng tám");
});

test("GÕ NHANH: tám chữ cái liên tiếp ra tám lệnh, không mất, không đảo", () => {
  // Một ô nhịp rỗng hẳn để có đủ tám chỗ móc đơn.
  const rong = FIX.replace(
    /<note>\s*<rest\/>\s*<duration>4<\/duration>\s*<voice>1<\/voice>\s*<type>quarter<\/type>\s*<\/note>[\s\S]*?<type>half<\/type>\s*<\/note>/,
    "<note><rest/><duration>16</duration><voice>1</voice><type>whole</type></note>"
  );
  assert.notEqual(rong, FIX, "không dựng được ô nhịp rỗng");
  let st = { d: createDraft(rong), caret: P(1, 1, 2), nhapState: datTruongDo(NHAP_BAN_DAU, { noteType: "eighth", dots: 0 }) };
  const go = ["C", "D", "E", "F", "G", "A", "B", "C"] as const;
  // KHÔNG có lần khắc nào ở giữa: mọi lệnh đọc từ chính bản nháp vừa rồi.
  for (const step of go) st = goPhim(st.d, st.caret, st.nhapState, { type: "ENTER_PITCH", step });
  assert.equal(st.d.commands.length, 8);
  const ds = tagSourceIds(st.d.xml).notes.slice(0, 8);
  assert.deepEqual(
    ds.map((n) => n.pitch!.step),
    [...go]
  );
  assert.ok(ds.every((n) => n.kind === "note" && n.noteType === "eighth"));
  assert.deepEqual(thoiLuong(st.d.xml), thoiLuong(rong));
  assert.equal(st.d.xml, rebuildDraft(st.d.original, st.d.commands));
});

test("con trỏ sau khi nhập tới ĐÚNG dấu lặng dôi ra, không nhảy qua nó", () => {
  const st = goPhim(
    createDraft(FIX),
    E.langDen,
    datTruongDo(NHAP_BAN_DAU, { noteType: "eighth", dots: 0 }),
    { type: "ENTER_PITCH", step: "C" }
  );
  assert.equal(st.caret, P(1, 1, 3), "phải là dấu lặng vừa sinh, không phải sự kiện cũ");
  assert.equal(readNoteFields(st.d.xml, st.caret)!.kind, "rest");
});

// ── Ngữ nghĩa của logicalId: CHỖ NGỒI trên dòng thời gian ─────────────────

test("logicalId là MỘT CHỖ NGỒI, không phải một nốt cố định: lặng R → nốt R là hợp lệ", () => {
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  let d: DraftState = createDraft(FIX);
  const R = idTaiCho(d.identity, cho(2))!;

  // R là dấu lặng… rồi thành nốt… rồi vẫn là R suốt chuỗi lệnh sau đó.
  d = applyToDraft(d, nhap(E.langDen, "C", 5, "eighth"));
  assert.deepEqual(d.identity.slots.get(R), cho(2));
  assert.equal(readNoteFields(d.xml, P(1, 1, 2))!.kind, "note");

  d = applyToDraft(d, {
    type: "ChangePitch",
    path: P(1, 1, d.identity.slots.get(R)!.childIndex),
    pitch: p("G", 5),
    accidental: "auto",
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(d.xml, P(1, 1, 2))!.pitch!.step, "G");

  d = applyToDraft(d, {
    type: "ChangeDurationAndRebalance",
    path: P(1, 1, d.identity.slots.get(R)!.childIndex),
    noteType: "16th",
    dots: 0,
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(d.xml, P(1, 1, 2))!.noteType, "16th");

  const dinh = d.xml;
  for (let i = 0; i < 3; i++) d = undo(d);
  assert.equal(d.xml, FIX);
  assert.deepEqual(d.identity.slots.get(R), cho(2), "hoàn tác hết thì R về đúng chỗ cũ");
  for (let i = 0; i < 3; i++) d = redo(d);
  assert.equal(d.xml, dinh);
  assert.deepEqual(d.identity.slots.get(R), cho(2));
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
});

test("DỰNG LẠI HAI LẦN cho ra bản đồ danh tính GIỐNG HỆT — không id ngẫu nhiên ở đâu cả", () => {
  let d: DraftState = createDraft(FIX);
  d = applyToDraft(d, nhap(E.langDen, "C", 5, "eighth"));
  d = applyToDraft(d, nhap(P(1, 1, 3), "D", 5, "eighth"));
  d = applyToDraft(d, nhap(E.langTrang, "E", 5, "quarter"));
  const a = rebuildAll(d.original, d.commands);
  const b = rebuildAll(d.original, d.commands);
  assert.deepEqual([...a.identity.slots].sort(), [...b.identity.slots].sort());
  assert.deepEqual([...a.identity.slots].sort(), [...d.identity.slots].sort());
  // Và không id nào mang dạng ngẫu nhiên.
  for (const k of a.identity.slots.keys())
    assert.match(k, /^(g:\d+\/\d+\/\d+|n:\d+\/\d+)$/, `id lạ: ${k}`);
});

test("ĐỘT BIẾN: bỏ phần dịch cấu trúc thì lệnh kế tiếp trúng nhầm sự kiện", () => {
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const d0 = createDraft(FIX);
  const idSau = idTaiCho(d0.identity, cho(3))!; // dấu lặng móc đơn đứng sau
  const d1 = applyToDraft(d0, nhap(E.langDen, "C", 5, "eighth"));

  // Đường ĐÚNG: hỏi bản đồ → con thứ 4.
  assert.deepEqual(d1.identity.slots.get(idSau), cho(4));
  // Đường ĐỘT BIẾN: giữ nguyên bản đồ cũ → con thứ 3, là dấu lặng VỪA SINH.
  const quen = d0.identity.slots.get(idSau)!;
  assert.deepEqual(quen, cho(3));
  assert.notDeepEqual(quen, d1.identity.slots.get(idSau));
});

test("mặt tiền: nhập trên khuông TAB bị từ chối NGAY, cả khi trường độ trùng khít", () => {
  const tab = doc("./fixtures/rest-entry.musicxml");
  const r = toCommand(
    { type: "ENTER_PITCH", step: "C" },
    P(2, 1, 3),
    readNoteFields(tab, P(2, 1, 3)),
    datTruongDo(NHAP_BAN_DAU, { noteType: "half", dots: 0 })
  );
  assert.equal(r.kind, "refused");
  assert.match((r as { message: string }).message, /khuông TAB/);
  assert.match((r as { message: string }).message, /sẽ được làm riêng/);
});
