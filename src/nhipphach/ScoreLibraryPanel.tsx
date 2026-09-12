import { useCallback, useEffect, useState } from "react";
import type { ScoreLibrary, ScoreSummary, ScoreVersion } from "./libraryRepository.ts";

/**
 * Thư viện bài hát.
 *
 * Một tấm phủ gọn: tìm, mở, và xem lịch sử phiên bản. KHÔNG phải trình quản lý
 * file — không cây thư mục, không thẻ, không kéo thả hàng loạt. Mở một bài là
 * đưa MusicXML trở lại đúng pipeline đang chạy, không có đường khắc nhạc thứ hai.
 */
export interface LibraryOpenEvent {
  xml: string;
  name: string;
  scoreId: string;
  versionId: string;
  versionNumber: number;
  /** Mở bản cũ chỉ để xem/xuất: nó KHÔNG trở thành bản hiện hành. */
  isCurrent: boolean;
}

const ngay = (iso: string) => {
  const d = new Date(iso);
  const homNay = new Date();
  const cungNgay =
    d.getFullYear() === homNay.getFullYear() &&
    d.getMonth() === homNay.getMonth() &&
    d.getDate() === homNay.getDate();
  const gio = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return cungNgay ? `hôm nay ${gio}` : d.toLocaleDateString("vi-VN");
};

const phu: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(24,24,27,.55)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "5vh 16px",
  zIndex: 60,
};
const hop: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: 14,
  width: "min(680px, 100%)",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 18px 48px rgba(0,0,0,.28)",
};

export function ScoreLibraryPanel({
  library,
  onOpen,
  onClose,
  canManage = false,
}: {
  library: ScoreLibrary;
  onOpen: (event: LibraryOpenEvent) => void;
  onClose: () => void;
  canManage?: boolean;
}) {
  const [tim, setTim] = useState("");
  const [danhSach, setDanhSach] = useState<ScoreSummary[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [moLichSu, setMoLichSu] = useState<ScoreSummary | null>(null);
  const [phienBan, setPhienBan] = useState<ScoreVersion[]>([]);
  const [dangMo, setDangMo] = useState<string | null>(null);

  const nap = useCallback(
    async (term: string) => {
      setDangTai(true);
      setLoi("");
      try {
        setDanhSach(await library.list(term));
      } catch (e) {
        setLoi(e instanceof Error ? e.message : "Chưa tải được thư viện.");
      } finally {
        setDangTai(false);
      }
    },
    [library]
  );

  // Gõ tới đâu tìm tới đó, nhưng chờ người dùng ngừng gõ rồi mới hỏi máy chủ.
  useEffect(() => {
    const t = setTimeout(() => void nap(tim), tim ? 250 : 0);
    return () => clearTimeout(t);
  }, [tim, nap]);

  async function xemLichSu(score: ScoreSummary) {
    setMoLichSu(score);
    setPhienBan([]);
    try {
      setPhienBan(await library.versions(score.id));
    } catch (e) {
      setLoi(e instanceof Error ? e.message : "Chưa tải được lịch sử phiên bản.");
    }
  }

  async function mo(score: ScoreSummary, version?: ScoreVersion) {
    const chon =
      version ??
      (await library.versions(score.id)).find((v) => v.id === score.currentVersionId);
    if (!chon) {
      setLoi("Bài này chưa có phiên bản nào để mở.");
      return;
    }
    setDangMo(score.id);
    setLoi("");
    try {
      const xml = await library.readVersion(chon);
      onOpen({
        xml,
        name: score.title,
        scoreId: score.id,
        versionId: chon.id,
        versionNumber: chon.versionNumber,
        isCurrent: chon.id === score.currentVersionId,
      });
    } catch (e) {
      setLoi(e instanceof Error ? e.message : "Không mở được bản nhạc.");
    } finally {
      setDangMo(null);
    }
  }

  return (
    <div style={phu} role="dialog" aria-modal="true" aria-label="Thư viện bài hát">
      <div style={hop}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <strong style={{ fontSize: 16 }}>
            {moLichSu ? `Phiên bản · ${moLichSu.title}` : "Thư viện bài hát"}
          </strong>
          <button
            className="np-btn np-btn-quiet"
            onClick={() => (moLichSu ? setMoLichSu(null) : onClose())}
          >
            {moLichSu ? "← Quay lại" : "Đóng"}
          </button>
        </div>

        {!moLichSu && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <input
              aria-label="Tìm bài hát"
              placeholder="Tìm bài hát hoặc tác giả…"
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--line)",
                borderRadius: 9,
                fontSize: 14,
              }}
            />
          </div>
        )}

        <div style={{ overflowY: "auto", padding: "6px 8px 12px" }}>
          {loi && (
            <p style={{ color: "var(--np-danger)", margin: "10px 12px", fontSize: 13 }}>{loi}</p>
          )}

          {moLichSu ? (
            phienBan.length === 0 ? (
              <p style={{ margin: "14px 12px", color: "var(--ink-hint)", fontSize: 13 }}>
                Đang tải lịch sử…
              </p>
            ) : (
              phienBan.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      v{v.versionNumber}
                      {v.id === moLichSu.currentVersionId && (
                        <span style={{ color: "var(--online-ink)", fontWeight: 500 }}> · hiện tại</span>
                      )}
                      {v.versionNumber === 1 && (
                        <span style={{ color: "var(--ink-hint)", fontWeight: 500 }}> · bản gốc</span>
                      )}
                    </div>
                    <div style={{ color: "var(--ink-hint)", fontSize: 12.5 }}>
                      {ngay(v.createdAt)}
                      {v.changeNote ? ` · “${v.changeNote}”` : ""}
                    </div>
                  </div>
                  <button className="np-btn np-btn-quiet" onClick={() => void mo(moLichSu, v)}>
                    Mở
                  </button>
                </div>
              ))
            )
          ) : dangTai ? (
            <p style={{ margin: "14px 12px", color: "var(--ink-hint)", fontSize: 13 }}>Đang tải…</p>
          ) : danhSach.length === 0 ? (
            <p style={{ margin: "14px 12px", color: "var(--ink-hint)", fontSize: 13 }}>
              {tim
                ? "Không có bài nào khớp."
                : "Thư viện còn trống. Mở một bản nhạc rồi bấm “Lưu vào thư viện”."}
            </p>
          ) : (
            danhSach.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.title}</div>
                  {(s.composer || s.lyricist) && (
                    <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                      {[s.composer, s.lyricist].filter(Boolean).join(" & ")}
                    </div>
                  )}
                  <div style={{ color: "var(--ink-hint)", fontSize: 12.5 }}>
                    {[
                      s.primaryMeter,
                      s.versionCount > 1 ? `${s.versionCount} phiên bản` : null,
                      `cập nhật ${ngay(s.updatedAt)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {s.versionCount > 1 && (
                    <button className="np-btn np-btn-quiet" onClick={() => void xemLichSu(s)}>
                      Phiên bản
                    </button>
                  )}
                  <button
                    className="np-btn np-btn-primary"
                    disabled={dangMo === s.id}
                    onClick={() => void mo(s)}
                  >
                    {dangMo === s.id ? "Đang mở…" : "Mở"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {canManage && !moLichSu && danhSach.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--line)",
              color: "var(--ink-hint)",
              fontSize: 12,
            }}
          >
            {danhSach.length} bài trong thư viện
          </div>
        )}
      </div>
    </div>
  );
}
