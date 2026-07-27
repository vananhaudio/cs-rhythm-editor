# API — Luồng Mira kể chuyện (/story)

> Thiết kế API cho hành trình kể chuyện. Đọc cùng `UX-FLOW-KE-CHUYEN.md`
> (trải nghiệm) và `database.md` (dữ liệu). **Chưa code** — tài liệu này
> là bản vẽ để phiên code làm theo.
>
> Nguyên tắc: dùng chung hạ tầng Mira tuyển sinh (Edge Function Deno +
> Anthropic API, mẫu `supabase/functions/class-ai/index.ts`), tách model
> theo tác vụ để tối ưu chi phí (quyết định số 10).

------------------------------------------------------------------------

# 1. Tổng quan — cái gì đi qua đâu

Phần lớn thao tác **KHÔNG cần API riêng** — đi thẳng Supabase qua RLS
đã dựng (xem `database.md`). Chỉ những việc cần AI hoặc cần vượt quyền
người dùng mới đi qua Edge Function.

| Việc | Đường đi | Ghi chú |
|---|---|---|
| Đọc thư viện (`/story/all`) | `select stories` trực tiếp | RLS: chỉ thấy published |
| Đọc chi tiết (`/story/:slug`) | `select stories where slug` | như trên |
| Bình luận | `select/insert story_comments` | RLS sẵn |
| Bài của tôi (`/story/mine`) | `select stories where user_id` | RLS sẵn |
| Upload ảnh (B3) | Storage trực tiếp, bucket `story-photos/{uid}/` | RLS sẵn |
| Bấm "Gửi câu chuyện" (B6) | `update stories set status='submitted'` | RLS cho phép, rồi gọi `review` |
| **Trò chuyện với Mira (B1–B3)** | Edge Function `story-ai` action `chat` | model RẺ |
| **Mira viết bài (B4)** | `story-ai` action `write` | model TỐT |
| **Nhờ Mira sửa (B5)** | `story-ai` action `revise` | model TỐT |
| **AI biên tập + xuất bản (B7)** | `story-ai` action `review` | model RẺ + service role |

------------------------------------------------------------------------

# 2. Edge Function `story-ai` — một function, 4 action

Vị trí: `supabase/functions/story-ai/index.ts`.

**Khác `class-ai` một điểm quan trọng:** người dùng ĐÃ đăng nhập
(quyết định số 8) → deploy với **Verify JWT = BẬT**; lấy `user_id` từ
JWT (`context.auth`), KHÔNG nhận user_id từ body (chống giả mạo).
Mọi action đều kiểm tra: story thuộc về đúng user gọi (trừ `review`
chạy service role sau khi kiểm tra trạng thái).

