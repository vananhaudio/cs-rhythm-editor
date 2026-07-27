# CHANGELOG.md

## Template

### YYYY-MM-DD

#### Added

-   ...

#### Changed

-   ...

#### Fixed

-   ...

#### Removed

-   ...

------------------------------------------------------------------------

> Mỗi phiên làm việc nên ghi một mục mới vào cuối file.

### 2026-07-27

#### Added

-   Khởi tạo cấu trúc dự án: thư mục `docs/`, `ui/`, `database/`,
    `assets/`, `src/`.
-   README.md giới thiệu nhanh dự án.
-   Điền nội dung PROJECT_CONTEXT.md từ spec MVP V1 (thông tin dự án,
    triết lý, kiến trúc 5 trang, entity dự kiến, các quyết định đã chốt).

#### Changed

-   PROJECT_CONTEXT.md từ template trống thành SSOT có nội dung.
-   Chốt hướng triển khai (quyết định của Văn Anh): là **trang con của
    class.vananhaudio.com** (`/story`), không phải website mới. Code sẽ
    nằm trong repo `cs-rhythm-editor` (React + TS + Vite + Supabase +
    Netlify). Thư mục này chỉ giữ tài liệu.

#### Added (phiên 2)

-   **Landing Page `/story`** trong repo `cs-rhythm-editor`:
    -   `src/story/StoryLandingPage.tsx` (mới) — trang tĩnh theo ngôn
        ngữ thiết kế ClassLandingPage (nền kem, indigo, honey,
        Be Vietnam Pro). 7 khối: Hero + thẻ chuyện mẫu, Lời ngỏ,
        Vì sao có dự án, Ai có thể tham gia, Gợi ý chủ đề (10 pill),
        Quy trình 4 bước, CTA cuối (tạm dẫn Zalo).
    -   `src/AppRouter.tsx` — thêm nhánh route `/story*`.
    -   Build `npm run build` pass; đã kiểm tra trên dev server.
    -   Chưa push lên `main` (= chưa lên site thật) — chờ duyệt.

#### Added (phiên 3)

-   **`docs/UX-FLOW-KE-CHUYEN.md`** — thiết kế toàn bộ hành trình kể
    chuyện cùng Mira (chỉ trải nghiệm, chưa database/API/code):
    -   9 bước B0–B8: vào luồng → Mira chào → trò chuyện → xin ảnh →
        Mira viết → duyệt nháp (vòng lặp sửa) → ký tên gửi → biên tập →
        xuất bản; mỗi bước trả lời 4 câu hỏi (thấy gì / Mira nói gì /
        làm gì / vì sao tiếp tục).
    -   7 trạng thái: Đang kể → Đang thu thập ảnh → Đang viết → Chờ
        người dùng duyệt → Đã gửi biên tập → Chờ xuất bản → Đã xuất bản.
    -   Quy ước giọng Mira + danh sách "cố tình không có" (không form,
        không % tiến độ, không like/share).
    -   4 câu hỏi mở chờ Văn Anh chốt (tài khoản, kênh báo tin, Mira
        engine, quy trình biên tập).

#### Changed (phiên 3)

-   Landing Page V1 được chốt.
-   PROJECT_CONTEXT.md: thêm hành trình Mira vào kiến trúc (mục 3),
    quyết định đã chốt số 7, cập nhật tiến độ.

#### Changed (phiên 4)

-   Chốt 4 câu hỏi mở của UX Flow (quyết định của Văn Anh):
    1.  Kể chuyện **cần tài khoản** (TVA dùng chung; học sinh có sẵn,
        người mới tạo — cầu nối chuyển thành học viên).
    2.  Báo tin xuất bản qua **cả 3 kênh**: mục sống trên app + email
        + Zalo (tùy chọn).
    3.  Mira **dùng chung hạ tầng**; được thêm model rẻ hơn nếu tốn.
    4.  Biên tập: người kể duyệt → **AI duyệt → tự động xuất bản**;
        thầy chỉ giám sát, AI không chắc mới chuyển thầy.
