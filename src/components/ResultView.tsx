import { useMemo } from 'react'
import type { RepeatResult, RepeatSuccess } from '../core/types'
import PatternCanvas from './PatternCanvas'

const FILLED_LIST_CAP = 500

interface Props {
  result: RepeatResult
}

/** 判定结果视图：唯一最小重复单元 + 补全样片 + 被补格来源模位，或 NO_UNIQUE_REPEAT 原因 */
export default function ResultView({ result }: Props) {
  if (result.status === 'NO_UNIQUE_REPEAT') {
    return (
      <div className="result-view">
        <h2>判定结果</h2>
        <div className="no-unique" role="alert">
          <strong>NO_UNIQUE_REPEAT</strong>
          <p>{result.reason}</p>
          <p>未对任何未知格做猜测性补色。</p>
        </div>
      </div>
    )
  }
  return <SuccessView result={result} />
}

function SuccessView({ result }: { result: RepeatSuccess }) {
  // 画布与下载 JSON 共用同一个 result 对象，保证两处输出一致
  const marked = useMemo(
    () => new Set(result.filled.map((f) => `${f.row},${f.col}`)),
    [result],
  )

  const download = () => {
    const payload = {
      status: result.status,
      unitHeight: result.unitHeight,
      unitWidth: result.unitWidth,
      unit: result.unit,
      completedRows: result.completedRows,
      filled: result.filled,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'repeat-result.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const shown = result.filled.slice(0, FILLED_LIST_CAP)

  return (
    <div className="result-view">
      <h2>判定结果</h2>
      <p className="summary">
        最小重复单元：<strong>{result.unitHeight} × {result.unitWidth}</strong>
        （面积 {result.unitHeight * result.unitWidth}，按面积 → 高度 → 宽度取最小）
      </p>

      <h3>重复单元</h3>
      <PatternCanvas rows={result.unit} maxSide={280} title="最小重复单元" />
      <pre className="unit-text">{result.unit.join('\n')}</pre>

      <h3>补全后的样片（白点为被补格）</h3>
      <PatternCanvas rows={result.completedRows} marked={marked} title="补全后的样片" />

      <h3>被补格来源模位（共 {result.filled.length} 格）</h3>
      {result.filled.length === 0 ? (
        <p className="hint">样片无缺失格，无需补色。</p>
      ) : (
        <>
          <table className="filled-table">
            <thead>
              <tr>
                <th>行</th>
                <th>列</th>
                <th>补入</th>
                <th>来源模位</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={`${f.row},${f.col}`}>
                  <td>{f.row}</td>
                  <td>{f.col}</td>
                  <td>{f.char}</td>
                  <td>
                    ({f.srcRow}, {f.srcCol})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.filled.length > shown.length && (
            <p className="hint">仅显示前 {FILLED_LIST_CAP} 条，完整清单见下载 JSON。</p>
          )}
        </>
      )}

      <button type="button" className="download" onClick={download}>
        下载结果 JSON
      </button>
    </div>
  )
}
