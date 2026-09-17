/**
 * 4D.P3 — PARTIAL_PAGE_RENDER trong đường renderer thật.
 *
 * Mỗi phép thử so bản XEM TRƯỚC (có thể ghép từng trang) với bản khắc CHUẨN từ
 * một bộ khắc mới tinh, từng byte. Phân loại dùng đúng hàm mà trang gọi.
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createAnnotatedScoreRenderer,
  renderCanonicalForExport,
} from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { AnnotatedScore } from "../../src/musicxml-beats/renderer/types.ts";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport.ts";
import { exportSVGPages } from "../../src/musicxml-beats/renderer/printExport.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import { applyToDraft, createDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import type { DraftState } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import type { SaveRequest, SaveResult } from "../../src/nhipphach/libraryRepository.ts";
import { keHoachXemTruoc } from "../../src/nhipphach/editor/previewPlan.ts";

const MP = readFileSync(new URL("./fixtures/tab-multipage.musicxml", import.meta.url), "utf8");
/** Hai trang — cho stress 100 lệnh: đủ để có trang được dùng lại, đủ nhẹ để chạy thường xuyên. */
const HAI = readFileSync(new URL("./fixtures/tab-twopage.musicxml", import.meta.url), "utf8");
const S = DEFAULT_SCORE_SETTINGS;
const P = (m: number, c: number) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
const id = (m: number, c: number) => `tva-src-p1-m${m}-c${c}`;
const dat = (path: string, string: number, fret: number): MusicXmlEditCommand =>
  ({ type: "ChangeTabPosition", path, string, fret }) as MusicXmlEditCommand;

const r = await createAnnotatedScoreRenderer();
const chuan = await createAnnotatedScoreRenderer();
after(() => {
  r.destroy();
  chuan.destroy();
});

/** Đúng những gì trang làm: phân loại so với bản renderer ĐANG xem, rồi vẽ. */
function xem(d: DraftState, cmd: MusicXmlEditCommand | null) {
  const plan = keHoachXemTruoc(cmd, r.previewXml(), d.xml);
  const truoc = r.stats();
  const score = r.renderPreview(d.xml, S, plan.kind === "partial" ? { sourceId: plan.sourceId } : null);
  const sau = r.stats();
  return {
    plan,
    score,
    partial: sau.previewPartial - truoc.previewPartial,
    full: sau.previewFull - truoc.previewFull,
    pagesRendered: sau.pagesRendered - truoc.pagesRendered,
    overlayPages: sau.overlayPages - truoc.overlayPages,
  };
}
const giongChuan = (xml: string, s: AnnotatedScore) => {
  const c = chuan.render(xml, S);
  assert.equal(s.pages.length, c.pages.length);
  s.pages.forEach((p, i) => assert.equal(p.svg, c.pages[i].svg, `trang ${i + 1} khác bản chuẩn`));
  assert.deepEqual(s.diagnostics, c.diagnostics);
  assert.deepEqual(s.notices, c.notices);
  assert.deepEqual(s.anchors, c.anchors);
  assert.deepEqual([...s.unresolvedNotes], [...c.unresolvedNotes]);
  // MEI mang giờ khắc (`isodate`) — khác từng giây, không phải nội dung.
  const boGio = (mei: string) => mei.replace(/isodate="[^"]*"/g, "");
  assert.equal(boGio(s.renderedMEI), boGio(c.renderedMEI));
  assert.equal(exportScoreSVG(s), exportScoreSVG(c));
};
const trangCo = (s: AnnotatedScore, sid: string) =>
  s.pages.flatMap((p, i) => (p.svg.includes(`id="${sid}"`) ? [i] : []));

