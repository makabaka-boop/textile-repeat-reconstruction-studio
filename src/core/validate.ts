export const MIN_DIM = 2
export const MAX_DIM = 300
export const MAX_CELLS = 50000

export interface ValidationOk {
  ok: true
  rows: string[]
}

export interface ValidationErr {
  ok: false
  errors: string[]
}

export type ValidationResult = ValidationOk | ValidationErr

const ROW_RE = /^[A-Z?]+$/

/**
 * 校验导入数据。接受 { rows: [...] } 或直接的 rows 数组。
 * 任何结构错误都会收集到 errors 中，调用方应整份拒绝并保留上次合法样片。
 */
export function validateRows(input: unknown): ValidationResult {
  const errors: string[] = []

  let rows: unknown
  if (Array.isArray(input)) {
    rows = input
  } else if (typeof input === 'object' && input !== null && 'rows' in input) {
    rows = (input as { rows: unknown }).rows
  } else {
    return { ok: false, errors: ['数据必须是 rows 数组，或包含 rows 数组的对象'] }
  }

  if (!Array.isArray(rows)) {
    return { ok: false, errors: ['rows 必须是数组'] }
  }
  if (rows.length < MIN_DIM || rows.length > MAX_DIM) {
    errors.push(`行数必须介于 ${MIN_DIM} 与 ${MAX_DIM} 之间，实际为 ${rows.length}`)
  }

  let width = -1
  let widthConsistent = true
  rows.forEach((row, i) => {
    const label = `第 ${i + 1} 行`
    if (typeof row !== 'string') {
      errors.push(`${label}不是字符串`)
      return
    }
    if (row.length < MIN_DIM || row.length > MAX_DIM) {
      errors.push(`${label}长度必须介于 ${MIN_DIM} 与 ${MAX_DIM} 之间，实际为 ${row.length}`)
    }
    if (width === -1) {
      width = row.length
    } else if (row.length !== width) {
      widthConsistent = false
      errors.push(`${label}长度 ${row.length} 与首行长度 ${width} 不一致`)
    }
    const bad = row.split('').find((ch) => !ROW_RE.test(ch))
    if (bad !== undefined) {
      errors.push(`${label}包含非法字符 '${bad}'（仅允许 A-Z 与 ?）`)
    }
  })

  if (widthConsistent && width > 0 && rows.length * width > MAX_CELLS) {
    errors.push(`总格点 ${rows.length}×${width}=${rows.length * width} 超过上限 ${MAX_CELLS}`)
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows: rows as string[] }
}