-   `docs/UX-FLOW-KE-CHUYEN.md` cập nhật theo: B0 thêm nhánh đăng
    nhập/tạo tài khoản giọng Mira; B6 bỏ hỏi kênh báo tin (chỉ thêm
    Zalo tùy chọn); B7 viết lại theo mô hình AI biên tập vài phút +
    3 nhánh kết quả + dashboard giám sát; mục 7 từ "câu hỏi mở"
    thành "quyết định đã chốt".
-   PROJECT_CONTEXT.md: thêm quyết định 8–11, cập nhật bước tiếp theo.
-   Làm rõ quyết định 8 (lưu ý của Văn Anh): tài khoản = **tài khoản
    học sinh sẵn có** của class.vananhaudio.com, không có hệ tài khoản
    mới; cùng domain nên phiên Supabase dùng chung — học sinh click
    qua /story là vào thẳng, KHÔNG đăng nhập lại. Cập nhật UX Flow
    (nguyên tắc 6, B0, mục 7.1).

#### Added (phiên 5)

-   **Thiết kế database luồng kể chuyện**:
    -   `docs/database.md` — thiết kế + giải thích: 2 bảng mới, ERD,
        bảng phân quyền theo vai, danh sách "cố tình chưa làm",
        checklist triển khai.
    -   `cs-rhythm-editor/db/story_setup.sql` (mới, **CHƯA chạy trên
        Supabase**) — bảng `stories` (cả vòng đời câu chuyện trên một
        dòng; `conversation` jsonb = nháp tự lưu; 8 status; RLS: anon
        chỉ đọc published, owner chỉ sửa khi chưa gửi, không tự xuất
        bản được), bảng `story_comments`, bucket `story-photos` +
        policy upload theo thư mục người dùng.

#### Changed (phiên 5)

-   `cs-rhythm-editor/db/rls_setup.sql` — thêm `stories`,
    `story_comments` vào mảng self_managed (kèm chú thích lý do).
-   PROJECT_CONTEXT.md — mục 6 Quy ước dữ liệu viết lại theo thiết kế
    thật; cập nhật tiến độ.
-   **`db/story_setup.sql` ĐÃ CHẠY trên Supabase** (Văn Anh chạy 2 đợt
    — đợt 1 chỉ tới bảng stories, đợt 2 bổ sung story_comments +
    bucket). Smoke-test anon key đạt 6/6: SELECT stories/comments trả
    [] (chỉ published), INSERT cả 2 bảng bị chặn 401, bucket
    story-photos tồn tại, anon upload bị chặn.

#### Added (phiên 6)

-   **`docs/api.md`** — thiết kế API/luồng Mira (chưa code):
    -   Edge Function `story-ai` MỘT function 4 action, Verify JWT
        BẬT, user_id lấy từ JWT (không nhận từ body):
        `chat` (dẫn chuyện, tạo story = nháp từ tin đầu, model phát
        tín hiệu suggest_photos/suggest_write nhưng người dùng bấm
        mới chuyển) · `write` (viết bài 400–700 chữ từ hội thoại) ·
        `revise` (sửa theo yêu cầu; "kể thêm" thì quay về chat) ·
        `review` (AI biên tập checklist → ok tự xuất bản + gán slug,
        story_number / need_more về user_review kèm lời Mira /
        escalate nằm chờ thầy).
    -   Tách model: chat + review dùng claude-haiku-4-5 (rẻ);
        write + revise dùng claude-sonnet-4-6 (cùng Mira tuyển sinh).
    -   Bảng "việc nào đi thẳng RLS, việc nào qua Edge Function";
        giới hạn chống lạm dụng; lưới an toàn bài kẹt ở submitted;
        thông báo 3 kênh theo giai đoạn (app cùng MVP, email chưa
        chốt dịch vụ, Zalo thầy nhắn tay trước khi có OA).

#### Added (phiên 7) — Màn trò chuyện với Mira

