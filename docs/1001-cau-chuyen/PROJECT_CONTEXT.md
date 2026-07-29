# PROJECT_CONTEXT.md

> Single Source of Truth (SSOT)

Tài liệu này là nguồn thông tin chính thức của dự án. Mọi AI hoặc lập
trình viên khi tham gia dự án **phải đọc file này đầu tiên** trước khi
thực hiện bất kỳ thay đổi nào.

------------------------------------------------------------------------

# 1. Thông tin dự án

-   Tên dự án: **1001 Câu chuyện cùng Guitar**
-   Mục tiêu: Giới thiệu dự án và xuất bản các câu chuyện thật của
    cộng đồng những người yêu guitar.
-   Đối tượng: Cộng đồng người yêu guitar (người học, người chơi,
    phụ huynh, giáo viên...) — bất kỳ ai có câu chuyện thật gắn với
    cây đàn guitar.
-   Phiên bản hiện tại: MVP V1 (đang khởi tạo)

------------------------------------------------------------------------

# 2. Triết lý dự án

Câu dẫn của dự án:

> **Nếu câu chuyện của bạn giúp được một người khác, hãy kể lại nhé.**

Nguyên tắc không được thay đổi:

-   Đây **không phải** mạng xã hội.
-   Đây **không phải** cuộc thi.
-   Đây là nơi **lưu giữ các câu chuyện thật** của những người yêu guitar.
-   Context-First: mọi tính năng phải trả lời được câu hỏi
    *"Context nào cần cái này?"* trước khi làm.

Phong cách ngôn ngữ:

-   Tiếng Việt, ấm áp, chân thành, gần gũi.
-   Không giật gân, không marketing hóa; tôn trọng câu chuyện thật.

------------------------------------------------------------------------

# 3. Kiến trúc tổng thể

**KHÔNG phải website mới.** Đây là **trang con của class.vananhaudio.com**,
nằm trong repo hiện có `~/App/cs-rhythm-editor` (TVA Guitar LMS — cũng
phục vụ timming.vananhaudio.com). Routing thêm nhánh `/story*` trong
`src/AppRouter.tsx` (đặt TRƯỚC nhánh `onClass` để không bị nuốt bởi
ClassLandingPage).

5 trang MVP V1 (theo `1001_Cau_chuyen_cung_Guitar_MVP_V1.md`), gom dưới
một prefix `/story` để không đụng các route app hiện có:

    class.vananhaudio.com
    ├── /story                — Landing Page: ngôi nhà của dự án
    ├── /story/all            — thư viện câu chuyện (bộ lọc, danh sách, thống kê)
    ├── /story/:slug          — chi tiết câu chuyện (ảnh, nội dung, bình luận, CTA)
    ├── /story/submit         — gửi câu chuyện (ảnh, tiêu đề, chủ đề, nội dung, bút danh, địa phương)
    └── /story/mine           — quản lý bài viết (đang viết / chờ duyệt / đã xuất bản)

Câu chuyện có quy trình duyệt trước khi xuất bản (không đăng tự do).
Duyệt bài: thầy duyệt trong /admin (theo mô hình các module hiện có).

## Hành trình kể chuyện cùng Mira

Trải nghiệm kể chuyện KHÔNG phải form — là **cuộc trò chuyện với Mira**
(người đồng hành AI). Người dùng không cần biết viết: Mira hỏi, gợi nhớ,
gợi ý chủ đề, thu thập ảnh, viết lại thành bài; người dùng duyệt/sửa và
xác nhận xuất bản. Thiết kế chi tiết: `docs/UX-FLOW-KE-CHUYEN.md`.

7 trạng thái của một câu chuyện:

    Đang kể → Đang thu thập ảnh → Đang viết → Chờ người dùng duyệt
            → Đã gửi biên tập → Chờ xuất bản → Đã xuất bản

Vòng lặp cốt lõi: duyệt nháp → kể thêm/nhờ sửa → Mira viết lại → duyệt
(lặp tự do). Nháp tự lưu, rời đi quay lại kể tiếp. Thông tin cá nhân
(bút danh, địa phương) chỉ hỏi ở bước cuối.

**Vai trò thư mục này (`~/App/1001 câu chuyện`):** nơi giữ tài liệu
phân tích, spec, thiết kế của dự án. **Mã nguồn thật nằm trong
`~/App/cs-rhythm-editor`** — thư mục `src/` ở đây không chứa code chạy.

------------------------------------------------------------------------

