import { describe, expect, it } from 'vitest'
import { findMinRepeat } from '../src/core/repeat'
import type { RepeatSuccess } from '../src/core/types'

/** 独立实现的暴力枚举：逐一检查所有整除尺寸，作为被测实现的对拍参照 */
function bruteForceBest(rows: string[]): { h: number; w: number } | null {
  const R = rows.length
  const C = rows[0].length
  const ok: { h: number; w: number }[] = []
  for (let h = 1; h <= R; h++) {
    if (R % h !== 0) continue
    for (let w = 1; w <= C; w++) {
      if (C % w !== 0) continue
      const seen = new Map<string, string>()
      let bad = false
      for (let r = 0; r < R && !bad; r++) {
        for (let c = 0; c < C && !bad; c++) {
          const ch = rows[r][c]
          if (ch === '?') continue
          const key = `${r % h},${c % w}`
          const prev = seen.get(key)
          if (prev === undefined) seen.set(key, ch)
          else if (prev !== ch) bad = true
        }
      }
      // 每个模位至少被观测一次：观测数必须等于 h*w
      if (!bad && seen.size === h * w) ok.push({ h, w })
    }
  }
  ok.sort((a, b) => a.h * a.w - b.h * b.w || a.h - b.h || a.w - b.w)
  return ok[0] ?? null
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 随机小样片：一半概率由某个真实周期单元加噪生成，一半纯随机 */
function randomRows(rng: () => number, R: number, C: number): string[] {
  const fromUnit = rng() < 0.5
  const h = 1 + Math.floor(rng() * R)
  const w = 1 + Math.floor(rng() * C)
  const unit: string[] = []
  for (let i = 0; i < h; i++) {
    let s = ''
    for (let j = 0; j < w; j++) s += 'ABC'[Math.floor(rng() * 3)]
    unit.push(s)
  }
  const rows: string[] = []
  for (let r = 0; r < R; r++) {
    let s = ''
    for (let c = 0; c < C; c++) {
      if (rng() < 0.3) {
        s += '?'
      } else if (fromUnit) {
        s += unit[r % h][c % w]
      } else {
        s += 'ABC'[Math.floor(rng() * 3)]
      }
    }
    rows.push(s)
  }
  return rows
}

function expectConsistent(rows: string[], res: RepeatSuccess) {
  const R = rows.length
  const C = rows[0].length
  expect(res.unit.length).toBe(res.unitHeight)
  for (const line of res.unit) expect(line.length).toBe(res.unitWidth)
  for (let r = 0; r < R; r++) {
    expect(res.completedRows[r].length).toBe(C)
    for (let c = 0; c < C; c++) {
      // 补全结果与重复单元自洽
      expect(res.completedRows[r][c]).toBe(res.unit[r % res.unitHeight][c % res.unitWidth])
      // 已知字符不得被改动
      if (rows[r][c] !== '?') expect(res.completedRows[r][c]).toBe(rows[r][c])
    }
  }
  // 被补格清单恰好覆盖所有 ?
  const qCount = rows.join('').split('').filter((ch) => ch === '?').length
  expect(res.filled.length).toBe(qCount)
  for (const f of res.filled) {
    expect(rows[f.row][f.col]).toBe('?')
    expect(f.char).toBe(res.unit[f.srcRow][f.srcCol])
    expect(f.row % res.unitHeight).toBe(f.srcRow)
    expect(f.col % res.unitWidth).toBe(f.srcCol)
  }
}

describe('小网格枚举所有整除尺寸（与暴力参照对拍）', () => {
  it('400 个随机小样片的最优候选一致', () => {
    const rng = mulberry32(20260923)
    for (let t = 0; t < 400; t++) {
      const R = 2 + Math.floor(rng() * 5) // 2..6
      const C = 2 + Math.floor(rng() * 5)
      const rows = randomRows(rng, R, C)
      const best = bruteForceBest(rows)
      const res = findMinRepeat(rows)
      if (!best) {
        expect(res.status).toBe('NO_UNIQUE_REPEAT')
      } else {
        expect(res.status).toBe('OK')
        if (res.status === 'OK') {
          expect([res.unitHeight, res.unitWidth]).toEqual([best.h, best.w])
          expectConsistent(rows, res)
        }
      }
    }
  })

  it('非整除周期不被采纳', () => {
    // 行方向真实周期为 2，但 2 不整除 3，只能取整个 3×2 样片
    const res = findMinRepeat(['AB', 'BA', 'AB'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([3, 2])
      expect(res.unit).toEqual(['AB', 'BA', 'AB'])
    }
  })
})

describe('全未知行', () => {
  it('整片未知：任何候选都存在未观测模位，判定 NO_UNIQUE_REPEAT', () => {
    const res = findMinRepeat(['???', '???', '???'])
    expect(res.status).toBe('NO_UNIQUE_REPEAT')
    if (res.status === 'NO_UNIQUE_REPEAT') {
      expect(res.holeCount).toBeGreaterThan(0)
      expect(res.conflictCount).toBe(0)
    }
  })

  it('整行未知但可由其余行唯一重建', () => {
    const res = findMinRepeat(['AB', '??'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([1, 2])
      expect(res.unit).toEqual(['AB'])
      expect(res.completedRows).toEqual(['AB', 'AB'])
      expect(res.filled).toEqual([
        { row: 1, col: 0, char: 'A', srcRow: 0, srcCol: 0 },
        { row: 1, col: 1, char: 'B', srcRow: 0, srcCol: 1 },
      ])
    }
  })

  it('仅剩一个已知格也可确定 1×1 单元（模位至少出现一次即合法）', () => {
    const res = findMinRepeat(['?B', '??'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([1, 1])
      expect(res.unit).toEqual(['B'])
      expect(res.completedRows).toEqual(['BB', 'BB'])
    }
  })
})

describe('冲突模位', () => {
  it('同一模位字符冲突且其余候选有未观测模位时不可重建', () => {
    // (1,1)：A/B 冲突；(1,2)：模位 (0,1) 处 B 与 A 冲突；
    // (2,1)：模位 (0,0) 处 A 与 B 冲突；(2,2)：? 所在模位从未被观测
    const res = findMinRepeat(['AB', '?A'])
    expect(res.status).toBe('NO_UNIQUE_REPEAT')
    if (res.status === 'NO_UNIQUE_REPEAT') {
      expect(res.conflictCount).toBeGreaterThan(0)
      expect(res.holeCount).toBeGreaterThan(0)
      expect(res.reason).toContain('冲突')
    }
  })

  it('已知字符永远不被结论覆盖', () => {
    const res = findMinRepeat(['AB', 'BA'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      // (1,1)、(1,2)、(2,1) 均冲突，只能取整片 2×2
      expect([res.unitHeight, res.unitWidth]).toEqual([2, 2])
      expect(res.completedRows).toEqual(['AB', 'BA'])
      expect(res.filled).toEqual([])
    }
  })
})

describe('工作台内置示例', () => {
  it('可修复示例：最小单元 2×3，? 全部可补', () => {
    const rows = ['ABC?BC', 'BCAB?A', '?BCABC', 'BCABCA']
    const res = findMinRepeat(rows)
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([2, 3])
      expect(res.unit).toEqual(['ABC', 'BCA'])
      expect(res.completedRows).toEqual(['ABCABC', 'BCABCA', 'ABCABC', 'BCABCA'])
      expect(res.filled).toEqual([
        { row: 0, col: 3, char: 'A', srcRow: 0, srcCol: 0 },
        { row: 1, col: 4, char: 'C', srcRow: 1, srcCol: 1 },
        { row: 2, col: 0, char: 'A', srcRow: 0, srcCol: 0 },
      ])
    }
  })

  it('不可恢复示例：报告冲突与未观测模位两类原因', () => {
    const res = findMinRepeat(['A??', '???', '??B'])
    expect(res.status).toBe('NO_UNIQUE_REPEAT')
    if (res.status === 'NO_UNIQUE_REPEAT') {
      expect(res.conflictCount).toBeGreaterThan(0)
      expect(res.holeCount).toBeGreaterThan(0)
    }
  })
})

describe('横纵周期并列', () => {
  it('(1,2) 与 (2,1) 面积相同，取高度更小者', () => {
    // (1,2)：unit [A,B]；(2,1)：unit [[A],[B]]；面积同为 2，(1,1) 因 A/B 冲突非法
    const res = findMinRepeat(['A?', '?B'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([1, 2])
      expect(res.unit).toEqual(['AB'])
      expect(res.completedRows).toEqual(['AB', 'AB'])
    }
  })

  it('仅纵向周期可行时取纵向单元', () => {
    const res = findMinRepeat(['AA', 'BB'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([2, 1])
      expect(res.unit).toEqual(['A', 'B'])
      expect(res.completedRows).toEqual(['AA', 'BB'])
    }
  })

  it('面积优先于维度：3 < 4 时取 1×3 而非 2×2', () => {
    const res = findMinRepeat(['ABCABC', 'ABCABC'])
    expect(res.status).toBe('OK')
    if (res.status === 'OK') {
      expect([res.unitHeight, res.unitWidth]).toEqual([1, 3])
      expect(res.unit).toEqual(['ABC'])
    }
  })
})