-   `cs-rhythm-editor/supabase/functions/story-ai/index.ts` (mới) —
    action `chat`: xác thực JWT, tạo/mở story, nối hội thoại vào
    `conversation` (nháp tự lưu), system prompt giọng Mira + 6 lớp
    câu hỏi, model claude-haiku-4-5, tách tín hiệu [[PHASE:write]],
    giới hạn 1200 ký tự/tin · 120 tin/bài · 3 bài đang mở/người.
    Action write/revise/review trả 501 (hạng mục sau).
-   `cs-rhythm-editor/src/story/StoryTellPage.tsx` (mới) — trang
    /story/tell: gate đăng nhập/tạo tài khoản giọng Mira (dùng
    signup-free + signInWithPassword sẵn có), chat với chip gợi ý,
    typing indicator, tự mở lại bài kể dở (Mira chào "mừng bạn quay
    lại"), thẻ thông báo khi Mira phát tín hiệu đủ chất liệu.

#### Changed (phiên 7)

-   `AppRouter.tsx` — thêm route `/story/tell` (trước nhánh /story*).
-   `StoryLandingPage.tsx` — 3 CTA (nav, hero, khối cuối) trỏ về
    `/story/tell`; Zalo thành đường phụ "hoặc gửi qua Zalo".
-   Build pass; màn B0 kiểm tra OK trên dev server. **Chưa deploy
    Edge Function** (cần dán qua Dashboard, Verify JWT BẬT), chưa
    push main.

#### Added (phiên 8) — Hiến pháp Mira + Cuốn sách sống

-   **`docs/MIRA_CONSTITUTION.md`** (văn bản gốc Văn Anh ban hành):
    Mira không tạo/sáng tác/gợi ý nội dung/gieo ký ức; 2 chế độ
    (lắng nghe mặc định — khai quật khi bí, chỉ câu hỏi mở, cấm câu
    hỏi đóng/dẫn dắt); UI không giống chat AI; đứng trên mọi tài
    liệu UX/kỹ thuật về Mira.
-   **`docs/10_Growth_Loop_va_Cuon_sach_song.md`**: Cuốn sách sống
    (dòng "đang viết một trang…", Trang/Chương/Số thứ tự khi xuất
    bản, không gamification); Growth Loop trao đuốc (không Share,
    chỉ tính người được mời khi chuyện của họ xuất bản, không đếm
    lời mời); hồ sơ thành viên chỉ 3 số.

#### Changed (phiên 8)

-   `docs/UX-FLOW-KE-CHUYEN.md` đối chiếu hiến pháp: B2 viết lại
    (trang giấy + lắng nghe/khai quật, bỏ "6 lớp câu hỏi mỗi lượt",
    bỏ Mira gợi chip chủ đề, bỏ "🔥 dày lên từng chút"); B8 viết lại
    theo Growth Loop; thêm ghi chú hiến pháp đứng trên ở đầu file.
-   PROJECT_CONTEXT.md: thêm quyết định 12–15; bước tiếp theo là
    Story Interview theo hiến pháp (phân tích trước, duyệt mới code).
-   **Code hiện tại chưa sửa** — system prompt story-ai và UI chat
    /story/tell đang theo bản cũ, sẽ làm lại sau khi bản phân tích
    được duyệt (đúng yêu cầu "không code ngay").

#### Deployed (phiên 8)

-   **Push `main` (commit 3901eef) → Netlify → SỐNG trên
    class.vananhaudio.com/story** (landing) và `/story/tell` (màn
    kể — gate đăng nhập hiển thị đúng). Kèm toàn bộ tài liệu đồng bộ
    vào `docs/1001-cau-chuyen/` trong repo (README chỉ dẫn AI đọc
    theo thứ tự: PROJECT_CONTEXT → MIRA_CONSTITUTION → Growth Loop →
    UX flow → database/api) để AI khác vào cùng code.
-   Edge Function `story-ai` **ĐÃ được thầy deploy** (Verify JWT BẬT,
    smoke-test 401 đạt) — luồng kể chat hoạt động đầy đủ trên bản sống.
-   Thêm `HANDOFF-AI.md` (cả 2 nơi): văn bản bàn giao cho AI kế tiếp
    — trạng thái, nhiệm vụ kế đã duyệt, quy trình ra hàng.
