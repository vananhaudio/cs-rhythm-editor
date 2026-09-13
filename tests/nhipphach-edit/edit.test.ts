/**
 * Bộ công cụ biên tập MusicXML — Giai đoạn Nội dung 3A.
 *
 * Chứng minh ba điều: (1) lệnh vá ĐÚNG nút, phần còn lại của file y nguyên
 * từng byte; (2) nháp = gốc + ngăn xếp lệnh, hoàn tác/làm lại/huỷ đúng định
 * nghĩa; (3) cổng kiểm tra chặn đúng thứ hỏng và bước lưu không bao giờ được
 * gọi khi cổng chưa mở. Cộng thêm các luật kiến trúc tự thử ngược.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import type { MusicXmlEditCommand, Step } from "../../src/nhipphach/edit/commands.ts";
import {
  appliedCommands,
  applyToDraft,
  canRedo,
  canUndo,
  cancelDraft,
  createDraft,
  isDirty,
  rebuildDraft,
  redo,
  undo,
} from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { validateDraft } from "../../src/nhipphach/edit/validation.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import {
  EditError,
  locate,
  parseStrict,
  resolveSourcePath,
  serialize,
} from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import type { SaveRequest, SaveResult } from "../../src/nhipphach/libraryRepository.ts";

const FX = readFileSync(new URL("./fixtures/edit-toolkit.musicxml", import.meta.url), "utf8");
const REAL =
  "/Users/vananhaudio/Music/12 Thu vien ban nhac xml/Thư viên Musecore/con-duong-xua-em-di-nguyen-tien-thinh-tc3-16con-duong-xua-em-di/score.xml";
const P = (m: number, c: number, part = 1) =>
  `/score-partwise/part[${part}]/measure[${m}]/*[${c}]`;
const pitchOf = (xml: string, path: string) => readNoteFields(xml, path)?.pitch ?? null;
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EditError) return e.code;
    throw e;
  }
  return null;
};

/** Khoảng dòng (1-based, cả hai đầu) của <note> tại đường dẫn — nốt không lồng nốt. */
function noteLines(xml: string, path: string) {
  const l = locate(xml);
  const el = resolveSourcePath(l.doc, path)!;
  const start = l.offsetOf(el);
  const end = xml.indexOf("</note>", start) + "</note>".length;
  const line = (o: number) => xml.slice(0, o).split("\n").length;
  return { from: line(start), to: line(end - 1) };
}
/** Một khối khác biệt duy nhất theo dòng: [from, to] tính trên bản gốc. */
function hunk(a: string, b: string) {
  const A = a.split("\n"), B = b.split("\n");
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  return { from: p + 1, to: A.length - s, cu: A.slice(p, A.length - s), moi: B.slice(p, B.length - s) };
}
/** Tài liệu bỏ đúng một nút — để so "mọi thứ còn lại" giữa gốc và nháp. */
function withoutNode(xml: string, path: string) {
  const doc = parseStrict(xml);
  const el = resolveSourcePath(doc, path)!;
  el.parentNode!.removeChild(el);
  return serialize(doc);
}
/** Bất biến diff: khác biệt nằm trọn trong <note> đích, phần còn lại giống hệt. */
function assertScoped(original: string, draft: string, path: string, maxLines = 4) {
  const h = hunk(original, draft);
  const n = noteLines(original, path);
  assert.ok(
    h.from >= n.from && h.to <= n.to,
    `diff dòng ${h.from}–${h.to} vượt ra ngoài nốt (dòng ${n.from}–${n.to}): ${JSON.stringify(h)}`
  );
  // Đếm những DÒNG THẬT SỰ khác nhau, không đếm khoảng cách giữa hai chỗ sửa:
  // một lệnh có thể chạm hai dòng cách xa nhau trong cùng một nốt (ví dụ <alter>
  // và <accidental>), và giữa chúng là các dòng y nguyên.
  const doi =
    h.cu.filter((l) => !h.moi.includes(l)).length + h.moi.filter((l) => !h.cu.includes(l)).length;
  assert.ok(doi <= maxLines, `sửa quá nhiều dòng (${doi}): ${JSON.stringify(h)}`);
  assert.equal(withoutNode(draft, path), withoutNode(original, path), "phần ngoài nốt đã bị đổi");
}

