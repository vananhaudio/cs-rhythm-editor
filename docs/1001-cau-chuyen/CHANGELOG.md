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

### 2026-07-27 (phiên 9)

#### Changed

-   **Viết lại system prompt `MIRA_SYSTEM`** trong Edge Function
    `story-ai` theo Hiến pháp Mira:
    -   Mặc định: CHẾ ĐỘ LẮNG NGHE — người dùng đang kể → Mira chỉ
        lắng nghe, không hỏi. Phản hồi ≤1 câu ngắn ("Mình đang
        nghe…", "Rồi sao nữa?") hoặc im lặng.
    -   CHẾ ĐỘ KHAI QUẬT chỉ khi: người dùng nói "bí"/"không nhớ" /
        "không biết kể gì" HOẶC body có `stuck: true`. Chỉ câu hỏi
        MỞ, mỗi lần một câu. CẤM "Có phải…", câu hỏi dẫn dắt,
        gợi chủ đề, gieo ký ức. Khai quật xong → trở về lắng nghe.
    -   6 lớp câu hỏi cũ chỉ còn là bản đồ ngầm.
    -   Thêm tham số `stuck?: boolean` trong body.
    -   Giữ nguyên: tín hiệu [[PHASE:write]], tách model, JWT.
-   **Làm lại UI `/story/tell`** từ chat bubbles → **"trang giấy
    đang viết"**:
    -   Lời người kể = dòng chảy văn bản chính, full-width, font
        17px, line-height 1.75.
    -   Lời Mira = ghi chú nhỏ chữ nghiêng, mờ, border-left, nằm
        như ghi chú bên lề — KHÔNG avatar, KHÔNG bong bóng chat,
        KHÔNG typing dots.
    -   Dòng cố định `📖 Bạn đang viết một trang cho 1001 Câu chuyện
        cùng Guitar.` (LivingBookBar).
    -   Nút "Mình đang bí…" kín đáo, sáng nhẹ sau ~60s im lặng.
        Mira KHÔNG tự chen khi người dùng im lặng.
    -   Tách component: `LivingBookBar`, `StoryPage`, `TellComposer`,
        `AuthGate` (giữ nguyên gate đăng nhập/tạo tài khoản).
    -   "Mira đang nghe…" thay cho typing dots (chữ mờ, pulse nhẹ).
-   **Sửa CTA landing** (`StoryLandingPage.tsx`, khối cuối):
    "Mira sẽ trò chuyện cùng bạn, đặt câu hỏi, gợi nhớ kỷ niệm…" →
    "Mira lắng nghe bạn kể và giúp sắp xếp lại thành bài — bạn chỉ
    cần kể thật."

#### Status

-   Build `npm run build` pass. **Edge Function chưa deploy lại**
    (cần thầy dán code mới qua Dashboard). **Chưa push main**
    (quy trình: thầy test kể thật → push).

### 2026-07-27 (phiên 10) — MVP 01: Story Interview

#### Changed — Triết lý & UI

-   **Làm lại toàn bộ UI `/story/tell` theo MVP 01:**
    -   KHÔNG render conversation ra giao diện — conversation là trí
        nhớ của Mira, lưu trong DB nhưng không hiển thị.
    -   UI tối giản: LivingBookBar + 1 lời mời ngẫu nhiên (4 câu) +
        ô textarea lớn + nút Gửi.
    -   Mira CHỈ xuất hiện khi thật sự cần: hỏi thêm chi tiết quan
        trọng, hoặc báo đã đủ để tạo bản thảo. Không "Mình đang
        nghe…", không "Cảm ơn…", không lời phản hồi sau mỗi tin.
    -   Màn bản thảo (DraftView): 📄 Bản thảo câu chuyện + 3 nút
        ✓ Đúng rồi / ✏️ Biên tập lại / ➕ Tôi muốn kể thêm.
    -   ✓ Đúng rồi → gọi review → màn "đã gửi đến Ban biên tập".
    -   ✏️ Biên tập lại → Mira hỏi phần cần sửa → gọi revise.
    -   ➕ Kể thêm → quay lại chế độ kể.
    -   Màn loading khi tạo bản thảo (spinner + "Mira đang sắp xếp…").
    -   Nháp tự lưu: nếu có bài dở → hiện resume bar; nếu có bản
        thảo chờ duyệt → hiển thị lại bản thảo.
    -   Bỏ hoàn toàn: bubble chat, timeline, lịch sử hội thoại,
        "trang giấy đang viết" phiên bản cũ, nút "Mình đang bí…".

#### Changed — Edge Function `story-ai`

-   **Viết lại toàn bộ Edge Function cho MVP 01:**
    -   **Prompt chat:** Mira = người phỏng vấn tạo tác phẩm.
        Hành vi MẶC ĐỊNH là IM LẶNG — không nói gì sau mỗi tin.
        Chỉ nói khi: thiếu chi tiết quan trọng (`[[PHASE:asking]]`)
        hoặc đã đủ chất liệu (`[[PHASE:ready]]`).
        Cấm: "Mình đang nghe…", "Cảm ơn…", "Mình nhớ rồi…",
        khen sáo, khuyến khích quá mức, giải thích, giáo dục.
    -   **Action `write`:** nhận storyId → gọi model tốt
        (claude-sonnet-4-6) → sinh bản thảo 300–600 chữ, ngôi
        thứ nhất, đúng giọng người kể → ghi title/topic/content
        vào DB, chuyển status `user_review`.
    -   **Action `revise`:** nhận storyId + instruction → sửa bản
        thảo theo yêu cầu → trả về bản đã sửa.
    -   **Action `review`:** nhận storyId (status `submitted`) →
        AI biên tập checklist → ok: tự xuất bản + gán slug,
        story_number / need_more: về user_review / escalate:
        giữ pending_publish chờ thầy.
    -   Bỏ: 6 lớp câu hỏi, chế độ lắng nghe/khai quật (thay bằng
        hành vi mặc định im lặng + hỏi khi cần).

#### Status

-   Build pass. **Edge Function chưa deploy.** Cần thầy dán code
    mới qua Supabase Dashboard.
-   **Chưa push main** (quy trình: thầy test → push).

------------------------------------------------------------------------

### 2026-07-29

#### Added — Bước "Chuẩn bị xuất bản"

-   `src/story/PublishPrep.tsx` (mới) — màn hình người kể xác nhận cách
    hiển thị TRƯỚC khi gửi Ban biên tập. Component độc lập, TS strict,
    responsive, có khối xem trước dòng tên như in trên tạp chí:
    -   **Ảnh đại diện:** luôn lấy từ `edu_students.avatar_url`,
        KHÔNG cho upload riêng. Chưa có ảnh → lời nhắc + nút
        "Cập nhật hồ sơ" (mở `/me`).
    -   **Tên hiển thị:** Họ và tên · Chỉ tên (từ cuối của họ tên) ·
        Bút danh (có ô nhập + tuỳ chọn lưu làm mặc định) · Ẩn danh
        ("Một người yêu guitar"). Chưa có hồ sơ học viên → mặc định
        Bút danh.
    -   **Lớp học:** lấy tự động qua RPC `my_groups()` →
        `class_schedule.group_id`. Một lớp → checkbox hiển thị/ẩn;
        nhiều lớp → chọn lớp hoặc "Không hiển thị lớp học".
    -   **Xác nhận:** 2 ô bắt buộc (đồng ý biên tập câu chữ · đồng ý
        xuất bản trên Tạp chí) — chưa tick đủ thì nút gửi bị khoá.
-   `db/story_publish_prep.sql` (mới, **ĐÃ chạy trên Supabase** 2026-07-29,
    smoke-test REST: tất cả cột mới đọc được, ghi vẫn bị RLS chặn):
    thêm cột `stories.display_mode / author_name / author_avatar_url /
    class_display / consent_edit / consent_publish / consent_at` và
    `edu_students.default_pen_name / default_display_mode`.
    Ảnh + tên được CHỐT (snapshot) lúc gửi vì anon không đọc được
    `edu_students` (PII) — trang công khai cần dữ liệu này.

#### Changed

-   `StoryTellPage.tsx`: thêm phase `publish_prep`. Nút bản thảo
    "✓ Đúng rồi" → **"Gửi Ban biên tập →"**, KHÔNG gửi ngay mà mở màn
    Chuẩn bị xuất bản; nút cuối là **"Xác nhận gửi Ban biên tập"**.
    Màn hoàn tất đổi thành "✓ Đã gửi Ban biên tập / Ban biên tập sẽ
    đọc, biên tập và gửi lại bạn duyệt trước khi xuất bản."
-   Luồng mới: Kể → Hoàn thành → Gửi Ban biên tập → **Chuẩn bị xuất
    bản** → Xác nhận gửi → Chờ Ban biên tập.
-   Mira KHÔNG hỏi avatar/tên/lớp/quyền riêng tư trong lúc kể — mọi
    thông tin xuất bản chỉ xử lý ở bước này (đúng MIRA_CONSTITUTION).

#### Status

-   Build pass; đã xem trực quan màn hình mới trên dev server.
-   `db/story_publish_prep.sql` đã chạy — sẵn sàng test luồng gửi thật.
    **Chưa push main** (chờ thầy test).
-   ⚠️ **Còn mâu thuẫn cần thầy quyết:** màn hoàn tất nói "Ban biên tập
    sẽ gửi lại bạn duyệt trước khi xuất bản", nhưng action `review`
    hiện vẫn TỰ ĐỘNG xuất bản (quyết định 11 cũ) và `EditorPage` mới
    chỉ đọc, chưa có nút xuất bản tay. Chọn một: (a) bỏ auto-publish +
    thêm nút xuất bản cho Ban biên tập, hay (b) giữ auto-publish và
    sửa lại câu thông báo.

#### Added — Kể bằng giọng nói (2026-07-29)

-   `src/story/useVoiceInput.ts` (mới) — hook nhận giọng nói dùng
    **Web Speech API sẵn có của trình duyệt**: KHÔNG tốn API, KHÔNG
    gửi audio lên server, không thêm thư viện. Tiếng Việt `vi-VN`,
    `continuous` + `interimResults`, tự bật lại khi trình duyệt ngắt
    vì im lặng (người kể ngừng nghĩ giữa chừng vẫn không mất mạch).
-   Nút micro trong ô soạn thảo `/story/tell`: đang nghe thì viền đỏ +
    sóng nhấp nháy + hiện chữ tạm thời; bấm lần nữa để dừng; bấm Gửi
    tự tắt micro.
-   **Lời nói chỉ đổ vào ô soạn thảo — KHÔNG tự gửi.** Người kể đọc
    lại, sửa, rồi tự bấm gửi (đúng nguyên tắc "người kể quyết định"
    của MIRA_CONSTITUTION).
-   Xuống cấp êm: trình duyệt không hỗ trợ → **ẩn hẳn nút micro**
    (không hiện nút hỏng). Chưa cấp quyền → báo tiếng Việt thân thiện
    "Trình duyệt chưa cho phép dùng micro…", vẫn gõ chữ bình thường.
-   ⚠️ **Lưu ý nền tảng:** Web Speech API chạy tốt trên Chrome/Edge
    (máy tính + Android) và Safari trên iOS. **KHÔNG có trong
    WKWebView** → học viên mở bằng **app TVA Guitar (iOS) sẽ không
    thấy nút micro**; muốn nói thì mở bằng Safari. Nếu sau này cần
    micro trong app, phải chuyển sang ghi âm + API chuyển giọng nói
    thành chữ (tốn phí, cần Edge Function mới).

#### Changed — Ban biên tập duyệt, bỏ AI tự xuất bản (2026-07-29)

-   `StoryTellPage.tsx` **bỏ lời gọi `action: 'review'`** sau khi gửi.
    Bài dừng ở `submitted` và nằm trong tab **📥 Chờ đọc** của
    `/editor`; Ban biên tập đọc rồi bấm xuất bản (kèm ảnh bìa).
    Lý do: `review` xuất bản ngay trong vài giây → bài lên Tạp chí
    **trước khi có người đọc**, **không có ảnh bìa** (luồng kể chưa
    thu ảnh), và vì bài đã `published` nên hai nút xuất bản trong
    `/editor` bị ẩn → luồng xuất bản có ảnh FLUX không bao giờ chạy.
-   Màn hoàn tất: bỏ câu "Ban biên tập sẽ đọc, biên tập và **gửi lại
    bạn duyệt** trước khi xuất bản" (hứa việc hệ thống không làm) →
    "Cảm ơn bạn đã kể. Ban biên tập sẽ đọc và biên tập câu chuyện
    của bạn."
-   Chưa bài nào đi qua đường AI tự xuất bản trước khi sửa (6 bài
    published hiện tại đều do Ban biên tập đăng, đều có ảnh) → không
    có dữ liệu hỏng cần dọn.
-   Action `review` trong `story-ai` giữ nguyên nhưng KHÔNG còn ai
    gọi — dọn sau, tránh đè code phiên khác đang sửa cùng file.

#### Fixed — Micro trong app iOS vẫn đòi cấp quyền (2026-07-29)

-   Triệu chứng: mở /story/tell trong app TVA Guitar, bấm micro vẫn bị
    đòi cấp quyền dù app đã có quyền microphone.
-   Nguyên nhân: **iOS coi "Nhận diện giọng nói" là quyền RIÊNG**, tách
    khỏi microphone. `Info.plist` mới chỉ có `NSMicrophoneUsageDescription`,
    **thiếu `NSSpeechRecognitionUsageDescription`**. Capacitor đã tự cấp
    quyền media capture cho WebView (`WebViewDelegationHandler.swift` trả
    `.grant`) nhưng đường đó KHÔNG áp dụng cho speech recognition —
    `webkitSpeechRecognition` đi qua framework Speech của Apple.
-   Sửa: thêm `NSSpeechRecognitionUsageDescription` vào
    `ios/App/App/Info.plist` (đã `plutil -lint` OK).
-   ⚠️ **CẦN BUILD LẠI XCODE + UPLOAD TESTFLIGHT** — đổi vỏ native nên
    cơ chế "deploy web là app tự cập nhật" KHÔNG đủ.
-   Lưu ý: kể cả sau khi sửa, lần đầu iOS VẪN hỏi một lần "cho phép
    nhận diện giọng nói" — đây là quyền khác với micro, hỏi một lần
    rồi thôi. App vào /story bằng `window.location.href = '/story'`
    (cùng origin timming.vananhaudio.com) nên không có vấn đề đa origin.
