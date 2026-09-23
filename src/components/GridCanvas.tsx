import { useEffect, useRef } from 'react';
import { cellStyle } from '../lib/colors';

export interface GridCanvasProps {
  rows: string[];
  /** 高亮的格坐标集合（键 `${row},${col}`），如被补全的格 */
  marked?: ReadonlySet<string>;
  /** 标记格的描边颜色 */
  markColor?: string;
  selected?: { row: number; col: number } | null;
  cellSize?: number;
  /** 点击格子回调 */
  onCellClick?: (row: number, col: number) => void;
  /** 是否可交互（聚焦后可键盘改色） */
  interactive?: boolean;
}

/**
 * 基于 <canvas> 的网格渲染。样片最多 50000 格，DOM 表格会明显卡顿。
 */
export function GridCanvas({
  rows,
  marked,
  markColor = '#ffb020',
  selected,
  cellSize,
  onCellClick,
  interactive = false,
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const size =
    cellSize ?? Math.max(6, Math.min(28, Math.floor(720 / Math.max(width, height))));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = width * size;
    const cssH = height * size;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const showGlyph = size >= 14;
    ctx.font = `600 ${Math.max(8, Math.floor(size * 0.58))}px ui-monospace, monospace`;

    for (let r = 0; r < height; r++) {
      const line = rows[r];
      for (let c = 0; c < width; c++) {
        const ch = line[c];
        const x = c * size;
        const y = r * size;
        const style = cellStyle(ch);
        ctx.fillStyle = style.fill;
        ctx.fillRect(x + 0.5, y + 0.5, size - 1, size - 1);
        if (showGlyph && ch !== '?') {
          ctx.fillStyle = style.text;
          ctx.fillText(ch, x + size / 2, y + size / 2 + 0.5);
        }
        const key = `${r},${c}`;
        if (marked?.has(key)) {
          ctx.strokeStyle = markColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
        }
        if (selected && selected.row === r && selected.col === c) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
        }
      }
    }
  }, [rows, marked, markColor, selected, size, width, height]);

  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!onCellClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * width);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * height);
    if (row >= 0 && row < height && col >= 0 && col < width) {
      onCellClick(row, col);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'application' : undefined}
      aria-label={interactive ? '可编辑样片画布' : '只读网格画布'}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        outline: 'none',
        imageRendering: 'pixelated',
        borderRadius: 4,
      }}
    />
  );
}