// ── ChangePitch ───────────────────────────────────────────────────────────────
test("ChangePitch: E4 → F#4 chèn <alter> đúng chỗ, phần còn lại y nguyên", () => {
  const r = applyCommand(FX, { type: "ChangePitch", path: P(2, 2), pitch: { step: "F", alter: 1, octave: 4 } });
  assert.equal(r.changed, true);
  assert.deepEqual(r.touched, [`${P(2, 2)}/pitch`]);
  assert.deepEqual(pitchOf(r.xml, P(2, 2)), { step: "F", alter: 1, octave: 4 });
  assertScoped(FX, r.xml, P(2, 2));
  const h = hunk(FX, r.xml);
  assert.deepEqual(h.cu, ["          <step>E</step>"]);
  assert.deepEqual(h.moi, ["          <step>F</step>", "          <alter>1</alter>"]);
});

test("ChangePitch: F#4 → F4 bỏ đúng dòng <alter>, không để lại dòng trống", () => {
  const r = applyCommand(FX, { type: "ChangePitch", path: P(2, 3), pitch: { step: "F", alter: 0, octave: 4 } });
  assert.deepEqual(pitchOf(r.xml, P(2, 3)), { step: "F", alter: 0, octave: 4 });
  assertScoped(FX, r.xml, P(2, 3));
  assert.equal(FX.split("\n").length - r.xml.split("\n").length, 1);
  // Dấu hoá hiển thị được quyết lại theo bộ khoá (Giai đoạn 3B): Sol trưởng vốn
  // đã có F♯, nên F bình ở đây phải mang dấu bình — KHÔNG để lại dấu thăng cũ.
  assert.match(r.xml.slice(...noteSpan(r.xml, P(2, 3))), /<accidental>natural<\/accidental>/);
  assert.doesNotMatch(r.xml.slice(...noteSpan(r.xml, P(2, 3))), /<accidental>sharp<\/accidental>/);
});
const noteSpan = (xml: string, path: string): [number, number] => {
  const l = locate(xml);
  const s = l.offsetOf(resolveSourcePath(l.doc, path)!);
  return [s, xml.indexOf("</note>", s)];
};

test("ChangePitch: một nốt trong hợp âm đổi quãng tám, hai nốt kia và <chord/> giữ nguyên", () => {
  const r = applyCommand(FX, { type: "ChangePitch", path: P(2, 5), pitch: { step: "B", alter: 0, octave: 5 } });
  assert.deepEqual(pitchOf(r.xml, P(2, 5)), { step: "B", alter: 0, octave: 5 });
  assert.deepEqual(pitchOf(r.xml, P(2, 4)), pitchOf(FX, P(2, 4)));
  assert.deepEqual(pitchOf(r.xml, P(2, 6)), pitchOf(FX, P(2, 6)));
  assert.equal(tagSourceIds(r.xml).notes.find((n) => n.path === P(2, 5))!.chord, true);
  assertScoped(FX, r.xml, P(2, 5));
});

test("ChangePitch: không tìm nốt bằng cao độ cũ — năm nốt B4 giống hệt, chỉ nốt thứ ba đổi", () => {
  const r = applyCommand(FX, { type: "ChangePitch", path: P(5, 4), pitch: { step: "C", alter: 0, octave: 5 } });
  for (const c of [2, 3, 5, 6]) assert.deepEqual(pitchOf(r.xml, P(5, c)), { step: "B", alter: 0, octave: 4 });
  assert.deepEqual(pitchOf(r.xml, P(5, 4)), { step: "C", alter: 0, octave: 5 });
  assertScoped(FX, r.xml, P(5, 4));
});

test("ChangePitch: nốt viết trên MỘT dòng cũng vá gọn, không chèn xuống dòng lạ", () => {
  const r = applyCommand(FX, { type: "ChangePitch", path: P(6, 3), pitch: { step: "C", alter: 1, octave: 5 } });
  const h = hunk(FX, r.xml);
  assert.equal(h.cu.length, 1);
  assert.equal(h.moi.length, 1);
  assert.match(h.moi[0], /<step>C<\/step><alter>1<\/alter><octave>5<\/octave>/);
  assertScoped(FX, r.xml, P(6, 3));
});

test("ChangePitch: file CRLF giữ CRLF ở dòng chèn lẫn dòng bỏ", () => {
  const crlf = FX.replace(/\n/g, "\r\n");
  const chen = applyCommand(crlf, { type: "ChangePitch", path: P(2, 2), pitch: { step: "F", alter: 1, octave: 4 } }).xml;
  const bo = applyCommand(crlf, { type: "ChangePitch", path: P(2, 3), pitch: { step: "F", alter: 0, octave: 4 } }).xml;
  for (const x of [chen, bo]) {
    const tran = x.replace(/\r\n/g, "");
    assert.equal(tran.includes("\n"), false, "có \\n trần");
    assert.equal(tran.includes("\r"), false, "có \\r trần");
  }
  assert.equal(chen.split("\r\n").length, crlf.split("\r\n").length + 1);
  assert.equal(bo.split("\r\n").length, crlf.split("\r\n").length - 1);
});

