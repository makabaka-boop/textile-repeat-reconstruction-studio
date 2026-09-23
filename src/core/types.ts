/** 一个被补全的未知格及其来源模位 */
export interface FilledCell {
  /** 样片中的行（0 起） */
  row: number
  /** 样片中的列（0 起） */
  col: number
  /** 补入的字符 */
  char: string
  /** 来源模位在重复单元中的行（0 起） */
  srcRow: number
  /** 来源模位在重复单元中的列（0 起） */
  srcCol: number
}

export interface RepeatSuccess {
  status: 'OK'
  unitHeight: number
  unitWidth: number
  /** 最小重复单元，unitHeight 个长度为 unitWidth 的字符串 */
  unit: string[]
  /** 补全后的样片（不含 ?） */
  completedRows: string[]
  /** 每个被补格及其来源模位 */
  filled: FilledCell[]
}

export interface RepeatFailure {
  status: 'NO_UNIQUE_REPEAT'
  /** 面向修复师的不可恢复原因说明 */
  reason: string
  /** 参与检查的整除尺寸候选总数 */
  candidatesTried: number
  /** 因同一模位出现冲突字符被否决的候选数 */
  conflictCount: number
  /** 因存在从未被观测的模位被否决的候选数 */
  holeCount: number
}

export type RepeatResult = RepeatSuccess | RepeatFailure
