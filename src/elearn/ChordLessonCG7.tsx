// ── BÀI HỌC HOÀN CHỈNH: Đổi hợp âm C ↔ G7 (Đệm Hát · Bài 1) ──────────────────
// Dòng chảy 4 bước, mỗi bước 1 màn: Lý thuyết → Làm quen (mic) → Đổi nhịp → Quiz.
// Tái dùng: ChordPractice (mic xác nhận từng hợp âm), ChordChangeTrainer (đổi nhịp).
import { useState } from 'react'
import { ChordPractice } from './ChordPractice'
import ChordChangeTrainer, { MiniDiagram } from './ChordChangeTrainer'

const INDIGO = '#4338CA'
const ORANGE = '#EA580C'
const STEPS = ['Lý thuyết', 'Làm quen', 'Đổi nhịp', 'Quiz']

interface QA { q: string; opts: string[]; correct: number; explain: string }
const QUIZ: QA[] = [
  { q: 'Hợp âm C nên gảy mấy dây?', opts: ['Cả 6 dây', '5 dây (bỏ dây trầm nhất)', '4 dây'], correct: 1,
    explain: 'C bấm từ dây 5, nên gảy 5 dây — tránh dây 6 (Mi trầm) cho tiếng gọn.' },
  { q: 'Khi bấm C, dây nào nên tránh?', opts: ['Dây 1 (mỏng nhất)', 'Dây 6 (trầm nhất)', 'Dây 3'], correct: 1,
    explain: 'Dây 6 không thuộc hợp âm C — tắt hoặc không gảy nó.' },
  { q: 'Ô nhịp NGHỈ trong bài tập để làm gì?', opts: ['Gảy mạnh gấp đôi', 'Chuyển ngón sang hợp âm sau', 'Dừng hẳn, hết bài'], correct: 1,
    explain: 'Ô nghỉ cho bạn thời gian đặt ngón sang hợp âm kế — đổi mượt, không khựng.' },
]

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: 14, borderRadius: 14, border: primary ? 'none' : `1.5px solid ${INDIGO}`, background: primary ? INDIGO : '#fff', color: primary ? '#fff' : INDIGO, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{children}</button>
  )
}

