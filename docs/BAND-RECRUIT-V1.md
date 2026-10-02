# Band — Tuyển thành viên V1 (02/10/2026)

Chuỗi mở rộng: **Band → Tuyển thành viên → Đơn ứng tuyển → Duyệt** (V1) → Thành viên → Vai trò → Điểm danh → Khách mời (sau này).

## Nguyên tắc
- Mọi thứ riêng của một Band là **DỮ LIỆU** (bảng `band*`), không nằm trong component. `src/band/` không chứa nội dung của Band nào (có test kiểm).
- Band mới = chép `db/band_la_mua_thu_seed.sql`, đổi nội dung, chạy bằng `scripts/prod-db.py migrate`. Không sửa code.

## Dữ liệu (`db/band_recruit_v1_setup.sql`)
| Bảng | Vai trò |
|---|---|
| `bands` | hồ sơ công khai: slug, name, leader_name, leader_user_id, tagline, music_style, schedule_text, reference_songs[], highlights[], description, status draft/active/archived, teamlab_team_id (để nối TeamLab sau) |
| `band_rule_versions` | Rule theo phiên bản `(band_id, version)`; **bất biến** (trigger chặn UPDATE/DELETE) |
| `band_recruitments` | đợt tuyển: positions[{key,label,other?}], questions[{key,label,short_label?,type:'single',required,options[]}], reason_label, success_message, rule_version_id, status draft/open/closed; mỗi Band ≤ 1 đợt open |
| `band_applications` | đơn: band_id, recruitment_id, applicant_user_id (khi đã đăng nhập), full_name, phone (chuẩn hoá 0…), position_key/other, answers{}, reason, rule_version_id + rule_version + rules_accepted_at, status NEW/REVIEWING/ACCEPTED/REJECTED (+ ai/lúc đổi), client_key |

RLS bật, **không policy**, không quyền bảng cho anon/authenticated; 4 bảng nằm trong `self_managed` của `rls_setup.sql`. Mọi truy cập qua RPC:
- `band_recruitment_public(slug)` (anon) — landing; không có dữ liệu ứng viên.
- `band_apply(recruitment_id, payload)` (anon) — kiểm tra theo config, honeypot `website`, chống bấm đúp (`client_key`), 1 SĐT/1 đơn đang xét mỗi đợt. Server tự gắn `auth.uid()`.
- `band_admin_bands()`, `band_admin_applications(slug)`, `band_admin_set_status(id, status)` — quyền `band_can_manage` = Thầy/admin **hoặc** `leader_user_id` của chính Band.

## Đổi Rule
`insert into band_rule_versions (band_id, version, items, …) values (…, 2, …)` rồi `update band_recruitments set rule_version_id = <v2>`. Đơn cũ giữ v1. Form đang mở với v1 gửi lên → `rule_changed` → trang tải Rule mới, giữ nội dung đã nhập, bắt tick lại.

## Route
- Công khai: `/band/<slug>` (mọi host; khách không cần đăng nhập) — `src/band/BandRecruitRoute.tsx`.
- Admin: `/me/bands`, `/me/bands/<slug>` trong Class Social (class.*); Thầy có lối vào "Đơn ứng tuyển Band" ở Trang chủ /me.

## Auth
Gửi đơn **không bắt buộc đăng nhập** (cùng tinh thần form đăng ký `leads` ở Trang Class — đa số người quan tâm Band chưa có tài khoản). Quản trị được nhờ: SĐT bắt buộc + chuẩn hoá, ghi chỉ qua RPC kiểm tra, dedupe theo SĐT, đã đăng nhập thì gắn tài khoản.

## Test
- `bash scripts/test-band-recruit-db.sh` — cluster PG tạm: preflight/migration×2/seed×2/rls_setup/postflight/72 assertion/rollback/drift.
- `npm run test:band` — model, render, luồng jsdom, Admin, reusability.
- `PUPPETEER_DIR=… bash scripts/e2e-band-recruit.sh` — Chrome thật trên stack local.

## Rollback
FE trước (main trước đó), rồi `db/band_recruit_v1_rollback.sql` — tự DỪNG nếu đã có đơn thật.
