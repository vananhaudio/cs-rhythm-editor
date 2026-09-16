/**
 * SỬA DÂY / PHÍM TRÊN KHUÔNG TAB — Giai đoạn 4D.1.
 *
 * Hai lằn ranh được khoá chặt nhất:
 *   1. KHÔNG ĐOÁN. Cách lên dây phải có trong bài; không có thì không tính.
 *      Nốt khuông nhạc tương ứng không có quan hệ nào ghi trong MusicXML, nên
 *      nó KHÔNG được tự sửa theo.
 *   2. HAI Ý ĐỊNH TÁCH BẠCH. "Đổi phím trên dây này" làm cao độ đổi; "đổi dây"
 *      giữ nguyên cao độ và tính lại phím. Cả hai ghi ra cùng một lệnh vị trí
 *      tuyệt đối, và bất biến "dây buông + phím = cao độ" luôn đúng.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import { applyToDraft, createDraft, rebuildAll, rebuildDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { soundingPitch } from "../../src/nhipphach/edit/pitchModel.ts";
import { rhythmIssues } from "../../src/nhipphach/edit/validation.ts";
import { EditError } from "../../src/nhipphach/edit/xmlPatch.ts";
import { doiDayGiuCaoDo, PHIM_TOI_DA_UI, viTri } from "../../src/nhipphach/edit/tabModel.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import { phimCua, traPhim } from "../../src/nhipphach/editor/keymap.ts";
import { dispatch } from "../../src/nhipphach/editor/dispatcher.ts";
import { CHO_NOI, goSo, TAB_TRONG } from "../../src/nhipphach/editor/tabEntry.ts";
import { chepDoan, vuongMac } from "../../src/nhipphach/edit/clipboard.ts";

const doc = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const FIX = doc("./fixtures/tab-edit.musicxml");
const DROP_D = doc("./fixtures/tab-drop-d.musicxml");
const KHONG_LEN_DAY = doc("./fixtures/tab-no-tuning.musicxml");
const P = (m: number, c: number) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
const T = {
  buongE4: P(1, 7), //   dây 1 phím 0  — E4
  a3: P(1, 8), //        dây 3 phím 2  — A3
  e4DayHai: P(1, 9), //  dây 2 phím 5  — E4 (cùng cao độ với dây buông 1)
  d5: P(1, 10), //       dây 1 phím 10 — D5
  noiDau: P(2, 4), //    dây 3 phím 0, có dấu nối
};
const S = {
  e4: P(1, 2),
  a3: P(1, 3),
};
const tab = (path: string, xml = FIX) => readNoteFields(xml, path)!;
const dat = (path: string, string: number, fret: number): MusicXmlEditCommand =>
  ({ type: "ChangeTabPosition", path, string, fret }) as MusicXmlEditCommand;
const boLoi = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e as EditError;
  }
};
/** Bất biến chính: dây buông + phím = cao độ vang lên. */
const khop = (xml: string, path: string) => {
  const f = tab(path, xml);
  return f.tabTuning!.get(f.tab!.string)! + f.tab!.fret === soundingPitch(f.pitch!);
};

// ── Mô hình (thuần) ───────────────────────────────────────────────────────

test("mô hình: dây 1 là dây CAO nhất — đúng quy ước MusicXML, NGƯỢC alphaTab", () => {
  const f = tab(T.buongE4);
  assert.equal(f.tabTuning!.get(1), 64, "dây 1 = E4");
  assert.equal(f.tabTuning!.get(6), 40, "dây 6 = E2");
});

