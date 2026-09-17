/**
 * Bộ theo dõi quyền theo phiên đăng nhập — dùng chung cho `ToolRouteGate` và
 * `useCapabilities` (Nhịp Phách).
 *
 * VÌ SAO CÓ FILE NÀY: Supabase phát lại `SIGNED_IN` khi tab lấy lại focus (khôi
 * phục phiên), cả khi vẫn là ĐÚNG người đó. Hai cổng cũ coi mọi `SIGNED_IN` là
 * đăng nhập mới → quên quyền → gỡ công cụ khỏi DOM → trình soạn nhạc mất bản nháp
 * chưa lưu chỉ vì thầy chuyển tab rồi quay lại.
 *
 * LUẬT:
 *   - `SIGNED_OUT`                → quên quyền NGAY (gỡ công cụ).
 *   - uid đổi (A → B, hay A → không ai) → quên quyền NGAY: quyền và nháp của A
 *     không bao giờ được dùng tiếp cho B.
 *   - cùng uid (SIGNED_IN lặp lại, TOKEN_REFRESHED, USER_UPDATED, focus…) →
 *     GIỮ quyền đang có, kiểm lại ngầm. Quyền đang có vẫn là quyền chính thức
 *     cho tới khi câu trả lời mới về; câu trả lời hợp lệ — kể cả "không cho" —
 *     áp dụng ngay khi về.
 *   - lỗi mạng/tạm thời: giữ quyền tốt gần nhất nếu vẫn ĐÚNG người đó.
 *
 * Không có I/O ở đây: đọc phiên và hỏi quyền được truyền vào.
 */
export type PhaseQuyen = "loading" | "ready" | "error";
export interface TrangThaiQuyen<T> {
  phase: PhaseQuyen;
  value: T | null;
}
export type KetQuaHoi<T> = { ok: true; value: T } | { ok: false };

/** Quyết định cho một sự kiện đăng nhập, TRƯỚC khi hỏi lại máy chủ. */
export function quyetDinhSuKienPhien(
  event: string,
  uidMoi: string | null,
  /** uid của quyền đang có; `undefined` = chưa có quyền nào để giữ. */
  uidDangCo: string | null | undefined
): "QUEN" | "GIU" {
  if (event === "SIGNED_OUT") return "QUEN";
  if (uidDangCo !== undefined && uidMoi !== uidDangCo) return "QUEN";
  return "GIU";
}

export function taoBoTheoDoiQuyen<T>(o: {
  /** uid của phiên CỤC BỘ (không gọi mạng — mất mạng không được hiểu là đổi người). */
  docUid(): Promise<string | null>;
  hoi(uid: string | null): Promise<KetQuaHoi<T>>;
  /** Có giá trị → khách (chưa đăng nhập) nhận ngay giá trị này, không hỏi máy chủ. */
  khiKhach?: T;
  dat(s: TrangThaiQuyen<T>): void;
}) {
  let live = true;
  let luot = 0;
  let tot: { uid: string | null; value: T } | null = null;
  const quen = () => {
    tot = null;
    o.dat({ phase: "loading", value: null });
  };
  async function lamMoi() {
    const hienTai = ++luot;
    const uid = await o.docUid().catch(() => null);
    if (!live || hienTai !== luot) return;
    // Phiên đã đổi so với quyền đang có → bỏ quyền cũ trước khi hỏi lại.
    if (tot && tot.uid !== uid) quen();
    if (uid === null && o.khiKhach !== undefined) {
      tot = null;
      o.dat({ phase: "ready", value: o.khiKhach });
      return;
    }
    const r = await o.hoi(uid).catch((): KetQuaHoi<T> => ({ ok: false }));
    if (!live || hienTai !== luot) return;
    if (!r.ok) {
      if (tot && tot.uid === uid) o.dat({ phase: "ready", value: tot.value });
      else {
        tot = null;
        o.dat({ phase: "error", value: null });
      }
      return;
    }
    tot = { uid, value: r.value };
    o.dat({ phase: "ready", value: r.value });
  }
  return {
    lamMoi,
    /** Gọi từ `onAuthStateChange(event, session)`. */
    suKien(event: string, uidMoi: string | null) {
      if (quyetDinhSuKienPhien(event, uidMoi, tot ? tot.uid : undefined) === "QUEN") quen();
      void lamMoi();
    },
    huy() {
      live = false;
    },
  };
}