test("đổi phím cùng dây, không đổi dấu hoá → chỉ vẽ lại ĐÚNG MỘT trang; các trang khác giữ nguyên chuỗi", () => {
  r.clearPreview();
  let d = createDraft(MP);
  const dau = xem(d, null);
  assert.equal(dau.full, 1);
  assert.ok(dau.score.pages.length >= 4, "mẫu phải nhiều trang");
  const m = 61; // ô lẻ ở trang sau
  const trang = trangCo(dau.score, id(m, 7));
  assert.equal(trang.length, 1);
  assert.ok(trang[0] >= 2, "nốt phải nằm ở trang sau");

  const cmd = dat(P(m, 7), 3, 4); // A3 → B3, cùng dây, không dấu hoá
  d = applyToDraft(d, cmd);
  const x = xem(d, cmd);
  assert.deepEqual(x.plan, { kind: "partial", sourceId: id(m, 7) });
  assert.deepEqual([x.partial, x.full, x.pagesRendered, x.overlayPages], [1, 0, 1, 1]);
  // Trang không đổi: CÙNG MỘT chuỗi, không chỉ bằng nội dung — React giữ nguyên nút.
  x.score.pages.forEach((p, i) => {
    if (i !== trang[0]) assert.equal(p.svg, dau.score.pages[i].svg);
  });
  assert.notEqual(x.score.pages[trang[0]].svg, dau.score.pages[trang[0]].svg);
  assert.ok(x.score.pages[trang[0]].svg.includes(">4</tspan>"));
  giongChuan(d.xml, x.score);
});

test("CỔNG 9→10 (một chữ số → hai chữ số) cùng dây, không dấu hoá → vẽ một trang, giống bản chuẩn", () => {
  r.clearPreview();
  let d = createDraft(MP);
  xem(d, null);
  // Dây 4 (Rê): phím 9 = Si3, phím 10 = Đô4 — cả hai không dấu hoá ở Sol trưởng.
  const vao = dat(P(45, 7), 4, 9);
  d = applyToDraft(d, vao);
  const doiDay = xem(d, vao);
  assert.equal(doiDay.plan.kind, "full", "đổi dây → vẽ đầy đủ");
  const cmd = dat(P(45, 7), 4, 10);
  d = applyToDraft(d, cmd);
  const x = xem(d, cmd);
  assert.equal(x.plan.kind, "partial");
  assert.deepEqual([x.partial, x.pagesRendered], [1, 1]);
  assert.ok(x.score.pages.some((p) => p.svg.includes(">10</tspan>")));
  giongChuan(d.xml, x.score);
});

test("đổi dây giữ cao độ → FULL_RENDER", () => {
  r.clearPreview();
  let d = createDraft(MP);
  xem(d, null);
  const cmd = dat(P(9, 6), 2, 5); // E4 dây 1 → dây 2 phím 5
  d = applyToDraft(d, cmd);
  const x = xem(d, cmd);
  assert.deepEqual(x.plan, { kind: "full", reason: "STRING_CHANGED" });
  assert.equal(x.full, 1);
  giongChuan(d.xml, x.score);
});

test("đổi phím làm dấu hoá xuất hiện / biến mất → FULL_RENDER; renderer tự chặn kể cả khi bị ép gợi ý", () => {
  r.clearPreview();
  let d = createDraft(MP);
  xem(d, null);
  const len = dat(P(11, 7), 3, 3); // A3 → nửa cung trên: dấu hoá xuất hiện
  d = applyToDraft(d, len);
  assert.notEqual(readNoteFields(d.xml, P(11, 7))!.accidental, null);
  const x = xem(d, len);
  assert.deepEqual(x.plan, { kind: "full", reason: "ACCIDENTAL_CHANGED" });
  giongChuan(d.xml, x.score);
  const xuong = dat(P(11, 7), 3, 4); // → B3: dấu biến mất
  d = applyToDraft(d, xuong);
  assert.deepEqual(keHoachXemTruoc(xuong, r.previewXml(), d.xml), { kind: "full", reason: "ACCIDENTAL_CHANGED" });
  // Phòng thủ tầng hai: ép gợi ý sai — renderer thấy chữ ký trang đổi và tự vẽ đầy đủ.
  const truoc = r.stats();
  const s = r.renderPreview(d.xml, S, { sourceId: id(11, 7) });
  const sau = r.stats();
  assert.equal(sau.previewPartial - truoc.previewPartial, 0);
  assert.equal(sau.previewFull - truoc.previewFull, 1);
  // Thêm/bớt <accid> làm id tự sinh dịch cả bài: chốt lưới neo (id ô nhịp) hoặc chữ
  // ký trang bắt được — chốt nào bắt trước cũng được, miễn là không ghép.
  const tong = (x: Record<string, number>) => Object.values(x).reduce((a, b) => a + b, 0);
  assert.equal(tong(sau.partialFallbacks) - tong(truoc.partialFallbacks), 1);
  giongChuan(d.xml, s);
});

