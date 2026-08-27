/**
 * 版面生成：一张 1200×1600 的「铜版」目标构图 —— 山月图。
 * 层级：0 起稿（轮廓）/ 1 施墨（排线与色阶）/ 2 细刻（精修与版调）
 *       3 刀痕（访客落刀，运行时追加）/ 9 暗记（隐藏飞鸟）
 * 每根线条 = 一笔：目标位置 + 噪声漂移 + 切线角 + 长度 + 宽度 + 墨量。
 * 「逼近」= 线条从噪声位置向目标位置的收敛。
 */
import { mulberry32, makeNoise1D } from './rng'

export interface Stroke {
  tx: number // 目标位置
  ty: number
  dx: number // 噪声漂移（起点 = 目标 + 漂移）
  dy: number
  ang: number
  len: number
  w: number
  ink: number
  layer: 0 | 1 | 2 | 3 | 9
  boost: number // 落刀带来的永久局部精进
  // 落刀冲击的弹簧位移（瞬时）
  ox: number
  oy: number
  vx: number
  vy: number
  phase: number
}

export interface Artwork {
  strokes: Stroke[]
  moon: { x: number; y: number; r: number }
  seed: number
}

const PLATE_W = 1200
const PLATE_H = 1600

export const PLATE = { w: PLATE_W, h: PLATE_H }

