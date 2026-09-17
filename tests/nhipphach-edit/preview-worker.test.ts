/**
 * 4D.P4 — Lập lịch xem trước ngoài main thread.
 *
 * "Worker" ở đây là bộ vẽ giả có ĐỘ TRỄ tuỳ chỉnh, chạy renderer THẬT qua đúng
 * `xuLyYeuCau`, và gửi kết quả qua `structuredClone` như qua ranh giới Worker.
 * Worker thật trong trình duyệt được kiểm riêng (spike + E2E).
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { AnnotatedScore } from "../../src/musicxml-beats/renderer/types.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import { applyToDraft, createDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import type { SaveRequest, SaveResult } from "../../src/nhipphach/libraryRepository.ts";
import { toCommand } from "../../src/nhipphach/editor/commandFacade.ts";
import { goSo, TAB_TRONG } from "../../src/nhipphach/editor/tabEntry.ts";
import { ketQuaHopLe, xuLyYeuCau } from "../../src/nhipphach/preview/previewCore.ts";
import type { PreviewRequest, PreviewResponse } from "../../src/nhipphach/preview/previewCore.ts";
import { PreviewScheduler } from "../../src/nhipphach/preview/previewScheduler.ts";
import type { LoaiBoVe, PreviewTransport } from "../../src/nhipphach/preview/previewScheduler.ts";

const HAI = readFileSync(new URL("./fixtures/tab-twopage.musicxml", import.meta.url), "utf8");
const S = DEFAULT_SCORE_SETTINGS;
const P = (m: number, c: number) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
const dat = (path: string, string: number, fret: number): MusicXmlEditCommand =>
  ({ type: "ChangeTabPosition", path, string, fret }) as MusicXmlEditCommand;
const doi = (ms: number) => new Promise((r) => setTimeout(r, ms));

const chuan = await createAnnotatedScoreRenderer();
after(() => chuan.destroy());

type Hanh = "ok" | "crash" | "malformed" | "hang";
/** Bộ vẽ giả: renderer thật, trễ tuỳ chỉnh, có thể được lệnh hỏng theo kịch bản. */
function taoMoiTruong(opts: {
  tre: () => number;
  hanh?: (lanGui: number, loai: LoaiBoVe) => Hanh;
  workerCo?: boolean;
}) {
  const nhatKy = { taoWorker: 0, taoMain: 0, gui: [] as number[], huy: 0 };
  let lanGui = 0;
  const taoBoVe = (
    loai: LoaiBoVe,
    onMessage: (d: unknown) => void,
    onError: (why: string) => void
  ): PreviewTransport | null => {
    if (loai === "worker" && opts.workerCo === false) return null;
    if (loai === "worker") nhatKy.taoWorker++;
    else nhatKy.taoMain++;
    const rP = createAnnotatedScoreRenderer();
    let chet = false;
    return {
      send(req: PreviewRequest) {
        const n = ++lanGui;
        nhatKy.gui.push(req.revision);
        const h = opts.hanh?.(n, loai) ?? "ok";
        const cho = opts.tre();
        setTimeout(async () => {
          if (chet) return;
          if (h === "hang") return;
          if (h === "crash") return onError("WORKER_ERROR");
          if (h === "malformed") return onMessage({ revision: req.revision, ok: true, score: { pages: "x" } });
          const r = await rP;
          if (chet) return;
          onMessage(structuredClone(xuLyYeuCau(r, structuredClone(req))));
        }, cho);
      },
      terminate() {
        chet = true;
        nhatKy.huy++;
        void rP.then((r) => r.destroy());
      },
    };
  };
  const hien: Extract<PreviewResponse, { ok: true }>[] = [];
  const loi: { message: string; revision: number }[] = [];
  const lap = new PreviewScheduler({
    taoBoVe,
    hien: (res) => hien.push(res),
    baoLoi: (message, revision) => loi.push({ message, revision }),
    thoiGianCho: 3000,
  });
  return { lap, hien, loi, nhatKy };
}
/** Trang gửi yêu cầu cho bản nháp hiện tại, như lượt vẽ của trang. */
function xin(lap: PreviewScheduler, d: DraftState, cmd: MusicXmlEditCommand | null) {
  const revision = lap.soHieuMoiNhat + 1;
  lap.request({ revision, xml: d.xml, settings: S, cmd });
  return revision;
}
async function choXong(lap: PreviewScheduler, max = 120_000) {
  const bd = Date.now();
  while (lap.dangBan && Date.now() - bd < max) await doi(20);
  assert.equal(lap.dangBan, false, "bộ vẽ không xong");
}
const giongChuan = (xml: string, s: AnnotatedScore) => {
  const c = chuan.render(xml, S);
  assert.deepEqual(s.pages.map((p) => p.svg), c.pages.map((p) => p.svg));
  assert.deepEqual(s.anchors, c.anchors);
  assert.deepEqual(s.diagnostics, c.diagnostics);
};

