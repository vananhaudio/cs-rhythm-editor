/**
 * CHỌN NHIỀU · CHÉP · DÁN — Giai đoạn 4C.
 *
 * Ba điều được khoá chặt nhất ở đây:
 *   1. CHÉP KHÔNG SỬA GÌ. Không một byte, không một lệnh, không một id.
 *   2. DÁN LÀ MỘT GIAO DỊCH. Một ô trong ngăn xếp, nên một lần Ctrl+Z là cả
 *      đoạn biến đi — thầy không phải gỡ từng nốt.
 *   3. BẢNG GHI TẠM KHÔNG PHẢI BẢN NHẠC THỨ HAI. Nó chỉ có cao độ và trường
 *      độ; không đường dẫn, không danh tính, không mảnh XML.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import { chepDoan, vuongMac } from "../../src/nhipphach/edit/clipboard.ts";
import type { Clipboard } from "../../src/nhipphach/edit/clipboard.ts";
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
import { EditError, parseStrict } from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { chonMot, dsDiDuoc, idDangChon, moRong, nhieuHonMot, RONG, caretTaiId } from "../../src/nhipphach/editor/caret.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import { traPhim } from "../../src/nhipphach/editor/keymap.ts";
import { dispatch } from "../../src/nhipphach/editor/dispatcher.ts";
import { NHAP_BAN_DAU } from "../../src/nhipphach/editor/noteEntry.ts";

const doc = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const GOC = doc("./fixtures/note-entry.musicxml");
const P = (m: number, c: number) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
const thoiLuong = (xml: string) =>
  musicXMLToBeatMap(xml).measures.map((m) => `${m.measureNumber}:${m.actualDuration}`);
const sk = (xml: string) =>
  tagSourceIds(xml).notes.map(
    (n) => `${n.svgId.replace("tva-src-", "")}:${n.kind}:${n.noteType}${n.pitch ? "/" + n.pitch.step : ""}`
  );
const boLoi = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e as EditError;
  }
};

/**
 * Bản nhạc thử: ô nhịp 1 có bốn móc đơn C D E F rồi một lặng trắng — đủ để
 * chép một câu bốn nốt và dán lại vào đúng khoảng trống ngay sau nó.
 */
const FIX = (() => {
  let xml = GOC;
  let path = P(1, 2);
  for (const step of ["C", "D", "E", "F"]) {
    xml = applyCommand(xml, {
      type: "InsertNoteIntoRest",
      path,
      pitch: { step, alter: 0, octave: 5 },
      noteType: "eighth",
      dots: 0,
      accidental: "auto",
    } as MusicXmlEditCommand).xml;
    const ds = tagSourceIds(xml).notes;
    path = ds[ds.findIndex((n) => n.path === path) + 1].path;
  }
  return xml;
})();
const CAU = [P(1, 2), P(1, 3), P(1, 4), P(1, 5)];
const LANG_TRANG = P(1, 6);

// ── Mở rộng vùng chọn ─────────────────────────────────────────────────────

test("Shift+←/→ ra đúng hành động mở rộng, không lẫn với đi thường", () => {
  assert.deepEqual(traPhim({ key: "ArrowRight", ctrl: false, shift: true, alt: false }), {
    type: "EXTEND_SELECTION",
    where: "next",
  });
  assert.deepEqual(traPhim({ key: "ArrowLeft", ctrl: false, shift: true, alt: false }), {
    type: "EXTEND_SELECTION",
    where: "prev",
  });
  // Không Shift vẫn là dời con trỏ như cũ.
  assert.deepEqual(traPhim({ key: "ArrowRight", ctrl: false, shift: false, alt: false }), {
    type: "MOVE",
    where: "next",
  });
  assert.deepEqual(traPhim({ key: "c", ctrl: true, shift: false, alt: false }), { type: "COPY" });
  assert.deepEqual(traPhim({ key: "v", ctrl: true, shift: false, alt: false }), { type: "PASTE" });
});

