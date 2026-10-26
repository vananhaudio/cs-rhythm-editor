# TeamLab nhúng trong Class Mobile (iOS)

Bản iOS đóng gói **chung** một bản build của TeamLab ở `dist/teamlab/` và Class Mobile mở nó trong iframe **cùng origin**
(`/teamlab/index.html?classapp=1#/project/<id>`) — một phiên đăng nhập (localStorage), không Safari.

- `teamlab.ref` = commit của repo `teamlab-bolt-production` (nhánh `feat/class-embed-mode`) được đóng gói. Đổi TeamLab → đổi file này → build app mới.
- `npm run build:native` tự chạy `scripts/build-teamlab-embed.mjs`: dùng `TEAMLAB_DIR` (bản checkout sẵn, phải đúng commit) hoặc tự clone vào `.cache/teamlab-embed`.
- Web (class.vananhaudio.com) **không** đóng gói TeamLab: vẫn proxy `/teamlab` như cũ.
- Giao thức iframe ↔ Class: xem `src/lib/classEmbed.ts` (TeamLab) và `src/class-mobile/studioBridge.ts` (Class).
