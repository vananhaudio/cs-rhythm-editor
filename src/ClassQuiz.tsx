// ClassQuiz — bài test định hướng "Bạn đang ở đâu trên hành trình học guitar?"
// Tương tác từng câu → đếm A/B/C/D → gợi ý lớp. Phông serif + tông đồng bộ trang /class.
import { useState } from 'react'

const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', terra: '#A8542A', line: '#E4DED4', indigo: '#4338CA',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const QUESTIONS: { q: string; opts: string[] }[] = [
  { q: 'Khi nghĩ đến học guitar, bạn mong muốn điều gì nhất?', opts: [
    'Tôi muốn học guitar từ đầu, chưa biết bắt đầu thế nào.',
    'Tôi muốn vừa đàn vừa hát những bài mình thích.',
    'Tôi muốn chơi được giai điệu bài hát bằng đàn.',
    'Tôi đã biết chơi sơ qua, nhưng muốn hiểu sâu hơn và tự tìm nốt tốt hơn.'] },
  { q: 'Khi nhìn cây đàn guitar, bạn thấy điều nào đúng với mình?', opts: [
    'Tôi chưa biết các nốt nằm ở đâu trên đàn.',
    'Tôi biết vài hợp âm nhưng không hiểu rõ các nốt.',
    'Tôi có thể bấm theo tab, nhưng không biết mình đang chơi nốt gì.',
    'Tôi biết một số vị trí nốt nhưng chưa liên kết được toàn cần đàn.'] },
  { q: 'Khi nhìn một bản nhạc có nốt, bạn cảm thấy thế nào?', opts: [
    'Tôi gần như chưa đọc được.',
    'Tôi đọc rất chậm, phải dò từng nốt.',
    'Tôi đọc được một chút nhưng chỉ ở giọng dễ như C hoặc Am.',
    'Tôi muốn nhìn bản nhạc và chơi được ở nhiều giọng khác nhau.'] },
  { q: 'Khi nghe một giai điệu quen thuộc, bạn có tự tìm được trên đàn không?', opts: [
    'Chưa, tôi thường không biết bắt đầu từ nốt nào.',
    'Tôi mò được vài nốt nhưng rất chậm.',
    'Tôi tìm được một đoạn ngắn nếu bài đơn giản.',
    'Tôi muốn học cách nghe, định vị và chơi lại giai điệu nhanh hơn.'] },
  { q: 'Bạn có hay phụ thuộc vào tab hoặc video hướng dẫn không?', opts: [
    'Tôi chưa biết tab là gì.',
    'Tôi thường phải nhìn tab/video mới chơi được.',
    'Tôi chơi được theo tab nhưng sang bài mới lại phải học lại từ đầu.',
    'Tôi muốn thoát khỏi việc chỉ bấm theo tab có sẵn.'] },
  { q: 'Vấn đề nào làm bạn thấy "kẹt" nhất hiện tại?', opts: [
    'Tôi mới hoàn toàn, chưa có nền tảng.',
    'Tôi muốn học guitar nhưng không tự tin về giọng hát.',
    'Tôi biết vài thứ rời rạc nhưng chưa chơi được giai điệu rõ ràng.',
    'Tôi muốn cảm âm, tìm nốt, chơi trên nền nhạc thật nhưng chưa biết cách.'] },
  { q: 'Nếu được chọn cách học phù hợp nhất, bạn muốn bắt đầu bằng gì?', opts: [
    'Học từ những nốt đầu tiên, thật căn bản.',
    'Học hợp âm để vừa đàn vừa hát.',
    'Học đọc nốt và chơi giai điệu bằng đàn.',
    'Học cảm âm, khuôn hình và chơi theo bài hát thật.'] },
]

