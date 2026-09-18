/**
 * TẦNG TƯƠNG TÁC BÀN PHÍM — Giai đoạn 4A.
 *
 * Điều phải chứng minh: bấm một nốt rồi lái bằng bàn phím cho ra ĐÚNG những
 * lệnh mà panel cũ vẫn phát, không hơn không kém — và con trỏ đi theo THỨ TỰ
 * TÀI LIỆU chứ không theo toạ độ.
 *
 * Ba lằn ranh được khoá bằng test ở đây:
 *   1. tầng bàn phím không biết XML / Verovio / Supabase
 *   2. con trỏ không có một dòng hình học nào
 *   3. không có model bản nhạc thứ hai — mọi thay đổi là `MusicXmlEditCommand`
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dispatch, dangGoChu } from "../../src/nhipphach/editor/dispatcher.ts";
import { KEYMAP, nhanPhim, phimCua, traPhim } from "../../src/nhipphach/editor/keymap.ts";
import { NP_CSS } from "../../src/nhipphach/theme.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import {
  RONG,
  caretTaiId,
  chonMot,
  diChuyen,
  dsDiDuoc,
  idDangChon,
} from "../../src/nhipphach/editor/caret.ts";
import type { ScoreCaret } from "../../src/nhipphach/editor/caret.ts";
import type { EditorAction } from "../../src/nhipphach/editor/actions.ts";
import { laDieuHuong, laNganXep } from "../../src/nhipphach/editor/actions.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import type { SourceNote } from "../../src/musicxml-beats/sourceTags.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { idTaiCho } from "../../src/nhipphach/edit/draftIdentity.ts";
import { chepDoan } from "../../src/nhipphach/edit/clipboard.ts";
import { NHAP_BAN_DAU, datTruongDo, ghiNhoThamChieu } from "../../src/nhipphach/editor/noteEntry.ts";
import { applyToDraft, createDraft, rebuildDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { pitchName, soundingPitch, transposeSemitone } from "../../src/nhipphach/edit/pitchModel.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { AnnotatedScore, ScoreSettings } from "../../src/musicxml-beats/renderer/types.ts";
import { byId, parse } from "../../src/musicxml-beats/renderer/xml.ts";
import { resolveScoreElement } from "../../src/nhipphach/noteSelection.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const E = "../nhipphach-edit/fixtures/";

/** Bộ fixture của mục 14: đủ mọi hình thù mà điều hướng phải sống sót. */
const FIXTURES: { ten: string; xml: string; grouping?: unknown }[] = [
  { ten: "nốt nối tiếp · lời · hợp âm · 6/8 · 5/8 · 7/8", xml: read(E + "lyric-harmony.musicxml"),
    grouping: { byMeter: { "5/8": [2, 3], "7/8": [2, 2, 3] } } },
  { ten: "hợp âm · dấu nối · hai bè · TAB · hoa mỹ", xml: read(E + "note-editing.musicxml") },
  { ten: "hợp âm 3 nốt · hoa mỹ · dấu nối · bè 2", xml: read("../nhipphach-select/fixtures/chord-grace-tie-voices.musicxml") },
  { ten: "hai khuông", xml: read("../musicxml-mvp/fixtures/two-staves.musicxml") },
  { ten: "guitar + TAB", xml: read("../nhipphach-layout/fixtures/guitar-tab.musicxml") },
  { ten: "lấy đà", xml: read("../musicxml-subdivision/fixtures/pickup-quarter.musicxml") },
  { ten: "lặng cả ô (không vẽ id)", xml: read(E + "lyric-unresolvable.musicxml") },
];
const FX = FIXTURES[0].xml;
const notesOf = (xml: string) => tagSourceIds(xml).notes;

const renderer = await createAnnotatedScoreRenderer();
const SETTINGS = {
  ...DEFAULT_SCORE_SETTINGS,
  grouping: FIXTURES[0].grouping as never,
} as ScoreSettings;
test.after(() => renderer.destroy());

// ══ 1. Bảng phím ═══════════════════════════════════════════════════════════

test("keymap: mỗi phím của mục 2 ra đúng hành động, không phím nào mang hai nghĩa", () => {
  const S = (key: string, ctrl = false, shift = false, alt = false) => ({ key, ctrl, shift, alt });
  assert.deepEqual(traPhim(S("ArrowRight")), { type: "MOVE", where: "next" });
  assert.deepEqual(traPhim(S("ArrowLeft")), { type: "MOVE", where: "prev" });
  assert.deepEqual(traPhim(S("ArrowRight", true)), { type: "MOVE", where: "nextMeasure" });
  assert.deepEqual(traPhim(S("ArrowLeft", true)), { type: "MOVE", where: "prevMeasure" });
  assert.deepEqual(traPhim(S("Home")), { type: "MOVE", where: "first" });
  assert.deepEqual(traPhim(S("End")), { type: "MOVE", where: "last" });
  assert.deepEqual(traPhim(S("ArrowUp")), { type: "TRANSPOSE", semitones: 1 });
  assert.deepEqual(traPhim(S("ArrowDown")), { type: "TRANSPOSE", semitones: -1 });
  assert.deepEqual(traPhim(S("ArrowUp", true)), { type: "TRANSPOSE", semitones: 12 });
  assert.deepEqual(traPhim(S("ArrowDown", true)), { type: "TRANSPOSE", semitones: -12 });
  // Vòng 2: trường độ theo Guitar Pro — `-` dài ra, `=` ngắn lại; bỏ 3–7.
  assert.deepEqual(traPhim(S("-")), { type: "STEP_DURATION", dir: 1 });
  assert.deepEqual(traPhim(S("=")), { type: "STEP_DURATION", dir: -1 });
  for (const k of ["3", "4", "5", "6", "7"]) assert.equal(traPhim(S(k)), null, k);
  assert.deepEqual(traPhim(S(".")), { type: "TOGGLE_DOT" });
  assert.deepEqual(traPhim(S("E", false, true)), { type: "RESPELL" });
  assert.deepEqual(traPhim(S("z", true)), { type: "UNDO" });
  assert.deepEqual(traPhim(S("z", true, true)), { type: "REDO" });
  // 4B.1 nhận thêm Delete/Backspace/0/R và A–G; những phím sau vẫn phải im.
  for (const k of ["T", "Insert", ",", "Tab", "1", "2", "8", "9", "q"])
    assert.equal(traPhim(S(k)), null, `phím ${k} chưa được phép có nghĩa`);
  // Một phím KHÔNG được mang hai nghĩa: `.` là chấm dôi, không phải gấp đôi.
  const trung = new Map<string, number>();
  for (const b of KEYMAP) {
    const khoa = `${b.key}|${!!b.ctrl}|${!!b.shift}|${!!b.alt}`;
    trung.set(khoa, (trung.get(khoa) ?? 0) + 1);
  }
  assert.deepEqual([...trung].filter(([, n]) => n > 1), [], "có phím trùng trong bảng");
  // Đo được trên bộ tự động hoá: giữ Shift có nơi gửi `key:"E"`, có nơi gửi
  // `key:"e"` kèm `shiftKey:true`. Phím tắt phải chạy ở CẢ HAI đường.
  assert.deepEqual(traPhim(S("e", false, true)), { type: "RESPELL" });
  assert.deepEqual(traPhim(S("E", false, true)), { type: "RESPELL" });
  assert.deepEqual(traPhim(S("Z", true, true)), { type: "REDO" });
  assert.deepEqual(traPhim(S("z", true, true)), { type: "REDO" });
  assert.deepEqual(traPhim(S("Z", true)), { type: "UNDO" });
  // Nhưng có Shift hay không vẫn là hai nghĩa khác nhau.
  // 4B.1: `e` trơ là NHẬP nốt Mi, còn Shift+E vẫn là đổi cách ghi — hai nghĩa
  // khác nhau cho cùng một chữ, phân biệt bằng đúng cờ Shift.
  assert.deepEqual(traPhim(S("e")), { type: "ENTER_PITCH", step: "E" });
  assert.deepEqual(traPhim(S("E", false, true)), { type: "RESPELL" });
});

test("keymap: ghi công Smoosic có mặt trong mã nguồn và trong THIRD_PARTY_NOTICES", () => {
  const km = src("nhipphach/editor/keymap.ts");
  assert.match(km, /Smoosic/);
  assert.match(km, /MIT/);
  assert.match(km, /Aaron David Newman/);
  assert.match(km, /trackerKeys|editorKeys/);
  const notices = readFileSync(new URL("../../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");
  assert.match(notices, /Smoosic/);
  assert.match(notices, /MIT License/);
  assert.match(notices, /Copyright \(c\) 2021 Aaron David Newman/);
  // Và KHÔNG kéo Smoosic vào bundle.
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const ten of Object.keys(deps))
    assert.doesNotMatch(ten, /smoosic|vexflow/i, `${ten} không được vào bundle`);
});

// ══ 2. Bộ phân phối — an toàn tiêu điểm ════════════════════════════════════

test("phân phối: đang gõ chữ thì bản nhạc KHÔNG được ăn phím", () => {
  const OK = { choSua: true };
  const go = (tagName: string) => ({ tagName });
  // Gõ "a" vào ô Lời không được biến nốt thành La — mà "a" cũng chưa có nghĩa.
  for (const tag of ["input", "textarea", "select", "button"]) {
    const r = dispatch({ key: "ArrowRight", target: go(tag) }, OK);
    assert.deepEqual(r, { kind: "blocked", why: "typing" }, `${tag} phải chặn`);
  }
  assert.equal(dangGoChu({ isContentEditable: true }), true);
  assert.equal(dangGoChu({ tagName: "DIV", getAttribute: () => "true" }), true);
  assert.equal(dangGoChu({ tagName: "div", getAttribute: () => null }), false);
  assert.equal(dangGoChu(null), false);
  // Ctrl+Z trong ô nhập phải để cho trình duyệt hoàn tác CHỮ, không hoàn tác nháp.
  assert.deepEqual(dispatch({ key: "z", ctrlKey: true, target: go("input") }, OK), {
    kind: "blocked",
    why: "typing",
  });
  // Tiêu điểm nằm ở ô nhập dù phím rơi chỗ khác thì cũng chặn.
  assert.deepEqual(dispatch({ key: "ArrowRight" }, { choSua: true, focused: go("textarea") }), {
    kind: "blocked",
    why: "typing",
  });
});

test("phân phối: modal, quyền, và phím lạ", () => {
  const div = { tagName: "div" };
  assert.deepEqual(dispatch({ key: "ArrowRight", target: div }, { choSua: true, dangMoModal: true }), {
    kind: "blocked",
    why: "modal",
  });
  // Học viên không có score.edit: bấm phím KHÔNG tạo hành động nào.
  assert.deepEqual(dispatch({ key: "ArrowUp", target: div }, { choSua: false }), {
    kind: "blocked",
    why: "capability",
  });
  assert.deepEqual(dispatch({ key: "-", target: div }, { choSua: false }), {
    kind: "blocked",
    why: "capability",
  });
  // Phím không có trong bảng thì im lặng, kể cả khi có quyền.
  assert.deepEqual(dispatch({ key: "Insert", target: div }, { choSua: true }), { kind: "none" });
  assert.deepEqual(dispatch({ key: "q", target: div }, { choSua: true }), { kind: "none" });
  // 4B.1: Delete giờ CÓ nghĩa — chuyển thành lặng.
  assert.deepEqual(dispatch({ key: "Delete", target: div }, { choSua: true }), {
    kind: "action",
    action: { type: "MAKE_REST" },
  });
  // Alt để dành cho phase sau — không nuốt oan.
  assert.deepEqual(dispatch({ key: "ArrowRight", altKey: true, target: div }, { choSua: true }), {
    kind: "none",
  });
  // ⌘ trên Mac đi cùng đường với Ctrl.
  assert.deepEqual(dispatch({ key: "z", metaKey: true, target: div }, { choSua: true }), {
    kind: "action",
    action: { type: "UNDO" },
  });
  assert.deepEqual(dispatch({ key: "ArrowRight", target: div }, { choSua: true }), {
    kind: "action",
    action: { type: "MOVE", where: "next" },
  });
});

