import type { FilledCell, RepeatResult, RepeatSuccess } from './types'

/**
 * 在全部整除尺寸 (h | R, w | C) 中寻找可唯一重建的最小重复单元。
 *
 * 候选 (h, w) 合法当且仅当：
 *  - 同一模位 (r mod h, c mod w) 上的所有已知字符一致；
 *  - 每个模位至少出现一次已知字符（否则该模位颜色无法确定，不允许猜测）。
 *
 * 在所有合法候选中按 面积 → 高度 → 宽度 升序取最优。
 * 没有任何合法候选时返回 NO_UNIQUE_REPEAT，绝不猜测缺失颜色。
 */
export function findMinRepeat(rows: string[]): RepeatResult {
  const R = rows.length
  const C = rows[0].length

  const valid: RepeatSuccess[] = []
  let candidatesTried = 0
  let conflictCount = 0
  let holeCount = 0
  const conflictExamples: string[] = []
  const holeExamples: string[] = []

  for (let h = 1; h <= R; h++) {
    if (R % h !== 0) continue
    for (let w = 1; w <= C; w++) {
      if (C % w !== 0) continue
      candidatesTried++

      // unit[i][j] === '' 表示该模位尚未观测到已知字符
      const unit: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(''))
      let conflict: { ur: number; uc: number; a: string; b: string } | null = null

      outer: for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const ch = rows[r][c]
          if (ch === '?') continue
          const ur = r % h
          const uc = c % w
          if (unit[ur][uc] === '') {
            unit[ur][uc] = ch
          } else if (unit[ur][uc] !== ch) {
            conflict = { ur, uc, a: unit[ur][uc], b: ch }
            break outer
          }
        }
      }
      if (conflict) {
        conflictCount++
        if (conflictExamples.length < 3) {
          conflictExamples.push(
            `${h}×${w}：模位 (${conflict.ur},${conflict.uc}) 同时出现 ${conflict.a} 与 ${conflict.b}`,
          )
        }
        continue
      }

      let hole: { ur: number; uc: number } | null = null
      for (let i = 0; i < h && !hole; i++) {
        for (let j = 0; j < w; j++) {
          if (unit[i][j] === '') {
            hole = { ur: i, uc: j }
            break
          }
        }
      }
      if (hole) {
        holeCount++
        if (holeExamples.length < 3) {
          holeExamples.push(`${h}×${w}：模位 (${hole.ur},${hole.uc}) 从未出现已知字符`)
        }
        continue
      }

      valid.push(buildSuccess(rows, h, w, unit))
    }
  }

  if (valid.length === 0) {
    const parts: string[] = []
    if (conflictCount > 0) {
      parts.push(`${conflictCount} 个候选因模位字符冲突被否决（${conflictExamples.join('；')}）`)
    }
    if (holeCount > 0) {
      parts.push(`${holeCount} 个候选存在从未被观测的模位（${holeExamples.join('；')}）`)
    }
    return {
      status: 'NO_UNIQUE_REPEAT',
      reason: `共检查 ${candidatesTried} 个整除尺寸候选，无一能唯一重建。${parts.join('。')}`,
      candidatesTried,
      conflictCount,
      holeCount,
    }
  }

  valid.sort(
    (a, b) =>
      a.unitHeight * a.unitWidth - b.unitHeight * b.unitWidth ||
      a.unitHeight - b.unitHeight ||
      a.unitWidth - b.unitWidth,
  )
  return valid[0]
}

function buildSuccess(rows: string[], h: number, w: number, unit: string[][]): RepeatSuccess {
  const R = rows.length
  const C = rows[0].length
  const completedRows: string[] = []
  const filled: FilledCell[] = []
  for (let r = 0; r < R; r++) {
    let line = ''
    for (let c = 0; c < C; c++) {
      const ch = unit[r % h][c % w]
      line += ch
      if (rows[r][c] === '?') {
        filled.push({ row: r, col: c, char: ch, srcRow: r % h, srcCol: c % w })
      }
    }
    completedRows.push(line)
  }
  return {
    status: 'OK',
    unitHeight: h,
    unitWidth: w,
    unit: unit.map((row) => row.join('')),
    completedRows,
    filled,
  }
}
