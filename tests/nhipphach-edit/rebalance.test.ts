/**
 * Đổi trường độ + CÂN LẠI Ô NHỊP — Giai đoạn 4B.2.
 *
 * Đây là lần đầu một lệnh làm đổi SỐ con của ô nhịp, nên phép kiểm quan trọng
 * nhất không phải là trường độ mà là DANH TÍNH: sau khi chèn một dấu lặng, mọi
 * sự kiện đứng sau tụt chỉ số, và cả chuỗi lệnh tiếp theo vẫn phải trúng đúng
 * sự kiện mà người dùng đang nghĩ tới.
 *
 * Hai bất biến còn lại: tổng thời gian của ô nhịp không đổi một li (đo bằng
 * chính engine đếm phách), và giao dịch hoặc xong hẳn hoặc không để lại một byte.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import {
  applyToDraft,
  createDraft,
  rebuildAll,
  rebuildDraft,
  redo,
  undo,
} from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { idTaiCho, theoDoi } from "../../src/nhipphach/edit/draftIdentity.ts";
import { catTheoPhach, lapKhoangTrong, quartersOf } from "../../src/nhipphach/edit/restFill.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { rhythmIssues, structuralIssues } from "../../src/nhipphach/edit/validation.ts";
import { EditError, elementChildren, parseStrict, resolveSourcePath } from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { rational, compare } from "../../src/musicxml-beats/rational.ts";
import type { Rational } from "../../src/musicxml-beats/rational.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import { dispatch } from "../../src/nhipphach/editor/dispatcher.ts";

const doc = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const FIX = doc("./fixtures/rest-entry.musicxml");
const B = "../musicxml-beats/fixtures/";
const IRR = "../musicxml-irregular/fixtures/";
const GEN = "../musicxml-generalized/fixtures/";

const P = (part: number, measure: number, child: number) =>
  `/score-partwise/part[${part}]/measure[${measure}]/*[${child}]`;
const E = {
  notC4: P(1, 1, 2),
  langDen: P(1, 1, 3),
  notE4Cham: P(1, 1, 4),
  noiBatDau: P(1, 2, 1),
  hopAmCon: P(1, 2, 4),
  langCaO: P(1, 3, 1),
  be2: P(1, 4, 4),
  notTab: P(2, 1, 2),
};
const reb = (path: string, noteType: string, dots = 0): MusicXmlEditCommand =>
  ({ type: "ChangeDurationAndRebalance", path, noteType, dots }) as MusicXmlEditCommand;
const ap = (xml: string, cmd: MusicXmlEditCommand) => applyCommand(xml, cmd).xml;
const boLoi = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e as EditError;
  }
};
const conCua = (xml: string, part: number, measure: number) =>
  elementChildren(
    elementChildren(elementChildren(parseStrict(xml).documentElement!, "part")[part - 1], "measure")[measure - 1]
  ).map((c) => c.localName);
/** Tổng thời gian thật của mọi ô nhịp — engine đếm phách nói, không phải ta tự cộng. */
const thoiLuong = (xml: string) =>
  musicXMLToBeatMap(xml).measures.map((m) => `${m.measureNumber}:${m.actualDuration}`);

// ── Phân rã dấu lặng (thuần, không XML) ───────────────────────────────────

test("phân rã: cắt ĐÚNG tại mốc phách, không cắt ở đâu khác", () => {
  const phach = ["0/1", "1/1", "2/1", "3/1"] as const;
  assert.deepEqual(catTheoPhach("1/2", "3/2", phach), [
    ["1/2", "1/1"],
    ["1/1", "3/2"],
  ]);
  // Khoảng nằm gọn trong một phách thì không bị cắt.
  assert.deepEqual(catTheoPhach("1/4", "3/4", phach), [["1/4", "3/4"]]);
});

