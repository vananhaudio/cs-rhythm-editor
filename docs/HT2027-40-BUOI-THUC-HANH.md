# Hành trình 2027 — 40 Buổi Thực hành: Audit & Đề xuất triển khai

> Trạng thái: **BÁO CÁO CHỜ THẦY DUYỆT** (chưa chạy migration, chưa seed dữ liệu, chưa deploy).
> Ngày: 29/08/2026. Landing page dự kiến: `class.vananhaudio.com/hanhtrinh2027`.

---

## 1. Nguồn dữ liệu chuẩn của hệ thống lịch (kết quả audit)

Hệ thống Class **đã có sẵn cơ chế chuỗi sự kiện** — KHÔNG cần tạo hệ lịch song song:

| Thành phần | Mô tả |
|---|---|
| Bảng `class_schedule` | Mỗi lớp 1 dòng: mã lớp, tên, `start_date`, `weekday`, `start_time`, `duration_minutes`, `total_sessions`, `end_date`, `status` (draft…completed), `course_ids`, `group_id`, `zoom_url`. |
| Bảng `class_sessions` | Từng buổi học: `class_id`, `session_number`, `title`, `start_at` (timestamptz), `end_at`, `status` (`scheduled/completed/cancelled/rescheduled/makeup/holiday`), `note`. |
| `src/journey/sessions.ts` | Engine sinh buổi: `generateSessions(startDate, weekday, startTime, durationMin, total)` — 1 buổi/tuần, cách 7 ngày, theo **giờ địa phương (Asia/Ho_Chi_Minh)**, lưu `timestamptz`. |
| Admin | `/admin` → tab "🗓 Lịch lớp" (`ScheduleManager`) tạo/sửa lớp + tự sinh buổi; `CalendarWeek` hiển thị Tuần/Tháng/Năm + đánh dấu trạng thái từng buổi (đã dạy/huỷ/dời/bù/nghỉ lễ). |
| Trang tuyển sinh | `ClassLandingPage` đọc trực tiếp `class_schedule` (`is_active = true`). Edge function `class-schedule` (đọc Google Sheet) là **legacy, không còn được dùng** trong src. |

**Dữ liệu thật đang chạy:** 8 lớp (KD17, KD18, KD1516, KD0826, GL10–GL13…), 64 buổi, tất cả `scheduled`. Lớp cuối kết thúc **05/11/2026** (TN3.GL13 — cũng là thứ Năm 20h30). → Khung 20h30 thứ Năm **trống hoàn toàn từ tháng 11/2026**, thuận lợi cho chương trình 2027.

## 2. Cơ chế quyền hiện tại (liên quan đối tượng tham gia)

- **Mã năng lực chuẩn** (`src/hanhtrinh.ts` + `docs/HANHTRINH-2027-BO-LUAT.md`): `NM, DH1, DH2, DH3, TN1, TN2, TN3, NL1, NL2, NL3, DHNC, SOLO`. Có `PREREQ` (mở khoá), `DANG_LOP`, `TEN_NANG_LUC`.
- **Học viên Hành trình**: cờ `edu_students.ht_member` (đang có **40/655** học viên). Combo HT2027 = 9.990.000đ (10 khoá + 40 buổi thực hành Zoom) — đã thể hiện ở `ClassLandingPage`/`ClassJourney2027`.
- **Quyền khoá**: `edu_course_access` (thầy cấp theo khoá, học viên chỉ đọc) + `edu_enrollments`. Hiện: DH2 có 109 ghi danh, TN2 có 1 (TN2 đang `coming_soon`).
- **Spec Journey OS** (R4): "HV đủ nền (DH2/TN2) → nhóm tư vấn HT2027". → Đối tượng tham gia khớp đúng: **ht_member + DH2 + TN2** (mã chuẩn, không kiểm tra theo tên khoá).

## 3. Quy tắc Hành trình 2027 đã có trong dự án

- `docs/HANHTRINH-2027-BO-LUAT.md` — bộ luật mã hoá (đã đọc, áp dụng).
- Combo 9.990.000đ + "40 buổi học Thực hành trong 1 năm" (`ClassJourney2027`, `mira_hanhtrinh_price.sql`).
- `MobileStudentPortal` tab Thầy: ô "📅 Buổi thực hành cùng Thầy" đang là **empty state** — "Lịch buổi thực hành sẽ hiện ở đây khi Thầy mở" → đây là chỗ dành sẵn để nối cùng nguồn lịch mới.
- MiraPlanner R4 nhắc tư vấn HT2027 cho HV đủ nền DH2/TN2.

## 4. Đề xuất lịch dự kiến (CHỜ DUYỆT)

### 4.1. Ngày bắt đầu: **Thứ Năm 10/09/2026 — 20:30 (giờ Việt Nam, Asia/Ho_Chi_Minh)**
(Thầy duyệt đổi từ 07/01/2027 → **10/09/2026** lúc 13:54 ngày 29/08/2026.)

### 4.2. Toàn bộ 48 tuần (40 buổi + 8 tuần nghỉ) — lịch ĐÃ TRIỂN KHAI

