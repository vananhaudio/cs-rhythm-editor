---
name: project_cohort_hanhtrinh
description: Mở khoá cho học sinh = vòng đăng ký→thầy Duyệt (KHÔNG dùng cohort/nhãn lớp)
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

**CƠ CHẾ MỞ KHOÁ (chốt 2026-06-29):** học sinh ĐÃ ĐĂNG NHẬP bấm "Đăng ký lớp này" ở trang Lịch (class./?xem=lich) → modal hiện học phí + **ô tick "Tôi là học sinh lớp Hành trình — miễn phí"** (chỉ hiện khi đã đăng nhập); form **tự điền sẵn** họ tên/email/SĐT từ edu_students. Tick → ghi `leads` (is_hanhtrinh=true, student_id, status 'Chờ duyệt', không qua thanh toán). Thầy vào /admin tab **Đăng ký (LeadsManager)** → nút **"✅ Duyệt & mở khoá"** (chọn khoá từ dropdown, đoán theo tên lớp) → enroll + edu_course_access cho học sinh, status 'Đã duyệt'. Mở LẦN LƯỢT, thầy toàn quyền.

SQL đã chạy: `db/course_request_setup.sql` (cột is_hanhtrinh + policy authenticated insert leads). Files: ClassLandingPage (tick+prefill+submitReg), LeadsManager (approveOpen+course dropdown).

**ĐÃ GỠ BỎ HOÀN TOÀN (2026-06-29):** ý tưởng cohort HT2026/HT2027 (bảng edu_cohorts, nút trong StudentProfile, RPC sync_my_cohort_access, 2 SQL cohort_hanhtrinh_setup.sql + mira_cohort_hanhtrinh.sql). KHÔNG dùng nữa — mọi việc mở khoá đi qua vòng đăng ký→Duyệt. Nhóm Zalo (edu_groups) là hệ độc lập, không liên kết. ĐỪNG khôi phục cohort. Liên quan [[project_freemium_percourse]], [[project_class_tuyensinh]].