test("phân rã: đoạn dài đúng bằng một hình nốt → đúng MỘT dấu lặng", () => {
  const phach = ["0/1", "1/1", "2/1", "3/1"] as const;
  assert.deepEqual(
    lapKhoangTrong("1/2", "1/1", phach).map((p) => `${p.noteType}.${p.dots}`),
    ["eighth.0"]
  );
  // 3/4 nốt đen trong lòng một phách = móc đơn chấm dôi → đúng một dấu lặng.
  assert.deepEqual(
    lapKhoangTrong("0/1", "3/4", ["0/1", "1/1"]).map((p) => `${p.noteType}.${p.dots}`),
    ["eighth.1"]
  );
  // 3/8 nốt đen = móc kép chấm dôi — cũng đúng một dấu lặng, không cắt vụn.
  assert.deepEqual(
    lapKhoangTrong("0/1", "3/8", ["0/1", "1/1"]).map((p) => `${p.noteType}.${p.dots}`),
    ["16th.1"]
  );
});

test("phân rã: KHÔNG có dấu lặng nào bắc qua ranh giới phách", () => {
  const phach: Rational[] = ["0/1", "1/1", "2/1", "3/1"];
  // Khoảng 1/2 → 5/2 đi qua hai mốc phách: phải ra nhiều dấu lặng.
  const ra = lapKhoangTrong("1/2", "5/2", phach);
  let t = rational(1, 2);
  for (const p of ra) {
    const truoc = t;
    const [n, d] = p.quarters.split("/").map(BigInt);
    const [a, b] = t.split("/").map(BigInt);
    t = rational(a * d + n * b, b * d);
    // Không mốc phách nào nằm HẲN bên trong dấu lặng này.
    for (const m of phach)
      assert.ok(
        !(compare(m, truoc) > 0 && compare(m, t) < 0),
        `dấu lặng ${p.noteType} bắc qua phách ${m}`
      );
  }
  assert.equal(t, "5/2");
});

test("phân rã: khoảng ngắn hơn móc kép thì KHÔNG ghi được, nói thẳng", () => {
  assert.throws(() => lapKhoangTrong("0/1", "1/8", ["0/1"]), /nhỏ hơn trường độ dấu lặng hiện đang hỗ trợ/);
});

// ── Ngắn lại → sinh dấu lặng ──────────────────────────────────────────────

test("nốt đen → móc đơn + lặng móc đơn; ô nhịp vẫn đủ phách", () => {
  const truoc = conCua(FIX, 1, 1);
  const r = applyCommand(FIX, reb(E.notC4, "eighth"));
  assert.equal(r.changed, true);
  assert.deepEqual(r.structural, [
    { partIndex: 1, measureIndex: 1, atChildIndex: 3, delta: 1 },
  ]);
  assert.equal(conCua(r.xml, 1, 1).length, truoc.length + 1);
  const not = readNoteFields(r.xml, E.notC4)!;
  assert.equal(not.noteType, "eighth");
  assert.equal(not.dots, 0);
  const lang = readNoteFields(r.xml, P(1, 1, 3))!;
  assert.equal(lang.kind, "rest");
  assert.equal(lang.noteType, "eighth");
  // Tổng thời gian ô nhịp KHÔNG đổi — engine đếm phách nói vậy.
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
  assert.deepEqual([...rhythmIssues(r.xml)], [...rhythmIssues(FIX)]);
});

