# QUY TẮC QUẢN TRỊ THEO MÃ — TVA Guitar LMS

> Cộng đồng (nhóm Zalo) và Lịch lớp nối với nhau **bằng MÃ**. Sai mã = học viên vào nhóm không được cấp khoá. Tài liệu này là chuẩn để không bao giờ lệch.

## 1. Nguồn sự thật
Định dạng mã do **`src/hanhtrinh.ts`** quy định (DANG_LOP, buildClassCode…). **Không gõ tay mã ở nơi khác** — luôn sinh qua `buildClassCode()`.

## 2. Bộ mã
- **Mã năng lực** (ổn định, = `edu_courses.code`): `NM · DH1/2/3 · DHNC · TN1/2/3 · NL1/2/3 · SOLO`.
- **Dạng lớp**: DH1,DH2 → `KD` · DH3 → `BP` · TN1/2/3 → `GL`. (NM, NL*, DHNC, SOLO chưa cần mã lớp.)
- **Mã lớp** = `<mã năng lực>.<dạng lớp><số 2 chữ số>` → vd `DH2.KD16`. Ghép 2 khoá → `DH2.KD1516`.
- **Quy chuẩn ký tự**: IN HOA, không dấu cách, dùng dấu chấm ngăn năng lực/lớp.

## 3. Bất biến VÀNG (phải luôn đúng)
```
edu_groups.code (nhóm Zalo của lớp)  ===  class_schedule.code (mã lớp)  ===  mã lớp sinh từ hanhtrinh.ts
class_schedule.main_course → edu_courses.code = mã năng lực
```
- Cột **`code` là AUTHORITATIVE**. TÊN nhóm chỉ để người đọc — **KHÔNG suy mã từ tên**.
- Nhóm Zalo ≡ mã lớp: 1 lớp = 1 nhóm = 1 mã. Không tạo 2 nhóm cho 1 lớp.

## 4. Luồng chuẩn khi mở lớp (không tạo lệch)
1. Tạo lớp ở `/admin → Lịch lớp`: chọn khoá chính → hệ tự sinh **mã lớp** (buildClassCode) → tự upsert nhóm Zalo `code = mã lớp`.
2. Tick các khoá của lớp (`course_ids`).
3. Học viên vào nhóm Zalo → trigger `grant_class_courses_on_join` tự cấp khoá. HS cũ → `backfill_class(mã)`.

## 5. Ngoại lệ HỢP LỆ (đừng tưởng là lỗi)
- **HT2026 / HT2027**: nhóm Hành trình, cấp **toàn bộ khoá qua cờ `edu_students.ht_member`**, KHÔNG có lớp trong lịch → health-check hiện "CHỈ CÓ NHÓM" là đúng.
- **Nhóm Facebook cộng đồng**: không phải lớp, không cần code.
- **Lớp ngoài hệ năng lực** (vd Z2 "Gen Z"): gắn code riêng + tạo lớp lịch tương ứng nếu muốn cấp khoá tự động.

## 6. Kiểm tra định kỳ
Chạy **`db/ma_health_check.sql`** bất cứ lúc nào nghi ngờ. Mọi LỚP THẬT phải `✅ KHỚP`; query 2/3/4 phải RỖNG (trừ ngoại lệ mục 5).

## 7. Khi phát hiện lệch — cách sửa
- Nhóm thật thiếu code / 2 nhóm cho 1 lớp → **xoá nhóm stub rỗng**, `update edu_groups set code = <mã lớp lịch>` cho nhóm thật (gộp thành viên nếu cần), rồi `select backfill_class(<mã>)`. Mẫu: `db/fix_kd17_merge_groups.sql`.
- Nhóm code NULL nhưng mã nằm trong tên → gắn code khớp `class_schedule.code`.