test("mô hình: vị trí → cao độ, và mọi cách sai đều bị chặn có lý do", () => {
  const ld = tab(T.buongE4).tabTuning!;
  const ok = viTri(ld, 2, 5);
  assert.ok(ok.ok);
  assert.equal((ok as { midi: number }).midi, 64, "dây 2 phím 5 = E4");
  const ca: [number, number, string][] = [
    [0, 3, "TAB_STRING_INVALID"],
    [7, 3, "TAB_TUNING_NOT_RESOLVED"],
    [2, -1, "TAB_FRET_INVALID"],
    [2, 2.5, "TAB_FRET_INVALID"],
    [2, PHIM_TOI_DA_UI + 1, "TAB_FRET_OUT_OF_RANGE"],
  ];
  for (const [d, p, code] of ca) {
    const r = viTri(ld, d, p);
    assert.equal(r.ok, false, `${d}/${p}`);
    assert.equal((r as { code: string }).code, code, `${d}/${p}`);
  }
  assert.equal((viTri(null, 1, 0) as { code: string }).code, "TAB_TUNING_NOT_RESOLVED");
});

test("mô hình: đổi dây giữ cao độ; dây không với tới thì chặn", () => {
  const ld = tab(T.buongE4).tabTuning!;
  const r = doiDayGiuCaoDo(ld, 64, 2);
  assert.deepEqual(r, { ok: true, string: 2, fret: 5, midi: 64 });
  // E2 (40) không chơi được trên dây 1 (E4 = 64) — phải bấm phím âm.
  const lo = doiDayGiuCaoDo(ld, 40, 1);
  assert.equal(lo.ok, false);
});

// ── Lệnh ──────────────────────────────────────────────────────────────────

test("ĐẶT PHÍM: dây 3 phím 2 → phím 4 — cao độ A3 thành B3, dây giữ nguyên", () => {
  const r = applyCommand(FIX, dat(T.a3, 3, 4));
  const f = tab(T.a3, r.xml);
  assert.deepEqual(f.tab, { string: 3, fret: 4 });
  assert.deepEqual(f.pitch, { step: "B", alter: 0, octave: 3 });
  assert.ok(khop(r.xml, T.a3));
  assert.deepEqual([...rhythmIssues(r.xml)], [...rhythmIssues(FIX)]);
});

test("ĐẶT PHÍM hai chữ số: dây 1 phím 10 → phím 12, cao độ D5 thành E5", () => {
  const r = applyCommand(FIX, dat(T.d5, 1, 12));
  const f = tab(T.d5, r.xml);
  assert.deepEqual(f.tab, { string: 1, fret: 12 });
  assert.deepEqual(f.pitch, { step: "E", alter: 0, octave: 5 });
  assert.ok(khop(r.xml, T.d5));
});

test("ĐỔI DÂY giữ cao độ: E4 dây buông 1 → dây 2 phím 5, cao độ KHÔNG đổi một chữ", () => {
  const truoc = tab(T.buongE4);
  const r = applyCommand(FIX, dat(T.buongE4, 2, 5));
  const f = tab(T.buongE4, r.xml);
  assert.deepEqual(f.tab, { string: 2, fret: 5 });
  assert.deepEqual(f.pitch, truoc.pitch, "cao độ giữ nguyên");
  // Và `<pitch>` trong file không bị đụng một byte nào.
  const pitchXml = (s: string) => s.match(/<note>\s*<pitch>\s*<step>E<\/step>\s*<octave>4<\/octave>[\s\S]*?<staff>2<\/staff>/)![0].match(/<pitch>[\s\S]*?<\/pitch>/)![0];
  assert.equal(pitchXml(r.xml), pitchXml(FIX));
  assert.ok(khop(r.xml, T.buongE4));
});

test("DẤU HOÁ đi qua luật 3B: giọng Sol trưởng, phím làm ra Fa thì có dấu bình", () => {
  // Dây 1 phím 1 = F4. Giọng Sol có Fa♯ trong bộ khoá → Fa tự nhiên phải có ♮.
  const fa = applyCommand(FIX, dat(T.buongE4, 1, 1));
  const f = tab(T.buongE4, fa.xml);
  assert.equal(f.pitch!.step, "F");
  assert.equal(f.pitch!.alter, 0);
  assert.equal(f.accidental, "natural");
  // Dây 1 phím 2 = F♯4 → nằm trong bộ khoá, không vẽ dấu nào.
  const fis = applyCommand(FIX, dat(T.buongE4, 1, 2));
  const g = tab(T.buongE4, fis.xml);
  assert.equal(soundingPitch(g.pitch!), 66);
  assert.equal(g.accidental, null);
});