Secrets dùng chung đã có sẵn: `ANTHROPIC_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

## 2.1 Tách model theo tác vụ (quyết định 10)

| Tác vụ | Model | Vì sao |
|---|---|---|
| `chat` (dẫn chuyện) | `claude-haiku-4-5` | Nhiều lượt nhất trong luồng — hỏi ngắn, phản hồi ngắn, model rẻ đủ tốt |
| `write` (viết bài) | `claude-sonnet-4-6` | Khoảnh khắc "wow" của UX — đáng dùng model tốt (cùng model Mira tuyển sinh) |
| `revise` (sửa bài) | `claude-sonnet-4-6` | Chất lượng văn phải giữ như `write` |
| `review` (biên tập) | `claude-haiku-4-5` | Checklist đạt/không đạt — việc phân loại, không cần model đắt |

Model đặt trong hằng số đầu file (đổi được không cần deploy lại DB);
có thể chuyển sang đọc bảng config như class-ai nếu sau này cần chỉnh
nóng.

## 2.2 action `chat` — dẫn chuyện (B1–B3, trạng thái telling)

```
POST /functions/v1/story-ai
{ action: 'chat', storyId?: uuid, message: string }
→ { storyId, reply: string, phase: 'telling' | 'suggest_photos' | 'suggest_write' }
```

-   Không có `storyId` → tạo dòng `stories` mới (status `telling`,
    user_id từ JWT) — đây chính là "nháp tự lưu" từ tin nhắn đầu tiên.
-   Nối `{role:'user', text, at}` vào `conversation`, gọi model với:
    -   System prompt: giọng Mira (mục 5 UX flow) + kỹ thuật dẫn
        chuyện 6 lớp câu hỏi (B2) + quy tắc: mỗi lượt MỘT câu hỏi,
        nhắc lại chi tiết đắt, không chê, gợi chip chủ đề khi bí.
    -   Ngữ cảnh: `HISTORY` tin gần nhất (như class-ai, ~20) + tên
        học sinh (chào đúng tên — B0).
-   Model tự đánh giá đủ chất liệu → trả marker trong phản hồi
    (JSON mode hoặc tag cuối) → server dịch thành `phase`:
    -   `suggest_photos`: Mira đề nghị sang bước ảnh (B3)
    -   `suggest_write`: đủ rồi, đề nghị để Mira viết (B4)
    Client hiện nút tương ứng — **người dùng bấm mới chuyển**, Mira
    chỉ đề nghị (đúng nguyên tắc UX: người kể cầm lái).
-   Nối reply của Mira vào `conversation`, trả về client.

## 2.3 action `write` — Mira viết bài (B4)

```
{ action: 'write', storyId }
→ { title, topic, content }   // 400–700 chữ
```

-   Server set status `writing` khi bắt đầu, `user_review` khi xong
    (client chỉ việc hiển thị màn chờ B4 rồi bản nháp B5).
-   Prompt: toàn bộ `conversation` + caption ảnh + quy tắc bài viết
    (mục B4 UX flow): ngôi thứ nhất, đúng giọng người kể, **chỉ dùng
    chi tiết có thật trong hội thoại**, giữ nguyên các chi tiết đắt,
    đề xuất `title` + gắn `topic` (1 trong 10 chủ đề hoặc tự do).
-   Ghi `title/topic/content` vào dòng stories.

## 2.4 action `revise` — nhờ Mira sửa (B5)

```
{ action: 'revise', storyId, instruction: string }
→ { title, topic, content }
```

-   Chỉ chạy khi status `user_review`. Prompt = bài hiện tại + hội
    thoại + yêu cầu sửa ("ngắn lại", "đổi tiêu đề", "bớt văn hoa"…).
-   Người dùng "kể thêm" thì KHÔNG dùng revise — client quay về
    `chat` (status về `telling`) rồi `write` lại — đúng vòng lặp UX
    B5 → B2 → B4 → B5.

## 2.5 action `review` — AI biên tập + tự động xuất bản (B7)

```
{ action: 'review', storyId }
→ { verdict: 'ok' | 'need_more' | 'escalate' }
```

Client gọi NGAY sau khi update `status='submitted'` (B6). Server:

1.  Kiểm tra status = `submitted` (chống gọi bừa) → set `pending_publish`.
2.  Model RẺ chấm theo checklist (mục B7 UX flow): chuyện thật đúng
    tinh thần dự án · không quảng cáo/spam · không nội dung không phù
    hợp · không lộ thông tin nhạy cảm người khác (SĐT, địa chỉ…) ·
    chính tả/ngắt đoạn ổn. **Chỉ được sửa nhẹ, không đổi giọng.**
3.  Ghi `ai_review = {verdict, notes, at}` rồi rẽ 3 nhánh:
    -   **`ok`** (đa số): sửa nhẹ nếu cần → gán `slug` (từ title,
        không dấu) + `story_number` (MAX(story_number)+1 — trong một
        UPDATE nguyên tử) → `status='published'`, `published_at=now()`
        → gửi thông báo (mục 3).
    -   **`need_more`**: `status='user_review'` + Mira nhắn góp ý
        thành 1–2 câu hỏi (lưu vào conversation) — client thấy bài
        quay về "Chờ bạn duyệt" kèm lời Mira, không bao giờ là "bị
        trả lại".
    -   **`escalate`** (hiếm): GIỮ `pending_publish` — bài nằm chờ
        thầy xem tay trong dashboard /admin. Người dùng chỉ thấy
        "đang biên tập" lâu hơn.

**Lưới an toàn bài kẹt:** nếu client đóng tab trước khi gọi `review`,
bài nằm ở `submitted` mãi. MVP: `/story/mine` khi mở thấy bài
`submitted` quá 5 phút → client gọi lại `review` (idempotent nhờ bước
1). Sau này có thể thêm pg_cron quét — chưa cần.

## 2.6 Giới hạn chống lạm dụng (theo mẫu class-ai)

-   `MAX_MSG_LEN` 1200 ký tự/tin · `MAX_STORY_MSGS` 120 tin/câu chuyện
    (dài hơn class-ai vì kể chuyện dài hơi hơn tư vấn).
-   Tối đa **3 câu chuyện đang mở** (chưa xuất bản) / người — Mira
    mời hoàn thành bài dở trước khi mở bài mới.
-   `max_tokens`: chat/review 700 · write/revise 2000.

------------------------------------------------------------------------

# 3. Thông báo xuất bản (B8) — 3 kênh, làm theo giai đoạn

| Kênh | Cách làm | Giai đoạn |
|---|---|---|
| **Mục sống trên app** | Không cần hạ tầng mới: app đọc `stories` của user, thấy `published` mới → hiện thẻ 🎉 + badge. | Cùng MVP |
| **Email** | `review` gửi qua dịch vụ email (cần chọn: Resend/SES — repo CHƯA có hạ tầng email ngoài Supabase Auth). | Sau MVP — cần chốt dịch vụ |
| **Zalo** | Zalo OA API cần đăng ký OA + duyệt — chưa đáng. MVP: dashboard /admin liệt kê bài mới đăng + số Zalo người kể → thầy nhắn tay (mỗi ngày vài bài, vừa sức, lại ấm). | Tay trước, OA sau |

------------------------------------------------------------------------

# 4. Điều kiện chạy & checklist deploy (cho phiên code)

1.  `supabase/functions/story-ai/index.ts` — viết theo mẫu class-ai
    (CORS, json helper, service role client).
2.  Deploy: Dashboard → Edge Functions → story-ai → **Verify JWT = BẬT**
    (khác class-ai vốn TẮT cho anon).
3.  Secrets: dùng lại `ANTHROPIC_API_KEY` đã có của class-ai.
4.  Test tay theo thứ tự: chat tạo story mới → chat vài lượt →
    write → revise → update submitted → review → kiểm tra published +
    slug + story_number + anon đọc được.

------------------------------------------------------------------------

# 5. Chưa quyết / để sau

-   Dịch vụ gửi email (Resend? SES?) — chốt khi làm thông báo email.
-   Streaming phản hồi Mira (SSE) — MVP dùng chờ-cả-câu như class-ai;
    nâng cấp nếu cảm giác chậm.
-   Đọc model từ bảng config (chỉnh nóng không redeploy) — thêm khi
    cần thí nghiệm model.
