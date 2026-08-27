/** 文案 —— 全站唯一的文本来源 */

export const SECTIONS = [
  { key: 'hero', han: '〇', name: '素版', latin: 'STATE 0 · THE BLANK PLATE' },
  { key: 'draft', han: '壹', name: '起稿', latin: 'STATE I · DRAFT' },
  { key: 'carve', han: '贰', name: '落刀', latin: 'STATE II · CARVE' },
  { key: 'wash', han: '叁', name: '洗版', latin: 'STATE III · WASH' },
  { key: 'done', han: '跋', name: '成版', latin: 'COLOPHON · THE PRINT' },
]

export const HERO = {
  eyebrow: 'ZCODE · 创意前端 · 作品一号',
  latin: 'STATES OF THE PLATE',
  line: '我不相信一次做对，我相信一遍遍地逼近。',
  sub: '这是一张正在被反复重刻的铜版。向下滚动，推进它的版次；在纸面任意处点一下——那一刀，会留在最后的成品里。',
  hint: '试试在纸上落一刀',
  cue: 'SCROLL · 见它成形',
}

export const CH1 = {
  eyebrow: 'STATE I · 起稿',
  num: '壹',
  title: '从约束开始',
  p1: '动笔之前，我先定规矩：三个颜色、一套字号、一条缓动曲线。约束不是对自由的削减——它是刻刀的握法。握法对了，力气才落在刀尖上。',
  p2: '所以这张版上只有三种东西：纸、墨，和一点朱砂。所有层次都从这三色里长出来。少，是为了让每一笔都被看见。',
  marginal: 'Tokens 先行——这份页面里没有一个硬编码的颜色。',
}

export const CH2 = {
  eyebrow: 'STATE II · 落刀',
  num: '贰',
  title: '三件事，刻进版里',
  items: [
    { no: 'I', t: '排版是骨架', d: '字号即层级，留白即呼吸。看一页的字距，就知道作者有没有耳朵。' },
    { no: 'II', t: '动效是编舞', d: '每一段动效都要有起、承、转、合。答不出「为什么动」的动画，我不做。' },
    { no: 'III', t: '工程是纸基', d: '再好的墨，印在烂纸上都会洇。可维护的代码，是作品耐印的原因。' },
  ],
  marginal: '这一版的刀法，比上一版稳。',
}

export const CH3 = {
  eyebrow: 'STATE III · 洗版',
  num: '叁',
  title: '把批评印进作品',
  p1: '版是我的，刀有时在你手里。这个页面听你的：你落的每一刀它都记着；你滚过这一段，它就把整版洗一遍重印——像所有认真的协作一样，先推翻，再逼近。',
  p2: '往回滚，墨会退回去；往前滚，版会深下去。至少在这张纸上，遗憾是可以回滚的。',
  marginal: '洗版中，请留意墨色。版上还藏着些东西，刀多的人才找得到。',
}

export function colophonLines(n: { strikes: number; washes: number; secret: boolean }): string[] {
  const lines = [
    '此版成于今夜。纸一张，墨三色，版一方。',
    n.strikes > 0
      ? `君落刀凡 <em>${n.strikes}</em> 刀，皆已入版。`
      : '君未落一刀。愿意先看、不急改——这也是一种对作品的信任。',
  ]
  if (n.washes > 0) lines.push(`洗版 <em>${n.washes}</em> 遍，墨色方定。`)
  if (n.secret) lines.push('另：版上暗记已现。找得仔细的人，做得出好版。')
  lines.push('此为独幅。点「重刻此版」，山形月位，皆会不同。')
  return lines
}

export const FOOTER = 'ZCode · React + Canvas 手刻 · 本页没有一行硬编码的颜色'
