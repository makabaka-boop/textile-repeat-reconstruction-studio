import { useCallback, useMemo, useState } from 'react'
import { applyImport } from './core/importer'
import { findMinRepeat } from './core/repeat'
import GridEditor from './components/GridEditor'
import ResultView from './components/ResultView'

const EXAMPLE_OK = JSON.stringify(
  { rows: ['ABC?BC', 'BCAB?A', '?BCABC', 'BCABCA'] },
  null,
  2,
)
const EXAMPLE_FAIL = JSON.stringify({ rows: ['A??', '???', '??B'] }, null, 2)

export default function App() {
  const [rows, setRows] = useState<string[]>(() => JSON.parse(EXAMPLE_OK).rows as string[])
  const [errors, setErrors] = useState<string[]>([])
  const [importText, setImportText] = useState('')

  // 结论完全由当前样片派生：任何单格编辑都会立即触发重算，旧结论随之失效
  const result = useMemo(() => findMinRepeat(rows), [rows])

  const handleImport = useCallback(
    (text: string) => {
      const outcome = applyImport(rows, text)
      setErrors(outcome.errors)
      if (outcome.errors.length === 0) {
        setRows(outcome.rows)
        setImportText('')
      }
    },
    [rows],
  )

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      file.text().then(handleImport)
      e.target.value = ''
    },
    [handleImport],
  )

  const handleEdit = useCallback((r: number, c: number, ch: string) => {
    setRows((prev) => {
      if (prev[r][c] === ch) return prev
      const next = prev.slice()
      next[r] = prev[r].slice(0, c) + ch + prev[r].slice(c + 1)
      return next
    })
  }, [])

  const loadExample = (text: string) => {
    setImportText(text)
    handleImport(text)
  }

  return (
    <div className="app">
      <header>
        <h1>织物纹样修复工作台</h1>
        <p>
          导入 rows 数组（2–300 行等长字符串，每行 2–300 字符，仅 A-Z 与 ?，总格点 ≤ 50000）。
          系统枚举所有整除尺寸候选，只接受同一模位已知字符一致且每个模位至少被观测一次的单元，
          按面积 → 高度 → 宽度取最小；无法唯一重建时给出 NO_UNIQUE_REPEAT，不猜测缺失颜色。
        </p>
      </header>

      <section className="import-panel">
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='粘贴 JSON，例如 {"rows":["ABAB","BABA","AB?B","BABA"]}'
          rows={5}
          spellCheck={false}
        />
        <div className="import-actions">
          <button type="button" onClick={() => handleImport(importText)}>
            导入 JSON
          </button>
          <label className="file-btn">
            从文件导入
            <input type="file" accept=".json,application/json" onChange={handleFile} />
          </label>
          <button type="button" onClick={() => loadExample(EXAMPLE_OK)}>
            可修复示例
          </button>
          <button type="button" onClick={() => loadExample(EXAMPLE_FAIL)}>
            不可恢复示例
          </button>
        </div>
        {errors.length > 0 && (
          <div className="errors" role="alert">
            <strong>导入被整份拒绝，已保留上次合法样片：</strong>
            <ul>
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <main>
        <section className="editor">
          <h2>样片（{rows.length} × {rows[0].length}）</h2>
          <GridEditor rows={rows} onEdit={handleEdit} />
        </section>
        <section className="result">
          <ResultView result={result} />
        </section>
      </main>
    </div>
  )
}
