import { parseMusicXML } from "../musicxml-beats/parser.ts";
import { byteLength, sha256Hex } from "./scoreHash.ts";
import type { DuplicateHit, SaveResult, ScoreLibrary } from "./libraryRepository.ts";

/** Source-only handoff. The saved Nhịp Phách version never reads Master again. */
export interface MasterCopySource {
  id: string;
  title: string;
  composer: string | null;
  originalFilename: string;
  musicxmlText: string;
  contentHash: string;
  sizeBytes: number;
}

export async function getMasterCopySource(id: string): Promise<MasterCopySource> {
  const { supabase } = await import("../supabase");
  const { data, error } = await supabase.from("musicxml_library")
    .select("id,title,composer,original_filename,musicxml_text,content_hash,size_bytes")
    .eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Không đọc được bản gốc.");
  const source: MasterCopySource = {
    id: String(data.id), title: String(data.title), composer: data.composer == null ? null : String(data.composer),
    originalFilename: String(data.original_filename), musicxmlText: String(data.musicxml_text),
    contentHash: String(data.content_hash), sizeBytes: Number(data.size_bytes),
  };
  if (byteLength(source.musicxmlText) !== source.sizeBytes || await sha256Hex(source.musicxmlText) !== source.contentHash) {
    throw new Error("Bản gốc không khớp mã kiểm tra nội dung.");
  }
  parseMusicXML(source.musicxmlText);
  return source;
}

export async function copyMasterToNhipPhach(source: MasterCopySource, library: Pick<ScoreLibrary, "save">): Promise<SaveResult> {
  if (byteLength(source.musicxmlText) !== source.sizeBytes || await sha256Hex(source.musicxmlText) !== source.contentHash) {
    throw new Error("Bản gốc đã thay đổi; hãy mở lại trước khi sao chép.");
  }
  parseMusicXML(source.musicxmlText);
  return library.save({
    title: source.title, composer: source.composer,
    sourceFilename: source.originalFilename, xml: source.musicxmlText,
    changeType: "import", primaryMeter: null, pageCount: null,
  });
}

/**
 * Nhịp Phách đã có bản CÙNG SHA-256 với bản gốc chưa? Dùng lại `findDuplicate`
 * của kho — không có cơ chế dò trùng thứ hai. Tên/tác giả/tên file KHÔNG tham gia.
 */
export function findExistingCopy(source: MasterCopySource, library: Pick<ScoreLibrary, "findDuplicate">): Promise<DuplicateHit | null> {
  return library.findDuplicate(source.musicxmlText);
}

/**
 * Mở bài đã có thay vì sao chép thêm: đọc phiên bản HIỆN HÀNH của bài đó (con trỏ
 * current chỉ tiến, nên là số phiên bản lớn nhất) — cùng đường `versions` +
 * `readVersion` mà ScoreLibraryPanel dùng. Không tải file, không tạo phiên bản.
 */
export async function openExistingCopy(hit: DuplicateHit, library: Pick<ScoreLibrary, "versions" | "readVersion">) {
  const [current] = await library.versions(hit.scoreId);
  if (!current) throw new Error("Bài đã có trong Nhịp Phách chưa có phiên bản nào để mở.");
  const xml = await library.readVersion(current);
  return {
    xml, name: hit.title, scoreId: hit.scoreId, versionId: current.id,
    versionNumber: current.versionNumber, isCurrent: true,
  };
}
