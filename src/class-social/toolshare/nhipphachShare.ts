// Nhịp & Phách → Tool Share (artifact). Sản phẩm canonical = MusicXML ĐANG HIỂN THỊ + thiết lập đếm/trình bày;
// bản khắc dựng lại từ hai thứ đó (không gửi SVG/PDF/PNG). Chỉ chạy khi người dùng bấm "Chia sẻ" (lưu riêng / đăng cộng đồng)
// (ghi) hoặc khi mở /nhipphach?artifact=<id> (đọc). KHÔNG đọc/ghi musicxml_library (kho master) hay kho Nhịp Phách.
// supabase nạp ĐỘNG → phần thuần test được trên Node.
import type { ScoreSettings } from "../../musicxml-beats/renderer/types";
import { saveArtifactForShare, isArtifactId as isArtifactIdCommon, type ArtifactVisibility } from "../../share/artifactApi";

export const MAX_SHARE_XML_BYTES = 1_048_576;
export const isArtifactId = isArtifactIdCommon;

export type ShareableScore = { title: string; composer: string | null; xml: string; settings: ScoreSettings };

/** Bản đang hiển thị có chia sẻ được không — null = được; chuỗi = lý do (nói cho người dùng). */
export function scoreShareBlocker(s: ShareableScore | null, rendered: boolean): string | null {
  if (!s || !rendered) return "Mở và hiển thị xong bản nhạc trước khi chia sẻ.";
  if (!s.settings.showBeats) return "Bật hiện số phách để chia sẻ bản đã đánh số.";
  if (new TextEncoder().encode(s.xml).length > MAX_SHARE_XML_BYTES) return "Bản nhạc quá lớn để chia sẻ (tối đa 1 MB).";
  if (!s.title.trim()) return "Bản nhạc cần có tên.";
  return null;
}

/** Thiết lập gửi server — đúng các trường dựng lại bản khắc; server chuẩn hoá lại lần nữa. */
export function settingsPayload(st: ScoreSettings): Record<string, unknown> {
  return {
    showBeats: st.showBeats, countingLevel: st.countingLevel ?? "beats", compoundCountingMode: st.compoundCountingMode ?? "pulses",
    orientation: st.orientation ?? "portrait", color: st.color, sizePt: st.sizePt, distance: st.distance,
    grouping: { byMeter: st.grouping?.byMeter ?? {}, byMeasure: st.grouping?.byMeasure ?? {} },
  };
}

/** Lưu RIÊNG bản đang hiển thị (chưa đăng) — vòng đời chung của artifact (src/share/artifactApi.ts). Server chuẩn hoá + idempotent theo nội dung. */
export function saveNhipPhachForShare(s: ShareableScore) {
  return saveArtifactForShare("nhipphach", {
    title: s.title.trim().slice(0, 120), composer: s.composer?.trim().slice(0, 120) || null, musicxml: s.xml, settings: settingsPayload(s.settings),
  });
}

export type SharedScore = { title: string; composer: string | null; meter: string | null; xml: string; settings: ScoreSettings };

/** Dữ liệu artifact → bản nhạc chỉ-xem. Sai schema / thiếu → null (không crash, không đoán). */
export function sharedScoreFromArtifact(data: unknown, content: unknown): SharedScore | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof content !== "string" || !content) return null;
  const o = data as Record<string, unknown>;
  const st = (o.settings && typeof o.settings === "object" ? o.settings : null) as Record<string, unknown> | null;
  if (o.schema !== "nhipphach.score" || o.v !== 1 || typeof o.title !== "string" || !st) return null;
  const level = st.countingLevel, mode = st.compoundCountingMode, orient = st.orientation;
  if (level !== "beats" && level !== "eighths" && level !== "sixteenths") return null;
  if (mode !== "pulses" && mode !== "compound") return null;
  if (orient !== "portrait" && orient !== "landscape") return null;
  if (typeof st.color !== "string" || !/^#[0-9a-f]{6}$/i.test(st.color) || typeof st.sizePt !== "number" || typeof st.distance !== "number") return null;
  const g = (st.grouping && typeof st.grouping === "object" ? st.grouping : {}) as ScoreSettings["grouping"] & object;
  return {
    title: o.title, composer: typeof o.composer === "string" ? o.composer : null, meter: typeof o.meter === "string" ? o.meter : null, xml: content,
    settings: { showBeats: true, countingLevel: level, compoundCountingMode: mode, orientation: orient, color: st.color, sizePt: st.sizePt, distance: st.distance,
      grouping: { byMeter: g.byMeter ?? {}, byMeasure: g.byMeasure ?? {} } },
  };
}

export type LoadedShared = { status: "ready"; score: SharedScore; isMine: boolean; visibility: ArtifactVisibility } | { status: "signed_out" } | { status: "missing" } | { status: "error" };

export async function loadSharedScore(id: string): Promise<LoadedShared> {
  if (!isArtifactId(id)) return { status: "missing" };
  try {
    const { supabase } = await import("../../supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { status: "signed_out" };
    const { data, error } = await supabase.from("tool_artifacts").select("id,owner_id,tool,kind,data,content,visibility").eq("id", id).maybeSingle();
    if (error) return { status: "error" };
    if (!data || data.tool !== "nhipphach" || data.kind !== "score") return { status: "missing" };
    const score = sharedScoreFromArtifact(data.data, data.content);
    return score ? { status: "ready", score, isMine: data.owner_id === session.user.id, visibility: data.visibility === "shared" ? "shared" : "class" } : { status: "missing" };
  } catch { return { status: "error" }; }
}
