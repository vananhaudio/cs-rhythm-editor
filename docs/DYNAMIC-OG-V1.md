# Dynamic OG V1 — thẻ chia sẻ theo từng URL (05/10/2026)

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
| `/band/<slug>` | tên Band + tagline (RPC `band_recruitment_public`), ảnh mặc định |
| `/solo01`, `/hanhtrinh2027`, `/nhipphach`, `/thuvien` | metadata tĩnh trong `STATIC_META` |
| `/me/classes/<id>` (và `/space`) | tên lớp (`class_schedule.name`) + ảnh khoá chính (`edu_courses.image_url` → `thumbnail_url` → mặc định) |
| `/me/classes/<id>/sessions/<n>` | `Buổi NN · tên lớp` + ảnh lớp |
| `/me/u/<id>` | preview chung "Trang cá nhân" — KHÔNG đọc DB |
| `/me`, `/me/*` khác | mặc định |

Mọi route khai báo đều được sửa `og:url` = URL thật (https, bỏ query/hash/gạch cuối).

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
Deploy lại commit main trước đó (không có thay đổi DB).
