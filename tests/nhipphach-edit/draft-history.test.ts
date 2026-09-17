/**
 * 4D.P5A — Hoàn tác nhanh bằng bộ đệm mốc DẪN XUẤT.
 *
 * Mọi phép thử so với đường chuẩn `rebuildAll(gốc, lệnh[0..con trỏ))`: xml từng
 * byte và bản đồ danh tính. Bộ đệm bị làm hỏng / bị xoá thì kết quả vẫn y hệt.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import {
  __checkpointThuNghiem as T,
  applyToDraft,
  CHECKPOINT_GAN_NHAT,
  CHECKPOINT_MOC_TOI_DA,
  createDraft,
  cungDanhTinh,
  rebuildAll,
  redo,
  thongKeLichSu,
  undo,
  xoaCheckpoint,
} from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { chepDoan } from "../../src/nhipphach/edit/clipboard.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import type { SaveRequest, SaveResult } from "../../src/nhipphach/libraryRepository.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import { NHAP_BAN_DAU } from "../../src/nhipphach/editor/noteEntry.ts";
import type { EditorAction } from "../../src/nhipphach/editor/actions.ts";
import { PreviewScheduler } from "../../src/nhipphach/preview/previewScheduler.ts";
import type { PreviewRequest } from "../../src/nhipphach/preview/previewCore.ts";

const doc = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const TAB = doc("./fixtures/tab-edit.musicxml");
const ENTRY = doc("./fixtures/note-entry.musicxml");

/** Bất biến: trạng thái = dựng chuẩn từ gốc + tiền tố lệnh. */
function dungChuan(s: DraftState) {
  const c = rebuildAll(s.original, s.commands.slice(0, s.cursor));
  assert.equal(s.xml, c.xml, `xml lệch tại con trỏ ${s.cursor}`);
  assert.ok(cungDanhTinh(s.identity, c.identity), `danh tính lệch tại con trỏ ${s.cursor}`);
}

/** Sinh lệnh THẬT qua đúng mặt tiền bàn phím dùng, trên một sự kiện ngẫu nhiên. */
function taoTronLan(seed: number) {
  let rng = seed;
  const rand = (n: number) => ((rng = (rng * 1103515245 + 12345) % 2147483648), (rng >>> 16) % n);
  const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;
  const TYPES = ["quarter", "eighth", "half", "16th"] as const;
  return (d: DraftState): MusicXmlEditCommand | null => {
    const notes = tagSourceIds(d.xml).notes;
    const n = notes[rand(notes.length)];
    const f = readNoteFields(d.xml, n.path);
    if (!f) return null;
    let action: EditorAction;
    let ghiTam = null;
    const loai = f.khuongTab ? rand(2) + 10 : rand(6);
    switch (loai) {
      case 0: action = { type: "ENTER_PITCH", step: STEPS[rand(7)] } as EditorAction; break;
      case 1: action = { type: "TRANSPOSE", semitones: rand(2) ? 1 : -1 }; break;
      case 2: action = { type: "SET_DURATION", noteType: TYPES[rand(4)] } as EditorAction; break;
      case 3: action = { type: "MAKE_REST" }; break;
      case 4: action = { type: "ENTER_PITCH", step: STEPS[rand(7)] } as EditorAction; break;
      case 5: {
        // Chép một nốt khuông nhạc ngẫu nhiên rồi dán vào chỗ đang đứng.
        const nguon = notes.filter((x) => x.kind === "note" && !readNoteFields(d.xml, x.path)?.khuongTab);
        if (!nguon.length) return null;
        try {
          ghiTam = chepDoan(d.xml, [nguon[rand(nguon.length)].path]);
        } catch {
          return null;
        }
        action = { type: "PASTE" };
        break;
      }
      case 10: action = { type: "SET_TAB_FRET", fret: rand(15) }; break;
      default: action = { type: "MOVE_TAB_STRING", delta: rand(2) ? 1 : -1 };
    }
    try {
      const ra = toCommand(action, n.path, f, NHAP_BAN_DAU, ghiTam);
      return ra.kind === "command" ? ra.command : null;
    } catch {
      return null;
    }
  };
}
function chayLenh(goc: string, soLenh: number, seed: number) {
  const tao = taoTronLan(seed);
  let d = createDraft(goc);
  const loai: Record<string, number> = {};
  let thu = 0;
  while (d.commands.length < soLenh && thu++ < soLenh * 50) {
    const cmd = tao(d);
    if (!cmd) continue;
    let sau: DraftState;
    try {
      sau = applyToDraft(d, cmd);
    } catch {
      continue;
    }
    if (sau === d) continue;
    loai[cmd.type] = (loai[cmd.type] ?? 0) + 1;
    d = sau;
  }
  return { d, loai };
}