test("mở rộng: NEO đứng yên, chỉ đầu chạy nhúc nhích; hết đường thì đứng im", () => {
  const ds = dsDiDuoc(tagSourceIds(FIX).notes);
  let sel = chonMot(caretTaiId(ds, ds[0].svgId)!);
  assert.equal(nhieuHonMot(sel), false);
  for (let i = 0; i < 3; i++) sel = moRong(ds, sel, "next");
  assert.equal(sel.anchor!.sourceId, ds[0].svgId, "neo không được dời");
  assert.equal(sel.caret!.sourceId, ds[3].svgId);
  assert.deepEqual(
    idDangChon(sel, ds),
    ds.slice(0, 4).map((n) => n.svgId)
  );
  // Co lại cũng vậy.
  sel = moRong(ds, sel, "prev");
  assert.deepEqual(idDangChon(sel, ds), ds.slice(0, 3).map((n) => n.svgId));
  // Về tận đầu rồi thì đứng im, KHÔNG cuộn vòng.
  let lui = chonMot(caretTaiId(ds, ds[0].svgId)!);
  const truoc = lui;
  lui = moRong(ds, lui, "prev");
  assert.equal(lui, truoc);
});

test("mở rộng ngược chiều: vùng chọn vẫn theo THỨ TỰ TÀI LIỆU", () => {
  const ds = dsDiDuoc(tagSourceIds(FIX).notes);
  let sel = chonMot(caretTaiId(ds, ds[3].svgId)!);
  sel = moRong(ds, sel, "prev");
  sel = moRong(ds, sel, "prev");
  // Neo ở sau, đầu chạy ở trước — danh sách vẫn xuôi.
  assert.deepEqual(idDangChon(sel, ds), ds.slice(1, 4).map((n) => n.svgId));
});

// ── Chép ──────────────────────────────────────────────────────────────────

test("CHÉP KHÔNG SỬA GÌ: đọc xong bản nhạc vẫn y nguyên từng byte", () => {
  const d = createDraft(FIX);
  const cb = chepDoan(d.xml, CAU);
  assert.equal(d.xml, FIX);
  assert.equal(d.commands.length, 0);
  assert.equal(cb.items.length, 4);
  assert.equal(cb.mo, "4 nốt");
});

