import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { giuLuot, traLuot } from "../../src/nhipphach/motLuot.ts";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeSettings,
  sanitizeErrorMessage,
  errorCodeOf,
  meterSummaryOf,
  groupingSnapshotOf,
  jobStatusOf,
  buildSingleJob,
  buildBatchJob,
  applyJobSettings,
  collectItemMeta,
  MAX_ERROR_LENGTH,
} from "../../src/nhipphach/jobs.ts";
import type { JobRecord } from "../../src/nhipphach/jobs.ts";
import {
  SupabaseJobRepository,
  MAX_RECENT,
} from "../../src/nhipphach/jobRepository.ts";
import { runBatch } from "../../src/nhipphach/batch.ts";
import type {
  BatchFile,
  BatchItem,
  BatchProcessor,
} from "../../src/nhipphach/batch.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type {
  AnnotatedScore,
  ScoreSettings,
} from "../../src/musicxml-beats/renderer/types.ts";
import { SupabasePresetRepository } from "../../src/nhipphach/supabasePresetRepository.ts";
import { presetFromSettings } from "../../src/nhipphach/presets.ts";

const API = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const PW = "MatKhau123!";
const fx = (dir: string, n: string) =>
  readFileSync(new URL(`../${dir}/fixtures/${n}.musicxml`, import.meta.url), "utf8");
const settings = (over: Partial<ScoreSettings> = {}): ScoreSettings => ({
  ...DEFAULT_SCORE_SETTINGS,
  ...over,
});

const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
const render = (name: string, s = settings(), dir = "musicxml-irregular") =>
  renderer.render(fx(dir, name), s);

// -- 1. Anh chup thiet lap: dung thu duoc phep luu ---------------------------

test("ảnh chụp thiết lập KHÔNG mang theo cách chia nhịp lẻ", () => {
  const snap = sanitizeSettings(
    settings({
      grouping: { byMeter: { "7/8": [3, 2, 2] }, byMeasure: { "5": [2, 3] } },
      compoundCountingMode: "compound",
      countingLevel: "eighths",
      orientation: "landscape",
    }),
    "svg"
  );
  assert.equal("grouping" in snap, false);
  assert.equal(JSON.stringify(snap).includes("7/8"), false);
  assert.deepEqual(Object.keys(snap).sort(), [
    "color",
    "compoundCountingMode",
    "countingLevel",
    "distance",
    "exportFormat",
    "orientation",
    "pageSize",
    "showBeats",
    "sizePt",
  ]);
  assert.equal(snap.exportFormat, "svg");
  assert.equal(snap.orientation, "landscape");
});

test("dùng lại thiết lập KHÔNG áp cách chia cũ lên bản nhạc đang mở", () => {
  const cu = settings({
    grouping: { byMeter: { "7/8": [3, 2, 2] } },
    countingLevel: "eighths",
    color: "#123456",
  });
  const snap = sanitizeSettings(cu, "pdf");
  const dangMo = settings({ grouping: { byMeter: { "5/8": [2, 3] } } });
  const sau = applyJobSettings(snap, dangMo);
  assert.equal(sau.countingLevel, "eighths");
  assert.equal(sau.color, "#123456");
  // Cách chia của bản nhạc đang mở giữ nguyên, KHÔNG bị job cũ ghi đè.
  assert.deepEqual(sau.grouping, dangMo.grouping);
  const trong = applyJobSettings(snap, settings());
  assert.deepEqual(trong.grouping, DEFAULT_SCORE_SETTINGS.grouping);
});

// -- 2. Got loi --------------------------------------------------------------

test("thông điệp lỗi bị gột sạch mảnh bản nhạc và cắt đúng trần", () => {
  assert.equal(
    sanitizeErrorMessage("unclosed xml tag(s): <note><pitch>C</pitch>"),
    "unclosed xml tag(s):"
  );
  assert.equal(
    sanitizeErrorMessage("lỗi data:application/pdf;base64,JVBERi0x rồi"),
    "lỗi rồi"
  );
  assert.equal(sanitizeErrorMessage("xem blob:http://x/9f-2 nhé"), "xem nhé");
  // Chữ NẰM GIỮA hai thẻ cũng là nội dung bản nhạc: lời hát, tên nốt.
  assert.equal(
    sanitizeErrorMessage("INVALID_XML: <lyric><text>Quê hương</text></lyric>"),
    "INVALID_XML:"
  );
  assert.equal(sanitizeErrorMessage(new Error("  a   b  ")), "a b");
  assert.equal(sanitizeErrorMessage(null), null);
  assert.equal(sanitizeErrorMessage("<a>"), null);
  const dai = sanitizeErrorMessage("x".repeat(5000))!;
  assert.equal(dai.length, MAX_ERROR_LENGTH);
  assert.equal(MAX_ERROR_LENGTH <= 1000, true);
});

