// ── Registry BÀI HỌC NATIVE ───────────────────────────────────────────────────
// Bài có lesson_type='native' + content_url = key dưới đây → portal render component.
// Thêm bài native mới: viết component nhận { onClose, onComplete } rồi khai báo 1 dòng.
import type { ComponentType } from 'react'
import ChordLesson from './ChordLesson'
import { AM_E, C_G7, BASIC_1, QUAT_CHUM2 } from './chordLessons'
import NarratedSlides from './NarratedSlides'
import { WELCOME_TD2_SLIDES } from './welcomeTd2Slides'
import { CHUM2_SLIDES } from './chum2Slides'
import ChordStrumPlayer from './ChordStrumPlayer'
import { HBD_CHUM2, HBD_TD1, STRUM_JINGLE, STRUM_JINGLE_DEN, STRUM_ODE, STRUM_SCARBOROUGH } from './strumSongs'

export interface NativeLessonProps { onClose?: () => void; onComplete?: () => void; studentId?: string; lessonId?: string }

// Slide "Chào mừng Trình độ 2" — 8 slide DỰNG NATIVE (từ PPTX) + audio sẵn, ép nghe hết.
const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'
const WELCOME_TD2 = {
  title: 'Chào mừng đến Trình độ 2',
  crumb: 'KHỞI ĐẦU ĐAM MÊ · TRÌNH ĐỘ 2',
  audioUrl: STORE + 'Gioi%20thieu%20dem%20hat%202.wav',
  slides: WELCOME_TD2_SLIDES,
}
const CHUM2 = {
  title: 'Chùm 2 Nốt Móc Đơn',
  crumb: 'KHỞI ĐẦU ĐAM MÊ · TRÌNH ĐỘ 2',
  audioUrl: STORE + 'Chum%202%20not%20moc%20don.wav',
  slides: CHUM2_SLIDES,
  dim: true,   // bài này dùng mode TỐI DỊU (đỡ mỏi mắt khi xem lâu)
}

export const NATIVE_LESSONS: Record<string, { label: string; Component: ComponentType<NativeLessonProps> }> = {
  'welcome-td2': { label: 'Chào mừng Trình độ 2 — slide + audio (ép nghe hết)', Component: (p) => <NarratedSlides cfg={WELCOME_TD2} {...p} /> },
  'chum-2-moc-don': { label: 'Chùm 2 Nốt Móc Đơn — slide + audio (ép nghe hết)', Component: (p) => <NarratedSlides cfg={CHUM2} {...p} /> },
  'chord-cg7': { label: 'Quạt hợp âm C ↔ G7 (3 bài tập)', Component: (p) => <ChordLesson cfg={C_G7} {...p} /> },
  'chord-am-e': { label: 'Hợp âm Am & E + 3 bài tập đổi (mic)', Component: (p) => <ChordLesson cfg={AM_E} {...p} /> },
  'chord-basic-1': { label: 'Chuyển hợp âm cơ bản 1 — C·G7·Am·E·Dm (6 BT, có nghỉ)', Component: (p) => <ChordLesson cfg={BASIC_1} {...p} /> },
  'chord-strum-chum2': { label: 'Tập quạt chùm 2 (xuống–lên) — C·G7·Am·E·Dm (5 BT)', Component: (p) => <ChordLesson cfg={QUAT_CHUM2} {...p} /> },
  'song-hbd-chum2': { label: 'Gảy theo: Happy Birthday — quạt chùm 2 (xanh hóa)', Component: (p) => <ChordStrumPlayer song={HBD_CHUM2} {...p} /> },
  'song-hbd-td1': { label: 'Gảy theo: Happy Birthday — quạt nốt đen (TĐ1, xanh hóa)', Component: (p) => <ChordStrumPlayer song={HBD_TD1} {...p} /> },
  'song-jingle-den': { label: 'Gảy theo: Jingle Bells — quạt nốt đen (nền trống-bass + ghi âm)', Component: (p) => <ChordStrumPlayer song={STRUM_JINGLE_DEN} {...p} /> },
  'song-jingle-chum2': { label: 'Gảy theo: Jingle Bells — quạt chùm 2 (nền trống-bass + ghi âm)', Component: (p) => <ChordStrumPlayer song={STRUM_JINGLE} {...p} /> },
  'song-ode-ballad': { label: 'Gảy theo: Ode to Joy — quạt chùm 2 (Ballad, nền synth)', Component: (p) => <ChordStrumPlayer song={STRUM_ODE} {...p} /> },
  'song-scarborough': { label: 'Gảy theo: Scarborough Fair — Valse (nền synth)', Component: (p) => <ChordStrumPlayer song={STRUM_SCARBOROUGH} {...p} /> },
}