test("kết quả qua ranh giới Worker vẫn đủ hình dạng; kết quả dị dạng bị nhận ra", async () => {
  const r = await createAnnotatedScoreRenderer();
  const res = structuredClone(xuLyYeuCau(r, { revision: 1, xml: HAI, settings: S, cmd: null }));
  assert.ok(ketQuaHopLe(res));
  assert.ok(res.ok && res.score.noteIndex.get("tva-src-p1-m1-c8"));
  for (const hong of [null, {}, { revision: 1 }, { revision: 1, ok: true, score: { pages: [] } }, { revision: "1", ok: false, error: "x" }])
    assert.equal(ketQuaHopLe(hong), false);
  r.destroy();
});

test("CHỐT SỐ HIỆU + GỘP: đang vẽ 1 mà xin 2,3,4,5 → chỉ vẽ 1 rồi 5; chỉ 5 được hiện", async () => {
  const { lap, hien, nhatKy } = taoMoiTruong({ tre: () => 300 });
  let d = createDraft(HAI);
  xin(lap, d, null);
  for (const f of [4, 5, 7, 9]) {
    const cmd = dat(P(1, 8), 3, f);
    d = applyToDraft(d, cmd);
    xin(lap, d, cmd);
  }
  await choXong(lap);
  assert.deepEqual(nhatKy.gui, [1, 5]);
  assert.equal(lap.stats.coalesced, 3);
  assert.equal(lap.stats.dropped, 1, "kết quả của bản 1 về muộn → bỏ");
  assert.deepEqual(hien.map((h) => h.revision), [5]);
  assert.equal(d.commands.length, 4, "gộp khi VẼ, không mất lệnh nào");
  giongChuan(d.xml, hien[0].score);
  lap.destroy();
});

test("GÕ '1','2' khi bộ vẽ chậm 2 giây: vẫn phím 12, một lệnh; mọi thao tác main thread không phải chờ", async () => {
  const { lap, hien } = taoMoiTruong({ tre: () => 2000 });
  const goc = createDraft(HAI);
  let d = goc;
  xin(lap, d, null); // bộ vẽ bận 2 giây từ đây
  const path = P(1, 10); // dây 1 phím 10
  const doLau: number[] = [];
  const phimSo = (so: number, lucBam: number, state: typeof TAB_TRONG, truocSo: DraftState) => {
    const a = performance.now();
    const go = goSo(state, "tva-src-p1-m1-c10", so, lucBam);
    const nen = go.noiTiep ? truocSo : d;
    const f = readNoteFields(nen.xml, path)!;
    const ra = toCommand({ type: "SET_TAB_FRET", fret: go.phim }, path, f, undefined as never, undefined as never);
    assert.equal(ra.kind, "command");
    d = applyToDraft(nen, (ra as { command: MusicXmlEditCommand }).command);
    xin(lap, d, (ra as { command: MusicXmlEditCommand }).command);
    doLau.push(performance.now() - a);
    return go.state;
  };
  const st = phimSo(1, 1000, TAB_TRONG, goc);
  assert.equal(lap.dangBan, true, "bộ vẽ vẫn đang bận khi phím thứ hai tới");
  phimSo(2, 1200, st, goc);
  assert.deepEqual(readNoteFields(d.xml, path)!.tab, { string: 1, fret: 12 });
  assert.equal(d.commands.length, 1);
  // Điều hướng / hoàn tác / làm lại: thao tác thuần trên main thread, không chờ bộ vẽ.
  const a = performance.now();
  const u = undo(d);
  const r2 = redo(u);
  doLau.push(performance.now() - a);
  assert.equal(r2.xml, d.xml);
  assert.ok(Math.max(...doLau) < 1500, `thao tác main thread mất ${Math.max(...doLau)} ms`);
  assert.equal(lap.dangBan, true, "mọi thao tác trên xong TRƯỚC khi bộ vẽ trả kết quả");
  await choXong(lap);
  assert.equal(hien.at(-1)!.revision, lap.soHieuMoiNhat);
  giongChuan(d.xml, hien.at(-1)!.score);
  lap.destroy();
});