test("LÊN DÂY KHÁC (Drop D): dây 6 buông là D2, không phải E2", () => {
  const f = tab(P(1, 4), DROP_D);
  assert.equal(f.tabTuning!.get(6), 38);
  const r = applyCommand(DROP_D, dat(P(1, 4), 6, 2));
  assert.deepEqual(tab(P(1, 4), r.xml).pitch, { step: "E", alter: 0, octave: 2 });
  assert.ok(khop(r.xml, P(1, 4)));
});

// ── Chặn ──────────────────────────────────────────────────────────────────

test("THIẾU CÁCH LÊN DÂY: chặn, không bao giờ tự mặc định E A D G B E", () => {
  const e = boLoi(() => applyCommand(KHONG_LEN_DAY, dat(P(1, 4), 3, 4)));
  assert.equal(e?.code, "TAB_TUNING_NOT_RESOLVED");
  // Mặt tiền cũng từ chối sớm, cả hai ý định.
  const f = tab(P(1, 4), KHONG_LEN_DAY);
  assert.equal(f.tabTuning, null);
  for (const a of [
    { type: "SET_TAB_FRET", fret: 4 },
    { type: "MOVE_TAB_STRING", delta: 1 },
  ] as const) {
    const r = toCommand(a, P(1, 4), f);
    assert.equal(r.kind, "refused", a.type);
    assert.match((r as { message: string }).message, /cách lên dây/);
  }
});

test("LÊN DÂY THIẾU MỘT PHẦN: dây không được ghi thì không tính được", () => {
  // rest-entry.musicxml chỉ ghi dây 1 và dây 6.
  const thieu = doc("./fixtures/rest-entry.musicxml");
  const path = "/score-partwise/part[2]/measure[1]/*[2]";
  const e = boLoi(() => applyCommand(thieu, dat(path, 3, 2)));
  assert.equal(e?.code, "TAB_TUNING_NOT_RESOLVED");
});

test("CHẶN: phím âm, phím lẻ, dây không có, khuông không phải TAB", () => {
  for (const [cmd, code] of [
    [dat(T.a3, 3, -1), "TAB_FRET_INVALID"],
    [dat(T.a3, 3, 1.5), "TAB_FRET_INVALID"],
    [dat(T.a3, 9, 0), "TAB_TUNING_NOT_RESOLVED"],
    [dat(S.a3, 3, 2), "TAB_NOT_A_TAB_STAFF"],
  ] as [MusicXmlEditCommand, string][]) {
    const e = boLoi(() => applyCommand(FIX, cmd));
    assert.equal(e?.code, code, JSON.stringify(cmd));
  }
});

test("GIAO DỊCH: mọi phép chặn không để lại một byte, một lệnh, một id nào", () => {
  const truoc = createDraft(FIX);
  let sau: DraftState = truoc;
  for (const cmd of [dat(T.a3, 3, -1), dat(T.a3, 9, 0), dat(S.a3, 3, 2)])
    assert.throws(() => (sau = applyToDraft(truoc, cmd)));
  assert.equal(sau, truoc);
  assert.equal(sau.xml, FIX);
  assert.equal(sau.commands.length, 0);
  const khong = createDraft(KHONG_LEN_DAY);
  assert.throws(() => applyToDraft(khong, dat(P(1, 4), 3, 4)));
});

// ── KHÔNG đồng bộ theo suy đoán ───────────────────────────────────────────