test("danh tính không rõ / bản xem trước lạc nhịp / lệnh khác → FULL_RENDER", () => {
  r.clearPreview();
  let d = createDraft(MP);
  xem(d, null);
  // Id không có trên trang nào — renderer không đoán.
  const c1 = dat(P(13, 7), 3, 4);
  d = applyToDraft(d, c1);
  const truoc = r.stats();
  r.renderPreview(d.xml, S, { sourceId: "tva-src-p1-m999-c1" });
  assert.equal(r.stats().previewFull - truoc.previewFull, 1);
  assert.ok((r.stats().partialFallbacks.SOURCE_ID_NOT_ON_ONE_PAGE ?? 0) > 0);
  // Hai nốt đổi mà bản xem trước chưa theo kịp → khác biệt tràn ra ngoài nốt.
  const c2 = dat(P(15, 7), 3, 4);
  const c3 = dat(P(17, 7), 3, 4);
  d = applyToDraft(applyToDraft(d, c2), c3);
  assert.deepEqual(keHoachXemTruoc(c3, r.previewXml(), d.xml), { kind: "full", reason: "DIFF_OUTSIDE_NOTE" });
  // Không có bản xem trước, hoặc lệnh không phải TAB.
  assert.equal(keHoachXemTruoc(c3, null, d.xml).kind, "full");
  assert.deepEqual(
    keHoachXemTruoc({ type: "ChangePitch", path: P(1, 2) } as unknown as MusicXmlEditCommand, r.previewXml(), d.xml),
    { kind: "full", reason: "NOT_TAB_POSITION" }
  );
  // Đổi thiết lập lớp phủ (màu) → không ghép trang cũ vẽ bằng màu cũ.
  r.renderPreview(d.xml, S, null);
  const c4 = dat(P(19, 7), 3, 4);
  d = applyToDraft(d, c4);
  const t2 = r.stats();
  const s = r.renderPreview(d.xml, { ...S, color: "#1d4ed8" }, { sourceId: id(19, 7) });
  assert.equal(r.stats().previewPartial - t2.previewPartial, 0);
  assert.equal(s.pages[0].svg, chuan.render(d.xml, { ...S, color: "#1d4ed8" }).pages[0].svg);
});

test("gõ nhanh 1 → 2 (phím 12): bản xem trước cuối là bản nháp MỚI NHẤT, dù lượt giữa bị bỏ qua", () => {
  r.clearPreview();
  let d = createDraft(MP);
  xem(d, null);
  const goc = d;
  const mot = dat(P(21, 6), 1, 1); // E4 dây 1 → F4: dấu bình xuất hiện ở Sol trưởng → vẽ đầy đủ
  d = applyToDraft(goc, mot);
  xem(d, mot);
  // "12": quay về nháp trước chữ số đầu rồi đặt phím 12 (E5) — không dấu hoá.
  const muoiHai = dat(P(21, 6), 1, 12);
  d = applyToDraft(goc, muoiHai);
  const x = xem(d, muoiHai);
  assert.equal(x.plan.kind, "full", "so với bản đang xem (F4♮) thì dấu hoá biến mất → đầy đủ");
  giongChuan(d.xml, x.score);
  // Gõ tiếp 1 → 2 → 3 … trên dây 3 mà lượt vẽ chỉ chạy ở cuối: vẫn đúng bản mới nhất.
  const khong = [4, 5, 7, 9, 12, 14].map((f) => dat(P(23, 7), 3, f));
  for (const c of khong) d = applyToDraft(d, c);
  const cuoi = xem(d, khong[khong.length - 1]);
  assert.equal(cuoi.plan.kind, "partial", "chỉ một nốt khác bản đang xem → vẫn ghép được");
  giongChuan(d.xml, cuoi.score);
  assert.equal(readNoteFields(d.xml, P(23, 7))!.tab!.fret, 14);
});

