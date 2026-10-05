# Dynamic OG V1 / V1.1 — thẻ chia sẻ theo từng URL (05/10/2026)

## Vấn đề
Class là SPA: mọi URL trả cùng `index.html`. Crawler Zalo/Facebook/Messenger chỉ đọc HTML thô,
nên mọi link ra preview trang chủ. Thêm nữa `index.html` để cứng `og:url` = trang chủ → Facebook gom
mọi link về một đối tượng. Đổi meta bằng JavaScript (Solo01, Band, Lớp) crawler không thấy.

## Cách làm
Netlify Edge Function `netlify/edge-functions/og-meta.ts` chạy ở CDN, thay thẻ trong `index.html`
trước khi trả về. Người và crawler nhận cùng HTML (không đoán User-Agent); SPA chạy như cũ.
Luật route + metadata ở `netlify/og/ogMeta.ts` (thuần, test `npm run test:og-meta`).
`/story/*` vẫn do `og-tags.ts` lo — không đổi.

| URL | Preview |
|---|---|
| `/` và route không khai báo | mặc định (`index.html`) |
| `/band/<slug>` | tên Band + tagline (RPC `band_recruitment_public`) + ảnh bìa Band |
| `/solo01`, `/hanhtrinh2027`, `/nhipphach`, `/thuvien` | chữ tĩnh trong `STATIC_META` + ảnh của entity landing đại diện |
| `/showcase/<slug>` | `seo_title`/`seo_description` (hoặc title/summary) + `cover_image` của trang đã publish |
| `/me/classes/<id>` (và `/space`) | tên lớp (`class_schedule.name`) + ảnh lớp |
| `/me/classes/<id>/sessions/<n>` | `Buổi NN · tên lớp` + ảnh lớp |
| `/me/u/<id>` | preview chung "Trang cá nhân" — KHÔNG đọc DB |
| `/me`, `/me/*` khác | mặc định |

Mọi route khai báo đều được sửa `og:url` = URL thật (https, bỏ query/hash/gạch cuối).

## Ảnh (V1.1 — Entity Cover, db/entity_cover_v1_setup.sql)
Ảnh chia sẻ là ẢNH CỦA ENTITY — cùng cột giao diện dùng, không có trường "OG thumbnail", không file
`public/og/*` theo route. `resolveOgImage(candidates)` lấy ảnh https đầu tiên, không có → ảnh mặc định.

| Entity | Chuỗi ảnh | Ai quản lý |
|---|---|---|
| Band | `bands.cover_url` → mặc định | Thầy/admin: Quản lý Band → "Ảnh bìa Band" (RPC `band_admin_set_cover`) |
| Tool | `edu_tools.image_url` (tra theo `route`) → mặc định | Admin: Quản lý công cụ → bấm ô biểu tượng |
| Lớp | `class_schedule.cover_url` → ảnh khoá chính → mặc định | Admin: Lịch lớp → "Ảnh lớp" (trống = ảnh khoá) |
| Buổi | chuỗi của Lớp | — |
| Khoá | `edu_courses.image_url` → `thumbnail_url` → mặc định | Admin: Giáo trình → logo khoá |
| Showcase / Story | ảnh bìa sẵn có → mặc định | như cũ |
| Profile | luôn chung | — (cần opt-in công khai, ngoài V1.1) |

Landing: `/solo01` = khoá `SOLO`, `/hanhtrinh2027` = lớp `program_code=HT2027`, `/nhipphach` = tool
`/nhipphach`, `/thuvien` = mặc định. Ảnh tải lên bucket `course-logos` có sẵn (JPG/PNG ≤ 5 MB),
nên dùng ảnh ngang 1200×630.

## Riêng tư
Chỉ đọc bằng anon key những gì anon vốn đọc được. Lớp/buổi: chỉ tên lớp + ảnh khoá — không lịch,
giá, Zoom, ghi chú, nội dung buổi hay thành viên. Profile: không tên, không avatar. Muốn hiện tên/avatar
profile → cần RPC hẹp có opt-in (migration, quyết định riêng của Owner).

## Lỗi / chẩn đoán
Header `x-og-fn`: `ok-<route>`, `fallback-<route>` (không có dữ liệu → thẻ mặc định + og:url đúng),
`error:<tên>` (Supabase lỗi/quá 1,5 giây → như fallback), `skip-not-html`.

## Kiểm tra
Bằng chứng = HTML thô, không phải ảnh chụp trình duyệt:
`curl -sS -A 'facebookexternalhit/1.1' https://class.vananhaudio.com/band/la-mua-thu | grep -E 'og:|<title>'`
Facebook/Zalo cache preview theo URL: server trả đúng mà app vẫn hiện cũ → Facebook Sharing Debugger
"Scrape Again"; Zalo giữ cache riêng một thời gian.

## Rollback
Frontend: deploy lại commit main trước đó. DB (chỉ khi thật cần, SAU khi frontend đã về bản cũ):
`db/entity_cover_v1_rollback.sql` qua prod-db — xoá 3 cột (mất URL ảnh đã đặt; file trong bucket còn).