test("NỐT KHUÔNG NHẠC không bị đụng khi đổi phím TAB — không có quan hệ nào để dựa vào", () => {
  const r = applyCommand(FIX, dat(T.a3, 3, 4));
  // Nốt TAB đã thành B3, nhưng nốt khuông nhạc "trông giống cặp của nó" vẫn A3.
  assert.deepEqual(tab(S.a3, r.xml).pitch, { step: "A", alter: 0, octave: 3 });
  // Và toàn bộ khuông nhạc byte-identical.
  const khuong1 = (s: string) => s.slice(s.indexOf("<note>"), s.indexOf("<backup>"));
  assert.equal(khuong1(r.xml), khuong1(FIX));
});

test("CHỈ sửa đúng nốt được chọn: hai nốt E4 cùng cao độ khác dây không kéo nhau", () => {
  const r = applyCommand(FIX, dat(T.e4DayHai, 2, 7));
  // Nốt kia (dây buông 1, cũng là E4) không nhúc nhích.
  assert.deepEqual(tab(T.buongE4, r.xml).tab, { string: 1, fret: 0 });
  assert.deepEqual(tab(T.buongE4, r.xml).pitch, { step: "E", alter: 0, octave: 4 });
});

// ── Phạm vi diff ──────────────────────────────────────────────────────────

test("DIFF chỉ nằm ở string / fret / pitch / accidental của đúng một nốt", () => {
  const r = applyCommand(FIX, dat(T.a3, 3, 4));
  const khoi = (s: string) => s.split(/(?=<note>)/);
  const a = khoi(FIX);
  const b = khoi(r.xml);
  assert.equal(a.length, b.length);
  const khac = a.map((x, i) => (x === b[i] ? -1 : i)).filter((i) => i >= 0);
  assert.equal(khac.length, 1, "đúng một khối <note> đổi");
  // Trong khối đó: không một dòng nào ngoài pitch/technical/accidental đổi.
  const dong = (s: string) => s.split("\n").map((x) => x.trim());
  const cu = dong(a[khac[0]]);
  const moi = dong(b[khac[0]]);
  for (const x of moi.filter((d) => !cu.includes(d)))
    assert.match(x, /<(step|alter|octave|fret|string|accidental)>/, `dòng lạ: ${x}`);
  for (const x of cu.filter((d) => !moi.includes(d)))
    assert.match(x, /<(step|alter|octave|fret|string|accidental)>/, `dòng mất: ${x}`);
  // Duration / voice / staff / type của chính nốt đó không đổi.
  for (const t of ["duration", "voice", "staff", "type", "stem"])
    assert.equal(a[khac[0]].match(new RegExp(`<${t}>[^<]*</${t}>`))?.[0], b[khac[0]].match(new RegExp(`<${t}>[^<]*</${t}>`))?.[0], t);
  // Dấu nối, lời, bè, khuông của mọi nốt khác y nguyên.
  assert.equal((r.xml.match(/<tied /g) ?? []).length, (FIX.match(/<tied /g) ?? []).length);
  assert.equal((r.xml.match(/<lyric/g) ?? []).length, (FIX.match(/<lyric/g) ?? []).length);
});

test("NỐT TAB CÓ DẤU NỐI vẫn đổi được phím, và dấu nối không bị đụng", () => {
  // Đổi phím nốt đầu dấu nối chỉ đổi đúng nốt ấy. (Đồng bộ nốt cuối dấu nối là
  // chuyện của dấu nối, không phải của TAB — để giai đoạn khác.)
  const r = applyCommand(FIX, dat(T.noiDau, 4, 5));
  const f = tab(T.noiDau, r.xml);
  assert.deepEqual(f.tab, { string: 4, fret: 5 });
  assert.deepEqual(f.pitch, { step: "G", alter: 0, octave: 3 }, "dây 4 phím 5 = G3 — cao độ không đổi");
  assert.deepEqual(f.ties, ["start", "start"]);
});

// ── Hoàn tác / làm lại ────────────────────────────────────────────────────

