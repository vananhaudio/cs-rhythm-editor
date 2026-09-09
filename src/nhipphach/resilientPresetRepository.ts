import type { NhipPhachPreset } from "./presets.ts";
import type { PresetRepository, PresetStore } from "./presetRepository.ts";

/**
 * Bọc kho preset trên máy chủ bằng một lớp chịu lỗi.
 *
 * Công cụ Nhịp Phách KHÔNG được chết vì preset không đồng bộ được. Đọc lỗi thì
 * lùi về bản trên máy và nói rõ; ghi lỗi thì NÉM lỗi ra, tuyệt đối không giả báo
 * thành công. Mỗi lần đọc được máy chủ thì chép lại xuống máy làm bộ nhớ đệm cho
 * lần sau mất mạng.
 */
export class ResilientPresetRepository implements PresetRepository {
  private cloud: PresetRepository;
  private local: PresetRepository;
  private onCache?: (store: PresetStore) => void;
  constructor(
    cloud: PresetRepository,
    local: PresetRepository,
    onCache?: (store: PresetStore) => void
  ) {
    this.cloud = cloud;
    this.local = local;
    this.onCache = onCache;
  }

  async load(): Promise<PresetStore> {
    try {
      const store = await this.cloud.load();
      this.onCache?.(store);
      return store;
    } catch {
      const fallback = await this.local.load();
      return { ...fallback, origin: "cloud-fallback", recovered: true };
    }
  }

  save(preset: NhipPhachPreset, expectedUpdatedAt?: string) {
    return this.cloud.save(preset, expectedUpdatedAt);
  }
  rename(id: string, name: string) {
    return this.cloud.rename(id, name);
  }
  duplicate(id: string, name?: string) {
    return this.cloud.duplicate(id, name);
  }
  remove(id: string) {
    return this.cloud.remove(id);
  }
  setDefault(id: string | null, source?: "system" | "custom" | null) {
    return this.cloud.setDefault(id, source);
  }
}
