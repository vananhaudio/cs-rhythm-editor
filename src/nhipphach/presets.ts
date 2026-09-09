import type {
  CompoundCountingMode,
  CountingLevel,
} from "../musicxml-beats/annotations.ts";
import { DEFAULT_SCORE_SETTINGS } from "../musicxml-beats/renderer/types.ts";
import type { ScoreSettings } from "../musicxml-beats/renderer/types.ts";

export const PRESET_SCHEMA_VERSION = 1;

/**
 * Một bộ thiết lập TRÌNH BÀY của công cụ Nhịp Phách.
 *
 * CỐ Ý KHÔNG có trường cách chia nhịp lẻ (5/8, 7/8). Cách chia là thuộc tính của
 * BẢN NHẠC, không phải sở thích trình bày — để nó vào preset là mở đường cho hệ
 * thống tự đoán 2+3 hay 2+2+3, đúng thứ Giai đoạn 8 cấm. Preset cũng không giữ
 * kết quả khắc, không giữ MusicXML, không đụng Beat Engine hay temporal placement.
 *
 * Hai trục đếm được giữ RIÊNG đúng như model thật của công cụ: `countingLevel`
 * cho nhịp đơn (2/4, 3/4, 4/4) và `compoundCountingMode` cho nhịp kép/nhịp lẻ.
 * Gộp thành một trường sẽ nói dối về hành vi của công cụ.
 */
export interface NhipPhachPreset {
  schemaVersion: number;
  id: string;
  name: string;
  /** Preset hệ thống: không xoá, không đổi id. */
  system: boolean;
  showBeats: boolean;
  countingLevel: CountingLevel;
  compoundCountingMode: CompoundCountingMode;
  color: string;
  sizePt: number;
  distance: number;
  pageSize: "A4";
  orientation: "portrait" | "landscape";
  exportFormat?: "pdf" | "svg" | "png";
}

export const MAX_PRESET_NAME = 60;

/** Nền chung của mọi preset hệ thống = đúng cấu hình đã nghiệm thu, không nghĩ lại. */
const base = {
  schemaVersion: PRESET_SCHEMA_VERSION,
  system: true as const,
  showBeats: true,
  compoundCountingMode: "pulses" as CompoundCountingMode,
  color: DEFAULT_SCORE_SETTINGS.color,
  sizePt: DEFAULT_SCORE_SETTINGS.sizePt,
  distance: DEFAULT_SCORE_SETTINGS.distance,
  pageSize: "A4" as const,
  orientation: "portrait" as const,
};

export const SYSTEM_PRESETS: readonly NhipPhachPreset[] = [
  { ...base, id: "sys-phach-co-ban", name: "Phách cơ bản", countingLevel: "beats" },
  { ...base, id: "sys-moc-don", name: "Chia móc đơn", countingLevel: "eighths" },
  { ...base, id: "sys-moc-kep", name: "Chia móc kép", countingLevel: "sixteenths" },
  {
    ...base,
    id: "sys-tai-lieu-hoc-sinh",
    name: "Tài liệu học sinh",
    countingLevel: "beats",
    exportFormat: "pdf",
  },
];

export const isSystemPreset = (id: string) =>
  SYSTEM_PRESETS.some((p) => p.id === id);

const LEVELS: CountingLevel[] = ["beats", "eighths", "sixteenths"];
const MODES: CompoundCountingMode[] = ["pulses", "compound"];

/**
 * Đọc một preset từ dữ liệu đã lưu. Trường lạ bị BỎ QUA an toàn, trường thiếu
 * lấy mặc định an toàn — thêm field ở phiên bản sau không được làm sập trang.
 * Trả null khi dữ liệu hỏng tới mức không cứu được (thiếu id hoặc tên).
 */
export function migratePreset(raw: unknown): NhipPhachPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!id || !name) return null;
  const num = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
      ? v
      : fallback;
  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    id,
    name: name.slice(0, MAX_PRESET_NAME),
    system: isSystemPreset(id),
    showBeats: typeof r.showBeats === "boolean" ? r.showBeats : true,
    countingLevel: LEVELS.includes(r.countingLevel as CountingLevel)
      ? (r.countingLevel as CountingLevel)
      : "beats",
    compoundCountingMode: MODES.includes(r.compoundCountingMode as CompoundCountingMode)
      ? (r.compoundCountingMode as CompoundCountingMode)
      : "pulses",
    color: /^#[0-9a-f]{6}$/i.test(String(r.color))
      ? String(r.color)
      : DEFAULT_SCORE_SETTINGS.color,
    sizePt: num(r.sizePt, DEFAULT_SCORE_SETTINGS.sizePt, 5, 14),
    distance: num(r.distance, DEFAULT_SCORE_SETTINGS.distance, 0, 8),
    pageSize: "A4",
    orientation: r.orientation === "landscape" ? "landscape" : "portrait",
    ...(r.exportFormat === "pdf" || r.exportFormat === "svg" || r.exportFormat === "png"
      ? { exportFormat: r.exportFormat }
      : {}),
  };
}

/** Preset → thiết lập cho renderer. KHÔNG đụng `grouping`: cách chia thuộc về bản nhạc. */
export function applyPreset(
  preset: NhipPhachPreset,
  current: ScoreSettings
): ScoreSettings {
  return {
    ...current,
    showBeats: preset.showBeats,
    countingLevel: preset.countingLevel,
    compoundCountingMode: preset.compoundCountingMode,
    color: preset.color,
    sizePt: preset.sizePt,
    distance: preset.distance,
    orientation: preset.orientation,
    grouping: current.grouping,
  };
}

/** Thiết lập đang dùng → preset cá nhân mới. */
export function presetFromSettings(
  name: string,
  settings: ScoreSettings,
  id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
): NhipPhachPreset {
  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    id,
    name: name.trim().slice(0, MAX_PRESET_NAME) || "Preset không tên",
    system: false,
    showBeats: settings.showBeats,
    countingLevel: settings.countingLevel ?? "beats",
    compoundCountingMode: settings.compoundCountingMode ?? "pulses",
    color: settings.color,
    sizePt: settings.sizePt,
    distance: settings.distance,
    pageSize: "A4",
    orientation: settings.orientation ?? "portrait",
  };
}
