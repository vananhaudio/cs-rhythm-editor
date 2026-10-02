# Band — Quản lý V1 (thành viên · vị trí âm nhạc · Bộ máy)

Nền: [BAND-RECRUIT-V1.md](BAND-RECRUIT-V1.md). Luồng: **ỨNG TUYỂN → DUYỆT → THÀNH VIÊN → VỊ TRÍ + VAI TRÒ**.
Ngoài phạm vi V1 (cố ý KHÔNG làm): điểm danh, buổi tập, khách mời, repertoire, TeamLab, chat, nhiệm kỳ, KPI, thông báo.

## Giao diện — `/me/bands/<slug>` (dùng chung mọi Band)
- Đầu trang: tên Band, Leader, lịch cố định, gu âm nhạc, tổng thành viên (không tính người đã rời), số đơn mới.
- **ỨNG TUYỂN**: như V1. Bấm *Chấp nhận* → hỏi "Chấp nhận … và thêm vào Band?" → *Xác nhận* = `band_admin_accept`.
  Đơn ACCEPTED chưa có hồ sơ (vd. duyệt trước khi có V1 này) hiện nút *Thêm vào Band*.
- **THÀNH VIÊN**: vị trí (nhiều), vai trò, trạng thái ACTIVE/PAUSED/LEFT; *Sửa vị trí / trạng thái*; *Thêm thành viên* trực tiếp
  (người không qua đơn, vd. Leader/thành viên sáng lập — SĐT không bắt buộc).
- **BỘ MÁY**: mỗi vai trò → người phụ trách hoặc "Chưa phân công"; "Đã phân công x/y vai trò"; *Phân công* / ✕ bỏ.
- Code: `src/band/BandManage.tsx` (trang + 3 tab), `BandAdmin.tsx` (danh sách Band + tab Ứng tuyển), `bandModel.ts`, `bandApi.ts`.

## Dữ liệu (`db/band_management_v1_setup.sql`, additive)
| Đối tượng | Ý nghĩa |
|---|---|
| `bands.position_catalog` | `[{key, label, other?}]` — vị trí âm nhạc của Band. DEFAULT = 7 vị trí chuẩn (key trùng vị trí tuyển Lá Mùa Thu). |
| `bands.role_catalog` | `[{key, label, max?, manage?}]` — vai trò vận hành. DEFAULT = Band Leader (max 1, manage), Music Leader, Membership, Lịch & điều phối, TeamLab / Recording, Performance / Media. |
| `band_members` | band_id, application_id (unique, nếu từ đơn), user_id (nullable), họ tên, SĐT (unique theo Band), status, joined_at/left_at, positions text[], position_note. |
| `band_member_roles` | (member_id, role_key) unique; trigger: đúng Band, chưa rời, key trong danh mục, không quá `max`. |

**Band khác có Saxophone/Violin/Cajon** = `update bands set position_catalog = '[...]'` — không đổi schema/component.
Gỡ key khỏi danh mục sau này: hồ sơ cũ vẫn giữ key (hiện nguyên key), chỉ key MỚI phải có trong danh mục.

## Luật
- **Chấp nhận idempotent**: khoá dòng đơn; tìm hồ sơ theo đơn → SĐT → tài khoản; có rồi thì không tạo; cùng đơn bấm lại không ghi đè
  vị trí Leader đã sửa. `band_admin_set_status(…,'ACCEPTED')` cũng đi qua đây — không có đường "chỉ đổi chữ".
- **Kế thừa vị trí**: `position_key` có trong danh mục → vị trí; không có → ghi vào `position_note` (vd. "Ukulele"); `position_other` → note.
- **Một người một hồ sơ**: thêm tay trước (chưa tài khoản) → sau này người đó gửi đơn khi đã đăng nhập, cùng SĐT → Chấp nhận GẮN user_id vào hồ sơ cũ.
- **Rời Band (LEFT)** → gỡ mọi vai trò. PAUSED giữ vai trò (Bộ máy ghi "tạm nghỉ").
- **Quyền** (`band_can_manage`): Thầy/admin · `bands.leader_user_id` · thành viên ACTIVE có tài khoản giữ vai trò `manage: true` của CHÍNH Band đó.
  Leader Band A không đọc/ghi Band B. Khách: không hàm nào đọc thành viên. Bảng RLS bật, 0 policy, REVOKE; chỉ RPC SECURITY DEFINER.
- Lối vào: Thầy có nút ở Trang chủ /me; Leader theo vai trò mở thẳng `/me/bands`.

## Vận hành
- Preflight → migrate → postflight: `db/band_management_v1_{preflight,setup,postflight}.sql` qua `scripts/prod-db.py`.
- Rollback: gỡ frontend trước, rồi `db/band_management_v1_rollback.sql` (DỪNG nếu đã có thành viên; trả 2 hàm V1 về nguyên văn; đơn giữ nguyên).
- Test: `bash scripts/test-band-recruit-db.sh` (DB) · `npm run test:band` · `PUPPETEER_DIR=… bash scripts/e2e-band-recruit.sh`.
