// Kiểm tra email + bắt lỗi gõ nhầm tên miền phổ biến (gmai.com → gmail.com, .con → .com…)
// Dùng cho mọi chỗ nhập email khi tạo tài khoản học viên.

const FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Tên miền gõ sai phổ biến → tên miền đúng
const DOMAIN_TYPOS: Record<string, string> = {
  // gmail
  'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmil.com': 'gmail.com',
  'gmali.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmaul.com': 'gmail.com', 'gimail.com': 'gmail.com',
  ' gmail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.comm': 'gmail.com',
  'gmail.vn': 'gmail.com', 'gmaili.com': 'gmail.com', 'gmail.cim': 'gmail.com',
  // yahoo
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yhoo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  // hotmail
  'hotmai.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmil.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'hormail.com': 'hotmail.com',
  // outlook
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outllok.com': 'outlook.com',
  'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com',
  // icloud
  'iclod.com': 'icloud.com', 'iclould.com': 'icloud.com', 'icloud.co': 'icloud.com',
}

// TLD gõ sai chắc chắn (không phải TLD hợp lệ nào) → 'com'. KHÔNG đụng '.co'/'.cm' (là TLD quốc gia hợp lệ).
const TLD_TYPOS: Record<string, string> = { con: 'com', comm: 'com', vom: 'com', xom: 'com', cmo: 'com', ocm: 'com' }

export interface EmailCheck { ok: boolean; error?: string; suggestion?: string }

export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase()
  if (!email) return { ok: false, error: 'Chưa nhập email.' }
  if (/\s/.test(raw.trim())) return { ok: false, error: 'Email không được có dấu cách.' }
  if (!FORMAT.test(email)) return { ok: false, error: 'Email chưa đúng định dạng (ví dụ: ten@gmail.com).' }

  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  let fixedDomain: string | null = null
  if (DOMAIN_TYPOS[domain]) {
    fixedDomain = DOMAIN_TYPOS[domain]
  } else {
    const parts = domain.split('.')
    const tld = parts[parts.length - 1]
    const fix = TLD_TYPOS[tld]
    if (fix !== undefined) { parts[parts.length - 1] = fix; fixedDomain = parts.filter(Boolean).join('.') }
  }

  if (fixedDomain && fixedDomain !== domain) {
    const suggestion = `${local}@${fixedDomain}`
    return { ok: false, error: `Email có vẻ gõ nhầm. Ý bạn là ${suggestion}?`, suggestion }
  }
  return { ok: true }
}
