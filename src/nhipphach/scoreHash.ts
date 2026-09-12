/**
 * SHA-256 của chính byte sẽ được tải lên.
 *
 * Dùng Web Crypto sẵn có trong trình duyệt và WKWebView — không thêm thư viện
 * băm nào. Hash tính trên UTF-8 bytes của file, nên cùng một file cho cùng một
 * chuỗi hex ở mọi máy, mọi lần.
 */
export async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Số byte thật sau khi mã hoá UTF-8, không phải độ dài chuỗi JavaScript. */
export const byteLength = (content: string) =>
  new TextEncoder().encode(content).length;
