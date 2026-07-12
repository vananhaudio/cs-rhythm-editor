---
name: project_skills_system
description: "Hệ Skill của thầy — quy trình cho Claude, lưu ở .claude/skills/, danh bạ docs/SKILLS.md"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Thầy phân biệt rõ (2026-07-04): **Tool** = tính năng app cho HỌC VIÊN dùng (ChordStrumPlayer, Tuner, Tap, GuitarBoard…). **Skill** = quy trình cho CLAUDE làm việc lặp lại theo chuẩn của thầy (cách nhúng/triển khai tool vào bài). Trước đây thầy gọi chung là "tool" — nay tách.

**Nơi lưu:** skill = thư mục `cs-rhythm-editor/.claude/skills/<tên>/SKILL.md` (+ script tuỳ chọn), **commit lên GitHub** (versioned + backup, giống docs/memory-backup). Netlify bỏ qua `.claude/` nên không ảnh hưởng deploy.

**Danh bạ = `docs/SKILLS.md`** (bảng điều khiển, kiểu MEMORY.md): liệt kê skill đang có + ứng viên + nguyên tắc. Thầy xem qua: hỏi Claude "liệt kê skill" · Finder mở file · hoặc GitHub `blob/main/docs/SKILLS.md` (đẹp, có trên ĐT).

**Luồng vận hành:** dùng → "dùng skill <tên>"; cải tiến → "cải tiến skill <tên>: …" (Claude sửa SKILL.md + commit tiền tố `skill(<tên>): …` + cập nhật danh bạ). Skill sống trong FILE, KHÔNG trong chát → ĐỪNG khuyên thầy mở 1 chát cố định/skill; dùng phiên ngắn bỏ-sau. Nhiều phiên dài song song cùng repo cs-rhythm-editor = rủi ro đụng commit main + bị nén ngữ cảnh (đã xảy ra thật) → khuyên phiên ngắn theo việc, 1 phiên/repo tại 1 thời điểm (hoặc git worktree).

**ĐÃ DỰNG:** `strum-score` (commit 805a1eb), `khuong-nhac` (commit 2c6567b, 2026-07-04 — chuẩn hoá bố cục/khắc nhạc màn "Đánh theo" NotePractice, xem [[project_khuong_nhac_skill]]). **Ứng viên chờ dựng** (thầy chọn): tia-not, narrated-slideshow, lich-lop, bo-luat-hanh-trinh, deploy. Liên quan [[project_strum_score]], [[project_countin_pattern]], [[feedback_autonomy_easy_tasks]].