test("HOÀN TÁC: dây 3 phím 2 → phím 4 → đổi dây giữ cao độ → undo ×2 → redo ×2", () => {
  let d: DraftState = createDraft(FIX);
  d = applyToDraft(d, dat(T.a3, 3, 4)); // B3 trên dây 3
  const buoc1 = d.xml;
  const r = toCommand({ type: "MOVE_TAB_STRING", delta: 1 }, T.a3, tab(T.a3, d.xml));
  assert.equal(r.kind, "command");
  d = applyToDraft(d, (r as { command: MusicXmlEditCommand }).command); // B3 trên dây 4
  assert.deepEqual(tab(T.a3, d.xml).tab, { string: 4, fret: 9 });
  assert.deepEqual(tab(T.a3, d.xml).pitch, { step: "B", alter: 0, octave: 3 });
  const dinh = d.xml;

  d = undo(d);
  assert.equal(d.xml, buoc1);
  d = undo(d);
  assert.equal(d.xml, FIX);
  d = redo(redo(d));
  assert.equal(d.xml, dinh);
  assert.equal(d.xml, rebuildDraft(d.original, d.commands));
  const a = rebuildAll(d.original, d.commands);
  const b = rebuildAll(d.original, d.commands);
  assert.deepEqual([...a.identity.slots].sort(), [...b.identity.slots].sort());
});

test("ghi chú phiên bản gọi đúng tên việc sửa TAB", () => {
  assert.equal(describeCommands([dat(T.a3, 3, 4), dat(T.d5, 1, 12)]), "Sửa dây/phím 2 nốt TAB");
});

// ── Mặt tiền: hai ý định ──────────────────────────────────────────────────

test("mặt tiền: ĐẶT PHÍM giữ dây; ĐỔI DÂY giữ cao độ — hai kết quả khác nhau", () => {
  const f = tab(T.buongE4);
  const phim = toCommand({ type: "SET_TAB_FRET", fret: 3 }, T.buongE4, f);
  assert.deepEqual((phim as { command: unknown }).command, {
    type: "ChangeTabPosition",
    path: T.buongE4,
    string: 1,
    fret: 3,
  });
  const day = toCommand({ type: "MOVE_TAB_STRING", delta: 1 }, T.buongE4, f);
  assert.deepEqual((day as { command: unknown }).command, {
    type: "ChangeTabPosition",
    path: T.buongE4,
    string: 2,
    fret: 5,
  });
  // Đặt lại đúng phím đang có là lệnh rỗng.
  assert.deepEqual(toCommand({ type: "SET_TAB_FRET", fret: 0 }, T.buongE4, f), { kind: "noop" });
});

test("mặt tiền: dây biên và dây không với tới đều nói rõ", () => {
  const cao = toCommand({ type: "MOVE_TAB_STRING", delta: -1 }, T.buongE4, tab(T.buongE4));
  assert.equal(cao.kind, "refused");
  assert.match((cao as { message: string }).message, /dây cao nhất/);
  // E2 không chơi được trên dây nào ngoài dây 6 — thử từ Drop D dây 6 lên dây 5 (A2).
  const khong = toCommand({ type: "MOVE_TAB_STRING", delta: -1 }, P(1, 4), tab(P(1, 4), DROP_D));
  assert.equal(khong.kind, "refused");
  assert.match((khong as { message: string }).message, /không chơi được/);
});

test("mặt tiền: nốt không phải TAB, và dấu lặng TAB, đều bị từ chối", () => {
  const r = toCommand({ type: "SET_TAB_FRET", fret: 3 }, S.a3, tab(S.a3));
  assert.equal(r.kind, "refused");
  assert.match((r as { message: string }).message, /không nằm trên khuông TAB/);
});

// ── Bàn phím ──────────────────────────────────────────────────────────────