**CHẶNG 1 — Làm chủ bộ hợp âm, vòng hòa âm và màu sắc hòa âm**
| Buổi | Ngày (thứ Năm) | Ghi chú |
|---|---|---|
| 01–08 | 10/09 · 17/09 · 24/09 · 01/10 · 08/10 · 15/10 · 22/10 · 29/10/2026 | |
| Nghỉ | 05/11 · 12/11/2026 | Nghỉ giữa chặng — tự luyện & hoàn thiện sản phẩm |

**CHẶNG 2 — Làm chủ khuôn hình và phát triển giai điệu**
| Buổi | Ngày |
|---|---|
| 09–16 | 19/11 · 26/11 · 03/12 · 10/12 · 17/12 · 24/12 · 31/12/2026 · 07/01/2027 |
| Nghỉ | 14/01 · 21/01/2027 |

**CHẶNG 3 — Làm chủ điệu đệm, tiết tấu và phát triển bài hát**
| Buổi | Ngày | Ghi chú |
|---|---|---|
| 17 | 28/01/2027 | |
| ~~18–19~~ | ~~04/02 · 11/02~~ | **BỎ QUA — Tết Nguyên Đán** (Mùng 1 = 06/02/2027, dự kiến) |
| 18–24 | 18/02 · 25/02 · 04/03 · 11/03 · 18/03 · 25/03 · 01/04/2027 | lịch dời sang sau Tết |
| Nghỉ | 08/04 · 15/04/2027 | |

**CHẶNG 4 — Solo Guitar: kết hợp giai điệu, bass và hòa âm**
| Buổi | Ngày |
|---|---|
| 25–32 | 22/04 · 29/04 · 06/05 · 13/05 · 20/05 · 27/05 · 03/06 · 10/06/2027 |
| Nghỉ | 17/06 · 24/06/2027 |

**CHẶNG 5 — Solo Guitar: xây dựng và hoàn thiện tác phẩm**
| Buổi | Ngày |
|---|---|
| 33–40 | 01/07 · 08/07 · 15/07 · 22/07 · 29/07 · 05/08 · 12/08 · **19/08/2027** |

**Ngày kết thúc: Thứ Năm 19/08/2027.** (Không có nghỉ sau chặng 5.)

### 4.3. Ngày lễ/ngày khóa trong lịch chung (`class_off_days`)
- **2026 (đã qua, không ảnh hưởng lịch từ 10/09):** Tết Nguyên Đán 2026 (Mùng 1 = 17/02/2026), Giỗ Tổ 26/04, 30/04, 01/05, 02/09/2026.
- **2027:**
  - 01/01/2027 — Tết Dương lịch (thứ Sáu, không trùng thứ Năm).
  - **01/02 – 14/02/2027 — Tết Nguyên Đán** (Mùng 1 = 06/02/2027, thứ Bảy; chặn cả 2 thứ Năm 04/02 & 11/02. *Dự kiến — chờ công bố chính thức, admin chỉnh được.*)
  - 16/04/2027 — Giỗ Tổ Hùng Vương (10/3 AL = thứ Sáu, không trùng).
  - 30/04 & 01/05/2027 — Giải phóng + Quốc tế Lao động (T6/T7, không trùng).
  - 02/09/2027 — Quốc khánh (thứ Năm, NHƯNG ngoài phạm vi lịch — kết thúc 19/08/2027).

## 5. Giải pháp kỹ thuật (dùng đúng hệ lịch hiện tại)

### 5.1. Migration `db/ht2027_practice_setup.sql` (idempotent, additive — KHÔNG phá lịch cũ)
1. `class_schedule` + cột `program_code text` (mã chương trình, vd `HT2027`), `breaks_after int[]` (nghỉ sau các buổi, vd `{8,16,24,32}`), `timezone text default 'Asia/Ho_Chi_Minh'`.
2. `class_sessions` + cột `event_type text default 'lesson'` (check `lesson|break`); mở rộng check status thêm `'confirmed'` (Xác nhận).
3. Bảng mới **`class_off_days`** (lịch nghỉ chung của Class): `off_date` (unique), `reason`, `source` (official/tet/admin), `is_active`. RLS: anon đọc; ghi chỉ teacher.
4. RLS `class_sessions`: thêm policy **anon đọc có giới hạn** — chỉ đọc buổi của các lớp có `program_code` (trang công khai cần đọc lịch chương trình; buổi lớp thường vẫn kín).

### 5.2. Engine sinh lịch dùng chung
Mở rộng `generateSessions()` với tham số tuỳ chọn `breaksAfter` + `skipDates` (mặc định giữ nguyên hành vi cũ → 8 lớp hiện tại không đổi). Thuật toán: duyệt các thứ Năm từ ngày khai giảng; bỏ qua ngày trong `class_off_days`; sau các buổi 8/16/24/32 chèn 2 tuần nghỉ (`event_type='break'`, `status='holiday'` — hệ thống đã loại trạng thái này khỏi tiến độ, nên "buổi X/40" vẫn đúng); không có nghỉ sau buổi 40.

