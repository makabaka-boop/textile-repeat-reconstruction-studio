/**
 * 织物样片最小重复单元判定（纯函数，无 DOM 依赖，可被 Vitest 直接对拍）
 *
 * 判定规则：
 * 1. 候选单元尺寸 tileH × tileW 必须分别整除样片高 H、宽 W；
 * 2. 同一模位 (i % tileH, j % tileW) 上的所有已知字符必须一致；
 * 3. 每个模位至少出现一次已知字符 —— 否则该格颜色无法证明，
 *    不允许把未知格随意补成看似更小的花型。
 * 全部满足即为“可唯一重建”候选，在其中先取面积最小，再取高较小、宽较小。
 * 找不到任何候选时返回 NO_UNIQUE_REPEAT。
 */

export const MIN_DIM = 2;
export const MAX_DIM = 300;
export const MAX_CELLS = 50000;

export type Cell = string; // 单个字符：A-Z 或 '?'

export type ValidationErrorCode =
  | 'NOT_ARRAY'
  | 'ROW_COUNT_RANGE'
  | 'ROW_NOT_STRING'
  | 'ROW_LENGTH_RANGE'
  | 'ROWS_LENGTH_MISMATCH'
  | 'INVALID_CHAR'
  | 'TOO_MANY_CELLS';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  /** 便于定位的行号（0 基），无具体行时为 null */
  row: number | null;
  /** 便于定位的列号（0 基），无具体列时为 null */
  col: number | null;
}

export type ValidationResult =
  | { ok: true; rows: string[]; height: number; width: number }
  | { ok: false; error: ValidationError };

const KNOWN_RE = /^[A-Z?$]/;

/** 校验导入的 rows 数组；任何结构错误都拒绝整份数据。 */
export function validateRows(input: unknown): ValidationResult {
  const fail = (
    code: ValidationErrorCode,
    message: string,
    row: number | null = null,
    col: number | null = null,
  ): ValidationResult => ({ ok: false, error: { code, message, row, col } });

  if (!Array.isArray(input)) {
    return fail('NOT_ARRAY', '导入内容必须是 rows 数组（JSON 数组或每行一条字符串）。');
  }

  const rows = input as unknown[];
  if (rows.length < MIN_DIM || rows.length > MAX_DIM) {
    return fail(
      'ROW_COUNT_RANGE',
      `行数必须在 ${MIN_DIM} 至 ${MAX_DIM} 之间，当前为 ${rows.length}。`,
    );
  }

  for (let i = 0; i < rows.length; i++) {
    if (typeof rows[i] !== 'string') {
      return fail('ROW_NOT_STRING', `第 ${i + 1} 行不是字符串。`, i);
    }
  }

  const strRows = rows as string[];
  const width = strRows[0].length;

  if (width < MIN_DIM || width > MAX_DIM) {
    return fail(
      'ROW_LENGTH_RANGE',
      `每行长度必须在 ${MIN_DIM} 至 ${MAX_DIM} 之间，当前为 ${width}。`,
      0,
    );
  }

  if (strRows.length * width > MAX_CELLS) {
    return fail(
      'TOO_MANY_CELLS',
      `总格点不得超过 ${MAX_CELLS.toLocaleString()}，当前为 ${(
        strRows.length * width
      ).toLocaleString()}。`,
    );
  }

  for (let i = 0; i < strRows.length; i++) {
    if (strRows[i].length !== width) {
      return fail(
        'ROWS_LENGTH_MISMATCH',
        `第 ${i + 1} 行长度为 ${strRows[i].length}，与首行长度 ${width} 不一致。`,
        i,
      );
    }
  }

  for (let i = 0; i < strRows.length; i++) {
    for (let j = 0; j < width; j++) {
      if (!KNOWN_RE.test(strRows[i][j])) {
        return fail(
          'INVALID_CHAR',
          `第 ${i + 1} 行第 ${j + 1} 列出现非法字符 ${JSON.stringify(
            strRows[i][j],
          )}，只允许 A-Z 与 ?。`,
          i,
          j,
        );
      }
    }
  }

  return { ok: true, rows: strRows, height: strRows.length, width };
}