test("hoàn tác đi qua mốc: không dựng lại từ đầu, và vẫn đúng từng byte với đường chuẩn", () => {
  xoaCheckpoint();
  const { d: cuoi } = chayLenh(TAB, 20, 5);
  assert.equal(cuoi.commands.length, 20);
  let d = cuoi;
  const truoc = { ...thongKeLichSu };
  for (let i = 0; i < 20; i++) {
    d = undo(d);
    dungChuan(d);
  }
  assert.equal(d.xml, TAB);
  assert.equal(thongKeLichSu.dungLai - truoc.dungLai, 0, "không lần nào phải dựng lại từ gốc");
  assert.equal(thongKeLichSu.lechMoc - truoc.lechMoc, 0);
  for (let i = 0; i < 20; i++) {
    d = redo(d);
    dungChuan(d);
  }
  assert.equal(d.xml, cuoi.xml);
});

test("100 lệnh TRỘN (cao độ, trường độ + cân ô, lặng, nhập vào lặng, dán, TAB) — hoàn tác ×100 / làm lại ×100 luôn bằng đường chuẩn", () => {
  xoaCheckpoint();
  for (const [goc, seed] of [[ENTRY, 17], [TAB, 23]] as const) {
    const { d: cuoi, loai } = chayLenh(goc, 100, seed);
    assert.equal(cuoi.commands.length, 100, JSON.stringify(loai));
    const coCauTruc = (loai.ChangeDurationAndRebalance ?? 0) + (loai.InsertNoteIntoRest ?? 0) + (loai.PasteSequence ?? 0);
    assert.ok(coCauTruc > 0, `phải có lệnh đổi cấu trúc: ${JSON.stringify(loai)}`);
    let d = cuoi;
    for (let i = 0; i < 100; i++) {
      d = undo(d);
      dungChuan(d);
    }
    assert.equal(d.xml, goc);
    for (let i = 0; i < 100; i++) {
      d = redo(d);
      dungChuan(d);
    }
    assert.equal(d.xml, cuoi.xml);
    assert.ok(cungDanhTinh(d.identity, cuoi.identity));
    assert.ok(T.soMoc(d).length <= CHECKPOINT_GAN_NHAT + CHECKPOINT_MOC_TOI_DA, "bộ đệm phải có giới hạn");
    console.log(`# ${goc === ENTRY ? "note-entry" : "tab-edit"}: ${JSON.stringify(loai)}`);
  }
});

test("RẼ NHÁNH sau hoàn tác: 40 lệnh, về 25, áp lệnh mới → 26..40 bị bỏ, mốc nhánh cũ không lọt sang", () => {
  xoaCheckpoint();
  const { d: cuoi } = chayLenh(TAB, 40, 31);
  let d = cuoi;
  for (let i = 0; i < 15; i++) d = undo(d);
  assert.equal(d.cursor, 25);
  // Làm hỏng mốc 26..40 của NHÁNH CŨ — nhánh mới không được thấy.
  for (let c = 26; c <= 40; c++) T.chenSai(cuoi, c, { xml: "<hong/>", identity: cuoi.identity });
  const tao = taoTronLan(99);
  let cmd: MusicXmlEditCommand | null = null;
  let nhanh = d;
  while (nhanh === d) {
    cmd = tao(d);
    if (cmd) try { nhanh = applyToDraft(d, cmd); } catch { /* thử lệnh khác */ }
  }
  assert.equal(nhanh.commands.length, 26, "lệnh 26..40 bị bỏ");
  assert.notEqual(nhanh.commands, cuoi.commands);
  assert.equal(redo(nhanh), nhanh, "không còn gì để làm lại");
  assert.ok(T.soMoc(nhanh).every((k) => k <= 26), "chỉ mốc tiền tố ≤ 25 và mốc mới 26");
  dungChuan(nhanh);
  let u = nhanh;
  for (let i = 0; i < 26; i++) {
    u = undo(u);
    dungChuan(u);
  }
  assert.equal(u.xml, TAB);
  assert.equal(redo(u).xml, rebuildAll(TAB, nhanh.commands.slice(0, 1)).xml);
});

