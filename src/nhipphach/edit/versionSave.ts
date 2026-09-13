import type { SaveResult, ScoreLibrary } from "../libraryRepository.ts";
import { readPrimaryMeter, readScoreMetadata } from "../scoreMetadata.ts";
import { CHANGE_NOTE_MAX } from "./commands.ts";
import { validateDraft } from "./validation.ts";
import type { ValidationDeps, ValidationReport } from "./validation.ts";
import { EditError } from "./xmlPatch.ts";

/**
 * Lưu nháp = một phiên bản mới (vN+1) của bài đang mở. Chỉ tới đây khi thầy bấm
 * "Lưu thay đổi"; mọi click trước đó không chạm Storage hay database.
 *
 * Thứ tự cứng: kiểm tra → (băm → tải lên → ghi phiên bản, đã là một giao dịch
 * trong `ScoreLibrary.save`). Kiểm tra không qua thì `save` KHÔNG được gọi —
 * điều này được test bằng thư viện giả đếm số lần gọi.
 */
export interface SaveDraftRequest {
  library: Pick<ScoreLibrary, "save">;
  scoreId: string;
  /** Tên file/tên bài đang mở — chỉ để đọc metadata dự phòng. */
  sourceFilename: string;
  original: string;
  draft: string;
  changeNote: string;
  pageCount: number | null;
  render: ValidationDeps["render"];
}

export interface SaveDraftOutcome {
  report: ValidationReport;
  /** `null` khi kiểm tra không qua — không có gì được ghi. */
  result: SaveResult | null;
}

export async function saveDraftAsVersion(req: SaveDraftRequest): Promise<SaveDraftOutcome> {
  if (req.draft === req.original)
    throw new EditError("EDIT_NOTHING_TO_SAVE", "Chưa có thay đổi nào để lưu.");
  const report = await validateDraft(req.original, req.draft, { render: req.render });
  if (!report.ok) return { report, result: null };
  const meta = readScoreMetadata(req.draft, req.sourceFilename);
  const result = await req.library.save({
    scoreId: req.scoreId,
    title: meta.title,
    composer: meta.composer,
    lyricist: meta.lyricist,
    sourceFilename: req.sourceFilename,
    primaryMeter: readPrimaryMeter(req.draft),
    pageCount: req.pageCount,
    changeType: "edit",
    changeNote: req.changeNote.trim().slice(0, CHANGE_NOTE_MAX) || null,
    xml: req.draft,
  });
  return { report, result };
}