test("100 lệnh TAB hợp lệ qua renderer thật + hoàn tác ×100 + làm lại ×100: không trôi so với bản chuẩn", () => {
  r.clearPreview();
  let d = createDraft(HAI);
  assert.equal(xem(d, null).score.pages.length, 2);
  const not = [1, 3, 5, 11, 13, 21, 23].flatMap((m) => (m === 1 ? [7, 8, 9, 10] : [6, 7, 8, 9]).map((c) => [m, c] as const));
  let rng = 7;
  const rand = (n: number) => ((rng = (rng * 1103515245 + 12345) % 2147483648), (rng >>> 16) % n);
  let partial = 0, full = 0, lenh = 0;
  const diemKiem = new Set([1, 10, 50, 100]);
  while (lenh < 100) {
    const [m, c] = not[rand(not.length)];
    const f = readNoteFields(d.xml, P(m, c))!;
    const cmd = rand(4) === 0
      ? dat(P(m, c), f.tab!.string === 1 ? 2 : f.tab!.string - 1, f.tab!.fret + (f.tab!.string === 1 ? 5 : 0))
      : dat(P(m, c), f.tab!.string, rand(17));
    let sau: DraftState;
    try {
      sau = applyToDraft(d, cmd);
    } catch {
      continue;
    }
    if (sau === d) continue;
    d = sau;
    lenh++;
    const x = xem(d, cmd);
    partial += x.partial;
    full += x.full;
    if (diemKiem.has(lenh)) giongChuan(d.xml, x.score);
  }
  const cuoi = d.xml;
  assert.ok(partial > 20 && full > 5, `phải đi cả hai đường (partial ${partial}, full ${full})`);
  let s: AnnotatedScore | null = null;
  for (let i = 0; i < 100; i++) {
    const cmd = d.commands[d.cursor - 1];
    d = undo(d);
    s = xem(d, cmd).score;
    if (i === 49) giongChuan(d.xml, s);
  }
  assert.equal(d.xml, HAI, "hoàn tác ×100 về đúng bản gốc");
  giongChuan(d.xml, s!);
  for (let i = 0; i < 100; i++) {
    d = redo(d);
    s = xem(d, d.commands[d.cursor - 1]).score;
    if (i === 49) giongChuan(d.xml, s);
  }
  assert.equal(d.xml, cuoi, "làm lại ×100 về đúng bản cuối");
  giongChuan(d.xml, s!);
});

test("XUẤT FILE luôn khắc chuẩn trên bộ khắc riêng — không đọc bản xem trước", async () => {
  r.clearPreview();
  let d = createDraft(MP);
  xem(d, null);
  for (const f of [4, 5, 7, 9, 12]) {
    const cmd = dat(P(33, 7), 3, f);
    d = applyToDraft(d, cmd);
    xem(d, cmd);
  }
  const canon = await renderCanonicalForExport(d.xml, S);
  const c = chuan.render(d.xml, S);
  assert.deepEqual(canon.pages.map((p) => p.svg), c.pages.map((p) => p.svg));
  assert.equal(exportScoreSVG(canon), exportScoreSVG(c));
  const a = await exportSVGPages(canon);
  const b = await exportSVGPages(c);
  assert.deepEqual(new Uint8Array(await a.blob.arrayBuffer()), new Uint8Array(await b.blob.arrayBuffer()));
  // Bộ khắc xuất đã huỷ; bộ xem trước không bị động tới.
  assert.equal(r.previewXml(), d.xml);
});

test("LƯU không phụ thuộc bản xem trước: xoá ảnh chụp, lưu vẫn đúng từng byte nháp", async () => {
  let d = createDraft(MP);
  const cmd = dat(P(35, 7), 3, 4);
  d = applyToDraft(d, cmd);
  r.clearPreview();
  const calls: SaveRequest[] = [];
  const lib = {
    async save(req: SaveRequest): Promise<SaveResult> {
      calls.push(req);
      return { scoreId: "s1", versionId: "v2", versionNumber: 2, createdScore: false } as SaveResult;
    },
  };
  const out = await saveDraftAsVersion({
    library: lib as never,
    scoreId: "s1",
    sourceFilename: "a.musicxml",
    original: MP,
    draft: d.xml,
    changeNote: "sửa phím",
    pageCount: null,
    render: (xml) => chuan.render(xml, S),
  });
  assert.ok(out.result, JSON.stringify(out.report));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].xml, d.xml);
  assert.equal(r.previewXml(), null, "lưu không vẽ gì vào bản xem trước");
});