/** 返回 n 的所有正因数（升序）。n ≤ 300，线性扫描即可。 */
export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) {
    if (n % d === 0) out.push(d);
  }
  return out;
}

/** 模位冲突位置（0 基） */
export interface ConflictPoint {
  row: number;
  col: number;
  expected: Cell;
  actual: Cell;
}

export interface TileEvalInvalid {
  valid: false;
  reason: 'conflict' | 'unobserved';
  /** 冲突原因时：所有已知字符互不一致的模位；否则为空数组 */
  conflicts: ConflictPoint[];
  /** 存在互斥已知字符的模位数量（即使按模位顺序先报 unobserved 也会统计） */
  conflictModCount: number;
  /** 无任何已知字符的模位数量 */
  unobservedCount: number;
  /** 第一个不可证明模位（便于给出原因） */
  firstUnobserved: { row: number; col: number } | null;
}

export interface TileEvalValid {
  valid: true;
  conflicts: [];
  conflictModCount: 0;
  unobservedCount: 0;
  /** 每个模位推导出的唯一字符，长度 tileH * tileW */
  unit: string[];
  knownCount: number;
}

export type TileEvalResult = TileEvalValid | TileEvalInvalid;

/**
 * 校验一个候选尺寸 tileH × tileW 是否“可唯一重建”：
 * 整除性由候选枚举保证，这里检查同模位一致性与每个模位至少一次已知。
 * 每个模位的已知字符数恰为 0 / 1 / 多个，状态互斥；
 * reason 取按模位行、列顺序遇到的第一个问题模位。
 */
export function evaluateTile(
  rows: string[],
  height: number,
  width: number,
  tileH: number,
  tileW: number,
): TileEvalResult {
  const unit: Cell[] = new Array(tileH * tileW).fill('?');
  const seen = new Array<boolean>(tileH * tileW).fill(false);
  /** 已确认“有多个互斥已知字符”的模位（区别于完全无证据的模位） */
  const conflictMods = new Set<number>();
  const conflicts: ConflictPoint[] = [];
  let knownCount = 0;

  for (let i = 0; i < height; i++) {
    const line = rows[i];
    const modR = i % tileH;
    for (let j = 0; j < width; j++) {
      const ch = line[j];
      if (ch === '?') continue;
      knownCount++;
      const idx = modR * tileW + (j % tileW);
      if (!seen[idx]) {
        seen[idx] = true;
        unit[idx] = ch;
      } else if (unit[idx] !== ch) {
        conflictMods.add(idx);
        conflicts.push({ row: i, col: j, expected: unit[idx], actual: ch });
      }
    }
  }

  // 按模位顺序找第一个问题模位（无证据 / 冲突互斥）
  let reason: 'conflict' | 'unobserved' | null = null;
  let firstUnobserved: { row: number; col: number } | null = null;
  let unobservedCount = 0;
  for (let r = 0; r < tileH; r++) {
    for (let c = 0; c < tileW; c++) {
      const idx = r * tileW + c;
      if (!seen[idx]) {
        unobservedCount++;
        if (firstUnobserved === null) firstUnobserved = { row: r, col: c };
        if (reason === null) reason = 'unobserved';
      } else if (conflictMods.has(idx) && reason === null) {
        reason = 'conflict';
      }
    }
  }

  if (reason !== null) {
    return {
      valid: false,
      reason,
      conflicts,
      conflictModCount: conflictMods.size,
      unobservedCount,
      firstUnobserved,
    };
  }

  return {
    valid: true,
    conflicts: [],
    conflictModCount: 0,
    unobservedCount: 0,
    unit,
    knownCount,
  };
}

/** 候选排序键：先面积，再高度，再宽度（均越小越优先）。 */
export function compareTiles(
  a: { tileH: number; tileW: number },
  b: { tileH: number; tileW: number },
): number {
  const areaDiff = a.tileH * a.tileW - b.tileH * b.tileW;
  if (areaDiff !== 0) return areaDiff;
  if (a.tileH !== b.tileH) return a.tileH - b.tileH;
  return a.tileW - b.tileW;
}

