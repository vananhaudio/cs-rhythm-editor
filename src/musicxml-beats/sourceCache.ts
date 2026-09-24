/**
 * Bộ nhớ đệm theo ĐÚNG chuỗi nguồn (Giai đoạn 4D.P).
 *
 * Đo được trên bài thật 237 KB: một phím sửa TAB làm trang đọc lại cùng một bản
 * nháp tới mười lần, và đọc lại bản GỐC — thứ không bao giờ đổi — ở mỗi phím.
 *
 * Khoá là chính chuỗi MusicXML, không phải một số hiệu phiên bản do ai đó tăng.
 * Chuỗi là bất biến, nên mỗi bản nháp là một khoá riêng: khác một byte là khác
 * khoá, không có chuyện "quên xoá cache" khi nháp đổi, hoàn tác hay làm lại.
 *
 * Chỉ dùng cho dữ liệu DẪN XUẤT mà nơi nhận không sửa: nơi gọi phải trả bản sao
 * hoặc đóng băng kết quả. Giữ vài bản gần nhất — đủ cho "bản gốc + nháp trước +
 * nháp mới" và một bước hoàn tác, không giữ cả lịch sử trong bộ nhớ.
 */
export function nhoTheoNguon<T>(soToiDa = 4) {
  const bang = new Map<string, T>();
  return {
    lay(xml: string, tinh: () => T): T {
      if (bang.has(xml)) {
        const v = bang.get(xml) as T;
        // Dùng lại thì đẩy lên cuối — bản ít dùng nhất bị bỏ trước.
        bang.delete(xml);
        bang.set(xml, v);
        return v;
      }
      const v = tinh();
      bang.set(xml, v);
      while (bang.size > soToiDa) bang.delete(bang.keys().next().value as string);
      return v;
    },
    get kichThuoc() {
      return bang.size;
    },
  };
}

/**
 * Đóng băng sâu đối tượng/mảng và giá trị trong Map/Set. Object.freeze KHÔNG
 * khoá set/delete/clear của Map/Set; không đưa các collection này ra ngoài cache
 * nếu chưa tạo bản sao riêng cho caller.
 */
export function dongBangSau<T>(v: T): T {
  if (v === null || typeof v !== "object" || Object.isFrozen(v)) return v;
  Object.freeze(v);
  if (v instanceof Map) {
    for (const [k, x] of v) {
      dongBangSau(k);
      dongBangSau(x);
    }
  } else if (v instanceof Set) {
    for (const x of v) dongBangSau(x);
  } else {
    for (const x of Object.values(v as object)) dongBangSau(x);
  }
  return v;
}
