---
name: reference_handoff_backup
description: Nơi lưu bàn giao + backup bộ nhớ trong repo (GitHub) để không mất dữ liệu
metadata: 
  node_type: memory
  type: reference
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Thầy muốn bàn giao **không bị mất** → lưu trong REPO (đẩy GitHub), không lưu thư mục local (~/App không có backup).
- **`docs/HANDOFF.md`** — bản bàn giao tổng quan (cập nhật khi xong mảng việc lớn).
- **`docs/memory-backup/`** — bản sao toàn bộ file memory (`cp ~/.claude/projects/-Users-vananhaudio-Desktop-cs-rhythm-editor/memory/*.md docs/memory-backup/`).

Bộ nhớ tự-động THẬT vẫn ở `~/.claude/projects/.../memory/` (Claude tự đọc; vị trí khoá theo đường dẫn project Desktop/cs-rhythm-editor — KHÔNG di chuyển được sang chỗ khác mà vẫn auto-load). docs/memory-backup chỉ là BẢN SAO an toàn.

**Quy ước:** xong một đợt việc → cập nhật memory như thường, RỒI refresh `docs/HANDOFF.md` + copy lại memory vào `docs/memory-backup/` + commit/push. Thầy thích nhiều chat nhỏ theo chủ đề (chung bộ nhớ project). Liên quan [[reference_handoff_docs]].
