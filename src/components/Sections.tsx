import { useReveal } from '../hooks/useReveal'
import { HERO, CH1, CH2, CH3, colophonLines, FOOTER, SECTIONS } from '../content'

type SectionProps = { children: React.ReactNode; k: string; side?: 'left' | 'right' | 'center' }

function Section({ children, k, side = 'left' }: SectionProps) {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      data-section={k}
      data-side={side}
      className={`chapter ${k === 'hero' ? 'hero' : ''}`}
      aria-labelledby={`${k}-title`}
    >
      {children}
    </section>
  )
}

/* ---------- 首屏 ---------- */
export function Hero() {
  return (
    <Section k="hero">
      <div className="hero-copy hit">
        <p className="eyebrow rv" style={{ ['--d' as string]: 0 }}>
          {HERO.eyebrow}
        </p>
        <h1 className="hero-line rv" style={{ ['--d' as string]: 1 }}>
          {HERO.line}
        </h1>
        <p className="hero-sub rv" style={{ ['--d' as string]: 2 }}>
          {HERO.sub}
        </p>
        <p className="strike-hint rv" style={{ ['--d' as string]: 3 }}>
          <span className="burin" aria-hidden="true" />
          {HERO.hint}
        </p>
      </div>
      <div className="hero-title" aria-hidden="true">
        <span className="zi rv-soft" style={{ ['--d' as string]: 2 }}>
          版
        </span>
        <span className="zi rv-soft" style={{ ['--d' as string]: 3 }}>
          次
        </span>
        <span className="rule" />
        <span className="hero-latin rv-soft" style={{ ['--d' as string]: 4 }}>
          {HERO.latin}
        </span>
      </div>
      <p className="scroll-cue rv-soft" style={{ ['--d' as string]: 5 }}>
        {HERO.cue}
      </p>
    </Section>
  )
}

/* ---------- 壹 · 起稿 ---------- */
export function ChapterOne() {
  return (
    <Section k="draft" side="left">
      <div className="prose hit">
        <p className="eyebrow rv" style={{ ['--d' as string]: 0 }}>
          <span className="num">{CH1.num}</span>
          {CH1.eyebrow}
        </p>
        <h2 id="draft-title" className="rv-track" style={{ ['--d' as string]: 1 }}>
          {CH1.title}
        </h2>
        <p className="rv" style={{ ['--d' as string]: 2 }}>
          {CH1.p1}
        </p>
        <p className="rv" style={{ ['--d' as string]: 3 }}>
          {CH1.p2}
        </p>
        <p className="marginal rv-soft" style={{ ['--d' as string]: 5 }}>
          {CH1.marginal}
        </p>
      </div>
    </Section>
  )
}

/* ---------- 贰 · 落刀 ---------- */
export function ChapterTwo() {
  return (
    <Section k="carve" side="right">
      <div className="prose hit">
        <p className="eyebrow rv" style={{ ['--d' as string]: 0 }}>
          <span className="num">{CH2.num}</span>
          {CH2.eyebrow}
        </p>
        <h2 id="carve-title" className="rv-track" style={{ ['--d' as string]: 1 }}>
          {CH2.title}
        </h2>
        <ul className="craft">
          {CH2.items.map((it, i) => (
            <li key={it.no} className="rv" style={{ ['--d' as string]: 2 + i }}>
              <span className="no" aria-hidden="true">
                {it.no}
              </span>
              <div>
                <strong>{it.t}</strong>
                <span>{it.d}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="marginal rv-soft" style={{ ['--d' as string]: 6 }}>
          {CH2.marginal}
        </p>
      </div>
    </Section>
  )
}

/* ---------- 叁 · 洗版 ---------- */
export function ChapterThree() {
  return (
    <Section k="wash" side="center">
      <div className="prose hit">
        <p className="eyebrow rv" style={{ ['--d' as string]: 0 }}>
          <span className="num">{CH3.num}</span>
          {CH3.eyebrow}
        </p>
        <h2 id="wash-title" className="rv-track" style={{ ['--d' as string]: 1 }}>
          {CH3.title}
        </h2>
        <p className="rv" style={{ ['--d' as string]: 2 }}>
          {CH3.p1}
        </p>
        <p className="rv" style={{ ['--d' as string]: 3 }}>
          {CH3.p2}
        </p>
        <p className="marginal rv-soft" style={{ ['--d' as string]: 5 }}>
          {CH3.marginal}
        </p>
      </div>
    </Section>
  )
}

/* ---------- 跋 · 成版 ---------- */
export function Colophon({
  strikes,
  washes,
  secret,
  onReseed,
}: {
  strikes: number
  washes: number
  secret: boolean
  onReseed: () => void
}) {
  const lines = colophonLines({ strikes, washes, secret })
  return (
    <Section k="done" side="center">
      <div className="prose hit colophon-box">
        <p className="eyebrow rv" style={{ ['--d' as string]: 0 }}>
          <span className="num">{SECTIONS[4].han}</span>
          COLOPHON · 题跋
        </p>
        <h2 id="done-title" className="rv-track" style={{ ['--d' as string]: 1 }}>
          题跋
        </h2>
        <ul className="colophon-lines">
          {lines.map((l, i) => (
            <li
              key={i}
              className="rv"
              style={{ ['--d' as string]: 2 + i }}
              dangerouslySetInnerHTML={{ __html: l.replace(/<em>/g, '<em class="em">').replace(/<\/em>/g, '</em>') }}
            />
          ))}
        </ul>
        <div className="colophon-actions rv-soft" style={{ ['--d' as string]: 6 }}>
          <button className="btn btn--seal" onClick={onReseed}>
            重刻此版
          </button>
          <span className="footer-meta">{FOOTER}</span>
        </div>
      </div>
    </Section>
  )
}