export interface FillRecord {
  /** 被补全的格（0 基） */
  row: number;
  col: number;
  /** 来源模位（0 基） */
  sourceRow: number;
  sourceCol: number;
  /** 补入的字符 */
  char: Cell;
}

export interface UniqueSolution {
  kind: 'unique';
  tileH: number;
  tileW: number;
  /** 重复单元，每行一个字符串 */
  unit: string[];
  /** 补全后的完整样片 */
  completed: string[];
  /** 每个被补格的来源模位（按行、列升序） */
  fills: FillRecord[];
  knownCount: number;
  testedCandidates: number;
  validCandidates: number;
}

export interface NoUniqueSolution {
  kind: 'no_unique_repeat';
  testedCandidates: number;
  /**
   * 根本原因固定为 unobserved：整尺寸候选每个模位只出现一次，不可能冲突；
   * 只要样片含未知格且没有任何更小候选能完全证明，就必然存在无证据模位。
   * 更小候选上的模位冲突只说明那些尺寸不可能，统计于 conflictCandidates。
   */
  reason: 'unobserved';
  detail: string;
  /** 最小的无冲突候选（按 面积→高→宽），它的某些模位没有任何已知字符 */
  blockingCandidate: {
    tileH: number;
    tileW: number;
    unobservedCount: number;
    firstUnobserved: { row: number; col: number };
  };
  /** 被模位冲突排除的候选数量（仅供说明） */
  conflictCandidateCount: number;
  /** 首个冲突位置（0 基，仅供说明） */
  firstConflict: ConflictPoint | null;
}

export type Solution = UniqueSolution | NoUniqueSolution;

/**
 * 枚举所有整除尺寸并判定最小可唯一重建单元。
 * 返回 NO_UNIQUE_REPEAT 时绝不猜测任何缺失颜色。
 */
export function solveRepeat(rows: string[]): Solution {
  const height = rows.length;
  const width = rows[0].length;

  const candidates = divisors(height).flatMap((tileH) =>
    divisors(width).map((tileW) => ({ tileH, tileW })),
  );
  candidates.sort(compareTiles);

  let conflictCandidateCount = 0;
  let firstConflict: ConflictPoint | null = null;
  // 最小的“无冲突但无法证明”候选 —— 它就是阻止唯一重建的关键：
  // 该尺寸不与任何已知矛盾，却有模位完全没有证据，不能靠猜测补齐。
  let blocker: {
    tileH: number;
    tileW: number;
    unobservedCount: number;
    firstUnobserved: { row: number; col: number };
  } | null = null;
  // 候选按 面积 → 高 → 宽 升序，首个有效即答案；先记录、扫完后再构建
  let winner: { tileH: number; tileW: number; tile: TileEvalValid } | null = null;
  let validCandidates = 0;

  for (const { tileH, tileW } of candidates) {
    const result = evaluateTile(rows, height, width, tileH, tileW);
    if (result.valid) {
      validCandidates++;
      if (winner === null) winner = { tileH, tileW, tile: result };
      continue;
    }
    if (result.conflictModCount > 0) {
      conflictCandidateCount++;
      if (firstConflict === null) firstConflict = result.conflicts[0] ?? null;
    }
    // 阻断候选：所有模位都不与已知冲突，但至少一个模位完全没有证据
    if (
      blocker === null &&
      result.conflictModCount === 0 &&
      result.firstUnobserved !== null
    ) {
      blocker = {
        tileH,
        tileW,
        unobservedCount: result.unobservedCount,
        firstUnobserved: result.firstUnobserved,
      };
    }
  }

  if (winner) {
    return buildSolution(rows, height, width, winner.tileH, winner.tileW, winner.tile, {
      tested: candidates.length,
      validCount: validCandidates,
    });
  }

  // blocker 理论上必存在：整尺寸候选无冲突，只要样片含未知即无证据模位
  const detail = blocker
    ? `最小无冲突候选 ${blocker.tileH}×${blocker.tileW} 有 ${blocker.unobservedCount} 个模位` +
      `在整个样片中没有任何已知字符（首个：第 ${blocker.firstUnobserved.row + 1} 模位行、` +
      `第 ${blocker.firstUnobserved.col + 1} 模位列），其颜色无法证明；` +
      `其余候选或有模位冲突（${conflictCandidateCount} 个）或同样缺少证据，` +
      `故不存在可唯一重建的重复单元，不猜测缺失颜色。`
    : '不存在可唯一重建的重复单元。';

  return {
    kind: 'no_unique_repeat',
    testedCandidates: candidates.length,
    reason: 'unobserved',
    detail,
    blockingCandidate: blocker ?? {
      tileH: height,
      tileW: width,
      unobservedCount: 0,
      firstUnobserved: { row: 0, col: 0 },
    },
    conflictCandidateCount,
    firstConflict,
  };
}

