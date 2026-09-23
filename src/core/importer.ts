import { validateRows } from './validate'

export interface ImportOutcome {
  /** 导入成功时为新的样片；失败时保持传入的旧样片不变 */
  rows: string[]
  /** 非空表示导入被整份拒绝 */
  errors: string[]
}

/**
 * 解析并校验一段导入文本。
 * 结构错误（含 JSON 语法错误）时整份拒绝，rows 原样返回上次合法样片。
 */
export function applyImport(currentRows: string[], text: string): ImportOutcome {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { rows: currentRows, errors: [`JSON 解析失败：${e instanceof Error ? e.message : String(e)}`] }
  }
  const v = validateRows(parsed)
  if (!v.ok) {
    return { rows: currentRows, errors: v.errors }
  }
  return { rows: v.rows, errors: [] }
}