test("HOÀN TÁC khi đang vẽ: kết quả cũ bị bỏ; sửa ×20, hoàn tác ×10, làm lại ×5 với trễ ngẫu nhiên → bản cuối đúng", async () => {
  let rng = 3;
  const rand = (n: number) => ((rng = (rng * 1103515245 + 12345) % 2147483648), (rng >>> 16) % n);
  const { lap, hien } = taoMoiTruong({ tre: () => 10 + rand(490) });
  let d = createDraft(HAI);
  xin(lap, d, null);
  const not = [[1, 8], [3, 7], [11, 7], [21, 7], [23, 7]] as const;
  let n = 0;
  while (n < 20) {
    const [m, c] = not[rand(not.length)];
    const f = readNoteFields(d.xml, P(m, c))!;
    const cmd = dat(P(m, c), 3, (f.tab!.fret + 1 + rand(12)) % 17);
    const sau = applyToDraft(d, cmd);
    if (sau === d) continue;
    d = sau;
    n++;
    xin(lap, d, cmd);
    if (rand(3) === 0) await doi(rand(200));
  }
  for (let i = 0; i < 10; i++) {
    const cmd = d.commands[d.cursor - 1];
    d = undo(d);
    xin(lap, d, cmd);
    if (rand(2)) await doi(rand(150));
  }
  for (let i = 0; i < 5; i++) {
    d = redo(d);
    xin(lap, d, d.commands[d.cursor - 1]);
  }
  await choXong(lap);
  const cuoi = hien.at(-1)!;
  assert.equal(cuoi.revision, lap.soHieuMoiNhat);
  // Không kết quả nào được hiện theo thứ tự lùi.
  for (let i = 1; i < hien.length; i++) assert.ok(hien[i].revision > hien[i - 1].revision);
  assert.equal(d.cursor, 15);
  giongChuan(d.xml, cuoi.score);
  lap.destroy();
});

test("HỎNG: sập, kết quả dị dạng, treo → huỷ bộ vẽ, tạo bộ mới, vẽ đầy đủ bản mới nhất", async () => {
  for (const kieu of ["crash", "malformed", "hang"] as const) {
    const { lap, hien, nhatKy } = taoMoiTruong({ tre: () => 50, hanh: (n) => (n === 2 ? kieu : "ok") });
    let d = createDraft(HAI);
    xin(lap, d, null);
    await choXong(lap);
    const cmd = dat(P(3, 7), 3, 4);
    d = applyToDraft(d, cmd);
    const rev = xin(lap, d, cmd);
    await choXong(lap, 20_000);
    assert.equal(nhatKy.huy, 1, kieu);
    assert.equal(nhatKy.taoWorker, 2, kieu);
    assert.equal(hien.at(-1)!.revision, rev, kieu);
    assert.equal(hien.at(-1)!.path, "full", `${kieu}: bộ mới vẽ đầy đủ`);
    giongChuan(d.xml, hien.at(-1)!.score);
    lap.destroy();
  }
});

test("DỰ PHÒNG: Worker không có → vẽ trên main thread; Worker hỏng liên tục → chuyển hẳn sang main thread", async () => {
  const a = taoMoiTruong({ tre: () => 10, workerCo: false });
  xin(a.lap, createDraft(HAI), null);
  await choXong(a.lap);
  assert.equal(a.lap.loaiBoVe, "main");
  assert.equal(a.hien.length, 1);
  a.lap.destroy();

  const b = taoMoiTruong({ tre: () => 10, hanh: (_n, loai) => (loai === "worker" ? "crash" : "ok") });
  const d = createDraft(HAI);
  xin(b.lap, d, null);
  await choXong(b.lap);
  assert.equal(b.lap.stats.fallbackMain, true);
  assert.equal(b.nhatKy.taoMain, 1);
  assert.equal(b.hien.at(-1)!.revision, 1);
  giongChuan(d.xml, b.hien.at(-1)!.score);
  b.lap.destroy();
});

