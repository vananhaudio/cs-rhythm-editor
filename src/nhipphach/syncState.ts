import type { PresetStore } from "./presetRepository.ts";

export type SyncState = "local" | "syncing" | "synced" | "cached" | "failed";

/**
 * Chữ hiện cho thầy. Chỉ DUY NHẤT trạng thái đọc được máy chủ mới được nói
 * "Đã đồng bộ" — bản lùi về máy phải nói rõ là bản trên máy.
 */
export const SYNC_LABEL: Record<SyncState, string> = {
  local: "Lưu trên máy này",
  syncing: "Đang đồng bộ…",
  synced: "✓ Đã đồng bộ",
  cached: "Đang dùng bản lưu trên máy",
  failed: "Không thể đồng bộ",
};

export const stateFromStore = (store: PresetStore): SyncState =>
  store.origin === "cloud"
    ? "synced"
    : store.origin === "cloud-fallback"
    ? "cached"
    : "local";