function buildSolution(
  rows: string[],
  height: number,
  width: number,
  tileH: number,
  tileW: number,
  tile: TileEvalValid,
  stats: { tested: number; validCount: number },
): UniqueSolution {
  const unit: string[] = [];
  for (let r = 0; r < tileH; r++) {
    unit.push(tile.unit.slice(r * tileW, (r + 1) * tileW).join(''));
  }

  const completed: string[] = new Array<string>(height);
  const fills: FillRecord[] = [];
  for (let i = 0; i < height; i++) {
    let line = '';
    const modR = i % tileH;
    for (let j = 0; j < width; j++) {
      const ch = rows[i][j];
      if (ch !== '?') {
        line += ch;
      } else {
        const sourceCol = j % tileW;
        const filled = tile.unit[modR * tileW + sourceCol];
        line += filled;
        fills.push({
          row: i,
          col: j,
          sourceRow: modR,
          sourceCol,
          char: filled,
        });
      }
    }
    completed[i] = line;
  }

  return {
    kind: 'unique',
    tileH,
    tileW,
    unit,
    completed,
    fills,
    knownCount: tile.knownCount,
    testedCandidates: stats.tested,
    validCandidates: stats.validCount,
  };
}

/** 导出 JSON 的载荷结构；画布与下载文件必须来自同一 Solution 对象。 */
export interface ExportPayload {
  status: 'UNIQUE_REPEAT';
  tileHeight: number;
  tileWidth: number;
  unit: string[];
  completedSample: string[];
  fills: Array<{
    row: number;
    col: number;
    char: Cell;
    sourceModulo: { row: number; col: number };
  }>;
  knownCellCount: number;
  filledCellCount: number;
  testedCandidateCount: number;
  validCandidateCount: number;
  /** 画布与下载同源校验指纹 */
  fingerprint: string;
}

/** 非加密指纹（FNV-1a），仅用于确认画布与 JSON 下载取自同一次判定结果。 */
export function fingerprintSolution(solution: UniqueSolution): string {
  const material = [
    solution.tileH,
    solution.tileW,
    solution.unit.join('|'),
    solution.completed.join('|'),
    solution.fills.length,
  ].join('#');
  let hash = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function toExportPayload(solution: UniqueSolution): ExportPayload {
  return {
    status: 'UNIQUE_REPEAT',
    tileHeight: solution.tileH,
    tileWidth: solution.tileW,
    unit: solution.unit,
    completedSample: solution.completed,
    fills: solution.fills.map((f) => ({
      row: f.row + 1,
      col: f.col + 1,
      char: f.char,
      sourceModulo: { row: f.sourceRow + 1, col: f.sourceCol + 1 },
    })),
    knownCellCount: solution.knownCount,
    filledCellCount: solution.fills.length,
    testedCandidateCount: solution.testedCandidates,
    validCandidateCount: solution.validCandidates,
    fingerprint: fingerprintSolution(solution),
  };
}