test("bảng ghi tạm CHỈ có ý nghĩa âm nhạc — không đường dẫn, không danh tính", () => {
  const cb = chepDoan(FIX, CAU);
  for (const mon of cb.items) {
    assert.deepEqual(
      Object.keys(mon).sort(),
      mon.kind === "note" ? ["dots", "kind", "noteType", "pitch"] : ["dots", "kind", "noteType"]
    );
  }
  const chuoi = JSON.stringify(cb);
  for (const cam of [/score-partwise/, /measure\[/, /tva-/, /svgId/, /path/i, /logical/i])
    assert.doesNotMatch(chuoi, cam, `bảng ghi tạm mang theo ${cam}`);
  assert.deepEqual(
    cb.items.map((i) => (i.kind === "note" ? i.pitch.step : "r")),
    ["C", "D", "E", "F"]
  );
});

test("chép được cả dấu lặng nằm trong câu", () => {
  const cb = chepDoan(FIX, [P(1, 2), P(1, 6)]);
  assert.deepEqual(cb.items.map((i) => i.kind), ["note", "rest"]);
  assert.equal(cb.mo, "1 nốt · 1 lặng");
});

test("CHẶN chép: hợp âm, dấu nối, hai bè, khuông TAB — mỗi thứ một câu rõ", () => {
  const khac = doc("./fixtures/rest-entry.musicxml");
  const ca: [string, string[], RegExp][] = [
    ["hợp âm", ["/score-partwise/part[1]/measure[2]/*[4]"], /hợp âm/],
    ["dấu nối", ["/score-partwise/part[1]/measure[2]/*[1]"], /dấu nối/],
    ["khuông TAB", ["/score-partwise/part[2]/measure[1]/*[2]"], /TAB/],
    [
      "hai bè",
      ["/score-partwise/part[1]/measure[4]/*[1]", "/score-partwise/part[1]/measure[4]/*[4]"],
      /hai bè/,
    ],
  ];
  for (const [ten, paths, mau] of ca) {
    const vm = vuongMac(khac, paths);
    assert.ok(vm, `${ten}: đáng lẽ phải bị chặn`);
    assert.match(vm!, mau, ten);
    const e = boLoi(() => chepDoan(khac, paths));
    assert.equal(e?.code, "COPY_UNSUPPORTED_SELECTION", ten);
  }
  // Còn một câu bốn nốt thường thì chép được.
  assert.equal(vuongMac(FIX, CAU), null);
});

// ── Dán ───────────────────────────────────────────────────────────────────

test("DÁN: C D E F vào lặng trắng ra đúng bốn móc đơn, ô nhịp vẫn đủ phách", () => {
  const cb = chepDoan(FIX, CAU);
  const r = applyCommand(FIX, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);
  assert.equal(r.changed, true);
  assert.deepEqual(sk(r.xml).slice(0, 8), [
    "p1-m1-c2:note:eighth/C",
    "p1-m1-c3:note:eighth/D",
    "p1-m1-c4:note:eighth/E",
    "p1-m1-c5:note:eighth/F",
    "p1-m1-c6:note:eighth/C",
    "p1-m1-c7:note:eighth/D",
    "p1-m1-c8:note:eighth/E",
    "p1-m1-c9:note:eighth/F",
  ]);
  assert.deepEqual(thoiLuong(r.xml), thoiLuong(FIX));
  assert.deepEqual([...rhythmIssues(r.xml)], [...rhythmIssues(FIX)]);
  assert.deepEqual(structuralIssues(parseStrict(r.xml)), structuralIssues(parseStrict(FIX)));
});

test("DÁN LÀ MỘT LỆNH: một ô trong ngăn xếp, một lần Ctrl+Z là sạch", () => {
  const cb = chepDoan(FIX, CAU);
  let d: DraftState = createDraft(FIX);
  d = applyToDraft(d, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);
  assert.equal(d.commands.length, 1, "bốn nốt nhưng CHỈ MỘT lệnh");
  const dinh = d.xml;
  d = undo(d);
  assert.equal(d.xml, FIX, "một lần hoàn tác là cả đoạn biến đi");
  d = redo(d);
  assert.equal(d.xml, dinh, "một lần làm lại là cả đoạn trở lại");
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
});

test("DÁN atomic: thiếu chỗ thì KHÔNG một byte, KHÔNG một lệnh, bản đồ đứng yên", () => {
  const cb = chepDoan(FIX, CAU);
  const truoc = createDraft(FIX);
  let sau = truoc;
  const e = boLoi(
    () => (sau = applyToDraft(truoc, { type: "PasteSequence", path: P(2, 2), items: cb.items } as MusicXmlEditCommand))
  );
  assert.equal(e?.code, "PASTE_INSUFFICIENT_SPACE");
  assert.equal(e!.message, "Không đủ khoảng trống để dán trọn đoạn này.");
  assert.equal(sau, truoc);
  assert.equal(sau.xml, FIX);
  assert.equal(sau.commands.length, 0);
  assert.deepEqual([...sau.identity.slots], [...truoc.identity.slots]);
});

test("DÁN vào chỗ đã có nốt bị chặn NGAY, và nói phải làm gì", () => {
  const cb = chepDoan(FIX, CAU);
  const e = boLoi(() =>
    applyCommand(FIX, { type: "PasteSequence", path: P(1, 2), items: cb.items } as MusicXmlEditCommand)
  );
  assert.equal(e?.code, "PASTE_NOT_A_REST");
  assert.match(e!.message, /phím 0/);
});

test("DÁN không tràn qua vạch nhịp — hết ô là dừng, không tự nối sang ô sau", () => {
  // Câu bốn móc đơn dán vào lặng đen cuối ô 2: chỉ đủ hai móc đơn.
  const cb = chepDoan(FIX, CAU);
  const e = boLoi(() =>
    applyCommand(FIX, { type: "PasteSequence", path: P(2, 2), items: cb.items } as MusicXmlEditCommand)
  );
  assert.equal(e?.code, "PASTE_INSUFFICIENT_SPACE");
  // Ô nhịp 3 không bị đụng một chữ nào.
  const duoi = (s: string) => s.slice(s.indexOf('<measure number="3">'));
  assert.equal(duoi(FIX), duoi(FIX));
});

test("DÁN giữ nguyên phần còn lại của bản nhạc, từng byte", () => {
  const cb = chepDoan(FIX, CAU);
  const r = applyCommand(FIX, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);
  const duoi = (s: string) => s.slice(s.indexOf('<measure number="2">'));
  assert.equal(duoi(r.xml), duoi(FIX));
  const attr = (s: string) => s.match(/<attributes>[\s\S]*?<\/attributes>/)![0];
  assert.equal(attr(r.xml), attr(FIX));
});

test("ghi chú phiên bản gọi đúng tên việc dán", () => {
  const cb = chepDoan(FIX, CAU);
  assert.equal(
    describeCommands([{ type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand]),
    "Dán 1 đoạn nhạc"
  );
});

// ── Danh tính ─────────────────────────────────────────────────────────────

test("DÁN: mọi sự kiện mới có danh tính riêng; sự kiện cũ giữ nguyên danh tính", () => {
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const cb = chepDoan(FIX, CAU);
  const d0 = createDraft(FIX);
  const idC = idTaiCho(d0.identity, cho(2))!;
  const idLangTrang = idTaiCho(d0.identity, cho(6))!;
  const d1 = applyToDraft(d0, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);

  // Câu gốc không nhúc nhích.
  assert.deepEqual(d1.identity.slots.get(idC), cho(2));
  // Dấu lặng đích trở thành nốt đầu của đoạn dán — vẫn là chỗ ngồi ấy.
  assert.deepEqual(d1.identity.slots.get(idLangTrang), cho(6));
  // Ba sự kiện mới có id riêng, khác nhau, khác mọi id cũ.
  const moi = [7, 8, 9].map((c) => idTaiCho(d1.identity, cho(c))!);
  assert.equal(new Set(moi).size, 3);
  for (const id of moi) {
    assert.equal(d0.identity.slots.has(id), false, "id mới không được trùng id cũ");
    assert.match(id, /^n:\d+\/\d+$/);
  }
});

test("DỰNG LẠI HAI LẦN cho bản đồ danh tính GIỐNG HỆT — không id ngẫu nhiên", () => {
  const cb = chepDoan(FIX, CAU);
  let d: DraftState = createDraft(FIX);
  d = applyToDraft(d, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);
  const a = rebuildAll(d.original, d.commands);
  const b = rebuildAll(d.original, d.commands);
  assert.equal(a.xml, d.xml);
  assert.deepEqual([...a.identity.slots].sort(), [...b.identity.slots].sort());
  assert.deepEqual([...a.identity.slots].sort(), [...d.identity.slots].sort());
  for (const k of a.identity.slots.keys())
    assert.match(k, /^(g:\d+\/\d+\/\d+|n:\d+\/\d+)$/, `id lạ: ${k}`);
});

test("sau khi dán, lệnh tiếp theo vẫn trúng đúng sự kiện — không trượt chỉ số", () => {
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const cb = chepDoan(FIX, CAU);
  let d: DraftState = createDraft(FIX);
  const idF = idTaiCho(d.identity, cho(5))!; // nốt F của câu gốc
  d = applyToDraft(d, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);
  const choF = d.identity.slots.get(idF)!;
  d = applyToDraft(d, {
    type: "ChangePitch",
    path: P(1, choF.childIndex),
    pitch: { step: "G", alter: 0, octave: 5 },
    accidental: "auto",
  } as MusicXmlEditCommand);
  assert.equal(readNoteFields(d.xml, P(1, 5))!.pitch!.step, "G", "sửa đúng F, không nhầm nốt vừa dán");
  // Và đoạn vừa dán vẫn nguyên.
  assert.deepEqual(sk(d.xml).slice(4, 8).map((x) => x.split("/")[1]), ["C", "D", "E", "F"]);
});

// ── Mặt tiền và bàn phím ──────────────────────────────────────────────────

const F = (path: string, xml = FIX) => readNoteFields(xml, path);
const CB: Clipboard = chepDoan(FIX, CAU);

test("mặt tiền: chọn vùng và chép KHÔNG sinh lệnh nào", () => {
  for (const a of [
    { type: "EXTEND_SELECTION", where: "next" },
    { type: "COPY" },
  ] as const)
    assert.deepEqual(toCommand(a, P(1, 2), F(P(1, 2)), NHAP_BAN_DAU, CB), { kind: "noop" });
});

test("mặt tiền: dán khi chưa chép gì thì nói rõ, không im lặng", () => {
  const r = toCommand({ type: "PASTE" }, LANG_TRANG, F(LANG_TRANG), NHAP_BAN_DAU, null);
  assert.equal(r.kind, "refused");
  assert.match((r as { message: string }).message, /Chưa chép/);
});

test("mặt tiền: dán vào nốt bị từ chối; dán vào lặng ra đúng MỘT lệnh ghép", () => {
  const vaoNot = toCommand({ type: "PASTE" }, P(1, 2), F(P(1, 2)), NHAP_BAN_DAU, CB);
  assert.equal(vaoNot.kind, "refused");
  assert.match((vaoNot as { message: string }).message, /dấu lặng/);
  const vaoLang = toCommand({ type: "PASTE" }, LANG_TRANG, F(LANG_TRANG), NHAP_BAN_DAU, CB);
  assert.equal(vaoLang.kind, "command");
  const cmd = (vaoLang as { command: MusicXmlEditCommand }).command;
  assert.equal(cmd.type, "PasteSequence");
  assert.equal((cmd as { items: readonly unknown[] }).items.length, 4);
});

test("AN TOÀN Ô CHỮ: Ctrl+C, Ctrl+V, Shift+mũi tên trong ô nhập đều không lọt", () => {
  for (const el of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "DIV", isContentEditable: true }])
    for (const [key, o] of [
      ["c", { ctrlKey: true }],
      ["v", { ctrlKey: true }],
      ["ArrowRight", { shiftKey: true }],
      ["ArrowLeft", { shiftKey: true }],
    ] as [string, Record<string, boolean>][]) {
      const ra = dispatch({ key, target: el, ...o }, { choSua: true });
      assert.equal(ra.kind, "blocked", `${el.tagName} ${key}`);
      assert.equal((ra as { why: string }).why, "typing");
    }
  // Không có quyền `score.edit` thì cũng không phím nào có nghĩa.
  for (const [key, o] of [
    ["c", { ctrlKey: true }],
    ["v", { ctrlKey: true }],
    ["ArrowRight", { shiftKey: true }],
  ] as [string, Record<string, boolean>][]) {
    const ra = dispatch({ key, target: null, ...o }, { choSua: false });
    assert.equal((ra as { why: string }).why, "capability", key);
  }
});

