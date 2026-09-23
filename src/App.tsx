import { useCallback, useMemo, useRef, useState } from 'react';
import { GridCanvas } from './components/GridCanvas';
import { cellStyle } from './lib/colors';
import { SAMPLES } from './lib/samples';
import {
  fingerprintSolution,
  solveRepeat,
  toExportPayload,
  validateRows,
  type Solution,
  type UniqueSolution,
  type ValidationError,
} from './lib/pattern';

interface ImportErrorState {
  error: ValidationError;
  rejectedAt: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FILL_LIST_LIMIT = 100;

function parseImportText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('内容为空');
  // 优先按 JSON 解析（标准 rows 数组）
  try {
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch {
    // 回退：每行一条字符串（忽略空行与首尾空白）
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}

export default function App() {
  // 当前编辑器内的 rows（可能正在编辑、尚未判定）
  const [rows, setRows] = useState<string[] | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<ImportErrorState | null>(null);
  const [acceptedName, setAcceptedName] = useState<string | null>(null);

  // 判定结果与“编辑后失效”状态
  const [solution, setSolution] = useState<Solution | null>(null);
  const [stale, setStale] = useState(false);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [inspect, setInspect] = useState<{ row: number; col: number } | null>(null);

  // 保存上一次合法样片：结构错误的导入不覆盖它
  const lastValidRows = useRef<string[] | null>(null);

  const height = rows?.length ?? 0;
  const width = rows?.[0]?.length ?? 0;

  const acceptSample = useCallback((next: string[], name: string | null) => {
    setRows(next.map((line) => line));
    setSolution(solveRepeat(next));
    setStale(false);
    setSelected(null);
    setInspect(null);
    lastValidRows.current = next;
    setAcceptedName(name);
  }, []);

  const handleImport = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = parseImportText(importText);
    } catch {
      setImportError({
        rejectedAt: Date.now(),
        error: {
          code: 'NOT_ARRAY',
          message: '无法解析：请粘贴 JSON 字符串数组，或每行一条字符串。',
          row: null,
          col: null,
        },
      });
      return;
    }
    const result = validateRows(parsed);
    if (!result.ok) {
      // 拒绝整份数据：编辑器、上次合法样片、既有判定都保留
      setImportError({ error: result.error, rejectedAt: Date.now() });
      return;
    }
    setImportError(null);
    acceptSample(result.rows, null);
  }, [importText, acceptSample]);

  const restoreLastValid = useCallback(() => {
    if (lastValidRows.current) {
      acceptSample(lastValidRows.current, acceptedName);
      setImportError(null);
    }
  }, [acceptSample, acceptedName]);

  /** 任何单格编辑：立即撤销旧结论 */
  const editCell = useCallback(
    (row: number, col: number, ch: string) => {
      setRows((prev) => {
        if (!prev) return prev;
        const line = prev[row];
        if (line[col] === ch) return prev;
        const next = prev.slice();
        next[row] = line.slice(0, col) + ch + line.slice(col + 1);
        return next;
      });
      setSolution(null);
      setStale(true);
      setInspect(null);
    },
    [],
  );

  const rerunSolve = useCallback(() => {
    if (!rows) return;
    setSolution(solveRepeat(rows));
    setStale(false);
    setInspect(null);
  }, [rows]);

  const handleCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selected || !rows) return;
      const { row, col } = selected;
      let moved: { row: number; col: number } | null = null;
      if (event.key === 'ArrowUp') moved = { row: Math.max(0, row - 1), col };
      else if (event.key === 'ArrowDown') moved = { row: Math.min(height - 1, row + 1), col };
      else if (event.key === 'ArrowLeft') moved = { row, col: Math.max(0, col - 1) };
      else if (event.key === 'ArrowRight') moved = { row, col: Math.min(width - 1, col + 1) };
      else if (event.key === '?' || event.key === '？') editCell(row, col, '?');
      else if (/^[a-zA-Z]$/.test(event.key)) editCell(row, col, event.key.toUpperCase());
      else if (event.key === 'Backspace' || event.key === 'Delete') editCell(row, col, '?');
      if (moved) {
        event.preventDefault();
        setSelected(moved);
      }
    },
    [selected, rows, height, width, editCell],
  );

  const markedFills = useMemo(() => {
    if (!solution || solution.kind !== 'unique') return new Set<string>();
    return new Set(solution.fills.map((f) => `${f.row},${f.col}`));
  }, [solution]);

  const downloadJson = useCallback(() => {
    if (!solution || solution.kind !== 'unique') return;
    // 下载内容直接取自当前画布所展示的同一个 solution 对象
    const payload = toExportPayload(solution);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repeat-${payload.tileHeight}x${payload.tileWidth}-${payload.fingerprint}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [solution]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>织物样片修复工作台</h1>
        <p className="subtitle">
          离线纯前端 · 仅依据可见经纬纹样判定<strong>可证明的最小重复单元</strong> ·
          无法证明时报告 NO_UNIQUE_REPEAT，绝不猜测缺失颜色
        </p>
      </header>

      <main className="layout">
        <section className="panel import-panel">
          <h2>1. 导入 rows 数组</h2>
          <p className="hint">
            支持 JSON（如 <code>["AB","?B"]</code>）或每行一条字符串。2–300 行、每行 2–300
            字符，仅 A–Z 与 ?，总格点 ≤ 50000。结构错误将整份拒绝并保留上次合法样片。
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'["ABAB","?D?D","ABAB","CDCD"]\n\n或每行一条：\nABAB\n?D?D'}
            rows={7}
            spellCheck={false}
          />
          <div className="row-actions">
            <button className="primary" onClick={handleImport} disabled={!importText.trim()}>
              导入并判定
            </button>
            {importError && (
              <button onClick={restoreLastValid} disabled={!lastValidRows.current}>
                恢复上次合法样片
              </button>
            )}
          </div>
          {importError && (
            <div className="alert error" role="alert">
              <strong>已拒绝整份数据（{importError.error.code}）</strong>
              <span>{importError.error.message}</span>
              {importError.error.row !== null && (
                <span className="dim">
                  位置：第 {importError.error.row + 1} 行
                  {importError.error.col !== null ? ` 第 ${importError.error.col + 1} 列` : ''}
                </span>
              )}
            </div>
          )}
          <div className="samples">
            <h3>内置示例</h3>
            {SAMPLES.map((sample) => (
              <button
                key={sample.name}
                className="sample-btn"
                onClick={() => {
                  setImportText(JSON.stringify(sample.rows));
                  setImportError(null);
                  acceptSample(sample.rows, sample.name);
                }}
              >
                {sample.name}
                <span className="dim">{sample.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel editor-panel">
          <h2>
            2. 检查 / 编辑样片
            {rows && (
              <span className="dim">
                {' '}
               （{height} × {width}，共 {height * width} 格，未知{' '}
                {rows.join('').split('').filter((c) => c === '?').length} 格）
              </span>
            )}
          </h2>
          {!rows ? (
            <div className="empty">尚未导入合法样片。</div>
          ) : (
            <>
              <div
                className="canvas-scroll focusable-canvas"
                onKeyDown={handleCanvasKeyDown}
                tabIndex={0}
              >
                <GridCanvas
                  rows={rows}
                  selected={selected}
                  interactive
                  onCellClick={(row, col) => setSelected({ row, col })}
                />
              </div>
              <div className="palette">
                {ALPHABET.map((ch) => (
                  <button
                    key={ch}
                    className="swatch"
                    style={{
                      background: cellStyle(ch).fill,
                      color: cellStyle(ch).text,
                    }}
                    disabled={!selected}
                    onClick={() => selected && editCell(selected.row, selected.col, ch)}
                    title={selected ? `把选中格改为 ${ch}` : '先在画布上点选一格'}
                  >
                    {ch}
                  </button>
                ))}
                <button
                  className="swatch unknown"
                  disabled={!selected}
                  onClick={() => selected && editCell(selected.row, selected.col, '?')}
                  title="标记为未知 ?"
                >
                  ?
                </button>
              </div>
              <p className="hint">
                {selected ? (
                      <>
                        已选 第 {selected.row + 1} 行 / 第 {selected.col + 1} 列（当前{' '}
                        <code>{rows[selected.row][selected.col]}</code>）。点击字母或按 A–Z / ?
                        改色，方向键移动。
                      </>
                    ) : (
                  '点击画布选中一格后改色。'
                )}{' '}
                <strong>任何单格编辑都会立即撤销旧结论</strong>，需重新判定。
              </p>
              <div className="row-actions">
                <button className="primary" onClick={rerunSolve} disabled={!stale && !!solution}>
                  {stale ? '重新判定周期' : '再次判定'}
                </button>
                {stale && <span className="stale-badge">旧结论已撤销</span>}
              </div>
            </>
          )}
        </section>

        <section className="panel result-panel">
          <h2>3. 判定结果</h2>
          {!rows ? (
            <div className="empty">结果将在此显示。</div>
          ) : stale ? (
            <div className="alert warn">
              样片已被编辑，先前结论已撤销。点击“重新判定周期”获取与当前画布一致的结论。
            </div>
          ) : !solution ? null : solution.kind === 'unique' ? (
            <UniqueResult
              key={fingerprintSolution(solution)}
              solution={solution}
              onDownload={downloadJson}
              inspect={inspect}
              onInspect={setInspect}
              marked={markedFills}
            />
          ) : (
            <div className="alert fatal" role="status">
              <div className="code-token">NO_UNIQUE_REPEAT</div>
              <p>{solution.detail}</p>
              <dl className="stats">
                <dt>枚举候选</dt>
                <dd>{solution.testedCandidates} 个整除尺寸</dd>
                <dt>模位冲突候选</dt>
                <dd>{solution.conflictCandidateCount} 个</dd>
                <dt>阻断候选</dt>
                <dd>
                  {solution.blockingCandidate.tileH}×{solution.blockingCandidate.tileW}
                  ，{solution.blockingCandidate.unobservedCount} 个模位无证据
                </dd>
              </dl>
              <p className="dim">
                不输出补全图、不提供下载：任何补全都将是无法证明的猜测。
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        TypeScript + React + Vite · 判定逻辑由 Vitest 独立枚举 oracle 对拍 · 无任何网络依赖
      </footer>
    </div>
  );
}

function UniqueResult({
  solution,
  onDownload,
  inspect,
  onInspect,
  marked,
}: {
  solution: UniqueSolution;
  onDownload: () => void;
  inspect: { row: number; col: number } | null;
  onInspect: (p: { row: number; col: number } | null) => void;
  marked: ReadonlySet<string>;
}) {
  const fingerprint = fingerprintSolution(solution);
  const inspectFill = inspect
    ? solution.fills.find((f) => f.row === inspect.row && f.col === inspect.col) ?? null
    : null;
  const inspectKnown = inspect ? solution.completed[inspect.row][inspect.col] : null;

  return (
    <div className="unique-result">
      <div className="alert ok" role="status">
        <div className="code-token">UNIQUE_REPEAT</div>
        <p>
          最小重复单元：<strong>{solution.tileH} × {solution.tileW}</strong>
          （高 × 宽，先比面积再比高、宽）
        </p>
        <dl className="stats">
          <dt>枚举候选</dt>
          <dd>{solution.testedCandidates} 个</dd>
          <dt>其中可唯一重建</dt>
          <dd>{solution.validCandidates} 个</dd>
          <dt>已知格 / 补全格</dt>
          <dd>
            {solution.knownCount} / {solution.fills.length}
          </dd>
        </dl>
      </div>

      <div className="result-grid">
        <figure>
          <figcaption>重复单元（{solution.tileH}×{solution.tileW}）</figcaption>
          <div className="canvas-scroll small">
            <GridCanvas rows={solution.unit} cellSize={Math.max(20, Math.min(64, Math.floor(360 / Math.max(solution.tileW, solution.tileH))))} />
          </div>
        </figure>
        <figure>
          <figcaption>
            补全后的样片（橙框 = 被补格，点击查看来源模位）
          </figcaption>
          <div className="canvas-scroll">
            <GridCanvas
              rows={solution.completed}
              marked={marked}
              onCellClick={(row, col) => onInspect({ row, col })}
            />
          </div>
        </figure>
      </div>

      {inspect && inspectKnown && (
        <div className="inspect-box">
          第 {inspect.row + 1} 行 / 第 {inspect.col + 1} 列 ={' '}
          <strong>{inspectKnown}</strong>
          {inspectFill ? (
            <>
              {' '}— 补入字符 <strong>{inspectFill.char}</strong>，来源模位 (
              {inspectFill.sourceRow + 1}, {inspectFill.sourceCol + 1})
            </>
          ) : (
            <> — 原始可见格，无需补全</>
          )}
        </div>
      )}

      <div className="fills">
        <h3>
          被补格的来源模位
          <span className="dim">
            {' '}
            共 {solution.fills.length} 格（下表最多展示前 {FILL_LIST_LIMIT} 条，完整数据见
            JSON 下载）
          </span>
        </h3>
        {solution.fills.length === 0 ? (
          <p className="dim">没有未知格，样片本身完整。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>被补格(行,列)</th>
                <th>字符</th>
                <th>来源模位(行,列)</th>
              </tr>
            </thead>
            <tbody>
              {solution.fills.slice(0, FILL_LIST_LIMIT).map((f) => (
                <tr key={`${f.row}-${f.col}`}>
                  <td>
                    ({f.row + 1}, {f.col + 1})
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: cellStyle(f.char).fill, color: cellStyle(f.char).text }}
                    >
                      {f.char}
                    </span>
                  </td>
                  <td>
                    ({f.sourceRow + 1}, {f.sourceCol + 1})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="row-actions">
        <button className="primary" onClick={onDownload}>
          下载结果 JSON
        </button>
        <span className="dim">
          画布与下载取自同一次判定结果，指纹 <code>{fingerprint}</code>
        </span>
      </div>
    </div>
  );
}
