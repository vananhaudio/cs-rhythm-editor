# BÀN GIAO CHO AI KẾ TIẾP — 1001 Câu chuyện cùng Guitar

> Cập nhật: 2026-07-27. Người bàn giao: Claude (phiên khởi tạo dự án).

Bạn là **Lead Software Engineer** tiếp quản dự án "1001 Câu chuyện cùng
Guitar" — trang con `/story` của class.vananhaudio.com, nằm trong repo
GitHub `vananhaudio/cs-rhythm-editor` (máy thầy: `~/App/cs-rhythm-editor`).

## 1. Đọc trước khi làm BẤT CỨ GÌ

Trong repo, thư mục `docs/1001-cau-chuyen/`, theo đúng thứ tự:

1.  `PROJECT_CONTEXT.md` — SSOT, 15 quyết định đã chốt. KHÔNG tự thay đổi.
2.  `MIRA_CONSTITUTION.md` — **hiến pháp Mira, đứng trên mọi tài liệu**:
    Mira chỉ lắng nghe / biên tập / khai quật ký ức khi thật sự cần.
    KHÔNG sáng tác, KHÔNG gợi ý nội dung, KHÔNG gieo ký ức, KHÔNG câu
    hỏi đóng-dẫn dắt. UI không được giống chat AI.
3.  `10_Growth_Loop_va_Cuon_sach_song.md` — Cuốn sách sống, growth loop
    trao đuốc, hồ sơ 3 số. KHÔNG gamification.
4.  `UX-FLOW-KE-CHUYEN.md` — trải nghiệm B0–B8.
5.  `database.md` + `api.md` — dữ liệu & API.

Và `CLAUDE.md` gốc của repo (quy ước bắt buộc: **inline styles, không
react-router** — routing bằng if trong `src/AppRouter.tsx`, all-database,
**`npm run build` bắt buộc trước khi push**, push `main` = Netlify deploy
NGAY lên timming. + class.vananhaudio.com).

Quy tắc làm việc: code mâu thuẫn tài liệu → **tài liệu đúng**. Xong mỗi
hạng mục → cập nhật `PROJECT_CONTEXT.md` + `CHANGELOG.md`. Power of 1:
mỗi lần MỘT hạng mục chạy được. Chưa rõ yêu cầu → hỏi thầy, không suy diễn.

## 2. Trạng thái hiện tại (2026-07-27)

-   **SỐNG trên internet:** class.vananhaudio.com/story (landing) và
    /story/tell (màn kể — đăng nhập bằng tài khoản học sinh sẵn có,
    cùng phiên Supabase, không đăng nhập lại).
-   **Database ĐÃ chạy** trên Supabase `wojmdilyflffvdtpovmq`: bảng
    `stories`, `story_comments`, bucket `story-photos`, RLS hẹp
    (self_managed trong `db/rls_setup.sql`) — smoke-test 6/6 đạt.
-   **Edge Function `story-ai` ĐÃ deploy** (Verify JWT BẬT — đã test:
    gọi không JWT trả 401). Action `chat` chạy; `write`/`revise`/
    `review` trả 501 — chưa làm.
-   ⚠️ **Prompt story-ai + UI /story/tell đang theo bản CŨ** (chat hỏi
    liên tục kiểu chatbot) — TRÁI hiến pháp Mira vừa ban hành. Đây
    chính là việc kế tiếp.

## 3. NHIỆM VỤ KẾ TIẾP (phân tích đã được thầy duyệt)

**Hạng mục: "Story Interview theo Hiến pháp Mira"** — một hạng mục,
gồm:

1.  **Viết lại `MIRA_SYSTEM`** trong
    `supabase/functions/story-ai/index.ts`:
    -   Chế độ LẮNG NGHE mặc định: người dùng đang kể → không hỏi,
        phản hồi ≤1 câu kiểu "Mình đang nghe…" / "Rồi sao nữa?" hoặc
        rất ngắn.
    -   Chế độ KHAI QUẬT chỉ khi: người dùng nói "bí/không nhớ/không
        biết kể gì" HOẶC body có `stuck: true`. Chỉ câu hỏi MỞ, mỗi
        lần một câu ("Bạn nhớ điều gì đầu tiên?"…). CẤM "Có phải…",
        "…phải không", gợi chủ đề, gieo tình tiết/cảm xúc.
    -   Giữ tín hiệu `[[PHASE:write]]`. Body thêm `stuck?: boolean`.
2.  **Làm lại `src/story/StoryTellPage.tsx`** từ chat bubbles →
    **trang giấy đang viết**:
    -   Lời người kể = dòng chảy văn bản chính, chiếm trọn mặt trang.
    -   Lời Mira = ghi chú nhỏ chữ nghiêng, mờ, bên lề — KHÔNG bong
        bóng chat, KHÔNG avatar đối đáp, KHÔNG typing dots.
    -   Dòng cố định trên đầu: `📖 Bạn đang viết một trang cho 1001
        Câu chuyện cùng Guitar.`
    -   Nút kín đáo "Mình đang bí…" — sáng nhẹ sau ~60s im lặng;
        Mira KHÔNG BAO GIỜ tự chen khi người dùng im lặng.
    -   Tách component: `LivingBookBar`, `StoryPage`, `TellComposer`,
        `AuthGate` (giữ nguyên). TypeScript strict, responsive.
3.  Sửa câu landing (`StoryLandingPage.tsx`, khối CTA cuối) "Mira sẽ
    trò chuyện cùng bạn, đặt câu hỏi, gợi nhớ kỷ niệm…" → đúng tinh
    thần lắng nghe (vd: "Mira lắng nghe bạn kể và giúp sắp xếp lại
    thành bài — bạn chỉ cần kể thật").
4.  Quy trình ra hàng: `npm run build` pass → thầy dán code function
    mới qua Dashboard (máy KHÔNG có supabase CLI — dùng `pbcopy <
    supabase/functions/story-ai/index.ts` rồi thầy ⌘V; lần trước dán
    tay từng bị cắt cụt giữa chừng, kiểm tra dòng cuối phải là `})`)
    → thầy test kể thật → mới push `main`.

## 4. Hạng mục SAU đó (đừng làm trước)

1.  Action `write` + màn bản nháp B5 (hiển thị như bài đã xuất bản,
    3 nút: Ưng rồi / Tự sửa / Nhờ Mira sửa).
2.  B6 ký tên + `review` (AI biên tập tự xuất bản, gán slug +
    story_number) — xem `api.md` mục 2.5.
3.  Thư viện /story/all + chi tiết /story/:slug (Cuốn sách sống:
    Trang/Chương).
4.  Growth Loop (thêm cột `invited_by` vào stories — KHÔNG bảng
    invite, không đếm lời mời) + hồ sơ 3 số.

## 5. Liên hệ & môi trường

-   Thầy Văn Anh quyết định mọi thứ chưa chốt; hỏi trước khi làm.
-   Dev: `npm run dev` (vite). Test màn kể: cần tài khoản học sinh.
-   Tài liệu gốc thầy giữ tại `~/App/1001 câu chuyện/` (máy thầy);
    sửa tài liệu thì đồng bộ CẢ HAI nơi.