test("PHÍM: ở khuông nhạc 3 là móc kép, ở TAB 3 là PHÍM 3 — không phím nào hai nghĩa trong một ngữ cảnh", () => {
  const S0 = (key: string) => ({ key, ctrl: false, shift: false, alt: false });
  assert.deepEqual(traPhim(S0("3"), "notation"), { type: "SET_DURATION", noteType: "16th" });
  assert.deepEqual(traPhim(S0("3"), "tab"), { type: "TAB_DIGIT", digit: 3 });
  assert.deepEqual(traPhim(S0("0"), "notation"), { type: "MAKE_REST" });
  assert.deepEqual(traPhim(S0("0"), "tab"), { type: "TAB_DIGIT", digit: 0 });
  assert.deepEqual(traPhim(S0("ArrowUp"), "notation"), { type: "TRANSPOSE", semitones: 1 });
  assert.deepEqual(traPhim(S0("ArrowUp"), "tab"), { type: "MOVE_TAB_STRING", delta: -1 });
  // Phím không có nghĩa riêng ở TAB thì rơi xuống nghĩa chung.
  assert.deepEqual(traPhim(S0("ArrowRight"), "tab"), { type: "MOVE", where: "next" });
  assert.deepEqual(traPhim(S0("Delete"), "tab"), { type: "MAKE_REST" });
  assert.deepEqual(traPhim({ key: "z", ctrl: true, shift: false, alt: false }, "tab"), { type: "UNDO" });
});

test("NHÃN PHÍM đúng ngữ cảnh: ở TAB, nút móc kép KHÔNG đeo nhãn `3`", () => {
  assert.equal(phimCua({ type: "SET_DURATION", noteType: "16th" }, "notation"), "3");
  assert.equal(phimCua({ type: "SET_DURATION", noteType: "16th" }, "tab"), null);
  assert.equal(phimCua({ type: "MAKE_REST" }, "tab"), "Delete");
  assert.equal(phimCua({ type: "MOVE_TAB_STRING", delta: -1 }, "tab"), "ArrowUp");
  assert.equal(phimCua({ type: "MOVE_TAB_STRING", delta: -1 }, "notation"), null);
});

test("GỘP CHỮ SỐ: `1` rồi `2` liền nhau ra phím 12; chậm hoặc khác nốt thì bắt đầu lại", () => {
  const a = goSo(TAB_TRONG, "n1", 1, 1000);
  assert.deepEqual([a.phim, a.noiTiep], [1, false]);
  const b = goSo(a.state, "n1", 2, 1000 + CHO_NOI - 1);
  assert.deepEqual([b.phim, b.noiTiep], [12, true]);
  // Quá chậm → số mới.
  const c = goSo(a.state, "n1", 2, 1000 + CHO_NOI + 1);
  assert.deepEqual([c.phim, c.noiTiep], [2, false]);
  // Khác nốt → số mới.
  const d = goSo(a.state, "n2", 2, 1001);
  assert.deepEqual([d.phim, d.noiTiep], [2, false]);
  // Ghép vượt trần ô nhập → không ghép, bắt đầu lại bằng chữ số vừa gõ.
  const e = goSo(goSo(TAB_TRONG, "n1", 3, 1000).state, "n1", 5, 1001);
  assert.deepEqual([e.phim, e.noiTiep], [5, false]);
  // Ba chữ số không bao giờ ra phím trăm.
  const f = goSo(b.state, "n1", 3, 1002);
  assert.equal(f.phim <= PHIM_TOI_DA_UI, true);
});

test("AN TOÀN Ô CHỮ ở ngữ cảnh TAB: chữ số và mũi tên trong ô nhập không lọt", () => {
  for (const key of ["0", "1", "5", "9", "ArrowUp", "ArrowDown"]) {
    const ra = dispatch({ key, target: { tagName: "INPUT" } }, { choSua: true, cheDo: "tab" });
    assert.equal(ra.kind, "blocked", key);
    assert.equal((ra as { why: string }).why, "typing");
  }
  // Không có quyền thì chữ số trên TAB cũng không sinh gì.
  const ra = dispatch({ key: "5", target: null }, { choSua: false, cheDo: "tab" });
  assert.equal((ra as { why: string }).why, "capability");
});

