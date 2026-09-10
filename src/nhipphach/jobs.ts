import type { ScoreSettings } from "../musicxml-beats/renderer/types.ts";
import type { AnnotatedScore } from "../musicxml-beats/renderer/types.ts";
import type { BatchFormat, BatchItem, BatchProcessor } from "./batch.ts";
import { baseName } from "./batch.ts";
import { isIrregularMeter, meterCode } from "../musicxml-beats/meterGrouping.ts";

export type JobMode = "single" | "batch";
export type JobStatus = "completed" | "completed_with_errors" | "failed";
export type JobItemStatus = "done" | "error" | "needs_grouping";

export const MAX_ERROR_LENGTH = 500;

/** Ảnh chụp thiết lập trình bày — KHÔNG có cách chia nhịp lẻ, không có bản nhạc. */
export interface SettingsSnapshot {
  showBeats: boolean;
  countingLevel: string;
  compoundCountingMode: string;
  color: string;
  sizePt: number;
  distance: number;
  pageSize: "A4";
  orientation: "portrait" | "landscape";
  exportFormat: BatchFormat;
}

export interface JobItemRecord {
  itemId: string;
  sourceName: string;
  outputName: string | null;
  status: JobItemStatus;
  errorCode: string | null;
  errorMessage: string | null;
  meterSummary: Record<string, number> | null;
  /** Cách chia THỰC SỰ đã dùng cho chính bài này — sự kiện quá khứ, không phải preset. */
  groupingSnapshot: Record<string, readonly number[]> | null;
  pageCount: number | null;
  annotationCount: number | null;
  durationMs: number | null;
}

/** Số liệu thu được của một bài trong mẻ — chỉ ĐẾM, không giữ bản nhạc. */
export interface ItemMeta {
  meterSummary: Record<string, number> | null;
  groupingSnapshot: Record<string, readonly number[]> | null;
  pageCount: number | null;
  annotationCount: number | null;
}

export interface JobRecord {
  id: string;
  mode: JobMode;
  exportFormat: BatchFormat;
  presetId: string | null;
  presetName: string | null;
  settingsSnapshot: SettingsSnapshot;
  countingMode: string;
  pageSize: "A4";
  orientation: "portrait" | "landscape";
  totalItems: number;
  doneItems: number;
  errorItems: number;
  needsGroupingItems: number;
  status: JobStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  items: JobItemRecord[];
}

/**
 * Thiết lập đang dùng → ảnh chụp cho lịch sử.
 *
 * CỐ Ý bỏ `grouping`: ảnh chụp này là thứ nút "Dùng lại thiết lập" sẽ áp lại,
 * mà áp cách chia của bài cũ lên bài mới chính là tự đoán 2+3 hay 2+2+3 — đúng
 * thứ Giai đoạn 8 cấm. Cách chia của từng bài nằm ở `grouping_snapshot` của item.
 */
export function sanitizeSettings(
  settings: ScoreSettings,
  exportFormat: BatchFormat
): SettingsSnapshot {
  return {
    showBeats: settings.showBeats,
    countingLevel: settings.countingLevel ?? "beats",
    compoundCountingMode: settings.compoundCountingMode ?? "pulses",
    color: settings.color,
    sizePt: settings.sizePt,
    distance: settings.distance,
    pageSize: "A4",
    orientation: settings.orientation ?? "portrait",
    exportFormat,
  };
}

/**
 * Thông điệp lỗi cho lịch sử: cắt ngắn và BỎ MỌI MẢNH MÃ NGUỒN.
 *
 * Lỗi thật của parser có dạng `unclosed xml tag(s): hỏng` — nó mang theo một
 * mẩu nội dung bản nhạc. Lịch sử chỉ được giữ metadata nên phải gột sạch.
 */