# 4. Cấu trúc thư mục

    PROJECT_CONTEXT.md   # Single Source of Truth
    CHANGELOG.md         # Nhật ký thay đổi
    README.md            # Giới thiệu nhanh
    1001_Cau_chuyen_cung_Guitar_MVP_V1.md  # Spec MVP V1
    docs/                # Tài liệu phân tích (database, api, ui, workflow...)
    ui/                  # Thiết kế giao diện
    database/            # Thiết kế dữ liệu
    assets/              # Hình ảnh, tài nguyên
    src/                 # Mã nguồn

------------------------------------------------------------------------

# 5. Công nghệ sử dụng

Theo stack hiện có của repo `cs-rhythm-editor` (không thêm công nghệ mới):

-   Framework: React 19 + TypeScript + Vite
-   Database: Supabase (project `wojmdilyflffvdtpovmq` — dùng chung,
    thêm bảng riêng cho stories; RLS như các bảng hiện có)
-   UI: Tailwind + inline styles (theo quy ước sẵn của repo)
-   Authentication: Supabase Auth sẵn có (`app_users`) — dùng cho
    /story/mine và bình luận
-   Deploy: push `main` → Netlify → class.vananhaudio.com
    (**bắt buộc `npm run build` trước khi push** — quy ước repo)

------------------------------------------------------------------------

# 6. Quy ước dữ liệu

Thiết kế đầy đủ: `docs/database.md`. SQL: `cs-rhythm-editor/db/story_setup.sql`
(**chưa chạy** trên Supabase).

