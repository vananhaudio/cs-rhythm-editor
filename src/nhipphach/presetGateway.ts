import { supabase } from "../supabase";
import { LocalPresetRepository } from "./presetRepository.ts";
import type { PresetRepository, PresetStore } from "./presetRepository.ts";
import { SupabasePresetRepository } from "./supabasePresetRepository.ts";
import { ResilientPresetRepository } from "./resilientPresetRepository.ts";
import {
  migrateLocalPresets,
  markMigrated,
  alreadyMigrated,
  claimLegacy,
  legacyClaimedBy,
} from "./presetSync.ts";
import { SupabaseJobRepository } from "./jobRepository.ts";
import type { NhipPhachJobRepository } from "./jobRepository.ts";
import { SYNC_LABEL, stateFromStore } from "./syncState.ts";
import type { SyncState } from "./syncState.ts";
export { SYNC_LABEL, stateFromStore };
export type { SyncState };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Chọn kho preset cho phiên hiện tại và, nếu cần, đưa preset đang nằm trên máy
 * lên tài khoản.
 *
 * Trang KHÔNG gọi Supabase trực tiếp — mọi thứ đi qua `PresetRepository`. Chưa
 * đăng nhập thì dùng kho trên máy như trước, không có gì đổi.
 */
export async function openPresetRepository(): Promise<{
  repo: PresetRepository;
  jobs: NhipPhachJobRepository | null;
  state: SyncState;
  note: string;
}> {
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  const store = storage();
  // Chưa đăng nhập: dùng đúng kho cũ như trước, không có gì đổi.
  if (!userId)
    return {
      repo: new LocalPresetRepository(store),
      jobs: null,
      state: "local",
      note: "",
    };

  const cloud = new SupabasePresetRepository(supabase, userId);
  // Bộ nhớ đệm GẮN VỚI TÀI KHOẢN. Người khác đăng nhập trên cùng máy không đọc
  // được đệm của người trước, kể cả khi mất mạng.
  const cache = new LocalPresetRepository(store, userId);
  const repo = new ResilientPresetRepository(cloud, cache, (s) => cacheLocally(cache, s));
  const jobs = new SupabaseJobRepository(supabase, userId);

  // Đưa preset trên máy lên tài khoản, đúng MỘT lần cho mỗi người dùng, và chỉ
  // đánh dấu xong khi máy chủ đã xác nhận ghi.
  if (!alreadyMigrated(store, userId)) {
    try {
      // Kho cũ chưa gắn danh tính chỉ được MỘT tài khoản nhận.
      const claimed = legacyClaimedBy(store);
      const legacy =
        claimed === null || claimed === userId
          ? await new LocalPresetRepository(store, null).load()
          : null;
      const before = legacy ?? { presets: [], defaultId: null, recovered: false };
      const custom = before.presets.filter((p) => !p.system);
      if (custom.length || before.defaultId) {
        const report = await migrateLocalPresets(before, cloud);
        if (report.complete) {
          markMigrated(store, userId);
          claimLegacy(store, userId);
        } else
          return {
            repo,
            jobs,
            state: "failed",
            note: `Chưa đưa hết preset lên tài khoản (${report.failed.length} lỗi), sẽ thử lại lần sau.`,
          };
      } else {
        markMigrated(store, userId);
        if (legacy) claimLegacy(store, userId);
      }
    } catch {
      return {
            repo,
            jobs,
            state: "failed",
        note: "Chưa đưa được preset lên tài khoản, sẽ thử lại lần sau.",
      };
    }
  }
  return { repo, jobs, state: "syncing", note: "" };
}

/** Ghi bản đọc được từ máy chủ xuống máy làm bộ nhớ đệm cho lúc mất mạng. */
async function cacheLocally(local: LocalPresetRepository, store: PresetStore) {
  try {
    const current = await local.load();
    for (const p of current.presets.filter((x) => !x.system))
      if (!store.presets.some((s) => s.id === p.id)) await local.remove(p.id);
    for (const p of store.presets.filter((x) => !x.system)) await local.save(p);
    await local.setDefault(store.defaultId ?? null);
  } catch {
    /* không đệm được thì thôi, không ảnh hưởng việc đang làm */
  }
}

