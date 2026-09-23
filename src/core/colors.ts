/** 每个字母一个稳定颜色（黄金角取色相），? 为深灰 */
export function charColor(ch: string): string {
  if (ch === '?') return '#2e333d'
  const idx = ch.charCodeAt(0) - 65
  const hue = (idx * 137.5) % 360
  return `hsl(${hue}, 62%, 52%)`
}
