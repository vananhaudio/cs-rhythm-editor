// /nhipphach?artifact=<id> — bản nhạc đã đánh số phách được chia sẻ, CHỈ XEM: dựng lại bản khắc từ đúng MusicXML +
// thiết lập đã chia sẻ (cùng bộ khắc của công cụ). Không lưu, không sửa, không xuất, không đụng kho bài.
// Chủ bài thấy "Bản của bạn" + "Gỡ chia sẻ". Trang hiển thị bằng <img> (SVG không chạy script).
import { useEffect, useState } from "react";
import { createAnnotatedScoreRenderer } from "../musicxml-beats/renderer/verovioAdapter";
import ShareSheet from "../share/ShareSheet";
import { publishArtifact } from "../share/artifactApi";
import { artifactRef } from "../share/shareRef";
import { useArtifactLifecycle } from "../share/useArtifactLifecycle";
import { COUNTING_LEVEL_LABEL } from "../class-social/toolshare/registry";
import { loadSharedScore, type LoadedShared } from "../class-social/toolshare/nhipphachShare";
import { NP_CSS, NP_SCOPE } from "./theme";

type Pages = { status: "rendering" } | { status: "ok"; urls: string[] } | { status: "fail" };

export default function SharedScoreView({ artifactId }: { artifactId: string }) {
  const [state, setState] = useState<LoadedShared | { status: "loading" }>({ status: "loading" });
  const [pages, setPages] = useState<Pages>({ status: "rendering" });
  const [sharing, setSharing] = useState(false);
  // Vòng đời dùng chung với BMS (gỡ bài riêng = xoá · gỡ khỏi cộng đồng ≠ xoá · không forward)
  const life = useArtifactLifecycle(artifactId, state.status === "ready" ? state : null, () => setState({ status: "missing" }), "Bản nhạc gốc của bạn không đổi.");

  useEffect(() => { void loadSharedScore(artifactId).then(setState); }, [artifactId]);
  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false; let urls: string[] = [];
    void (async () => {
      try {
        const r = await createAnnotatedScoreRenderer();
        const out = r.render(state.score.xml, state.score.settings);
        r.destroy();
        urls = out.pages.map(p => URL.createObjectURL(new Blob([p.svg], { type: "image/svg+xml" })));
        if (!cancelled) setPages({ status: "ok", urls });
      } catch { if (!cancelled) setPages({ status: "fail" }); }
    })();
    return () => { cancelled = true; urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [state]);

  return (
    <main className={NP_SCOPE}>
      <style>{NP_CSS}</style>
      <div className="np-wrap np-shared" style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 40px", boxSizing: "border-box" }}>
        <div className="np-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <a className="np-link" href="/me">‹ Trang chủ</a>
          <span className="np-muted" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Nhịp &amp; Phách · Bản nhạc</span>
        </div>
        {state.status !== "ready" ? (
          <section className="np-card" style={{ textAlign: "center", padding: 28 }}>
            <p className="np-shared-msg" style={{ fontWeight: 700, margin: "0 0 14px" }}>
              {state.status === "loading" ? "Đang mở bản nhạc…"
                : state.status === "signed_out" ? "Đăng nhập Class để xem bản nhạc này."
                : state.status === "missing" ? "Bản nhạc này không còn được chia sẻ hoặc bạn chưa có quyền xem."
                : "Chưa mở được bản nhạc. Kiểm tra mạng rồi thử lại."}
            </p>
            {state.status === "signed_out" && <a className="np-btn np-btn-primary" href="/me">Đăng nhập</a>}
            {state.status === "error" && <button className="np-btn" onClick={() => window.location.reload()}>Thử lại</button>}
          </section>
        ) : (
          <>
            <section className="np-card" style={{ marginBottom: 14 }}>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, overflowWrap: "anywhere" }}>{state.score.title}</h1>
              <p className="np-muted" style={{ margin: 0 }}>
                {[state.score.composer, state.score.meter ? `Nhịp ${state.score.meter}` : null, COUNTING_LEVEL_LABEL[state.score.settings.countingLevel ?? "beats"]].filter(Boolean).join(" · ")}
              </p>
              <div className="np-shared-banner np-row" style={{ marginTop: 10, gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="np-muted" style={{ flex: 1, minWidth: 200, fontSize: 13 }}>
                  {state.isMine
                    ? (life.isPrivate ? <><b>Bản của bạn</b> · đang gửi riêng, chưa đăng lên cộng đồng</> : <><b>Bản của bạn</b> · đang chia sẻ cho Class</>)
                    : (life.isPrivate ? <><b>Bản được gửi riêng cho bạn</b> · chỉ xem, không sửa bản gốc</> : <><b>Bản chia sẻ</b> · chỉ xem, không sửa bản gốc</>)}
                </span>
                {life.canShare && <button type="button" className="np-btn sm np-btn-quiet np-share-btn" onClick={() => setSharing(true)}>Chia sẻ</button>}
                {state.isMine && (
                  <button type="button" className="np-btn sm np-btn-quiet" disabled={life.removing === "busy"} onClick={() => void life.remove()}>
                    {life.removing === "confirm" ? "Xác nhận gỡ" : life.removing === "busy" ? "Đang gỡ…" : life.removeLabel}
                  </button>
                )}
                {life.removing === "confirm" && <span className="np-muted" style={{ width: "100%", fontSize: 12 }}>{life.confirmText}</span>}
                {life.removing === "error" && <span role="alert" style={{ width: "100%", fontSize: 12, color: "#b42318" }}>Chưa gỡ được. Hãy thử lại.</span>}
              </div>
            </section>
            {pages.status === "rendering" && <p className="np-muted" role="status">Đang dựng bản nhạc…</p>}
            {pages.status === "fail" && <p role="alert">Không dựng được bản nhạc này.</p>}
            {pages.status === "ok" && pages.urls.map((u, i) => (
              <div key={u} className="np-page np-shared-page" style={{ width: "100%" }}>
                <img src={u} alt={`Trang ${i + 1} — ${state.score.title}`} />
              </div>
            ))}
          </>
        )}
      </div>
      {sharing && state.status === "ready" && life.canShare && (
        <ShareSheet title={state.score.title || "Bản nhạc"} target={artifactRef(artifactId)} canPublish={life.canPublish}
          ensureTarget={async () => ({ ok: true, target: artifactRef(artifactId) })}
          publish={t => publishArtifact(t.key)} onPublished={life.markPublished} onClose={() => setSharing(false)} />
      )}
    </main>
  );
}