test("dán vào nhiều loại nhịp đều giữ đủ phách", () => {
  const B = "../musicxml-beats/fixtures/";
  const IRR = "../musicxml-irregular/fixtures/";
  const GEN = "../musicxml-generalized/fixtures/";
  const bai: [string, string][] = [
    ["4/4", doc(B + "simple-4-4.musicxml")],
    ["3/4", doc(B + "simple-3-4.musicxml")],
    ["2/4", doc(B + "simple-2-4.musicxml")],
    ["6/8 lấy đà", doc(B + "pickup-eighth.musicxml")],
    ["lấy đà 4/4", doc(B + "pickup-quarter.musicxml")],
    ["9/8", doc(GEN + "basic-9-8.musicxml")],
    ["12/8 lấy đà", doc(GEN + "pickup-12-8.musicxml")],
    ["5/8 (2+3)", doc(IRR + "five-2-3.musicxml")],
    ["7/8 (2+2+3)", doc(IRR + "seven-2-2-3.musicxml")],
    ["lặng đủ kiểu", doc(B + "rests.musicxml")],
  ];
  // Một móc kép — hình ngắn nhất, để nhiều loại dấu lặng nhận được. Bảng ghi
  // tạm là dữ liệu thuần nên dựng thẳng được, không cần chép từ đâu.
  const mon = [
    { kind: "note", pitch: { step: "C", alter: 0, octave: 5 }, noteType: "16th", dots: 0 },
  ] as const;
  let thu = 0;
  for (const [ten, goc] of bai) {
    // Các fixture này hầu như không có dấu lặng sẵn, nên tự dọn chỗ trống bằng
    // đúng lệnh của 4B.1 — vừa có chỗ dán, vừa là một phép kiểm chuỗi lệnh.
    let xml = goc;
    for (const n of tagSourceIds(goc).notes) {
      if (n.kind !== "note" || n.chord || n.ties.length || n.grace) continue;
      try {
        xml = applyCommand(xml, { type: "MakeRest", path: n.path }).xml;
      } catch {
        /* chỗ bị chặn: bỏ qua, đã có bộ kiểm riêng */
      }
    }
    const truoc = thoiLuong(xml);
    const nhipTruoc = [...rhythmIssues(xml)];
    for (const n of tagSourceIds(xml).notes) {
      if (n.kind !== "rest") continue;
      let sau: string;
      try {
        sau = applyCommand(xml, {
          type: "PasteSequence",
          path: n.path,
          items: mon,
        } as unknown as MusicXmlEditCommand).xml;
      } catch (e) {
        assert.ok(e instanceof EditError, `${ten}: lỗi lạ ${String(e)}`);
        continue;
      }
      thu++;
      assert.deepEqual(thoiLuong(sau), truoc, `${ten} · ${n.svgId}`);
      assert.deepEqual([...rhythmIssues(sau)], nhipTruoc, `${ten} · ${n.svgId}`);
      assert.deepEqual(
        structuralIssues(parseStrict(sau)),
        structuralIssues(parseStrict(xml)),
        `${ten} · ${n.svgId}`
      );
    }
  }
  assert.ok(thu >= 15, `chỉ dán thật được ${thu} lượt — quá ít để tin`);
  console.log(`    · đã dán thật ${thu} lượt trên ${bai.length} loại nhịp`);
});