test("MỐC HỎNG (sai xml / sai danh tính) bị phát hiện → bỏ, dựng chuẩn, không mất nháp", () => {
  xoaCheckpoint();
  const { d: cuoi } = chayLenh(ENTRY, 12, 41);
  // Sai xml ở ngay vị trí sắp hoàn tác về.
  T.chenSai(cuoi, 11, { xml: cuoi.xml, identity: cuoi.identity });
  let truoc = thongKeLichSu.lechMoc;
  const u1 = undo(cuoi);
  dungChuan(u1);
  assert.equal(thongKeLichSu.lechMoc - truoc, 1);
  // Sai danh tính (xml đúng).
  const u2 = undo(u1);
  const dungXml = rebuildAll(ENTRY, cuoi.commands.slice(0, 9));
  const saiId = { slots: new Map([...dungXml.identity.slots].slice(1)) };
  T.chenSai(u2, 9, { xml: dungXml.xml, identity: saiId });
  truoc = thongKeLichSu.lechMoc;
  const u3 = undo(u2);
  dungChuan(u3);
  assert.equal(thongKeLichSu.lechMoc - truoc, 1, "danh tính sai phải bị bắt");
  assert.ok(cungDanhTinh(u3.identity, dungXml.identity));
  // Sai chỉ số: mốc của vị trí 7 bị cất dưới khoá 8.
  const sai = rebuildAll(ENTRY, cuoi.commands.slice(0, 7));
  T.chenSai(u3, 8, { xml: sai.xml, identity: sai.identity });
  truoc = thongKeLichSu.lechMoc;
  const u3b = undo(u3);
  dungChuan(u3b);
  assert.equal(thongKeLichSu.lechMoc - truoc, 1, "mốc sai chỉ số phải bị bắt");
  // Mốc là rác không áp được lệnh.
  T.chenSai(u3b, 7, { xml: "<khong-phai-musicxml/>", identity: u3b.identity });
  const u4 = undo(u3b);
  dungChuan(u4);
});

test("XOÁ bộ đệm bất kỳ lúc nào: kết quả y hệt, chỉ chậm hơn", () => {
  xoaCheckpoint();
  const { d: cuoi } = chayLenh(TAB, 10, 53);
  const a = undo(undo(cuoi));
  xoaCheckpoint();
  const truoc = thongKeLichSu.dungLai;
  const b = undo(undo(cuoi));
  assert.ok(thongKeLichSu.dungLai > truoc);
  assert.equal(a.xml, b.xml);
  assert.ok(cungDanhTinh(a.identity, b.identity));
  dungChuan(b);
});

test("LƯU không dính gì tới mốc: xml không có siêu dữ liệu, xoá bộ đệm vẫn lưu đúng từng byte", async () => {
  xoaCheckpoint();
  const { d: cuoi } = chayLenh(TAB, 8, 67);
  const d = undo(undo(cuoi));
  const luu = async () => {
    const calls: SaveRequest[] = [];
    await saveDraftAsVersion({
      library: { async save(req: SaveRequest) { calls.push(req); return { scoreId: "s", versionNumber: 2 } as SaveResult; } } as never,
      scoreId: "s",
      sourceFilename: "a.musicxml",
      original: TAB,
      draft: d.xml,
      changeNote: "",
      pageCount: null,
      render: () => ({ pages: [{ number: 1, svg: "<svg/>", width: 1, height: 1 }], diagnostics: [], notices: [] }) as never,
    }).catch(() => null);
    return calls[0]?.xml ?? d.xml;
  };
  const x1 = await luu();
  xoaCheckpoint();
  const x2 = await luu();
  assert.equal(x1, x2);
  assert.equal(x1, rebuildAll(TAB, cuoi.commands.slice(0, 6)).xml);
  assert.doesNotMatch(x1, /checkpoint|__moc|trungMoc|DraftCheckpoint/i);
});

test("TƯƠNG THÍCH cổng số hiệu P4: bộ vẽ đang vẽ lệnh 40, hoàn tác → 39 → 38, bản hiện cuối cùng là 38", async () => {
  xoaCheckpoint();
  const { d: cuoi } = chayLenh(TAB, 40, 71);
  const hien: number[] = [];
  const guiDi: PreviewRequest[] = [];
  const lap = new PreviewScheduler({
    taoBoVe: (_l, onMessage) => ({
      send(req) {
        guiDi.push(req);
        setTimeout(() => onMessage({ revision: req.revision, ok: true, path: "full", renderMs: 1, score: { pages: [{ number: 1, svg: req.xml, width: 1, height: 1 }], noteIndex: new Map() }, onsets: new Map() }), 50);
      },
      terminate() {},
    }),
    hien: (res) => hien.push(res.revision),
    baoLoi: () => assert.fail("không được lỗi"),
  });
  let d = cuoi;
  const xmlTheoSoHieu = new Map<number, string>();
  const xin = () => {
    const r = lap.soHieuMoiNhat + 1;
    xmlTheoSoHieu.set(r, d.xml);
    lap.request({ revision: r, xml: d.xml, settings: {} as never, cmd: null });
  };
  xin(); // đang vẽ bản 40
  d = undo(d);
  xin();
  d = undo(d);
  xin();
  while (lap.dangBan) await new Promise((r) => setTimeout(r, 10));
  assert.equal(d.cursor, 38);
  assert.equal(hien.at(-1), 3);
  assert.equal(xmlTheoSoHieu.get(hien.at(-1)!), d.xml, "bản hiện cuối là nháp ở lệnh 38");
  assert.equal(guiDi.length, 2, "bản 39 bị gộp, không vẽ");
  dungChuan(d);
  lap.destroy();
});

