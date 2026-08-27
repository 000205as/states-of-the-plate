/**
 * EtchingEngine —— 「版次」核心装置。
 * 一张固定在视口里的铜版：滚动 = 推进版次（平滑跟随），
 * 点击 = 落刀（冲击波 + 弹簧位移 + 永久刀痕），
 * 第叁章 = 洗版（墨潮由下至上，与滚动互为因果，可逆），
 * 终章 = 朱砂印落下（带一次性的按压力学）。
 *
 * 一切状态都是 p（滚动进度）的函数，因此整体可逆；
 * 只有访客的刀痕与落刀次数不可逆 —— 那是他自己的部分。
 */
import { buildArtwork, PLATE, type Artwork } from './artwork'
import { clamp, lerp, smoothstep, easeOutCubic, easeOutBack } from './rng'

export interface Cam {
  x: number
  y: number
  s: number
}

export interface HudState {
  section: number
  strikes: number
  washes: number
  secret: boolean
  washActive: boolean
}

interface Anchors {
  sections: number[] // 每个章节顶部的 p 值
  wash: [number, number]
  seal: number
}

const LAYER_FADE = (layer: number, p: number): number => {
  switch (layer) {
    case 0:
      return 0.22 + 0.78 * smoothstep(0.07, 0.3, p)
    case 1:
      return smoothstep(0.4, 0.6, p)
    case 2:
      return smoothstep(0.63, 0.84, p)
    case 3:
      return 1
    default:
      return 1
  }
}

const BASE_R = (layer: number, p: number): number => {
  switch (layer) {
    case 0:
      return smoothstep(0.04, 0.38, p)
    case 1:
      return smoothstep(0.34, 0.8, p)
    case 2:
      return smoothstep(0.6, 0.97, p)
    case 3:
      return 0.82
    default:
      return 0.85
  }
}

const SPRING_K = 110
const SPRING_C = 9.5