test("ChangePitch: từ chối rõ ràng — lặng, hợp âm, đường dẫn lạ, cao độ vô lý", () => {
  const p = { step: "C", alter: 0, octave: 4 } as const;
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(3, 7), pitch: p })), "EDIT_NOTE_HAS_NO_PITCH");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(2, 1), pitch: p })), "EDIT_TARGET_NOT_NOTE");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(99, 1), pitch: p })), "EDIT_TARGET_NOT_FOUND");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: "/abc", pitch: p })), "EDIT_TARGET_NOT_FOUND");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(2, 2), pitch: { step: "H" as "C", alter: 0, octave: 4 } })), "EDIT_PITCH_INVALID");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(2, 2), pitch: { step: "C", alter: 3, octave: 4 } })), "EDIT_PITCH_INVALID");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(2, 2), pitch: { step: "C", alter: 0, octave: 4.5 } })), "EDIT_PITCH_INVALID");
});

test("ChangePitch: lệnh trùng trạng thái là lệnh rỗng — không đổi một byte", () => {
  const r = applyCommand(FX, { type: "ChangePitch", path: P(2, 2), pitch: { step: "E", alter: 0, octave: 4 } });
  assert.equal(r.changed, false);
  assert.equal(r.xml, FX);
});

// ── ChangeLyricText ───────────────────────────────────────────────────────────
test("ChangeLyricText: tiếng Việt giữ nguyên văn, kể cả dạng tổ hợp dấu (NFD) và khoảng trắng", () => {
  const nfd = "Đường xưa ơi ạ".normalize("NFD");
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text: nfd });
  assert.equal(readNoteFields(r.xml, P(2, 2))!.lyrics[0].text, nfd);
  assert.ok(r.xml.includes(`<text>${nfd}</text>`));
  assertScoped(FX, r.xml, P(2, 2));
  const cach = "  hai  cách  ";
  const r2 = applyCommand(FX, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text: cach });
  assert.equal(readNoteFields(r2.xml, P(2, 2))!.lyrics[0].text, cach);
});

test("ChangeLyricText: ký tự đặc biệt được thoát đúng chuẩn, đọc lại vẫn là chữ gốc", () => {
  const text = "đường & <xưa> \"em\" 'đi'";
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text });
  assert.equal(readNoteFields(r.xml, P(2, 2))!.lyrics[0].text, text);
  assert.ok(r.xml.includes("&amp; &lt;xưa&gt;"));
  assertScoped(FX, r.xml, P(2, 2));
});

test("ChangeLyricText: đúng dòng lời theo số — sửa lời 2, lời 1 y nguyên", () => {
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(4, 4), lyricIndex: 2, text: "Ừm" });
  const ls = readNoteFields(r.xml, P(4, 4))!.lyrics;
  assert.deepEqual(ls.map((l) => [l.number, l.text]), [["1", "ngườ"], ["2", "Ừm"]]);
  assertScoped(FX, r.xml, P(4, 4));
});

test("ChangeLyricText: giữ nguyên thuộc tính của <text> khi vá (file thật có font-family)", () => {
  const xml = FX.replace("<text>đường</text>", '<text font-family="Times New Roman">đường</text>');
  const r = applyCommand(xml, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text: "Đường" });
  assert.ok(r.xml.includes('<text font-family="Times New Roman">Đường</text>'));
});

test("ChangeLyricText: từ chối âm tiết ghép, lời không có, lời rỗng, dấu lặng", () => {
  assert.equal(code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(4, 6), lyricIndex: 1, text: "x" })), "EDIT_LYRIC_COMPOUND");
  assert.equal(code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 3, text: "x" })), "EDIT_LYRIC_NOT_FOUND");
  assert.equal(code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text: "   " })), "EDIT_LYRIC_EMPTY");
  assert.equal(code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(3, 7), lyricIndex: 1, text: "x" })), "EDIT_LYRIC_NOT_FOUND");
});