test("LỊCH SỬ LỆNH vẫn là nguồn sự thật: DraftState không mang mốc; rebuildAll không đọc bộ đệm", () => {
  const src = readFileSync(new URL("../../src/nhipphach/edit/draftEngine.ts", import.meta.url), "utf8");
  const khoi = src.slice(src.indexOf("export interface DraftState {"), src.indexOf("\n}", src.indexOf("export interface DraftState {")));
  const truong = [...khoi.matchAll(/^\s*readonly (\w+)[?]?:/gm)].map((m) => m[1]);
  assert.deepEqual(truong, ["original", "commands", "cursor", "xml", "identity"]);
  const than = (ten: string) => {
    const i = src.indexOf(`export function ${ten}(`);
    return src.slice(i, src.indexOf("\n}", i));
  };
  const khongDocMoc = (m: string) => !/boNhoMoc|ghiMoc|trangThaiTai/.test(m);
  assert.ok(khongDocMoc(than("rebuildAll")), "đường chuẩn không được đọc bộ đệm");
  assert.ok(khongDocMoc(than("rebuildDraft")));
  assert.equal(khongDocMoc(than("rebuildAll") + " boNhoMoc"), false, "luật không bắt được đột biến");
  // Một bản nháp tạo mới không mang theo gì ngoài 5 trường.
  const d = createDraft(TAB);
  assert.deepEqual(Object.keys(d).sort(), ["commands", "cursor", "identity", "original", "xml"]);
  assert.equal(JSON.stringify(d).includes("moc"), false);
});

test("4D.P5B HÌNH CHIẾU NHỊP: cùng hình chiếu ⇒ cùng lỗi nhịp; sửa TAB giữ hình chiếu, đổi trường độ thì không", async () => {
  const { khoaNhip, rhythmIssues } = await import("../../src/nhipphach/edit/validation.ts");
  const { musicXMLToBeatMap } = await import("../../src/musicxml-beats/beatMap.ts");
  const truc = (xml: string) =>
    JSON.stringify(musicXMLToBeatMap(xml).measures.map((m) => m.diagnostics.map((d) => `${d.code}@${d.sourceId}`)));
  let giu = 0, doi = 0, tab = 0;
  for (const goc of [ENTRY, TAB]) {
  const tao = taoTronLan(goc === ENTRY ? 123 : 321);
  let d = createDraft(goc);
  for (let i = 0; i < 300 && d.commands.length < 80; i++) {
    const cmd = tao(d);
    if (!cmd) continue;
    let sau: DraftState;
    try { sau = applyToDraft(d, cmd); } catch { continue; }
    if (sau === d) continue;
    const cung = khoaNhip(d.xml) === khoaNhip(sau.xml);
    if (cung) {
      giu++;
      // Hợp đồng: cùng hình chiếu thì bộ tính phách cho đúng cùng chẩn đoán.
      assert.equal(truc(sau.xml), truc(d.xml), `${cmd.type} giữ hình chiếu nhưng đổi nhịp`);
      assert.deepEqual([...rhythmIssues(sau.xml)], [...rhythmIssues(d.xml)]);
    } else doi++;
    if (cmd.type === "ChangeDurationAndRebalance" || cmd.type === "InsertNoteIntoRest" || cmd.type === "PasteSequence")
      assert.equal(cung, false, `${cmd.type} phải đổi hình chiếu`);
    d = sau;
  }
  }
  // TAB: đổi phím / đổi dây luôn giữ hình chiếu.
  const t = createDraft(TAB);
  for (const [s, f] of [[3, 4], [3, 9], [4, 5]] as const) {
    const sau = applyToDraft(t, { type: "ChangeTabPosition", path: "/score-partwise/part[1]/measure[1]/*[8]", string: s, fret: f } as never);
    assert.equal(khoaNhip(sau.xml), khoaNhip(TAB));
    tab++;
  }
  assert.ok(giu > 10 && doi > 5 && tab === 3, `giữ ${giu}, đổi ${doi}`);
  // Chỉ đổi <duration> (không đụng <type>): nhịp đổi ⇒ hình chiếu PHẢI khác.
  const i = ENTRY.indexOf("<duration>");
  const j = ENTRY.indexOf("</duration>", i);
  const lech = ENTRY.slice(0, i) + "<duration>" + (Number(ENTRY.slice(i + 10, j)) + 1) + ENTRY.slice(j);
  assert.notEqual(truc(lech), truc(ENTRY), "mẫu thử phải thật sự làm hỏng nhịp");
  assert.notEqual(khoaNhip(lech), khoaNhip(ENTRY), "hình chiếu bỏ mất trường độ");
});