test("mã lỗi nhóm được, suy từ chuỗi ĐÃ gột", () => {
  assert.equal(errorCodeOf(new Error("unclosed xml tag(s): <note>")), "XML_INVALID");
  assert.equal(errorCodeOf("Nhịp 10/8 chưa hỗ trợ"), "METER_UNSUPPORTED");
  assert.equal(errorCodeOf("network timeout"), "NETWORK");
  assert.equal(errorCodeOf("???"), "UNKNOWN");
});

// -- 3. So lieu nhac ly la DEM, khong phai noi dung --------------------------

test("meterSummary chỉ đếm mã nhịp; grouping snapshot là sự kiện quá khứ", () => {
  const s = settings({
    compoundCountingMode: "compound",
    grouping: { byMeter: { "7/8": [3, 2, 2] } },
  });
  const score = render("seven-plain", s);
  assert.deepEqual(meterSummaryOf(score), { "7/8": 1 });
  assert.deepEqual(groupingSnapshotOf(score), { "7/8": [3, 2, 2] });
  const nam = render("five-2-3", settings({ compoundCountingMode: "compound" }));
  assert.deepEqual(meterSummaryOf(nam), { "5/8": 1 });
  // 5/8 khai additive ngay trong MusicXML nên snapshot ghi lại đúng cái đã dùng.
  assert.deepEqual(groupingSnapshotOf(nam), { "5/8": [2, 3] });
  // Nhịp đơn thì không có cách chia nào để chụp.
  assert.equal(
    groupingSnapshotOf(render("sustained", settings(), "musicxml-compound")),
    null
  );
});

// -- 4. Dung job -------------------------------------------------------------

const jobDon = (over: Partial<Parameters<typeof buildSingleJob>[0]> = {}) =>
  buildSingleJob({
    sourceName: "bay-tam.musicxml",
    score: render(
      "seven-plain",
      settings({
        compoundCountingMode: "compound",
        grouping: { byMeter: { "7/8": [3, 2, 2] } },
      })
    ),
    settings: settings({ compoundCountingMode: "compound" }),
    format: "pdf",
    presetId: null,
    presetName: null,
    startedAt: 1_000,
    finishedAt: 3_500,
    ...over,
  });

test("một bài thành một job một item, đủ số liệu, không có nội dung", () => {
  const job = jobDon();
  assert.equal(job.mode, "single");
  assert.equal(job.totalItems, 1);
  assert.equal(job.doneItems, 1);
  assert.equal(job.status, "completed");
  assert.equal(job.durationMs, 2500);
  assert.equal(job.items[0].outputName, "bay-tam.pdf");
  assert.equal(job.items[0].status, "done");
  assert.deepEqual(job.items[0].meterSummary, { "7/8": 1 });
  assert.deepEqual(job.items[0].groupingSnapshot, { "7/8": [3, 2, 2] });
  assert.equal(job.items[0].pageCount! >= 1, true);
  assert.equal(job.items[0].annotationCount! > 0, true);
});

test("trạng thái mẻ: xong hết / có lỗi / hỏng hoàn toàn", () => {
  assert.equal(jobStatusOf(5, 0, 0), "completed");
  assert.equal(jobStatusOf(4, 1, 0), "completed_with_errors");
  assert.equal(jobStatusOf(4, 0, 1), "completed_with_errors");
  assert.equal(jobStatusOf(0, 3, 0), "failed");
  assert.equal(jobStatusOf(0, 0, 2), "failed");
  assert.equal(jobStatusOf(0, 0, 0), "completed");
});

const itemGia = (over: Partial<BatchItem>): BatchItem => ({
  id: "item-1",
  fileName: "a.musicxml",
  outputName: "a.pdf",
  status: "done",
  ...over,
});

const gia = (): BatchProcessor => ({
  async render() {
    return {
      beatMap: { measures: [] },
      pages: [{}],
      anchors: [],
    } as unknown as AnnotatedScore;
  },
  async toBlob() {
    return new Blob(["x"]);
  },
});

test("mẻ 4 xong và 1 lỗi: item lỗi VẪN được ghi, không bị bỏ qua", () => {
  const items: BatchItem[] = [1, 2, 3, 4].map((n) =>
    itemGia({ id: `item-${n}`, fileName: `b${n}.musicxml`, outputName: `b${n}.pdf` })
  );
  items.push(
    itemGia({
      id: "item-5",
      fileName: "hong.musicxml",
      outputName: "hong.pdf",
      status: "error",
      error: "unclosed xml tag(s): <note>hỏng</note>",
    })
  );
  const job = buildBatchJob({
    items,
    meta: {},
    settings: settings(),
    format: "pdf",
    presetId: null,
    presetName: null,
    startedAt: 0,
    finishedAt: 1_000,
  });
  assert.equal(job.mode, "batch");
  assert.equal(job.totalItems, 5);
  assert.equal(job.doneItems, 4);
  assert.equal(job.errorItems, 1);
  assert.equal(job.status, "completed_with_errors");
  assert.equal(job.items.length, 5);
  const loi = job.items[4];
  assert.equal(loi.status, "error");
  assert.equal(loi.errorCode, "XML_INVALID");
  assert.equal(loi.errorMessage, "unclosed xml tag(s):");
  assert.equal(loi.outputName, null, "bài lỗi không có file ra");
});

