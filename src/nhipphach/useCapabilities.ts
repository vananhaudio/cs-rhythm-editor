import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { NO_CAPS, parseCaps, type CapState } from "./capabilities";

export type CapPhase = "loading" | "ready" | "error";

/**
 * Đọc quyền tính năng TỪ MÁY CHỦ.
 *
 * Theo đúng khuôn đã nghiệm thu ở `ToolRouteGate`:
 *   - danh tính lấy bằng `getSession()` (đọc phiên trên máy, KHÔNG gọi mạng);
 *     dùng `getUser()` ở đây là sai vì mất mạng sẽ bị hiểu thành "đổi sang
 *     không ai" rồi xoá quyền của người đang dùng;
 *   - quyền tốt gần nhất GẮN VỚI một tài khoản cụ thể, đổi người hay đăng xuất
 *     là quên ngay;
 *   - chỉ lỗi mạng/tạm thời mới được giữ quyền cũ; một câu trả lời hợp lệ dù là
 *     "không cho" cũng phải tuân theo ngay.
 *
 * localStorage KHÔNG bao giờ là nguồn quyền — nó chỉ nhớ mức giao diện.
 */
export function useCapabilities(): { state: CapState; phase: CapPhase } {
  const [state, setState] = useState<CapState>(NO_CAPS);
  const [phase, setPhase] = useState<CapPhase>("loading");
  const totNhat = useRef<{ uid: string | null; state: CapState } | null>(null);

  useEffect(() => {
    let live = true;
    let luot = 0;
    const quen = () => {
      totNhat.current = null;
      setState(NO_CAPS);
      setPhase("loading");
    };
    const doc = async () => {
      const hienTai = ++luot;
      const { data } = await supabase.auth
        .getSession()
        .catch(() => ({ data: { session: null } }));
      const uid = data.session?.user?.id ?? null;
      if (totNhat.current && totNhat.current.uid !== uid) {
        totNhat.current = null;
        setState(NO_CAPS);
      }
      // Chưa đăng nhập thì không gọi RPC: `anon` đã bị thu hồi quyền chạy, gọi
      // vào chỉ nhận lỗi quyền rồi hiện nhầm thành "chưa tải được". Khách là
      // một câu trả lời dứt khoát, không phải một sự cố.
      if (!uid) {
        totNhat.current = null;
        setState(NO_CAPS);
        setPhase("ready");
        return;
      }
      const { data: raw, error } = await supabase.rpc("my_nhipphach_caps");
      if (!live || hienTai !== luot) return;
      if (error) {
        const giu = totNhat.current && totNhat.current.uid === uid;
        if (giu) {
          setState(totNhat.current!.state);
          setPhase("ready");
        } else {
          setState(NO_CAPS);
          setPhase("error");
        }
        return;
      }
      const sach = parseCaps(raw);
      totNhat.current = { uid, state: sach };
      setState(sach);
      setPhase("ready");
    };
    void doc();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED")
        quen();
      void doc();
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);

  return { state, phase };
}
