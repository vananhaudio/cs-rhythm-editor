/**
 * Khoá "một lượt tại một thời điểm" cho các nút chạy lâu.
 *
 * `disabled` dựa vào state React chỉ có hiệu lực SAU lần vẽ kế tiếp. Hai cú
 * bấm dính nhau nằm gọn trong cùng một nhịp nên cả hai đều đọc thấy state cũ,
 * cả hai cùng lọt vào hàm, và một lần xuất sinh ra HAI job lịch sử. Cái chốt
 * dưới đây đổi giá trị ngay lập tức, đồng bộ, nên cú thứ hai bị chặn.
 *
 * Cố ý nhận đúng hình dạng của `useRef<boolean>` để trang dùng thẳng, không
 * phải bọc thêm lớp nào.
 */
export interface Chot {
  current: boolean;
}

/** `true` = giành được lượt. `false` = đang có lượt chạy, bỏ qua cú bấm này. */
export function giuLuot(chot: Chot): boolean {
  if (chot.current) return false;
  chot.current = true;
  return true;
}

/** Trả lượt. Luôn gọi trong `finally`, kể cả khi việc đang làm ném lỗi. */
export function traLuot(chot: Chot): void {
  chot.current = false;
}
