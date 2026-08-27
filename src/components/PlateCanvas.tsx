import { useEffect, useRef } from 'react'
import { EtchingEngine, type HudState } from '../engine/EtchingEngine'

interface Props {
  engineRef: React.MutableRefObject<EtchingEngine | null>
  onHud: (h: HudState) => void
}

/** 空白纸面即装置：canvas 固定于底层，点击空白处 = 落刀 */
export default function PlateCanvas({ engineRef, onHud }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new EtchingEngine(canvas, onHud)
    engineRef.current = engine

    const detach = engine.attach()

    // 章节锚点（等字体与布局稳定后校准两次）
    const calibrate = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'))
      engine.setAnchors(els)
    }
    calibrate()
    const t1 = window.setTimeout(calibrate, 600)
    const t2 = window.setTimeout(calibrate, 1800)
    if (document.fonts?.ready) document.fonts.ready.then(calibrate)

    // 落刀：点在「纸面」（非交互元素、非正文）上
    const INTERACTIVE = 'a, button, p, h1, h2, h3, li, nav, header, aside, input, textarea, select, label, [data-ui]'
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest(INTERACTIVE)) return
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) return
      engine.strike(e.clientX, e.clientY)
    }
    window.addEventListener('click', onClick)

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key !== 'k' && e.key !== 'K') return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      engine.strikeAtFocus()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      detach()
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="stage" aria-hidden="true">
      <canvas ref={canvasRef} />
      <p className="sr-only">
        装置说明：屏幕上是一张正在被反复重刻的铜版画。滚动页面会推进它的版次——版面从混沌的浮尘逐渐逼近一幅「山月图」；
        在空白纸面单击即可「落刀」，留下你自己的刀痕；第叁章滚动时会有一次墨潮自下而上洗过版面；终章会盖下一枚朱砂印。
        你的落刀次数与暗记会写进结尾的题跋里。
      </p>
    </div>
  )
}
