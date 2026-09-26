import { Suspense, lazy, useEffect, useState } from 'react'
import App from './App'

// The digital twin pulls in three.js, so it is its own chunk behind #/twin.
const DigitalTwin = lazy(() => import('./digitalTwin/DigitalTwin'))
const SimulationLab = lazy(() => import('./simulation/SimulationLab'))

export function Root() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // Query strings (#/twin?scene=result) select deterministic scenes; a new hash remounts.
  const route = hash.split('?')[0]
  if (route !== '#/twin' && route !== '#/lab') return <App />
  return (
    <Suspense fallback={<div className="empty" style={{ padding: 48 }}>Loading…</div>}>
      {route === '#/twin' ? <DigitalTwin key={hash} /> : <SimulationLab key={hash} />}
    </Suspense>
  )
}
