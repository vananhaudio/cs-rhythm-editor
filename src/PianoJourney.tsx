import React, { useState } from 'react'
import HomeScreen from './piano/HomeScreen'
import TalkWithTeacher from './piano/TalkWithTeacher'
import SongLibrary from './piano/SongLibrary'
import LearningFlow from './piano/LearningFlow'

type Stage = 'home' | 'talk' | 'generating' | 'playing' | 'library'

export default function PianoJourney({ onClose, studentName }: { onClose?: () => void; studentName?: string }) {
  const [testStage, setTestStage] = useState<Stage>('home')

  return (
    <div style={{ padding: 12, background: '#fff', minHeight: '100dvh', fontFamily: 'system-ui' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>🔍 Test Render (+LearningFlow import)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['home', 'talk', 'library'] as Stage[]).map(s => (
          <button key={s} onClick={() => setTestStage(s)} style={{
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: testStage === s ? '#F59E0B' : '#F3F4F6',
            color: testStage === s ? '#fff' : '#333',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{s}</button>
        ))}
      </div>
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 8, minHeight: 200 }}>
        {testStage === 'home' && <HomeScreen studentName={studentName} onTalkToLyra={() => {}} onContinue={() => {}} onOpenSongs={() => setTestStage('library')} onOpenMenu={onClose} />}
        {testStage === 'talk' && <TalkWithTeacher onClose={() => setTestStage('home')} />}
        {testStage === 'library' && <SongLibrary onBack={() => setTestStage('home')} onPlay={() => {}} onAskLyra={() => setTestStage('talk')} />}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#059669' }}>LearningFlow imported (chưa render) — nếu thấy dòng này là OK</div>
    </div>
  )
}
