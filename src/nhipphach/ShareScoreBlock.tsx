// Nút PHỤ "Chia sẻ" trong thẻ Xuất tài liệu — chỉ khi đã đăng nhập (vai trò khác khách).
// Chia sẻ đúng bản ĐANG HIỂN THỊ (MusicXML + thiết lập đếm/trình bày) → sheet chung: "Gửi cho bạn bè" (lưu riêng, chỉ người nhận mở được) / "Đăng lên cộng đồng".
// Bản đổi → coi như bản mới (server idempotent theo nội dung). Bản gốc của bạn không đổi.
import { lazy, Suspense, useMemo, useState } from "react";
import type { ScoreSettings } from "../musicxml-beats/renderer/types.ts";
import { readScoreMetadata } from "./scoreMetadata.ts";
import { scoreShareBlocker, saveNhipPhachForShare, type ShareableScore } from "../class-social/toolshare/nhipphachShare";
import { publishArtifact } from "../share/artifactApi";
import { artifactRef } from "../share/shareRef";

const ShareSheet = lazy(() => import("../share/ShareSheet"));
type State = { target: unknown; open: boolean; artifactId: string | null; published: boolean };

export function ShareScoreBlock({ xml, name, settings, rendered }: { xml: string | null; name: string; settings: ScoreSettings; rendered: boolean }) {
  const target = useMemo<ShareableScore | null>(() => {
    if (!xml) return null;
    const meta = readScoreMetadata(xml, name);
    return { title: meta.title, composer: meta.composer, xml, settings };
  }, [xml, name, settings]);
  const [raw, setRaw] = useState<State>({ target: null, open: false, artifactId: null, published: false });
  const st: State = raw.target === target ? raw : { target, open: false, artifactId: null, published: false };
  const blocker = scoreShareBlocker(target, rendered);

  return (
    <div className="np-share" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line, #E4DED3)" }}>
      <button type="button" className="np-btn sm np-btn-quiet" disabled={!!blocker} onClick={() => !blocker && setRaw({ ...st, open: true })}>
        Chia sẻ
      </button>
      <p className="np-muted" style={{ margin: "6px 0 0", fontSize: 12.5 }} role={st.published ? "status" : undefined}>
        {blocker ?? (st.published
          ? <><b>Đã đăng lên cộng đồng.</b> <a href="/me">Xem trên Trang chủ</a></>
          : "Gửi riêng cho bạn bè hoặc đăng lên cộng đồng — đúng bản đã đánh số phách này. Bản gốc của bạn không đổi.")}
        {!blocker && st.artifactId && <> · <a href={`/nhipphach?artifact=${st.artifactId}`}>Mở / gỡ bản đã chia sẻ</a></>}
      </p>
      {st.open && target && (
        <Suspense fallback={null}>
          <ShareSheet title={target.title.trim() || "Bản nhạc"} target={st.artifactId ? artifactRef(st.artifactId) : null} canPublish={!st.published}
            ensureTarget={async () => { const r = await saveNhipPhachForShare(target); if (!r.ok) return r; setRaw(s => ({ ...s, target, artifactId: r.artifactId })); return { ok: true, target: artifactRef(r.artifactId) }; }}
            publish={t => publishArtifact(t.key)}
            onPublished={t => setRaw(s => ({ ...s, target, artifactId: t.key, published: true }))}
            onClose={() => setRaw(s => ({ ...s, target, open: false }))} />
        </Suspense>
      )}
    </div>
  );
}