const RESULTS: Record<string, { tag: string; title: string; body: string }> = {
  A: { tag: 'Nếu bạn chọn nhiều A', title: 'Tỉa Nốt 1 – Guitar căn bản',
    body: 'Đây là lớp dành cho người mới bắt đầu từ gốc. Bạn sẽ học nốt nhạc, vị trí trên cần đàn, cách bấm từng nốt và chơi những giai điệu đơn giản đầu tiên. Lớp này rất phù hợp nếu bạn muốn hiểu cây đàn từ nền tảng, không chỉ học theo kiểu nhìn và bấm.' },
  B: { tag: 'Nếu bạn chọn nhiều B', title: 'Đệm Hát 1 – Khởi Đầu Đam Mê',
    body: 'Bạn có mong muốn rất rõ: muốn vừa đàn vừa hát. Ở lớp này, bạn sẽ học hợp âm, chuyển hợp âm, nhịp phách và cách đàn hát cho khớp tông. Nếu sau này muốn hiểu cây đàn sâu hơn, bạn có thể bổ sung thêm Tỉa Nốt 1.' },
  C: { tag: 'Nếu bạn chọn nhiều C', title: 'Tỉa Nốt 1 hoặc Tỉa Nốt 2',
    body: 'Nếu bạn mới học hoặc đọc nốt còn chậm, hãy bắt đầu với Tỉa Nốt 1. Nếu bạn đã chơi được giai điệu cơ bản ở các giọng dễ như C hoặc Am, bạn có thể tìm hiểu Tỉa Nốt 2 để học thị tấu, chơi nhiều giọng hơn và mở rộng vị trí trên toàn cần đàn.' },
  D: { tag: 'Nếu bạn chọn nhiều D', title: 'Tỉa Nốt 3 – Cảm âm và khuôn hình thực chiến',
    body: 'Bạn không chỉ muốn chơi theo bản nhạc có sẵn. Bạn muốn nghe, cảm nhận, tìm nốt và chơi trên nền bài hát thật. Đây là hướng học giúp bạn tiến gần hơn tới cảm âm, hòa âm và solo guitar sau này.' },
}
const LETTERS = ['A', 'B', 'C', 'D']

