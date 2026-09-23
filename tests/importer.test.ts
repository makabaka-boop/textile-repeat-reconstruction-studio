import { describe, expect, it } from 'vitest'
import { applyImport } from '../src/core/importer'

const LAST_GOOD = ['AB', 'BA']

describe('导入：结构错误整份拒绝并保留上次合法样片', () => {
  it('JSON 语法错误：保留旧样片', () => {
    const out = applyImport(LAST_GOOD, '{not json')
    expect(out.rows).toBe(LAST_GOOD)
    expect(out.errors.length).toBeGreaterThan(0)
  })

  it('结构错误：保留旧样片并报告全部错误', () => {
    const out = applyImport(LAST_GOOD, JSON.stringify({ rows: ['ABC', 'aB'] }))
    expect(out.rows).toBe(LAST_GOOD)
    expect(out.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('合法数据：替换为新样片并清空错误', () => {
    const out = applyImport(LAST_GOOD, JSON.stringify({ rows: ['AA', 'BB'] }))
    expect(out.errors).toEqual([])
    expect(out.rows).toEqual(['AA', 'BB'])
  })

  it('拒绝后再次导入合法数据仍可恢复', () => {
    const rejected = applyImport(LAST_GOOD, '{"rows":["AB"]}')
    expect(rejected.rows).toBe(LAST_GOOD)
    const recovered = applyImport(rejected.rows, '{"rows":["CC","DD"]}')
    expect(recovered.errors).toEqual([])
    expect(recovered.rows).toEqual(['CC', 'DD'])
  })
})
