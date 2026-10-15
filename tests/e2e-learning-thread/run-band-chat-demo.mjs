// Chế độ DÙNG THỬ cục bộ (không production): in hướng dẫn rồi giữ stack chạy tới khi Ctrl-C. Xem scripts/demo-band-chat-local.sh.
const V = process.env.VITE_PORT
console.log(`
══════════════ BAND CHAT V1 — DÙNG THỬ CỤC BỘ (DB tạm, không production) ══════════════
 Mở bằng Chrome:  http://class.localhost:${V}/me      (mỗi người một cửa sổ ẩn danh / profile khác)
 Đăng nhập (mật khẩu mọi tài khoản: e2e):
   a@test.local  An     — Band "Lá Mùa Thu Acoustic Band Hà Nội 2026" (cùng Band với Bình) + bạn của Bình
   b@test.local  Bình   — cùng Band với An
   c@test.local  Chi    — Band Y (Band khác, cùng Team)
   t@test.local  Thầy   — Thầy/Admin (không thuộc Band nào → mục "Hỗ trợ" hiện sau khi nhóm có tin; chỉ xem)
 Vào Trò chuyện (/me/chat) → hàng có nhãn "Band".
 Lưu trữ/khôi phục (chạy ở terminal khác):
   ${process.env.E2E_PG_BIN}/psql -h ${process.env.E2E_PG_SOCK} -p ${process.env.E2E_PG_PORT} -U postgres -d e2e -c "select set_config('request.jwt.claims','{\\"sub\\":\\"dddddddd-0000-4000-8000-00000000000d\\",\\"role\\":\\"authenticated\\"}',false); select public.bandchat_set_archived('11111111-0000-4000-8000-0000000000a1', true)"
 Dừng: Ctrl-C
═══════════════════════════════════════════════════════════════════════════════════════
`)
setInterval(() => {}, 1 << 30)
