import { supabase } from "../supabase";
import { SupabaseScoreLibrary } from "./libraryRepository.ts";
import type { ScoreLibrary } from "./libraryRepository.ts";

/**
 * Mở Thư viện bài hát cho phiên hiện tại.
 *
 * Trang KHÔNG gọi Supabase trực tiếp — mọi thứ đi qua `ScoreLibrary`, giống
 * cách preset và lịch sử đang làm. Chưa đăng nhập hoặc không có quyền đọc thì
 * trả `null`: mở kho ra rồi để RLS trả lỗi chỉ tạo một dòng báo lỗi vô nghĩa
 * cho người vốn không được dùng.
 */
export async function openScoreLibrary(cho: {
  read: boolean;
}): Promise<ScoreLibrary | null> {
  if (!cho.read) return null;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.id) return null;
  } catch {
    return null;
  }
  return new SupabaseScoreLibrary(supabase);
}
