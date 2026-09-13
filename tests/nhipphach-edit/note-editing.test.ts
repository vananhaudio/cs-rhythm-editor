/**
 * Sửa nốt cho trọn vẹn — Giai đoạn Nội dung 3B.
 *
 * Điều phải chứng minh: sau khi sửa một nốt, bản nhạc vừa HỢP LỆ vừa NHÌN ĐÚNG.
 * Vì thế mỗi phép kiểm đi tới cùng ba lớp: chuỗi XML (vá đúng chỗ), bộ khắc
 * Verovio (dấu hoá có được vẽ ra không), và music21 — một thư viện hoàn toàn
 * khác đọc lại (khi máy có; không có thì bỏ qua, không phải cái cớ để bỏ sót).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand, Pitch } from "../../src/nhipphach/edit/commands.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import {
  applyToDraft,
  createDraft,
  rebuildDraft,
  redo,
  undo,
} from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { keyAlter } from "../../src/nhipphach/edit/accidentals.ts";
import { durationFor, dotFactor } from "../../src/nhipphach/edit/durationModel.ts";
import { enharmonics, pitchName, soundingPitch } from "../../src/nhipphach/edit/pitchModel.ts";
import {
  ACCIDENTAL_READING,
  newWarnings,
  TAB_MISMATCH,
} from "../../src/nhipphach/edit/noteWarnings.ts";
import { newRhythmIssues } from "../../src/nhipphach/edit/validation.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import { EditError, parseStrict, serialize } from "../../src/nhipphach/edit/xmlPatch.ts";
import { resolveSourcePath } from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import type { SaveRequest, SaveResult } from "../../src/nhipphach/libraryRepository.ts";

const FX = readFileSync(new URL("./fixtures/note-editing.musicxml", import.meta.url), "utf8");
/** `/part[p]/measure[m]/*[c]` — con thứ c tính cả `<attributes>`/`<backup>`, như parser đếm. */
const P = (m: number, c: number, part = 1) =>
  `/score-partwise/part[${part}]/measure[${m}]/*[${c}]`;
/* Bản đồ fixture (xem file): m1 c2=C4 c3=C♯4 c4=C♮4 c5=D4 · m2 c2=F♯4 c3=F♮4 c4..c6=hợp âm
   m3 c2=B♭4 c3=B♮4 c4=A4 chấm (nối) c5=A4 (hết nối) · m4 c2..c6=G4 móc đơn có chùm
   m6 (divisions 12) c2=hoa mỹ c3=C5 c4..c6=chùm ba c7=D5 trắng c9=G3 bè 2 c10=lặng
   bè TAB: m1 c2=E4(d1p0) c3=F♯4(d1p2) c4=G4(d1p3) c5=B3(d2p0) · m2 c1=lặng cả ô */

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EditError) return e.code;
    throw e;
  }
  return null;
};
const fields = (xml: string, path: string) => readNoteFields(xml, path)!;
const accidentalOf = (xml: string, path: string) => fields(xml, path).accidental;
const pitchOf = (xml: string, path: string) => fields(xml, path).pitch;

/** Tài liệu bỏ đúng một nút — để so "mọi thứ còn lại" giữa gốc và nháp. */
function withoutNode(xml: string, path: string) {
  const doc = parseStrict(xml);
  const el = resolveSourcePath(doc, path)!;
  el.parentNode!.removeChild(el);
  return serialize(doc);
}
/** Bất biến diff: ngoài `<note>` đích ra, không một byte nào khác được đổi. */
function assertScoped(original: string, draft: string, path: string) {
  assert.equal(
    withoutNode(draft, path),
    withoutNode(original, path),
    `lệnh trên ${path} đã đụng vào phần khác của bản nhạc`
  );
  const truoc = tagSourceIds(original).notes;
  const sau = tagSourceIds(draft).notes;
  assert.equal(sau.length, truoc.length);
  truoc.forEach((n, i) => {
    if (n.path === path) return;
    assert.deepEqual(sau[i], n, `nốt ${n.path} bị đổi lây`);
  });
}
/** Phần `<note>` đích, nguyên văn — để soi những trường KHÔNG được đụng tới. */
function noteText(xml: string, path: string) {
  const doc = parseStrict(xml);
  const el = resolveSourcePath(doc, path)!;
  return serialize(el);
}