export class EtchingEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private vw = 0
  private vh = 0

  private art: Artwork
  private seed: number
  private budget: 'low' | 'high'

  private p = 0
  private prevP = 0
  private pTarget = 0
  private section = 0
  private cam: Cam = { x: 600, y: 800, s: 0.5 }
  private camTarget: Cam = { x: 600, y: 800, s: 0.5 }
  private anchors: Anchors = {
    sections: [0, 0.167, 0.41, 0.66, 0.925],
    wash: [0.66, 0.86],
    seal: 0.965,
  }

  private waves: { x: number; y: number; t: number }[] = []
  private active = new Set<number>()
  private strikes = 0
  private washes = 0
  private secret = false
  private secretT = -1
  private stampT = -1
  private shake = 0
  private time = 0

  private raf = 0
  private last = 0
  private running = false
  reduced = false
  private onHud: (h: HudState) => void
  private lastStrikeAt = 0
  private sealDots: { x: number; y: number; r: number; a: number }[] = []

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('canvas 2d unavailable')
    this.ctx = ctx
    this.onHud = onHud

    const coarse = window.matchMedia('(pointer: coarse)').matches
    const cores = navigator.hardwareConcurrency || 4
    this.budget = coarse || cores <= 4 ? 'low' : 'high'
    this.seed = (Date.now() ^ 0x9e3779b9) >>> 0
    this.art = buildArtwork(this.seed, this.budget)
    for (let i = 0; i < 46; i++) {
      this.sealDots.push({
        x: (Math.random() - 0.5) * 88,
        y: (Math.random() - 0.5) * 88,
        r: 0.6 + Math.random() * 1.6,
        a: 0.1 + Math.random() * 0.22,
      })
    }
    this.resize()
    this.cam = this.camFor(0)
    this.camTarget = { ...this.cam }
  }

  /* ---------------- 生命周期 ---------------- */

  attach(): () => void {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const onScroll = () => {
      if (!this.reduced) return
      // 降级模式：无插值，状态直接跟随滚动，单帧渲染
      const next = this.readScrollP()
      const washEnd = this.anchors.wash[1]
      if (this.p < washEnd && next >= washEnd) {
        this.washes += 1
        this.emitHud()
      }
      this.prevP = next
      this.p = next
      this.pTarget = next
      const idx = this.updateSection()
      this.camTarget = this.camFor(idx)
      this.cam = { ...this.camTarget }
      if (this.p >= this.anchors.seal && this.stampT < 0) this.stampT = 0
      this.render()
    }
    const onVis = () => {
      if (document.hidden) this.stop()
      else this.start()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', this.resize)
    document.addEventListener('visibilitychange', onVis)
    if (document.fonts?.ready) document.fonts.ready.then(() => this.render())
    this.start()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', this.resize)
      document.removeEventListener('visibilitychange', onVis)
      this.stop()
    }
  }

  private start() {
    if (this.reduced) {
      this.render()
      return
    }
    if (this.running) return
    this.running = true
    this.last = performance.now()
    const loop = (now: number) => {
      if (!this.running) return
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.time += dt
      this.tick(dt)
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  /* ---------------- 滚动与锚点 ---------------- */

  private readScrollP(): number {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    return max > 0 ? clamp(window.scrollY / max) : 0
  }

  setAnchors(sections: HTMLElement[]) {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    if (max <= 0) return
    this.anchors.sections = sections.map((el) => clamp(el.offsetTop / max))
    const s3 = this.anchors.sections[3] ?? 0.66
    this.anchors.wash = [clamp(s3), clamp(s3 + 0.2)]
    this.anchors.seal = clamp((this.anchors.sections[4] ?? 0.9) + 0.045, 0, 0.97)
  }

  /** 相机编舞：全貌（幽灵）→ 局部（成形）→ 全貌（成品）。fit 随视口重算，首尾同构图呼应。 */
  private camFor(idx: number): Cam {
    const fit = Math.min(this.vw / (PLATE.w + 160), this.vh / (PLATE.h + 90))
    const mobile = this.vw < 720
    switch (idx) {
      case 0:
        return mobile ? { x: 600, y: 872, s: fit } : { x: 420, y: 795, s: fit * 1.03 }
      case 1:
        return mobile ? { x: 790, y: 335, s: 1.38 } : { x: 810, y: 330, s: 1.9 }
      case 2:
        return mobile ? { x: 520, y: 1030, s: 1.3 } : { x: 520, y: 1070, s: 1.6 }
      case 3:
        return { x: 600, y: 812, s: fit * 1.05 }
      default:
        return { x: 600, y: 800, s: fit }
    }
  }

  private updateSection(emit = true): number {
    const th = this.anchors.sections
    let idx = 0
    for (let i = 0; i < th.length; i++) if (this.p >= th[i] - 0.015) idx = i
    if (idx !== this.section) {
      this.section = idx
      if (emit) this.emitHud()
    }
    return idx
  }

  private washT(): number {
    const [a, b] = this.anchors.wash
    return clamp((this.p - a) / (b - a))
  }

  /* ---------------- 帧推进 ---------------- */

  private tick(dt: number) {
    this.pTarget = this.readScrollP()
    this.p += (this.pTarget - this.p) * Math.min(1, dt * 7)
    if (Math.abs(this.pTarget - this.p) < 0.0004) this.p = this.pTarget

    // 洗版计数：向前完整穿越潮尾一次，记一遍
    const washEnd = this.anchors.wash[1]
    if (this.prevP < washEnd && this.p >= washEnd) {
      this.washes += 1
      this.emitHud()
    }
    this.prevP = this.p

    const idx = this.updateSection()
    this.camTarget = this.camFor(idx)

    // 相机缓动（缩放更沉稳）
    this.cam.x = lerp(this.cam.x, this.camTarget.x, Math.min(1, dt * 5))
    this.cam.y = lerp(this.cam.y, this.camTarget.y, Math.min(1, dt * 5))
    this.cam.s = lerp(this.cam.s, this.camTarget.s, Math.min(1, dt * 3.6))

    // 冲击波衰减
    for (const w of this.waves) w.t += dt
    this.waves = this.waves.filter((w) => w.t < 0.9)

    // 弹簧（只推进活跃笔画）
    if (this.active.size) {
      for (const i of this.active) {
        const s = this.art.strokes[i]
        if (!s) continue
        s.vx += (-SPRING_K * s.ox - SPRING_C * s.vx) * dt
        s.vy += (-SPRING_K * s.oy - SPRING_C * s.vy) * dt
        s.ox += s.vx * dt
        s.oy += s.vy * dt
        if (Math.abs(s.ox) + Math.abs(s.oy) + Math.abs(s.vx) + Math.abs(s.vy) < 0.4) {
          s.ox = s.oy = s.vx = s.vy = 0
          this.active.delete(i)
        }
      }
    }

    if (this.shake > 0.001) this.shake *= Math.exp(-dt * 7)

    // 朱印
    if (this.p >= this.anchors.seal && this.stampT < 0) {
      this.stampT = this.time
      this.shake = 3
      if (navigator.vibrate) navigator.vibrate(12)
      this.emitHud()
    }

    // 暗记显现
    if (this.secret && this.secretT < 0) this.secretT = this.time

    document.documentElement.style.setProperty('--sp', this.p.toFixed(4))
  }

  private emitHud() {
    this.onHud({
      section: this.section,
      strikes: this.strikes,
      washes: this.washes,
      secret: this.secret,
      washActive: this.washT() > 0 && this.washT() < 1,
    })
  }

  /* ---------------- 落刀 ---------------- */

  strike(clientX: number, clientY: number): boolean {
    const now = performance.now()
    // 双击缩放容错：250ms 内的重复点击只算一刀
    if (now - this.lastStrikeAt < 250) return false
    this.lastStrikeAt = now

    const s = this.cam.s
    const px = (clientX - this.vw / 2) / s + this.cam.x
    const py = (clientY - this.vh / 2) / s + this.cam.y

    this.strikes += 1
    if (this.strikes >= 8 && !this.secret) {
      this.secret = true
      this.secretT = this.reduced ? 1 : this.time
    }

    const R = 170
    const strokes = this.art.strokes
    for (let i = 0; i < strokes.length; i++) {
      const st = strokes[i]
      const d = Math.hypot(st.tx - px, st.ty - py)
      if (d > R) continue
      const f = 1 - d / R
      st.boost = Math.min(1, st.boost + 0.5 * f * f)
      if (!this.reduced && d > 0.001) {
        const ux = (st.tx - px) / d
        const uy = (st.ty - py) / d
        st.vx += ux * 300 * f
        st.vy += uy * 300 * f
        this.active.add(i)
      }
    }

    // 永久刀痕（干刻直痕 + 飞溅墨点）
    const rng = Math.random
    const addMark = (dd: number, ang: number, len: number, w: number, ink: number) => {
      this.art.strokes.push({
        tx: px + Math.cos(ang) * dd,
        ty: py + Math.sin(ang) * dd,
        dx: (rng() - 0.5) * 10,
        dy: (rng() - 0.5) * 10,
        ang: ang + (rng() - 0.5) * 1.2,
        len,
        w,
        ink,
        layer: 3,
        boost: 0,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        phase: rng() * Math.PI * 2,
      })
    }
    for (let m = 0; m < 3; m++) addMark(4 + rng() * 16, rng() * Math.PI * 2, 5 + rng() * 9, 1.15, 0.42 + rng() * 0.18)
    for (let m = 0; m < 4; m++) addMark(20 + rng() * 42, rng() * Math.PI * 2, 1 + rng() * 1.4, 1.5, 0.34 + rng() * 0.16)
    this.waves.push({ x: px, y: py, t: 0 })
    if (navigator.vibrate) navigator.vibrate(8)
    this.emitHud()
    if (this.reduced) this.render()
    return true
  }

  /** 键盘落刀：落在当前版面焦点上 */
  strikeAtFocus() {
    this.strike(this.vw * 0.5 + (this.camTarget.x - 600) * this.cam.s, this.vh * 0.52)
  }

  reseed() {
    this.seed = (Date.now() ^ (this.seed << 5)) >>> 0
    this.art = buildArtwork(this.seed, this.budget)
    this.strikes = 0
    this.washes = 0
    this.secret = false
    this.secretT = -1
    this.stampT = -1
    this.waves = []
    this.active.clear()
    this.emitHud()
    if (this.reduced) this.render()
  }

  /* ---------------- 渲染 ---------------- */

  resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.vw = window.innerWidth
    this.vh = window.innerHeight
    this.canvas.width = Math.round(this.vw * this.dpr)
    this.canvas.height = Math.round(this.vh * this.dpr)
    this.canvas.style.width = `${this.vw}px`
    this.canvas.style.height = `${this.vh}px`
    if (this.reduced) {
      this.camTarget = this.camFor(this.section)
      this.cam = { ...this.camTarget }
    }
    this.render()
  }

  render() {
    const ctx = this.ctx
    const p = this.p
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.vw, this.vh)

    const shx = this.shake > 0.01 ? (Math.random() - 0.5) * this.shake : 0
    const shy = this.shake > 0.01 ? (Math.random() - 0.5) * this.shake : 0

    ctx.save()
    ctx.translate(this.vw / 2 + shx, this.vh / 2 + shy)
    ctx.scale(this.cam.s, this.cam.s)
    ctx.translate(-this.cam.x, -this.cam.y)

    this.drawPlateSheet(ctx)
    this.drawStrokes(ctx, p)
    this.drawWaves(ctx)
    this.drawWash(ctx, p)
    this.drawSeal(ctx, p)
    ctx.restore()
  }

  private drawPlateSheet(ctx: CanvasRenderingContext2D) {
    const { w, h } = PLATE
    // 桌面上的投影（多层柔化矩形）
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = `rgba(30,24,15,${0.045 / i})`
      ctx.fillRect(-14 - i * 8, -10 + i * 7, w + 28 + i * 16, h + 24 + i * 14)
    }
    // 纸
    ctx.fillStyle = '#F7F2E4'
    ctx.fillRect(0, 0, w, h)
    // 边框
    ctx.strokeStyle = 'rgba(38,34,28,0.75)'
    ctx.lineWidth = 1.6
    ctx.strokeRect(6, 6, w - 12, h - 12)
    // 四角规矩线（套准标记）
    ctx.strokeStyle = 'rgba(38,34,28,0.5)'
    ctx.lineWidth = 1
    const reg = (x: number, y: number) => {
      ctx.beginPath()
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x + 6, y)
      ctx.moveTo(x, y - 6)
      ctx.lineTo(x, y + 6)
      ctx.stroke()
    }
    reg(26, 26)
    reg(w - 26, 26)
    reg(26, h - 26)
    reg(w - 26, h - 26)
    // 版号 + 朱红规矩线（套准标记，全版唯一的暖色锚点之一）
    ctx.fillStyle = 'rgba(38,34,28,0.55)'
    ctx.font = '500 15px "EB Garamond", Georgia, serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`STATES OF THE PLATE · Z.CODE · No.${(this.seed % 9000) + 1000}`, 30, h - 30)
    ctx.strokeStyle = 'rgba(178,52,39,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(30, h - 22)
    ctx.lineTo(148, h - 22)
    ctx.stroke()
  }

  private drawStrokes(ctx: CanvasRenderingContext2D, p: number) {
    const washT = this.washT()
    const washActive = washT > 0 && washT < 1
    const yw = PLATE.h + 80 - washT * (PLATE.h + 240)
    const secretFade = this.secret ? clamp((this.time - this.secretT) / 1.4) : 0
    const time = this.time

    // 按（墨量档 × 宽度档）分桶，合并为少量 Path2D 批量描线
    const buckets = new Map<number, Path2D>()
    const key = (a: number, w: number) => (a << 3) | w

    const strokes = this.art.strokes
    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i]
      const fade = LAYER_FADE(s.layer, p) * (s.layer === 9 ? secretFade : 1)
      if (fade <= 0.012) continue

      let r = BASE_R(s.layer, p) + s.boost
      let x = s.tx + s.dx * (1 - easeOutCubic(clamp(r)))
      let y = s.ty + s.dy * (1 - easeOutCubic(clamp(r)))

      // 混沌呼吸：未定形的笔画是活的，秩序是安静的
      if (!this.reduced && r < 0.5) {
        const amp = (1 - r / 0.5) * 2.3
        x += Math.sin(time * 0.7 + s.phase) * amp
        y += Math.cos(time * 0.53 + s.phase * 1.7) * amp
      }

      // 洗版：墨潮未过之处暂散，已过之处加深
      let dissolve = 0
      if (washActive) {
        const dy = s.ty - yw
        if (dy > 0 && dy < 150) {
          dissolve = 1 - dy / 150
          r -= 0.55 * dissolve
          if (!this.reduced) x += Math.sin(s.tx * 0.03 + time * 2.2) * 7 * dissolve
        } else if (dy <= 0) {
          r += 0.16
        }
      }

      x += s.ox
      y += s.oy

      let alpha = s.ink * fade * (0.72 + 0.28 * clamp(r)) * (1 - 0.4 * dissolve)

      // 落刀压痕：冲击后短促的墨色加深（随冲击波衰减）
      for (const w of this.waves) {
        if (w.t > 0.35) continue
        const d = Math.hypot(s.tx - w.x, s.ty - w.y)
        if (d < 260) alpha += (1 - w.t / 0.35) * (1 - d / 260) * 0.32
      }

      if (alpha <= 0.012) continue
      if (alpha > 1) alpha = 1

      const half = s.len / 2
      const ca = Math.cos(s.ang) * half
      const sa = Math.sin(s.ang) * half
      const aQ = Math.min(7, Math.round(alpha * 9))
      const wQ = Math.min(7, Math.round(s.w))
      const k = key(aQ, wQ)
      let path = buckets.get(k)
      if (!path) {
        path = new Path2D()
        buckets.set(k, path)
      }
      path.moveTo(x - ca, y - sa)
      path.lineTo(x + ca, y + sa)
    }

    ctx.lineCap = 'round'
    for (const [k, path] of buckets) {
      const aQ = k >> 3
      const wQ = k & 7
      ctx.globalAlpha = ((aQ + 0.5) / 9) * 0.92
      ctx.strokeStyle = '#26221C'
      ctx.lineWidth = wQ + 0.35
      ctx.stroke(path)
    }
    ctx.globalAlpha = 1
  }

  private drawWaves(ctx: CanvasRenderingContext2D) {
    for (const w of this.waves) {
      const t = w.t / 0.9
      // 主环
      ctx.globalAlpha = (1 - t) * 0.4
      ctx.strokeStyle = '#26221C'
      ctx.lineWidth = 2.2 / this.cam.s
      ctx.beginPath()
      ctx.arc(w.x, w.y, 14 + t * 250, 0, Math.PI * 2)
      ctx.stroke()
      // 内回声环
      ctx.globalAlpha = (1 - t) * 0.22
      ctx.lineWidth = 1.1 / this.cam.s
      ctx.beginPath()
      ctx.arc(w.x, w.y, 8 + t * 130, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private drawWash(ctx: CanvasRenderingContext2D, p: number) {
    const t = this.washT()
    if (t <= 0 || t >= 1) return
    const yw = PLATE.h + 80 - t * (PLATE.h + 240)
    // 墨潮渐变带
    const g = ctx.createLinearGradient(0, yw, 0, yw + 230)
    g.addColorStop(0, 'rgba(38,34,28,0.1)')
    g.addColorStop(1, 'rgba(38,34,28,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, yw, PLATE.w, 230)
    // 潮头（双线波纹）
    const phase = this.reduced ? 0 : this.time * 2.4
    const edge = (offset: number, alpha: number, lw: number) => {
      ctx.strokeStyle = `rgba(38,34,28,${alpha})`
      ctx.lineWidth = lw
      ctx.beginPath()
      for (let x = 0; x <= PLATE.w; x += 22) {
        const yy = yw + Math.sin(x * 0.028 + phase) * 5 + offset
        if (x === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }
    edge(0, 0.5, 1.6)
    edge(7, 0.24, 1.1)
    void p
  }

  private drawSeal(ctx: CanvasRenderingContext2D, p: number) {
    const appear = smoothstep(this.anchors.seal, this.anchors.seal + 0.03, p)
    if (appear <= 0.01) return
    const sp = this.stampT < 0 ? 0 : clamp((this.time - this.stampT) / 0.6)
    const scale = this.reduced ? 1 : 1 + (1 - easeOutBack(sp)) * 1.4
    const alpha = appear * (this.reduced ? 1 : clamp(sp * 2.2))

    ctx.save()
    ctx.translate(905, 1432)
    ctx.rotate(-0.05)
    ctx.scale(scale, scale)
    ctx.globalAlpha = alpha

    const S = 96
    ctx.fillStyle = '#B23427'
    ctx.fillRect(-S / 2, -S / 2, S, S)
    // 印泥不匀（纸色噪点）
    for (const d of this.sealDots) {
      ctx.globalAlpha = alpha * d.a
      ctx.fillStyle = '#F7F2E4'
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = alpha
    // 内框
    ctx.strokeStyle = '#F7F2E4'
    ctx.lineWidth = 2.6
    ctx.strokeRect(-S / 2 + 7, -S / 2 + 7, S - 14, S - 14)
    // 「手泽」
    ctx.fillStyle = '#F7F2E4'
    ctx.font = '900 37px "Noto Serif SC", "Songti SC", SimSun, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('手', -1, -15)
    ctx.fillText('泽', 1, 26)
    ctx.restore()
  }

  get strikeCount() {
    return this.strikes
  }
}
