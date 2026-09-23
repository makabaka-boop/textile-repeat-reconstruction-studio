import { describe, expect, it } from 'vitest'
import { MAX_CELLS, validateRows } from '../src/core/validate'

const ok2x2 = { rows: ['AB', 'BA'] }

describe('结构校验', () => {
  it('接受 { rows } 对象与裸数组两种形式', () => {
    expect(validateRows(ok2x2)).toEqual({ ok: true, rows: ['AB', 'BA'] })
    expect(validateRows(['AB', 'BA'])).toEqual({ ok: true, rows: ['AB', 'BA'] })
  })

  it('拒绝非对象 / 缺少 rows', () => {
    expect(validateRows(null).ok).toBe(false)
    expect(validateRows(42).ok).toBe(false)
    expect(validateRows({ data: [] }).ok).toBe(false)
    expect(validateRows({ rows: 'AB' }).ok).toBe(false)
  })

  it('行数必须在 2..300', () => {
    expect(validateRows({ rows: ['AB'] }).ok).toBe(false)
    const tooMany = { rows: Array(301).fill('AB') }
    expect(validateRows(tooMany).ok).toBe(false)
    const atMax = { rows: Array(300).fill('AB') }
    expect(validateRows(atMax).ok).toBe(true)
  })

  it('每行长度必须在 2..300', () => {
    expect(validateRows({ rows: ['A', 'AB'] }).ok).toBe(false)
    expect(validateRows({ rows: ['A'.repeat(301), 'A'.repeat(301)] }).ok).toBe(false)
    expect(validateRows({ rows: ['A'.repeat(300), 'A'.repeat(300)] }).ok).toBe(true) // 长度 300 为上限，600 格未超总量
  })

  it('所有行必须等长', () => {
    const res = validateRows({ rows: ['ABC', 'AB'] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.join()).toContain('不一致')
  })

  it('仅允许 A-Z 与 ?', () => {
    expect(validateRows({ rows: ['Ab', 'BA'] }).ok).toBe(false)
    expect(validateRows({ rows: ['A1', 'BA'] }).ok).toBe(false)
    expect(validateRows({ rows: ['A ', 'BA'] }).ok).toBe(false)
    expect(validateRows({ rows: ['A?', '?B'] }).ok).toBe(true)
  })

  it('总格点不得超过 50000', () => {
    // 300 × 200 = 60000 > 50000
    const tooBig = { rows: Array(300).fill('A'.repeat(200)) }
    const res = validateRows(tooBig)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.join()).toContain(String(MAX_CELLS))
    // 250 × 200 = 50000 恰好达标
    const atCap = { rows: Array(250).fill('A'.repeat(200)) }
    expect(validateRows(atCap).ok).toBe(true)
  })

  it('非字符串行被拒绝', () => {
    expect(validateRows({ rows: ['AB', 12] }).ok).toBe(false)
  })

  it('一次报告多个结构错误', () => {
    const res = validateRows({ rows: ['A', 'ABCd'] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.length).toBeGreaterThanOrEqual(2)
  })
})