export default function ClassQuiz({ onClose, onRegister, onChat }: { onClose: () => void; onRegister: () => void; onChat: () => void }) {
  const [step, setStep] = useState(0)          // 0..6 câu hỏi, 7 = kết quả
  const [answers, setAnswers] = useState<number[]>([])

  const pick = (optIdx: number) => {
    const next = [...answers]; next[step] = optIdx; setAnswers(next)
    setStep(s => s + 1)
  }
  const back = () => setStep(s => Math.max(0, s - 1))
  const restart = () => { setAnswers([]); setStep(0) }

  const result = (() => {
    const count = [0, 0, 0, 0]
    answers.forEach(a => { if (a >= 0 && a < 4) count[a]++ })
    let best = 0
    for (let i = 1; i < 4; i++) if (count[i] > count[best]) best = i
    return RESULTS[LETTERS[best]]
  })()

  const isResult = step >= QUESTIONS.length

  return (
    <div className="tva-qz">
      <style>{CSS}</style>

      <div className="qz-top">
        <button className="qz-back" onClick={onClose}>← Quay lại</button>
        <div className="qz-progress">{isResult ? 'Kết quả' : `Câu ${step + 1} / ${QUESTIONS.length}`}</div>
      </div>

      {!isResult && (
        <div className="qz-bar"><div className="qz-bar-fill" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} /></div>
      )}

      <div className="qz-scroll">
        <div className="qz-wrap">
          {!isResult ? (
            <>
              {step === 0 && (
                <div className="qz-intro">
                  <div className="qz-eyebrow">Tỉa Nốt Guitar School</div>
                  <h1 className="qz-h1">Bạn đang ở đâu trên<br /><i>hành trình học guitar?</i></h1>
                  <p className="qz-sub">Bài test này không chấm đúng sai. Mục đích là giúp bạn nhìn ra mình đang phù hợp với lớp nào — <b>Tỉa Nốt 1, Tỉa Nốt 2, Tỉa Nốt 3</b> hay <b>Đệm Hát</b>. Hãy chọn đáp án giống bạn nhất.</p>
                  <hr className="qz-hr" />
                </div>
              )}
              <div className="qz-qnum">{String(step + 1).padStart(2, '0')}</div>
              <h2 className="qz-q">{QUESTIONS[step].q}</h2>
              <div className="qz-opts">
                {QUESTIONS[step].opts.map((o, i) => (
                  <button className="qz-opt" key={i} onClick={() => pick(i)}>
                    <span className="qz-letter">{LETTERS[i]}</span>
                    <span>{o}</span>
                  </button>
                ))}
              </div>
              {step > 0 && <button className="qz-prev" onClick={back}>← Câu trước</button>}
            </>
          ) : (
            <div className="qz-result">
              <div className="qz-eyebrow">Kết quả gợi ý</div>
              <h1 className="qz-h1">Lớp học phù hợp với bạn</h1>
              <div className="qz-rcard">
                <div className="qz-rtag">{result.tag}</div>
                <div className="qz-rtitle">{result.title}</div>
                <p className="qz-rbody">{result.body}</p>
              </div>
              <div className="qz-actions">
                <button className="qz-act-primary" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
                <button className="qz-act-ghost" onClick={onChat}>Hỏi trợ lý cho chắc</button>
                <button className="qz-act-text" onClick={restart}>↺ Làm lại bài test</button>
              </div>
              <p className="qz-note">Kết quả chỉ mang tính gợi ý. Nếu bạn vẫn chưa chắc mình thuộc nhóm nào, hãy nhắn trợ lý để được xếp đúng trình độ.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const CSS = `
.tva-qz{position:fixed;inset:0;z-index:120;background:${P.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${P.ink};text-align:left;}
.tva-qz *{box-sizing:border-box;}
.tva-qz .qz-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.tva-qz .qz-back{border:1.5px solid #D3CEE8;background:#fff;color:${P.indigo};border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-qz .qz-progress{font-size:13px;font-weight:600;color:${P.faint};}
.tva-qz .qz-bar{height:3px;background:${P.line};flex-shrink:0;}
.tva-qz .qz-bar-fill{height:100%;background:${P.honey};transition:width .25s ease;}
.tva-qz .qz-scroll{flex:1;overflow-y:auto;}
.tva-qz .qz-wrap{max-width:680px;margin:0 auto;padding:34px 24px 64px;}

.tva-qz .qz-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${P.honey};margin-bottom:12px;}
.tva-qz .qz-h1{font-family:${SERIF};font-size:36px;font-weight:600;line-height:1.12;letter-spacing:-.5px;color:${P.ink};margin:0;}
.tva-qz .qz-h1 i{color:${P.terra};font-style:italic;}
.tva-qz .qz-sub{font-size:15.5px;line-height:1.7;color:${P.soft};margin:16px 0 0;}
.tva-qz .qz-sub b{color:${P.ink};}
.tva-qz .qz-hr{border:none;border-top:2px solid ${P.ink};margin:24px 0 10px;opacity:.85;}
@media(max-width:560px){.tva-qz .qz-h1{font-size:28px;}}

.tva-qz .qz-qnum{font-family:${SERIF};font-size:30px;font-weight:700;font-style:italic;color:${P.honey};opacity:.5;margin-top:18px;}
.tva-qz .qz-q{font-family:${SERIF};font-size:24px;font-weight:600;line-height:1.3;color:${P.ink};margin:4px 0 20px;}
.tva-qz .qz-opts{display:flex;flex-direction:column;gap:10px;}
.tva-qz .qz-opt{display:flex;align-items:flex-start;gap:14px;text-align:left;background:#fff;border:1.5px solid ${P.line};border-radius:13px;padding:15px 16px;font-size:15px;color:${P.ink};cursor:pointer;font-family:inherit;line-height:1.5;transition:all .15s;}
.tva-qz .qz-opt:hover{border-color:${P.honey};background:${P.honeyTint};}
.tva-qz .qz-letter{flex-shrink:0;width:26px;height:26px;border-radius:8px;background:${P.honeyTint};color:${P.terra};display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800;}
.tva-qz .qz-opt:hover .qz-letter{background:${P.honey};color:#fff;}
.tva-qz .qz-prev{margin-top:20px;background:none;border:none;color:${P.faint};font-size:14px;cursor:pointer;font-family:inherit;}
.tva-qz .qz-prev:hover{color:${P.ink};}

.tva-qz .qz-rcard{background:#FCFAF6;border-left:4px solid ${P.terra};border-radius:0 16px 16px 0;padding:24px 26px;margin:20px 0 24px;}
.tva-qz .qz-rtag{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.honey};margin-bottom:10px;}
.tva-qz .qz-rtitle{font-family:${SERIF};font-size:26px;font-weight:600;color:${P.ink};margin-bottom:12px;}
.tva-qz .qz-rbody{font-size:15px;line-height:1.75;color:${P.soft};margin:0;}
.tva-qz .qz-actions{display:flex;flex-direction:column;gap:10px;max-width:340px;}
.tva-qz .qz-act-primary{background:${P.indigo};color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;}
.tva-qz .qz-act-ghost{background:#fff;color:${P.indigo};border:1.5px solid #D3CEE8;border-radius:12px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;}
.tva-qz .qz-act-text{background:none;border:none;color:${P.faint};font-size:14px;cursor:pointer;font-family:inherit;padding:6px;}
.tva-qz .qz-act-text:hover{color:${P.ink};}
.tva-qz .qz-note{font-size:13.5px;font-style:italic;color:${P.faint};line-height:1.65;margin:22px 0 0;}
`
