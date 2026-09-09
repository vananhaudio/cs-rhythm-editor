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
  /** "system" | "custom" — mặc định trỏ tới preset hệ thống hay preset cá nhân. */
  defaultSource?: "system" | "custom" | null;
  /** Dấu thời gian máy chủ của từng preset, dùng để phát hiện ghi chồng. */
  versions?: Record<string, string>;
  /** Nguồn dữ liệu đang dùng — UI hiện trạng thái đồng bộ từ đây. */
  origin?: "local" | "cloud" | "cloud-fallback";
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
  /** `expectedUpdatedAt` là dấu thời gian client đã đọc; lệch → PRESET_CONFLICT. */
  save(preset: NhipPhachPreset, expectedUpdatedAt?: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  duplicate(id: string, name?: string): Promise<NhipPhachPreset>;
  remove(id: string): Promise<void>;
  setDefault(id: string | null, source?: "system" | "custom" | null): Promise<void>;
}

/**
 * Khoá cũ từ Giai đoạn 9A, KHÔNG mang danh tính người dùng. Từ 10A nó chỉ còn là
 * NGUỒN DỮ LIỆU CŨ để đưa lên tài khoản đúng một lần, tuyệt đối không dùng làm
 * bộ nhớ đệm chung — nếu không, thầy A đăng xuất rồi thầy B đăng nhập lúc mất
 * mạng sẽ thấy preset của thầy A.
 */
export const LEGACY_KEY = "nhipphach-presets-v1";
/** Bộ nhớ đệm của từng tài khoản. */
export const keyFor = (namespace?: string | null) =>
  namespace ? `nhipphach:presets:${namespace}` : LEGACY_KEY;
type Persisted = { schemaVersion?: number; presets?: unknown[]; defaultId?: unknown };

/** Trộn preset hệ thống (luôn là bản trong mã) với preset cá nhân đã lưu. */
function merge(custom: NhipPhachPreset[]): NhipPhachPreset[] {
  return [...SYSTEM_PRESETS, ...custom.filter((p) => !isSystemPreset(p.id))];
}

export class LocalPresetRepository implements PresetRepository {
  private storage: Storage | null;
  private key: string;
  /** `namespace` là auth uid. Bỏ trống = kho cũ chưa gắn danh tính (chỉ để đọc lần đầu). */
  constructor(
    storage: Storage | null = safeLocalStorage(),
    namespace?: string | null
  ) {
    this.storage = storage;
    this.key = keyFor(namespace);
  }

  async load(): Promise<PresetStore> {
    const empty: PresetStore = {
      presets: merge([]),
      defaultId: null,
      defaultSource: null,
      recovered: false,
      origin: "local",
    };
    if (!this.storage) return empty;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
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
    const defaultSource = defaultId
      ? isSystemPreset(defaultId)
        ? ("system" as const)
        : ("custom" as const)
      : null;
    return { presets, defaultId, defaultSource, recovered, origin: "local" };
  }

  private async write(store: {
    presets: NhipPhachPreset[];
    defaultId: string | null;
  }) {
    if (!this.storage) throw new Error("Trình duyệt không cho lưu preset.");
    this.storage.setItem(
      this.key,
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

  async setDefault(id: string | null, _source?: "system" | "custom" | null): Promise<void> {
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
