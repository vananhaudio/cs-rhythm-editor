# Quản trị gói học theo thời hạn — Class + TVA

Ngày triển khai: 05/09/2026.

## 1. Context và audit

Thầy cần biết học sinh nào còn quyền học, ai sắp hết hạn, và cấp/gia hạn ngay trong hồ sơ học sinh. Học sinh trả tiền ở Web hay Store đều phải nhận cùng quyền backend.

Audit trực tiếp Supabase trước migration:

- `packages`: UUID, code, name, description, JSON config, status, timestamps. Có 4 gói: Đồng hành, HT theo tháng, HT theo chặng, HT 6 tháng. Giữ nguyên giá và config của cả 4.
- `student_packages`: bigint ID, student/package UUID, status, starts_at, **renews_at**, granted_course_codes, timestamps. Có 2 dòng, đều có renews_at tương lai; không có dòng thiếu thời hạn. Cả hai có snapshot course codes rỗng. Không tự suy thêm khoá cho dữ liệu cũ.
- `activate_student_package`: gia hạn từ NOW thay vì hạn còn lại; `apply_package_permissions` ghi enrollment + course access lâu dài. Nhóm gói được nối bằng `zalo_group_id`, chỉ nhận nhóm không mã lớp.
- `student_entitlements`: tier, source, source_ref, starts_at, ends_at, is_lifetime, status, metadata, timestamps. Có 653 dòng `legacy_99_lifetime` và 1 dòng Apple mang status active nhưng ends_at đã qua.
- Apple xác minh App Store Server API; Google xác minh subscriptionsv2; cả hai ghi student_entitlements. Trước đây chỉ có client gọi sync; chưa có đối soát chạy khi app đóng. Có khả năng gán lại giao dịch sang tài khoản khác trong nhánh update cũ.
- Mobile dùng `my_learning_state`; desktop còn tính riêng. Backend còn cộng `edu_students.level` và enrollment vào quyền. Tất cả 662 hồ sơ hiện tại có level null/beginner nên bỏ fallback level không giảm quyền ai.
- `get_lesson_content` đã kiểm quyền nhưng SELECT trực tiếp bảng bài vẫn đọc được nội dung bài khóa. Enrollment cho authenticated ghi rộng, có thể dùng ghi danh để tự mở quyền.
- Admin có StudentList/StudentProfile, chưa có quản trị gói tích hợp.

## 2. Kiến trúc cuối cùng

Giữ các bảng hiện có. Không dựng hệ thống entitlement độc lập mới.

- Giữ **renews_at làm ngày hết hạn**, không tạo expires_at trùng nghĩa.
- Thêm source (apple/google_play/web/admin), auto_renew (nullable khi Store chưa xác nhận), external_transaction_id, entitlement_id, legacy_unclassified.
- Store tiếp tục ghi nguồn xác minh `student_entitlements`; trigger đồng bộ một dòng student_packages theo entitlement_id. Không đếm mirror hai lần.
- `student_entitlement_sources` là view nội bộ tổng hợp entitlement cũ + tier của gói thủ công nếu config có khai báo; view không cho client đọc trực tiếp.
- `package_term_valid(status, starts_at, end, now)` là điều kiện chung: active/trialing, starts_at <= now, end null hoặc end > now.
- `get_effective_student_entitlement` dùng điều kiện này. `my_learning_state` tiếp tục là resolver khóa/bài/Hành trình/công cụ. Các quyền khoá độc lập với gói vẫn được giữ; hết một gói không xóa quyền từ nguồn khác.
- `has_course_access` tổng hợp course codes từ gói còn hạn và quyền cấp riêng/ghi danh hợp lệ. Không sinh enrollment vô hạn cho gói mới.
- Các quyền legacy vĩnh viễn giữ nguyên. Dòng cũ không có renews_at được gắn legacy_unclassified để kiểm tra, không tự đặt ngày hết hạn.

Ba dòng catalog APP_KHOI_DAU/APP_CAN_BAN/APP_NANG_CAO chỉ ánh xạ tier Store đã tồn tại sang package_id. Không tạo SKU mới, không định giá, không cho Admin cấp bằng form thủ công.

## 3. Migration và an toàn

Thứ tự chạy trên DB đã có các schema cũ:

