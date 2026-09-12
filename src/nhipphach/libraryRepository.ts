import type { SupabaseClient } from "@supabase/supabase-js";
import { byteLength, sha256Hex } from "./scoreHash.ts";

export const BUCKET = "nhipphach-scores";
const SCORES = "nhipphach_scores";
const VERSIONS = "nhipphach_score_versions";
/** Lưu bài đi qua function một-giao-dịch, không phải ba request rời. */
const SAVE_VERSION = "nhipphach_save_version";
/**
 * Hai bảng nối nhau bằng HAI khoá ngoại (`versions.score_id` và
 * `scores.current_version_id`), nên phải gọi đích danh khoá cần dùng — không thì
 * PostgREST từ chối vì không biết chọn đường nào.
 */
const QUA_SCORE_ID = "nhipphach_score_versions_score_id_fkey";

export interface ScoreSummary {
  id: string;
  title: string;
  composer: string | null;
  lyricist: string | null;
  primaryMeter: string | null;
  pageCount: number | null;
  versionCount: number;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  updatedAt: string;
}
export interface ScoreVersion {
  id: string;
  scoreId: string;
  versionNumber: number;
  parentVersionId: string | null;
  storagePath: string;
  sha256: string;
  sizeBytes: number;
  changeType: "original" | "edit" | "import";
  changeNote: string | null;
  createdAt: string;
}
export interface SaveRequest {
  /** Có id là lưu thêm phiên bản cho bài đã có; không có là tạo bài mới. */
  scoreId?: string;
  title: string;
  composer?: string | null;
  lyricist?: string | null;
  sourceFilename?: string | null;
  primaryMeter?: string | null;
  pageCount?: number | null;
  changeNote?: string | null;
  changeType?: ScoreVersion["changeType"];
  xml: string;
}
export interface SaveResult {
  scoreId: string;
  versionId: string;
  versionNumber: number;
  createdScore: boolean;
}
/** Kết quả dò trùng: cùng SHA-256 nghĩa là đúng file đó đã nằm trong kho. */
export interface DuplicateHit {
  scoreId: string;
  title: string;
  versionNumber: number;
}

export interface ScoreLibrary {
  list(search?: string): Promise<ScoreSummary[]>;
  versions(scoreId: string): Promise<ScoreVersion[]>;
  /** Trả về chính MusicXML đã lưu — cùng byte, cùng hash. */
  readVersion(version: Pick<ScoreVersion, "storagePath">): Promise<string>;
  findDuplicate(xml: string): Promise<DuplicateHit | null>;
  save(request: SaveRequest): Promise<SaveResult>;
  rename(scoreId: string, title: string): Promise<void>;
  archive(scoreId: string): Promise<void>;
}

type Row = Record<string, unknown>;
const chuoi = (v: unknown) => (v == null ? null : String(v));

const summary = (r: Row): ScoreSummary => {
  const versions = (r.nhipphach_score_versions ?? []) as {
    id: string;
    version_number: number;
  }[];
  const current = versions.find((v) => v.id === r.current_version_id);
  return {
    id: String(r.id),
    title: String(r.title),
    composer: chuoi(r.composer),
    lyricist: chuoi(r.lyricist),
    primaryMeter: chuoi(r.primary_meter),
    pageCount: r.page_count == null ? null : Number(r.page_count),
    versionCount: versions.length,
    currentVersionId: chuoi(r.current_version_id),
    currentVersionNumber: current?.version_number ?? null,
    updatedAt: String(r.updated_at),
  };
};

const version = (r: Row): ScoreVersion => ({
  id: String(r.id),
  scoreId: String(r.score_id),
  versionNumber: Number(r.version_number),
  parentVersionId: chuoi(r.parent_version_id),
  storagePath: String(r.storage_path),
  sha256: String(r.sha256),
  sizeBytes: Number(r.size_bytes),
  changeType: r.change_type as ScoreVersion["changeType"],
  changeNote: chuoi(r.change_note),
  createdAt: String(r.created_at),
});

/**
 * Thư viện bài hát trên Supabase.
 *
 * File MusicXML nằm trong Storage; database chỉ giữ metadata và đồ thị phiên
 * bản. Không có XML nào đi vào bảng — kể cả dưới dạng base64.
 */
