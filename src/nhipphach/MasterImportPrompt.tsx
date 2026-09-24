import { useEffect, useState } from "react";
import type { ScoreLibrary } from "./libraryRepository.ts";
import type { LibraryOpenEvent } from "./ScoreLibraryPanel.tsx";
import { copyMasterToNhipPhach, getMasterCopySource } from "./masterCopy.ts";
import type { MasterCopySource } from "./masterCopy.ts";

export function MasterImportPrompt({ masterId, library, canSave, onImported, onClose }: {
  masterId: string;
  library: ScoreLibrary | null;
  canSave: boolean;
  onImported: (event: LibraryOpenEvent) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<MasterCopySource | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getMasterCopySource(masterId).then(item => { if (!cancelled) setSource(item); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Không đọc được bản gốc."); });
    return () => { cancelled = true; };
  }, [masterId]);

  async function copy() {
    if (!source || !library || !canSave) return;
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

  return <div role="dialog" aria-modal="true" aria-label="Sao chép bản gốc vào Nhịp Phách" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ width: "min(460px,100%)", background: "var(--surface)", color: "var(--ink)", borderRadius: 14, padding: 20, boxShadow: "0 18px 48px rgba(0,0,0,.3)" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Đưa bản gốc vào Nhịp Phách</h2>
      {source ? <><strong>{source.title}</strong><p style={{ margin: "5px 0", fontSize: 13 }}>{source.composer || "Chưa ghi tác giả"} · {source.originalFilename} · {(source.sizeBytes / 1024).toFixed(1)} KB</p></> : !error && <p>Đang đọc bản gốc…</p>}
      <p style={{ fontSize: 13 }}>Nhịp Phách sẽ lưu một bản sao và phiên bản riêng. Sửa bản gốc sau này không đổi bản sao này.</p>
      {!canSave && <p role="status">Tài khoản này chưa có quyền lưu vào Thư viện Nhịp Phách.</p>}
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="np-btn np-btn-quiet" onClick={onClose}>Đóng</button>
        <button type="button" className="np-btn np-btn-primary" onClick={() => void copy()} disabled={!source || !library || !canSave || busy}>{busy ? "Đang sao chép…" : "Lưu bản sao"}</button>
      </div>
    </div>
  </div>;
}
