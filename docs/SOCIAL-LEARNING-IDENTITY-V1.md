# Class Social — Danh tính học tập V1

Chỉ cần nhìn tên một người trong Social, cộng đồng biết họ **đang học gì** và **đã tốt nghiệp gì**. Ví dụ:
`Trần Tiến Hải · ◆ Hành trình 2027 · Đệm hát 2`.

Nhãn sinh ra từ dữ liệu lớp thật; học sinh không tự chọn. Không có Level, VIP, XP hay xếp hạng người.

## Nguồn và luật

- **Thành viên:** đúng luật của Lớp học V1 (`social_class_members_of`): `edu_group_members` có status `active` thuộc nhóm cohort, nhóm gắn lớp hoặc nhóm cùng mã lớp.
- **Trạng thái** = `class_schedule.status` **kết hợp NGÀY**. Preflight production 30/09 cho thấy status thường không được cập nhật: DH2.KD0826 đang học thật vẫn là `upcoming`, còn TN3.GL10 đã quá `end_date` vẫn là `ending_soon`.

| Lớp | Danh tính |
|---|---|
| active · ending_soon · paused, **hoặc** status chưa mở (recruiting · ready_to_open · scheduled · upcoming) mà `start_date` ≤ hôm nay | **Đang học** (nếu `end_date` đã qua → Đã tốt nghiệp) |
| status chưa mở và chưa tới `start_date` (hoặc không có ngày) | **Sắp học** (chỉ hiện trên trang cá nhân) |
| completed | **Đã tốt nghiệp** |
| cancelled · merged · draft | không hiện |

- **Hành trình:** ngoài nhóm lớp, cờ `edu_students.ht_member` (nguồn "Lớp Hành trình" Social đã dùng) gắn người đó vào lớp Hành trình **đang diễn ra** (`program_code` HTyyyy, đã bắt đầu, chưa kết thúc). Cờ này không gắn vào khoá Hành trình chưa mở. Lý do: preflight cho thấy lớp HT2026.TH01 không có thành viên nào khớp nhóm lớp.
- **Chương trình, không phải mã lớp.** Helper duy nhất `src/class-social/identity/learningIdentity.ts` suy nhãn theo quy luật mã, không hard-code từng lớp:
  - `HT2027` (`program_code` hoặc mã lớp `HT2027.*`) → **Hành trình 2027**, bậc đặc biệt, giữ năm.
  - `DH1`/`DH2` → Đệm hát 1/2. `DHNC`, `DH3` → Đệm hát nâng cao.
  - `TN1…` → Tỉa nốt 1… `SOLO…` → Solo Guitar. `CB1`/`CB2` → Guitar căn bản 1/2.
  - Ưu tiên mã khoá chính, sau đó đến tiền tố mã lớp.
  - Mã không nhận ra thì dùng tên khoá hoặc tên lớp thân thiện; không bao giờ hiện "?".
- **Gộp theo chương trình:** hai cohort DH2 chỉ ra **một** nhãn "Đệm hát 2". Mỗi chương trình lấy trạng thái mạnh nhất (Đang học > Sắp học > Đã tốt nghiệp); đang học lại thì không lặp ở Đã tốt nghiệp.
- **Thứ tự:** Hành trình trước, rồi bậc cao hơn, rồi theo tên. Thứ tự xác định.
- **Thầy/admin:** không có danh tính học sinh, vì các tài khoản này ở trong nhóm lớp để quản lý.

## Tách biệt

- **Danh tính học tập HIỆN TẠI của người** khác hẳn **danh tính LỊCH SỬ của Learning Thread** (snapshot lúc bắt đầu, không đổi).
  - Thẻ trên Feed và trang cuộc trao đổi hiện cả hai: nhãn người cạnh tên, còn ngữ cảnh bài (vd "DH2.KD18 · Đệm hát 2") ở metadata.
  - Ví dụ: HS03 · Bài 4.3 vẫn là "Tự học".
- **Không trộn với quyền lợi, gói hay công cụ.** Sau này có thể nối `Learning Identity → Benefits` qua `key` chương trình.

## Hiển thị

| Nơi | Nội dung |
|---|---|
| Feed · Tường · thẻ cuộc trao đổi · trang cuộc trao đổi | tối đa 2 nhãn **Đang học**, thừa hiện +N (tooltip) |
| Bình luận | 1 nhãn |
| Bạn bè | tối đa 2 · lời mời: 1 |
| Thành viên lớp | bỏ nhãn trùng chương trình của chính lớp đó, chỉ hiện chương trình **khác** |
| Trang cá nhân | khối "Danh tính học tập": Đang học · Sắp học · Đã tốt nghiệp (đầy đủ, xuống dòng) |
| Top bar · App học | không có |

**Thị giác:**
- Chương trình thường dùng nền tím/xám đơn sắc; bậc cao hơn đậm hơn một chút.
- Hành trình dùng gradient tím rất nhẹ, viền và dấu ◆. Không vàng VIP, không chuyển động.
- Đã tốt nghiệp dùng dạng viền, vẫn rõ vì đó là thành tích. Sắp học dùng viền nét đứt.

## Kỹ thuật

- DB: một hàm đọc `social_learning_identities(p_users uuid[])`, tối đa 200 người mỗi lần gọi.
  - Chỉ trả thông tin lớp công khai: mã/tên lớp, trạng thái, khoá, `program_code`.
  - Không tiến độ, không gói, không email/SĐT.
  - Hàm SECURITY DEFINER, cổng `is_class_member()`, anon không gọi được. Không bảng mới.
- Client: `identityStore` gom mọi `user_id` trong cùng một nhịp thành một lần gọi (không N+1), cache theo phiên. Hàm chưa có hoặc lỗi thì không hiện nhãn và không báo lỗi.
- Renderer duy nhất: `IdentityBadges`, `LearningIdentitySection` (`src/class-social/identity/IdentityBadges.tsx`).
- Phát hành:
  1. Chạy preflight (chỉ đọc; có thống kê gộp để kiểm nhãn trên dữ liệu thật).
  2. Chạy `db/social_learning_identity_v1_setup.sql`.
  3. Deploy frontend.
- Rollback: `db/social_learning_identity_v1_rollback.sql`. Không mất dữ liệu; frontend vẫn chạy khi thiếu hàm.

## Giới hạn V1 (đã chốt)

- "Đã tốt nghiệp" = từng là thành viên và lớp ở trạng thái `completed`; không kiểm điểm danh.
- Lớp đang học mà không có `start_date` (status chưa mở) sẽ hiện "Sắp học" cho tới khi có ngày hoặc đổi status.
- Nếu thành viên bị tắt `active` sau khi lớp kết thúc, họ không có nhãn "Đã tốt nghiệp". Production 30/09: lớp completed TN3.GL11 vẫn đủ 12 thành viên active.