export default function ChordLessonCG7({ onClose, onComplete }: { onClose?: () => void; onComplete?: () => void }) {
  const [step, setStep] = useState(0)
  const [qIdx, setQIdx] = useState(0)
  const [qSel, setQSel] = useState<number | null>(null)
  const [qScore, setQScore] = useState(0)
  const next = () => setStep(s => Math.min(s + 1, 4))

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F0F2F5', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px', background: '#fff', borderBottom: '1px solid #E8EAF0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: INDIGO, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: ORANGE, letterSpacing: '.06em', fontWeight: 700 }}>ĐỆM HÁT · BÀI 1</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1F2430' }}>Đổi hợp âm C ↔ G7</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? INDIGO : '#D8DCE6' }} />
              <div style={{ fontSize: 9, marginTop: 3, color: i === step ? INDIGO : '#9AA0B0', fontWeight: i === step ? 700 : 500 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 360, margin: '0 auto' }}>

          {step === 0 && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1F2430', marginBottom: 4 }}>Hai hợp âm đầu tiên</div>
              <div style={{ fontSize: 14, color: '#5A6072', lineHeight: 1.6, marginBottom: 14 }}>
                Bạn sẽ làm quen <b style={{ color: INDIGO }}>C</b> (Đô trưởng) và <b style={{ color: '#B45309' }}>G7</b> (Sol bảy) — cặp hợp âm nền của rất nhiều bài đệm hát. Số trên sơ đồ là <b>ngón tay</b> cần bấm.
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {(['C', 'G7'] as const).map(c => (
                  <div key={c} style={{ flex: 1, background: '#fff', border: '1px solid #E1E4EA', borderRadius: 16, padding: '10px 8px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c === 'C' ? INDIGO : '#B45309' }}>{c}</div>
                    <MiniDiagram name={c} />
                  </div>
                ))}
              </div>
              <ul style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.7, paddingLeft: 18, margin: '0 0 16px' }}>
                <li><b>C</b>: chỉ gảy <b>5 dây</b> — tránh dây 6 (Mi trầm) cho tiếng gọn.</li>
                <li><b>G7</b>: rất giống thế tay, đổi từ C chỉ cần dịch vài ngón.</li>
                <li>Mẹo: tập đặt ngón thật chắc trước khi tăng tốc độ.</li>
              </ul>
              <Btn primary onClick={next}>Bắt đầu làm quen →</Btn>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2430', marginBottom: 4 }}>Gảy thử — app nghe & chấm</div>
              <div style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.6, marginBottom: 12 }}>
                Bấm hợp âm, gảy xuống cho vang rồi để app xác nhận. Lần lượt <b>C</b> rồi <b>G7</b>.
              </div>
              <ChordPractice cfg={{ chords: ['C', 'G7'], mode: 'strum' }} onPass={next} />
              <div style={{ marginTop: 14 }}><Btn onClick={next}>Bỏ qua bước này →</Btn></div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2430', marginBottom: 4 }}>Tập ĐỔI theo nhịp</div>
              <div style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.6, marginBottom: 12 }}>
                Gảy 1 ô nhịp, nghỉ 1 ô để kịp chuyển ngón. Đạt <b>8/8 lần đổi sạch</b> để qua bước cuối.
              </div>
              <ChordChangeTrainer bpm={60} target={8} onPass={next} />
              <div style={{ marginTop: 14 }}><Btn onClick={next}>Sang Quiz →</Btn></div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2430', marginBottom: 12 }}>Quiz · câu {qIdx + 1}/{QUIZ.length}</div>
              <div style={{ background: '#fff', border: '1px solid #E1E4EA', borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: '#1F2430', marginBottom: 12 }}>{QUIZ[qIdx].q}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {QUIZ[qIdx].opts.map((o, i) => {
                    const chosen = qSel === i
                    const reveal = qSel !== null
                    const correct = i === QUIZ[qIdx].correct
                    const bg = reveal && correct ? '#DCFCE7' : reveal && chosen ? '#FEE2E2' : '#F7F8FA'
                    const bd = reveal && correct ? '#16A34A' : reveal && chosen ? '#DC2626' : '#E1E4EA'
                    return (
                      <button key={i} disabled={reveal} onClick={() => { setQSel(i); if (i === QUIZ[qIdx].correct) setQScore(s => s + 1) }}
                        style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${bd}`, background: bg, fontSize: 14.5, color: '#1F2430', fontFamily: 'inherit', cursor: reveal ? 'default' : 'pointer' }}>
                        {o}{reveal && correct ? '  ✓' : reveal && chosen ? '  ✕' : ''}
                      </button>
                    )
                  })}
                </div>
                {qSel !== null && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#5A6072', lineHeight: 1.6, background: '#F4F5F8', borderRadius: 10, padding: 10 }}>{QUIZ[qIdx].explain}</div>
                )}
              </div>
              {qSel !== null && (
                <div style={{ marginTop: 14 }}>
                  <Btn primary onClick={() => { if (qIdx < QUIZ.length - 1) { setQIdx(qIdx + 1); setQSel(null) } else next() }}>
                    {qIdx < QUIZ.length - 1 ? 'Câu tiếp →' : 'Xem kết quả →'}
                  </Btn>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={{ textAlign: 'center', paddingTop: 24 }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1F2430', marginTop: 8 }}>Hoàn thành bài 1!</div>
              <div style={{ fontSize: 14, color: '#5A6072', marginTop: 6, lineHeight: 1.6 }}>
                Bạn đã làm quen C & G7 và tập đổi hợp âm theo nhịp.<br />Quiz đúng <b style={{ color: '#16A34A' }}>{qScore}/{QUIZ.length}</b> câu.
              </div>
              <div style={{ display: 'inline-block', marginTop: 14, background: '#FFF3EC', color: '#9A4316', fontWeight: 800, borderRadius: 20, padding: '6px 16px', fontSize: 14 }}>+15 XP</div>
              <div style={{ marginTop: 20 }}><Btn primary onClick={() => { onComplete?.(); onClose?.() }}>Về danh sách bài →</Btn></div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