test("VÙNG CHỌN tra lại TỪ ID, không tin chỗ ngồi cũ — lỗi đo được trên trình duyệt", () => {
  // Chạy thật mới lộ: dán rồi hoàn tác làm số sự kiện đổi, mà `sourceIndex`
  // thì vẫn là chỗ ngồi cũ — vùng chọn lặng lẽ loang sang những sự kiện thầy
  // không hề chọn. Tra lại từ id thì tự sửa được.
  const ds = dsDiDuoc(tagSourceIds(FIX).notes);
  const sel = {
    anchor: { sourceId: ds[0].svgId, sourceIndex: 0 },
    caret: { sourceId: ds[2].svgId, sourceIndex: 2 },
  };
  assert.deepEqual(idDangChon(sel, ds), [ds[0].svgId, ds[1].svgId, ds[2].svgId]);

  // Chỗ ngồi ghi SAI hẳn mà id vẫn đúng → vẫn ra đúng vùng.
  const lech = {
    anchor: { sourceId: ds[0].svgId, sourceIndex: 99 },
    caret: { sourceId: ds[2].svgId, sourceIndex: -7 },
  };
  assert.deepEqual(idDangChon(lech, ds), idDangChon(sel, ds));

  // Một đầu biến mất → nói thật là mất vùng chọn, không đoán lấy phần còn lại.
  const mat = {
    anchor: { sourceId: ds[0].svgId, sourceIndex: 0 },
    caret: { sourceId: "tva-src-p9-m9-c9", sourceIndex: 2 },
  };
  assert.deepEqual(idDangChon(mat, ds), []);
  assert.deepEqual(idDangChon(RONG, ds), []);
});

