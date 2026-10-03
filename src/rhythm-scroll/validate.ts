import type { RhythmScrollData, RhythmScrollIssue, RhythmScrollValidation } from "./types.ts";

const SOURCE_TYPES = ["pdf", "image", "musicxml", "manual"];
const BEAT_TYPES = [1, 2, 4, 8, 16, 32];

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isCount = (value: unknown, min: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min;
const isTimestamp = (value: unknown) => isText(value) && Number.isFinite(Date.parse(value));

/** Kiểm MeterLike dùng chung cho dữ liệu canonical và bộ đổi giây → ô nhịp. */
export function meterIssue(meter: unknown): string | null {
  if (!isObject(meter)) return "meter phải là { beats, beatType }.";
  if (!isCount(meter.beats, 1)) return "meter.beats phải là số nguyên ≥ 1.";
  if (!BEAT_TYPES.includes(meter.beatType as number)) return "meter.beatType phải là 1, 2, 4, 8, 16 hoặc 32.";
  return null;
}

/**
 * Kiểm một RhythmScrollData đọc từ nguồn chưa tin cậy (DB, file, kết quả Vision).
 * Gom MỌI lỗi thay vì dừng ở lỗi đầu — người duyệt cần thấy cả danh sách.
 */
export function validateRhythmScrollData(input: unknown): RhythmScrollValidation {
  const issues: RhythmScrollIssue[] = [];
  const fail = (path: string, message: string) => { issues.push({ path, message }); };
  if (!isObject(input)) return { ok: false, issues: [{ path: "", message: "Dữ liệu phải là một object." }] };

  if (input.version !== 1) fail("version", "version phải là 1.");
  if (!isText(input.songId)) fail("songId", "songId không được rỗng.");
  if (!isText(input.lyricsHash)) fail("lyricsHash", "lyricsHash không được rỗng.");
  const meter = meterIssue(input.meter);
  if (meter) fail("meter", meter);

  let sum = 0;
  let countable = true;
  if (!Array.isArray(input.segments) || input.segments.length === 0) {
    fail("segments", "segments phải có ít nhất một đoạn.");
    countable = false;
  } else {
    input.segments.forEach((segment: unknown, index: number) => {
      const at = `segments[${index}]`;
      if (!isObject(segment)) { fail(at, "Đoạn phải là một object."); countable = false; return; }
      if (isCount(segment.measureCount, 1)) sum += segment.measureCount;
      else { fail(`${at}.measureCount`, "measureCount phải là số nguyên ≥ 1."); countable = false; }
      if (segment.line !== null && !isCount(segment.line, 0)) fail(`${at}.line`, "line phải là null hoặc số nguyên ≥ 0.");
      if (segment.lineCount !== undefined) {
        if (!isCount(segment.lineCount, 1)) fail(`${at}.lineCount`, "lineCount phải là số nguyên ≥ 1.");
        else if (segment.line === null) fail(`${at}.lineCount`, "Đoạn không lời (line = null) không có lineCount.");
      }
      if (segment.label !== undefined && typeof segment.label !== "string") fail(`${at}.label`, "label phải là chuỗi.");
      if (segment.confidence !== undefined
        && !(typeof segment.confidence === "number" && segment.confidence >= 0 && segment.confidence <= 1)) {
        fail(`${at}.confidence`, "confidence phải nằm trong 0..1.");
      }
    });
  }
  if (!isCount(input.totalMeasures, 1)) fail("totalMeasures", "totalMeasures phải là số nguyên ≥ 1.");
  else if (countable && input.totalMeasures !== sum) {
    fail("totalMeasures", `totalMeasures (${input.totalMeasures}) khác tổng measureCount (${sum}).`);
  }

  const provenance = input.provenance;
  if (!isObject(provenance)) fail("provenance", "provenance phải là một object.");
  else {
    if (!SOURCE_TYPES.includes(provenance.sourceType as string)) {
      fail("provenance.sourceType", `sourceType phải là một trong: ${SOURCE_TYPES.join(", ")}.`);
    }
    if (!isText(provenance.sourceHash)) fail("provenance.sourceHash", "sourceHash không được rỗng.");
    if (!isText(provenance.generator)) fail("provenance.generator", "generator không được rỗng.");
    if (!isTimestamp(provenance.generatedAt)) fail("provenance.generatedAt", "generatedAt phải là thời điểm ISO 8601.");
    if (provenance.reviewedAt !== undefined && !isTimestamp(provenance.reviewedAt)) {
      fail("provenance.reviewedAt", "reviewedAt phải là thời điểm ISO 8601.");
    }
  }

  // Đã kiểm đủ hình dạng ở trên nên ép kiểu ở đây là an toàn.
  return issues.length ? { ok: false, issues } : { ok: true, data: input as unknown as RhythmScrollData };
}