// ── 1. ChangePitch trọn vẹn ───────────────────────────────────────────────────
test("ChangePitch: đổi được cả bậc, dấu hoá và quãng tám; các trường khác của nốt y nguyên", () => {
  const dich = P(1, 2); // C4, có lời "Đô"
  for (const pitch of [
    { step: "F", alter: 1, octave: 4 },
    { step: "B", alter: -1, octave: 3 },
    { step: "G", alter: 0, octave: 5 },
    { step: "A", alter: 2, octave: 4 },
    { step: "E", alter: -2, octave: 4 },
  ] as Pitch[]) {
    const r = applyCommand(FX, { type: "ChangePitch", path: dich, pitch });
    assert.equal(r.changed, true, pitchName(pitch));
    assert.deepEqual(pitchOf(r.xml, dich), pitch, pitchName(pitch));
    assertScoped(FX, r.xml, dich);
    // Trường độ, lời, bè, khuông: không đụng.
    const f = fields(r.xml, dich);
    assert.equal(f.noteType, "quarter");
    assert.equal(f.dots, 0);
    assert.deepEqual(f.lyrics, [{ index: 1, number: "1", text: "Đô", syllabic: "single", extend: false, compound: false }]);
    assert.match(noteText(r.xml, dich), /<duration>4<\/duration>/);
    assert.match(noteText(r.xml, dich), /<voice>1<\/voice>/);
  }
});

test("ChangePitch: dấu nối, TAB, bè và thế bấm không bị đổi lây", () => {
  const noi = P(3, 4); // A4 chấm dôi, đang nối sang nốt sau
  const r = applyCommand(FX, { type: "ChangePitch", path: noi, pitch: { step: "G", alter: 0, octave: 4 } });
  assert.deepEqual(fields(r.xml, noi).ties, ["start", "start"]);
  assert.equal(fields(r.xml, noi).dots, 1);
  assertScoped(FX, r.xml, noi);
  // Nốt kia của chuỗi nối giữ nguyên cao độ: 3B KHÔNG tự sửa cả chuỗi.
  assert.deepEqual(pitchOf(r.xml, P(3, 5)), { step: "A", alter: 0, octave: 4 });

  const tab = P(1, 3, 2); // F♯4 · dây 1 phím 2
  const t = applyCommand(FX, { type: "ChangePitch", path: tab, pitch: { step: "A", alter: 0, octave: 4 } });
  assert.deepEqual(fields(t.xml, tab).tab, { string: 1, fret: 2 }, "ChangePitch không được tự đổi thế bấm");
  assertScoped(FX, t.xml, tab);
});

test("ChangePitch: từ chối rõ ràng khi không thể sửa", () => {
  const p: Pitch = { step: "C", alter: 0, octave: 4 };
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(6, 10), pitch: p })), "EDIT_NOTE_HAS_NO_PITCH");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(1, 1), pitch: p })), "EDIT_TARGET_NOT_NOTE");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(9, 9), pitch: p })), "EDIT_TARGET_NOT_FOUND");
  assert.equal(code(() => applyCommand(FX, { type: "ChangePitch", path: P(1, 2), pitch: { ...p, alter: 3 } })), "EDIT_PITCH_INVALID");
});

// ── 2. Dấu hoá hiển thị ───────────────────────────────────────────────────────
test("dấu hoá tự động: theo bộ khoá của ĐÚNG ô nhịp đó (Đô trưởng, Sol trưởng, Fa trưởng)", () => {
  const dau = (path: string, pitch: Pitch) =>
    accidentalOf(applyCommand(FX, { type: "ChangePitch", path, pitch }).xml, path);
  // Đô trưởng (m1): F♯ khác bộ khoá → phải vẽ dấu thăng.
  assert.equal(dau(P(1, 5), { step: "F", alter: 1, octave: 4 }), "sharp");
  // Sol trưởng (m2): F♯ đã nằm trong bộ khoá → KHÔNG vẽ dấu; F bình thì phải vẽ.
  assert.equal(dau(P(2, 2), { step: "F", alter: 1, octave: 5 }), null);
  assert.equal(dau(P(2, 2), { step: "F", alter: 0, octave: 4 }), "natural");
  // Fa trưởng (m3): B♭ trong bộ khoá → không vẽ; B bình → vẽ dấu bình.
  assert.equal(dau(P(3, 2), { step: "B", alter: -1, octave: 5 }), null);
  assert.equal(dau(P(3, 2), { step: "B", alter: 0, octave: 5 }), "natural");
  // Bộ khoá của ô nhịp nào tính theo ô nhịp ấy: cùng một cao độ, hai câu trả lời.
  assert.equal(dau(P(1, 5), { step: "B", alter: -1, octave: 5 }), "flat");
  assert.deepEqual([keyAlter("F", 1), keyAlter("B", -1), keyAlter("C", 0)], [1, -1, 0]);
});