test("bài cần chọn cách chia được ghi riêng, không đội lốt lỗi", () => {
  const job = buildBatchJob({
    items: [
      itemGia({
        id: "item-1",
        status: "needs-grouping",
        needs: [{ meter: "7/8", options: [] }],
      }),
    ],
    meta: {},
    settings: settings(),
    format: "pdf",
    presetId: null,
    presetName: null,
    startedAt: 0,
    finishedAt: 10,
  });
  assert.equal(job.items[0].status, "needs_grouping");
  assert.equal(job.needsGroupingItems, 1);
  assert.equal(job.errorItems, 0);
  assert.equal(job.status, "failed");
});

test("trùng tên file: lịch sử giữ đúng tên ra đã khử trùng", async () => {
  const files: BatchFile[] = ["bai.musicxml", "bai.musicxml", "bai.xml"].map(
    (name) => ({ name, xml: fx("musicxml-irregular", "five-2-3") })
  );
  const items = await runBatch(files, gia(), { settings: settings(), format: "pdf" });
  const job = buildBatchJob({
    items,
    meta: {},
    settings: settings(),
    format: "pdf",
    presetId: null,
    presetName: null,
    startedAt: 0,
    finishedAt: 5,
  });
  assert.deepEqual(job.items.map((i) => i.sourceName), [
    "bai.musicxml",
    "bai.musicxml",
    "bai.xml",
  ]);
  assert.deepEqual(job.items.map((i) => i.outputName), [
    "bai.pdf",
    "bai-2.pdf",
    "bai-3.pdf",
  ]);
});

// -- 5. So lieu phai gan DUNG bai khi chay song song --------------------------

test("chạy song song: số liệu vẫn về đúng bài, không lệch theo lượt gọi", async () => {
  // Bài chẵn cố tình chậm hơn để thứ tự HOÀN THÀNH khác thứ tự đầu vào.
  // Đây chính là chỗ từng sai: đếm lượt gọi thì bài 3 xong trước bài 2 sẽ
  // nhận số liệu của nhau.
  const nen: BatchProcessor = {
    async render(xml) {
      const n = Number(xml);
      await new Promise((r) => setTimeout(r, n % 2 === 0 ? 40 : 1));
      return {
        beatMap: { measures: [] },
        pages: new Array(n).fill({}),
        anchors: new Array(n * 10).fill({}),
      } as unknown as AnnotatedScore;
    },
    async toBlob() {
      return new Blob(["x"]);
    },
  };
  const { proc, meta } = collectItemMeta(nen);
  const files: BatchFile[] = [1, 2, 3, 4, 5, 6].map((n) => ({
    name: `b${n}.musicxml`,
    xml: String(n),
  }));
  const items = await runBatch(files, proc, {
    settings: settings(),
    format: "pdf",
    concurrency: 2,
  });
  // Số trang của bài thứ n đúng bằng n — lệch một ô là gắn nhầm bài.
  assert.deepEqual(
    Object.fromEntries(Object.entries(meta).map(([id, m]) => [id, m.pageCount])),
    { "item-1": 1, "item-2": 2, "item-3": 3, "item-4": 4, "item-5": 5, "item-6": 6 }
  );
  const job = buildBatchJob({
    items,
    meta,
    settings: settings(),
    format: "pdf",
    presetId: null,
    presetName: null,
    startedAt: 0,
    finishedAt: 1,
  });
  assert.deepEqual(
    job.items.map((i) => [i.sourceName, i.pageCount, i.annotationCount]),
    [
      ["b1.musicxml", 1, 10],
      ["b2.musicxml", 2, 20],
      ["b3.musicxml", 3, 30],
      ["b4.musicxml", 4, 40],
      ["b5.musicxml", 5, 50],
      ["b6.musicxml", 6, 60],
    ]
  );
});

test("trang dùng chung bộ thu số liệu, không tự đếm lượt gọi", () => {
  const me = khongChuThich.slice(
    khongChuThich.indexOf("async function runBatchNow"),
    khongChuThich.indexOf("async function downloadZip")
  );
  assert.match(me, /collectItemMeta\(batchProcessor\)/);
  assert.equal(/\+\+/.test(me), false, "không được có bộ đếm tay trong mẻ");
});

// -- 6. Kho lich su tren Supabase LOCAL, JWT that ----------------------------

