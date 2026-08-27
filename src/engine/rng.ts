/** 可播种随机数与一维值噪声 —— 让每一次「重刻」得到不同但可复现的版 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 一维平滑值噪声（格点插值），供山脊线扰动使用 */
export function makeNoise1D(rng: () => number): (x: number) => number {
  const N = 256
  const g = Array.from({ length: N }, () => rng() * 2 - 1)
  const at = (i: number) => g[((i % N) + N) % N]
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return at(i) * (1 - u) + at(i + 1) * u
  }
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
export const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