// ── Bất biến diff cho mọi lệnh mẫu ────────────────────────────────────────────
test("XML diff: mọi lệnh chỉ chạm đúng <note> đích, mọi nốt khác y nguyên", () => {
  const lenh: MusicXmlEditCommand[] = [
    { type: "ChangePitch", path: P(1, 2), pitch: { step: "D", alter: -1, octave: 4 } },
    { type: "ChangePitch", path: P(2, 3), pitch: { step: "G", alter: 0, octave: 4 } },
    { type: "ChangePitch", path: P(3, 2), pitch: { step: "A", alter: 0, octave: 5 } },
    { type: "ChangePitch", path: P(1, 2, 2), pitch: { step: "D", alter: 1, octave: 4 } },
    { type: "ChangeLyricText", path: P(3, 4), lyricIndex: 1, text: "về đâu" },
    { type: "ChangeLyricText", path: P(5, 2), lyricIndex: 1, text: "Đêm" },
  ];
  for (const cmd of lenh) {
    const r = applyCommand(FX, cmd);
    assert.equal(r.changed, true, cmd.path);
    assertScoped(FX, r.xml, cmd.path);
    const truoc = tagSourceIds(FX).notes, sau = tagSourceIds(r.xml).notes;
    assert.equal(sau.length, truoc.length);
    truoc.forEach((n, i) => {
      if (n.path === cmd.path) return;
      assert.deepEqual(sau[i], n, `nốt ${n.path} bị đổi bởi lệnh trên ${cmd.path}`);
    });
  }
});

// ── Nháp: gốc + ngăn xếp lệnh ─────────────────────────────────────────────────
const L1: MusicXmlEditCommand = { type: "ChangePitch", path: P(2, 2), pitch: { step: "F", alter: 1, octave: 4 } };
const L2: MusicXmlEditCommand = { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text: "mới" };
const L3: MusicXmlEditCommand = { type: "ChangePitch", path: P(2, 2), pitch: { step: "G", alter: 0, octave: 4 } };

test("nháp: áp lệnh → có thay đổi; hoàn tác dựng lại từ gốc; làm lại áp lại lệnh", () => {
  let d = createDraft(FX);
  assert.equal(isDirty(d), false);
  d = applyToDraft(applyToDraft(applyToDraft(d, L1), L2), L3);
  assert.equal(isDirty(d), true);
  assert.equal(appliedCommands(d).length, 3);
  assert.deepEqual(pitchOf(d.xml, P(2, 2)), { step: "G", alter: 0, octave: 4 });
  assert.equal(d.xml, rebuildDraft(FX, [L1, L2, L3]));
  const u1 = undo(d);
  assert.equal(u1.xml, rebuildDraft(FX, [L1, L2]));
  assert.deepEqual(pitchOf(u1.xml, P(2, 2)), { step: "F", alter: 1, octave: 4 });
  assert.equal(canRedo(u1), true);
  const u2 = undo(u1);
  assert.equal(u2.xml, rebuildDraft(FX, [L1]));
  assert.equal(readNoteFields(u2.xml, P(2, 2))!.lyrics[0].text, "đường");
  const u3 = undo(u2);
  assert.equal(u3.xml, FX);
  assert.equal(isDirty(u3), false);
  assert.equal(canUndo(u3), false);
  assert.equal(undo(u3), u3);
  const r1 = redo(u3);
  assert.equal(r1.xml, rebuildDraft(FX, [L1]));
  assert.equal(redo(redo(r1)).xml, d.xml);
  assert.equal(redo(d), d);
  // Trạng thái cũ không bị sửa tại chỗ.
  assert.equal(appliedCommands(d).length, 3);
});

test("nháp: áp lệnh mới sau hoàn tác là mất phần làm lại; lệnh rỗng không vào ngăn xếp", () => {
  let d = applyToDraft(applyToDraft(createDraft(FX), L1), L2);
  d = undo(d);
  assert.equal(canRedo(d), true);
  d = applyToDraft(d, L3);
  assert.equal(canRedo(d), false);
  assert.deepEqual(d.commands, [L1, L3]);
  const rong = applyToDraft(d, L3);
  assert.equal(rong, d);
});

test("nháp: huỷ về đúng bản gốc, quên hết lệnh, không còn gì để làm lại", () => {
  const d = applyToDraft(applyToDraft(createDraft(FX), L1), L2);
  const c = cancelDraft(d);
  assert.equal(c.xml, FX);
  assert.equal(c.original, FX);
  assert.deepEqual(c.commands, []);
  assert.equal(isDirty(c), false);
  assert.equal(canRedo(c), false);
});

test("nháp: lệnh bị từ chối thì ném lỗi, trạng thái cũ giữ nguyên", () => {
  const d = applyToDraft(createDraft(FX), L1);
  assert.equal(code(() => applyToDraft(d, { type: "ChangePitch", path: P(3, 7), pitch: { step: "C", alter: 0, octave: 4 } })), "EDIT_NOTE_HAS_NO_PITCH");
  assert.equal(appliedCommands(d).length, 1);
});

