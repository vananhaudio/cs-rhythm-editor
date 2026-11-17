# SOLO01 Chặng 2 — Bản nhạc chuẩn "Con Đường Xưa em Đi" (v5-2026-11-17)
- **Nguồn duy nhất:** `src/data/solo01/chang2/assets/con-duong-xua-em-di.ts` (41 ô cao độ nguyên bản, Tie `{t}`, Slur `{slur sN}`, lời ca; kèm SHA-256 của bản dạy). Mọi bản đầy đủ/trích đoạn trong buổi 9–16 sinh từ `works.ts` (nâng 8ve + cặp Slur cùng dây + xếp ngón).
- **Đổi nhạc:** tăng `CDX_ASSET_VERSION`, sửa asset, cập nhật SHA, chạy `npm run test:class-social`, rồi dựng lại buổi vào DB bằng migration có sao lưu + md5-guard (mẫu: `db/solo01_chang2_cdx_v5_sync.sql` / `_rollback.sql`).
- **Trích đoạn:** không được bắt đầu ở ô có nốt đích Tie (`cdxTex`/`cdxFingered` báo lỗi) — lùi về ô chứa nốt gốc.
- **Biến thể kỹ thuật** (Buổi 9: Hammer-on, Slide, Pull-off) THAY Slur của ô đó (`noSlur`), không sửa bản chuẩn.
- Chuẩn ký âm chung: `docs/TVA-GUITAR-CHUAN-KY-AM.md`.
