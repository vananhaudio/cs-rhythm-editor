# Universal OG — thẻ chia sẻ cho mọi URL (Bước A, 05/10/2026)

Thay Dynamic OG V1/V1.1 (danh sách route viết tay). Owner không phải nhớ "URL này đã làm thumbnail chưa".

## Kiến trúc
```
URL → Registry (netlify/og/registry.ts) → Resource Adapter → ShareMeta → Renderer (render.ts) → index.html
          không adapter nào / private / not_found / lỗi / quá 2,5 s → thẻ mặc định Class, og:url vẫn đúng
```
- MỘT Netlify Edge Function `netlify/edge-functions/og.ts`, `path: '/*'`, loại trừ site proxy (`/teamlab`, `/azz`,
  `/khobaigiang`, `/login`, `/api`, `/_next`, `/privacy`, `/tvaprivacy`) và `/assets/*`. Không SSR: người và crawler
  nhận cùng `index.html`, SPA chạy như cũ.
- `ShareMeta` (netlify/og/contract.ts): `title, description, image, canonicalUrl, visibility (public|private|not_found), type?`.
  Renderer chỉ ghi thẻ khi `public`; ngược lại chỉ sửa `og:url`.

## Adapters (một loại resource = một adapter)
| Adapter | URL | Nguồn (anon) | Công khai khi | Ảnh |
|---|---|---|---|---|
| band | `/band/<slug>` | RPC `band_recruitment_public` | Band active | `bands.cover_url` |
| class | `/me/classes/<id>(/space)` | `class_schedule` | `is_active` và không nháp/huỷ/gộp | ảnh lớp → ảnh khoá → mặc định |
| session | `/me/classes/<id>/sessions/<n>` | + `class_sessions` | buổi có thật + lớp công khai | như lớp |
| story | `/story/<slug>` | `stories` | `published` | `photos[0]` |
| showcase | `/showcase/<slug>` | `showcase_pages` | `published` | `cover_image` |
| profile | `/me/u/<id>` | — (không đọc DB) | không bao giờ (chưa có opt-in) | — |
| landing | khai trong `LANDINGS` (routes.ts) | entity được gắn | entity công khai | ảnh entity |
| tool | mọi path một đoạn trùng **đúng một** dòng `edu_tools.route` | `edu_tools` (cache 60 s) | `status ≠ off` | `edu_tools.image_url` |

Landing hiện có: `/solo01` → khoá `SOLO`; `/hanhtrinh2027` → chương trình `HT2027`. `/thuvien` không gắn entity → mặc định.

## Nội dung mới
- Band / Lớp / Buổi / Story / Showcase / Tool mới: **không sửa code** — tạo nội dung + ảnh trong Admin là có preview.
- Loại resource mới: thêm MỘT adapter vào `ADAPTERS` + phân loại route ở `netlify/og/routes.ts`.
- Route SPA mới: phải phân loại (`resource | page | private | proxy`) ở `routes.ts` —
  `tests/og/routeCoverage.test.ts` đọc AppRouter / resolveMeRoute / bandModel / `_redirects` và FAIL nếu thiếu.

## Riêng tư
Crawler là khách: adapter chỉ đọc cột công khai bằng anon key, không `select=*`. Private / not_found → không mang chữ hay
ảnh của resource. Test: `npm run test:og`.

## Chẩn đoán
Header `x-og-fn`: `<type>:public|private|not_found`, `page` (không phải resource), `error:<lý do>`, `skip` (không phải HTML).
`curl -sS -A 'facebookexternalhit/1.1' https://class.vananhaudio.com/band/la-mua-thu | grep -E 'og:|<title>'`

## Rollback
Frontend: deploy lại commit main trước Bước A. DB không đổi trong Bước A.
Entity Cover (V1.1) rollback DB: `db/entity_cover_v1_rollback.sql`, chỉ sau khi frontend đã về bản trước V1.1.