export function sanitizeErrorMessage(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw instanceof Error ? raw.message : String(raw);
  const cleaned = text
    // Từ dấu `<` đầu tiên trở đi là mảnh bản nhạc — kể cả CHỮ NẰM GIỮA hai thẻ
    // (tên nốt, lời bài hát). Cắt bỏ cả phần đuôi, không chỉ bóc thẻ.
    .split("<")[0]
    .replace(/>/g, " ")
    .replace(/data:[^\s]+/gi, " ") // data: URI
    .replace(/blob:[^\s]+/gi, " ") // blob URL
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_ERROR_LENGTH);
}

/** Mã lỗi ngắn để nhóm, suy từ thông điệp đã gột. */
export function errorCodeOf(raw: unknown): string {
  const t = sanitizeErrorMessage(raw) ?? "";
  if (/unclosed|not well-formed|parse|xml/i.test(t)) return "XML_INVALID";
  if (/meter|nhịp/i.test(t)) return "METER_UNSUPPORTED";
  if (/network|fetch|timeout/i.test(t)) return "NETWORK";
  return "UNKNOWN";
}

/** Đếm mã nhịp trong bản nhạc — chỉ số lượng, không phải nội dung nhạc. */
export function meterSummaryOf(score: AnnotatedScore): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of score.beatMap.measures) {
    if (!m.meter) continue;
    const code = meterCode(m.meter);
    out[code] = (out[code] ?? 0) + 1;
  }
  return out;
}

/** Cách chia thực sự đã dùng cho các ô nhịp lẻ của chính bản nhạc này. */
export function groupingSnapshotOf(
  score: AnnotatedScore
): Record<string, readonly number[]> | null {
  const out: Record<string, readonly number[]> = {};
  for (const m of score.beatMap.measures)
    if (isIrregularMeter(m.meter) && m.groups) out[meterCode(m.meter!)] = m.groups;
  return Object.keys(out).length ? out : null;
}

export const jobStatusOf = (
  done: number,
  errors: number,
  needs: number
): JobStatus =>
  done === 0 && (errors > 0 || needs > 0)
    ? "failed"
    : errors > 0 || needs > 0
    ? "completed_with_errors"
    : "completed";

