/**
 * 纯 API 部署工具：无 git 依赖（直连 github.com 被阻断时仍可工作）。
 * - 仓库根 = 源码（跳过 node_modules/.shots/dist-single）
 * - dist/ 构建产物 → docs/（供 GitHub Pages 以 /docs 发布）
 * 用法：本机先 npm run build，然后 node scripts/upload.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const REPO = '000205as/states-of-the-plate'
const BRANCH = 'main'
const ROOT = process.cwd()
const SKIP = new Set(['node_modules', '.shots', 'dist-single', '.git', '.verify'])

const gh = (args, inputFile) => {
  const base = ['api', ...args]
  const res = inputFile
    ? spawnSync('gh', [...base, '--input', inputFile], { encoding: 'utf8' })
    : spawnSync('gh', base, { encoding: 'utf8' })
  return res
}

function listFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      out.push(...listFiles(join(dir, entry.name)))
    } else {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

let files = listFiles(ROOT)
  .map((f) => relative(ROOT, f).replaceAll('\\', '/'))
  .map((f) => (f.startsWith('dist/') ? f.replace('dist/', 'docs/') : f))
  .sort()
// 阻止 Jekyll 处理 docs 产物
writeFileSync(join(ROOT, 'dist', '.nojekyll'), '')
files.push('docs/.nojekyll')
files = [...new Set(files)].sort()

const tmpDir = mkdtempSync(join(tmpdir(), 'gh-upload-'))
let ok = 0
let skipped = 0
let failed = 0

for (const remote of files) {
  const local = remote.startsWith('docs/') ? join(ROOT, 'dist', remote.slice(5)) : join(ROOT, remote)
  const b64 = readFileSync(local).toString('base64')

  // 已存在则需带旧 sha 走更新模式；404 视为新建继续
  const exist = gh([`repos/${REPO}/contents/${encodePath(remote)}`, '-q', '.sha'])
  let sha = null
  if (exist.status === 0 && exist.stdout && exist.stdout.trim() !== 'null') {
    sha = exist.stdout.trim()
  }

  const body = JSON.stringify({ message: `deploy: ${remote}`, content: b64, branch: BRANCH, ...(sha ? { sha } : {}) })
  const bodyFile = join(tmpDir, 'body.json')
  writeFileSync(bodyFile, body)

  const put = gh([`repos/${REPO}/contents/${encodePath(remote)}`, '-X', 'PUT'], bodyFile)
  if (put.status === 0) {
    ok++
    console.log(`✓ ${remote}${sha ? ' (updated)' : ''}`)
  } else {
    failed++
    console.log(`✗ ${remote}: ${(put.stderr || '').slice(0, 200)}`)
  }
}

rmSync(tmpDir, { recursive: true, force: true })
console.log(`\n完成：${ok} 上传 / ${skipped} 跳过 / ${failed} 失败`)

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/')
}