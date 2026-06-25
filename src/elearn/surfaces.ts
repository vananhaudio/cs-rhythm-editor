// ── BỘ TOKEN NỀN 3 TẦNG — theo nguyên tắc "nhìn càng lâu, nền càng dịu" ─────────
// Đọc & chọn → SÁNG · Xem / tập nhanh → TỐI ĐẬM · Tập lâu / lặp lại → TỐI DỊU.
// Mỗi màn import đúng 1 tầng. Đổi tông sau này chỉ sửa ở file này.

export interface Surface {
  bg: string        // nền ngoài cùng
  panel: string     // thẻ / khung nội dung
  ink: string       // chữ chính
  sub: string       // chữ phụ
  border: string    // viền nhạt
}

// 1) ĐỌC & CHỌN — trang chủ, danh sách, hồ sơ, ghi chú, admin
export const READING: Surface = {
  bg: '#F0F2F5', panel: '#FFFFFF', ink: '#1F2430', sub: '#5A6072', border: '#E1E4EA',
}

// 2) XEM & TẬP NHANH — slide, video, tuner, đổi hợp âm vài vòng (vào nhanh ra nhanh)
// Tối ĐẬM, tương phản cao → ký hiệu nhạc nổi bật. Chỉ nhìn ngắn nên không mỏi.
export const STAGE: Surface = {
  bg: '#0B0B12', panel: '#11121A', ink: '#FFFFFF', sub: '#9AA0B0', border: '#2A2C3A',
}

// 3) TẬP LÂU / LẶP LẠI — luyện điệu, chạy gam, phiên kỷ luật dài, Flow Player nhiều phút
// Tối DỊU: nền xám than (không đen kịt), chữ bớt trắng gắt → nhìn 20-30' đỡ mỏi/nhoè mắt.
export const PRACTICE: Surface = {
  bg: '#15161F', panel: '#1E2030', ink: '#E8EAF2', sub: '#A9AECB', border: '#2E3142',
}
