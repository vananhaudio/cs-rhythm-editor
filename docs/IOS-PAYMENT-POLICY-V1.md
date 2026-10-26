# Chính sách thanh toán iOS V1 (Apple Guideline 3.1.1)

Nguồn: App Review Guidelines, https://developer.apple.com/app-store/review/guidelines/ — đọc ngày 2026-10-26.
(Trang không in ngày "Last updated" trong phần đọc được; ~14k ký tự cuối chưa đọc — không chứa mục 3.x. Reviewer nên đối chiếu lại bản hiện hành trước khi nộp.)

## 1. Trích ý chính (ngắn)

| Mục | Ý chính |
|---|---|
| 3.1.1 | Muốn mở khóa tính năng/nội dung trong app phải dùng In-App Purchase. Không dùng cơ chế riêng (license key, QR code, tiền mã hóa...) để mở khóa. |
| 3.1.1(a) | Link tới cách mua khác chỉ khi có entitlement của Apple. **Riêng storefront Mỹ** không cần entitlement. Ngoài Mỹ: app và metadata **không được có nút, link ngoài hay lời kêu gọi dẫn tới cơ chế mua khác IAP**. |
| 3.1.2 | Gói tự gia hạn: phải có giá trị liên tục, >= 7 ngày, dùng được trên mọi thiết bị; mô tả rõ người dùng nhận gì trước khi bán. |
| 3.1.3 (mở đầu) | Trong app **không khuyến khích** dùng cách mua khác IAP (trừ Mỹ và 3.1.1(a)/3.1.3(a)); được liên lạc ngoài app với tập người dùng đã có. |
| 3.1.3(a) Reader | Truy cập nội dung đã mua trước đó, chỉ các loại: tạp chí, báo, sách, audio, nhạc, video. |
| 3.1.3(b) Đa nền tảng | Dùng nội dung mua ở nền tảng khác nếu nội dung đó **cũng có bán qua IAP** trong app. |
| 3.1.3(c) Doanh nghiệp | Bán trực tiếp cho tổ chức/nhóm (nhân viên, học sinh). Cá nhân/gia đình phải IAP. |
| 3.1.3(d) Người-với-người | Dịch vụ thời gian thực **một-một** (vd. gia sư) được dùng cách khác; **một-với-vài / một-với-nhiều phải IAP**. |
| 3.1.3(e) Hàng hóa/dịch vụ dùng ngoài app | Phải dùng cách thanh toán khác IAP (Apple Pay, thẻ...) — vd. hàng vật lý. |
| 3.1.3(f) | App miễn phí độc lập (VoIP, lưu trữ, email, hosting) — không có mua hay CTA mua trong app. |
| 3.1.3(g) | App quản lý quảng cáo. |
| 3.2.1 / 3.2.2 | Các mô hình kinh doanh chấp nhận / không chấp nhận (không liên quan trực tiếp tới luồng của app này). |

## 2. Kết luận theo Việt Nam

Thị trường chính là Việt Nam (không phải storefront Mỹ) nên 3.1.1(a) áp dụng đầy đủ: **trong app iOS không được có nút/CTA/giá/hướng dẫn dẫn tới thanh toán ngoài IAP cho nội dung số, quyền truy cập trong app hay lớp học nhóm** (học nhóm nhiều người = "một-với-nhiều", không rơi vào 3.1.3(d)). Hàng vật lý (Shop nhạc cụ) hợp lệ theo 3.1.3(e). Ngoại lệ vùng: **chỉ storefront Mỹ** được phép link/nút mua ngoài mà không cần entitlement — V1 **không** tách theo vùng, mọi người dùng iOS native bị chốt chặn như nhau (đơn giản, an toàn; có thể mở riêng cho Mỹ sau nếu Owner muốn).

## 3. Phân loại luồng trong code