test("sau khi DÁN rồi HOÀN TÁC, vùng chọn cũ không còn trỏ vào đâu cả", () => {
  const cb = chepDoan(FIX, CAU);
  const d0 = createDraft(FIX);
  const d1 = applyToDraft(d0, { type: "PasteSequence", path: LANG_TRANG, items: cb.items } as MusicXmlEditCommand);
  const dsSau = dsDiDuoc(tagSourceIds(d1.xml).notes);
  // Vùng chọn ôm trọn đoạn vừa dán.
  const sel = {
    anchor: { sourceId: "tva-src-p1-m1-c6", sourceIndex: 4 },
    caret: { sourceId: "tva-src-p1-m1-c9", sourceIndex: 7 },
  };
  assert.equal(idDangChon(sel, dsSau).length, 4);
  // Hoàn tác: ba sự kiện kia biến mất → vùng chọn rỗng, KHÔNG loang.
  const dsVe = dsDiDuoc(tagSourceIds(undo(d1).xml).notes);
  assert.deepEqual(idDangChon(sel, dsVe), []);
});

// ── Vùng chọn sau khi dán, và sau khi hoàn tác ────────────────────────────

test("SAU KHI DÁN: vùng chọn là chính đoạn vừa dán, và nó DÙNG ĐƯỢC ngay", () => {
  const cb = chepDoan(FIX, CAU);
  const d = applyToDraft(createDraft(FIX), {
    type: "PasteSequence",
    path: LANG_TRANG,
    items: cb.items,
  } as MusicXmlEditCommand);
  const ds = dsDiDuoc(tagSourceIds(d.xml).notes);

  // Trang đặt neo ở sự kiện đầu và đầu chạy ở sự kiện cuối của đoạn vừa dán —
  // bằng ID lấy từ danh sách MỚI, không phải chỗ ngồi cũ.
  const dau = ds.findIndex((n) => n.svgId === "tva-src-p1-m1-c6");
  const sel = {
    anchor: { sourceId: ds[dau].svgId, sourceIndex: dau },
    caret: { sourceId: ds[dau + cb.items.length - 1].svgId, sourceIndex: dau + cb.items.length - 1 },
  };
  assert.deepEqual(idDangChon(sel, ds), [
    "tva-src-p1-m1-c6",
    "tva-src-p1-m1-c7",
    "tva-src-p1-m1-c8",
    "tva-src-p1-m1-c9",
  ]);
  // Câu NGUỒN không bị chọn kèm — dán xong là làm việc với bản sao, không phải bản gốc.
  for (const id of ["tva-src-p1-m1-c2", "tva-src-p1-m1-c5"])
    assert.equal(idDangChon(sel, ds).includes(id), false, id);

  // Và đoạn ấy dùng được ngay: chép lại ra đúng bốn nốt C D E F.
  const lai = chepDoan(
    d.xml,
    idDangChon(sel, ds).map((id) => ds.find((n) => n.svgId === id)!.path)
  );
  assert.deepEqual(
    lai.items.map((i) => (i.kind === "note" ? i.pitch.step : "r")),
    ["C", "D", "E", "F"]
  );
});

