/** 构建后处理：移除 index.html 中的 crossorigin 属性 —— 否则 file:// 双击打开时
 *  Chrome 会对 module 脚本强制 CORS，从 origin null 直接拦截整个页面。 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'dist/index.html'
const html = readFileSync(path, 'utf8')
const out = html.replaceAll(' crossorigin', '')
if (out !== html) {
  writeFileSync(path, out)
  console.log('postbuild: removed crossorigin attributes → file:// compatible')
} else {
  console.log('postbuild: nothing to strip')
}