test("dấu hoá tự động: nhớ dấu đã viết trước đó trong CÙNG ô nhịp", () => {
  // Ô nhịp 1 viết C♯ ở c3 rồi C♮ ở c4 — kỳ vọng của người đọc đổi theo từng chỗ.
  const dau = (path: string, pitch: Pitch) =>
    accidentalOf(applyCommand(FX, { type: "ChangePitch", path, pitch }).xml, path);
  // Ngay sau dấu thăng đã viết: một C♯ nữa thì không cần vẽ lại.
  assert.equal(dau(P(1, 4), { step: "C", alter: 1, octave: 4 }), null);
  // Nhưng sau khi c4 đã viết dấu bình, C♯ ở c5 lại phải vẽ.
  assert.equal(dau(P(1, 5), { step: "C", alter: 1, octave: 4 }), "sharp");
  // Dấu của ô nhịp không áp sang quãng tám khác.
  assert.equal(dau(P(1, 5), { step: "C", alter: 1, octave: 5 }), "sharp");
  // Đúng điều người đọc chờ đợi thì không vẽ gì.
  assert.equal(dau(P(1, 5), { step: "C", alter: 0, octave: 4 }), null);
});


test("dấu hoá: <accidental> cũ luôn được quyết lại — không để lại dấu sai tiếng", () => {
  // c3 đang là C♯4 kèm <accidental>sharp</accidental>.
  const doi = (pitch: Pitch, path = P(1, 3)) =>
    applyCommand(FX, { type: "ChangePitch", path, pitch }).xml;
  // Sang D4: dấu thăng phải biến mất hẳn, không được đứng lại trên nốt khác.
  const d = doi({ step: "D", alter: 0, octave: 4 });
  assert.equal(accidentalOf(d, P(1, 3)), null);
  assert.doesNotMatch(noteText(d, P(1, 3)), /<accidental>/);
  assertScoped(FX, d, P(1, 3));
  // Sang C4 (đúng điều người đọc chờ đợi ở chỗ đó): cũng phải bỏ dấu thăng.
  assert.equal(accidentalOf(doi({ step: "C", alter: 0, octave: 4 }), P(1, 3)), null);
  // Sang C♭4: dấu thăng phải THÀNH dấu giáng, không được giữ nguyên.
  const cb = doi({ step: "C", alter: -1, octave: 4 });
  assert.equal(accidentalOf(cb, P(1, 3)), "flat");
  assert.doesNotMatch(noteText(cb, P(1, 3)), /<accidental>sharp<\/accidental>/);
  // Chiều ngược lại: F♮4 (có dấu bình) đổi thành F♯4 trong Sol trưởng → bỏ dấu.
  assert.equal(accidentalOf(doi({ step: "F", alter: 1, octave: 4 }, P(2, 3)), P(2, 3)), null);
});


test("dấu hoá: thầy chọn tay — Hiện rõ (dấu nhắc) và Ẩn", () => {
  const hien = applyCommand(FX, {
    type: "ChangePitch", path: P(2, 4), pitch: { step: "F", alter: 1, octave: 4 }, accidental: "hien",
  });
  assert.equal(accidentalOf(hien.xml, P(2, 4)), "sharp", "Hiện rõ = dấu nhắc dù bộ khoá đã có");
  const an = applyCommand(FX, {
    type: "ChangePitch", path: P(1, 5), pitch: { step: "F", alter: 1, octave: 4 }, accidental: "an",
  });
  assert.equal(accidentalOf(an.xml, P(1, 5)), null, "Ẩn = không vẽ dấu nào");
  // Dấu kép cũng phải ra đúng ký hiệu.
  const kep = applyCommand(FX, { type: "ChangePitch", path: P(1, 5), pitch: { step: "F", alter: 2, octave: 4 } });
  assert.equal(accidentalOf(kep.xml, P(1, 5)), "double-sharp");
  const giangKep = applyCommand(FX, { type: "ChangePitch", path: P(1, 5), pitch: { step: "F", alter: -2, octave: 4 } });
  assert.equal(accidentalOf(giangKep.xml, P(1, 5)), "flat-flat");
});

