/** A-Z 与未知格的确定性配色（纯本地计算，不引用任何外部资源） */

export interface CellStyle {
  fill: string;
  text: string;
}

export function cellStyle(ch: string): CellStyle {
  if (ch === '?') {
    return { fill: '#20242d', text: '#8a93a6' };
  }
  const code = ch.charCodeAt(0) - 65;
  // 均匀分布色相，固定饱和度与明度，保证相邻字母可区分
  const hue = Math.round((code * 360) / 26);
  return {
    fill: `hsl(${hue}, 62%, 58%)`,
    text: '#10131a',
  };
}
