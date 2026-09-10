/**
 * Đo chi phí ghi lịch sử. Chạy tay, KHÔNG nằm trong bộ kiểm tra tự động:
 *
 *   node --experimental-strip-types tests/nhipphach-history/perf.ts
 *
 * Cần Supabase local đang chạy và tài khoản teacher-a@test.local.
 */
import { createClient } from "@supabase/supabase-js";
import { SupabaseJobRepository } from "../../src/nhipphach/jobRepository.ts";
import { buildBatchJob } from "../../src/nhipphach/jobs.ts";
import type { BatchItem } from "../../src/nhipphach/batch.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";

const API = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const client = createClient(API, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data } = await client.auth.signInWithPassword({
  email: "teacher-a@test.local",
  password: "MatKhau123!",
});
const repo = new SupabaseJobRepository(client, data.user!.id);

const mkItems = (n: number): BatchItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `item-${i + 1}`,
    fileName: `bai-${i + 1}.musicxml`,
    outputName: `bai-${i + 1}.pdf`,
    status: "done" as const,
  }));
const mkMeta = (n: number) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `item-${i + 1}`,
      {
        meterSummary: { "7/8": 12, "4/4": 30 },
        groupingSnapshot: { "7/8": [3, 2, 2] },
        pageCount: 3,
        annotationCount: 210,
      },
    ])
  );
const mkJob = (n: number) =>
  buildBatchJob({
    items: mkItems(n),
    meta: mkMeta(n),
    settings: DEFAULT_SCORE_SETTINGS,
    format: "pdf",
    presetId: null,
    presetName: "Phách lớn",
    startedAt: Date.now() - 1000,
    finishedAt: Date.now(),
  });

// Vòng làm nóng: bỏ chi phí mở kết nối ra khỏi số đo.
await repo.create(mkJob(1));

for (const n of [10, 50]) {
  const lan: number[] = [];
  for (let k = 0; k < 7; k++) {
    const job = mkJob(n);
    const t = performance.now();
    await repo.create(job);
    lan.push(performance.now() - t);
  }
  lan.sort((a, b) => a - b);
  console.log(
    `${n} bài · ghi lịch sử: trung vị ${lan[3].toFixed(0)} ms · min ${lan[0].toFixed(
      0
    )} · max ${lan[6].toFixed(0)} ms`
  );
}
const t = performance.now();
const ds = await repo.listRecent(5);
console.log(`đọc "Gần đây" 5 job: ${(performance.now() - t).toFixed(0)} ms (${ds.length} job)`);
const t2 = performance.now();
const ct = await repo.getJob(ds[0].id);
console.log(`mở chi tiết ${ct!.items.length} item: ${(performance.now() - t2).toFixed(0)} ms`);
await repo.clearHistory();
console.log("đã dọn sạch lịch sử thử nghiệm");