test("dấu hoá: bộ khắc vẽ đúng số dấu — và sự thật đã đo về <alter> không có <accidental>", async () => {
  const r = await createAnnotatedScoreRenderer();
  try {
    const demDau = (xml: string) =>
      r
        .render(xml)
        .pages.map((p) => (p.svg.match(/<g[^>]*class="accid"/g) ?? []).length)
        .reduce((a, b) => a + b, 0);
    const goc = demDau(FX);
    // Thêm một dấu giáng cần thiết → vẽ thêm đúng 1 dấu.
    const them = applyCommand(FX, { type: "ChangePitch", path: P(1, 5), pitch: { step: "D", alter: -1, octave: 4 } });
    assert.equal(accidentalOf(them.xml, P(1, 5)), "flat");
    assert.equal(demDau(them.xml), goc + 1, "dấu hoá mới phải được vẽ ra");
    // Bỏ một dấu đang có → vẽ ít đi đúng 1.
    const bo = applyCommand(FX, { type: "ChangePitch", path: P(1, 3), pitch: { step: "D", alter: 0, octave: 4 } });
    assert.equal(accidentalOf(bo.xml, P(1, 3)), null);
    assert.equal(demDau(bo.xml), goc - 1);
    // ĐÃ ĐO: khi thiếu <accidental>, bộ khắc vẫn tự vẽ dấu theo <alter> và KHÔNG
    // xét bộ khoá. Nên "Ẩn" chỉ có tác dụng trong FILE (music21 và các phần mềm
    // khác đọc đúng), còn bản xem trước vẫn hiện dấu. Ghi lại bằng test để đổi
    // hành vi ấy là biết ngay, và để không ai tưởng <alter> là đủ.
    const an = applyCommand(FX, {
      type: "ChangePitch", path: P(1, 5), pitch: { step: "D", alter: -1, octave: 4 }, accidental: "an",
    });
    assert.equal(accidentalOf(an.xml, P(1, 5)), null, "file KHÔNG ghi dấu hiển thị");
    assert.equal(demDau(an.xml), goc + 1, "nhưng bộ khắc vẫn vẽ theo <alter>");
  } finally {
    r.destroy();
  }
});


test("RespellNote: giữ nguyên tiếng, chỉ đổi mặt chữ; đổi tiếng là bị chặn", () => {
  const dich = P(1, 3); // C♯4
  const truoc = pitchOf(FX, dich)!;
  const r = applyCommand(FX, { type: "RespellNote", path: dich, pitch: { step: "D", alter: -1, octave: 4 } });
  const sau = pitchOf(r.xml, dich)!;
  assert.deepEqual(sau, { step: "D", alter: -1, octave: 4 });
  assert.equal(soundingPitch(sau), soundingPitch(truoc), "đổi cách ghi KHÔNG được đổi tiếng");
  assert.equal(accidentalOf(r.xml, dich), "flat");
  assertScoped(FX, r.xml, dich);
  assert.equal(
    code(() => applyCommand(FX, { type: "RespellNote", path: dich, pitch: { step: "D", alter: 0, octave: 4 } })),
    "EDIT_RESPELL_CHANGES_PITCH"
  );
  // Sang quãng tám khác vẫn là đổi cách ghi nếu cùng tiếng: B♯3 = C4.
  const b = applyCommand(FX, { type: "RespellNote", path: P(1, 2), pitch: { step: "B", alter: 1, octave: 3 } });
  assert.equal(soundingPitch(pitchOf(b.xml, P(1, 2))!), soundingPitch({ step: "C", alter: 0, octave: 4 }));
});

test("cách ghi khác: gợi ý đúng, không gợi ý dấu kép, không gợi ý lại chính nó", () => {
  assert.deepEqual(enharmonics({ step: "G", alter: 1, octave: 4 }).map(pitchName), ["A♭4"]);
  assert.deepEqual(fields(FX, P(1, 3)).respell.map(pitchName), ["D♭4"]);
  assert.deepEqual(fields(FX, P(3, 2)).respell.map(pitchName), ["A♯4"]);
  for (const p of enharmonics({ step: "C", alter: 0, octave: 4 }))
    assert.notEqual(soundingPitch(p) - soundingPitch({ step: "C", alter: 0, octave: 4 }), 1);
  assert.ok(fields(FX, P(1, 2)).respell.every((p) => Math.abs(p.alter) <= 1));
});

