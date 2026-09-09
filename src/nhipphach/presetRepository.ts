import {
  SYSTEM_PRESETS,
  isSystemPreset,
  migratePreset,
  MAX_PRESET_NAME,
  PRESET_SCHEMA_VERSION,
} from "./presets.ts";
import type { NhipPhachPreset } from "./presets.ts";

export interface PresetStore {
  presets: NhipPhachPreset[];
  defaultId: string | null;
  /** Đọc được nhưng có phần hỏng đã bỏ qua — UI báo nhẹ, công cụ vẫn chạy. */
  recovered: boolean;
}

/**
 * Nơi cất preset. Bản MVP lưu trên máy; đổi sang server sau này chỉ cần một lớp
 * cài đặt khác của interface này, UI không phải viết lại. Mọi phương thức async
 * ngay từ đầu để bản server không làm đổi chữ ký.
 */
export interface PresetRepository {
  load(): Promise<PresetStore>;
  save(preset: NhipPhachPreset): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  duplicate(id: string, name?: string): Promise<NhipPhachPreset>;
  remove(id: string): Promise<void>;
  setDefault(id: string | null): Promise<void>;
}

const KEY = "nhipphach-presets-v1";
type Persisted = { schemaVersion?: number; presets?: unknown[]; defaultId?: unknown };

/** Trộn preset hệ thống (luôn là bản trong mã) với preset cá nhân đã lưu. */
function merge(custom: NhipPhachPreset[]): NhipPhachPreset[] {
  return [...SYSTEM_PRESETS, ...custom.filter((p) => !isSystemPreset(p.id))];
}

export class LocalPresetRepository implements PresetRepository {
  private storage: Storage | null;
  constructor(storage: Storage | null = safeLocalStorage()) {
    this.storage = storage;
  }

  async load(): Promise<PresetStore> {
    const empty: PresetStore = {
      presets: merge([]),
      defaultId: null,
      recovered: false,
    };
    if (!this.storage) return empty;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(KEY);
    } catch {
      return { ...empty, recovered: true };
    }
    if (!raw) return empty;
    let parsed: Persisted;
    try {
      parsed = JSON.parse(raw) as Persisted;
    } catch {
      // Dữ liệu hỏng: KHÔNG làm sập trang, quay về preset hệ thống.
      return { ...empty, recovered: true };
    }
    const list = Array.isArray(parsed?.presets) ? parsed.presets : [];
    const custom: NhipPhachPreset[] = [];
    let recovered = !Array.isArray(parsed?.presets) && raw !== null;
    for (const item of list) {
      const p = migratePreset(item);
      if (p && !isSystemPreset(p.id)) custom.push(p);
      else recovered = true;
    }
    const presets = merge(custom);
    const defaultId =
      typeof parsed?.defaultId === "string" &&
      presets.some((p) => p.id === parsed.defaultId)
        ? (parsed.defaultId as string)
        : null;
    if (typeof parsed?.defaultId === "string" && !defaultId) recovered = true;
    return { presets, defaultId, recovered };
  }

  private async write(store: {
    presets: NhipPhachPreset[];
    defaultId: string | null;
  }) {
    if (!this.storage) throw new Error("Trình duyệt không cho lưu preset.");
    this.storage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: PRESET_SCHEMA_VERSION,
        presets: store.presets.filter((p) => !p.system),
        defaultId: store.defaultId,
      })
    );
  }

  async save(preset: NhipPhachPreset): Promise<void> {
    if (preset.system || isSystemPreset(preset.id))
      throw new Error("Không sửa được preset hệ thống.");
    const { presets, defaultId } = await this.load();
    const next = presets.filter((p) => p.id !== preset.id);
    next.push({ ...preset, system: false });
    await this.write({ presets: next, defaultId });
  }

  async rename(id: string, name: string): Promise<void> {
    if (isSystemPreset(id)) throw new Error("Không đổi tên preset hệ thống.");
    const clean = name.trim().slice(0, MAX_PRESET_NAME);
    if (!clean) throw new Error("Tên preset không được để trống.");
    const { presets, defaultId } = await this.load();
    const target = presets.find((p) => p.id === id);
    if (!target) throw new Error("Không tìm thấy preset.");
    // id KHÔNG đổi theo tên, nên mặc định và mọi tham chiếu vẫn còn nguyên.
    await this.write({
      presets: presets.map((p) => (p.id === id ? { ...p, name: clean } : p)),
      defaultId,
    });
  }

  async duplicate(id: string, name?: string): Promise<NhipPhachPreset> {
    const { presets, defaultId } = await this.load();
    const source = presets.find((p) => p.id === id);
    if (!source) throw new Error("Không tìm thấy preset.");
    const copy: NhipPhachPreset = {
      ...source,
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: (name ?? `${source.name} (bản sao)`).trim().slice(0, MAX_PRESET_NAME),
      system: false,
    };
    await this.write({ presets: [...presets, copy], defaultId });
    return copy;
  }

  async remove(id: string): Promise<void> {
    if (isSystemPreset(id)) throw new Error("Không xoá được preset hệ thống.");
    const { presets, defaultId } = await this.load();
    await this.write({
      presets: presets.filter((p) => p.id !== id),
      defaultId: defaultId === id ? null : defaultId,
    });
  }

  async setDefault(id: string | null): Promise<void> {
    const { presets } = await this.load();
    if (id !== null && !presets.some((p) => p.id === id))
      throw new Error("Không tìm thấy preset.");
    await this.write({ presets, defaultId: id });
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