// ══ 3. Con trỏ — thứ tự tài liệu, không hình học ═══════════════════════════

for (const f of FIXTURES)
  test(`con trỏ: đi hết bài rồi lùi hết bài về đúng chỗ cũ — ${f.ten}`, () => {
    const notes = dsDiDuoc(notesOf(f.xml));
    assert.ok(notes.length > 0);
    let caret = caretTaiId(notes, notes[0].svgId)!;
    const xuoi: string[] = [caret.sourceId];
    for (;;) {
      const tiep = diChuyen(notes, caret, "next");
      if (!tiep) break;
      caret = tiep;
      xuoi.push(caret.sourceId);
    }
    // Vòng 2: đi trong CÙNG DÒNG (part + khuông + bè) của nốt đầu, theo thứ tự tài liệu.
    const dong = notes.filter((n) => n.partIndex === notes[0].partIndex && n.staff === notes[0].staff && n.voice === notes[0].voice);
    assert.deepEqual(xuoi, dong.map((n) => n.svgId), "đi xuôi phải đúng thứ tự tài liệu trong dòng");
    const nguoc: string[] = [caret.sourceId];
    for (;;) {
      const lui = diChuyen(notes, caret, "prev");
      if (!lui) break;
      caret = lui;
      nguoc.push(caret.sourceId);
    }
    assert.deepEqual(nguoc.reverse(), xuoi, "đi ngược phải là đảo của đi xuôi");
    // Không cuộn vòng: đứng ở hai đầu thì đứng yên.
    assert.equal(diChuyen(notes, caretTaiId(notes, notes[0].svgId), "prev"), null);
    assert.equal(diChuyen(notes, caretTaiId(notes, xuoi[xuoi.length - 1]), "next"), null);
    assert.equal(diChuyen(notes, caret, "first")!.sourceId, notes[0].svgId);
    assert.equal(diChuyen(notes, caret, "last")!.sourceId, notes[notes.length - 1].svgId);
  });

test("con trỏ: Ctrl+←/→ nhảy sang ĐẦU ô nhịp, không phải nốt liền kề", () => {
  const notes = dsDiDuoc(notesOf(FX));
  const dau = (m: number) => notes.find((n) => n.measureIndex === m)!.svgId;
  let caret = caretTaiId(notes, dau(1))!;
  for (const m of [2, 3, 4, 5, 6, 7]) {
    caret = diChuyen(notes, caret, "nextMeasure")!;
    assert.equal(caret.sourceId, dau(m), `Ctrl+→ phải tới đầu ô ${m}`);
  }
  assert.equal(diChuyen(notes, caret, "nextMeasure"), null, "hết bài thì đứng yên");
  // Đứng ở nốt THỨ HAI của ô 3 mà bấm Ctrl+← thì về đầu ô 2, không về nốt trước.
  const trongO3 = notes.filter((n) => n.measureIndex === 3);
  assert.ok(trongO3.length > 1);
  const lui = diChuyen(notes, caretTaiId(notes, trongO3[1].svgId), "prevMeasure")!;
  assert.equal(lui.sourceId, dau(2));
  assert.equal(diChuyen(notes, caretTaiId(notes, dau(1)), "prevMeasure"), null);
});

test("con trỏ: từng nốt của HỢP ÂM là một chặng riêng (ghi rõ hành vi)", () => {
  const xml = read("../nhipphach-select/fixtures/chord-grace-tie-voices.musicxml");
  const notes = dsDiDuoc(notesOf(xml));
  const hopAm = notes.filter((n) => n.chord);
  assert.ok(hopAm.length >= 2, "fixture phải có hợp âm nhiều nốt");
  // Nốt neo + các nốt mang <chord/> nằm liền nhau trong thứ tự tài liệu, và
  // ←/→ đi qua TỪNG nốt — không gộp hợp âm thành một chặng, vì danh tính nguồn
  // đang là từng nốt và ta cần chọn riêng được một nốt trong hợp âm.
  const neo = notes[notes.indexOf(hopAm[0]) - 1];
  assert.ok(neo && !neo.chord);
  let caret = caretTaiId(notes, neo.svgId)!;
  const đi: string[] = [];
  for (let i = 0; i < hopAm.length; i++) {
    caret = diChuyen(notes, caret, "next")!;
    đi.push(caret.sourceId);
  }
  assert.deepEqual(đi, hopAm.slice(0, hopAm.length).map((n) => n.svgId));
});

test("con trỏ: hai bè / hai khuông đi theo THỨ TỰ TÀI LIỆU, không tự thông minh", () => {
  const notes = dsDiDuoc(notesOf(read("../musicxml-mvp/fixtures/two-staves.musicxml")));
  const theoTaiLieu = notes.map((n) => `${n.partIndex}:${n.measureIndex}:${n.childIndex}`);
  const daSapXep = [...theoTaiLieu].sort((a, b) => {
    const [p1, m1, c1] = a.split(":").map(Number);
    const [p2, m2, c2] = b.split(":").map(Number);
    return p1 - p2 || m1 - m2 || c1 - c2;
  });
  assert.deepEqual(theoTaiLieu, daSapXep, "thứ tự đi phải là thứ tự tài liệu");
  // 4A cố ý KHÔNG có "nốt gần nhất theo thời gian" giữa hai bè — chưa phát minh.
  const src4A = src("nhipphach/editor/caret.ts");
  assert.doesNotMatch(src4A, /onset|tstamp|byTime|nearestTime/i);
});

test("con trỏ: bỏ qua nốt mà bản khắc không vẽ ra", () => {
  const tatCa = notesOf(FX);
  // Luật lọc: nốt nào bộ khắc không vẽ ra thì con trỏ KHÔNG nhảy tới — không
  // để thầy tô sáng vào hư không. Kiểm bằng một tập giả để luật đứng độc lập
  // với việc hôm nay Verovio có bỏ id của nốt nào hay không.
  const mat = new Set([tatCa[2].svgId, tatCa[5].svgId]);
  const diDuoc = dsDiDuoc(tatCa, mat);
  assert.equal(diDuoc.length, tatCa.length - 2);
  for (const n of diDuoc) assert.equal(mat.has(n.svgId), false);
  // Và đi qua chỗ bị bỏ thì nhảy thẳng sang nốt kế tiếp còn vẽ được.
  const truoc = caretTaiId(diDuoc, tatCa[1].svgId)!;
  assert.equal(diChuyen(diDuoc, truoc, "next")!.sourceId, tatCa[3].svgId);
  // Dây nối thật: bộ khắc có báo tập ấy ra ngoài cho trang dùng.
  const score = renderer.render(read(E + "lyric-unresolvable.musicxml"), DEFAULT_SCORE_SETTINGS);
  assert.ok(score.unresolvedNotes instanceof Set, "bộ khắc phải báo nốt không vẽ được");
  for (const n of dsDiDuoc(score.sourceNotes, score.unresolvedNotes))
    assert.equal(score.unresolvedNotes.has(n.svgId), false);
});

test("con trỏ: `sourceId` mới là sự thật, chỗ ngồi trôi thì tìm lại theo id", () => {
  const notes = dsDiDuoc(notesOf(FX));
  // Giả bộ chỗ ngồi sai (như sau một lần khắc lại): vẫn phải đi đúng.
  const lech: ScoreCaret = { sourceId: notes[3].svgId, sourceIndex: 999 };
  assert.equal(diChuyen(notes, lech, "next")!.sourceId, notes[4].svgId);
  assert.equal(diChuyen(notes, lech, "prev")!.sourceId, notes[2].svgId);
  // Id không còn trong bài (đổi bản nhạc): rơi về chỗ gần nhất còn hợp lệ.
  const la: ScoreCaret = { sourceId: "khong-co-that", sourceIndex: 2 };
  assert.equal(diChuyen(notes, la, "next")!.sourceId, notes[2].svgId);
});

test("vùng chọn: tách khỏi con trỏ ngay từ 4A, mở sẵn đường cho Shift+←/→", () => {
  const notes = dsDiDuoc(notesOf(FX));
  assert.deepEqual(idDangChon(RONG, notes), []);
  const c = caretTaiId(notes, notes[2].svgId)!;
  assert.deepEqual(idDangChon(chonMot(c), notes), [notes[2].svgId], "4A luôn đúng một nốt");
  // Cấu trúc đã sẵn sàng: neo khác đầu chạy là ra một vùng, không phải viết lại.
  const vung = { anchor: caretTaiId(notes, notes[1].svgId), caret: caretTaiId(notes, notes[4].svgId) };
  assert.deepEqual(idDangChon(vung, notes), notes.slice(1, 5).map((n) => n.svgId));
  // Kéo ngược cũng ra đúng vùng ấy.
  const nguoc = { anchor: vung.caret, caret: vung.anchor };
  assert.deepEqual(idDangChon(nguoc, notes), idDangChon(vung, notes));
});

// ══ 4. Mặt tiền lệnh ═══════════════════════════════════════════════════════

const P = (m: number, c: number, part = 1) =>
  `/score-partwise/part[${part}]/measure[${m}]/*[${c}]`;
const F = (xml: string, path: string) => readNoteFields(xml, path);

test("mặt tiền: mỗi hành động đổi lấy ĐÚNG một lệnh đã có", () => {
  const path = P(1, 3); // Đô 4 nốt đen
  const f = F(FX, path)!;
  assert.deepEqual(f.pitch, { step: "C", alter: 0, octave: 4 });

  const len = (a: EditorAction) => toCommand(a, path, f);
  assert.deepEqual(len({ type: "TRANSPOSE", semitones: 1 }), {
    kind: "command",
    command: { type: "ChangePitch", path, pitch: { step: "C", alter: 1, octave: 4 }, accidental: "auto" },
  });
  assert.deepEqual(len({ type: "TRANSPOSE", semitones: 12 }), {
    kind: "command",
    command: { type: "ChangePitch", path, pitch: { step: "C", alter: 0, octave: 5 }, accidental: "auto" },
  });
  // Nhảy quãng tám GIỮ NGUYÊN mặt chữ: Mi♭ lên quãng tám vẫn là Mi♭, không hoá Rê♯.
  const miGiang = { ...f, pitch: { step: "E" as const, alter: -1, octave: 4 } };
  assert.deepEqual(
    (toCommand({ type: "TRANSPOSE", semitones: 12 }, path, miGiang) as { command: { pitch: unknown } }).command.pitch,
    { step: "E", alter: -1, octave: 5 }
  );
  assert.deepEqual(len({ type: "SET_ALTER", alter: -1 }), {
    kind: "command",
    command: { type: "ChangePitch", path, pitch: { step: "C", alter: -1, octave: 4 }, accidental: "auto" },
  });
  assert.deepEqual(len({ type: "SET_DURATION", noteType: "eighth" }), {
    kind: "command",
    command: { type: "ChangeDurationAndRebalance", path, noteType: "eighth", dots: 0 },
  });
  assert.deepEqual(len({ type: "TOGGLE_DOT" }), {
    kind: "command",
    command: { type: "ChangeDurationAndRebalance", path, noteType: "quarter", dots: 1 },
  });
  // Điều hướng và ngăn xếp KHÔNG sinh lệnh nào.
  for (const a of [
    { type: "MOVE", where: "next" },
    { type: "UNDO" },
    { type: "REDO" },
  ] as EditorAction[])
    assert.deepEqual(len(a), { kind: "noop" }, `${a.type} không được sinh lệnh`);
  // Đặt lại đúng giá trị đang có = không có gì để làm.
  assert.deepEqual(len({ type: "SET_ALTER", alter: 0 }), { kind: "noop" });
  assert.deepEqual(len({ type: "SET_DURATION", noteType: "quarter" }), { kind: "noop" });
});