// ── 4–6. Trường độ ────────────────────────────────────────────────────────────
test("ChangeDuration: ghi lại cả <duration>, <type> và <dot> theo divisions của bản nhạc", () => {
  const dich = P(1, 2); // divisions = 4
  for (const [noteType, dots, duration] of [
    ["whole", 0, 16], ["half", 0, 8], ["quarter", 0, 4], ["eighth", 0, 2], ["16th", 0, 1],
    ["half", 1, 12], ["quarter", 1, 6], ["eighth", 1, 3], ["half", 2, 14],
  ] as const) {
    const r = applyCommand(FX, { type: "ChangeDuration", path: dich, noteType, dots });
    const f = fields(r.xml, dich);
    assert.equal(f.noteType, noteType);
    assert.equal(f.dots, dots);
    assert.match(noteText(r.xml, dich), new RegExp(`<duration>${duration}</duration>`), `${noteType}+${dots}`);
    assertScoped(FX, r.xml, dich);
    // Cao độ và lời không đụng.
    assert.deepEqual(f.pitch, { step: "C", alter: 0, octave: 4 });
    assert.deepEqual(f.lyrics, [{ index: 1, number: "1", text: "Đô", syllabic: "single", extend: false, compound: false }]);
  }
  assert.equal(dotFactor(0), 1);
  assert.equal(dotFactor(1), 1.5);
  assert.equal(dotFactor(2), 1.75);
});

test("ChangeDuration: cùng hình nốt cho số đo KHÁC NHAU khi divisions khác nhau", () => {
  // m1 divisions = 4 · m6 divisions = 12 — cùng "nốt đen" nhưng <duration> khác.
  const a = applyCommand(FX, { type: "ChangeDuration", path: P(1, 2), noteType: "eighth", dots: 0 });
  assert.match(noteText(a.xml, P(1, 2)), /<duration>2<\/duration>/);
  const b = applyCommand(FX, { type: "ChangeDuration", path: P(6, 7), noteType: "eighth", dots: 0 });
  assert.match(noteText(b.xml, P(6, 7)), /<duration>6<\/duration>/);
  assert.equal(durationFor("eighth", 0, 4), 2);
  assert.equal(durationFor("eighth", 0, 12), 6);
  assert.equal(durationFor("16th", 0, 12), 3);
  // divisions = 4 không ghi nổi móc kép chấm: nói thẳng, không làm tròn.
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeDuration", path: P(1, 2), noteType: "16th", dots: 1 })),
    "EDIT_DURATION_NOT_REPRESENTABLE"
  );
  assert.equal(code(() => durationFor("16th", 2, 4)), "EDIT_DURATION_NOT_REPRESENTABLE");
});

test("ChangeDuration: bỏ dấu chùm khi hình nốt không còn chùm được; giữ khi vẫn chùm được", () => {
  const chum = P(4, 2); // G4 móc đơn, có <beam>begin</beam>
  assert.match(noteText(FX, chum), /<beam number="1">begin<\/beam>/);
  const den = applyCommand(FX, { type: "ChangeDuration", path: chum, noteType: "quarter", dots: 0 });
  assert.doesNotMatch(noteText(den.xml, chum), /<beam/, "nốt đen không có dấu chùm");
  assertScoped(FX, den.xml, chum);
  const kep = applyCommand(FX, { type: "ChangeDuration", path: chum, noteType: "16th", dots: 0 });
  assert.match(noteText(kep.xml, chum), /<beam number="1">begin<\/beam>/, "móc kép vẫn chùm được");
});

test("ChangeDuration: từ chối đúng chỗ — hợp âm, chùm ba, lặng cả ô", () => {
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeDuration", path: P(2, 5), noteType: "quarter", dots: 0 })),
    "EDIT_DURATION_CHORD"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeDuration", path: P(2, 4), noteType: "quarter", dots: 0 })),
    "EDIT_DURATION_CHORD"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeDuration", path: P(6, 4), noteType: "quarter", dots: 0 })),
    "EDIT_DURATION_TUPLET"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeDuration", path: P(2, 1, 2), noteType: "quarter", dots: 0 })),
    "EDIT_DURATION_MEASURE_REST"
  );
  // Nhưng CAO ĐỘ của nốt hợp âm và nốt chùm ba thì vẫn sửa được.
  assert.equal(applyCommand(FX, { type: "ChangePitch", path: P(2, 5), pitch: { step: "D", alter: 0, octave: 4 } }).changed, true);
  assert.equal(applyCommand(FX, { type: "ChangePitch", path: P(6, 4), pitch: { step: "G", alter: 0, octave: 5 } }).changed, true);
});

test("ChangeDuration: nốt hoa mỹ không có <duration> — chỉ đổi hình nốt, không bịa số đo", () => {
  const hoaMy = P(6, 2);
  assert.doesNotMatch(noteText(FX, hoaMy), /<duration>/);
  const r = applyCommand(FX, { type: "ChangeDuration", path: hoaMy, noteType: "16th", dots: 0 });
  assert.equal(fields(r.xml, hoaMy).noteType, "16th");
  assert.doesNotMatch(noteText(r.xml, hoaMy), /<duration>/);
  assert.match(noteText(r.xml, hoaMy), /<grace slash="yes"\/>/);
  assertScoped(FX, r.xml, hoaMy);
});