test("HOÀN TÁC sau dán: vùng chọn XOÁ HẲN, tuyệt đối không loang sang sự kiện khác", () => {
  const cb = chepDoan(FIX, CAU);
  const d1 = applyToDraft(createDraft(FIX), {
    type: "PasteSequence",
    path: LANG_TRANG,
    items: cb.items,
  } as MusicXmlEditCommand);
  const sel = {
    anchor: { sourceId: "tva-src-p1-m1-c6", sourceIndex: 4 },
    caret: { sourceId: "tva-src-p1-m1-c9", sourceIndex: 7 },
  };
  const dsVe = dsDiDuoc(tagSourceIds(undo(d1).xml).notes);
  // `c9` đã chết. Vùng chọn phải RỖNG, chứ không được lấy sự kiện đang nằm ở
  // chỗ ngồi số 7 (chính là một nốt ở ô nhịp khác).
  assert.deepEqual(idDangChon(sel, dsVe), []);
  assert.ok(dsVe.length > 7, "fixture vẫn còn sự kiện ở chỗ ngồi cũ — đó mới là cái bẫy");
  assert.notEqual(dsVe[7].svgId, "tva-src-p1-m1-c9");
});

test("ĐỘT BIẾN: quay lại tin `sourceIndex` thì vùng chọn loang ngay", () => {
  // Đây là bản CẨU THẢ của `idDangChon` — đúng như nó từng viết. Giữ nó ở đây
  // để chứng minh luật mới thật sự bắt được lỗi, chứ không chỉ mô tả lỗi.
  const theoChoNgoi = (sel: { anchor: { sourceIndex: number }; caret: { sourceIndex: number } }, notes: readonly { svgId: string }[]) =>
    notes
      .slice(
        Math.min(sel.anchor.sourceIndex, sel.caret.sourceIndex),
        Math.max(sel.anchor.sourceIndex, sel.caret.sourceIndex) + 1
      )
      .map((n) => n.svgId);

  const cb = chepDoan(FIX, CAU);
  const d1 = applyToDraft(createDraft(FIX), {
    type: "PasteSequence",
    path: LANG_TRANG,
    items: cb.items,
  } as MusicXmlEditCommand);
  const sel = {
    anchor: { sourceId: "tva-src-p1-m1-c6", sourceIndex: 4 },
    caret: { sourceId: "tva-src-p1-m1-c9", sourceIndex: 7 },
  };
  const dsVe = dsDiDuoc(tagSourceIds(undo(d1).xml).notes);
  const cauTha = theoChoNgoi(sel, dsVe);
  assert.ok(cauTha.length > 0, "bản cẩu thả phải loang — nếu không thì luật vô dụng");
  assert.notDeepEqual(cauTha, idDangChon(sel, dsVe));
  // Và nó loang vào đúng những sự kiện KHÔNG hề được chọn.
  assert.ok(cauTha.some((id) => !id.startsWith("tva-src-p1-m1-")), `loang ra: ${cauTha.join(",")}`);
});

