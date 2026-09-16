/**
 * 4D.P — bộ nhớ đệm theo chuỗi nguồn: nhanh hơn nhưng KHÔNG BAO GIỜ cũ.
 *
 * Khoá là chính chuỗi MusicXML. Mỗi phép thử dưới đây đổi bản nháp rồi hỏi lại,
 * và hỏi lại cả bản cũ, để chứng minh không có kết quả nào lọt sang phiên bản khác.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nhoTheoNguon } from "../../src/musicxml-beats/sourceCache.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import { applyToDraft, createDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { newWarnings, TAB_MISMATCH } from "../../src/nhipphach/edit/noteWarnings.ts";
import { newRhythmIssues, rhythmIssues } from "../../src/nhipphach/edit/validation.ts";

const FIX = readFileSync(new URL("./fixtures/tab-edit.musicxml", import.meta.url), "utf8");
const P = (m: number, c: number) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
const A3 = P(1, 8);
const dat = (fret: number): MusicXmlEditCommand =>
  ({ type: "ChangeTabPosition", path: A3, string: 3, fret }) as MusicXmlEditCommand;

test("bộ đệm: cùng chuỗi tính một lần; khác một byte là tính lại; chỉ giữ vài bản", () => {
  const c = nhoTheoNguon<number>(2);
  let lan = 0;
  const tinh = (x: string) => c.lay(x, () => (lan++, x.length));
  tinh("abc");
  tinh("ab" + "c"); // chuỗi khác đối tượng, cùng nội dung → trúng
  assert.equal(lan, 1);
  tinh("abd");
  assert.equal(lan, 2);
  tinh("x");
  assert.equal(c.kichThuoc, 2, "không giữ quá số bản cho phép");
  tinh("abc"); // đã bị đẩy ra → tính lại
  assert.equal(lan, 4);
  // Lỗi không bị ghi nhớ: lần sau vẫn tính lại và vẫn báo lỗi.
  let loi = 0;
  const hong = () => c.lay("hong", () => { loi++; throw new Error("x"); });
  assert.throws(hong);
  assert.throws(hong);
  assert.equal(loi, 2);
});

test("ô của nốt đọc từ ĐÚNG bản đang hỏi — bản mới thấy phím mới, bản cũ vẫn thấy phím cũ", () => {
  const cu = readNoteFields(FIX, A3)!;
  const moi = applyCommand(FIX, dat(4)).xml;
  assert.deepEqual(readNoteFields(moi, A3)!.tab, { string: 3, fret: 4 });
  assert.deepEqual(readNoteFields(FIX, A3)!.tab, { string: 3, fret: 2 });
  // Mỗi lần hỏi là một đối tượng mới: nơi nhận sửa bản của mình không làm bẩn lần sau.
  (cu as { dots: number }).dots = 99;
  cu.lyrics.push({ index: 9, number: "", text: "bẩn", syllabic: null, extend: false, compound: false });
  const lai = readNoteFields(FIX, A3)!;
  assert.equal(lai.dots, 0);
  assert.equal(lai.lyrics.some((l) => l.text === "bẩn"), false);
  assert.notEqual(lai, cu);
});

test("ô của nốt: bộ đệm tài liệu không bị lệnh sửa làm bẩn", () => {
  readNoteFields(FIX, A3); // tài liệu của FIX nằm trong bộ đệm
  const r = applyCommand(FIX, dat(7)); // lệnh sửa đọc tài liệu RIÊNG của nó
  assert.notEqual(r.xml, FIX);
  assert.deepEqual(readNoteFields(FIX, A3)!.tab, { string: 3, fret: 2 });
  assert.deepEqual(readNoteFields(r.xml, A3)!.tab, { string: 3, fret: 7 });
});

test("danh sách nốt nguồn: dùng chung nhưng ĐÓNG BĂNG, và đổi theo từng bản", () => {
  const a = tagSourceIds(FIX);
  assert.equal(tagSourceIds(FIX), a, "cùng chuỗi → cùng kết quả, không đọc lại");
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.notes) && Object.isFrozen(a.notes[0]));
  assert.throws(() => (a.notes as unknown[]).push({}), TypeError);
  assert.throws(() => {
    (a.notes[0] as { path: string }).path = "bẩn";
  }, TypeError);
  const moi = applyCommand(FIX, dat(4)).xml;
  const b = tagSourceIds(moi);
  assert.notEqual(b, a);
  assert.equal(b.xml.includes("<fret>4</fret>"), true);
  assert.equal(a.xml.includes("<fret>4</fret>"), false);
});

test("lỗi nhịp: mỗi nơi gọi nhận bản sao riêng; nháp hỏng rồi hoàn tác thì lỗi biến mất", () => {
  const m1 = rhythmIssues(FIX);
  m1.set("bẩn", "bẩn");
  assert.equal(rhythmIssues(FIX).has("bẩn"), false);
  // Đổi trường độ một nốt → ô nhịp lệch; hoàn tác → hết.
  let d = createDraft(FIX);
  d = applyToDraft(d, { type: "ChangeDuration", path: P(1, 2), noteType: "whole", dots: 0 } as MusicXmlEditCommand);
  const hong = newRhythmIssues(d.original, d.xml);
  assert.equal(d.commands.length, 1, "lệnh đổi trường độ phải được áp");
  assert.ok(hong.length > 0, "nháp phải làm hỏng nhịp");
  d = undo(d);
  assert.deepEqual(newRhythmIssues(d.original, d.xml), []);
  d = redo(d);
  assert.deepEqual(newRhythmIssues(d.original, d.xml), hong);
});

test("cảnh báo TAB: nháp lệch thế bấm thì thấy; sửa lại thì hết; bản gốc không bị ghi nhớ sai", () => {
  const lech = applyCommand(FIX, { type: "ChangePitch", path: A3, pitch: { step: "C", alter: 0, octave: 4 }, accidental: "auto" } as MusicXmlEditCommand).xml;
  const w = newWarnings(FIX, lech);
  assert.ok(w.some((x) => x.code === TAB_MISMATCH && x.path === A3), JSON.stringify(w));
  assert.ok(Object.isFrozen(w[0]));
  assert.deepEqual(newWarnings(FIX, FIX), []);
  assert.deepEqual(newWarnings(FIX, applyCommand(FIX, dat(4)).xml), []);
  assert.ok(newWarnings(FIX, lech).some((x) => x.code === TAB_MISMATCH));
});

test("khoá là CHÍNH chuỗi XML: y hệt → trúng; lệch đúng 1 byte → tính lại", () => {
  const giong = FIX.slice(0, 10) + FIX.slice(10); // chuỗi khác đối tượng, cùng nội dung
  assert.equal(tagSourceIds(giong), tagSourceIds(FIX));
  const i = FIX.indexOf("<fret>2</fret>") + 6;
  const lech = FIX.slice(0, i) + "3" + FIX.slice(i + 1);
  assert.equal(lech.length, FIX.length);
  assert.notEqual(tagSourceIds(lech), tagSourceIds(FIX));
  assert.deepEqual(readNoteFields(lech, A3)!.tab, { string: 3, fret: 3 });
  assert.deepEqual(readNoteFields(FIX, A3)!.tab, { string: 3, fret: 2 });
  // Lệnh sửa vẫn đọc tài liệu RIÊNG: đã có tài liệu của FIX trong bộ đệm mà lệnh vẫn ra đúng.
  assert.deepEqual(readNoteFields(applyCommand(FIX, dat(5)).xml, A3)!.tab, { string: 3, fret: 5 });
});