test("ChangeDuration: chèn <type>/<dot> đúng thứ tự chuẩn MusicXML", () => {
  const khongType = FX.replace("<duration>4</duration>\n        <voice>1</voice>\n        <type>quarter</type>\n        <lyric number=\"1\">\n          <syllabic>single</syllabic>\n          <text>Đô</text>", "<duration>4</duration>\n        <voice>1</voice>\n        <lyric number=\"1\">\n          <syllabic>single</syllabic>\n          <text>Đô</text>");
  assert.notEqual(khongType, FX);
  const r = applyCommand(khongType, { type: "ChangeDuration", path: P(1, 2), noteType: "half", dots: 1 });
  const t = noteText(r.xml, P(1, 2));
  assert.ok(t.indexOf("<voice>") < t.indexOf("<type>"), "<type> phải sau <voice>");
  assert.ok(t.indexOf("<type>") < t.indexOf("<dot/>"), "<dot> phải sau <type>");
  assert.ok(t.indexOf("<dot/>") < t.indexOf("<lyric"), "<dot> phải trước <lyric>");
  assert.equal(fields(r.xml, P(1, 2)).dots, 1);
  // Thêm rồi bớt chấm phải quay về đúng như cũ.
  const themCham = applyCommand(FX, { type: "ChangeDuration", path: P(3, 2), noteType: "eighth", dots: 1 });
  const boCham = applyCommand(themCham.xml, { type: "ChangeDuration", path: P(3, 2), noteType: "eighth", dots: 0 });
  assert.equal(boCham.xml, FX);
});

// ── 7. Nốt trong hợp âm ───────────────────────────────────────────────────────
test("hợp âm C–E–G: sửa E → E♭ thì C và G không đổi một byte, <chord/> còn nguyên", () => {
  const e = P(2, 5);
  const r = applyCommand(FX, { type: "ChangePitch", path: e, pitch: { step: "E", alter: -1, octave: 4 } });
  assert.deepEqual(pitchOf(r.xml, e), { step: "E", alter: -1, octave: 4 });
  assert.equal(accidentalOf(r.xml, e), "flat");
  assert.deepEqual(pitchOf(r.xml, P(2, 4)), { step: "C", alter: 0, octave: 4 });
  assert.deepEqual(pitchOf(r.xml, P(2, 6)), { step: "G", alter: 0, octave: 4 });
  assert.equal(noteText(r.xml, P(2, 4)), noteText(FX, P(2, 4)));
  assert.equal(noteText(r.xml, P(2, 6)), noteText(FX, P(2, 6)));
  assert.match(noteText(r.xml, e), /<chord\/>/);
  assert.equal(fields(r.xml, e).chord, "member");
  assertScoped(FX, r.xml, e);
});

// ── 8–9. Cảnh báo theo ngữ cảnh ───────────────────────────────────────────────
test("cảnh báo dấu nối: nói rõ nốt đang nối, và chỉ sửa nốt này", () => {
  assert.deepEqual(fields(FX, P(3, 4)).ties, ["start", "start"]);
  assert.deepEqual(fields(FX, P(3, 5)).ties, ["stop", "stop"]);
  assert.deepEqual(fields(FX, P(3, 2)).ties, []);
});

test("cảnh báo TAB: đổi cao độ làm thế bấm không còn khớp thì báo, không tự sửa", () => {
  const tab = P(1, 3, 2); // F♯4 · dây 1 phím 2 — đang khớp
  assert.equal(fields(FX, tab).tabKhop, true);
  const r = applyCommand(FX, { type: "ChangePitch", path: tab, pitch: { step: "A", alter: 0, octave: 4 } });
  assert.equal(fields(r.xml, tab).tabKhop, false);
  const moi = newWarnings(FX, r.xml);
  assert.ok(moi.some((w) => w.code === TAB_MISMATCH && w.path === tab), JSON.stringify(moi));
  assert.deepEqual(fields(r.xml, tab).tab, { string: 1, fret: 2 }, "không tự tìm thế bấm mới");
  // Đổi sang đúng cao độ của thế bấm thì hết cảnh báo.
  const dung = applyCommand(r.xml, { type: "ChangePitch", path: tab, pitch: { step: "F", alter: 1, octave: 4 } });
  assert.deepEqual(newWarnings(FX, dung.xml), []);
});

