import type { AnnotatedScore, ScoreSettings } from "../musicxml-beats/renderer/types.ts";
import {
  allowedPartitions,
  isIrregularMeter,
  meterCode,
} from "../musicxml-beats/meterGrouping.ts";

export type BatchStatus =
  | "queued"
  | "processing"
  | "needs-grouping"
  | "done"
  | "error";
export type BatchFormat = "pdf" | "svg" | "png";

export interface BatchFile {
  name: string;
  xml: string;
}
/** Một mã nhịp đang chờ thầy chọn cách chia, kèm các lựa chọn hợp lệ. */
export interface GroupingRequest {
  meter: string;
  options: readonly (readonly number[])[];
}
export interface BatchItem {
  id: string;
  fileName: string;
  /** Tên file xuất ra, đã khử trùng lặp một cách xác định. */
  outputName: string;
  status: BatchStatus;
  error?: string;
  needs?: GroupingRequest[];
  blob?: Blob;
}

export const EXTENSION: Record<BatchFormat, string> = {
  pdf: "pdf",
  svg: "svg",
  png: "png",
};

/** Bỏ đuôi .xml/.musicxml, giữ nguyên phần tên thầy đặt. */
export const baseName = (name: string) =>
  name.replace(/\.(xml|musicxml)$/i, "").trim() || "ban-nhac";

/**
 * Tên file xuất ra: giữ basename nguồn, trùng thì thêm hậu tố ĐẾM TĂNG DẦN theo
 * đúng thứ tự đầu vào — bai.pdf, bai-2.pdf, bai-3.pdf. Không UUID, không ngẫu nhiên:
 * chạy lại cùng danh sách phải ra cùng kết quả.
 */
export function planOutputNames(
  names: readonly string[],
  format: BatchFormat
): string[] {
  const ext = EXTENSION[format];
  const seen = new Map<string, number>();
  return names.map((name) => {
    const base = baseName(name);
    const key = base.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? `${base}.${ext}` : `${base}-${n}.${ext}`;
  });
}

/**
 * Bản nhạc này có đang thiếu cách chia mà CÁCH ĐẾM ĐANG CHỌN thật sự cần không.
 *
 * Ở chế độ phách nhỏ, nhịp lẻ chưa khai cách chia vẫn cho lưới đầy đủ và đúng —
 * chặn lại lúc đó là chặn oan. Chỉ khi thầy đếm phách lớn thì thiếu cách chia mới
 * làm tài liệu mất số phách, và khi đó batch dừng file lại chờ thầy chọn.
 * Trong mọi trường hợp KHÔNG có đường nào tự đoán 2+3 hay 2+2+3.
 */
export function groupingRequests(
  score: AnnotatedScore,
  settings: ScoreSettings
): GroupingRequest[] {
  if ((settings.compoundCountingMode ?? "pulses") !== "compound") return [];
  const wanted = new Map<string, GroupingRequest>();
  for (const m of score.beatMap.measures) {
    if (m.groupingSource !== "unresolved" || !isIrregularMeter(m.meter)) continue;
    const code = meterCode(m.meter!);
    if (!wanted.has(code))
      wanted.set(code, { meter: code, options: allowedPartitions(m.meter) ?? [] });
  }
  return [...wanted.values()];
}

/**
 * Chạy ĐÚNG pipeline một-file đã nghiệm thu cho một bản nhạc.
 * Batch không parse, không khắc, không xuất — nó chỉ gọi lại lớp này.
 */
export interface BatchProcessor {
  render(xml: string, settings: ScoreSettings): Promise<AnnotatedScore>;
  toBlob(score: AnnotatedScore, format: BatchFormat): Promise<Blob>;
}

export interface BatchOptions {
  settings: ScoreSettings;
  format: BatchFormat;
  /** Cách chia thầy chọn riêng cho từng file, khoá theo id item. */
  groupingByItem?: Readonly<Record<string, ScoreSettings["grouping"]>>;
  /** Chạy tuần tự vài file một để không dựng cùng lúc hàng chục bản khắc. */
  concurrency?: number;
  onUpdate?: (items: readonly BatchItem[]) => void;
  signal?: { aborted: boolean };
}

export const makeItems = (files: readonly BatchFile[], format: BatchFormat): BatchItem[] => {
  const outputs = planOutputNames(files.map((f) => f.name), format);
  return files.map((f, i) => ({
    id: `item-${i + 1}`,
    fileName: f.name,
    outputName: outputs[i],
    status: "queued" as const,
  }));
};

/**
 * Điều phối nhiều file. Mỗi file có trạng thái riêng: một file hỏng KHÔNG được
 * làm hỏng cả mẻ. Thứ tự kết quả luôn bằng thứ tự đầu vào, dù chạy song song.
 */
export async function runBatch(
  files: readonly BatchFile[],
  processor: BatchProcessor,
  options: BatchOptions
): Promise<BatchItem[]> {
  const items = makeItems(files, options.format);
  const emit = () => options.onUpdate?.(items.map((i) => ({ ...i })));
  emit();
  const limit = Math.max(1, Math.min(options.concurrency ?? 2, 4));
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const item = items[index];
      if (options.signal?.aborted) {
        item.status = "queued";
        emit();
        continue;
      }
      item.status = "processing";
      emit();
      try {
        const settings: ScoreSettings = {
          ...options.settings,
          grouping: options.groupingByItem?.[item.id] ?? options.settings.grouping,
        };
        const score = await processor.render(files[index].xml, settings);
        const needs = groupingRequests(score, settings);
        if (needs.length) {
          item.status = "needs-grouping";
          item.needs = needs;
        } else {
          item.blob = await processor.toBlob(score, options.format);
          item.status = "done";
        }
      } catch (e) {
        item.status = "error";
        item.error = e instanceof Error ? e.message : String(e);
      }
      emit();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, files.length) }, worker));
  return items;
}

export const batchProgress = (items: readonly BatchItem[]) => ({
  xong: items.filter((i) => i.status === "done").length,
  loi: items.filter((i) => i.status === "error").length,
  canChon: items.filter((i) => i.status === "needs-grouping").length,
  tong: items.length,
});
