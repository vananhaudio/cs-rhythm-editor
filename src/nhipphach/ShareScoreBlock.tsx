// Nút PHỤ "Chia sẻ lên cộng đồng" trong thẻ Xuất tài liệu — chỉ khi đã đăng nhập (vai trò khác khách).
// Chia sẻ đúng bản ĐANG HIỂN THỊ (MusicXML + thiết lập đếm/trình bày). Bản đổi → coi như chưa chia sẻ, khoá mới.
import { useMemo, useRef, useState } from "react";
import type { ScoreSettings } from "../musicxml-beats/renderer/types.ts";
import { newClientKey } from "../lib/clientKey.ts";
import { readScoreMetadata } from "./scoreMetadata.ts";
import { scoreShareBlocker, shareNhipPhachScore, type ShareableScore } from "../class-social/toolshare/nhipphachShare";

type State = { target: unknown; key: string | null; busy: boolean; done: boolean; error: string | null; artifactId: string | null };

export function ShareScoreBlock({ xml, name, settings, rendered }: { xml: string | null; name: string; settings: ScoreSettings; rendered: boolean }) {
  const target = useMemo<ShareableScore | null>(() => {
    if (!xml) return null;
    const meta = readScoreMetadata(xml, name);
    return { title: meta.title, composer: meta.composer, xml, settings };
  }, [xml, name, settings]);
  const busyRef = useRef(false);
  const [raw, setRaw] = useState<State>({ target: null, key: null, busy: false, done: false, error: null, artifactId: null });
  const st: State = raw.target === target ? raw : { target, key: null, busy: false, done: false, error: null, artifactId: null };
  const blocker = scoreShareBlocker(target, rendered);

  const share = async () => {
    if (!target || blocker || busyRef.current || st.done) return;
    busyRef.current = true;
    const key = st.key ?? newClientKey();
    setRaw({ ...st, key, busy: true, error: null });
    const r = await shareNhipPhachScore(target, key);
    busyRef.current = false;
    setRaw(s => ({ ...s, busy: false, ...(r.ok ? { done: true, error: null, artifactId: r.artifactId } : { error: r.message }) }));
  };

  return (
    <div className="np-share" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line, #E4DED3)" }}>
      {st.done ? (
        <p className="np-muted" role="status" style={{ margin: 0 }}>
          <b>Đã chia sẻ lên cộng đồng.</b> <a href="/me">Xem trên Trang chủ</a>
          {st.artifactId && <> · <a href={`/nhipphach?artifact=${st.artifactId}`}>Mở / gỡ bản đã chia sẻ</a></>}
        </p>
      ) : (
        <>
          <button type="button" className="np-btn sm np-btn-quiet" disabled={!!blocker || st.busy} onClick={() => void share()}>
            {st.busy ? "Đang chia sẻ…" : "Chia sẻ lên cộng đồng"}
          </button>
          <p className="np-muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
            {blocker ?? "Thành viên Class xem được đúng bản đã đánh số phách này. Bản gốc của bạn không đổi."}
          </p>
        </>
      )}
      {st.error && <p role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 12.5 }}>{st.error}</p>}
    </div>
  );
}