1. `db/package_enrollment_guard.sql`
2. `db/package_terms_setup.sql`
3. `db/package_content_access.sql`
4. `db/package_tool_access.sql` cho URL công cụ trực tiếp.
5. `db/package_student_identity_guard.sql` bảo vệ liên kết tài khoản và cờ Hành trình.
6. `db/store_subscription_cron.sql` sau khi Vault/Edge có secret đối soát giống nhau.

Đã chạy trên production. Các bước quyền học được kiểm tra trong transaction ROLLBACK trước; các bước enrollment/terms/content cuối cùng áp dụng trong cùng transaction.

Backup cục bộ (không commit, có mã giao dịch nên giữ riêng):

- `tmp/package-audit/pre-migration-backup.json`: packages/student_packages/student_entitlements và grants PKG.
- `tmp/package-audit/enrollment-backup.json`: enrollment và policy liên quan.
- `tmp/package-audit/functions.json` và các file SQL cạnh đó: hàm backend trước sửa.
- `tmp/package-audit/edge-backup/`: mã Apple/Google đang deploy trước sửa.

Không xóa dữ liệu production. Không sửa progress, XP, achievement, nhật ký. Bảng lịch sử chỉ cho Admin SELECT; mutation ghi lịch sử tự động. Giữ bản ghi trước gia hạn với status superseded; không ghi đè thời hạn cũ. Retry cùng request UUID không cộng thời gian hai lần.

Trigger hồ sơ chặn học sinh đổi chủ hồ sơ/cờ Hành trình để nhận quyền người khác; vẫn cho cập nhật hồ sơ cá nhân và nhận hồ sơ legacy qua email xác thực.

Enrollment cũ được giữ quyền bằng access_granted; enrollment mới do học sinh tự tạo không cấp quyền trả phí. Teacher/server vẫn cấp được. RLS bài học chặn đọc trực tiếp bài khóa; metadata mở/khóa vẫn có trong my_learning_state. SELECT(*) bài được phép học không bị lỗi do revoke cột. URL nội dung bài khóa cũng không gửi trong metadata resolver.

`db/rls_setup.sql` đã bỏ qua các bảng tự quản policy này. Sau khi chạy lại bộ setup cũ phải chạy các migration mới theo thứ tự trên, tránh cài lại resolver cũ.

## 4. API và giao diện

- `manage_student_package`: grant/renew/change/end, kiểm role ở backend, khóa transaction theo học sinh, chặn Store. Gia hạn còn hạn nối từ renews_at; hết hạn tính từ now. Đổi gói kết thúc gói cũ và bắt đầu gói mới cùng transaction.
- `activate_student_package` giữ chữ ký và cấu trúc trả về cho callers cũ, chuyển sang cùng service.
- `admin_student_packages`: snapshot gói, trạng thái theo thời gian máy chủ, catalog, lịch sử. Chỉ teacher/admin.
- `StudentList`: lọc tất cả/hiệu lực/sắp hết 7 ngày/hết hạn hoặc kết thúc/không gói và nguồn; giữ tìm tên/email/điện thoại; cột gói-hạn-nguồn trong danh sách.
- `StudentProfile` nhúng `StudentPackagePanel`: thông tin hạn, số ngày, tự gia hạn, lịch sử; cấp mới, gia hạn 1 tháng/theo config, đổi và kết thúc. Store chỉ xem. Form chọn khoá từ database; không suy quyền của HT chỉ dựa tên gói.
- Gói chưa có renew_months phải nhập số tháng cụ thể. Không suy “6 tháng” từ tên hoặc min_commit_months; không đổi nghĩa pricing hiện hành.
- UI dùng inline styles và màu Admin cũ; kiểm tra với component thật + dữ liệu minh họa ở chiều rộng tablet và 390px.
- `ToolRouteGate` kiểm tra URL công cụ trực tiếp qua `my_tool_route_access`, cùng flags của resolver; không hardcode danh sách route trả phí.
- Desktop đọc quyền từ useLearningAccess/my_learning_state; Mobile không fallback sang quyền legacy khi RPC lỗi cho học sinh. Refresh định kỳ và tại valid_until; cache đã quá hạn không được dùng.

## 5. Apple, Google, Web, Admin

