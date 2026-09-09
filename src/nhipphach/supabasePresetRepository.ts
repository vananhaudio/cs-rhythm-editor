import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SYSTEM_PRESETS,
  isSystemPreset,
  migratePreset,
  MAX_PRESET_NAME,
  PRESET_SCHEMA_VERSION,
} from "./presets.ts";
import type { NhipPhachPreset } from "./presets.ts";
import type { PresetRepository, PresetStore } from "./presetRepository.ts";

export const PRESET_CONFLICT = "PRESET_CONFLICT";
const TABLE = "nhipphach_presets";
const PREFS = "nhipphach_prefs";

type Row = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  updated_at: string;
};

/** Preset → phần lưu trong `settings`. KHÔNG có id/name/system, KHÔNG có cách chia nhịp lẻ. */
function toSettings(p: NhipPhachPreset): Record<string, unknown> {
  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    showBeats: p.showBeats,
    countingLevel: p.countingLevel,
    compoundCountingMode: p.compoundCountingMode,
    color: p.color,
    sizePt: p.sizePt,
    distance: p.distance,
    pageSize: p.pageSize,
    orientation: p.orientation,
    ...(p.exportFormat ? { exportFormat: p.exportFormat } : {}),
  };
}

const fromRow = (r: Row): NhipPhachPreset | null =>
  migratePreset({ ...r.settings, id: r.id, name: r.name });

/**
 * Preset cá nhân lưu theo TÀI KHOẢN trên Supabase.
 *
 * Preset hệ thống KHÔNG bao giờ được đẩy lên đây — chúng nằm trong mã nguồn và
 * là bất biến. Bảng chỉ giữ preset cá nhân; lựa chọn mặc định (kể cả khi trỏ tới
 * một preset hệ thống) nằm ở bảng `nhipphach_prefs`.
 */
export class SupabasePresetRepository implements PresetRepository {
  private client: SupabaseClient;
  private userId: string;
  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async load(): Promise<PresetStore> {
    const [rows, prefs] = await Promise.all([
      this.client
        .from(TABLE)
        .select("id,name,settings,updated_at")
        .eq("user_id", this.userId)
        .order("updated_at", { ascending: false }),
      this.client
        .from(PREFS)
        .select("default_preset_id,default_preset_source")
        .eq("user_id", this.userId)
        .maybeSingle(),
    ]);
    if (rows.error) throw new Error(rows.error.message);
    if (prefs.error) throw new Error(prefs.error.message);
    const custom: NhipPhachPreset[] = [];
    const versions: Record<string, string> = {};
    let recovered = false;
    for (const r of (rows.data ?? []) as Row[]) {
      const p = fromRow(r);
      // Dòng mang id của preset hệ thống là dữ liệu bẩn — bỏ qua, không để nó
      // che mất preset hệ thống thật trong mã nguồn.
      if (p && !isSystemPreset(p.id)) {
        custom.push(p);
        versions[p.id] = r.updated_at;
      } else recovered = true;
    }
    const presets = [...SYSTEM_PRESETS, ...custom];
    const rawId = prefs.data?.default_preset_id ?? null;
    const rawSource = prefs.data?.default_preset_source ?? null;
    const defaultId = rawId && presets.some((p) => p.id === rawId) ? rawId : null;
    if (rawId && !defaultId) recovered = true;
    return {
      presets,
      defaultId,
      defaultSource: defaultId
        ? (rawSource as "system" | "custom" | null) ??
          (isSystemPreset(defaultId) ? "system" : "custom")
        : null,
      versions,
      recovered,
      origin: "cloud",
    };
  }

  async save(preset: NhipPhachPreset, expectedUpdatedAt?: string): Promise<void> {
    if (preset.system || isSystemPreset(preset.id))
      throw new Error("Không sửa được preset hệ thống.");
    const payload = {
      id: preset.id,
      user_id: this.userId,
      name: preset.name.trim().slice(0, MAX_PRESET_NAME),
      settings: toSettings(preset),
    };
    if (expectedUpdatedAt === undefined) {
      const { error } = await this.client.from(TABLE).insert(payload);
      // Đã tồn tại → không ghi đè âm thầm; người gọi phải quyết.
      if (error) throw new Error(error.code === "23505" ? PRESET_CONFLICT : error.message);
      return;
    }
    // Chỉ ghi khi dấu thời gian đúng bằng bản client đã đọc.
    const { data, error } = await this.client
      .from(TABLE)
      .update({ name: payload.name, settings: payload.settings })
      .eq("user_id", this.userId)
      .eq("id", preset.id)
      .eq("updated_at", expectedUpdatedAt)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error(PRESET_CONFLICT);
  }

  async rename(id: string, name: string): Promise<void> {
    if (isSystemPreset(id)) throw new Error("Không đổi tên preset hệ thống.");
    const clean = name.trim().slice(0, MAX_PRESET_NAME);
    if (!clean) throw new Error("Tên preset không được để trống.");
    const { data, error } = await this.client
      .from(TABLE)
      .update({ name: clean })
      .eq("user_id", this.userId)
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Không tìm thấy preset.");
  }

  async duplicate(id: string, name?: string): Promise<NhipPhachPreset> {
    const store = await this.load();
    const source = store.presets.find((p) => p.id === id);
    if (!source) throw new Error("Không tìm thấy preset.");
    const copy: NhipPhachPreset = {
      ...source,
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: (name ?? `${source.name} (bản sao)`).trim().slice(0, MAX_PRESET_NAME),
      system: false,
    };
    await this.save(copy);
    return copy;
  }

  async remove(id: string): Promise<void> {
    if (isSystemPreset(id)) throw new Error("Không xoá được preset hệ thống.");
    // Khoá chính là (user_id, id): mọi thao tác phải ghim CẢ HAI. Chỉ dùng `id`
    // là câu lệnh mang nghĩa "mọi người dùng có id này", điều mà khoá ghép cho
    // phép tồn tại — RLS vẫn chặn, nhưng ý định của câu lệnh đã sai từ đầu.
    const { error } = await this.client
      .from(TABLE)
      .delete()
      .eq("user_id", this.userId)
      .eq("id", id);
    if (error) throw new Error(error.message);
    // Xoá preset đang là mặc định thì phải gỡ luôn con trỏ, không để trỏ hụt.
    // `prefs` khoá theo user_id nên maybeSingle() dưới RLS chỉ thấy dòng của mình.
    const { data } = await this.client
      .from(PREFS)
      .select("default_preset_id")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (data?.default_preset_id === id) await this.setDefault(null);
  }

  async setDefault(
    id: string | null,
    source?: "system" | "custom" | null
  ): Promise<void> {
    const resolved =
      id === null ? null : source ?? (isSystemPreset(id) ? "system" : "custom");
    if (id !== null && resolved === "custom") {
      const { data, error } = await this.client
        .from(TABLE)
        .select("id")
        .eq("user_id", this.userId)
        .eq("id", id);
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Không tìm thấy preset.");
    }
    if (id !== null && resolved === "system" && !isSystemPreset(id))
      throw new Error("Không tìm thấy preset.");
    const { error } = await this.client.from(PREFS).upsert(
      {
        user_id: this.userId,
        default_preset_id: id,
        default_preset_source: resolved,
      },
      { onConflict: "user_id" }
    );
    if (error) throw new Error(error.message);
  }
}
