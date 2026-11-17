import { useEffect, useRef, useState } from 'react'
import { clearDraft, peekDraft, stashDraft } from '../../../src/lib/chunkRecovery'
declare const __BUILD__: string
// Mô phỏng ShareNoteComposer: nháp câu hỏi giữ qua tải lại (cùng cơ chế với bản thật)
export default function Composer({ region, onClose }: { region: string; onClose: () => void }) {
  const [text, setText] = useState(() => peekDraft<{ text: string }>('composer:s1')?.text ?? '')
  useEffect(() => { if (text) stashDraft('composer:s1', { text }); else clearDraft('composer:s1') }, [text])
  useEffect(() => () => clearDraft('composer:s1'), [])
  const ref = useRef<HTMLTextAreaElement>(null); useEffect(() => ref.current?.focus(), [])
  return <div data-testid="composer"><b data-testid="build">{__BUILD__}</b><p data-testid="region">{region}</p><textarea data-testid="q" ref={ref} value={text} onChange={e => setText(e.target.value)} /><button onClick={onClose}>Đóng</button></div>
}