export class SupabaseScoreLibrary implements ScoreLibrary {
  private client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async list(search = ""): Promise<ScoreSummary[]> {
    let query = this.client
      .from(SCORES)
      .select(
        "id,title,composer,lyricist,primary_meter,page_count,current_version_id,updated_at," +
          `nhipphach_score_versions!${QUA_SCORE_ID}(id,version_number)`
      )
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    const term = search.trim();
    // Tìm theo tên bài và tên tác giả — đúng hai thứ ô tìm kiếm hứa hẹn.
    if (term) query = query.or(`title.ilike.%${term}%,composer.ilike.%${term}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Row[]).map(summary);
  }

  async versions(scoreId: string): Promise<ScoreVersion[]> {
    const { data, error } = await this.client
      .from(VERSIONS)
      .select("*")
      .eq("score_id", scoreId)
      .order("version_number", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(version);
  }

  async readVersion(v: Pick<ScoreVersion, "storagePath">): Promise<string> {
    // Tải qua SDK nên request mang JWT và RLS của Storage vẫn có hiệu lực.
    // KHÔNG dùng URL công khai: không ai được đoán đường dẫn để lấy bản nhạc.
    const { data, error } = await this.client.storage.from(BUCKET).download(v.storagePath);
    if (error || !data) throw new Error(error?.message ?? "Không tải được bản nhạc.");
    return await data.text();
  }

  async findDuplicate(xml: string): Promise<DuplicateHit | null> {
    const sha = await sha256Hex(xml);
    const { data, error } = await this.client
      .from(VERSIONS)
      .select(
        `version_number,score_id,nhipphach_scores!${QUA_SCORE_ID}(title,archived_at)`
      )
      .eq("sha256", sha)
      .limit(5);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as Row[]) {
      // PostgREST trả quan hệ many-to-one là object, nhưng tuỳ phiên bản có thể
      // gói trong mảng — nhận cả hai thay vì đoán.
      const raw = row.nhipphach_scores;
      const score = (Array.isArray(raw) ? raw[0] : raw) as
        | { title: string; archived_at: string | null }
        | undefined;
      if (!score || score.archived_at) continue;
      return {
        scoreId: String(row.score_id),
        title: String(score.title),
        versionNumber: Number(row.version_number),
      };
    }
    return null;
  }

  /**
   * Tải file lên rồi ghi metadata trong MỘT giao dịch.
   *
   * Thứ tự cố ý: object lên trước, vì một object mồ côi chỉ tốn chỗ, còn một
   * dòng database trỏ vào file không tồn tại thì làm hỏng cả bài — mở ra là
   * lỗi. Database hỏng thì object vừa tải được dọn ngay; dọn hỏng cũng không
   * được che mất lỗi thật.
   */
  async save(request: SaveRequest): Promise<SaveResult> {
    const xml = request.xml;
    const sha = await sha256Hex(xml);
    const size = byteLength(xml);
    // Đường dẫn sinh từ id của BÀI, không bao giờ từ tên file người dùng đặt.
    // Bài mới thì id sinh ở đây và gửi kèm, để file nằm đúng thư mục của nó
    // ngay từ phiên bản đầu — không có thư mục tạm nào lạc đâu đó.
    const scoreKey = request.scoreId ?? crypto.randomUUID();
    const stamp = new Date().toISOString().replace(/[^\dTZ]/g, "");
    const path = `${scoreKey}/${stamp}-${sha.slice(0, 12)}.musicxml`;

    const upload = await this.client.storage
      .from(BUCKET)
      .upload(path, new Blob([xml], { type: "application/xml" }), {
        contentType: "application/xml",
        upsert: false,
      });
    if (upload.error) throw new Error(upload.error.message);

    try {
      const { data, error } = await this.client.rpc(SAVE_VERSION, {
        score_json: {
          id: scoreKey,
          title: request.title,
          composer: request.composer ?? null,
          lyricist: request.lyricist ?? null,
          source_filename: request.sourceFilename ?? null,
          primary_meter: request.primaryMeter ?? null,
          page_count: request.pageCount ?? null,
        },
        version_json: {
          storage_path: path,
          sha256: sha,
          size_bytes: size,
          change_type: request.changeType ?? (request.scoreId ? "edit" : "original"),
          change_note: request.changeNote ?? null,
        },
      });
      if (error) throw new Error(error.message);
      const row = data as Row;
      return {
        scoreId: String(row.score_id),
        versionId: String(row.version_id),
        versionNumber: Number(row.version_number),
        createdScore: Boolean(row.created_score),
      };
    } catch (e) {
      // Dọn object vừa tải để không để lại rác. Lỗi dọn KHÔNG được nuốt lỗi gốc.
      await this.client.storage.from(BUCKET).remove([path]).catch(() => undefined);
      throw e;
    }
  }

  async rename(scoreId: string, title: string): Promise<void> {
    const clean = title.trim();
    if (!clean) throw new Error("Tên bài không được để trống.");
    // Đổi nhãn hiển thị. KHÔNG đụng tới <work-title> bên trong file đã lưu.
    const { error } = await this.client
      .from(SCORES)
      .update({ title: clean, updated_at: new Date().toISOString() })
      .eq("id", scoreId);
    if (error) throw new Error(error.message);
  }

  async archive(scoreId: string): Promise<void> {
    // Lưu trữ là đánh dấu, không huỷ: file trong Storage vẫn nguyên.
    const { error } = await this.client
      .from(SCORES)
      .update({ archived_at: new Date().toISOString() })
      .eq("id", scoreId);
    if (error) throw new Error(error.message);
  }
}
