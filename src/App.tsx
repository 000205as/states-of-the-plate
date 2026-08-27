import { useCallback, useRef, useState } from 'react'
import PlateCanvas from './components/PlateCanvas'
import { BootVeil, Masthead, Hud, Rail, Grain, Topline } from './components/Chrome'
import { Hero, ChapterOne, ChapterTwo, ChapterThree, Colophon } from './components/Sections'
import type { EtchingEngine, HudState } from './engine/EtchingEngine'

export default function App() {
  const engineRef = useRef<EtchingEngine | null>(null)
  const [hud, setHud] = useState<HudState>({
    section: 0,
    strikes: 0,
    washes: 0,
    secret: false,
    washActive: false,
  })

  const onStrike = useCallback(() => engineRef.current?.strikeAtFocus(), [])
  const onReseed = useCallback(() => {
    engineRef.current?.reseed()
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [])

  return (
    <>
      <PlateCanvas engineRef={engineRef} onHud={setHud} />
      <Grain />
      <BootVeil />
      <Topline />
      <Masthead />
      <Rail active={hud.section} />
      <Hud hud={hud} onStrike={onStrike} />
      <main>
        <Hero />
        <ChapterOne />
        <ChapterTwo />
        <ChapterThree />
        <Colophon strikes={hud.strikes} washes={hud.washes} secret={hud.secret} onReseed={onReseed} />
      </main>
    </>
  )
}
