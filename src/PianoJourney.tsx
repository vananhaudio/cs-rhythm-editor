import React, { useEffect, useState } from 'react'

// DEBUG: Kiểm tra từng import để tìm file gây lỗi
export default function PianoJourney({ onClose, studentName }: { onClose?: () => void; studentName?: string }) {
  const [results, setResults] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const tests: { name: string; fn: () => Promise<string> }[] = [
      {
        name: 'rules.ts',
        fn: async () => {
          const m = await import('./piano/rules')
          return `rules: ${m.LEVELS.length} bậc, current=${m.currentLevelId()}`
        }
      },
      {
        name: 'library.ts',
        fn: async () => {
          const m = await import('./piano/library')
          const songs = m.listSongs()
          return `library: ${songs.length} bài`
        }
      },
      {
        name: 'notationAdapter',
        fn: async () => {
          await import('./piano/notationAdapter')
          return 'notationAdapter OK'
        }
      },
      {
        name: 'HomeScreen',
        fn: async () => {
          await import('./piano/HomeScreen')
          return 'HomeScreen OK'
        }
      },
      {
        name: 'TalkWithTeacher',
        fn: async () => {
          await import('./piano/TalkWithTeacher')
          return 'TalkWithTeacher OK'
        }
      },
      {
        name: 'LearningFlow',
        fn: async () => {
          await import('./piano/LearningFlow')
          return 'LearningFlow OK'
        }
      },
      {
        name: 'SongLibrary',
        fn: async () => {
          await import('./piano/SongLibrary')
          return 'SongLibrary OK'
        }
      },
    ]

    const res: string[] = []
    async function run() {
      for (const t of tests) {
        try {
          res.push(await t.fn())
        } catch (e: any) {
          res.push(`${t.name} FAIL: ${e.message || String(e)}`)
        }
      }
      setResults(res)
      setDone(true)
    }
    run()
  }, [])

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, background: '#fff', minHeight: '100dvh', overflow: 'auto' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🔍 Debug Piano Journey</div>
      {results.map((r, i) => (
        <div key={i} style={{ color: r.includes('FAIL') ? '#DC2626' : '#059669', marginBottom: 4 }}>
          {i + 1}. {r}
        </div>
      ))}
      {!done && <div style={{ color: '#8A8478' }}>Đang kiểm tra...</div>}
      {done && results.every(r => !r.includes('FAIL')) && (
        <div style={{ marginTop: 16, padding: 12, background: '#DCFCE7', borderRadius: 8, color: '#166534', fontWeight: 700 }}>
          ✅ Tất cả import OK — lỗi nằm ở render component
        </div>
      )}
    </div>
  )
}