test("SỬA CẤU TRÚC TRƯỚC VÙNG CHỌN: vùng vẫn đúng bốn sự kiện logic cũ", () => {
  // Vùng chọn là bốn nốt C D E F ở ô nhịp 1. Chèn thêm một dấu lặng ở TRƯỚC
  // chúng thì mọi chỉ số con tụt một, nhưng vùng chọn phải vẫn ôm đúng bốn nốt ấy.
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const d0 = createDraft(FIX);
  const ids = [2, 3, 4, 5].map((c) => idTaiCho(d0.identity, cho(c))!);
  // Ngắn nốt C lại → sinh một dấu lặng ngay sau nó, dời D E F xuống một chỗ.
  const d1 = applyToDraft(d0, {
    type: "ChangeDurationAndRebalance",
    path: P(1, 2),
    noteType: "16th",
    dots: 0,
  } as MusicXmlEditCommand);
  const choMoi = ids.map((id) => d1.identity.slots.get(id));
  assert.ok(choMoi.every(Boolean), "không sự kiện nào được biến mất");
  // D E F tụt đúng một chỗ; C vẫn ngồi nguyên.
  assert.deepEqual(choMoi[0], cho(2));
  assert.deepEqual(choMoi.slice(1), [cho(4), cho(5), cho(6)]);
  // Và vùng chọn dịch theo đúng bốn id ấy, không nhiều hơn không ít hơn.
  const ds = dsDiDuoc(tagSourceIds(d1.xml).notes);
  const svgIds = choMoi.map((c) => `tva-src-p1-m${c!.measureIndex}-c${c!.childIndex}`);
  const sel = {
    anchor: { sourceId: svgIds[0], sourceIndex: -1 },
    caret: { sourceId: svgIds[3], sourceIndex: -1 },
  };
  // Vùng liền mạch giữa hai đầu giờ có 5 sự kiện (thêm dấu lặng vừa sinh) —
  // đó là sự thật của bản nhạc, và nó hiện ra đúng như vậy chứ không giấu đi.
  const trong = idDangChon(sel, ds);
  assert.equal(trong.length, 5);
  for (const id of svgIds) assert.ok(trong.includes(id), id);
});