- Apple: xác minh giao dịch rồi đọc **Get All Subscription Statuses** để lấy kỳ mới nhất, trạng thái, auto-renew và billing grace period. Thiếu expiry xác minh thì từ chối ghi quyền vô hạn. Chặn đổi chủ giao dịch.
- Google: đọc subscriptionsv2, lấy expiry và autoRenewEnabled, giữ quyền khi đã hủy nhưng còn hạn; hold/pause/expired mất quyền. Chặn đổi chủ giao dịch.
- Web/chuyển khoản: Admin xác nhận giao dịch rồi cấp với source=web và thời hạn cụ thể. Không thay cơ chế checkout/billing 2C2P đang làm dở.
- Admin cấp thủ công dùng cùng RPC, source=admin.
- `store-subscription-refresh`: cron mỗi phút, tối đa 100 nguồn Store cũ nhất/lượt; gọi lại API xác minh bằng các sync function. Secret riêng nằm trong Vault và Edge, không ghi service-role trong cron.
- `store-subscription-notifications`: URL nhận notification của cả Store. Payload chỉ là gợi ý tra cứu; KHÔNG tin status/expiry/student từ notification. Chỉ revalidate subscription đã gắn chủ sở hữu bằng API Store có xác thực, nên sự kiện giả/replay không tự cấp quyền.

URL cần cấu hình trong App Store Connect / Google Pub/Sub push:
`https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/store-subscription-notifications`

**Chưa xác nhận URL notification đã được gắn trong hai console Store.** Hiện đường đối soát mỗi phút đã hoạt động; vì vậy không cam kết thu hồi ngay tức thì từ Store khi chưa hoàn tất cấu hình notification. Thời hạn đã lưu luôn được kiểm ngay ở backend, không chờ cron để hết quyền.

Nguồn API: [Apple Subscription Status](https://developer.apple.com/documentation/appstoreserverapi/statusresponse), [Google subscriptionsv2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2), [Google RTDN](https://developer.android.com/google/play/billing/rtdn-reference).

## 6. Kiểm thử và kết quả

- `db/tests/package_terms_test.sql`: A–J PASS trong transaction rollback; quyền Web, đúng biên expires, trước/sau hạn, Apple mirror/revoke, giữ progress thật của fixture, nhiều nguồn và fallback legacy, UTC+7. Có kiểm lịch sử, Store/Admin guard và anon guard.
- `db/tests/learning_state_test.sql`: bộ regression hiện hữu chạy không lỗi cùng migration mới.
- So sánh tier trước/sau trên toàn bộ 662 hồ sơ: không giảm tier do migration; 653 legacy vẫn nguyên.
- `npm run build`: PASS (cảnh báo Tailwind/size chunk/alphaTab có sẵn).
- `deno check` bốn hàm Store: PASS.
- Identity guard: thử với role authenticated thật, tự bật Hành trình bị chặn và sửa hồ sơ cá nhân vẫn thành công (rollback).
- Kiểm thử trình duyệt với component thật và dữ liệu mô phỏng: list/filter, panel, form gia hạn, nút Store bị loại, bố cục hẹp.
- Production: gọi refresh trả HTTP 200; Apple API xác nhận subscription cũ đã hết 26/08, backend cập nhật expired, auto_renew=false. Không phải thử mua mới.
- Không có giao dịch Google thật trong dữ liệu audit; chưa kiểm thử mua/gia hạn/refund E2E trên thiết bị Store.

## 7. Giới hạn và việc tiếp theo

- Hoàn tất gắn notification URL ở Apple/Google console, rồi gửi test notification và chạy sandbox renewal/refund. Cron đang là đường đối soát dự phòng.
- Không thể bảo đảm phản ánh ngay thay đổi chưa nhận được từ Store khi API Store lỗi/mất kết nối. Lỗi xác minh không tự gia hạn hay tự đặt hạn mới.
- Luồng Google thay purchase token do thay gói cần app sync token mới; notification token chưa có chủ được bỏ qua để không đoán học sinh. Chưa tự chuyển chủ qua linkedPurchaseToken.
- App hiện tại là bundle (`capacitor.config.json` không có server.url). Quyền server áp dụng ngay cho app đã dùng my_learning_state; cải tiến refresh/fail-closed trong client cần phát hành bundle mới để đến máy cũ. Không tự build/upload Store trong đợt này.
- Bản app cũ đọc trực tiếp danh sách bài chỉ nhận bài được phép học; app mới lấy metadata khóa/mở qua resolver. Không xóa dữ liệu học.
- Cron xử lý 100 nguồn/lượt; khi số subscription lớn cần batch/concurrency có giới hạn và ưu tiên thông báo trực tiếp.
