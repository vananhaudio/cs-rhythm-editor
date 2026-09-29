import { useEffect, useState } from "react";
import type { DuplicateHit, ScoreLibrary } from "./libraryRepository.ts";
import type { LibraryOpenEvent } from "./ScoreLibraryPanel.tsx";
import { copyMasterToNhipPhach, findExistingCopy, getMasterCopySource, openExistingCopy } from "./masterCopy.ts";
import type { MasterCopySource } from "./masterCopy.ts";

/** `undefined` = đang dò; `null` = chưa có bản nào cùng nội dung. */
type Existing = DuplicateHit | null | undefined;

export function MasterImportPrompt({ masterId, library, canSave, onImported, onClose }: {
  masterId: string;
  library: ScoreLibrary | null;
  canSave: boolean;
  onImported: (event: LibraryOpenEvent) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<MasterCopySource | null>(null);
  const [existing, setExisting] = useState<Existing>(undefined);
  const [checkError, setCheckError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getMasterCopySource(masterId).then(item => { if (!cancelled) setSource(item); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Không đọc được bản gốc."); });
    return () => { cancelled = true; };
  }, [masterId]);

  // Dò trùng TRƯỚC khi cho sao chép: cùng SHA-256 thì không âm thầm tạo thêm bài.
  useEffect(() => {
    if (!source || !library) return;
    let cancelled = false;
    findExistingCopy(source, library).then(hit => { if (!cancelled) setExisting(hit); })
      .catch(err => { if (!cancelled) setCheckError(err instanceof Error ? err.message : "Chưa kiểm tra được bản đã có."); });
    return () => { cancelled = true; };
  }, [source, library, checkAttempt]);

  async function copy() {
    if (!source || !library || !canSave || existing === undefined) return;
    setBusy(true); setError("");
    try {
      const saved = await copyMasterToNhipPhach(source, library);
      onImported({
        xml: source.musicxmlText, name: source.title,
        scoreId: saved.scoreId, versionId: saved.versionId,
        versionNumber: saved.versionNumber, isCurrent: true,
      });
    } catch (err) { setError(err instanceof Error ? err.message : "Chưa sao chép được bản nhạc."); }
    finally { setBusy(false); }
  }

  async function openExisting() {
    if (!existing || !library) return;
    setBusy(true); setError("");
    try { onImported(await openExistingCopy(existing, library)); }
    catch (err) { setError(err instanceof Error ? err.message : "Không mở được bài đã có."); }
    finally { setBusy(false); }
  }

  const checking = !!source && !!library && existing === undefined && !checkError;
  return <div role="dialog" aria-modal="true" aria-label="Sao chép bản gốc vào Nhịp Phách" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ width: "min(460px,100%)", background: "var(--surface)", color: "var(--ink)", borderRadius: 14, padding: 20, boxShadow: "0 18px 48px rgba(0,0,0,.3)" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Đưa bản gốc vào Nhịp Phách</h2>
      {source ? <><strong>{source.title}</strong><p style={{ margin: "5px 0", fontSize: 13 }}>{source.composer || "Chưa ghi tác giả"} · {source.originalFilename} · {(source.sizeBytes / 1024).toFixed(1)} KB</p></> : !error && <p>Đang đọc bản gốc…</p>}
      {existing
        ? <p role="status" style={{ fontSize: 13 }}>Nhịp Phách đã có bài <strong>“{existing.title}”</strong> với nội dung giống hệt bản gốc này (phiên bản {existing.versionNumber}). Mở bài đó để làm tiếp, hoặc chủ động tạo thêm một bản làm việc mới.</p>
        : <p style={{ fontSize: 13 }}>Nhịp Phách sẽ lưu một bản sao và phiên bản riêng. Sửa bản gốc sau này không đổi bản sao này.</p>}
      {checking && <p role="status" style={{ fontSize: 13 }}>Đang kiểm tra bản đã có…</p>}
      {checkError && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>Chưa kiểm tra được bản đã có: {checkError}{" "}
        <button type="button" className="np-btn np-btn-quiet" onClick={() => { setCheckError(""); setCheckAttempt(n => n + 1); }}>Thử lại</button></p>}
      {!canSave && <p role="status">Tài khoản này chưa có quyền lưu vào Thư viện Nhịp Phách.</p>}
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="np-btn np-btn-quiet" onClick={onClose} disabled={busy}>Đóng</button>
        {existing ? <>
          <button type="button" className="np-btn" onClick={() => void copy()} disabled={!canSave || busy}>Tạo thêm bản mới</button>
          <button type="button" className="np-btn np-btn-primary" onClick={() => void openExisting()} disabled={busy}>{busy ? "Đang mở…" : "Mở bản đã có"}</button>
        </> : <button type="button" className="np-btn np-btn-primary" onClick={() => void copy()} disabled={!source || !library || !canSave || busy || existing === undefined}>{busy ? "Đang sao chép…" : "Lưu bản sao"}</button>}
      </div>
    </div>
  </div>;
}
