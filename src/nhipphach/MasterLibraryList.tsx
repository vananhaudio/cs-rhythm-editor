import { useEffect, useState } from "react";
import { listLibrary, matchesQuery } from "../thuvien/masterLibrary.ts";
import type { LibraryItem } from "../thuvien/masterLibrary.ts";
import { hop, phu } from "./panelStyles.ts";

/**
 * Thư viện bản nhạc (kho gốc `musicxml_library`) nhìn từ Nhịp Phách.
 *
 * Chỉ ĐỌC danh sách — cùng `listLibrary` + tìm không dấu `matchesQuery` của
 * /thuvien. Bấm một bài chỉ báo id lên trang; trang tự đọc bản gốc và mở.
 * Không tải file, không sao chép gì ở đây.
 */
export function MasterLibraryList({ onOpen, opening, maxHeight }: {
  onOpen: (item: LibraryItem) => void;
  opening: string | null;
  maxHeight?: number | string;
}) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    listLibrary()
      .then((rows) => { if (active) { setItems(rows); setState("ready"); } })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Chưa tải được Thư viện bản nhạc.");
        setState("error");
      });
    return () => { active = false; };
  }, [attempt]);

  const shown = items.filter((item) => matchesQuery(item, query));
  const muted = { margin: "14px 12px", color: "var(--ink-hint)", fontSize: 13 } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, textAlign: "left" }}>
      <div style={{ padding: "0 0 10px" }}>
        <input
          type="search"
          aria-label="Tìm trong Thư viện bản nhạc"
          placeholder="Tìm tên bài hoặc tác giả…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 15, background: "var(--surface)", color: "var(--ink)" }}
        />
      </div>
      <div style={{ overflowY: "auto", maxHeight, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
        {state === "loading" && <p style={muted} aria-live="polite">Đang tải Thư viện bản nhạc…</p>}
        {state === "error" && (
          <p role="alert" style={{ ...muted, color: "var(--np-danger)" }}>
            {error}{" "}
            <button type="button" className="np-btn np-btn-quiet" onClick={() => { setState("loading"); setAttempt((n) => n + 1); }}>Thử lại</button>
          </p>
        )}
        {state === "ready" && !shown.length && (
          <p style={muted}>{items.length ? "Không tìm thấy bản nhạc phù hợp." : "Thư viện bản nhạc chưa có bài nào."}</p>
        )}
        {state === "ready" && shown.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            disabled={opening !== null}
            aria-label={`Mở ${item.title}`}
            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 14px", border: 0, borderTop: i ? "1px solid var(--line)" : 0, background: "transparent", color: "var(--ink)", font: "inherit", textAlign: "left", cursor: opening ? "default" : "pointer", minHeight: 48 }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14.5, overflowWrap: "anywhere" }}>{item.title}</span>
              {item.composer && <span style={{ display: "block", color: "var(--ink-soft)", fontSize: 13, overflowWrap: "anywhere" }}>{item.composer}</span>}
            </span>
            <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: "var(--indigo)" }}>
              {opening === item.id ? "Đang mở…" : "Mở"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cùng khung hộp thoại với "Bản nhạc của tôi" — hai nguồn, một kiểu giao diện. */
export function MasterLibraryPanel({ onOpen, opening, onClose }: {
  onOpen: (item: LibraryItem) => void;
  opening: string | null;
  onClose: () => void;
}) {
  return (
    <div style={phu} role="dialog" aria-modal="true" aria-label="Thư viện bản nhạc">
      <div style={hop}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 16, color: "var(--ink)" }}>Thư viện bản nhạc</strong>
          <button className="np-btn np-btn-quiet" onClick={onClose}>Đóng</button>
        </div>
        <div style={{ padding: "12px 16px 16px", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <MasterLibraryList onOpen={onOpen} opening={opening} maxHeight="60vh" />
        </div>
      </div>
    </div>
  );
}