async function device(email: string): Promise<{ client: SupabaseClient; uid: string }> {
  const client = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PW,
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, uid: data.user!.id };
}
let devA: { client: SupabaseClient; uid: string };
let devB: { client: SupabaseClient; uid: string };
let A: SupabaseJobRepository, B: SupabaseJobRepository, C: SupabaseJobRepository;
let anon: SupabaseClient;
before(async () => {
  devA = await device("teacher-a@test.local");
  devB = await device("teacher-b@test.local");
  const devC = await device("student-c@test.local");
  A = new SupabaseJobRepository(devA.client, devA.uid);
  B = new SupabaseJobRepository(devB.client, devB.uid);
  C = new SupabaseJobRepository(devC.client, devC.uid);
  anon = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});
const wipe = async () => {
  await A.clearHistory();
  await B.clearHistory();
};
after(async () => {
  await wipe();
});

let dem = 0;
const job = (over: Partial<JobRecord> = {}): JobRecord => ({
  ...jobDon(),
  id: `job-test-${++dem}-${Math.random().toString(36).slice(2, 8)}`,
  ...over,
});

test("A ghi được job của mình rồi đọc lại đủ chi tiết", async () => {
  await wipe();
  const j = job({ presetName: "Phách lớn" });
  await A.create(j);
  const ds = await A.listRecent();
  assert.equal(ds.length, 1);
  assert.equal(ds[0].id, j.id);
  assert.equal(ds[0].presetName, "Phách lớn");
  assert.equal(ds[0].totalItems, 1);
  assert.equal(ds[0].countingMode, "beats/compound");
  assert.equal(ds[0].settingsSnapshot.orientation, "portrait");
  const ct = await A.getJob(j.id);
  assert.equal(ct!.items.length, 1);
  assert.equal(ct!.items[0].sourceName, "bay-tam.musicxml");
  assert.deepEqual(ct!.items[0].groupingSnapshot, { "7/8": [3, 2, 2] });
});

test("B KHÔNG thấy lịch sử của A, kể cả khi biết đúng id", async () => {
  await wipe();
  const j = job();
  await A.create(j);
  assert.deepEqual(await B.listRecent(), []);
  assert.equal(await B.getJob(j.id), null);
  // Đọc thẳng bằng client của B, không qua repository: DB vẫn chặn.
  const tho = await devB.client.from("nhipphach_jobs").select("*").eq("id", j.id);
  assert.deepEqual(tho.data, []);
  const itemTho = await devB.client
    .from("nhipphach_job_items")
    .select("*")
    .eq("job_id", j.id);
  assert.deepEqual(itemTho.data, []);
});

test("B không xoá được job của A", async () => {
  await wipe();
  const j = job();
  await A.create(j);
  await devB.client.from("nhipphach_jobs").delete().eq("id", j.id);
  assert.equal((await A.getJob(j.id)) !== null, true, "job của A vẫn còn nguyên");
});

test("B không ghi được job MANG user_id của A", async () => {
  await wipe();
  // Repository của B nhưng cầm uid của A: function tự lấy auth.uid() nên
  // không có đường nào lái được. Ghi thành công thì là ghi vào lịch sử của
  // CHÍNH B, còn A vẫn trắng.
  const maoDanh = new SupabaseJobRepository(devB.client, devA.uid);
  const j = job();
  await maoDanh.create(j);
  assert.deepEqual(await A.listRecent(), [], "không dòng nào rơi sang A");
  assert.deepEqual((await B.listRecent()).map((x) => x.id), [j.id]);
});

test("payload cố nhét user_id của A cũng bị function bỏ qua", async () => {
  await wipe();
  const j = job();
  const { error } = await devB.client.rpc("nhipphach_create_history", {
    job_json: {
      id: j.id,
      user_id: devA.uid, // trường thừa, function KHÔNG đọc tới
      mode: j.mode,
      export_format: j.exportFormat,
      settings_snapshot: j.settingsSnapshot,
      counting_mode: j.countingMode,
      page_size: "A4",
      orientation: j.orientation,
      total_items: 1,
      done_items: 1,
      error_items: 0,
      needs_grouping_items: 0,
      status: j.status,
      started_at: j.startedAt,
      finished_at: j.finishedAt,
      duration_ms: j.durationMs,
    },
    items_json: [
      { item_id: "item-1", source_name: "a.musicxml", status: "done", user_id: devA.uid },
    ],
  });
  assert.equal(error, null);
  assert.deepEqual(await A.listRecent(), [], "A vẫn không có gì");
  const cuaB = await devB.client
    .from("nhipphach_job_items")
    .select("user_id")
    .eq("job_id", j.id);
  assert.deepEqual(cuaB.data!.map((r) => r.user_id), [devB.uid]);
});

test("học viên C không đọc và không ghi được lịch sử", async () => {
  await wipe();
  await assert.rejects(() => C.create(job()), /policy|denied|violates/i);
  assert.deepEqual(await C.listRecent(), []);
});