export function buildArtwork(seed: number, budget: 'low' | 'high'): Artwork {
  const rng = mulberry32(seed)
  const n = {
    a: makeNoise1D(rng),
    b: makeNoise1D(rng),
    c: makeNoise1D(rng),
  }
  const density = budget === 'low' ? 0.62 : 1
  const strokes: Stroke[] = []
  const moon = { x: 780, y: 252, r: 148 }

  const push = (s: Omit<Stroke, 'boost' | 'ox' | 'oy' | 'vx' | 'vy' | 'phase' | 'dx' | 'dy'> & { drift?: number }) => {
    const drift = s.drift ?? 1
    // 漂移幅度收着放：素版的浮尘里要能隐约读出构图，而非一团乱线
    const R = (55 + rng() * 190) * drift
    const a = rng() * Math.PI * 2
    strokes.push({
      ...s,
      dx: Math.cos(a) * R,
      dy: Math.sin(a) * R,
      boost: 0,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      phase: rng() * Math.PI * 2,
    })
  }

  /* ---------- 山脊（五重，愈前愈重） ---------- */
  const ridgeCount = 5
  for (let k = 0; k < ridgeCount; k++) {
    const baseY = 700 + k * 168 + (rng() - 0.5) * 26
    const amp = 46 + k * 26
    const freq = 0.0038 + k * 0.0009
    const nfn = [n.a, n.b, n.c][k % 3]
    // 每道山脊两座主峰
    const peaks = [rng() * 400 + 100, rng() * 400 + 700]
    const yAt = (x: number) => {
      let y = baseY - nfn(x * freq + k * 77) * amp
      for (const p of peaks) y -= Math.exp(-((x - p) ** 2) / (2 * 260 ** 2)) * (90 + k * 28)
      return y
    }

    let prevX = -140
    let prevY = yAt(prevX)
    const step = 22
    for (let x = prevX + step; x <= PLATE_W + 140; x += step) {
      const y = yAt(x)
      const ang = Math.atan2(y - prevY, x - prevX)
      // 起稿层：主轮廓长线
      push({
        tx: (x + prevX) / 2,
        ty: (y + prevY) / 2,
        ang: ang + (rng() - 0.5) * 0.05,
        len: Math.hypot(x - prevX, y - prevY) * 0.92 + rng() * 3,
        w: 1.35 + k * 0.22,
        ink: 0.5 + k * 0.1,
        layer: 0,
        drift: 1.25,
      })
      const slope = Math.abs(y - prevY) / step
      // 施墨层：背光坡面的排线（下坡侧）
      if (slope > 0.3 && (y - prevY) * (k % 2 === 0 ? 1 : -1) > 0) {
        const rows = Math.round((1 + k * 0.9 + slope * 2) * density)
        for (let j = 0; j < rows; j++) {
          const along = (rng() - 0.5) * step * 1.4
          const off = 3 + rng() * (12 + k * 9)
          push({
            tx: x + Math.cos(ang) * along - Math.sin(ang) * off,
            ty: y + Math.sin(ang) * along + Math.cos(ang) * off,
            ang: ang + Math.PI / 2 + (rng() - 0.5) * 0.5,
            len: 4.5 + rng() * 6.5,
            w: 0.75,
            ink: (0.16 + k * 0.085) * (0.7 + slope * 0.6),
            layer: 1,
            drift: 0.9,
          })
        }
      }
      // 细刻层：山脊线的顿点与飞白
      if (slope < 0.14 && rng() < 0.3 * density) {
        push({
          tx: x,
          ty: y - 1.5,
          ang: ang + (rng() - 0.5) * 0.3,
          len: 2.5 + rng() * 3.5,
          w: 0.6,
          ink: 0.72,
          layer: 2,
          drift: 0.65,
        })
      }
      prevX = x
      prevY = y
    }

    // 色阶层：山脚整片的宽笔淡墨（版调）
    const tone = Math.round(70 * density * (0.6 + k * 0.35))
    for (let j = 0; j < tone; j++) {
      const x = rng() * (PLATE_W + 80) - 40
      const y = yAt(x) + 16 + rng() * (46 + k * 30)
      push({
        tx: x,
        ty: y,
        ang: (rng() - 0.5) * 0.16,
        len: 16 + rng() * 34,
        w: 9 + rng() * 8,
        ink: 0.028 + k * 0.008,
        layer: 1,
        drift: 0.7,
      })
    }
  }

  /* ---------- 月 ---------- */
  const seg = (cx: number, cy: number, r: number, a0: number, a1: number, count: number, layer: 0 | 1 | 2, w: number, ink: number, len: number) => {
    for (let i = 0; i < count; i++) {
      const a = lerpN(a0, a1, i / count)
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      push({ tx: x, ty: y, ang: a + Math.PI / 2 + (rng() - 0.5) * 0.06, len: len + rng() * 3, w, ink, layer, drift: layer === 0 ? 1.2 : 0.8 })
    }
  }
  seg(moon.x, moon.y, moon.r, 0, Math.PI * 2, 42, 0, 1.9, 0.92, 21) // 外缘
  seg(moon.x, moon.y, moon.r - 12, 0, Math.PI * 2, 84, 1, 0.72, 0.38, 8) // 内缘
  seg(moon.x, moon.y, moon.r + 24, rng() * 2, rng() * 2 + 3, 40, 2, 0.5, 0.16, 4) // 外晕（断续虚弧）
  // 环形山
  const craters = Math.round(7 * density) + 3
  for (let c = 0; c < craters; c++) {
    const a = rng() * Math.PI * 2
    const rr = rng() * moon.r * 0.62
    const cx = moon.x + Math.cos(a) * rr
    const cy = moon.y + Math.sin(a) * rr
    const cr = 5 + rng() * 12
    seg(cx, cy, cr, rng() * 2, rng() * 2 + 2.2, Math.round(cr * 0.9), 2, 0.55, 0.5, 3.2)
  }

  /* ---------- 雾带 ---------- */
  for (const by of [606, 655, 704]) {
    const count = Math.round(22 * density)
    for (let j = 0; j < count; j++) {
      push({
        tx: rng() * (PLATE_W + 60) - 30,
        ty: by + (rng() - 0.5) * 14,
        ang: (rng() - 0.5) * 0.1,
        len: 24 + rng() * 42,
        w: 1.1,
        ink: 0.2,
        layer: 1,
        drift: 1,
      })
    }
  }

  /* ---------- 空中版调（远离月面的碎屑） ---------- */
  const specks = Math.round(240 * density)
  for (let j = 0; j < specks; j++) {
    const x = rng() * PLATE_W
    const y = 40 + rng() * 480
    if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 34) continue
    push({
      tx: x,
      ty: y,
      ang: 0.7 + (rng() - 0.5) * 0.5,
      len: 1.5 + rng() * 2.2,
      w: 0.5,
      ink: 0.1 + rng() * 0.05,
      layer: 2,
      drift: 0.8,
    })
  }

  /* ---------- 暗记：飞鸟（八刀之后显现） ---------- */
  for (let b = 0; b < 5; b++) {
    const bx = 300 + rng() * 240
    const by = 300 + rng() * 130
    const l = 7 + rng() * 6
    push({ tx: bx, ty: by, ang: -0.42, len: l, w: 1.05, ink: 0.78, layer: 9, drift: 0.5 })
    push({ tx: bx + l * 0.8, ty: by + 1.5, ang: Math.PI + 0.42, len: l, w: 1.05, ink: 0.78, layer: 9, drift: 0.5 })
  }

  return { strokes, moon, seed }
}

function lerpN(a: number, b: number, t: number) {
  return a + (b - a) * t
}
