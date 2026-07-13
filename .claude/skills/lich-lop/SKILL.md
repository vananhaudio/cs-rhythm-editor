---
name: lich-lop
description: Quản trị Lịch lớp + Mã lớp + Nhóm Zalo + cấp khoá theo CHUẨN MÃ. Dùng khi thầy nói "tạo lịch lớp", "mở lớp", "gắn mã lớp", "nhóm Zalo lệch mã", "cấp khoá cho lớp", "đồng bộ nhóm với lịch", hoặc động tới class_schedule / edu_groups / backfill_class.
---

# Skill: Quản trị Lịch–Mã–Nhóm Zalo–Khoá

Cộng đồng (nhóm Zalo) và Lịch lớp nối nhau **bằng MÃ**. Chuẩn đầy đủ: **docs/QUY-TAC-MA.md**. Sai mã = học viên vào nhóm không được cấp khoá.

## BẤT BIẾN VÀNG (luôn phải đúng)
```
edu_groups.code (nhóm Zalo của lớp) === class_schedule.code (mã lớp) === buildClassCode() trong hanhtrinh.ts
class_schedule.main_course → edu_courses.code = mã năng lực
```
- Cột `code` là **AUTHORITATIVE**. TÊN nhóm chỉ để người đọc — **KHÔNG suy mã từ tên**.
- 1 lớp = 1 nhóm = 1 mã. **Không** tạo 2 nhóm cho 1 lớp.

## Bộ mã (nguồn: `src/hanhtrinh.ts`)
- Mã năng lực: `NM · DH1/2/3 · DHNC · TN1/2/3 · NL1/2/3 · SOLO` (= `edu_courses.code`).
- Dạng lớp: DH1,DH2→`KD` · DH3→`BP` · TN*→`GL`. (NM/NL*/DHNC/SOLO chưa cần mã lớp.)
- Mã lớp = `<năng lực>.<dạng lớp><số 2 chữ số>` → `DH2.KD16`; ghép 2 khoá → `DH2.KD1516`. IN HOA, không dấu cách.
- LUÔN sinh mã qua `buildClassCode(nangLuc, so)` — đừng gõ tay.

## Luồng chuẩn mở lớp (`ScheduleManager.tsx`)
1. Chọn khoá chính → mã năng lực → `buildClassCode` tự sinh **mã lớp** (thầy nhập Số khoá).
2. Lưu lớp → tự **khớp/tạo nhóm Zalo `code = mã lớp`** (giữ tên nhóm sẵn có; code authoritative). **Đã siết:** chặn lưu lớp năng lực (có dạng lớp) mà thiếu Số khoá → tránh code NULL.
3. Tick `course_ids` của lớp.
4. HS vào nhóm Zalo → trigger `grant_class_courses_on_join` tự cấp khoá. HS cũ → `select public.backfill_class('<mã>')`.

## Ngoại lệ HỢP LỆ (đừng tưởng lỗi)
- **HT2026/HT2027**: nhóm Hành trình, cấp TOÀN BỘ khoá qua cờ `edu_students.ht_member`, KHÔNG có lớp lịch → health-check hiện "CHỈ CÓ NHÓM" là đúng. (Nhận diện HT = thành viên nhóm HT; SQL set cờ + `grant_all_courses`.)
- Nhóm Facebook cộng đồng: không phải lớp.
- Lớp ngoài hệ năng lực (vd Z2 "Gen Z"): code null cho phép; muốn cấp khoá tự động thì tạo lớp lịch + gán code riêng.

## Kiểm tra & sửa lệch
- **Health-check định kỳ:** chạy `db/ma_health_check.sql` (4 test: khớp · thiếu code · lớp chưa gắn khoá · mã trùng). Mọi LỚP THẬT phải `✅ KHỚP`.
- **Sửa nhóm lệch** (nhóm thật thiếu code / 2 nhóm 1 lớp): xoá nhóm stub rỗng → `update edu_groups set code=<mã lớp lịch>` cho nhóm thật (gộp thành viên nếu cần) → `select backfill_class(<mã>)`. Mẫu: `db/fix_kd17_merge_groups.sql`.
- **Gộp thành viên 2 nhóm:** xoá bản trùng (ai ở cả 2) → `update edu_group_members set group_id=<nhóm giữ> where group_id=<nhóm bỏ>` → xoá nhóm bỏ.

## Chốt
Mọi thao tác lịch/nhóm/khoá đi qua MÃ. `backfill_class(mã)` là hàm cấp bù dùng lại được (SECURITY DEFINER, idempotent). Edge Function `admin-ai` khi thêm HS vào nhóm cũng đã quy về mã lớp thật + gọi backfill.

## Liên quan
docs/QUY-TAC-MA.md · db/ma_health_check.sql · src/hanhtrinh.ts · src/ScheduleManager.tsx · db/class_course_grant_trigger.sql · db/backfill_class_gl11.sql · Bộ nhớ: `project_hanhtrinh2027_boluat`.
