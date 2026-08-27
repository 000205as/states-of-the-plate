/**
 * 单文件打包：把 dist 的 JS/CSS/字体全部内联进一个 index.html ——
 * 成品 = 一个 .html 文件，双击即玩，无需解压、无文件夹结构、无网络。
 * 用法：npm run build 之后执行 node scripts/single-file.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const OUT_DIR = 'dist-single'

const htmlPath = join(DIST, 'index.html')
let html = readFileSync(htmlPath, 'utf8')

// 1) 内联 CSS，并把字体文件替换为 base64 data URI
const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)
if (!cssMatch) throw new Error('找不到 stylesheet 链接')
let css = readFileSync(join(DIST, cssMatch[1]), 'utf8')
for (const file of readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.woff2'))) {
  const b64 = readFileSync(join(DIST, 'assets', file)).toString('base64')
  css = css.replaceAll(`url(./${file})`, `url(data:font/woff2;base64,${b64})`)
}
html = html.replace(cssMatch[0], `<style>${css}</style>`)

// 2) 内联 JS 模块
const jsMatch = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)
if (!jsMatch) throw new Error('找不到 module 脚本')
const js = readFileSync(join(DIST, jsMatch[1]), 'utf8')
html = html.replace(jsMatch[0], `<script type="module">${js}</script>`)

mkdirSync(OUT_DIR, { recursive: true })
const out = join(OUT_DIR, '版次-States-of-the-Plate.html')
writeFileSync(out, html)
console.log(`单文件成品：${out}（${(html.length / 1024).toFixed(0)} KB）`)