test("ghi chú phiên bản tự sinh: đếm theo nốt, cùng nốt sửa hai lần tính một", () => {
  assert.equal(describeCommands([L1, L2, L3]), "Sửa cao độ 1 nốt · sửa lời 1 chỗ");
  assert.equal(describeCommands([L1, { ...L1, path: P(2, 3) }]), "Sửa cao độ 2 nốt");
  assert.equal(describeCommands([L2]), "Sửa lời 1 chỗ");
  assert.equal(describeCommands([]), "");
});

// ── Cổng kiểm tra ─────────────────────────────────────────────────────────────
const khac = () => undefined; // bộ khắc giả "luôn được" — chỉ dùng cho các tầng trước
test("kiểm tra: XML hỏng dừng ở tầng đầu, các tầng sau không chạy", async () => {
  const r = await validateDraft(FX, FX.slice(0, -40), { render: khac });
  assert.equal(r.ok, false);
  assert.deepEqual(r.stages.map((s) => [s.id, s.ok, s.skipped]), [
    ["wellFormed", false, false],
    ["structural", false, true],
    ["rhythm", false, true],
    ["render", false, true],
  ]);
});

test("kiểm tra: cấu trúc hỏng (bậc nốt H, nốt không trường độ) bị nêu đích danh", async () => {
  const r = await validateDraft(FX, FX.replace("<step>E</step>", "<step>H</step>"), { render: khac });
  assert.equal(r.ok, false);
  assert.match(r.stages[1].messages.join(" "), /Ô nhịp thứ 2.*bậc nốt "H"/);
  const r2 = await validateDraft(FX, FX.replace("<duration>4</duration>\n        <voice>1</voice>\n        <type>quarter</type>\n        <lyric number=\"1\">\n          <syllabic>single</syllabic>\n          <text>đường</text>", "<voice>1</voice>\n        <type>quarter</type>\n        <lyric number=\"1\">\n          <syllabic>single</syllabic>\n          <text>đường</text>"), { render: khac });
  assert.equal(r2.ok, false);
  assert.match(r2.stages[1].messages.join(" "), /không có trường độ/);
});

test("kiểm tra: lỗi nhịp MỚI chặn, lỗi nhịp có sẵn trong gốc không chặn", async () => {
  // Fixture vốn có ô thiếu/thừa phách (m7, m8): sửa lời vẫn qua tầng nhịp.
  const loi = applyCommand(FX, L2).xml;
  const ok = await validateDraft(FX, loi, { render: khac });
  assert.equal(ok.ok, true);
  assert.ok(ok.stages[2].messages.some((m) => /đã có sẵn trong bản gốc/.test(m)));
  // Bản nháp làm ô 2 thừa phách → lỗi mới → chặn.
  const thua = FX.replace("<duration>8</duration>\n        <voice>1</voice>\n        <type>half</type>\n        <lyric number=\"1\">\n          <syllabic>single</syllabic>\n          <text>em</text>", "<duration>16</duration>\n        <voice>1</voice>\n        <type>half</type>\n        <lyric number=\"1\">\n          <syllabic>single</syllabic>\n          <text>em</text>");
  assert.notEqual(thua, FX);
  const r = await validateDraft(FX, thua, { render: khac });
  assert.equal(r.ok, false);
  assert.equal(r.stages[2].ok, false);
  assert.match(r.stages[2].messages.join(" "), /Ô nhịp thứ 2: thừa phách/);
  assert.equal(r.stages[3].skipped, true);
});

