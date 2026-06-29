---
name: reference-kho-tri-thuc
description: "App RIÊNG \"Kho Tri Thức Văn Anh\" (Next.js, có Anthropic API key) — KHÁC repo LMS cs-rhythm-editor"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

"Kho Tri Thức Văn Anh" là app RIÊNG của thầy ở `~/App/Kho tri thức baì giảng/` (bàn giao: `~/App/Kho tri thức baì giảng/BAN-GIAO-CONTEXT.md`). Stack: Next.js 14 App Router + TypeScript, DB better-sqlite3 `kho.db` (local trên Mac), YouTube Data API (2309 video). **Đây là nơi thầy ĐÃ CÓ Anthropic API key** (`.env.local` biến `ANTHROPIC_API_KEY` dạng `sk-ant-…`, SDK `@anthropic-ai/sdk`, model `claude-opus-4-8`/`claude-sonnet-4-6`/`claude-haiku-4-5`, structured output qua `output_config.format.json_schema`). Pipeline: transcript (yt-dlp phụ đề tự động VN) → AI `suggestCards` đề xuất card tri thức → thầy duyệt ✓/✗. Mô hình: concepts (aspiration|problem|topic), knowledge_cards, voice_quotes; 10 Khát vọng + 129 Vấn đề (9 nhóm A–I) đã KHÓA.

**Why:** Khi thầy nói "đã có khoá API / dùng AI tạo kho tri thức trong admin" là nói app NÀY, không phải repo LMS cs-rhythm-editor (LMS không có LLM key — chỉ có khoá YouTube hardcode client-side ở SongBuilder/MobilePortal/TapTempo). "Kho Tri Thức" trong LMS (SupportFlow) chỉ là nút placeholder "sắp có".

**How to apply:** Đừng nhầm 2 app. LMS = React+Vite+Supabase, deploy Netlify, KHÔNG có server → muốn AI hành động trong admin LMS phải tự dựng backend (Netlify Function / Supabase Edge Function) giữ khoá Anthropic riêng; không mượn được server app Kho Tri Thức (chạy local). Triết lý chung thầy muốn giữ: AI chỉ GỢI Ý, không tự quyết/tự lưu, thầy luôn chốt. Liên quan [[reference_handoff_docs]].

**KẾ HOẠCH (thầy nói 2026-06-20):** Kho Tri Thức hiện build LOCAL, SAU sẽ "đẩy lên / ghép vào admin LMS này". Tức migrate `kho.db` SQLite → Supabase Postgres + port Next.js → Vite/Edge Function. ⇒ Khi dựng backend AI cho admin LMS (việc trước mắt: copilot tạo tài khoản học sinh), làm TỔNG QUÁT (endpoint "admin AI") và nghiêng **Supabase Edge Function** (sát Postgres + service_role) để sau KB về Supabase thì AI+data cùng nhà. Chờ thầy chốt: Edge Function vs Netlify Function + khoá mới-riêng vs dùng lại.
