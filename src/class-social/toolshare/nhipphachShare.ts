// Nhịp & Phách → Tool Share (artifact). Sản phẩm canonical = MusicXML ĐANG HIỂN THỊ + thiết lập đếm/trình bày;
// bản khắc dựng lại từ hai thứ đó (không gửi SVG/PDF/PNG). Chỉ chạy khi người dùng bấm "Chia sẻ lên cộng đồng"
// (ghi) hoặc khi mở /nhipphach?artifact=<id> (đọc). KHÔNG đọc/ghi musicxml_library (kho master) hay kho Nhịp Phách.
// supabase nạp ĐỘNG → phần thuần test được trên Node.
import type { ScoreSettings } from "../../musicxml-beats/renderer/types";
import { shareErrorText } from "./toolShareApi";

export const MAX_SHARE_XML_BYTES = 1_048_576;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isArtifactId = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);

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

export type ShareScoreResult = { ok: true; artifactId: string | null } | { ok: false; message: string };

export async function shareNhipPhachScore(s: ShareableScore, clientKey: string): Promise<ShareScoreResult> {
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  try {
    const { supabase } = await import("../../supabase");
    const { data, error } = await supabase.rpc("social_share_tool_result", {
      p_tool: "nhipphach", p_client_key: clientKey,
      p_result: { kind: "score", score: { title: s.title.trim().slice(0, 120), composer: s.composer?.trim().slice(0, 120) || null, musicxml: s.xml, settings: settingsPayload(s.settings) } },
    });
    if (error || typeof data !== "string") return { ok: false, message: shareErrorText(error?.message, online) };
    const { data: post } = await supabase.from("class_posts").select("tool_share").eq("id", data).maybeSingle();
    const art = (post?.tool_share as { artifact_id?: unknown } | null)?.artifact_id;
    return { ok: true, artifactId: typeof art === "string" && isArtifactId(art) ? art : null };
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, online) };
  }
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

export type LoadedShared = { status: "ready"; score: SharedScore; isMine: boolean } | { status: "signed_out" } | { status: "missing" } | { status: "error" };

export async function loadSharedScore(id: string): Promise<LoadedShared> {
  if (!isArtifactId(id)) return { status: "missing" };
  try {
    const { supabase } = await import("../../supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { status: "signed_out" };
    const { data, error } = await supabase.from("tool_artifacts").select("id,owner_id,tool,kind,data,content").eq("id", id).maybeSingle();
    if (error) return { status: "error" };
    if (!data || data.tool !== "nhipphach" || data.kind !== "score") return { status: "missing" };
    const score = sharedScoreFromArtifact(data.data, data.content);
    return score ? { status: "ready", score, isMine: data.owner_id === session.user.id } : { status: "missing" };
  } catch { return { status: "error" }; }
}
