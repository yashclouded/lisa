import { Suspense, lazy, useEffect, useState } from 'react'
import App from './App'

// The digital twin pulls in three.js, so it is its own chunk behind #/twin.
const DigitalTwin = lazy(() => import('./digitalTwin/DigitalTwin'))

export function Root() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  if (hash !== '#/twin') return <App />
  return (
    <Suspense fallback={<div className="empty" style={{ padding: 48 }}>Loading digital twin…</div>}>
      <DigitalTwin />
    </Suspense>
  )
}