test("khách vãng lai không chạm được vào hai bảng lịch sử", async () => {
  await wipe();
  await A.create(job());
  for (const bang of ["nhipphach_jobs", "nhipphach_job_items"]) {
    const doc = await anon.from(bang).select("*");
    assert.equal(
      doc.data === null || doc.data.length === 0,
      true,
      `${bang}: anon đọc được`
    );
    const ghi = await anon.from(bang).insert({ id: "x", user_id: devA.uid });
    assert.ok(ghi.error, `${bang}: anon ghi được`);
  }
});

test("xoá job kéo theo item, không để lại rác", async () => {
  await wipe();
  const j = job();
  await A.create(j);
  const truoc = await devA.client
    .from("nhipphach_job_items")
    .select("item_id")
    .eq("job_id", j.id);
  assert.equal(truoc.data!.length, 1);
  await A.remove(j.id);
  assert.equal(await A.getJob(j.id), null);
  const sau = await devA.client
    .from("nhipphach_job_items")
    .select("item_id")
    .eq("job_id", j.id);
  assert.deepEqual(sau.data, []);
});

test("mới nhất lên đầu và tôn trọng giới hạn", async () => {
  await wipe();
  const ids: string[] = [];
  for (let i = 0; i < 7; i++) {
    const j = job();
    ids.push(j.id);
    await A.create(j);
    await new Promise((r) => setTimeout(r, 12));
  }
  const nam = await A.listRecent(5);
  assert.equal(nam.length, 5);
  assert.deepEqual(nam.map((x) => x.id), ids.slice(2).reverse());
  assert.equal((await A.listRecent(1)).length, 1);
  assert.equal((await A.listRecent(1000)).length, 7, `trần cứng ${MAX_RECENT}`);
});

test("preset bị xoá rồi, ảnh chụp thiết lập vẫn dùng lại được", async () => {
  await wipe();
  const presets = new SupabasePresetRepository(devA.client, devA.uid);
  const p = presetFromSettings(
    "Sắp xoá",
    settings({ countingLevel: "eighths", color: "#0a0a0a" })
  );
  await presets.save(p);
  const j = job({
    presetId: p.id,
    presetName: p.name,
    settingsSnapshot: sanitizeSettings(
      settings({ countingLevel: "eighths", color: "#0a0a0a" }),
      "pdf"
    ),
  });
  await A.create(j);
  await presets.remove(p.id);
  const doc = await A.getJob(j.id);
  assert.equal(doc!.presetName, "Sắp xoá", "tên preset là chữ chết, không phải khoá ngoại");
  const lai = applyJobSettings(doc!.settingsSnapshot, settings());
  assert.equal(lai.countingLevel, "eighths");
  assert.equal(lai.color, "#0a0a0a");
});

// -- 7. Rieng tu: doc thang DB, khong duoc co noi dung ban nhac --------------

test("hàng trong DB không chứa MusicXML, SVG, PDF, base64 hay blob URL", async () => {
  await wipe();
  const s = settings({
    compoundCountingMode: "compound",
    grouping: { byMeter: { "7/8": [3, 2, 2] } },
  });
  await A.create(jobDon({ settings: s }));
  await A.create(
    buildBatchJob({
      items: [
        itemGia({ id: "item-1" }),
        itemGia({
          id: "item-2",
          fileName: "hong.musicxml",
          status: "error",
          // Lỗi thật mang theo một mẩu bản nhạc, chính thứ phải bị gột.
          error: `unclosed xml tag(s): ${fx("musicxml-irregular", "five-2-3").slice(0, 400)}`,
        }),
      ],
      meta: {},
      settings: s,
      format: "pdf",
      presetId: null,
      presetName: null,
      startedAt: 0,
      finishedAt: 9,
    })
  );
  const jobs = await devA.client.from("nhipphach_jobs").select("*");
  const items = await devA.client.from("nhipphach_job_items").select("*");
  const kho = JSON.stringify(jobs.data) + JSON.stringify(items.data);
  for (const cam of [
    /<score-partwise/i,
    /<note>/i,
    /<measure/i,
    /<time>/i,
    /<svg/i,
    /%PDF/,
    /PK/,
    /data:[a-z]+\//i,
    /blob:/i,
    /base64/i,
    /<\?xml/i,
  ])
    assert.equal(cam.test(kho), false, `DB chứa ${cam}`);
  // Nhưng metadata thì vẫn đủ để hiển thị.
  assert.match(kho, /bay-tam\.musicxml/);
  assert.match(kho, /"7\/8"/);
  assert.match(kho, /unclosed xml tag\(s\)/);
  for (const it of items.data!)
    assert.equal(
      it.error_message === null || it.error_message.length <= MAX_ERROR_LENGTH,
      true
    );
});