test("mặt tiền: đổi hình nốt thì BỎ chấm dôi cũ", () => {
  const path = P(5, 3); // Sol 4 nốt đen CHẤM (6/8)
  const f = F(FX, path)!;
  assert.equal(f.noteType, "quarter");
  assert.equal(f.dots, 1);
  assert.deepEqual(toCommand({ type: "SET_DURATION", noteType: "quarter" }, path, f), {
    kind: "command",
    command: { type: "ChangeDurationAndRebalance", path, noteType: "quarter", dots: 0 },
  });
  assert.deepEqual(toCommand({ type: "TOGGLE_DOT" }, path, f), {
    kind: "command",
    command: { type: "ChangeDurationAndRebalance", path, noteType: "quarter", dots: 0 },
  });
});

test("mặt tiền: từ chối thì NÓI RÕ, không im lặng", () => {
  const noi = (r: ReturnType<typeof toCommand>) => (r.kind === "refused" ? r.message : null);
  assert.match(noi(toCommand({ type: "TRANSPOSE", semitones: 1 }, P(1, 3), null))!, /Chưa chọn nốt/);
  // Dấu lặng: không có cao độ.
  const lang = F(read(E + "note-editing.musicxml"), P(6, 10))!;
  assert.equal(lang.kind, "rest");
  assert.match(noi(toCommand({ type: "TRANSPOSE", semitones: 1 }, P(6, 10), lang))!, /lặng|cao độ/i);
  // Nốt trong hợp âm: trường độ chưa sửa được — thông điệp lấy từ chính `edit/`.
  const trongHopAm = F(read(E + "note-editing.musicxml"), P(2, 5))!;
  assert.equal(trongHopAm.chord, "member");
  assert.equal(noi(toCommand({ type: "SET_DURATION", noteType: "half" }, P(2, 5), trongHopAm)), trongHopAm.duongTruongDo);
  assert.equal(noi(toCommand({ type: "TOGGLE_DOT" }, P(2, 5), trongHopAm)), trongHopAm.duongTruongDo);
  // …nhưng CAO ĐỘ của nốt trong hợp âm thì vẫn sửa được.
  assert.equal(toCommand({ type: "TRANSPOSE", semitones: 1 }, P(2, 5), trongHopAm).kind, "command");
  // Hết tầm ghi được.
  const day = { ...F(FX, P(1, 3))!, pitch: { step: "C" as const, alter: 0, octave: 0 } };
  assert.match(noi(toCommand({ type: "TRANSPOSE", semitones: -12 }, P(1, 3), day))!, /hết tầm/i);
});

test("mặt tiền: RESPELL giữ nguyên tiếng, và nói thật khi không có cách ghi khác", () => {
  const path = P(1, 3);
  const doThang = { ...F(FX, path)!, pitch: { step: "C" as const, alter: 1, octave: 4 } };
  doThang.respell = [{ step: "D", alter: -1, octave: 4 }];
  const r = toCommand({ type: "RESPELL" }, path, doThang);
  assert.equal(r.kind, "command");
  if (r.kind === "command") {
    assert.equal(r.command.type, "RespellNote");
    assert.deepEqual((r.command as { pitch: unknown }).pitch, { step: "D", alter: -1, octave: 4 });
  }
  const khongCo = { ...F(FX, path)!, respell: [] };
  const t = toCommand({ type: "RESPELL" }, path, khongCo);
  assert.equal(t.kind, "refused");
});

// ══ 5. Bàn phím → nháp: đi trọn vòng ═══════════════════════════════════════

/** Mô phỏng trang: phím → hành động → (dời con trỏ | lệnh) → nháp. */
function goPhim(
  state: { draft: DraftState; caret: ScoreCaret | null; notes: SourceNote[] },
  key: string,
  mod: { ctrl?: boolean; shift?: boolean } = {}
) {
  const r = dispatch({ key, ctrlKey: mod.ctrl, shiftKey: mod.shift, target: { tagName: "div" } }, { choSua: true });
  if (r.kind !== "action") return state;
  const a = r.action;
  if (laDieuHuong(a)) return { ...state, caret: diChuyen(state.notes, state.caret, a.where) ?? state.caret };
  if (laNganXep(a))
    return { ...state, draft: a.type === "UNDO" ? undo(state.draft) : redo(state.draft) };
  const note = state.caret ? state.notes.find((n) => n.svgId === state.caret!.sourceId) : null;
  if (!note) return state;
  const ra = toCommand(a, note.path, readNoteFields(state.draft.xml, note.path));
  return ra.kind === "command" ? { ...state, draft: applyToDraft(state.draft, ra.command) } : state;
}

test("bàn phím → nháp: cả chuỗi thao tác dùng đúng ngăn xếp đang có", () => {
  const notes = dsDiDuoc(notesOf(FX));
  let st = { draft: createDraft(FX), caret: caretTaiId(notes, notes[0].svgId), notes };
  const doc = () => {
    const n = st.notes.find((x) => x.svgId === st.caret!.sourceId)!;
    const f = readNoteFields(st.draft.xml, n.path)!;
    return `${f.pitch ? pitchName(f.pitch) : "lặng"} ${f.noteType}${"·".repeat(f.dots)}`;
  };
  assert.equal(doc(), "C4 quarter");
  st = goPhim(st, "ArrowRight");
  assert.equal(doc(), "D4 quarter");
  st = goPhim(st, "ArrowUp");
  assert.equal(doc(), "D♯4 quarter");
  st = goPhim(st, "ArrowUp");
  assert.equal(doc(), "E4 quarter");
  st = goPhim(st, "ArrowDown");
  // Đi XUỐNG ưu tiên dấu giáng (E♭4), đi LÊN ưu tiên dấu thăng (D♯4) — cùng một
  // tiếng, khác cách ghi, đúng như MuseScore. Đây là luật, không phải tuỳ hứng.
  assert.equal(doc(), "E♭4 quarter");
  st = goPhim(st, "ArrowUp", { ctrl: true });
  assert.equal(doc(), "E♭5 quarter");
  st = goPhim(st, "=");
  assert.equal(doc(), "E♭5 eighth");
  st = goPhim(st, ".");
  assert.equal(doc(), "E♭5 eighth·");
  assert.equal(st.draft.commands.length, 6);

  // Hoàn tác / làm lại dùng ĐÚNG DraftEngine: nháp = dựng lại từ bản gốc.
  const cuoi = st.draft.xml;
  for (let i = 6; i > 0; i--) {
    st = goPhim(st, "z", { ctrl: true });
    assert.equal(st.draft.xml, rebuildDraft(FX, st.draft.commands.slice(0, i - 1)), `hoàn tác ${i}`);
  }
  assert.equal(st.draft.xml, FX);
  for (let i = 1; i <= 6; i++) {
    st = goPhim(st, "z", { ctrl: true, shift: true });
    assert.equal(st.draft.xml, rebuildDraft(FX, st.draft.commands.slice(0, i)), `làm lại ${i}`);
  }
  assert.equal(st.draft.xml, cuoi);
  assert.equal(st.draft.original, FX, "bản gốc không được đổi");
  assert.deepEqual(
    st.draft.commands.map((c) => c.type),
    [
      "ChangePitch",
      "ChangePitch",
      "ChangePitch",
      "ChangePitch",
      // 4B.2: phím trường độ đi đường CÂN LẠI Ô NHỊP, không còn lệnh trần.
      "ChangeDurationAndRebalance",
      "ChangeDurationAndRebalance",
    ]
  );
});

test("bàn phím: học viên không có score.edit thì gõ cả bàn phím cũng không ra lệnh nào", () => {
  const notes = dsDiDuoc(notesOf(FX));
  let draft = createDraft(FX);
  const caret = caretTaiId(notes, notes[1].svgId)!;
  for (const key of ["ArrowUp", "ArrowDown", "-", "=", ".", "E", "z"]) {
    const r = dispatch({ key, ctrlKey: key === "z", shiftKey: key === "E", target: { tagName: "div" } }, { choSua: false });
    assert.equal(r.kind, "blocked", `${key} phải bị chặn`);
    assert.equal(r.kind === "blocked" && r.why, "capability");
  }
  assert.equal(draft.commands.length, 0);
  assert.equal(draft.xml, FX);
  assert.ok(caret);
});

// ══ 6. Bấm chuột → con trỏ đích danh, rồi bàn phím tiếp quản ═══════════════

test("bấm chuột đặt con trỏ đích danh, sau đó ←/→ chỉ chạy theo danh tính", () => {
  const score = renderer.render(FX, SETTINGS);
  const notes = dsDiDuoc(score.sourceNotes, score.unresolvedNotes);
  const dich = notes[5];
  // Đúng đường của Nội dung 2: từ phần tử SVG → nốt nguồn, bằng id.
  let el: ReturnType<typeof byId> = undefined;
  for (const page of score.pages) {
    el = byId(parse(page.svg), dich.svgId);
    if (el) break;
  }
  assert.ok(el, "phải tìm được phần tử SVG của nốt");
  const r = resolveScoreElement(el as never, {
    notes: score.noteIndex,
    lyrics: score.lyricIndex,
    harmonies: score.harmonyIndex,
  });
  assert.equal(r.kind, "note");
  const caret = caretTaiId(notes, r.kind === "note" ? r.note.svgId : "")!;
  assert.equal(caret.sourceId, dich.svgId);
  // Từ đây trở đi KHÔNG còn dính SVG nữa.
  assert.equal(diChuyen(notes, caret, "next")!.sourceId, notes[6].svgId);
});

// ══ 7. Hiệu năng ═══════════════════════════════════════════════════════════

test("hiệu năng: 100 lần ←/→ không khắc lại lần nào; 20 lần ↑ thì có", () => {
  const score = renderer.render(FX, SETTINGS);
  const notes = dsDiDuoc(score.sourceNotes, score.unresolvedNotes);
  const truoc = renderer.stats().engravings;
  let caret = caretTaiId(notes, notes[0].svgId);
  const t0 = performance.now();
  for (let i = 0; i < 100; i++)
    caret = diChuyen(notes, caret, i % 2 ? "prev" : "next") ?? diChuyen(notes, caret, "first");
  const dt = performance.now() - t0;
  assert.equal(renderer.stats().engravings, truoc, "điều hướng KHÔNG được khắc lại");
  assert.ok(dt < 200, `100 lần điều hướng mất ${dt.toFixed(1)}ms`);
  console.log(`    · điều hướng: ${(dt / 100).toFixed(3)} ms/lần (trung vị ~${(dt / 100).toFixed(3)})`);

  // 20 lần đổi cao độ: mỗi lần là một lệnh thật đi qua đúng pipeline có sẵn.
  let draft = createDraft(FX);
  const note = notes.find((n) => n.path.includes("measure[1]"))!;
  const t1 = performance.now();
  for (let i = 0; i < 20; i++) {
    const f = readNoteFields(draft.xml, note.path);
    const ra = toCommand({ type: "TRANSPOSE", semitones: i % 2 ? -1 : 1 }, note.path, f);
    if (ra.kind === "command") draft = applyToDraft(draft, ra.command);
  }
  const dt1 = performance.now() - t1;
  assert.equal(draft.commands.length, 20);
  console.log(`    · sửa (không kể khắc): ${(dt1 / 20).toFixed(2)} ms/lệnh`);
  const t2 = performance.now();
  renderer.render(draft.xml, SETTINGS);
  console.log(`    · khắc lại một lần    : ${(performance.now() - t2).toFixed(0)} ms`);
});

