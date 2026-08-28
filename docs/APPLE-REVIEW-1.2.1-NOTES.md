# Apple Review — TVA Guitar 1.2.1 (build 16)

> Bản cập nhật của 1.2.0. **Không thay đổi** subscription / product IDs / trial / paywall.
> Chỉ cập nhật giao diện (Trang chủ, Học, Thầy, Tôi) và tinh chỉnh trải nghiệm.

## Review Notes (dán vào App Review Information → Notes)

```
Thầy Văn Anh Guitar is a guitar learning platform by teacher Van Anh Tran (Vietnam).

FREE ACCESS: The app opens directly into free learning content and practice tools.
No login and no purchase are required to use the free tier.

SUBSCRIPTIONS (auto-renewable, group "TVA Guitar Access") — unchanged from 1.2.0:
- Khởi đầu (Starter) — com.vananhaudio.guitar.subscription.khoi_dau — 1 month
- Căn bản (Essential) — com.vananhaudio.guitar.subscription.can_ban — 1 month
These unlock additional learning content and features.
The third plan shown ("Nâng cao" / Advanced) is displayed as "Coming soon"
and CANNOT be purchased in this version.

Users must sign in to a TVA account before purchasing, so the subscription
entitlement is attached to the correct learner account. Purchases are verified
server-side with the App Store Server API before entitlement is granted.

HOW TO TEST:
1. Open the app — free content is available immediately (no login).
2. Tap "Chọn gói" (Choose plan) to open the subscription screen (route /subscribe).
3. Sign in with the demo account below.
4. Choose "Khởi đầu" or "Căn bản" → the standard Apple purchase sheet appears.
5. "Khôi phục giao dịch" (Restore Purchases) is a button on the same
   subscription screen, below the plan list.
6. "Quản lý đăng ký" (Manage Subscription) is next to it and opens Apple's
   subscription management sheet.
7. Privacy Policy and Terms of Use (Apple standard EULA) links are in the
   footer of the subscription screen.

DEMO ACCOUNT:
Email: vananhaudio+applereview@gmail.com
Password: <lấy từ ghi chú nội bộ — memory apple-12-submission-state; điền lúc submit>
```

## Việc thầy cần làm trong App Store Connect (theo thứ tự)

1. **Tạo version mới 1.2.1**: trang app → nút "+" cạnh "iOS App" → New version → `1.2.1`.
2. **What's New** (dán):
   "Giao diện mới cho hành trình học Guitar, Trang chủ cá nhân hóa hơn, cải thiện mục Học, Thầy và Tôi, cùng nhiều tinh chỉnh trải nghiệm."
3. **Chọn Build**: 1.2.1 (16) — sau khi Xcode upload xong và build được xử lý.
4. **App Review Information**: bật "Sign-in required", điền demo account + dán Review Notes ở trên. Contact = số điện thoại/email thầy.
5. **Subscription** (Khởi đầu 6804806156 / Căn bản 6804800837): **giữ nguyên**, không tạo mới, không sửa. Nếu 2 gói này đã Approved từ 1.2.0 thì không cần đụng lại.
6. Nếu Apple hỏi Export Compliance: app chỉ dùng HTTPS chuẩn → "None of the algorithms mentioned" / exempt.
7. DỪNG — thầy tự bấm **Submit for Review**.

## Ghi chú kiến trúc (để reviewer/ta không hiểu nhầm)
- App dùng **web assets đóng gói** trong bản native (bundled). **Không** bật `server.url`.
- Cập nhật giao diện = build lại native + nộp lại store (không tự cập nhật qua web).
