import { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ChunkErrorBoundary from '../../../src/lib/ChunkErrorBoundary'
import { clearDraft, importWithRetry, peekDraft, stashDraft } from '../../../src/lib/chunkRecovery'
declare const __BUILD__: string
const Composer = lazy(() => importWithRetry(() => import('./Composer'), 50))
function Host() {
  const [region, setRegion] = useState<string | null>(() => peekDraft<{ region: string }>('ask:s1')?.region ?? null)
  useEffect(() => { if (region) stashDraft('ask:s1', { region }); else clearDraft('ask:s1') }, [region])
  useEffect(() => () => clearDraft('ask:s1'), [])
  return <div><span data-testid="host-build">{__BUILD__}</span> <button data-testid="select" onClick={() => setRegion('Ô 3–6 · bản nhạc Thành phố buồn')}>Khoanh</button>
    {region && <ChunkErrorBoundary overlay onDismiss={() => setRegion(null)}><Suspense fallback={null}><Composer region={region} onClose={() => setRegion(null)} /></Suspense></ChunkErrorBoundary>}</div>
}
createRoot(document.getElementById('root')!).render(<Host />)