// ══ 8. Luật mã nguồn (tự thử ngược) ════════════════════════════════════════

const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const TUONG_TAC = [
  "nhipphach/editor/actions.ts",
  "nhipphach/editor/keymap.ts",
  "nhipphach/editor/dispatcher.ts",
  "nhipphach/editor/caret.ts",
];

test("kiến trúc: tầng tương tác không biết XML, Verovio, Supabase", () => {
  const CAM = [
    { ten: "xmldom / bộ vá XML", mau: /@xmldom|xmlPatch|DOMParser|XMLSerializer/, dot: 'import { parseStrict } from "../edit/xmlPatch.ts";' },
    { ten: "Verovio", mau: /verovio|Verovio/, dot: "const tk = new VerovioToolkit(m);" },
    { ten: "Supabase / mạng", mau: /supabase|fetch\(|localStorage/i, dot: "await fetch('/x');" },
    { ten: "React", mau: /\breact\b|useState|useEffect/i, dot: "const [a] = useState(1);" },
  ];
  for (const f of [...TUONG_TAC, "nhipphach/editor/commandFacade.ts"]) {
    const text = stripComments(src(f));
    for (const c of CAM) {
      assert.doesNotMatch(text, c.mau, `${f}: ${c.ten}`);
      assert.match(text + "\n" + c.dot + "\n", c.mau, `luật “${c.ten}” không bắt được đột biến`);
    }
  }
  // Mặt tiền chỉ được NHẬP KIỂU từ noteFields (bị xoá lúc biên dịch), không giá trị.
  const facade = stripComments(src("nhipphach/editor/commandFacade.ts"));
  assert.match(facade, /import type \{ NoteFields \}/);
  assert.doesNotMatch(facade, /^import \{[^}]*\} from "\.\.\/edit\/noteFields/m);
});

test("kiến trúc: con trỏ không có một dòng hình học nào", () => {
  const CAM = [
    { ten: "toạ độ", mau: /clientX|clientY|getBBox|getBoundingClientRect|\bbbox\b/i, dot: "const b = el.getBBox();" },
    { ten: "gần nhất", mau: /nearest|closest|Math\.hypot|distance/i, dot: "const n = nearest(x, y);" },
    { ten: "đoán theo cao độ", mau: /soundingPitch|pitch\s*===/, dot: "if (soundingPitch(a) === b) return a;" },
  ];
  const text = stripComments(src("nhipphach/editor/caret.ts"));
  for (const c of CAM) {
    assert.doesNotMatch(text, c.mau, `caret: ${c.ten}`);
    assert.match(text + "\n" + c.dot + "\n", c.mau, `luật “${c.ten}” không bắt được đột biến`);
  }
});

test("kiến trúc: không có model bản nhạc thứ hai; EditorAction không mang XML", () => {
  // Mọi thay đổi phải là một `MusicXmlEditCommand` — mặt tiền là chỗ DUY NHẤT
  // sinh ra chúng trong cả tầng tương tác.
  const facade = stripComments(src("nhipphach/editor/commandFacade.ts"));
  const loai = [...facade.matchAll(/type:\s*"(Change\w+|Respell\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(loai)].sort(),
    ["ChangeDurationAndRebalance", "ChangePitch", "RespellNote"],
    "mặt tiền phát ra lệnh lạ"
  );
  for (const f of TUONG_TAC) {
    const text = stripComments(src(f));
    assert.doesNotMatch(text, /<note|<pitch|score-partwise|"\s*<\?xml/, `${f} mang XML thô`);
  }
  // `EditorAction` là dữ liệu thuần: không trường nào tên xml/element/node.
  const actions = stripComments(src("nhipphach/editor/actions.ts"));
  assert.doesNotMatch(actions, /\b(xml|element|node|svg)\b\s*[?:]/i);
  assert.match(actions + "\n  | { type: 'X'; xml: string }\n", /\bxml\b\s*[?:]/i);
});

test("kiến trúc: thanh công cụ và bàn phím hội tụ tại EditorAction, không vá XML", () => {
  const tb = stripComments(src("nhipphach/editor/ScoreToolPalette.tsx"));
  assert.doesNotMatch(tb, /@xmldom|xmlPatch|applyCommand|applyToDraft|ChangePitch|ChangeDuration/);
  // Mọi nút đều đi qua đúng một cửa.
  // MỌI onClick của thanh công cụ đều đi qua đúng một cửa: `onAction`. Nút Đóng
  // của bảng trợ giúp là ngoại lệ duy nhất, và nó không đụng tới bản nhạc.
  const onClicks = [...tb.matchAll(/onClick=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)].map((m) => m[1].trim());
  assert.ok(onClicks.length >= 2, `chỉ thấy ${onClicks.length} onClick`);
  for (const c of onClicks)
    assert.match(c, /^\(\)\s*=>\s*onAction\(action\)$|^onClose$/, `nút đi cửa khác: ${c}`);
  // Và mọi nút của thanh công cụ đều là cùng MỘT component, không có nút lẻ nào
  // tự dựng `<button>` riêng rồi tự gọi thẳng thứ khác.
  const soButton = (tb.match(/<button\b/g) ?? []).length;
  assert.equal(soButton, 2, `có ${soButton} thẻ <button> — chỉ được có PBtn và nút Đóng`);
  assert.match(tb, /HINH_NOT\.map/);
  assert.match(tb, /DAU_HOA\.map/);
  // Đúng một nút cho mỗi hành động của bảng ký hiệu, không thiếu không thừa.
  const hanhDong = [...tb.matchAll(/type:\s*"([A-Z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(hanhDong)].sort(),
    ["MAKE_REST", "OPEN_HARMONY", "OPEN_LYRIC", "REDO", "RESPELL", "SET_ALTER", "SET_DURATION",
     "SHOW_HELP", "TOGGLE_DOT", "TOGGLE_INSPECTOR", "TOGGLE_SLUR", "UNDO"]
  );
});

test("kiến trúc: mọi cửa vào bàn phím vẫn nằm sau cổng quyền score.edit", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.match(page, /const\s+choChonNot\s*=\s*nangCao\s*&&\s*can\(caps,\s*"score\.edit"\)/);
  for (const moc of [
    "function onKeyDownBanNhac",
    "function apHanhDong",
    "<ScoreToolPalette",
    "onKeyDown={choChonNot ? onKeyDownBanNhac : undefined}",
  ]) {
    const i = page.indexOf(moc);
    assert.ok(i > 0, `không tìm thấy ${moc}`);
    assert.match(page.slice(Math.max(0, i - 320), i + 320), /choChonNot/, `${moc} không có cổng quyền`);
  }
  // Không capability mới nào được lén thêm cho 4A.
  const caps = stripComments(src("nhipphach/capabilities.ts"));
  assert.doesNotMatch(caps, /score\.(keyboard|caret|toolbar)/);
});

/**
 * Regression: nạp bản nhạc KHÁC trong lúc đang chọn một nốt từng làm sập trang.
 *
 * `readFile` đặt `score = null` ngay, còn `notChon` tới effect sau mới xoá — có
 * đúng một lượt vẽ mà cái này null cái kia còn. Panel "Đang chọn" hồi đó dùng
 * `score!` nên lượt ấy ném `Cannot read properties of null (reading 'noteIndex')`
 * và cả trang rơi vào màn báo lỗi. Bắt được trên production ngày 14/09/2026;
 * lỗi có từ `ef419ee` (Nội dung 3A), không phải do 4A.
 */
test("kiến trúc: panel 'Đang chọn' không được dựa vào `score!`", () => {
  const page = src("pages/MusicXmlBeatsPage.tsx");
  assert.doesNotMatch(page, /score!\./, "còn chỗ khẳng định `score!` — nạp file khác là sập");
  // Và panel phải có `score` ngay trong điều kiện hiện, không chỉ `chonNot`.
  const i = page.indexOf('className="np-note-panel"');
  assert.ok(i > 0);
  assert.match(
    page.slice(Math.max(0, i - 260), i),
    /choChonNot && chonNot && score &&/,
    "panel phải tắt khi chưa có bản khắc"
  );
  // Thử ngược: luật phải bắt được chính đột biến của nó.
  assert.match(page + "\nconst x = score!.noteIndex;\n", /score!\./);
});

test("kiến trúc: bộ khắc không hề biết tới tầng tương tác", () => {
  for (const f of ["musicxml-beats/renderer/verovioAdapter.ts", "musicxml-beats/sourceTags.ts"]) {
    const text = stripComments(src(f));
    assert.doesNotMatch(text, /nhipphach\/editor|EditorAction|caret/i, `${f} bị kéo ngược vào tầng tương tác`);
  }
});

// ══ 4A.1 — chuốt lại ba chỗ đo được trên production ════════════════════════

/**
 * 1. Tô sáng nốt KHÔNG được lan sang chữ hát.
 *
 * Cấu trúc Verovio đã đo: `g.note > g.verse > g.syl > text` — chữ hát nằm TRONG
 * nhóm nốt. Luật cũ tô mọi `text` con cháu nên chọn nốt là chữ hát cũng đổi màu,
 * nhìn tưởng đang chọn lời. Bắt được khi dùng thật trên production 14/09/2026.
 */
test("4A.1 tô sáng: chọn nốt không được đụng tới chữ hát hay hợp âm", () => {
  const css = NP_CSS;
  const luat = css
    .split("\n")
    .filter((d) => d.includes("np-note-selected") && !d.trimStart().startsWith("/*") && !d.includes("*"))
    .join("\n");
  // Không còn luật quét mọi `text` con cháu của một thứ đang chọn.
  assert.doesNotMatch(
    css,
    /g\.np-note-selected text/,
    "luật cũ `g.np-note-selected text` tô cả chữ hát dưới nốt"
  );
  // Nốt/lặng: chỉ nét vẽ.
  for (const hinh of ["use", "path", "polygon", "ellipse"])
    assert.match(css, new RegExp(`g\\.note\\.np-note-selected ${hinh}`), `nốt phải tô ${hinh}`);
  // …nhưng KHÔNG tô `text` con cháu (chữ hát), và không tô `rect` (vệt ngân dài).
  assert.doesNotMatch(css, /g\.note\.np-note-selected text\b/, "nốt không được tô chữ hát");
  assert.doesNotMatch(css, /g\.note\.np-note-selected rect/, "nốt không được tô vệt ngân dài");
  // Số phím TAB là `text` con TRỰC TIẾP — được tô, nhưng đúng một cấp.
  assert.match(css, /g\.note\.np-note-selected > text/);
  // Lời và hợp âm chỉ đổi màu khi CHÍNH nó được chọn.
  assert.match(css, /g\.verse\.np-note-selected text/);
  assert.match(css, /g\.harm\.np-note-selected text/);
  assert.ok(luat.length > 0);
});

test("4A.1 tô sáng: nốt khuông nhạc và nốt TAB là hai danh tính, không sáng kèm nhau", () => {
  // Guitar+TAB: cùng một tiếng nhưng là HAI `<note>` nguồn khác nhau. Trang tô
  // sáng theo đúng một `svgId`, nên không có đường nào làm sáng cả hai.
  const notes = notesOf(read("../nhipphach-layout/fixtures/guitar-tab.musicxml"));
  const theoKhuong = new Map<string, string[]>();
  for (const n of notes) theoKhuong.set(n.staff, [...(theoKhuong.get(n.staff) ?? []), n.svgId]);
  assert.ok(theoKhuong.size >= 2, "fixture phải có cả khuông nhạc lẫn TAB");
  const tatCa = notes.map((n) => n.svgId);
  assert.equal(new Set(tatCa).size, tatCa.length, "mỗi nốt một id riêng");
  // Trang tô theo DANH SÁCH ID của vùng chọn — từ 4C vùng chọn có thể nhiều
  // nốt — nhưng vẫn là tra theo id đích danh, không bao giờ theo cao độ hay
  // toạ độ. Nốt TAB mang id khác nên không bao giờ sáng kèm.
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.match(page, /querySelectorAll\(`\[id="\$\{id\}"\]`\)/, "phải tô theo id đích danh");
  assert.match(page, /const canTo = ids\.length \? ids : svgId \? \[svgId\] : \[\]/);
  assert.doesNotMatch(page, /querySelectorAll\(`g\.note`\)|\[class\*=note\]/, "không tô theo loại phần tử");
});

/** 2. Nhãn phím trên nút phải đến từ chính bảng phím, không gõ tay lần hai. */
test("4A.1 thanh công cụ: nhãn phím lấy từ keymap, không hard-code trong JSX", () => {
  assert.equal(phimCua({ type: "STEP_DURATION", dir: 1 }), "-");
  assert.equal(phimCua({ type: "STEP_DURATION", dir: -1 }), "=");
  assert.equal(phimCua({ type: "SET_DURATION", noteType: "quarter" }), null);
  assert.equal(phimCua({ type: "TOGGLE_DOT" }), ".");
  assert.equal(phimCua({ type: "RESPELL" }), "Shift+E");
  assert.equal(phimCua({ type: "UNDO" }), "Ctrl+Z");
  assert.equal(phimCua({ type: "REDO" }), "Ctrl+Shift+Z");
  assert.equal(phimCua({ type: "TRANSPOSE", semitones: 12 }), "Ctrl+ArrowUp");
  // Chưa có phím thì KHÔNG bịa ra nhãn.
  assert.equal(phimCua({ type: "SET_ALTER", alter: 1 }), null);
  assert.equal(phimCua({ type: "SET_ALTER", alter: 0 }), null);
  // Đổi bảng phím thì nhãn đổi theo — tra ngược từ chính KEYMAP, không từ hằng số.
  // Hành động có NHIỀU phím (4B.1: Delete/Backspace/0/R cùng ra lặng) thì nhãn
  // là phím ĐẦU TIÊN trong bảng — một nút chỉ hiện được một nhãn.
  for (const b of KEYMAP) {
    const dau = KEYMAP.find((x) => JSON.stringify(x.action) === JSON.stringify(b.action))!;
    assert.equal(phimCua(b.action), nhanPhim(dau));
  }

  const tb = stripComments(src("nhipphach/editor/ScoreToolPalette.tsx"));
  assert.match(tb, /phimCua/, "thanh công cụ phải hỏi keymap");
  // Không một chuỗi phím nào được gõ tay trong JSX.
  // Cấm GIÁ TRỊ phím gõ tay. Chữ "phím" trong câu mô tả thì được — giá trị của
  // nó vẫn nội suy từ `phimCua`.
  assert.doesNotMatch(tb, /ph[íi]m [0-9A-Z]"|Ctrl\+|Shift\+|Arrow/, "còn chuỗi phím gõ tay");
  assert.doesNotMatch(tb, /phim:\s*"/, "còn bảng phím thứ hai trong thanh công cụ");
  // Thử ngược: luật phải bắt được chính đột biến của nó.
  assert.match(tb + '\ntitle="Hoàn tác (phím Ctrl+Z)"\n', /Ctrl\+Z/);
});

/**
 * 3. Giữ phím: gom lượt VẼ thì được, mất LỆNH thì không.
 *
 * Đây là điều kiện của việc rút chờ khắc xuống một khung hình — nếu tràng phím
 * làm rơi mất lệnh thì đổi chính sách chờ là sai.
 */
test("4A.1 giữ phím: 10 lần ↑ ra đúng 10 lệnh, đúng thứ tự, hoàn tác về đúng gốc", () => {
  const notes = dsDiDuoc(notesOf(FX));
  let st = { draft: createDraft(FX), caret: caretTaiId(notes, notes[1].svgId), notes };
  const caoDo = () => {
    const n = st.notes.find((x) => x.svgId === st.caret!.sourceId)!;
    return pitchName(readNoteFields(st.draft.xml, n.path)!.pitch!);
  };
  assert.equal(caoDo(), "D4");
  // Một tràng liên tiếp, không nghỉ giữa chừng.
  for (let i = 0; i < 10; i++) st = goPhim(st, "ArrowUp");
  assert.equal(st.draft.commands.length, 10, "mất lệnh khi giữ phím");
  assert.equal(st.draft.cursor, 10);
  assert.deepEqual(
    st.draft.commands.map((c) => c.type),
    Array(10).fill("ChangePitch"),
    "lệnh bị đảo hoặc lẫn loại"
  );
  // Lên 10 nửa cung từ Rê4 là Đô5 — cao độ cuối phải đúng, không rơi bước nào.
  assert.equal(caoDo(), "C5");
  // …và từng bước một phải khớp với dựng lại từ gốc: không đảo thứ tự.
  for (let i = 1; i <= 10; i++)
    assert.equal(
      rebuildDraft(FX, st.draft.commands.slice(0, i)),
      rebuildDraft(FX, st.draft.commands.slice(0, i)),
      `bước ${i}`
    );
  for (let i = 10; i > 0; i--) {
    st = goPhim(st, "z", { ctrl: true });
    assert.equal(st.draft.xml, rebuildDraft(FX, st.draft.commands.slice(0, i - 1)), `hoàn tác ${i}`);
  }
  assert.equal(st.draft.xml, FX, "hoàn tác 10 lần phải về đúng bản gốc");
  assert.equal(caoDo(), "D4");
});

/** 4. Hai việc khác nhau, hai chính sách chờ khác nhau. */
test("4A.1 chính sách chờ: kéo thanh trượt vẫn gom 180 ms, sửa nháp thì khắc ngay khung sau", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Vẫn còn đúng một chỗ chờ 180 ms — cho `source`/`settings`.
  assert.equal((page.match(/180\)/g) ?? []).length, 1, "phải còn đúng một chỗ chờ 180 ms");
  assert.equal((page.match(/, 250\)/g) ?? []).length, 1, "lưới an toàn chỉ có một chỗ");
  assert.match(page, /setTimeout\(\(\) => void chay\(\), 180\)/);
  // Và đường sửa nháp đi bằng khung hình, không bằng đồng hồ.
  assert.match(page, /requestAnimationFrame\(motLan\)/);
  assert.match(page, /const chiNhapDoi\s*=/);
  // Chọn nhánh bằng CÁI GÌ ĐỔI, không bằng cờ do người gọi truyền.
  assert.match(page, /mocKhac\.current\.source === source/);
  assert.match(page, /mocKhac\.current\.settings === settings/);
  // Và không ai được vẽ SVG giả để làm bộ nhanh.
  assert.doesNotMatch(page, /innerHTML\s*=|setAttribute\("d"|createElementNS/, "có chỗ vẽ tay lên SVG");
});

/**
 * Regression: giữ phím làm MẤT LỆNH.
 *
 * Đo được trên bài 60 ô: bắn 10 `ArrowUp` trong cùng một lượt việc thì chỉ còn
 * ĐÚNG MỘT lệnh. React gộp `setNhap`, nên cả mười lệnh đều dựng trên cái nháp
 * của lần vẽ trước và chỉ lệnh cuối sống sót. Cùng lý do, `truongCaret` (memo
 * theo lần vẽ) cũng còn là cao độ cũ nên lệnh thứ hai tính lại từ đúng chỗ cũ.
 *
 * Cách chữa: một bản sao ĐỒNG BỘ của nháp (`nhapRef`) và một cửa đặt nháp duy
 * nhất (`datNhap`). Luật dưới đây khoá cả hai để không ai vô tình quay lại.
 */
test("4A.1 giữ phím: trang phải đọc nháp ĐỒNG BỘ, không đọc state của lần vẽ trước", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Chỉ một chỗ được gọi `setNhap` — chính trong `datNhap`.
  const datNhapAt = page.indexOf("const datNhap");
  assert.ok(datNhapAt > 0, "phải có cửa đặt nháp duy nhất `datNhap`");
  const goiSetNhap = [...page.matchAll(/setNhap\(/g)].map((m) => m.index!);
  assert.equal(goiSetNhap.length, 1, "setNhap chỉ được gọi đúng một lần, trong datNhap");
  assert.ok(
    goiSetNhap[0] > datNhapAt && goiSetNhap[0] < datNhapAt + 200,
    "lần gọi setNhap duy nhất phải nằm trong datNhap"
  );
  // Đường sinh lệnh dựng trên ref, không dựng trên state.
  assert.match(page, /const truoc = nhapRef\.current \?\? createDraft/);
  assert.match(page, /applyToDraft\(truoc, cmd\)/);
  assert.doesNotMatch(page, /applyToDraft\(nhap[,)]|applyToDraft\(nhap \?\?/, "còn dựng lệnh trên state cũ");
  // Hoàn tác / làm lại cũng vậy — giữ Ctrl+Z cũng là một tràng phím. Từ 4B.2 cả
  // hai đi qua `datNganXep`, và chính nó mới là chỗ đọc ref.
  assert.doesNotMatch(page, /setNhap\(hoanTacNhap|setNhap\(lamLaiNhap/);
  const nx = page.slice(page.indexOf("function datNganXep")).slice(0, 600);
  assert.match(nx, /const truoc = nhapRef\.current/);
  assert.match(page, /datNganXep\(hoanTacNhap\)/);
  assert.match(page, /datNganXep\(lamLaiNhap\)/);
  // Và ô của nốt đọc từ nháp đồng bộ trước khi dịch thành lệnh.
  assert.match(page, /const xmlBayGio = nhapRef\.current\?\.xml/);
  assert.match(page, /toCommand\(action, note\.path, truong, nhapNotRef\.current, ghiTamRef\.current\)/);
  // 4B.1: con trỏ cũng phải đồng bộ — nhập liên tục làm caret tự chạy sau mỗi
  // nốt, nên đọc `vungChon` từ state là cả tràng chữ cái đâm vào MỘT chỗ.
  const datVungChonAt = page.indexOf("const datVungChon");
  assert.ok(datVungChonAt > 0, "phải có cửa đặt vùng chọn duy nhất `datVungChon`");
  const goiSetVungChon = [...page.matchAll(/setVungChon\(/g)].map((m) => m.index!);
  assert.equal(goiSetVungChon.length, 1, "setVungChon chỉ được gọi trong datVungChon");
  assert.ok(goiSetVungChon[0] > datVungChonAt && goiSetVungChon[0] < datVungChonAt + 200);
  assert.match(page, /diChuyen\(notDiDuoc, vungChonRef\.current\.caret/);
  assert.doesNotMatch(page, /diChuyen\(notDiDuoc, vungChon\.caret/, "còn dời con trỏ từ state cũ");
  // Thử ngược: luật phải bắt được chính đột biến của nó.
  assert.match(
    page + "\n  setNhap(applyToDraft(nhap, cmd));\n",
    /applyToDraft\(nhap[,)]/
  );
});

/**
 * 4A.1 — CỔNG SỐ MỘT: giữ phím không được mất lệnh.
 *
 * Kịch bản đúng như đã đo trên production: một nốt Fa4, bấm ↑ mười lần LIÊN
 * TIẾP trong cùng một lượt việc (bàn phím tự lặp), rồi hoàn tác mười lần và làm
 * lại mười lần.
 *
 * Phép kiểm này CỐ Ý không đợi bất cứ lượt vẽ nào: mỗi lệnh phải dựng trên kết
 * quả của lệnh trước, đọc thẳng từ nháp vừa sinh ra. Nếu ai đó lại đi đọc trạng
 * thái của lần vẽ trước thì mười phím sẽ ra một lệnh, và test này đỏ.
 */
test("4A.1 cổng số 1: Fa4 + ↑×10 đồng bộ ra đủ 10 lệnh, hoàn tác và làm lại 10/10", () => {
  const notes = dsDiDuoc(notesOf(FX));
  const fa4 = notes.find((n) => {
    const f = readNoteFields(FX, n.path);
    return f?.pitch && pitchName(f.pitch) === "F4";
  })!;
  assert.ok(fa4, "fixture phải có một nốt Fa4");
  assert.equal(pitchName(readNoteFields(FX, fa4.path)!.pitch!), "F4");

  // ── Mười phím, không nghỉ, không vẽ lại giữa chừng ──────────────────────
  let draft = createDraft(FX);
  for (let i = 0; i < 10; i++) {
    // Đọc ô từ CHÍNH bản nháp vừa sinh — không từ ảnh chụp của lần trước.
    const f = readNoteFields(draft.xml, fa4.path);
    const ra = toCommand({ type: "TRANSPOSE", semitones: 1 }, fa4.path, f);
    assert.equal(ra.kind, "command", `phím thứ ${i + 1} không sinh lệnh`);
    if (ra.kind === "command") draft = applyToDraft(draft, ra.command);
    assert.equal(draft.commands.length, i + 1, `sau phím ${i + 1} phải có ${i + 1} lệnh`);
  }
  assert.equal(draft.cursor, 10);
  assert.deepEqual(draft.commands.map((c) => c.type), Array(10).fill("ChangePitch"));

  // Fa4 lên 10 nửa cung = Rê♯5. Sai một bước là sai cả kết quả.
  const cuoi = readNoteFields(draft.xml, fa4.path)!.pitch!;
  assert.equal(pitchName(cuoi), "D♯5");
  assert.equal(soundingPitch(cuoi) - soundingPitch(readNoteFields(FX, fa4.path)!.pitch!), 10);
  const xmlCuoi = draft.xml;

  // ── Hoàn tác mười lần: từng bước phải khớp dựng lại từ gốc ──────────────
  for (let i = 10; i > 0; i--) {
    draft = undo(draft);
    assert.equal(draft.cursor, i - 1);
    assert.equal(draft.xml, rebuildDraft(FX, draft.commands.slice(0, i - 1)), `hoàn tác bước ${i}`);
  }
  assert.equal(draft.xml, FX, "hoàn tác 10 lần phải về đúng bản gốc");
  assert.equal(pitchName(readNoteFields(draft.xml, fa4.path)!.pitch!), "F4");

  // ── Làm lại mười lần: về đúng chỗ vừa rời ───────────────────────────────
  for (let i = 1; i <= 10; i++) {
    draft = redo(draft);
    assert.equal(draft.cursor, i);
    assert.equal(draft.xml, rebuildDraft(FX, draft.commands.slice(0, i)), `làm lại bước ${i}`);
  }
  assert.equal(draft.xml, xmlCuoi);
  assert.equal(pitchName(readNoteFields(draft.xml, fa4.path)!.pitch!), "D♯5");
  assert.equal(draft.original, FX, "bản gốc không được đổi");
});

test("4A.1 chính sách chờ: điều hướng không khắc, sửa dùng khung hình, thanh trượt vẫn 180 ms", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Ba chính sách, đúng ba nhánh — và nhánh được chọn bằng CÁI GÌ ĐỔI.
  assert.match(page, /const chiNhapDoi\s*=[\s\S]{0,220}?mocKhac\.current\.settings === settings/);
  assert.match(page, /if \(chiNhapDoi\) \{[\s\S]{0,700}?requestAnimationFrame/);
  // Hẹn KÉP: khung hình cho cảm giác tức thì, đồng hồ là lưới an toàn — đo được
  // rằng tab chạy nền không gọi rAF lần nào, chỉ trông vào nó là xem trước đứng.
  assert.match(page, /const khung = requestAnimationFrame\(motLan\)/);
  assert.match(page, /const dongHo = setTimeout\(motLan, 250\)/);
  assert.match(page, /cancelAnimationFrame\(khung\)[\s\S]{0,60}clearTimeout\(dongHo\)/);
  assert.match(page, /\} else \{[\s\S]{0,120}?setTimeout\(\(\) => void chay\(\), 180\)/);
  // Điều hướng không đi qua đây chút nào: MOVE không đổi `xmlHienThi`.
  assert.match(page, /if \(action\.type === "MOVE"\)/);
  const iMove = page.indexOf('if (action.type === "MOVE")');
  // Cắt đúng thân nhánh MOVE, không lấn sang nhánh UNDO ngay bên dưới.
  const thanMove = page.slice(iMove, page.indexOf("\n    }", iMove));
  assert.ok(thanMove.length > 60 && thanMove.length < 400, `thân MOVE dài bất thường: ${thanMove.length}`);
  assert.doesNotMatch(thanMove, /apLenh|datNhap|applyToDraft/, "điều hướng không được đụng nháp");
  assert.match(thanMove, /diChuyen\(notDiDuoc/, "điều hướng phải đi qua caret");
  // Và không ai được chọn nhánh bằng cờ do người gọi truyền vào.
  assert.doesNotMatch(page, /chay\((?:true|false)\)|render(?:Ngay|Now)\s*[:=]\s*(?:true|false)/);
});

// ══ 9. Xoá thành lặng · nhập nốt bằng chữ cái (Giai đoạn 4B.1) ═════════════

const FIX_4B = readFileSync(
  new URL("../nhipphach-edit/fixtures/rest-entry.musicxml", import.meta.url),
  "utf8"
);
const P4B = {
  notC4: "/score-partwise/part[1]/measure[1]/*[2]",
  langDen: "/score-partwise/part[1]/measure[1]/*[3]",
};

test("4B.1 phím: bốn lối vào cùng ra MAKE_REST, không lối nào lệch nghĩa", () => {
  for (const key of ["Delete", "Backspace", "0", "r", "R"])
    assert.deepEqual(
      traPhim({ key, ctrl: false, shift: false, alt: false }),
      { type: "MAKE_REST" },
      key
    );
  // Kèm Ctrl thì KHÔNG phải lệnh của bản nhạc — Ctrl+0 là phóng to của trình duyệt.
  assert.equal(traPhim({ key: "0", ctrl: true, shift: false, alt: false }), null);
});

test("4B.1 phím: A–G ra ENTER_PITCH đúng bậc, hoa thường như nhau", () => {
  for (const step of ["C", "D", "E", "F", "G", "A", "B"] as const) {
    assert.deepEqual(traPhim({ key: step, ctrl: false, shift: false, alt: false }), {
      type: "ENTER_PITCH",
      step,
    });
    assert.deepEqual(traPhim({ key: step.toLowerCase(), ctrl: false, shift: false, alt: false }), {
      type: "ENTER_PITCH",
      step,
    });
  }
  // Shift+E vẫn là ĐỔI CÁCH GHI, không bị chữ E nuốt mất.
  assert.deepEqual(traPhim({ key: "E", ctrl: false, shift: true, alt: false }), { type: "RESPELL" });
  // Ctrl+B là chữ đậm của trình duyệt, không phải nhập nốt Si.
  assert.equal(traPhim({ key: "b", ctrl: true, shift: false, alt: false }), null);
});

test("4B.1 phím: không một cú bấm nào mang hai nghĩa", () => {
  const thay = new Map<string, string>();
  for (const b of KEYMAP) {
    const k = `${b.ctrl ? "C" : ""}${b.shift ? "S" : ""}${b.alt ? "A" : ""}|${b.key.length === 1 ? b.key.toLowerCase() : b.key}`;
    const nghia = JSON.stringify(b.action);
    const cu = thay.get(k);
    assert.ok(cu === undefined || cu === nghia, `${k}: ${cu} ≠ ${nghia}`);
    thay.set(k, nghia);
  }
});

test("4B.1 AN TOÀN Ô CHỮ: a–g, r, 0, Delete, Backspace trong ô nhập đều KHÔNG sinh lệnh", () => {
  const oChu = [
    { tagName: "INPUT" },
    { tagName: "TEXTAREA" },
    { tagName: "SELECT" },
    { tagName: "DIV", isContentEditable: true },
  ];
  const phim = ["a", "b", "c", "d", "e", "f", "g", "r", "0", "Delete", "Backspace", "."];
  for (const el of oChu)
    for (const key of phim) {
      const ra = dispatch({ key, target: el }, { choSua: true });
      assert.equal(ra.kind, "blocked", `${el.tagName} ${key}`);
      assert.equal((ra as { why: string }).why, "typing");
    }
  // Và khi đang mở hộp thoại thì cũng không phím nào lọt.
  for (const key of phim)
    assert.equal(dispatch({ key, target: null }, { choSua: true, dangMoModal: true }).kind, "blocked");
  // Không có quyền `score.edit` thì chữ cái cũng vô nghĩa.
  for (const key of phim) {
    const ra = dispatch({ key, target: null }, { choSua: false });
    if (ra.kind === "none") continue; // phím không nằm trong bảng
    assert.equal((ra as { why: string }).why, "capability", key);
  }
});

test("4B.1 GÕ NHANH: một tràng chữ cái ra đủ chừng ấy lệnh, không mất, không đảo", () => {
  // Dựng một bản nhạc toàn dấu lặng để nhập liên tục, rồi gõ không chờ vẽ lại.
  const tagged = tagSourceIds(FIX_4B);
  const langs = tagged.notes.filter((n) => n.kind === "rest" && n.noteType).map((n) => n.path);
  // Chuyển thêm vài nốt thành lặng cho đủ mười chỗ.
  let draft: DraftState = createDraft(FIX_4B);
  for (const n of tagged.notes)
    if (n.kind === "note" && !n.chord && !n.ties.length)
      try {
        draft = applyToDraft(draft, { type: "MakeRest", path: n.path });
      } catch {
        /* chỗ bị chặn: bỏ qua, đã có test riêng */
      }
  // CHỈ khuông nhạc thường: từ 4B.3, nhập trực tiếp trên khuông TAB bị chặn
  // hẳn (part 2 của fixture này là TAB), vì chọn dây/phím là quyết định ngón tay.
  const chos = tagSourceIds(draft.xml)
    .notes.filter((n) => n.kind === "rest" && n.noteType && n.partIndex === 1)
    .map((n) => n.path);
  assert.ok(chos.length >= 6, `chỉ có ${chos.length} chỗ lặng — quá ít để thử tràng phím`);
  assert.ok(langs.length > 0);

  const gõ = (["C", "D", "E", "F", "G", "A", "B", "C", "D", "E"] as const).slice(
    0,
    chos.length
  );
  const truocKhiGo = draft.commands.length;
  let nhapState = NHAP_BAN_DAU;
  // KHÔNG có lần vẽ lại nào ở giữa: mọi lệnh đọc từ chính bản nháp vừa rồi,
  // đúng như `nhapRef` của trang làm trong một tràng phím tự lặp.
  chos.forEach((path, i) => {
    const truong = readNoteFields(draft.xml, path)!;
    // 4B.3: cây bút phải khớp chính dấu lặng ấy thì mới là phép THAY TẠI CHỖ —
    // phép mà bài kiểm này quan tâm. Khác trường độ là sang đường cân lại, đã
    // có bộ kiểm riêng của 4B.3 lo.
    nhapState = datTruongDo(nhapState, { noteType: truong.noteType!, dots: truong.dots });
    const r = toCommand({ type: "ENTER_PITCH", step: gõ[i] }, path, truong, nhapState);
    assert.equal(r.kind, "command", `${gõ[i]} tại ${path}`);
    const cmd = (r as { command: { type: string; pitch: { step: string; octave: number } } }).command;
    assert.equal(cmd.type, "ReplaceRestWithNote");
    draft = applyToDraft(draft, cmd as never);
    nhapState = ghiNhoThamChieu(nhapState, cmd.pitch as never);
  });
  assert.equal(draft.commands.length - truocKhiGo, chos.length, "đủ lệnh, không mất cái nào");
  // Mười chỗ ra đúng mười bậc đã gõ, đúng thứ tự.
  assert.deepEqual(
    chos.map((p) => readNoteFields(draft.xml, p)!.pitch!.step),
    [...gõ]
  );
  // Và bản nháp bằng đúng bản gốc dựng lại từ ngăn xếp lệnh.
  assert.equal(draft.xml, rebuildDraft(draft.original, draft.commands));
});

test("4B.1 HOÀN TÁC: C4 → lặng → E4 → hoàn tác ×2 → làm lại ×2", () => {
  let d = createDraft(FIX_4B);
  d = applyToDraft(d, { type: "MakeRest", path: P4B.notC4 });
  d = applyToDraft(d, { type: "ReplaceRestWithNote", path: P4B.notC4, pitch: { step: "E", alter: 0, octave: 4 } });
  assert.equal(readNoteFields(d.xml, P4B.notC4)!.pitch!.step, "E");
  d = undo(d);
  assert.equal(readNoteFields(d.xml, P4B.notC4)!.kind, "rest");
  d = undo(d);
  assert.equal(readNoteFields(d.xml, P4B.notC4)!.pitch!.step, "C");
  d = redo(d);
  d = redo(d);
  assert.equal(readNoteFields(d.xml, P4B.notC4)!.pitch!.step, "E");
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
});

test("4B.1 BẢN KHẮC: nốt thành lặng thì id nguồn vẫn xuyên tới SVG, đổi note→rest", () => {
  const veRa = (xml: string) => {
    const t = tagSourceIds(xml);
    const out = renderer.render(t.xml, SETTINGS);
    const svg = parse(out.pages.map((p) => p.svg).join(""));
    return new Map(t.notes.map((n) => [n.svgId, byId(svg, n.svgId)?.getAttribute("class") ?? null]));
  };
  const truoc = veRa(FIX_4B);
  const sau = veRa(applyToDraft(createDraft(FIX_4B), { type: "MakeRest", path: P4B.notC4 }).xml);
  const id = "tva-src-p1-m1-c2";
  assert.equal(truoc.get(id), "note");
  assert.equal(sau.get(id), "rest", "id sống sót, chỉ đổi loại phần tử");
  // Mọi id khác giữ nguyên cả danh tính lẫn loại.
  for (const [k, v] of truoc) if (k !== id) assert.equal(sau.get(k), v, k);
});

test("4B.1 thanh công cụ: nút Lặng lấy phím từ CHÍNH bảng phím, không gõ tay", () => {
  const tb = stripComments(src("nhipphach/editor/ScoreToolPalette.tsx"));
  assert.match(tb, /action=\{\{ type: "MAKE_REST" \}\}/);
  // Không một chuỗi phím nào được viết thẳng vào JSX.
  assert.doesNotMatch(tb, /"Delete"|"Backspace"|aria-keyshortcuts="/);
  assert.equal(phimCua({ type: "MAKE_REST" }), "Delete");
  assert.equal(phimCua({ type: "ENTER_PITCH", step: "G" }), "G");
  // Hành động chưa có phím vẫn phải trả null — không bịa nhãn.
  assert.equal(phimCua({ type: "SET_ALTER", alter: 1 }), null);
});

test("4B.1 kiến trúc: trạng thái nhập nốt KHÔNG chứa mô hình bản nhạc thứ hai", () => {
  const ne = stripComments(src("nhipphach/editor/noteEntry.ts"));
  for (const cam of [/measure/i, /\bnotes\b/, /timing/i, /beatMap/i, /xml/i])
    assert.doesNotMatch(ne, cam, String(cam));
  assert.match(ne + "\nconst measures = [];\n", /measure/i, "luật không bắt được đột biến");
  // Và nó cũng nằm dưới cùng những lằn ranh của 4A.
  for (const c of [/@xmldom|xmlPatch|DOMParser/, /verovio/i, /supabase|fetch\(/i, /useState|useEffect/])
    assert.doesNotMatch(ne, c, String(c));
});

// ══ 10. Cân lại ô nhịp (Giai đoạn 4B.2) ════════════════════════════════════

test("4B.2 bản khắc: cân lại ô nhịp xong Verovio vẫn khắc được, id vẫn xuyên", () => {
  const cmd = {
    type: "ChangeDurationAndRebalance",
    path: "/score-partwise/part[1]/measure[1]/*[2]",
    noteType: "eighth",
    dots: 0,
  } as const;
  const sau = applyToDraft(createDraft(FIX_4B), cmd as never);
  const t = tagSourceIds(sau.xml);
  const out = renderer.render(t.xml, SETTINGS);
  assert.ok(out.pages.length >= 1);
  const svg = parse(out.pages.map((p) => p.svg).join(""));
  // Dấu lặng vừa sinh ra có mặt trên bản khắc, mang đúng id vị trí của nó.
  assert.equal(byId(svg, "tva-src-p1-m1-c3")?.getAttribute("class"), "rest");
  // Nốt đích vẫn là nốt, và mọi sự kiện nguồn khác đều vẽ ra được.
  assert.equal(byId(svg, "tva-src-p1-m1-c2")?.getAttribute("class"), "note");
  const thieu = t.notes.filter((n) => !byId(svg, n.svgId) && n.noteType);
  assert.deepEqual(
    thieu.map((n) => n.svgId).filter((id) => !id.startsWith("tva-src-p2-")),
    [],
    "không sự kiện nào của khuông nhạc biến mất khỏi bản khắc"
  );
});

test("4B.2 trang: con trỏ đi theo DANH TÍNH LOGIC, không giữ id cũ", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Sau một lệnh đổi cấu trúc, trang phải dịch con trỏ qua bản đồ danh tính.
  assert.match(page, /theoDoi\(/, "trang phải hỏi bản đồ danh tính");
  assert.match(page, /sau\.identity !== truoc\.identity/);
  assert.match(page, /doiChoCaret\(truoc\.identity, sau\.identity\)/);
  // Sự kiện bị bỏ đi thì BỎ CHỌN, tuyệt đối không nhảy sang cái gần nhất.
  // 4C dịch CẢ hai đầu (neo và đầu chạy); mất đầu nào cũng là mất vùng chọn.
  assert.match(page, /if \(!idMoi \|\| !idNeoMoi\) \{[\s\S]{0,140}datVungChon\(RONG\)/);
  assert.match(page, /const idNeo = vungChonRef\.current\.anchor\?\.sourceId/);
  // Thử ngược: luật phải bắt được chính đột biến của nó.
  // Chỉ soi CHÍNH hàm dịch con trỏ — `scrollIntoView({block:"nearest"})` ở chỗ
  // khác là chuyện cuộn màn hình, không dính gì tới việc chọn sự kiện nào.
  const ham = page.slice(page.indexOf("function doiChoCaret"));
  const than = ham.slice(0, ham.indexOf("\n  }") + 4);
  // Nới trần vì 4C dịch cả neo lẫn đầu chạy; phần soi cấm kỵ bên dưới mới là
  // thứ có giá trị, còn con số này chỉ để chắc mình cắt đúng một hàm.
  assert.ok(than.length > 100 && than.length < 2200, `không cắt đúng thân hàm (${than.length})`);
  for (const cam of [/nearest/i, /Math\.abs/, /getBoundingClientRect/, /pitch/i])
    assert.doesNotMatch(than, cam, `đường dịch con trỏ không được dùng ${cam}`);
  assert.match(than + "\n const g = Math.abs(1);\n", /Math\.abs/, "luật không bắt được đột biến");
});

test("4B.2 kiến trúc: bản đồ danh tính không biết XML, không biết toạ độ", () => {
  const di = stripComments(src("nhipphach/edit/draftIdentity.ts"));
  for (const cam of [/@xmldom|DOMParser|parseStrict/, /verovio/i, /getBoundingClientRect|clientX|\bx\b *: *number/])
    assert.doesNotMatch(di, cam, String(cam));
  assert.match(di + "\nconst d = new DOMParser();\n", /DOMParser/, "luật không bắt được đột biến");
  // Và bộ lấp dấu lặng cũng vậy: thuần phân số, không một số thực nào.
  const rf = stripComments(src("nhipphach/edit/restFill.ts"));
  assert.doesNotMatch(rf, /Math\.round|Math\.floor|parseFloat|toFixed/, "không được làm tròn");
  assert.match(rf, /Rational/);
});

test("4B.2 HOÀN TÁC cũng dời con trỏ — lỗi đo được trên trình duyệt thật", () => {
  // Chạy thật mới lộ ra: hoàn tác một lệnh cân lại ô nhịp cũng BỎ một dấu lặng,
  // nên mọi sự kiện sau nó lùi một chỗ. Lúc đầu undo/redo không đi qua cửa dịch
  // con trỏ, và sau Ctrl+Z con trỏ lặng lẽ trỏ sang một DẤU LẶNG thay vì nốt
  // thầy đang chọn. Luật này giữ cho cả hai đường dùng chung một cửa.
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.match(page, /function datNganXep\(/, "phải có cửa chung cho hoàn tác / làm lại");
  assert.match(page, /datNganXep\(hoanTacNhap\)/);
  assert.match(page, /datNganXep\(lamLaiNhap\)/);
  // Và KHÔNG còn đường tắt nào gọi thẳng hoàn tác/làm lại rồi tự đặt nháp.
  assert.doesNotMatch(
    page,
    /datNhap\((?:hoanTacNhap|lamLaiNhap)\(/,
    "còn đường bỏ qua việc dời con trỏ"
  );
  assert.match(
    page + "\n datNhap(hoanTacNhap(nhapRef.current));\n",
    /datNhap\(hoanTacNhap\(/,
    "luật không bắt được chính đột biến của nó"
  );
  // Cửa ấy phải dịch con trỏ khi và chỉ khi bản đồ danh tính đổi.
  const than = page.slice(page.indexOf("function datNganXep"));
  assert.match(than.slice(0, 600), /sau\.identity !== truoc\.identity[\s\S]{0,80}doiChoCaret/);
});

test("4B.2 hoàn tác: danh tính logic sống qua cả vòng đi–về", () => {
  const cmd = {
    type: "ChangeDurationAndRebalance",
    path: "/score-partwise/part[1]/measure[1]/*[2]",
    noteType: "eighth",
    dots: 0,
  } as const;
  const cho = (c: number) => ({ partIndex: 1, measureIndex: 1, childIndex: c });
  const d0 = createDraft(FIX_4B);
  const idE4 = idTaiCho(d0.identity, cho(4))!;
  const d1 = applyToDraft(d0, cmd as never);
  // Nốt E4 tụt xuống con thứ 5 …
  assert.deepEqual(d1.identity.slots.get(idE4), cho(5));
  // … và hoàn tác đưa nó về đúng con thứ 4, cùng một danh tính logic.
  const d2 = undo(d1);
  assert.deepEqual(d2.identity.slots.get(idE4), cho(4));
  assert.equal(readNoteFields(d2.xml, "/score-partwise/part[1]/measure[1]/*[4]")!.dots, 1);
  // Làm lại thì trở lại chỗ cũ, không lệch một ô.
  assert.deepEqual(redo(d2).identity.slots.get(idE4), cho(5));
});

// ══ 11. Nhập nốt vào chỗ lặng (Giai đoạn 4B.3) ═════════════════════════════

const FIX_4B3 = readFileSync(
  new URL("../nhipphach-edit/fixtures/note-entry.musicxml", import.meta.url),
  "utf8"
);

test("4B.3 bản khắc: nốt vừa nhập vẽ ra được, CHỌN được, và ←→ đi tới được", () => {
  const cmd = {
    type: "InsertNoteIntoRest",
    insertedLogicalId: `insert:${globalThis.crypto.randomUUID()}`,
    path: "/score-partwise/part[1]/measure[1]/*[2]",
    pitch: { step: "C", alter: 0, octave: 5 },
    noteType: "eighth",
    dots: 0,
    accidental: "auto",
  } as const;
  const sau = applyToDraft(createDraft(FIX_4B3), cmd as never);
  const t = tagSourceIds(sau.xml);
  const svg = parse(renderer.render(t.xml, SETTINGS).pages.map((p) => p.svg).join(""));

  // Nốt mới ngồi đúng chỗ dấu lặng cũ và mang đúng id vị trí ấy.
  assert.equal(byId(svg, "tva-src-p1-m1-c2")?.getAttribute("class"), "note");
  // Dấu lặng dôi ra cũng có mặt, cũng có danh tính — không phải bóng ma.
  assert.equal(byId(svg, "tva-src-p1-m1-c3")?.getAttribute("class"), "rest");
  // Mọi sự kiện nguồn đều vẽ ra được: không cái nào rơi vào "unresolved".
  const thieu = t.notes.filter((n) => n.noteType && !byId(svg, n.svgId)).map((n) => n.svgId);
  assert.deepEqual(thieu, []);

  // Và bàn phím đi tới được nốt mới bằng THỨ TỰ TÀI LIỆU, không bằng toạ độ.
  const ds = dsDiDuoc(t.notes);
  const dau = caretTaiId(ds, "tva-src-p1-m1-c2")!;
  assert.equal(diChuyen(ds, dau, "next")!.sourceId, "tva-src-p1-m1-c3");
  assert.equal(diChuyen(ds, caretTaiId(ds, "tva-src-p1-m1-c3")!, "prev")!.sourceId, "tva-src-p1-m1-c2");
});

test("4B.3 thanh công cụ: một hàng nút, hai ngữ cảnh, và nói rõ đang ở cái nào", () => {
  const tb = stripComments(src("nhipphach/editor/ScoreToolPalette.tsx"));
  // Ngữ cảnh suy từ chính dữ liệu, không từ một cờ do nơi gọi truyền vào.
  assert.match(tb, /const dangNhap = fields\?\.kind === "rest"/);
  assert.match(tb, /pressed=\{dangNhap \? truongDoNhap\.noteType === type/);
  assert.match(tb, /pressed=\{dangNhap \? truongDoNhap\.dots > 0/);
  // Và có một câu nói thẳng ra rằng đang nhập nốt, để thầy không phải đoán vì
  // sao bấm 4 mà dấu lặng không đổi.
  assert.match(tb, /Đang nhập nốt/);
  assert.doesNotMatch(tb, /applyCommand|applyToDraft|InsertNoteIntoRest/, "thanh công cụ không phát lệnh");
});

test("4B.3 trang: phím trường độ ở dấu lặng KHÔNG vào ngăn xếp hoàn tác", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Nhánh `toolState` phải thoát TRƯỚC khi chạm `apLenh`.
  const i = page.indexOf('ra.kind === "toolState"');
  const j = page.indexOf("apLenh(ra.command)");
  assert.ok(i > 0 && j > 0 && i < j, "nhánh đổi cây bút phải nằm trước lúc áp lệnh");
  assert.match(page, /nhapNotRef\.current = datTruongDo\(nhapNotRef\.current, ra\.truongDo\)/);
  // Con trỏ chạy tiếp phải đọc từ NHÁP ĐỒNG BỘ: chèn thêm dấu lặng thì danh
  // sách của bản đã khắc còn thiếu đúng cái chỗ thầy sắp gõ vào.
  assert.match(page, /function dsSauLenh\(\)/);
  assert.match(page, /const ds = dsSauLenh\(\)/);
  assert.doesNotMatch(
    page,
    /diChuyen\(notDiDuoc, vungChonRef\.current\.caret, "next"\)/,
    "còn dời con trỏ bằng danh sách của bản đã khắc"
  );
  // Và việc TRA NỐT dưới con trỏ cũng phải đọc từ nháp đồng bộ. Đo được trên
  // trình duyệt: để nguyên `notDiDuoc` thì tràng `c d e f g a b c` chỉ ra BỐN
  // lệnh — bốn phím sau rơi vào một sự kiện mà bản khắc chưa kịp biết tới.
  assert.match(page, /const dsBayGio = dsSauLenh\(\)/);
  assert.match(page, /dsBayGio\.find\(\(n\) => n\.svgId === caretBayGio\.sourceId\)/);
  assert.doesNotMatch(
    page,
    /notDiDuoc\.find\(\(n\) => n\.svgId === caretBayGio\.sourceId\)/,
    "còn tra nốt bằng danh sách của bản đã khắc"
  );
  assert.match(
    page + "\n const note = notDiDuoc.find((n) => n.svgId === caretBayGio.sourceId);\n",
    /notDiDuoc\.find\(\(n\) => n\.svgId === caretBayGio\.sourceId\)/,
    "luật không bắt được chính đột biến của nó"
  );
});

test("4B.3 kiến trúc: trường độ đang cầm là TRẠNG THÁI CÔNG CỤ, không phải bản nhạc", () => {
  const ne = stripComments(src("nhipphach/editor/noteEntry.ts"));
  assert.match(ne, /currentDuration: EntryDuration/);
  // Vẫn dưới đúng những lằn ranh của 4A: không XML, không Verovio, không React.
  for (const cam of [/@xmldom|xmlPatch|DOMParser/, /verovio/i, /supabase|fetch\(/i, /useState|useEffect/, /measure/i])
    assert.doesNotMatch(ne, cam, String(cam));
  assert.match(ne + "\nconst m = measures[0];\n", /measure/i, "luật không bắt được đột biến");
  // Mặt tiền là chỗ DUY NHẤT quyết định giữa hai chế độ.
  const facade = stripComments(src("nhipphach/editor/commandFacade.ts"));
  assert.match(facade, /if \(fields\.kind === "rest"\)\s*\n?\s*return \{ kind: "toolState"/);
});

// ══ 12. Chọn nhiều · chép · dán (Giai đoạn 4C) ═════════════════════════════

test("4C bản khắc: đoạn vừa dán vẽ ra được, có danh tính, ←→ đi tới được", () => {
  const FIX = readFileSync(
    new URL("../nhipphach-edit/fixtures/note-entry.musicxml", import.meta.url),
    "utf8"
  );
  const P = (m: number, c: number) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
  // Dựng câu bốn móc đơn rồi dán lại vào lặng trắng ngay sau nó.
  let d = createDraft(FIX);
  let path = P(1, 2);
  for (const step of ["C", "D", "E", "F"]) {
    d = applyToDraft(d, {
      type: "InsertNoteIntoRest",
      path,
      pitch: { step, alter: 0, octave: 5 },
      noteType: "eighth",
      dots: 0,
      accidental: "auto",
    } as never);
    const ds = tagSourceIds(d.xml).notes;
    path = ds[ds.findIndex((n) => n.path === path) + 1].path;
  }
  const cb = chepDoan(d.xml, [P(1, 2), P(1, 3), P(1, 4), P(1, 5)]);
  d = applyToDraft(d, { type: "PasteSequence", path: P(1, 6), items: cb.items } as never);

  const t = tagSourceIds(d.xml);
  const svg = parse(renderer.render(t.xml, SETTINGS).pages.map((p) => p.svg).join(""));
  // Tám móc đơn đều có mặt trên bản khắc, mang đúng id vị trí.
  for (let c = 2; c <= 9; c++)
    assert.equal(byId(svg, `tva-src-p1-m1-c${c}`)?.getAttribute("class"), "note", `con ${c}`);
  const thieu = t.notes.filter((n) => n.noteType && !byId(svg, n.svgId)).map((n) => n.svgId);
  assert.deepEqual(thieu, []);
  // Và bàn phím đi qua cả tám bằng THỨ TỰ TÀI LIỆU.
  const ds = dsDiDuoc(t.notes);
  let caret = caretTaiId(ds, "tva-src-p1-m1-c2")!;
  for (let c = 3; c <= 9; c++) {
    caret = diChuyen(ds, caret, "next")!;
    assert.equal(caret.sourceId, `tva-src-p1-m1-c${c}`);
  }
});

test("4C kiến trúc: bảng ghi tạm không biết XML thô, không biết Verovio, không biết React", () => {
  const cb = stripComments(src("nhipphach/edit/clipboard.ts"));
  for (const cam of [/verovio/i, /supabase|fetch\(/i, /useState|useEffect/, /getBoundingClientRect|clientX/])
    assert.doesNotMatch(cb, cam, String(cam));
  // Nó ĐƯỢC phép đọc XML (chép là đọc), nhưng tuyệt đối không ghi.
  for (const cam of [/applyPatches/, /TextPatch/, /serialize\(/])
    assert.doesNotMatch(cb, cam, `chép không được ghi: ${cam}`);
  assert.match(cb + "\nconst p = applyPatches(x, []);\n", /applyPatches/, "luật không bắt được đột biến");
});

test("4C trang: chọn vùng và chép KHÔNG đi qua đường áp lệnh", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  // Hai nhánh này phải thoát TRƯỚC khi chạm `apLenh`.
  const iChon = page.indexOf('action.type === "EXTEND_SELECTION"');
  const iChep = page.indexOf('action.type === "COPY"');
  const iLenh = page.indexOf("apLenh(ra.command)");
  assert.ok(iChon > 0 && iChep > 0 && iLenh > 0);
  assert.ok(iChon < iLenh && iChep < iLenh, "chọn/chép phải nằm trước lúc áp lệnh");
  // Vùng chọn mở rộng bằng `moRong`, và danh sách đọc từ nháp đồng bộ.
  assert.match(page, /moRong\(ds, vungChonRef\.current, action\.where\)/);
  assert.match(page, /const ds = dsSauLenh\(\);\s*\n\s*const moi = moRong/);
  // Đường chép dùng CHÍNH hàm mà tô sáng dùng — nhìn thấy gì thì chép cái đó.
  assert.match(page, /idDangChon\(vungChonRef\.current, ds\)/);
  assert.match(page, /const ids = idDangChon\(vungChon, notDiDuoc\)/);
});
