import { useEffect, useState } from 'react'
import type { HudState } from '../engine/EtchingEngine'
import { SECTIONS } from '../content'

/* ---------- 揭纸入场 ---------- */
export function BootVeil() {
  const [state, setState] = useState<'hold' | 'lift' | 'gone'>('hold')
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setState('gone')
      return
    }
    const t1 = window.setTimeout(() => setState('lift'), 450)
    const t2 = window.setTimeout(() => setState('gone'), 1600)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])
  if (state === 'gone') return null
  return (
    <div className={`boot${state === 'lift' ? ' lift' : ''}`} aria-hidden="true">
      <span className="mark">版次</span>
    </div>
  )
}

/* ---------- 顶部刊头 ---------- */
export function Masthead() {
  return (
    <header className="masthead">
      <span>
        <b>STATES OF THE PLATE</b>
      </span>
      <span>ZCODE · 创意前端</span>
    </header>
  )
}

/* ---------- 左下 HUD ---------- */
export function Hud({ hud, onStrike }: { hud: HudState; onStrike: () => void }) {
  const s = SECTIONS[hud.section] ?? SECTIONS[0]
  return (
    <div className="hud" data-ui aria-live="polite">
      <div className="state">
        <b>
          {s.han} · {s.name}
        </b>
        <span>{s.latin}</span>
      </div>
      <div className="count">
        <b key={hud.strikes}>{hud.strikes}</b> 刀
      </div>
      <button className="btn" onClick={onStrike} title="在版面焦点处落一刀（快捷键 K）">
        落刀 · K
      </button>
    </div>
  )
}

/* ---------- 右缘进度轨 ---------- */
export function Rail({ active }: { active: number }) {
  return (
    <nav className="rail" data-ui aria-label="章节导航">
      <span className="track" aria-hidden="true" />
      <span className="fill" aria-hidden="true" />
      {SECTIONS.map((s, i) => (
        <button
          key={s.key}
          aria-current={active === i}
          aria-label={`跳到 ${s.han} · ${s.name}`}
          onClick={() => {
            const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            // 终章直抵卷底：让成品与朱印完整入目
            if (i === SECTIONS.length - 1) {
              window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
            } else {
              document.querySelectorAll<HTMLElement>('[data-section]')[i]?.scrollIntoView({ behavior })
            }
          }}
        >
          {s.han}
        </button>
      ))}
    </nav>
  )
}

/* ---------- 纸纹 ---------- */
export function Grain() {
  return <div className="grain" aria-hidden="true" />
}

/* ---------- 移动端顶部墨线 ---------- */
export function Topline() {
  return <div className="topline" aria-hidden="true" />
}
