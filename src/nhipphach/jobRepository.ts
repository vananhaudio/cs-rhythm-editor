import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobRecord, JobItemRecord } from "./jobs.ts";

export interface JobSummary {
  id: string;
  mode: JobRecord["mode"];
  exportFormat: JobRecord["exportFormat"];
  presetName: string | null;
  countingMode: string;
  orientation: JobRecord["orientation"];
  totalItems: number;
  doneItems: number;
  errorItems: number;
  needsGroupingItems: number;
  status: JobRecord["status"];
  durationMs: number;
  createdAt: string;
  settingsSnapshot: JobRecord["settingsSnapshot"];
}
export interface JobDetail extends JobSummary {
  items: JobItemRecord[];
}

export interface NhipPhachJobRepository {
  create(job: JobRecord): Promise<void>;
  listRecent(limit?: number): Promise<JobSummary[]>;
  getJob(id: string): Promise<JobDetail | null>;
  remove(id: string): Promise<void>;
  clearHistory(): Promise<void>;
}

const JOBS = "nhipphach_jobs";
const ITEMS = "nhipphach_job_items";
/** Ghi lịch sử đi qua function một-giao-dịch, không phải hai insert rời. */
const CREATE_HISTORY = "nhipphach_create_history";
/** Trần cứng: màn "Gần đây" không bao giờ kéo cả kho lịch sử về. */
export const MAX_RECENT = 50;

const toSummary = (r: Record<string, unknown>): JobSummary => ({
  id: String(r.id),
  mode: r.mode as JobRecord["mode"],
  exportFormat: r.export_format as JobRecord["exportFormat"],
  presetName: (r.preset_name as string) ?? null,
  countingMode: (r.counting_mode as string) ?? "",
  orientation: r.orientation as JobRecord["orientation"],
  totalItems: Number(r.total_items),
  doneItems: Number(r.done_items),
  errorItems: Number(r.error_items),
  needsGroupingItems: Number(r.needs_grouping_items),
  status: r.status as JobRecord["status"],
  durationMs: Number(r.duration_ms),
  createdAt: String(r.created_at),
  settingsSnapshot: r.settings_snapshot as JobRecord["settingsSnapshot"],
});

export class SupabaseJobRepository implements NhipPhachJobRepository {
  private client: SupabaseClient;
  private userId: string;
  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  /**
   * Ghi cả job lẫn item trong MỘT giao dịch phía Postgres.
   *
   * Hai request riêng (insert job, rồi insert item) có một khe hở thật: mất
   * mạng hay lỗi ràng buộc ở giữa để lại một job RỖNG — thầy thấy "6 bài" mà
   * mở ra không có bài nào. Function `nhipphach_create_history` là
   * SECURITY INVOKER nên RLS vẫn chặn như thường, và nó tự lấy `user_id` từ
   * `auth.uid()` chứ không tin payload.
   */
  async create(job: JobRecord): Promise<void> {
    const { error } = await this.client.rpc(CREATE_HISTORY, {
      job_json: {
        id: job.id,
        mode: job.mode,
        export_format: job.exportFormat,
        preset_id: job.presetId,
        preset_name: job.presetName,
        settings_snapshot: job.settingsSnapshot,
        counting_mode: job.countingMode,
        page_size: job.pageSize,
        orientation: job.orientation,
        total_items: job.totalItems,
        done_items: job.doneItems,
        error_items: job.errorItems,
        needs_grouping_items: job.needsGroupingItems,
        status: job.status,
        started_at: job.startedAt,
        finished_at: job.finishedAt,
        duration_ms: job.durationMs,
      },
      items_json: job.items.map((i) => ({
        item_id: i.itemId,
        source_name: i.sourceName,
        output_name: i.outputName,
        status: i.status,
        error_code: i.errorCode,
        error_message: i.errorMessage,
        meter_summary: i.meterSummary,
        grouping_snapshot: i.groupingSnapshot,
        page_count: i.pageCount,
        annotation_count: i.annotationCount,
        duration_ms: i.durationMs,
      })),
    });
    if (error) throw new Error(error.message);
  }

  async listRecent(limit = 5): Promise<JobSummary[]> {
    const { data, error } = await this.client
      .from(JOBS)
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(1, limit), MAX_RECENT));
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSummary);
  }

  async getJob(id: string): Promise<JobDetail | null> {
    const [job, items] = await Promise.all([
      this.client.from(JOBS).select("*").eq("user_id", this.userId).eq("id", id).maybeSingle(),
      this.client
        .from(ITEMS)
        .select("*")
        .eq("user_id", this.userId)
        .eq("job_id", id)
        .order("item_id", { ascending: true }),
    ]);
    if (job.error) throw new Error(job.error.message);
    if (items.error) throw new Error(items.error.message);
    if (!job.data) return null;
    return {
      ...toSummary(job.data as Record<string, unknown>),
      items: (items.data ?? []).map((r) => ({
        itemId: String(r.item_id),
        sourceName: String(r.source_name),
        outputName: (r.output_name as string) ?? null,
        status: r.status as JobItemRecord["status"],
        errorCode: (r.error_code as string) ?? null,
        errorMessage: (r.error_message as string) ?? null,
        meterSummary: (r.meter_summary as Record<string, number>) ?? null,
        groupingSnapshot: (r.grouping_snapshot as Record<string, number[]>) ?? null,
        pageCount: r.page_count === null ? null : Number(r.page_count),
        annotationCount:
          r.annotation_count === null ? null : Number(r.annotation_count),
        durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
      })),
    };
  }

  async remove(id: string): Promise<void> {
    // Item bị xoá theo nhờ ON DELETE CASCADE trên khoá ngoại ghép.
    const { error } = await this.client
      .from(JOBS)
      .delete()
      .eq("user_id", this.userId)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async clearHistory(): Promise<void> {
    const { error } = await this.client.from(JOBS).delete().eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }
}