test("cảnh báo ký âm: nốt sau trong ô nhịp bị đọc khác đi thì báo — bản nháp mới mới tính", () => {
  assert.deepEqual(newWarnings(FX, FX), []);
  // Đổi C♯4 (c3) thành D♯4: D4 ở c5 không mang dấu nên sẽ bị đọc thành D♯.
  const r = applyCommand(FX, { type: "ChangePitch", path: P(1, 3), pitch: { step: "D", alter: 1, octave: 4 } });
  assert.equal(accidentalOf(r.xml, P(1, 3)), "sharp");
  const moi = newWarnings(FX, r.xml);
  assert.ok(
    moi.some((w) => w.code === ACCIDENTAL_READING && w.path === P(1, 5)),
    JSON.stringify(moi)
  );
  // Sửa nốt sau cho rõ ràng thì hết cảnh báo — công cụ KHÔNG tự làm hộ việc này.
  const vaLai = applyCommand(r.xml, {
    type: "ChangePitch", path: P(1, 5), pitch: { step: "D", alter: 0, octave: 4 }, accidental: "hien",
  });
  assert.equal(accidentalOf(vaLai.xml, P(1, 5)), "natural");
  assert.deepEqual(newWarnings(FX, vaLai.xml), []);
});

// ── 10. Nhịp hỏng thì chặn lưu ────────────────────────────────────────────────
test("nhịp: trường độ mới làm thừa phách → cảnh báo ngay và CHẶN lưu", async () => {
  const thua = applyCommand(FX, { type: "ChangeDuration", path: P(1, 2), noteType: "whole", dots: 0 }).xml;
  const loi = newRhythmIssues(FX, thua);
  assert.equal(loi.length > 0, true);
  assert.match(loi.join(" "), /Ô nhịp thứ 1: thừa phách/);
  const lib = { calls: [] as SaveRequest[], async save(req: SaveRequest): Promise<SaveResult> { this.calls.push(req); return { scoreId: "s", versionId: "v", versionNumber: 2, createdScore: false }; } };
  const out = await saveDraftAsVersion({
    library: lib, scoreId: "s1", sourceFilename: "a.musicxml", original: FX, draft: thua,
    changeNote: "x", pageCount: 1, render: () => undefined,
  });
  assert.equal(out.result, null);
  assert.equal(out.report.stages.find((s) => s.id === "rhythm")!.ok, false);
  assert.equal(lib.calls.length, 0, "nhịp hỏng mà vẫn gọi lưu là hỏng cả cổng");
  // Sửa cho bù lại (nốt trắng + hai móc đơn + nốt đen = đủ 4/4) thì lưu được.
  const bu = applyCommand(thua, { type: "ChangeDuration", path: P(1, 2), noteType: "half", dots: 0 }).xml;
  const bu2 = applyCommand(bu, { type: "ChangeDuration", path: P(1, 3), noteType: "eighth", dots: 0 }).xml;
  const bu3 = applyCommand(bu2, { type: "ChangeDuration", path: P(1, 4), noteType: "eighth", dots: 0 }).xml;
  assert.deepEqual(newRhythmIssues(FX, bu3), []);
  const ok = await saveDraftAsVersion({
    library: lib, scoreId: "s1", sourceFilename: "a.musicxml", original: FX, draft: bu3,
    changeNote: "x", pageCount: 1, render: () => undefined,
  });
  assert.equal(ok.result?.versionNumber, 2);
  assert.equal(lib.calls.length, 1);
});