test("kiểm tra: khắc thử hỏng thì không qua — tầng cuối cùng cũng chặn", async () => {
  const r = await validateDraft(FX, applyCommand(FX, L1).xml, {
    render: () => {
      throw new Error("không khắc được");
    },
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.stages.map((s) => s.ok), [true, true, true, false]);
});

// ── Lưu = phiên bản mới, chỉ khi cổng mở ──────────────────────────────────────
function thuVienGia() {
  const calls: SaveRequest[] = [];
  return {
    calls,
    async save(req: SaveRequest): Promise<SaveResult> {
      calls.push(req);
      return { scoreId: req.scoreId ?? "x", versionId: "v2", versionNumber: 2, createdScore: false };
    },
  };
}
test("lưu: kiểm tra không qua → thư viện KHÔNG được gọi, không có gì được ghi", async () => {
  const lib = thuVienGia();
  const out = await saveDraftAsVersion({
    library: lib, scoreId: "s1", sourceFilename: "a.musicxml", original: FX,
    draft: FX.replace("<step>E</step>", "<step>H</step>"), changeNote: "x", pageCount: 1, render: khac,
  });
  assert.equal(out.result, null);
  assert.equal(out.report.ok, false);
  assert.equal(lib.calls.length, 0);
  const out2 = await saveDraftAsVersion({
    library: lib, scoreId: "s1", sourceFilename: "a.musicxml", original: FX,
    draft: applyCommand(FX, L1).xml, changeNote: "x", pageCount: 1,
    render: () => { throw new Error("hỏng"); },
  });
  assert.equal(out2.result, null);
  assert.equal(lib.calls.length, 0);
});

test("lưu: nháp giống gốc thì từ chối; nháp hợp lệ → một lần save, đúng bài, loại 'edit', đúng ghi chú", async () => {
  const lib = thuVienGia();
  await assert.rejects(
    saveDraftAsVersion({ library: lib, scoreId: "s1", sourceFilename: "a.musicxml", original: FX, draft: FX, changeNote: "", pageCount: 1, render: khac }),
    (e: unknown) => e instanceof EditError && e.code === "EDIT_NOTHING_TO_SAVE"
  );
  assert.equal(lib.calls.length, 0);
  const draft = applyCommand(FX, L1).xml;
  const out = await saveDraftAsVersion({
    library: lib, scoreId: "s1", sourceFilename: "a.musicxml", original: FX, draft,
    changeNote: "  Sửa cao độ 1 nốt  ", pageCount: 3, render: khac,
  });
  assert.equal(out.report.ok, true);
  assert.equal(out.result?.versionNumber, 2);
  assert.equal(lib.calls.length, 1);
  const req = lib.calls[0];
  assert.equal(req.scoreId, "s1");
  assert.equal(req.changeType, "edit");
  assert.equal(req.changeNote, "Sửa cao độ 1 nốt");
  assert.equal(req.xml, draft);
  assert.equal(req.title, "Bộ công cụ biên tập — fixture");
  assert.equal(req.pageCount, 3);
});

// ── Đọc ô cho panel ───────────────────────────────────────────────────────────
test("readNoteFields: nốt, lặng, hợp âm, âm tiết ghép, đường dẫn lạ", () => {
  const f = readNoteFields(FX, P(2, 3))!;
  assert.equal(f.kind, "note");
  assert.deepEqual(f.pitch, { step: "F", alter: 1, octave: 4 });
  assert.equal(f.accidental, "sharp");
  assert.equal(f.noteType, "quarter");
  assert.equal(f.dots, 0);
  assert.equal(f.chord, "none");
  assert.equal(f.duongTruongDo, null);
  assert.deepEqual(f.lyrics, [{ index: 1, number: "1", text: "xưa", syllabic: "single", extend: false, compound: false }]);
  assert.equal(readNoteFields(FX, P(3, 7))!.kind, "rest");
  assert.equal(readNoteFields(FX, P(3, 7))!.pitch, null);
  assert.deepEqual(readNoteFields(FX, P(4, 6))!.lyrics, [{ index: 1, number: "1", text: "đã xa", syllabic: "single", extend: false, compound: true }]);
  assert.equal(readNoteFields(FX, P(2, 1)), null);
  assert.equal(readNoteFields("<hỏng", P(1, 1)), null);
});

// ── Xem trước nháp bằng chính bộ khắc đang chạy ───────────────────────────────
test("xem trước: nháp khắc bằng cùng bộ khắc; id nguồn giữ nguyên, cao độ mới thấy được; nháp hỏng không khắc", async () => {
  const r = await createAnnotatedScoreRenderer();
  try {
    const goc = r.render(FX);
    const draft = applyToDraft(createDraft(FX), L1).xml;
    const nhap = r.render(draft);
    assert.equal(nhap.pages.length, goc.pages.length);
    assert.equal(nhap.sourceNotes.length, goc.sourceNotes.length);
    const n = nhap.sourceNotes.find((x) => x.path === P(2, 2))!;
    assert.deepEqual(n.pitch, { step: "F", alter: 1, octave: 4 });
    assert.equal(n.svgId, goc.sourceNotes.find((x) => x.path === P(2, 2))!.svgId);
    assert.ok(nhap.pages[0].svg.includes(`id="${n.svgId}"`));
    // Cổng đủ bốn tầng với bộ khắc thật.
    const v = await validateDraft(FX, draft, { render: (x) => r.render(x) });
    assert.equal(v.ok, true, JSON.stringify(v.stages));
    assert.throws(() => r.render(FX.slice(0, -40)));
  } finally {
    r.destroy();
  }
});

// ── File thật của Thầy ────────────────────────────────────────────────────────
test("file thật (14 trang): mỗi lệnh vá đúng một chỗ, dưới 500 ms, qua đủ bốn tầng", { skip: !existsSync(REAL) && "không có file thật trên máy này" }, async () => {
  const xml = readFileSync(REAL, "utf8");
  const notes = tagSourceIds(xml).notes;
  const coLoi = notes.find((n) => (readNoteFields(xml, n.path)?.lyrics.length ?? 0) > 0)!;
  const coPitch = notes.find((n) => n.kind === "note" && n.pitch)!;
  const pitchMoi = { step: coPitch.pitch!.step as Step, alter: coPitch.pitch!.alter === 0 ? 1 : 0, octave: coPitch.pitch!.octave };
  let t = performance.now();
  const a = applyCommand(xml, { type: "ChangeLyricText", path: coLoi.path, lyricIndex: 1, text: "Cơn" });
  assert.ok(performance.now() - t < 500);
  assertScoped(xml, a.xml, coLoi.path);
  t = performance.now();
  const b = applyCommand(xml, { type: "ChangePitch", path: coPitch.path, pitch: pitchMoi });
  assert.ok(performance.now() - t < 500);
  assertScoped(xml, b.xml, coPitch.path);
  const r = await createAnnotatedScoreRenderer();
  try {
    const v = await validateDraft(xml, rebuildDraft(xml, [
      { type: "ChangeLyricText", path: coLoi.path, lyricIndex: 1, text: "Cơn" },
      { type: "ChangePitch", path: coPitch.path, pitch: pitchMoi },
    ]), { render: (x) => r.render(x) });
    assert.equal(v.ok, true, JSON.stringify(v.stages));
  } finally {
    r.destroy();
  }
});

// ── Luật kiến trúc, tự thử ngược ──────────────────────────────────────────────
interface Rule { what: string; pattern: RegExp; mutation: string }
const src = (rel: string) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), "utf8");
const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function enforce(rel: string, rules: Rule[]) {
  const text = stripComments(src(rel));
  for (const rule of rules) {
    assert.equal(rule.pattern.test(text), false, `${rel} vi phạm: ${rule.what}`);
    assert.equal(rule.pattern.test(text + "\n" + rule.mutation + "\n"), true, `luật "${rule.what}" không bắt được đột biến của chính nó`);
  }
}
const KHONG_STRING_REPLACE: Rule = {
  what: "sửa XML bằng tìm-thay chuỗi",
  pattern: /\.replace(?:All)?\(\s*(?:["'`]<|\/[^/\n]*<)/,
  mutation: `xml.replace("<step>E</step>", "<step>F</step>");`,
};
const KHONG_IO: Rule[] = [
  { what: "nhúng Supabase vào lớp biên tập", pattern: /supabase/i, mutation: `import { supabase } from "../../supabase";` },
  { what: "gọi mạng từ lớp biên tập", pattern: /\bfetch\(/, mutation: `await fetch("/x");` },
  { what: "ghi bộ nhớ trình duyệt từ lớp biên tập", pattern: /localStorage|sessionStorage|indexedDB/, mutation: `localStorage.setItem("a", "b");` },
];
test("kiến trúc: lớp biên tập không tìm-thay chuỗi, không I/O, không tìm nốt theo nội dung", () => {
  for (const f of [
    "edit/commands.ts", "edit/xmlPatch.ts", "edit/applyCommand.ts", "edit/draftEngine.ts",
    "edit/noteFields.ts", "edit/validation.ts", "edit/accidentals.ts", "edit/pitchModel.ts",
    "edit/durationModel.ts", "edit/noteContext.ts", "edit/noteWarnings.ts",
  ])
    enforce(`nhipphach/${f}`, [KHONG_STRING_REPLACE, ...KHONG_IO]);
  enforce("nhipphach/edit/versionSave.ts", [KHONG_STRING_REPLACE, ...KHONG_IO.filter((r) => !/Supabase/.test(r.what))]);
  // Luật nhạc lý phải nằm ở một chỗ: bảng bộ khoá và cách tính dấu chỉ ở accidentals.ts.
  enforce("nhipphach/edit/applyCommand.ts", [
    {
      what: "tự tính luật dấu hoá thay vì hỏi accidentals.ts",
      pattern: /fifths\s*(?:>|<|===)\s*\d|"sharp"|"flat"/,
      mutation: `const dau = ngu.fifths > 0 ? "sharp" : "flat";`,
    },
  ]);
  enforce("nhipphach/edit/applyCommand.ts", [
    { what: "tìm nốt bằng duyệt toàn tài liệu thay vì đường dẫn", pattern: /getElementsByTagName|querySelector/, mutation: `doc.getElementsByTagName("pitch")[0];` },
    { what: "so cao độ cũ để chọn nốt", pattern: /pitch\.step\s*===\s*(?:cmd|old|cu)\b/, mutation: `if (pitch.step === cmd.step) target = note;` },
  ]);
});
/**
 * Cổng quyền của editor. Học viên không có `score.edit` thì KHÔNG được thấy bất
 * cứ thứ gì của biên tập — và điều đó phải đúng vì mã nguồn không có đường nào
 * khác, chứ không phải vì hôm nay bấm thử thấy ổn.
 */
test("kiến trúc: mọi thứ của biên tập đều nằm sau đúng một cổng quyền score.edit", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Cổng duy nhất: mức Nâng cao VÀ quyền score.edit do máy chủ cấp.
  assert.match(
    page,
    /const\s+choChonNot\s*=\s*nangCao\s*&&\s*can\(caps,\s*"score\.edit"\)/,
    "cổng quyền phải là nangCao && can(caps, \"score.edit\")"
  );
  // Mọi chỗ mở ra thứ gì của biên tập đều phải đứng sau cổng ấy.
  const canhCong = (text: string) => {
    // Mỗi cửa vào của biên tập: chỗ VẼ ra, và chỗ XỬ LÝ khi bị gọi thẳng.
    const moc = ['<EditPanel', 'aria-pressed={chonNot}', 'np-note-panel', 'function onClickBanNhac', 'function apLenh', 'onClick={choChonNot ? onClickBanNhac : undefined}'];
    const hong: string[] = [];
    for (const m of moc) {
      let i = text.indexOf(m);
      if (i < 0) hong.push(`${m}: không tìm thấy`);
      while (i >= 0) {
        // Cổng phải nằm ngay trước chỗ đó (chỗ vẽ) hoặc ngay trong đó (chỗ xử lý).
        const quanh = text.slice(Math.max(0, i - 300), i + 300);
        if (!quanh.includes("choChonNot")) hong.push(m);
        i = text.indexOf(m, i + 1);
      }
    }
    return hong;
  };
  assert.deepEqual(canhCong(page), [], "có chỗ biên tập không nằm sau cổng quyền");
  // Thử ngược: thêm một panel không có cổng thì luật phải bắt được.
  assert.notDeepEqual(
    canhCong(page + "\n{true && <EditPanel draft={null} />}\n"),
    [],
    "luật cổng quyền không bắt được đột biến của chính nó"
  );
  // Và quyền ấy phải là quyền chỉ dành cho mức Nâng cao, khai báo ở một chỗ.
  assert.match(stripComments(src("nhipphach/capabilities.ts")), /"score\.edit"/);
});

test("kiến trúc: trang không đụng XML; panel không biết XML; lưu phải kiểm tra trước", () => {
  enforce("pages/MusicXmlBeatsPage.tsx", [
    { what: "trang nhập bộ vá XML hay xmldom", pattern: /from ["'][^"']*(?:xmlPatch|applyCommand|@xmldom)/, mutation: `import { applyCommand } from "../nhipphach/edit/applyCommand";` },
    { what: "trang tự parse/serialize XML", pattern: /\bDOMParser\b|\bXMLSerializer\b/, mutation: `new DOMParser();` },
    KHONG_STRING_REPLACE,
  ]);
  enforce("nhipphach/EditPanel.tsx", [
    { what: "panel biết XML", pattern: /xmlPatch|applyCommand|@xmldom|\bxml\b/, mutation: `const xml = draft.xml;` },
    { what: "màu hex cứng trong panel", pattern: /#[0-9a-fA-F]{6}\b/, mutation: `style={{ color: "#FF0000" }}` },
    { what: "từ kỹ thuật lộ ra giao diện", pattern: /Verovio|\bMEI\b|xmldom|EDIT_[A-Z_]+|EditError/, mutation: `<span>Verovio lỗi</span>` },
  ]);
  const vs = stripComments(src("nhipphach/edit/versionSave.ts"));
  assert.ok(vs.indexOf("validateDraft(") < vs.indexOf("library.save("), "phải kiểm tra trước khi lưu");
  assert.match(vs, /if \(!report\.ok\) return/);
});