| Luồng | Loại giao dịch | file:dòng (trước sửa) | Cần IAP? / ngoại lệ | Quyết định |
|---|---|---|---|---|
| Gói tự gia hạn (khoi_dau/can_ban/monthly) | Nội dung số / quyền truy cập | `src/SubscriptionPage.tsx`, `src/iap.ts` | Có — đã là IAP | **Giữ nguyên** (kể cả Khôi phục, Quản lý đăng ký, "Gói của tôi") |
| Tuyển sinh lớp nhóm trực tiếp: bảng giá, form, QR/chuyển khoản, "Tôi đã chuyển khoản", gửi bill Zalo | Lớp nhóm có lịch (một-nhiều) cấp quyền giáo trình/app | `ClassLandingPage.tsx` ~436-440 (giá), ~548-596 (thanh toán), ~692 (footer); `components/ClassPublicTracks.tsx`, `ClassOfferCompare.tsx`, `ClassLearningWays.tsx`, `ClassAfterSignup.tsx`, `ClassJourney2027.tsx`; `classFaq.ts`, `class-content.ts` (chuỗi giá) | Có (3.1.1/3.1.1(a); không thuộc 3.1.3(d) vì nhiều người) | **Điều chỉnh**: trên iOS native thay cả trang bằng `IosProgramInfoPage` |
| Landing SOLO-01: giá 499k/396k, "Đăng ký qua Zalo", "ĐĂNG KÝ HỌC/SOLO-01", số Zalo tuyển sinh | Như trên | `Solo01Page.tsx` 217, 299, 512-534, 538-543, 555 | Có | **Điều chỉnh**: ẩn trên iOS; giữ lộ trình/nội dung chương trình |
| Landing Hành trình 2027: bảng `packages.price_vnd`, "Đăng ký qua Zalo/tham gia", số Zalo | Như trên | `Hanhtrinh2027Page.tsx` 429-463, 467-510, 515 | Có | **Điều chỉnh**: ẩn trên iOS; giữ thẻ "đã có quyền" cho học viên |
| Quyền truy cập giáo trình/bài trả/công cụ cấp sau khi mua ngoài app | Quyền số cấp bởi Admin/RPC `my_learning_state` | `lesson/*`, `class-social/*`, `classLearning/*` | Việc **cấp quyền** là backend (không đổi); vấn đề chỉ là CTA mua. Các màn này không có CTA/giá ngoài app | **Giữ** (không có điểm dẫn mua ngoài). Link "← Về chương trình" tới `/solo01`, `/hanhtrinh2027` — hai trang này đã qua chốt chặn |
| Shop nhạc cụ (nút Shop trong landing) | Hàng vật lý | `ClassLandingPage.tsx:21,409` (`<a href=SHOP_URL>` cùng WebView) | Không — 3.1.3(e) | **Giữ** (không ẩn máy móc). Trên iOS hiện ở `IosProgramInfoPage`, mở bằng `openExternalUrl` (`_system`), không thay WebView |
| iframe Mira `/shop?channel=class` | Trợ lý chat có thể gợi ý hàng + khóa | `ClassLandingPage.tsx:855` | Nội dung không kiểm soát được (có thể dẫn tới mua khóa ngoài app) | **Điều chỉnh**: không render trên iOS (nằm trong thân web bị chốt chặn) |
| Zalo hỗ trợ (MoreSheet "Nhắn Thầy qua Zalo", MobileStudentPortal "Liên hệ Thầy", nhóm lớp) | Liên hệ/cộng đồng, không mua bán | `class-mobile/MoreSheet.tsx:101`, `MobileStudentPortal.tsx:1845,3105` | Không phải giao dịch | **Giữ** |
| Zalo "Liên hệ" ở Story/Showcase | Liên hệ chung | `story/*`, `showcase/ShowcaseDetailPage.tsx` | Không dẫn mua ngày nay (nội dung CMS) | **Giữ**, ghi rủi ro nội dung CMS |

## 4. Triển khai V1 (chỉ giao diện/ranh giới native)

- `src/iosPaymentPolicy.ts`: `isIosNativeStorefrontFor({isNative,platform})` (thuần), `isIosNativeStorefront()` (Capacitor native && iOS), `openExternalUrl()`.
- `ClassLandingPage` (route `/class*`, và cả `class.*`): vỏ mỏng, iOS native -> `IosProgramInfoPage` (không giá/QR/Zalo đăng ký/iframe Mira; có Shop mở ngoài app, "Gói của tôi" -> /subscribe).
- `Solo01Page`, `Hanhtrinh2027Page`: ẩn giá, CTA đăng ký, số Zalo tuyển sinh khi `isIosNativeStorefront()`.
- Web và Android: không đổi (nhánh `false`). Không đổi giá, gói, entitlement, IAP plugin, edge function, DB.

## 5. Còn lại / quyết định kinh doanh

- Bán lớp trực tiếp qua IAP (sản phẩm non-consumable/consumable theo lớp) hay chỉ cho phép học viên đã đăng ký ngoài app xem nội dung: **chờ Owner**. Mô hình hiện tại (học viên đã mua ngoài app, app chỉ mở khóa) là vùng xám theo 3.1.1; an toàn nhất là IAP, hoặc xin entitlement 3.1.1(a).
- Nội dung server-driven (Bản tin `home_feed_items`, Story/Showcase CMS, Mira) có thể chứa link mua ngoài: cần quy ước biên tập, chưa chặn được ở client.
