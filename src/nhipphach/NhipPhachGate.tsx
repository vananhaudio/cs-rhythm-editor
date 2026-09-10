import { lazy, Suspense } from "react";
import { can } from "./capabilities";
import { useCapabilities } from "./useCapabilities";
import { NP_CSS, NP_SCOPE } from "./theme";

const MusicXmlBeatsPage = lazy(() => import("../pages/MusicXmlBeatsPage"));

/**
 * Cổng vào công cụ Nhịp Phách.
 *
 * Quyền vào cửa là `nhipphach.access` do Admin cấu hình, KHÔNG phải vai trò.
 * Học viên được bật thì vào được; thầy giáo bị tắt thì không vào được. Khách
 * chưa đăng nhập luôn bị chặn vì RPC không phát quyền nào cho khách.
 *
 * Đọc quyền một lần ở đây rồi truyền xuống, để cả trang chỉ có MỘT nguồn quyền
 * và trang bên trong vẫn là một component thuần nhận props.
 */
export default function NhipPhachGate() {
  const { state, phase } = useCapabilities();

  if (phase === "loading")
    return <ManBao tieuDe="Đang mở công cụ bản nhạc…" />;

  if (phase === "error")
    return (
      <ManBao tieuDe="Chưa tải được quyền truy cập">
        <button className="np-btn" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </ManBao>
    );

  if (!can(state, "access"))
    return (
      <ManBao tieuDe="Công cụ chưa được mở cho tài khoản này">
        <p className="np-lead" style={{ margin: "0 0 18px" }}>
          {state.role === "guest"
            ? "Hãy đăng nhập bằng tài khoản đã được cấp quyền."
            : "Thầy Văn Anh chưa bật công cụ này cho tài khoản của bạn."}
        </p>
        <a className="np-btn np-btn-primary" href="/">
          Về trang chính
        </a>
      </ManBao>
    );

  return (
    <Suspense fallback={<ManBao tieuDe="Đang mở công cụ bản nhạc…" />}>
      <MusicXmlBeatsPage caps={state} />
    </Suspense>
  );
}

/** Màn báo dùng chung, giữ đúng nhận diện Class như trang chính. */
function ManBao({
  tieuDe,
  children,
}: {
  tieuDe: string;
  children?: React.ReactNode;
}) {
  return (
    <main className={NP_SCOPE}>
      <style>{NP_CSS}</style>
      <div
        className="np-wrap"
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <img
          className="np-mark"
          src="/logo-green.svg"
          alt=""
          style={{ width: 44, height: 44, marginBottom: 16 }}
        />
        <h1 style={{ fontSize: 22, marginBottom: 10 }}>{tieuDe}</h1>
        {children}
      </div>
    </main>
  );
}