const newId = () =>
  `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Một lần xuất ở chế độ một bài → một job, một item. */
export function buildSingleJob(input: {
  sourceName: string;
  score: AnnotatedScore;
  settings: ScoreSettings;
  format: BatchFormat;
  presetId: string | null;
  presetName: string | null;
  startedAt: number;
  finishedAt: number;
}): JobRecord {
  const snapshot = sanitizeSettings(input.settings, input.format);
  const base = baseName(input.sourceName);
  return {
    id: newId(),
    mode: "single",
    exportFormat: input.format,
    presetId: input.presetId,
    presetName: input.presetName,
    settingsSnapshot: snapshot,
    countingMode: `${snapshot.countingLevel}/${snapshot.compoundCountingMode}`,
    pageSize: "A4",
    orientation: snapshot.orientation,
    totalItems: 1,
    doneItems: 1,
    errorItems: 0,
    needsGroupingItems: 0,
    status: "completed",
    startedAt: new Date(input.startedAt).toISOString(),
    finishedAt: new Date(input.finishedAt).toISOString(),
    durationMs: Math.max(0, Math.round(input.finishedAt - input.startedAt)),
    items: [
      {
        itemId: "item-1",
        sourceName: input.sourceName,
        outputName: `${base}.${input.format}`,
        status: "done",
        errorCode: null,
        errorMessage: null,
        meterSummary: meterSummaryOf(input.score),
        groupingSnapshot: groupingSnapshotOf(input.score),
        pageCount: input.score.pages.length,
        annotationCount: input.score.anchors.length,
        durationMs: Math.max(0, Math.round(input.finishedAt - input.startedAt)),
      },
    ],
  };
}

/** Một mẻ nhiều bài → một job, N item. Ghi MỘT LẦN sau khi mẻ kết thúc. */
export function buildBatchJob(input: {
  items: readonly BatchItem[];
  meta: Readonly<Record<string, ItemMeta>>;
  settings: ScoreSettings;
  format: BatchFormat;
  presetId: string | null;
  presetName: string | null;
  startedAt: number;
  finishedAt: number;
}): JobRecord {
  const snapshot = sanitizeSettings(input.settings, input.format);
  const rows: JobItemRecord[] = input.items.map((item) => {
    const extra = input.meta[item.id];
    const status: JobItemStatus =
      item.status === "done"
        ? "done"
        : item.status === "needs-grouping"
        ? "needs_grouping"
        : "error";
    return {
      itemId: item.id,
      sourceName: item.fileName,
      outputName: item.status === "done" ? item.outputName : null,
      status,
      errorCode: status === "error" ? errorCodeOf(item.error) : null,
      errorMessage: status === "error" ? sanitizeErrorMessage(item.error) : null,
      meterSummary: extra?.meterSummary ?? null,
      groupingSnapshot: extra?.groupingSnapshot ?? null,
      pageCount: extra?.pageCount ?? null,
      annotationCount: extra?.annotationCount ?? null,
      durationMs: null,
    };
  });
  const done = rows.filter((r) => r.status === "done").length;
  const errors = rows.filter((r) => r.status === "error").length;
  const needs = rows.filter((r) => r.status === "needs_grouping").length;
  return {
    id: newId(),
    mode: "batch",
    exportFormat: input.format,
    presetId: input.presetId,
    presetName: input.presetName,
    settingsSnapshot: snapshot,
    countingMode: `${snapshot.countingLevel}/${snapshot.compoundCountingMode}`,
    pageSize: "A4",
    orientation: snapshot.orientation,
    totalItems: rows.length,
    doneItems: done,
    errorItems: errors,
    needsGroupingItems: needs,
    status: jobStatusOf(done, errors, needs),
    startedAt: new Date(input.startedAt).toISOString(),
    finishedAt: new Date(input.finishedAt).toISOString(),
    durationMs: Math.max(0, Math.round(input.finishedAt - input.startedAt)),
    items: rows,
  };
}

/**
 * Bọc một processor để thu số liệu từng bài trong lúc mẻ chạy.
 *
 * Phải khoá theo `itemId` mà `runBatch` đưa vào, KHÔNG được tự đếm lượt gọi:
 * ở concurrency 2 thứ tự hoàn thành khác thứ tự đầu vào, đếm tay là gắn số
 * liệu của bài này sang bài khác.
 */
export function collectItemMeta(base: BatchProcessor): {
  proc: BatchProcessor;
  meta: Record<string, ItemMeta>;
} {
  const meta: Record<string, ItemMeta> = {};
  return {
    meta,
    proc: {
      async render(xml, s, itemId) {
        const out = await base.render(xml, s, itemId);
        meta[itemId] = {
          meterSummary: meterSummaryOf(out),
          groupingSnapshot: groupingSnapshotOf(out),
          pageCount: out.pages.length,
          annotationCount: out.anchors.length,
        };
        return out;
      },
      toBlob: (score, format) => base.toBlob(score, format),
    },
  };
}

/** Ảnh chụp thiết lập của job cũ → thiết lập đang dùng. KHÔNG đụng cách chia. */
export function applyJobSettings(
  snapshot: SettingsSnapshot,
  current: ScoreSettings
): ScoreSettings {
  return {
    ...current,
    showBeats: snapshot.showBeats,
    countingLevel: snapshot.countingLevel as ScoreSettings["countingLevel"],
    compoundCountingMode:
      snapshot.compoundCountingMode as ScoreSettings["compoundCountingMode"],
    color: snapshot.color,
    sizePt: snapshot.sizePt,
    distance: snapshot.distance,
    orientation: snapshot.orientation,
    // Cách chia của bài cũ KHÔNG được áp cho bản nhạc đang mở.
    grouping: current.grouping,
  };
}
