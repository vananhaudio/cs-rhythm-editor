---
name: feedback_autonomy_easy_tasks
description: "Thầy muốn Claude tự chủ quyết/thực thi việc dễ & an toàn, ít hỏi duyệt"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 099638f2-007c-42f4-9b5a-99ca9486c1d3
---

Thầy muốn tôi **được tự do quyết định và thực thi các việc DỄ & AN TOÀN** mà không hỏi duyệt từng lần. Đã cấu hình `.claude/settings.local.json` (gitignored): `defaultMode: acceptEdits` + allow các thao tác an toàn (Edit, git add/commit, git push origin main, git pull/status/diff/log/checkout/branch/stash, npm install/ci/run, npx eas-cli/vite, node, python3, ls/cat/grep/rg/find/head/tail/echo, WebFetch raw.githubusercontent.com…); deny `git push --force`/`-f`/`git push origin main --force`/`sudo`.

**Why:** Phiên dài, hỏi duyệt từng lệnh nhỏ làm chậm; thầy tin tôi xử lý việc an toàn. Trong phiên thầy từng dismiss 1 AskUserQuestion + nhắc lại yêu cầu → tín hiệu đừng hỏi quá nhiều việc nhỏ.

**How to apply:** Cứ làm thẳng các việc đọc/sửa file, git add/commit, build/typecheck, push lên `main`, query đọc — không cần xin phép. CHỈ dừng hỏi ở: quyết định sản phẩm/thiết kế có nhánh thật, thao tác khó đảo (xóa dữ liệu thật, đổi luồng login/thanh toán), hoặc việc có rủi ro Apple/bảo mật. KHÔNG tự `git push --force`/`sudo`. Vẫn báo cáo trung thực việc đã làm. Liên quan: [[feedback_guitarboard_pace]] (riêng GuitarBoard vẫn làm chậm, chờ duyệt), [[feedback_app_submission_care]].
