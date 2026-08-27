import { useEffect } from 'react'

/** 章节入场：进入视口后加 .in（墨迹横拉的揭示，见 base.css） */
export function useReveal<T extends HTMLElement = HTMLElement>(): (el: T | null) => void {
  let node: T | null = null
  useEffect(() => {
    if (!node) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.22 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])
  return (el) => {
    node = el
  }
}