test("DB tự chặn thông điệp lỗi quá dài, không chỉ trông cậy vào client", async () => {
  await wipe();
  const r = await devA.client.from("nhipphach_jobs").insert({
    id: "job-dai",
    user_id: devA.uid,
    mode: "single",
    export_format: "pdf",
    settings_snapshot: {},
    orientation: "portrait",
    total_items: 1,
    status: "completed",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: 1,
  });
  assert.equal(r.error, null);
  const it = await devA.client.from("nhipphach_job_items").insert({
    user_id: devA.uid,
    job_id: "job-dai",
    item_id: "item-1",
    source_name: "a.musicxml",
    status: "error",
    error_message: "x".repeat(MAX_ERROR_LENGTH + 1),
  });
  assert.ok(it.error, "DB phải từ chối thông điệp vượt trần");
});

// -- 8. Lich su la viec phu, ma nguon trang phai bao dam dieu do -------------

const trang = readFileSync(
  new URL("../../src/pages/MusicXmlBeatsPage.tsx", import.meta.url),
  "utf8"
);
const khongChuThich = trang.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

test("mọi truy vấn lịch sử đều ghim user_id, dù DB đã là hàng rào thật", () => {
  // Bỏ lọc này ở client KHÔNG làm lộ dữ liệu — RLS mới là hàng rào, và bài kiểm
  // "B KHÔNG thấy lịch sử của A" chứng minh điều đó bằng client thô của B.
  // Nhưng kỷ luật vẫn phải khoá lại: một ngày nào đó policy sai thì client
  // không được là chỗ hở thứ hai.
  const code = readFileSync(
    new URL("../../src/nhipphach/jobRepository.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const chains = code
    .split(/\.from\((?:JOBS|ITEMS)\)/)
    .slice(1)
    .map((c) => c.split(";")[0]);
  // Đường GHI đã chuyển sang RPC một-giao-dịch nên không còn insert thẳng ở
  // đây; những gì còn lại là đọc và xoá, và tất cả đều phải ghim user_id.
  assert.ok(chains.length >= 5, `tìm thấy ${chains.length} truy vấn`);
  assert.equal(
    chains.some((c) => /\.insert\(/.test(c)),
    false,
    "không còn insert thẳng vào bảng"
  );
  for (const c of chains)
    assert.match(
      c,
      /\.eq\("user_id", this\.userId\)/,
      `truy vấn thiếu user_id: ${c.slice(0, 80)}`
    );
});

test("trang không gọi thẳng Supabase; mọi thứ đi qua repository", () => {
  assert.equal(/from ["'][^"']*\/supabase["']/.test(khongChuThich), false);
  assert.equal(/\.from\(["']nhipphach_/.test(khongChuThich), false);
  assert.match(khongChuThich, /jobsRepo\.current/);
});

test("ghi lịch sử luôn nằm trong try/catch riêng và không đụng lỗi xuất", () => {
  const than = khongChuThich.slice(khongChuThich.indexOf("async function ghiLichSu"));
  const body = than.slice(0, than.indexOf("\n  }\n") + 4);
  assert.match(body, /try \{/);
  assert.match(body, /\} catch \{/);
  assert.match(body, /setHistoryNote\(/);
  assert.equal(/setError\(/.test(body), false, "lỗi lịch sử KHÔNG được set lỗi xuất");
  // Gọi kiểu bắn-và-quên, không await trong đường xuất file.
  assert.equal((khongChuThich.match(/void ghiLichSu\(/g) || []).length, 2);
  assert.equal(/await ghiLichSu\(/.test(khongChuThich), false);
});

test("chỉ xuất thật mới sinh lịch sử, không phải lúc mở file hay đổi màu", () => {
  assert.match(khongChuThich, /if \(daXuat\)\s*\n?\s*void ghiLichSu/);
  const doc = khongChuThich.slice(
    khongChuThich.indexOf("async function readFile"),
    khongChuThich.indexOf("async function exportPrint")
  );
  assert.equal(/ghiLichSu/.test(doc), false, "đọc file/mẫu không được ghi lịch sử");
  const doiMau = khongChuThich.slice(
    khongChuThich.indexOf("const update = ("),
    khongChuThich.indexOf("async function readFile")
  );
  assert.equal(/ghiLichSu/.test(doiMau), false, "đổi thiết lập không được ghi lịch sử");
});

test("mẻ ghi lịch sử ĐÚNG MỘT LẦN, sau khi mẻ xong", () => {
  const me = khongChuThich.slice(
    khongChuThich.indexOf("async function runBatchNow"),
    khongChuThich.indexOf("async function downloadZip")
  );
  assert.equal((me.match(/ghiLichSu\(/g) || []).length, 1);
  assert.equal(/in_progress|"processing"/.test(me), false);
  // Ghi sau khối chạy mẻ, không nằm trong onUpdate.
  assert.equal(me.indexOf("ghiLichSu(") > me.indexOf("} finally {"), true);
});

// -- 9. Ghi lich su la MOT giao dich ----------------------------------------

const HISTORY_RPC = "nhipphach_create_history";
/** Payload thô đúng hình dạng function nhận, để dựng ca hỏng có chủ đích. */
const payload = (j: JobRecord) => ({
  id: j.id,
  mode: j.mode,
  export_format: j.exportFormat,
  preset_id: j.presetId,
  preset_name: j.presetName,
  settings_snapshot: j.settingsSnapshot,
  counting_mode: j.countingMode,
  page_size: j.pageSize,
  orientation: j.orientation,
  total_items: j.totalItems,
  done_items: j.doneItems,
  error_items: j.errorItems,
  needs_grouping_items: j.needsGroupingItems,
  status: j.status,
  started_at: j.startedAt,
  finished_at: j.finishedAt,
  duration_ms: j.durationMs,
});
const itemRows = (n: number): Record<string, unknown>[] =>
  Array.from({ length: n }, (_, i) => ({
    item_id: `item-${i + 1}`,
    source_name: `bai-${i + 1}.musicxml`,
    output_name: `bai-${i + 1}.pdf`,
    status: "done",
    error_code: null,
    error_message: null,
    meter_summary: { "4/4": 8 },
    grouping_snapshot: null,
    page_count: 2,
    annotation_count: 32,
    duration_ms: 40,
  }));
const demDB = async () => ({
  jobs: (await devA.client.from("nhipphach_jobs").select("id")).data!.length,
  items: (await devA.client.from("nhipphach_job_items").select("item_id")).data!.length,
});

test("function ghi lịch sử là SECURITY INVOKER, không phải cửa sau DEFINER", () => {
  const sql = readFileSync(
    new URL("../../db/nhipphach_jobs_setup.sql", import.meta.url),
    "utf8"
  );
  const than = sql.slice(sql.indexOf("create or replace function public." + HISTORY_RPC));
  assert.match(than, /security invoker/);
  assert.equal(/security definer/i.test(than), false, "KHÔNG được dùng SECURITY DEFINER");
  // user_id lấy từ auth.uid(), không đọc từ payload.
  assert.match(than, /uid\s+uuid\s*:=\s*auth\.uid\(\)/);
  assert.equal(/job_json\s*->>\s*'user_id'/.test(than), false);
  assert.match(than, /revoke all on function public\.nhipphach_create_history\(jsonb, jsonb\) from anon/);
});

test("item thứ N vi phạm CHECK: cả job lẫn item cùng biến mất", async () => {
  await wipe();
  const j = job();
  const items = itemRows(5);
  // Bài thứ 4 mang thông điệp lỗi vượt trần 500 ký tự mà DB đang chặn.
  items[3] = {
    ...items[3],
    status: "error",
    error_code: "XML_INVALID",
    error_message: "x".repeat(MAX_ERROR_LENGTH + 1),
  };
  const { error } = await devA.client.rpc(HISTORY_RPC, {
    job_json: payload(j),
    items_json: items,
  });
  assert.ok(error, "RPC phải thất bại");
  assert.deepEqual(await demDB(), { jobs: 0, items: 0 }, "không để lại job rỗng");

  // Bài thứ N mang trạng thái ngoài danh sách cho phép: cũng phải cuốn sạch.
  const items2 = itemRows(5);
  items2[4] = { ...items2[4], status: "dang_lam" };
  const hai = await devA.client.rpc(HISTORY_RPC, {
    job_json: payload(job()),
    items_json: items2,
  });
  assert.ok(hai.error);
  assert.deepEqual(await demDB(), { jobs: 0, items: 0 });
});

test("payload hợp lệ ngay sau lần hỏng: đúng 1 job và N item", async () => {
  await wipe();
  const hong = await devA.client.rpc(HISTORY_RPC, {
    job_json: payload(job()),
    items_json: [{ item_id: "item-1", source_name: "a.musicxml", status: "sai_be_bet" }],
  });
  assert.ok(hong.error);
  assert.deepEqual(await demDB(), { jobs: 0, items: 0 });

  const j = job({ totalItems: 6, doneItems: 6 });
  const { error } = await devA.client.rpc(HISTORY_RPC, {
    job_json: payload(j),
    items_json: itemRows(6),
  });
  assert.equal(error, null);
  assert.deepEqual(await demDB(), { jobs: 1, items: 6 });
  const ct = await A.getJob(j.id);
  assert.equal(ct!.items.length, 6);
  assert.deepEqual(ct!.items.map((i) => i.itemId), [
    "item-1",
    "item-2",
    "item-3",
    "item-4",
    "item-5",
    "item-6",
  ]);
  assert.deepEqual(ct!.items[0].meterSummary, { "4/4": 8 });
  assert.equal(ct!.items[0].groupingSnapshot, null, "JSON null thành SQL NULL");
});

test("job trùng id không sinh bản sao và không đụng tới bản cũ", async () => {
  await wipe();
  const j = job({ totalItems: 2, doneItems: 2 });
  await devA.client.rpc(HISTORY_RPC, { job_json: payload(j), items_json: itemRows(2) });
  const lai = await devA.client.rpc(HISTORY_RPC, {
    job_json: payload(j),
    items_json: itemRows(3),
  });
  assert.ok(lai.error, "khoá chính ghép phải chặn");
  assert.deepEqual(await demDB(), { jobs: 1, items: 2 });
});

test("RPC lịch sử: A ghi được, C bị từ chối, khách vãng lai không gọi nổi", async () => {
  await wipe();
  const cuaA = await devA.client.rpc(HISTORY_RPC, {
    job_json: payload(job()),
    items_json: itemRows(1),
  });
  assert.equal(cuaA.error, null, "Teacher A phải ghi được lịch sử của mình");

  const devC = await device("student-c@test.local");
  const cuaC = await devC.client.rpc(HISTORY_RPC, {
    job_json: payload(job()),
    items_json: itemRows(1),
  });
  assert.ok(cuaC.error, "học viên phải bị chặn");
  assert.match(cuaC.error!.message, /policy|denied|permission/i);

  const cuaKhach = await anon.rpc(HISTORY_RPC, {
    job_json: payload(job()),
    items_json: itemRows(1),
  });
  assert.ok(cuaKhach.error, "khách vãng lai không được cấp quyền chạy function");

  assert.deepEqual(await demDB(), { jobs: 1, items: 1 }, "chỉ job của A còn lại");
});

// -- 10. Mot cu bam, mot lan chay ------------------------------------------

/** Dựng lại đúng hình dạng đường xuất file của trang: chốt + finally. */
function nutChayLau(ms = 25) {
  const chot = { current: false };
  let batDau = 0;
  let ghiLichSu = 0;
  return {
    chot,
    soLanChay: () => batDau,
    soJobLichSu: () => ghiLichSu,
    async bam() {
      if (!giuLuot(chot)) return "bo-qua";
      batDau++;
      try {
        await new Promise((r) => setTimeout(r, ms));
        ghiLichSu++;
        return "xong";
      } finally {
        traLuot(chot);
      }
    },
  };
}

test("bấm hai lần dính nhau chỉ chạy một lần và ghi một job", async () => {
  const nut = nutChayLau();
  const ket = await Promise.all([nut.bam(), nut.bam()]);
  assert.deepEqual(ket, ["xong", "bo-qua"]);
  assert.equal(nut.soLanChay(), 1);
  assert.equal(nut.soJobLichSu(), 1);
});

test("bấm năm lần liên tiếp vẫn chỉ một lượt; xong rồi mới bấm lại được", async () => {
  const nut = nutChayLau();
  await Promise.all([nut.bam(), nut.bam(), nut.bam(), nut.bam(), nut.bam()]);
  assert.equal(nut.soLanChay(), 1);
  await nut.bam();
  assert.equal(nut.soLanChay(), 2, "hết lượt cũ thì bấm lại được");
  assert.equal(nut.chot.current, false, "chốt phải được trả");
});

test("việc đang chạy ném lỗi thì chốt vẫn được trả, không kẹt nút", async () => {
  const chot = { current: false };
  const chay = async () => {
    if (!giuLuot(chot)) return "bo-qua";
    try {
      throw new Error("xuất hỏng");
    } finally {
      traLuot(chot);
    }
  };
  await assert.rejects(chay, /xuất hỏng/);
  assert.equal(chot.current, false);
  await assert.rejects(chay, /xuất hỏng/, "vẫn vào được lần sau");
});

test("cả hai đường xuất của trang đều đi qua chốt một lượt", () => {
  for (const ten of ["async function exportPrint", "async function runBatchNow"]) {
    const than = khongChuThich.slice(khongChuThich.indexOf(ten));
    const body = than.slice(0, than.indexOf("\n  }\n") + 4);
    assert.match(body, /if \(!giuLuot\(/, `${ten} thiếu chốt`);
    assert.match(body, /finally \{[\s\S]*traLuot\(/, `${ten} không trả chốt`);
  }
  assert.match(khongChuThich, /from "\.\.\/nhipphach\/motLuot"/);
});

test("ghi lịch sử đi qua RPC một-giao-dịch, không phải hai insert rời", () => {
  const code = readFileSync(
    new URL("../../src/nhipphach/jobRepository.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const than = code.slice(code.indexOf("async create("), code.indexOf("async listRecent("));
  assert.match(than, /this\.client\.rpc\(CREATE_HISTORY/);
  assert.equal(/\.from\(/.test(than), false, "create() không được insert thẳng vào bảng");
  assert.equal(/this\.userId/.test(than), false, "user_id do máy chủ quyết, không phải client");
});
