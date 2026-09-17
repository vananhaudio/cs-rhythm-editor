import { useEffect, useState } from "react";
import { taoBoTheoDoiQuyen } from "../authCapabilityGate";
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

  useEffect(() => {
    // Giữ/quên quyền theo phiên: xem `authCapabilityGate`. Cùng người mà Supabase
    // phát lại SIGNED_IN (tab lấy lại focus) thì GIỮ quyền — trình soạn nhạc
    // không bị gỡ, bản nháp chưa lưu không mất.
    const bo = taoBoTheoDoiQuyen<CapState>({
      docUid: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.user?.id ?? null;
      },
      hoi: async () => {
        const { data: raw, error } = await supabase.rpc("my_nhipphach_caps");
        return error ? { ok: false } : { ok: true, value: parseCaps(raw) };
      },
      // Chưa đăng nhập thì không gọi RPC: `anon` đã bị thu hồi quyền chạy, gọi
      // vào chỉ nhận lỗi quyền rồi hiện nhầm thành "chưa tải được". Khách là
      // một câu trả lời dứt khoát, không phải một sự cố.
      khiKhach: NO_CAPS,
      dat: (s) => {
        setState(s.value ?? NO_CAPS);
        setPhase(s.phase);
      },
    });
    void bo.lamMoi();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) =>
      bo.suKien(event, session?.user?.id ?? null)
    );
    return () => {
      bo.huy();
      subscription.unsubscribe();
    };
  }, []);

  return { state, phase };
}