test("LƯU khi bộ vẽ đang bận: lưu đúng từng byte bản nháp mới nhất, không chờ xem trước", async () => {
  const { lap, hien } = taoMoiTruong({ tre: () => 3000 });
  let d = createDraft(HAI);
  const cmd = dat(P(21, 7), 3, 5);
  d = applyToDraft(d, cmd);
  xin(lap, d, cmd);
  const calls: SaveRequest[] = [];
  const out = await saveDraftAsVersion({
    library: { async save(req: SaveRequest) { calls.push(req); return { scoreId: "s", versionNumber: 2 } as SaveResult; } } as never,
    scoreId: "s",
    sourceFilename: "a.musicxml",
    original: HAI,
    draft: d.xml,
    changeNote: "",
    pageCount: null,
    render: (xml) => chuan.render(xml, S),
  });
  assert.ok(out.result);
  assert.equal(calls[0].xml, d.xml);
  assert.equal(hien.length, 0, "lưu xong trước khi bản xem trước về");
  assert.equal(lap.dangBan, true);
  lap.destroy();
});

test("STRESS 100 lệnh TAB, trễ 10–500 ms: đủ 100 lệnh, không bản cũ nào được hiện, bản cuối = bản chuẩn; hoàn tác ×100 / làm lại ×100", async () => {
  let rng = 11;
  const rand = (n: number) => ((rng = (rng * 1103515245 + 12345) % 2147483648), (rng >>> 16) % n);
  const { lap, hien } = taoMoiTruong({ tre: () => 10 + rand(490) });
  let d = createDraft(HAI);
  xin(lap, d, null);
  const not = [1, 3, 5, 11, 13, 21, 23].flatMap((m) => (m === 1 ? [7, 8, 9, 10] : [6, 7, 8, 9]).map((c) => [m, c] as const));
  let lenh = 0;
  const doLau: number[] = [];
  while (lenh < 100) {
    const [m, c] = not[rand(not.length)];
    const f = readNoteFields(d.xml, P(m, c))!;
    const cmd = rand(4) === 0
      ? dat(P(m, c), f.tab!.string === 1 ? 2 : f.tab!.string - 1, f.tab!.fret + (f.tab!.string === 1 ? 5 : 0))
      : dat(P(m, c), f.tab!.string, rand(17));
    const a = performance.now();
    let sau: DraftState;
    try {
      sau = applyToDraft(d, cmd);
    } catch {
      continue;
    }
    if (sau === d) continue;
    d = sau;
    lenh++;
    xin(lap, d, cmd);
    doLau.push(performance.now() - a);
    if (rand(4) === 0) await doi(rand(300));
  }
  assert.equal(d.commands.length, 100);
  await choXong(lap);
  for (let i = 1; i < hien.length; i++) assert.ok(hien[i].revision > hien[i - 1].revision);
  assert.equal(hien.at(-1)!.revision, lap.soHieuMoiNhat);
  giongChuan(d.xml, hien.at(-1)!.score);
  const cuoi = d.xml;
  for (let i = 0; i < 100; i++) {
    const cmd = d.commands[d.cursor - 1];
    d = undo(d);
    xin(lap, d, cmd);
    if (rand(5) === 0) await doi(rand(100));
  }
  assert.equal(d.xml, HAI);
  await choXong(lap);
  giongChuan(d.xml, hien.at(-1)!.score);
  for (let i = 0; i < 100; i++) {
    d = redo(d);
    xin(lap, d, d.commands[d.cursor - 1]);
    if (rand(5) === 0) await doi(rand(100));
  }
  assert.equal(d.xml, cuoi);
  await choXong(lap);
  assert.equal(hien.at(-1)!.revision, lap.soHieuMoiNhat);
  giongChuan(d.xml, hien.at(-1)!.score);
  const s = [...doLau].sort((x, y) => x - y);
  console.log(`# main-thread lệnh (file 2 trang): trung vị ${s[50].toFixed(1)} ms, p95 ${s[95].toFixed(1)} ms; gộp ${lap.stats.coalesced}, bỏ ${lap.stats.dropped}, gửi ${lap.stats.sent}`);
  lap.destroy();
});