// ── 11. Hoàn tác / làm lại với lệnh mới ───────────────────────────────────────
test("hoàn tác / làm lại: đủ bốn loại lệnh, dựng lại đúng từ bản gốc", () => {
  const lenh: MusicXmlEditCommand[] = [
    { type: "ChangePitch", path: P(1, 2), pitch: { step: "E", alter: -1, octave: 4 } },
    { type: "ChangeDuration", path: P(1, 2), noteType: "eighth", dots: 1 },
    { type: "RespellNote", path: P(1, 3), pitch: { step: "D", alter: -1, octave: 4 } },
    { type: "ChangeLyricText", path: P(1, 2), lyricIndex: 1, text: "Rề" },
  ];
  let d = createDraft(FX);
  for (const c of lenh) d = applyToDraft(d, c);
  assert.equal(d.xml, rebuildDraft(FX, lenh));
  assert.equal(fields(d.xml, P(1, 2)).noteType, "eighth");
  assert.deepEqual(pitchOf(d.xml, P(1, 3)), { step: "D", alter: -1, octave: 4 });
  for (let i = lenh.length - 1; i >= 0; i--) {
    d = undo(d);
    assert.equal(d.xml, rebuildDraft(FX, lenh.slice(0, i)), `hoàn tác về ${i} lệnh`);
  }
  assert.equal(d.xml, FX);
  for (let i = 1; i <= lenh.length; i++) {
    d = redo(d);
    assert.equal(d.xml, rebuildDraft(FX, lenh.slice(0, i)), `làm lại tới ${i} lệnh`);
  }
  assert.equal(
    describeCommands(lenh),
    "Sửa cao độ 1 nốt · đổi cách ghi 1 nốt · sửa trường độ 1 nốt · sửa lời 1 chỗ"
  );
  assert.equal(
    describeCommands([lenh[0], { ...lenh[0], path: P(1, 4) }, lenh[1]]),
    "Sửa cao độ 2 nốt · sửa trường độ 1 nốt"
  );
});

// ── 15. Đối chiếu bằng music21 (oracle độc lập) ───────────────────────────────
const PYTHON = process.env.NHIPPHACH_MUSIC21 ?? "python3";
const coMusic21 = (() => {
  try {
    execFileSync(PYTHON, ["-c", "import music21"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const ORACLE = new URL("./oracle/read_score.py", import.meta.url).pathname;

test(
  "music21 đọc lại: cao độ, dấu hoá PHẢI HIỆN, và trường độ đều đúng như công cụ định ghi",
  { skip: !coMusic21 && "máy này chưa có music21 (đặt NHIPPHACH_MUSIC21 trỏ tới python có music21)" },
  async () => {
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "nhipphach-oracle-"));
    const doc = (xml: string, part: number, measure: number) => {
      const file = join(dir, `m${Math.random().toString(36).slice(2)}.musicxml`);
      writeFileSync(file, xml);
      return JSON.parse(
        execFileSync(PYTHON, [ORACLE, file, String(part), String(measure)], { encoding: "utf8" })
      ) as { ten: string; alter: number; hienDau: boolean; phach: number; hinh: string; cham: number }[];
    };
    // Gốc: music21 đồng ý với chính fixture.
    assert.deepEqual(
      doc(FX, 1, 1).map((n) => [n.ten, n.hienDau, n.phach]),
      [["C4", false, 1], ["C#4", true, 1], ["C4", true, 1], ["D4", false, 1]]
    );
    // Sol trưởng: F♯ không cần dấu, F bình thì cần — music21 xác nhận luật của ta.
    assert.deepEqual(doc(FX, 1, 2).map((n) => [n.ten, n.hienDau]).slice(0, 2), [
      ["F#4", false],
      ["F4", true],
    ]);
    const fBinh = applyCommand(FX, { type: "ChangePitch", path: P(2, 2), pitch: { step: "F", alter: 0, octave: 4 } }).xml;
    assert.deepEqual(doc(fBinh, 1, 2).map((n) => [n.ten, n.hienDau]).slice(0, 2), [
      ["F4", true],
      ["F4", true],
    ]);
    // Trường độ: music21 đọc ra đúng số phách, hình nốt và số chấm.
    const cham = applyCommand(FX, { type: "ChangeDuration", path: P(1, 2), noteType: "half", dots: 1 }).xml;
    assert.deepEqual(doc(cham, 1, 1)[0], { ten: "C4", alter: 0, hienDau: false, phach: 3, hinh: "half", cham: 1 });
    // divisions = 12: nốt đen vẫn phải ra đúng 1 phách.
    const den12 = applyCommand(FX, { type: "ChangeDuration", path: P(6, 7), noteType: "quarter", dots: 0 }).xml;
    assert.equal(doc(den12, 1, 6).filter((n) => n.ten === "D5" && n.hinh === "quarter").at(-1)?.phach, 1);
    // Đổi cách ghi: music21 phải thấy CÙNG một tiếng, khác mặt chữ.
    const respell = applyCommand(FX, { type: "RespellNote", path: P(1, 3), pitch: { step: "D", alter: -1, octave: 4 } }).xml;
    const sau = doc(respell, 1, 1);
    assert.deepEqual(sau.map((n) => n.ten), ["C4", "D-4", "C4", "D4"]);
    assert.equal(sau[1].hienDau, true, "cách ghi mới vẫn phải hiện dấu");
    assert.equal(sau[1].phach, doc(FX, 1, 1)[1].phach, "đổi cách ghi không đụng trường độ");
  }
);
