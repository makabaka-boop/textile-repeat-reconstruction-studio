import { useEffect, useRef } from 'react'
import { charColor } from '../core/colors'

interface Props {
  rows: string[]
  /** 需要打标记的格子（"r,c" 集合），用于标出被补全的格点 */
  marked?: Set<string>
  /** 画布最长边像素 */
  maxSide?: number
  title?: string
}

/** 只读纹样画布：按字符着色，marked 格子画白色圆点标记 */
export default function PatternCanvas({ rows, marked, maxSide = 560, title }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const R = rows.length
    const C = rows[0].length
    const cell = Math.max(2, Math.min(28, Math.floor(maxSide / Math.max(R, C))))
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
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'
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
        if (marked?.has(`${r},${c}`)) {
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.beginPath()
          ctx.arc(c * cell + cell * 0.78, r * cell + cell * 0.22, Math.max(1.2, cell * 0.14), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }, [rows, marked, maxSide])

  return <canvas ref={ref} className="pattern-canvas" title={title} />
}
