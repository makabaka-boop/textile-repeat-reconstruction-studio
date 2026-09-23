import { useCallback, useEffect, useRef, useState } from 'react'
import { charColor } from '../core/colors'

interface Props {
  rows: string[]
  /** 单格编辑回调：任何一次调用都会使旧结论立即失效（由上层重算保证） */
  onEdit: (r: number, c: number, ch: string) => void
}

const PALETTE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?'.split('')

/** 可编辑样片画布：点击选格，键盘 A-Z / ? 或下方色板改写该格 */
export default function GridEditor({ rows, onEdit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null)
  const R = rows.length
  const C = rows[0].length

  // 样片尺寸变化后丢弃越界选区
  useEffect(() => {
    setSel((prev) => (prev && prev.r < R && prev.c < C ? prev : null))
  }, [R, C])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cell = Math.max(3, Math.min(30, Math.floor(560 / Math.max(R, C))))
    canvas.width = C * cell
    canvas.height = R * cell
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const ch = rows[r][c]
        ctx.fillStyle = charColor(ch)
        ctx.fillRect(c * cell, r * cell, cell, cell)
        if (cell >= 4) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'
          ctx.lineWidth = 1
          ctx.strokeRect(c * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1)
        }
        if (cell >= 12) {
          ctx.fillStyle = ch === '?' ? '#8a93a5' : '#ffffff'
          ctx.font = `${Math.floor(cell * 0.55)}px ui-monospace, monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(ch, c * cell + cell / 2, r * cell + cell / 2 + 1)
        }
      }
    }
    if (sel) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeRect(sel.c * cell + 1, sel.r * cell + 1, cell - 2, cell - 2)
    }
  }, [rows, sel, R, C])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const c = Math.floor(((e.clientX - rect.left) / rect.width) * C)
      const r = Math.floor(((e.clientY - rect.top) / rect.height) * R)
      if (r >= 0 && r < R && c >= 0 && c < C) setSel({ r, c })
      canvas.closest<HTMLElement>('.grid-editor')?.focus()
    },
    [R, C],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!sel) return
      if (/^[a-zA-Z]$/.test(e.key)) {
        onEdit(sel.r, sel.c, e.key.toUpperCase())
        e.preventDefault()
      } else if (e.key === '?' || e.key === 'Delete' || e.key === 'Backspace') {
        onEdit(sel.r, sel.c, '?')
        e.preventDefault()
      }
    },
    [sel, onEdit],
  )

  return (
    <div className="grid-editor" tabIndex={0} onKeyDown={handleKeyDown}>
      <canvas ref={canvasRef} className="pattern-canvas editable" onClick={handleClick} />
      <p className="hint">
        {sel
          ? `已选格：第 ${sel.r} 行、第 ${sel.c} 列，当前字符 ${rows[sel.r][sel.c]}。按 A-Z 或 ? 改写，结论随编辑即时重算。`
          : '点击画布选中一格，然后按 A-Z 或 ? 改写；任何单格编辑都会立即撤销并重算旧结论。'}
      </p>
      <div className="palette">
        {PALETTE.map((ch) => (
          <button
            key={ch}
            type="button"
            disabled={!sel}
            style={{ background: charColor(ch) }}
            onClick={() => sel && onEdit(sel.r, sel.c, ch)}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  )
}
