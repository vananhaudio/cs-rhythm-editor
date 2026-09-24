import { parseMusicXML } from "../musicxml-beats/parser.ts";
import { byteLength, sha256Hex } from "./scoreHash.ts";
import type { SaveResult, ScoreLibrary } from "./libraryRepository.ts";

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