// ── Giữ nguyên các cổng cũ ────────────────────────────────────────────────

test("CHÉP/DÁN vẫn chặn khuông TAB (chưa mở trong 4D.1)", () => {
  const vm = vuongMac(FIX, [T.a3]);
  assert.match(vm!, /TAB/);
  assert.throws(() => chepDoan(FIX, [T.a3]));
});

test("NHẬP NỐT vào dấu lặng TAB vẫn chặn — 4D.1 chỉ sửa nốt có sẵn", () => {
  const thieu = doc("./fixtures/rest-entry.musicxml");
  const path = "/score-partwise/part[2]/measure[1]/*[3]";
  const e = boLoi(() =>
    applyCommand(thieu, {
      type: "InsertNoteIntoRest",
      path,
      pitch: { step: "G", alter: 0, octave: 4 },
      noteType: "half",
      dots: 0,
    } as MusicXmlEditCommand)
  );
  assert.equal(e?.code, "TAB_NOTE_ENTRY_UNSUPPORTED");
  // Và ChangeTabPosition lên một dấu lặng TAB cũng không thành đường vòng.
  const e2 = boLoi(() => applyCommand(thieu, dat(path, 1, 3)));
  assert.equal(e2?.code, "TAB_NOTE_ENTRY_UNSUPPORTED");
});

test("DANH TÍNH: sửa TAB không đổi số con của ô, không đổi id nào", () => {
  const truoc = tagSourceIds(FIX).notes.map((n) => n.svgId);
  const r = applyCommand(FIX, dat(T.a3, 3, 4));
  assert.deepEqual(r.structural, []);
  assert.deepEqual(
    tagSourceIds(r.xml).notes.map((n) => n.svgId),
    truoc
  );
});

test("GỘP CHỮ SỐ khi bản khắc trễ nhiều giây: đo bằng giờ BẤM phím, cuối cùng chỉ MỘT lệnh phím 12", () => {
  // Hai phím bấm cách nhau 300 ms; handler của phím thứ hai chạy trễ 8 s vì lượt
  // khắc của phím đầu. `goSo` chỉ nhận giờ bấm — giờ chạy handler không lọt vào.
  assert.equal(goSo.length, 4);
  const bam1 = 1000, bam2 = 1300;
  const a = goSo(TAB_TRONG, T.d5, 1, bam1);
  let d: DraftState = createDraft(FIX);
  const truocSo = d;
  d = applyToDraft(d, dat(T.d5, 1, a.phim));
  const b = goSo(a.state, T.d5, 2, bam2); // chạy lúc 9300, nhưng tính theo 1300
  assert.deepEqual([b.phim, b.noiTiep], [12, true]);
  // Đúng như trang: nối tiếp thì quay về nháp trước chữ số đầu rồi mới đặt.
  d = applyToDraft(b.noiTiep ? truocSo : d, dat(T.d5, 1, b.phim));
  assert.equal(d.commands.length, 1);
  assert.deepEqual(tab(T.d5, d.xml).tab, { string: 1, fret: 12 });
  assert.deepEqual(tab(T.d5, d.xml).pitch, { step: "E", alter: 0, octave: 5 });
  assert.equal(undo(d).xml, FIX);
});

test("RỜI TAB: 3–7 trở lại là trường độ, nhãn cũng trở lại", () => {
  const S0 = (key: string) => ({ key, ctrl: false, shift: false, alt: false });
  const TD = { "3": "16th", "4": "eighth", "5": "quarter", "6": "half", "7": "whole" } as const;
  for (const [k, noteType] of Object.entries(TD)) {
    assert.equal(traPhim(S0(k), "tab")!.type, "TAB_DIGIT");
    assert.deepEqual(traPhim(S0(k), "notation"), { type: "SET_DURATION", noteType });
    assert.equal(phimCua({ type: "SET_DURATION", noteType }, "tab"), null);
    assert.equal(phimCua({ type: "SET_DURATION", noteType }, "notation"), k);
  }
});
