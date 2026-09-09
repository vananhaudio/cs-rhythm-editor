import { isSystemPreset } from "./presets.ts";
import type { NhipPhachPreset } from "./presets.ts";
import type { PresetRepository, PresetStore } from "./presetRepository.ts";
import { PRESET_CONFLICT } from "./supabasePresetRepository.ts";

export const MIGRATED_KEY = "nhipphach-presets-migrated-v1";
/**
 * Ai đã nhận kho preset cũ (khoá 9A chưa gắn danh tính). Chỉ MỘT tài khoản được
 * nhận; tài khoản sau đăng nhập trên cùng máy không được nhập lại dữ liệu đó.
 */
export const LEGACY_CLAIMED_KEY = "nhipphach:legacyClaimedBy";

export interface MigrationReport {
  uploaded: string[];
  /** Cùng id, nội dung y hệt → bỏ qua, không nhân đôi. */
  skipped: string[];
  /** Cùng id nhưng nội dung khác → KHÔNG ghi đè, tạo bản sao giữ nguyên cả hai. */
  conflicted: { id: string; copyId: string }[];
  /** Preset hệ thống lẫn trong dữ liệu local — không bao giờ đẩy lên. */
  ignoredSystem: string[];
  failed: { id: string; error: string }[];
  complete: boolean;
}

const shape = (p: NhipPhachPreset) =>
  JSON.stringify([
    p.showBeats,
    p.countingLevel,
    p.compoundCountingMode,
    p.color,
    p.sizePt,
    p.distance,
    p.pageSize,
    p.orientation,
    p.exportFormat ?? null,
    p.name,
  ]);

/**
 * Đưa preset đang nằm trên máy lên tài khoản.
 *
 * Quy tắc, cố ý không có đường nào làm mất dữ liệu:
 *   cùng id + cùng nội dung   → bỏ qua
 *   cùng id + khác nội dung   → giữ nguyên bản trên máy chủ, tạo BẢN SAO cho bản máy
 *   trùng tên nhưng khác id   → coi là hai preset khác nhau, đẩy cả hai
 *   preset hệ thống           → không bao giờ đẩy lên
 *
 * Chỉ đánh dấu hoàn tất khi máy chủ đã xác nhận GHI XONG. Đứt giữa chừng thì lần
 * sau chạy lại: phần đã lên sẽ rơi vào nhánh "cùng id + cùng nội dung" nên không
 * nhân đôi, phần chưa lên được đẩy tiếp.
 */
export async function migrateLocalPresets(
  local: PresetStore,
  cloud: PresetRepository
): Promise<MigrationReport> {
  const report: MigrationReport = {
    uploaded: [],
    skipped: [],
    conflicted: [],
    ignoredSystem: [],
    failed: [],
    complete: false,
  };
  const server = await cloud.load();
  const onServer = new Map(server.presets.filter((p) => !p.system).map((p) => [p.id, p]));
  for (const preset of local.presets) {
    if (preset.system || isSystemPreset(preset.id)) {
      report.ignoredSystem.push(preset.id);
      continue;
    }
    const existing = onServer.get(preset.id);
    if (existing && shape(existing) === shape(preset)) {
      report.skipped.push(preset.id);
      continue;
    }
    try {
      if (existing) {
        // KHÔNG ghi đè. Giữ bản máy chủ, đưa bản trên máy lên dưới id mới.
        const copy: NhipPhachPreset = {
          ...preset,
          id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name: `${preset.name} (bản trên máy)`.slice(0, 60),
        };
        await cloud.save(copy);
        report.conflicted.push({ id: preset.id, copyId: copy.id });
      } else {
        await cloud.save(preset);
        report.uploaded.push(preset.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Đã có sẵn trên máy chủ do lần chạy trước → coi như đã xong, không phải lỗi.
      if (msg === PRESET_CONFLICT) report.skipped.push(preset.id);
      else report.failed.push({ id: preset.id, error: msg });
    }
  }
  // Mặc định trên máy chỉ được đưa lên khi máy chủ CHƯA có lựa chọn nào.
  if (local.defaultId && !server.defaultId) {
    try {
      await cloud.setDefault(
        local.defaultId,
        isSystemPreset(local.defaultId) ? "system" : "custom"
      );
    } catch (e) {
      report.failed.push({
        id: local.defaultId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  report.complete = report.failed.length === 0;
  return report;
}

export function legacyClaimedBy(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(LEGACY_CLAIMED_KEY);
  } catch {
    return null;
  }
}

/** Chỉ đánh dấu SAU khi máy chủ đã xác nhận ghi xong. */
export function claimLegacy(storage: Storage | null, userId: string) {
  if (!storage) return;
  try {
    if (!storage.getItem(LEGACY_CLAIMED_KEY))
      storage.setItem(LEGACY_CLAIMED_KEY, userId);
  } catch {
    /* không đánh dấu được thì lần sau thử lại — migration idempotent */
  }
}

export function markMigrated(storage: Storage | null, userId: string) {
  if (!storage) return;
  try {
    const raw = storage.getItem(MIGRATED_KEY);
    const done: string[] = raw ? JSON.parse(raw) : [];
    if (!done.includes(userId))
      storage.setItem(MIGRATED_KEY, JSON.stringify([...done, userId]));
  } catch {
    /* không đánh dấu được thì lần sau chạy lại — vô hại vì migration idempotent */
  }
}

export function alreadyMigrated(storage: Storage | null, userId: string): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(MIGRATED_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(userId) : false;
  } catch {
    return false;
  }
}
