/**
 * 4D.P — bộ nhớ đệm theo chuỗi nguồn: nhanh hơn nhưng KHÔNG BAO GIỜ cũ.
 *
 * Khoá là chính chuỗi MusicXML. Mỗi phép thử dưới đây đổi bản nháp rồi hỏi lại,
 * và hỏi lại cả bản cũ, để chứng minh không có kết quả nào lọt sang phiên bản khác.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dongBangSau, nhoTheoNguon } from "../../src/musicxml-beats/sourceCache.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
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

test("4D.P2 — đọc bài và BeatMap: một chuỗi tính một lần, đóng băng sâu, lệch 1 byte là tính lại", () => {
  const a = parseMusicXML(FIX);
  assert.equal(parseMusicXML(FIX.slice(0, 5) + FIX.slice(5)), a);
  assert.ok(Object.isFrozen(a.parts[0].measures[0].events[0]));
  assert.throws(() => (a.parts[0].measures as unknown[]).push({}), TypeError);
  const b = musicXMLToBeatMap(FIX);
  assert.equal(musicXMLToBeatMap(FIX), b);
  assert.equal(musicXMLToBeatMap(FIX, undefined), b, "không chọn cách chia = cùng một khoá");
  assert.throws(() => (b.measures[0].diagnostics as unknown[]).push({}), TypeError);
  // Lệch 1 byte (đổi phím) → đọc lại, và kết quả phản ánh đúng bản mới.
  const moi = applyCommand(FIX, dat(4)).xml;
  assert.notEqual(parseMusicXML(moi), a);
  assert.notEqual(musicXMLToBeatMap(moi), b);
  // Đổi phím TAB không đổi thời gian: bản đồ phách mới bằng bản cũ về nội dung.
  assert.deepEqual(JSON.parse(JSON.stringify(musicXMLToBeatMap(moi))), JSON.parse(JSON.stringify(b)));
  // Cách chia khác là khoá khác — không bao giờ trả nhầm bản đồ của cách chia kia.
  const chia = { byMeter: { "6/8": "3+3" } } as never;
  assert.notEqual(musicXMLToBeatMap(FIX, chia), b);
  // Nguồn hỏng: vẫn ném lỗi, và không ghi nhớ lỗi.
  assert.throws(() => parseMusicXML("<hong"));
  assert.throws(() => parseMusicXML("<hong"));
});

test("đóng băng sâu: cả Map, Set và mảng lồng", () => {
  const v = dongBangSau({ a: [{ b: 1 }], m: new Map([["k", { c: 2 }]]), s: new Set([{ d: 3 }]) });
  assert.ok(Object.isFrozen(v.a[0]) && Object.isFrozen(v.m.get("k")) && Object.isFrozen([...v.s][0]));
});