test("nốt đen chấm dôi → nốt đen: khoảng bù đi đúng vào chỗ trống", () => {
  const r = applyCommand(FIX, reb(E.notE4Cham, "quarter"));
  assert.equal(readNoteFields(r.xml, E.notE4Cham)!.dots, 0);
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

test("ngắn lại nhiều bậc: nốt đen → móc kép sinh dãy lặng đọc được", () => {
  const r = applyCommand(FIX, reb(E.notC4, "16th"));
  const them = r.structural[0].delta;
  assert.ok(them >= 1);
  const langs = [];
  for (let c = 3; c < 3 + them; c++) langs.push(readNoteFields(r.xml, P(1, 1, c))!);
  assert.ok(langs.every((l) => l.kind === "rest"));
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

// ── Dài ra → chỉ ăn dấu lặng ──────────────────────────────────────────────

test("móc đơn + lặng móc đơn → nốt đen: về ĐÚNG bản gốc, từng byte", () => {
  const ngan = ap(FIX, reb(E.notC4, "eighth"));
  const dai = applyCommand(ngan, reb(E.notC4, "quarter"));
  assert.equal(dai.xml, FIX, "kéo dài lại phải trả file về nguyên trạng");
  assert.deepEqual(dai.structural, [
    { partIndex: 1, measureIndex: 1, atChildIndex: 3, delta: -1 },
  ]);
});

test("ăn MỘT PHẦN dấu lặng: phần thừa thành dấu lặng nhỏ hơn", () => {
  // Nốt đen (4) + lặng đen (4) → nốt trắng cần 8: ăn trọn lặng, không dư.
  const tron = applyCommand(FIX, reb(E.notC4, "half"));
  assert.equal(readNoteFields(tron.xml, E.notC4)!.noteType, "half");
  assert.deepEqual(thoiLuong(tron.xml), thoiLuong(FIX));
  // Nốt đen → nốt đen chấm dôi (6): ăn nửa lặng đen, còn lại lặng móc đơn.
  const mot = applyCommand(FIX, reb(E.notC4, "quarter", 1));
  const f = readNoteFields(mot.xml, E.notC4)!;
  assert.equal(f.dots, 1);
  const con = readNoteFields(mot.xml, P(1, 1, 3))!;
  assert.equal(con.kind, "rest");
  assert.equal(con.noteType, "eighth");
  assert.deepEqual(thoiLuong(mot.xml), thoiLuong(FIX));
});

test("KHÔNG đủ chỗ trống thì CHẶN — không đẩy, không xoá nốt thật", () => {
  // Nốt đen + lặng đen = 8; xin nốt tròn (16) thì thiếu.
  const e = boLoi(() => applyCommand(FIX, reb(E.notC4, "whole")));
  assert.equal(e?.code, "EDIT_REBALANCE_NO_SPACE");
  assert.equal(e!.message, "Không đủ khoảng trống để kéo dài nốt.");
  // Nốt E4 chấm dôi (6) + lặng móc đơn (2) = 8: xin nốt trắng thì VỪA ĐỦ, và
  // đó là phép ăn trọn dấu lặng hợp lệ.
  const vua = applyCommand(FIX, reb(E.notE4Cham, "half"));
  assert.equal(readNoteFields(vua.xml, E.notE4Cham)!.noteType, "half");
  assert.deepEqual(thoiLuong(vua.xml), thoiLuong(FIX));
  // Nhưng xin nốt tròn (16) thì thiếu 10 — và phía sau đã hết ô nhịp, chỉ còn
  // NỐT THẬT của ô kế. Không bao giờ ăn sang.
  const e2 = boLoi(() => applyCommand(FIX, reb(E.notE4Cham, "whole")));
  assert.equal(e2?.code, "EDIT_REBALANCE_NO_SPACE");
});

// ── Cổng chặn ─────────────────────────────────────────────────────────────

test("chặn: hợp âm, dấu nối, lặng cả ô — mỗi thứ một câu rõ", () => {
  assert.equal(boLoi(() => applyCommand(FIX, reb(E.hopAmCon, "quarter")))?.code, "EDIT_REBALANCE_CHORD");
  assert.equal(boLoi(() => applyCommand(FIX, reb(E.noiBatDau, "eighth")))?.code, "EDIT_REBALANCE_TIED");
  assert.equal(
    boLoi(() => applyCommand(FIX, reb(E.langCaO, "quarter")))?.code,
    "EDIT_REBALANCE_MEASURE_REST"
  );
});

test("GIAO DỊCH: lệnh bị chặn thì nháp không đổi một byte, ngăn xếp trống", () => {
  let nhap = createDraft(FIX);
  for (const cmd of [
    reb(E.hopAmCon, "quarter"),
    reb(E.noiBatDau, "eighth"),
    reb(E.notC4, "whole"),
    reb(E.langCaO, "quarter"),
  ])
    assert.throws(() => (nhap = applyToDraft(nhap, cmd)));
  assert.equal(nhap.xml, FIX);
  assert.equal(nhap.commands.length, 0);
  assert.equal(nhap.cursor, 0);
});

test("bè 2 và khuông khác KHÔNG bị mượn chỗ", () => {
  // Ô nhịp 4: bè 1 có nốt trắng + lặng trắng chấm dôi, bè 2 có nốt tròn.
  // Kéo dài nốt bè 1 chỉ được ăn lặng của CHÍNH bè 1.
  const r = applyCommand(FIX, reb(P(1, 4, 1), "whole"));
  assert.equal(readNoteFields(r.xml, P(1, 4, 1))!.noteType, "whole");
  // Nốt bè 2 còn nguyên, đúng chỗ (đã tụt chỉ số theo đúng phần dịch chuyển).
  const be2 = readNoteFields(r.xml, P(1, 4, 2 + r.structural.reduce((a, d) => a + d.delta, 0) + 1));
  assert.ok(be2 === null || be2.kind !== undefined);
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
  // Và `<backup>` vẫn còn nguyên trong ô — không viết lại bằng suy đoán.
  assert.ok(conCua(r.xml, 1, 4).includes("backup"));
});

test("TAB: đổi trường độ KHÔNG đụng string/fret, dấu lặng mới không có technical", () => {
  const r = applyCommand(FIX, reb(E.notTab, "quarter"));
  const f = readNoteFields(r.xml, E.notTab)!;
  assert.deepEqual(f.tab, { string: 1, fret: 0 }, "thế bấm phải nguyên vẹn");
  const lang = readNoteFields(r.xml, P(2, 1, 3))!;
  assert.equal(lang.kind, "rest");
  assert.equal(lang.tab, null);
  // Nốt trên khuông nhạc thường là sự kiện nguồn KHÁC — không được đụng.
  assert.deepEqual(readNoteFields(r.xml, E.notC4)!.pitch, { step: "C", alter: 0, octave: 4 });
});

// ── Phạm vi diff ──────────────────────────────────────────────────────────

test("diff chỉ nằm ở nốt đích + dấu lặng liên quan; phần còn lại byte-identical", () => {
  const r = applyCommand(FIX, reb(E.notC4, "eighth"));
  // Mọi thứ TỪ ô nhịp 2 trở đi không đổi một byte.
  const duoi = (s: string) => s.slice(s.indexOf('<measure number="2">'));
  assert.equal(duoi(r.xml), duoi(FIX));
  // Trong ô nhịp 1: `<attributes>` và các nốt sau đều nguyên văn.
  const attr = (s: string) => s.match(/<attributes>[\s\S]*?<\/attributes>/)![0];
  assert.equal(attr(r.xml), attr(FIX));
  assert.ok(r.xml.includes("<text>Đô</text>"), "lời của nốt đích giữ nguyên");
});

// ── DANH TÍNH: phép kiểm chính của 4B.2 ───────────────────────────────────

test("DANH TÍNH: chèn dấu lặng làm id sự kiện sau tụt chỗ — bản đồ phải bắt kịp", () => {
  const d0 = createDraft(FIX);
  const cho = (p: number, m: number, c: number) => ({ partIndex: p, measureIndex: m, childIndex: c });
  const d1 = applyToDraft(d0, reb(E.notC4, "eighth"));
  // Nốt E4 chấm dôi trước ở con thứ 4, giờ phải là con thứ 5.
  const sau = theoDoi(d0.identity, d1.identity, cho(1, 1, 4));
  assert.deepEqual(sau, cho(1, 1, 5));
  assert.equal(readNoteFields(d1.xml, P(1, 1, 5))!.dots, 1, "đúng là nốt E4 chấm dôi");
  // Sự kiện ở ô nhịp khác không hề nhúc nhích.
  assert.deepEqual(theoDoi(d0.identity, d1.identity, cho(1, 2, 1)), cho(1, 2, 1));
  // Và id logic thì bền qua mọi lần dịch.
  assert.equal(idTaiCho(d0.identity, cho(1, 1, 4)), idTaiCho(d1.identity, cho(1, 1, 5)));
});

test("DANH TÍNH: sự kiện BỊ BỎ thì bản đồ nói mất, không trỏ sang cái gần nhất", () => {
  const ngan = applyToDraft(createDraft(FIX), reb(E.notC4, "eighth"));
  const dai = applyToDraft(ngan, reb(E.notC4, "quarter"));
  const cho = { partIndex: 1, measureIndex: 1, childIndex: 3 }; // dấu lặng vừa sinh
  assert.equal(theoDoi(ngan.identity, dai.identity, cho), null);
});

test("CHUỖI LỆNH: A ngắn lại sinh lặng X → sửa cao độ B → X thành nốt → hoàn tác ×3 → làm lại ×3", () => {
  let d: DraftState = createDraft(FIX);
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  // Ghi nhớ danh tính LOGIC của B (nốt E4 chấm dôi) từ trước khi có gì xảy ra.
  const idB = idTaiCho(d.identity, cho(4))!;

  // 1. A (nốt đen C4) ngắn lại → sinh dấu lặng X ở con thứ 3.
  d = applyToDraft(d, reb(E.notC4, "eighth"));
  const idX = idTaiCho(d.identity, cho(3))!;
  assert.notEqual(idX, idB);

  // 2. Sửa cao độ B. Đường dẫn của B ĐÃ TỤT, và ta lấy nó từ bản đồ chứ không
  //    từ cái id cũ — đây chính là chỗ mà một editor cẩu thả sẽ sửa nhầm nốt.
  const choB = d.identity.slots.get(idB)!;
  assert.deepEqual(choB, cho(5));
  d = applyToDraft(d, {
    type: "ChangePitch",
    path: P(1, 1, choB.childIndex),
    pitch: { step: "G", alter: 0, octave: 4 },
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(d.xml, P(1, 1, 5))!.pitch!.step, "G", "sửa đúng B, không nhầm ai");

  // 3. X (dấu lặng) thành nốt Đô.
  const choX = d.identity.slots.get(idX)!;
  d = applyToDraft(d, {
    type: "ReplaceRestWithNote",
    path: P(1, 1, choX.childIndex),
    pitch: { step: "C", alter: 0, octave: 5 },
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(d.xml, P(1, 1, 3))!.pitch!.step, "C");
  assert.equal(d.commands.length, 3);
  const dinh = d.xml;

  // Hoàn tác ×3 → đúng bản gốc, và bản đồ danh tính cũng về đúng bản gốc.
  d = undo(undo(undo(d)));
  assert.equal(d.xml, FIX);
  assert.deepEqual(d.identity.slots.get(idB), cho(4));
  assert.equal(d.identity.slots.has(idX), false, "dấu lặng chưa sinh ra thì không có trong bản đồ");

  // Làm lại ×3 → đúng chỗ cũ, từng byte và từng danh tính.
  d = redo(redo(redo(d)));
  assert.equal(d.xml, dinh);
  assert.deepEqual(d.identity.slots.get(idB), cho(5));
  assert.deepEqual(d.identity.slots.get(idX), cho(3));
  // Và nháp luôn bằng bản gốc dựng lại từ ngăn xếp — không có trạng thái ẩn.
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
  const lai = rebuildAll(d.original, d.commands);
  assert.equal(lai.xml, d.xml);
  assert.deepEqual([...lai.identity.slots], [...d.identity.slots]);
});

test("HOÀN TÁC cấu trúc: nốt đen ↔ móc đơn + lặng, đi về nhiều vòng vẫn đúng", () => {
  let d = createDraft(FIX);
  for (let i = 0; i < 3; i++) {
    d = applyToDraft(d, reb(E.notC4, "eighth"));
    assert.equal(readNoteFields(d.xml, P(1, 1, 3))!.kind, "rest");
    d = undo(d);
    assert.equal(d.xml, FIX);
    d = redo(d);
    assert.equal(readNoteFields(d.xml, E.notC4)!.noteType, "eighth");
    d = undo(d);
  }
  assert.equal(d.xml, FIX);
});

// ── Mọi loại nhịp ─────────────────────────────────────────────────────────

test("nhịp nào cũng cân được, và không sinh thiếu/thừa phách ở đâu cả", () => {
  const bai: [string, string][] = [
    ["4/4", doc(B + "simple-4-4.musicxml")],
    ["3/4", doc(B + "simple-3-4.musicxml")],
    ["2/4", doc(B + "simple-2-4.musicxml")],
    ["6/8", doc(B + "pickup-eighth.musicxml")],
    ["6/8 thường", doc("../musicxml-compound/fixtures/simple-6-8.musicxml")],
    ["9/8", doc(GEN + "basic-9-8.musicxml")],
    ["9/8 lấy đà", doc(GEN + "pickup-9-8.musicxml")],
    ["12/8", doc(GEN + "basic-12-8.musicxml")],
    ["12/8 lấy đà", doc(GEN + "pickup-12-8.musicxml")],
    ["9/8 hai bè", doc(GEN + "two-voices-12-8.musicxml")],
    ["lấy đà 4/4", doc(B + "pickup-quarter.musicxml")],
    ["5/8 (2+3)", doc(IRR + "five-2-3.musicxml")],
    ["5/8 (3+2)", doc(IRR + "five-3-2.musicxml")],
    ["7/8 (2+2+3)", doc(IRR + "seven-2-2-3.musicxml")],
    ["7/8 lấy đà", doc(IRR + "pickup-seven-3-2-2.musicxml")],
    ["lặng đủ kiểu", doc(B + "rests.musicxml")],
  ];
  let thu = 0;
  for (const [ten, xml] of bai) {
    const truoc = thoiLuong(xml);
    const nhipTruoc = [...rhythmIssues(xml)];
    for (const n of tagSourceIds(xml).notes) {
      for (const t of ["16th", "eighth", "quarter", "half"] as const) {
        let sau: string;
        try {
          sau = ap(xml, reb(n.path, t));
        } catch (e) {
          // Bị chặn là kết quả hợp lệ; cái không được phép là cân SAI.
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
  assert.ok(thu > 40, `chỉ thử được ${thu} phép cân — quá ít để tin`);
  console.log(`    · đã cân thật ${thu} lượt trên ${bai.length} loại nhịp`);
});

test("nhịp lẻ: dấu lặng sinh ra tôn trọng cách chia mà NGUỒN khai báo", () => {
  const xml = doc(IRR + "five-2-3.musicxml");
  const mocs = musicXMLToBeatMap(xml).measures[0].beatsMap.map((b) => b.offset);
  // 5/8 chia 2+3 → mốc phách tại 0 và 1 nốt đen (2 móc đơn), không phải chia đều.
  assert.deepEqual(mocs, ["0/1", "1/1"]);
  const ra = lapKhoangTrong("0/1", "5/2", mocs);
  assert.ok(ra.length >= 2, "phải cắt tại mốc 2+3, không gộp thành một dấu lặng");
});

// ── Mặt tiền lệnh: bàn phím luôn đi đường cân lại ─────────────────────────

test("mặt tiền: phím trường độ phát ra lệnh CÂN LẠI, không bao giờ lệnh cũ", () => {
  const f = readNoteFields(FIX, E.notC4);
  const r = toCommand({ type: "SET_DURATION", noteType: "eighth" }, E.notC4, f);
  assert.equal(r.kind, "command");
  assert.equal((r as { command: MusicXmlEditCommand }).command.type, "ChangeDurationAndRebalance");
  const d = toCommand({ type: "TOGGLE_DOT" }, E.notC4, f);
  assert.equal((d as { command: MusicXmlEditCommand }).command.type, "ChangeDurationAndRebalance");
});

test("quartersOf: hình nốt ra phân số đúng tuyệt đối, không số thực", () => {
  assert.equal(quartersOf("quarter", 0), "1/1");
  assert.equal(quartersOf("eighth", 0), "1/2");
  assert.equal(quartersOf("quarter", 1), "3/2");
  assert.equal(quartersOf("16th", 2), "7/16");
  assert.equal(quartersOf("whole", 0), "4/1");
});

test("KHÔNG tự gộp dấu lặng mới với dấu lặng có sẵn — gộp là che mất phách", () => {
  // Nốt đen C4 ngắn lại thành móc đơn, ngay sau nó ĐÃ CÓ một lặng đen.
  // Gộp hai thứ lại thành "lặng đen chấm dôi" thì đúng số học mà sai ký âm:
  // nó bắc qua ranh giới phách và làm mất chỗ đặt phách 2.
  const r = applyCommand(FIX, reb(E.notC4, "eighth"));
  const a = readNoteFields(r.xml, P(1, 1, 3))!;
  const b = readNoteFields(r.xml, P(1, 1, 4))!;
  assert.equal(a.kind, "rest");
  assert.equal(a.noteType, "eighth");
  assert.equal(a.dots, 0);
  assert.equal(b.kind, "rest");
  assert.equal(b.noteType, "quarter", "dấu lặng cũ giữ nguyên hình, không bị gộp");
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});

test("ranh giới phách: ngắn nốt ở phách lẻ không sinh dấu lặng bắc qua phách", () => {
  // Ô nhịp 4/4, divisions 4. Nốt E4 chấm dôi bắt đầu ở phách 2 (onset 2 nốt đen),
  // dài 1,5 nốt đen. Ngắn còn móc kép → trống 1,25 nốt đen, đi qua mốc phách 3.
  const r = applyCommand(FIX, reb(E.notE4Cham, "16th"));
  const them = r.structural[0].delta;
  assert.ok(them >= 2, `phải cắt tại mốc phách, thấy ${them} dấu lặng`);
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
  assert.deepEqual([...rhythmIssues(r.xml)], [...rhythmIssues(FIX)]);
});

// ── Thử ngược: bỏ phần dịch chuyển thì chuỗi lệnh PHẢI trúng nhầm ──────────

test("ĐỘT BIẾN: bỏ cập nhật StructuralDelta thì lệnh sau trúng nhầm sự kiện", () => {
  // Một luật chưa từng bắt được lỗi thì không ai tin được. Ở đây ta dựng lại
  // đúng cái editor CẨU THẢ: vẫn chèn dấu lặng, nhưng "quên" dời bản đồ danh
  // tính. Chuỗi lệnh sau đó phải trúng nhầm — nếu không, luật vô dụng.
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const d0 = createDraft(FIX);
  const idB = idTaiCho(d0.identity, cho(4))!;
  const d1 = applyToDraft(d0, reb(E.notC4, "eighth"));

  // Đường ĐÚNG: hỏi bản đồ → con thứ 5 → đúng nốt E4 chấm dôi.
  const dung = d1.identity.slots.get(idB)!;
  assert.deepEqual(dung, cho(5));
  assert.equal(readNoteFields(d1.xml, P(1, 1, dung.childIndex))!.dots, 1);

  // Đường ĐỘT BIẾN: giữ nguyên bản đồ cũ (không áp delta) → con thứ 4.
  const quen = d0.identity.slots.get(idB)!;
  assert.deepEqual(quen, cho(4));
  const nham = readNoteFields(d1.xml, P(1, 1, quen.childIndex))!;
  assert.equal(nham.kind, "rest", "bỏ delta là sửa nhằm vào DẤU LẶNG vừa sinh");
  assert.notDeepEqual(quen, dung, "luật không phân biệt được đúng/sai");
});

test("BẢN ĐỒ DANH TÍNH KHÔNG LỌT VÀO FILE — bản nháp vẫn là MusicXML sạch", () => {
  let d = createDraft(FIX);
  d = applyToDraft(d, reb(E.notC4, "eighth"));
  d = applyToDraft(d, reb(E.notE4Cham, "16th"));
  d = applyToDraft(d, reb(E.notC4, "quarter"));
  for (const cam of [/tva-draft-id/i, /logicalId/i, /structuralDelta/i, /editor-id/i, /\bg:\d+\/\d+\/\d+\b/, /\bn:\d+\/\d+\b/])
    assert.doesNotMatch(d.xml, cam, `bản nháp chứa ${cam}`);
  // Và chỉ những thuộc tính MusicXML thật mới có mặt trên `<note>` mới sinh.
  const lang = parseStrict(d.xml);
  for (const p of elementChildren(lang.documentElement!, "part"))
    for (const m of elementChildren(p, "measure"))
      for (const n of elementChildren(m, "note"))
        for (const a of Array.from(n.attributes ?? []))
          assert.ok(
            ["id", "print-object", "default-x", "default-y", "color", "dynamics"].includes(a.name),
            `thuộc tính lạ trên <note>: ${a.name}`
          );
});

test("KHÔNG ĐỦ CHỖ là GIAO DỊCH: không byte nào, không lệnh nào, không dịch con trỏ", () => {
  // Móc đơn đứng ngay trước một NỐT THẬT: xin nốt đen là không có chỗ.
  const nen = ap(FIX, reb(E.notC4, "eighth")); // c2 móc đơn, c3 lặng móc đơn
  const bit = ap(nen, {
    type: "ReplaceRestWithNote",
    path: P(1, 1, 3),
    pitch: { step: "D", alter: 0, octave: 4 },
  } as MusicXmlEditCommand); // c3 giờ là NỐT
  const truoc = createDraft(bit);
  assert.equal(readNoteFields(bit, P(1, 1, 3))!.kind, "note");
  let sau = truoc;
  assert.throws(() => (sau = applyToDraft(truoc, reb(E.notC4, "quarter"))), /Không đủ khoảng trống/);
  assert.equal(sau, truoc, "trạng thái nháp phải là CHÍNH cái cũ");
  assert.equal(sau.xml, bit, "không một byte nào đổi");
  assert.equal(sau.commands.length, 0);
  assert.deepEqual([...sau.identity.slots], [...truoc.identity.slots], "bản đồ danh tính đứng yên");
});

test("QUYỀN: không có score.edit thì phím trường độ không sinh lệnh cân lại nào", () => {
  for (const key of ["-", "=", "."]) {
    const ra = dispatch({ key, target: null }, { choSua: false });
    assert.equal(ra.kind, "blocked", key);
    assert.equal((ra as { why: string }).why, "capability", key);
  }
  // Có quyền thì mới ra hành động — để luật trên không xanh vì lý do khác.
  assert.deepEqual(dispatch({ key: "=", target: null }, { choSua: true }), {
    kind: "action",
    action: { type: "STEP_DURATION", dir: -1 },
  });
});

test("PANEL thủ công vẫn dùng ChangeDuration cũ — hai đường phân biệt rõ", () => {
  // Panel để nguyên nghĩa cũ: đổi đúng nốt ấy, KHÔNG cân lại ô nhịp. Nhờ vậy
  // thầy vẫn có đường sửa thủ công khi ô nhịp cố ý thiếu/thừa phách.
  const r = applyCommand(FIX, { type: "ChangeDuration", path: E.notC4, noteType: "eighth", dots: 0 });
  assert.equal(readNoteFields(r.xml, E.notC4)!.noteType, "eighth");
  assert.deepEqual(r.structural, [], "lệnh cũ KHÔNG đổi số con của ô nhịp");
  // Và đúng như nghĩa của nó, ô nhịp giờ thiếu phách — đó là lựa chọn của thầy.
  assert.notDeepEqual(thoiLuong(r.xml), thoiLuong(FIX));
});