-   **`stories`** — một dòng = một câu chuyện, cả vòng đời trên một
    dòng: `conversation` (jsonb, hội thoại Mira = nháp tự lưu),
    `content` (bài hoàn chỉnh), `photos` (jsonb ≤3 ảnh), `pen_name`,
    `location`, `ai_review`, `story_number` (#N/1001), `slug`.
    Cột trung tâm `status`: 7 trạng thái UX + `unpublished` (thầy gỡ).
-   **`story_comments`** — bình luận tối giản, cờ `hidden` để giám sát.
-   **Bucket `story-photos`** — public đọc, upload theo thư mục
    `{user_id}/`.
-   **RLS self_managed** (đã ghi vào mảng trong `db/rls_setup.sql`):
    anon chỉ đọc `published`; người kể chỉ CRUD bài của mình khi chưa
    gửi biên tập, không tự xuất bản được; AI biên tập (service role)
    chuyển submitted → published; thầy toàn quyền giám sát.
-   **Topic** chưa có bảng riêng — 10 chủ đề là hằng số trong code
    (tách bảng khi cần quản trị động).

------------------------------------------------------------------------

# 7. Quy ước giao diện

Chưa chốt — sẽ định nghĩa trong `ui/` khi bắt đầu làm Landing Page.

------------------------------------------------------------------------

# 8. Các quyết định đã chốt

1.  Website có 2 mục tiêu: giới thiệu dự án + xuất bản câu chuyện cộng đồng.
2.  Không phải mạng xã hội, không phải cuộc thi.
3.  MVP V1 gồm 5 trang như mục 3.
4.  Câu chuyện phải qua duyệt trước khi xuất bản.
5.  Quy trình làm việc: đọc PROJECT_CONTEXT.md trước khi code; mỗi lần
    chỉ làm một chức năng hoàn chỉnh (Power of 1); cập nhật
    PROJECT_CONTEXT.md + CHANGELOG.md sau mỗi hạng mục.
6.  **Là trang con của class.vananhaudio.com** (ví dụ
    class.vananhaudio.com/story), KHÔNG phải website mới — code nằm
    trong repo `cs-rhythm-editor`, dùng stack sẵn có (mục 5).
    (Quyết định của Văn Anh, 2026-07-27.)
7.  **Kể chuyện = trò chuyện với Mira, không phải điền form.** Mira
    hỏi – gợi nhớ – thu ảnh – viết lại; người dùng duyệt, sửa và xác
    nhận xuất bản. 7 trạng thái như mục 3. (Văn Anh chốt, 2026-07-27;
    chi tiết `docs/UX-FLOW-KE-CHUYEN.md`.)
8.  **Kể chuyện CẦN tài khoản — chính là tài khoản học sinh sẵn có**
    của class.vananhaudio.com (Supabase Auth + `app_users`), KHÔNG có
    hệ tài khoản mới. Cùng domain nên phiên đăng nhập dùng chung:
    học sinh click qua /story là vào thẳng, không đăng nhập lại.
    Người mới tạo tài khoản cùng hệ — cầu nối chuyển thành học viên.
9.  **Báo tin xuất bản qua cả 3 kênh:** mục sống trong app TVA +
    email + Zalo (tùy chọn).
10. **Mira engine dùng chung hạ tầng** trang tuyển sinh; được phép
    thêm model rẻ hơn cho tác vụ phù hợp nếu chi phí API cao.
11. **Biên tập: người kể duyệt → AI biên tập duyệt → TỰ ĐỘNG xuất
    bản.** Thầy chỉ giám sát sau xuất bản; AI không chắc mới chuyển
    thầy xem tay. (Tất cả Văn Anh chốt, 2026-07-27.)
12. **Hiến pháp Mira** (`docs/MIRA_CONSTITUTION.md` — đứng trên mọi
    tài liệu UX/kỹ thuật về Mira): Mira KHÔNG tạo/sáng tác/gợi ý nội
    dung/gieo ký ức. Chỉ lắng nghe (mặc định, không hỏi khi người
    dùng đang kể) — biên tập — khai quật ký ức khi thật sự cần (chỉ
    câu hỏi mở; cấm "Có phải…"/câu hỏi dẫn dắt). UI không được giống
    chat AI; cảm giác phải là "tôi đang kể chuyện".
13. **Cuốn sách sống** (`docs/10_Growth_Loop_va_Cuon_sach_song.md`):
    luôn hiển thị "📖 Bạn đang viết một trang cho 1001 Câu chuyện
    cùng Guitar"; xuất bản = có Trang/Chương/Số thứ tự trong sách.
    KHÔNG gamification: không điểm, level, huy hiệu, progress game.
14. **Growth Loop trao đuốc:** không nút Share/"mời bạn bè" — chỉ
    "Mời một người cũng có một câu chuyện đáng được lưu giữ"; người
    được mời chỉ tính khi chuyện của họ ĐƯỢC XUẤT BẢN; không thống kê
    lời mời đã gửi.
15. **Hồ sơ thành viên chỉ 3 số:** 📖 Đã đóng góp · 📚 Trang trong
    sách · ❤️ Đã giúp hình thành. Không điểm/level/số lời mời/ranking.
    (12–15 Văn Anh ban hành 2026-07-27.)
16. **Bước "Chuẩn bị xuất bản"** (Văn Anh chốt 2026-07-29): sau khi
    người kể bấm "Gửi Ban biên tập", KHÔNG gửi ngay — hiện màn xác
    nhận cách hiển thị: ảnh đại diện (LUÔN lấy từ hồ sơ học viên,
    KHÔNG upload riêng) · tên hiển thị (Họ và tên / Chỉ tên / Bút
    danh / Ẩn danh) · lớp học (tự động từ hệ thống, có thể ẩn) ·
    2 xác nhận bắt buộc (đồng ý biên tập câu chữ, đồng ý xuất bản).
    Nút cuối: "Xác nhận gửi Ban biên tập".
    **Mira KHÔNG được hỏi các thông tin này trong lúc kể** — chỉ xử
    lý ở bước này. Ưu tiên tái sử dụng dữ liệu hồ sơ sẵn có, không
    tạo nguồn dữ liệu mới. Thiết kế theo tinh thần tạp chí, không
    giống biểu mẫu hành chính. Chi tiết: `src/story/PublishPrep.tsx`.

------------------------------------------------------------------------

# 9. Tiến độ

## Đã hoàn thành

-   Khởi tạo cấu trúc dự án (thư mục, README, PROJECT_CONTEXT, CHANGELOG).
-   Chốt hướng triển khai: trang con `/story` của class.vananhaudio.com,
    trong repo `cs-rhythm-editor`, dùng stack sẵn có.
-   **Landing Page `/story`** (2026-07-27): file
    `cs-rhythm-editor/src/story/StoryLandingPage.tsx` + route `/story*`
    trong `AppRouter.tsx`. Trang tĩnh đủ 7 khối: Hero (+ thẻ chuyện mẫu),
    Lời ngỏ, Vì sao, Ai tham gia, Gợi ý chủ đề, Quy trình 4 bước, CTA.
    CTA tạm dẫn Zalo (form /story/submit chưa làm). Build pass, đã xem
    thử trên dev server. **Landing Page V1 đã được chốt.**
-   **UX Flow hành trình kể chuyện cùng Mira** (2026-07-27):
    `docs/UX-FLOW-KE-CHUYEN.md` — 9 bước (B0–B8), 7 trạng thái, vòng
    lặp duyệt–sửa, quy ước giọng Mira; 4 câu hỏi mở đã chốt hết.
-   **Database luồng kể chuyện ĐÃ CHẠY trên Supabase** (2026-07-27):
    `docs/database.md` + `cs-rhythm-editor/db/story_setup.sql`
    (2 bảng `stories`/`story_comments` + bucket `story-photos` + RLS
    hẹp; đã thêm vào self_managed của `rls_setup.sql`).
    Đã smoke-test từ ngoài bằng anon key: anon chỉ đọc published,
    không ghi được bảng nào, không upload được bucket — đạt cả 6 mục.

-   **Thiết kế API/luồng Mira** (2026-07-27): `docs/api.md` — Edge
    Function `story-ai` (Verify JWT BẬT) với 4 action: `chat` (model
    rẻ claude-haiku-4-5), `write`/`revise` (model tốt
    claude-sonnet-4-6, cùng Mira tuyển sinh), `review` (AI biên tập +
    tự xuất bản, gán slug + story_number). Các trang đọc/ghi thường
    đi thẳng Supabase qua RLS, không cần API riêng. Thông báo 3 kênh
    theo giai đoạn: app cùng MVP, email sau (chưa chốt dịch vụ),
    Zalo thầy nhắn tay trước.
-   **Màn trò chuyện với Mira — CODE XONG** (2026-07-27):
    -   Edge Function `supabase/functions/story-ai/index.ts` — action
        `chat` hoàn chỉnh (Verify JWT BẬT, user từ JWT, tạo story =
        nháp từ tin đầu, giới hạn chống lạm dụng, tín hiệu
        [[PHASE:write]]); write/revise/review trả 501, làm đợt sau.
    -   Trang `/story/tell` (`src/story/StoryTellPage.tsx`): màn B0
        (đăng nhập/tạo tài khoản giọng Mira, dùng signup-free sẵn có),
        chat B1–B2 (chip gợi ý, typing, nháp tự lưu + quay lại Mira
        nhớ, thẻ báo "bước viết sắp mở" khi đủ chất liệu).
    -   CTA landing đã trỏ về /story/tell (Zalo thành đường phụ).
    -   Build pass, màn B0 đã xem trên dev server.
-   **MVP 01: Story Interview — CODE XONG** (2026-07-27):
    -   Làm lại UI `/story/tell`: không render conversation; chỉ
        tiêu đề + lời mời ngẫu nhiên + ô nhập + nút gửi. Mira chỉ
        xuất hiện khi thật sự cần (hỏi thêm / báo đủ).
    -   Màn bản thảo: 📄 Bản thảo câu chuyện + 3 nút ✓ Đúng rồi /
        ✏️ Biên tập lại / ➕ Kể thêm.
    -   Luồng hoàn chỉnh: Kể → Mira ghi nhớ → đánh giá đủ → sinh
        bản thảo → duyệt → gửi biên tập.
    -   Viết lại toàn bộ Edge Function: prompt chat mới (Mira =
        người phỏng vấn, hành vi mặc định = im lặng); implement
        action `write` (sinh bản thảo), `revise` (sửa), `review`
        (AI biên tập + tự xuất bản).
    -   Build pass. Edge Function chưa deploy.

## Đang thực hiện

-   (chưa có)

-   **Bước "Chuẩn bị xuất bản"** (2026-07-29): `src/story/PublishPrep.tsx`
    + phase `publish_prep` trong StoryTellPage + `db/story_publish_prep.sql`.
    Build pass, đã xem trực quan. **SQL ĐÃ chạy** (2026-07-29).

## Tiếp theo

-   Thầy test luồng gửi thật (kể → bản thảo → Chuẩn bị xuất bản →
    Xác nhận gửi) rồi push `main`.
-   **Deploy lại Edge Function `story-ai`** với code MVP 01 mới
    (thầy dán Dashboard, Verify JWT = BẬT).
-   Test kể thật toàn bộ luồng → push main.
-   **Cần quyết:** màn hoàn tất hứa "Ban biên tập gửi lại bạn duyệt
    trước khi xuất bản" nhưng action `review` vẫn tự động xuất bản
    (quyết định 11) và EditorPage chưa có nút xuất bản tay. Chọn (a)
    bỏ auto-publish + thêm nút xuất bản cho Ban biên tập, hoặc (b)
    giữ auto-publish và sửa câu thông báo.

------------------------------------------------------------------------

# 10. Quy tắc bàn giao giữa các AI

Mỗi lần hoàn thành công việc phải:

1.  Cập nhật PROJECT_CONTEXT.md nếu có thay đổi về kiến trúc, quyết định
    hoặc trạng thái dự án.
2.  Ghi một mục mới vào CHANGELOG.md.
3.  Không thay đổi các quyết định đã chốt nếu không có yêu cầu mới.
4.  Khi bắt đầu làm việc, luôn đọc PROJECT_CONTEXT.md trước.
5.  Nếu có mâu thuẫn giữa các tài liệu, PROJECT_CONTEXT.md là nguồn sự
    thật duy nhất (Single Source of Truth).

------------------------------------------------------------------------

# Quy chuẩn áp dụng

Quy chuẩn này được áp dụng cho toàn bộ các dự án AI, website, ứng dụng
và phần mềm để bảo đảm mọi AI và lập trình viên có thể tiếp tục công
việc mà không cần giải thích lại từ đầu.