### 5.3. Seed idempotent `scripts/seed-ht2027.ts` (`npx tsx`)
- Upsert lớp: `code = HT2027.TH01`, `program_code = HT2027`, tên "Hành trình 2027 — 40 buổi thực hành", thứ Năm 20:30, 90 phút, 40 buổi, `breaks_after={8,16,24,32}`, `status='scheduled'`, `is_active=false` (ẩn khỏi trang tuyển sinh cũ — **không làm ảnh hưởng Class cũ**; admin vẫn quản lý được).
- Upsert `class_off_days` (danh sách mục 4.3).
- Đồng bộ 48 dòng `class_sessions` (40 buổi có title từ giáo trình + 8 tuần nghỉ). **Chạy lại không tạo trùng**: giữ buổi `completed`, xoá buổi chưa hoàn thành rồi sinh lại (đúng cơ chế `ScheduleManager` hiện có).
- Lịch sửa sau này: admin sửa ngày khai giảng trong `/admin` → buổi tự sinh lại theo luật; hoặc đổi trạng thái từng buổi trong CalendarWeek → landing page đọc lại cùng nguồn.

### 5.4. Landing page `class.vananhaudio.com/hanhtrinh2027`
- Route mới trong `AppRouter` (không đụng route cũ).
- `src/Hanhtrinh2027Page.tsx`: mobile-first, **accent tím Class (`#4338CA`)** — KHÔNG dùng forest green; 5 chặng dùng 5 sắc tím.
- Lịch đọc từ **`class_sessions` + `class_off_days`** (dùng chung, không hardcode 40 ngày, không file ngày riêng).
- CTA theo trạng thái thật: chưa đăng nhập → hướng dẫn đăng nhập; đã là học viên HT (`ht_member`) → xác nhận thuộc chương trình, không hiện nút đăng ký; có quyền DH2/TN2 (`edu_course_access`) → "đủ điều kiện — nhắn Thầy để ghi danh"; chưa đủ → nhắc đối tượng + liên hệ Thầy. **Không tuyên bố ai đã ghi danh khi chưa có dữ liệu.**
- Các trạng thái hiển thị: Dự kiến (`scheduled`) · Đã xác nhận (`confirmed`) · Đổi lịch (`rescheduled`) · Đã hoàn thành (`completed`) · Đã huỷ (`cancelled`) · Nghỉ lễ (`holiday`).

### 5.5. Không phá Class cũ
- Không sửa/xoá sự kiện hiện có; chỉ thêm cột/bảng (additive).
- Lớp HT2027 `is_active=false` → trang tuyển sinh cũ không đổi gì.
- `generateSessions` giữ nguyên hành vi mặc định.

## 6. Việc cần Thầy duyệt
1. Ngày bắt đầu **07/01/2027** và toàn bộ 40 ngày/8 tuần nghỉ (mục 4.2).
2. Bộ ngày nghỉ dự kiến 2027 (mục 4.3) — đặc biệt khoảng Tết 01–14/02 (sẽ chỉnh lại khi có công bố chính thức).
3. Migration + seed (mục 5.1–5.3).
4. Deploy landing page sau khi duyệt.

---

## 7. Trạng thái triển khai (29/08/2026 — code XONG, chờ duyệt để chạy)

**Đã làm (chưa commit, chưa chạy migration, chưa seed, chưa deploy):**

| Hạng mục | File | Trạng thái |
|---|---|---|
| Migration idempotent | `db/ht2027_practice_setup.sql` | ✅ viết xong, chưa chạy |
| Engine sinh lịch (breaks + skip, giữ hành vi cũ) | `src/journey/sessions.ts` | ✅ typecheck + lint pass |
| Giáo trình 40 buổi (nguồn nội dung duy nhất) | `src/data/ht2027Program.ts` | ✅ |
| Seed idempotent (chạy sau khi duyệt) | `scripts/seed-ht2027.ts` | ✅ typecheck pass (`npx tsx`) |
| Landing page `/hanhtrinh2027` | `src/Hanhtrinh2027Page.tsx` | ✅ build + E2E pass |
| Route | `src/AppRouter.tsx` | ✅ |
| Admin: hỗ trợ nghỉ chặng/skip/confirmed | `src/ScheduleManager.tsx`, `src/journey/CalendarWeek.tsx` | ✅ |

**Đã kiểm chứng:** `tsc -b` pass · eslint file mới 0 lỗi · `vite build` pass · E2E mobile 390px & desktop 1280px (không tràn) · timeline đếm đúng **40 buổi + 8 nghỉ + 3 bỏ qua** (buổi 1: 07/01 · buổi 40: 23/12/2027) · bản production khi chưa có dữ liệu hiện empty-state + CTA khách đúng.

**Còn chờ Thầy:** duyệt lịch (mục 4) → chạy migration → chạy seed → deploy Netlify.

⚠️ **Lưu ý vận hành:** 8 buổi đầu (17/09 → 29/10/2026) trùng khung thứ Năm 20h30 với lớp **TN3.GL13** (17/09 → 05/11/2026) đang chạy — Thầy xử lý lịch lớp đó riêng nếu cần.
