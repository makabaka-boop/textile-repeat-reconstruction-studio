import { describe, expect, it } from 'vitest';
import {
  MAX_CELLS,
  compareTiles,
  divisors,
  evaluateTile,
  fingerprintSolution,
  solveRepeat,
  toExportPayload,
  validateRows,
  type TileEvalResult,
} from './pattern';

/**
 * 独立 oracle：与被测实现不同的组织方式 ——
 * 不预先收集 unit 数组，而是逐模位收集该模位上的所有已知字符集合，
 * 用集合大小判定有效性。用于对拍 evaluateTile。
 */
function oracleTileValid(
  rows: string[],
  height: number,
  width: number,
  tileH: number,
  tileW: number,
): { valid: boolean; reason: 'conflict' | 'unobserved' } {
  for (let r = 0; r < tileH; r++) {
    for (let c = 0; c < tileW; c++) {
      const chars = new Set<string>();
      for (let i = r; i < height; i += tileH) {
        for (let j = c; j < width; j += tileW) {
          const ch = rows[i][j];
          if (ch !== '?') chars.add(ch);
        }
      }
      if (chars.size > 1) return { valid: false, reason: 'conflict' };
      if (chars.size === 0) return { valid: false, reason: 'unobserved' };
    }
  }
  return { valid: true, reason: 'unobserved' };
}

/** oracle 版全量求解：枚举所有整除尺寸，按同规则选最优 */
function oracleSolve(rows: string[]) {
  const h = rows.length;
  const w = rows[0].length;
  const all: Array<{ tileH: number; tileW: number; valid: boolean }> = [];
  for (const dh of divisors(h)) {
    for (const dw of divisors(w)) {
      all.push({ tileH: dh, tileW: dw, valid: oracleTileValid(rows, h, w, dh, dw).valid });
    }
  }
  const valid = all.filter((c) => c.valid).sort(compareTiles);
  return valid.length > 0 ? valid[0] : null;
}

describe('validateRows 结构校验', () => {
  it('接受合法 rows', () => {
    const r = validateRows(['AB', '?B']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.height).toBe(2);
      expect(r.width).toBe(2);
    }
  });

  it('拒绝非数组', () => {
    const r = validateRows('AB\nAB');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ARRAY');
  });

  it('拒绝行数越界', () => {
    expect(validateRows(['AB']).ok).toBe(false);
    const tooMany = Array.from({ length: 301 }, () => 'AB');
    const r = validateRows(tooMany);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ROW_COUNT_RANGE');
  });

  it('拒绝行长越界', () => {
    const r = validateRows(['A', 'B']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ROW_LENGTH_RANGE');
  });

  it('拒绝不等长行', () => {
    const r = validateRows(['ABC', 'AB']);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ROWS_LENGTH_MISMATCH');
      expect(r.error.row).toBe(1);
    }
  });

  it('拒绝非法字符（小写、数字、其他符号）', () => {
    for (const bad of [['ab', 'AB'], ['A1', 'AB'], ['A*', 'AB']]) {
      const r = validateRows(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_CHAR');
    }
  });

  it('拒绝总格点超过 50000', () => {
    // 200 × 251 = 50200 > 50000，且两个维度均 ≤ 300
    const rows = Array.from({ length: 200 }, () => 'A'.repeat(251));
    const r = validateRows(rows);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('TOO_MANY_CELLS');
    // 边界：50000 恰好允许
    const okRows = Array.from({ length: 200 }, () => 'A'.repeat(250));
    expect(validateRows(okRows).ok).toBe(true);
    expect(MAX_CELLS).toBe(50000);
  });
});

describe('divisors', () => {
  it('返回升序正因数', () => {
    expect(divisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(divisors(7)).toEqual([1, 7]);
    expect(divisors(2)).toEqual([1, 2]);
  });
});

describe('compareTiles 排序规则（面积 → 高 → 宽）', () => {
  it('面积优先', () => {
    expect(compareTiles({ tileH: 2, tileW: 2 }, { tileH: 1, tileW: 5 })).toBeLessThan(0);
  });
  it('同面积高较小优先（横纵周期并列）', () => {
    // 1×6 与 2×3 同面积时 1×6 更优；2×3 与 3×2 同面积时 2×3 更优
    expect(compareTiles({ tileH: 2, tileW: 3 }, { tileH: 3, tileW: 2 })).toBeLessThan(0);
  });
  it('同面积同高宽较小优先', () => {
    expect(compareTiles({ tileH: 2, tileW: 2 }, { tileH: 2, tileW: 3 })).toBeLessThan(0);
  });
});

describe('evaluateTile 与独立 oracle 对拍（小网格枚举所有整除尺寸）', () => {
  const cases = [
    ['ABAB', 'CDCD', 'ABAB', 'CDCD'],
    ['A?A?', '?B?B', 'A?A?', '?B?B'],
    ['????', '????'],
    ['ABC', 'DEF'],
    ['AA', 'A?'],
    ['AB', 'AC'],
    ['ABCD', 'BADC'],
  ];

  for (const rows of cases) {
    const h = rows.length;
    const w = rows[0].length;
    for (const tileH of divisors(h)) {
      for (const tileW of divisors(w)) {
        it(`${h}×${w} 候选 ${tileH}×${tileW}: ${JSON.stringify(rows)}`, () => {
          const got: TileEvalResult = evaluateTile(rows, h, w, tileH, tileW);
          const want = oracleTileValid(rows, h, w, tileH, tileW);
          expect(got.valid).toBe(want.valid);
          if (!got.valid) expect(got.reason).toBe(want.reason);
        });
      }
    }
  }
});

describe('随机网格对拍（枚举全部整除尺寸 × 多种填法）', () => {
  // 可复现的简易伪随机
  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const dims = [2, 3, 4, 5, 6, 8, 12];
  let seed = 1234;
  for (const h of dims) {
    for (const w of dims) {
      for (let variant = 0; variant < 4; variant++) {
        const rnd = mulberry32(seed++);
        const rows = Array.from({ length: h }, () =>
          Array.from({ length: w }, () => {
            const p = rnd();
            if (p < 0.35) return '?';
            return String.fromCharCode(65 + Math.floor(rnd() * 4));
          }).join(''),
        );

        it(`${h}×${w} variant ${variant}`, () => {
          for (const tileH of divisors(h)) {
            for (const tileW of divisors(w)) {
              const got = evaluateTile(rows, h, w, tileH, tileW);
              const want = oracleTileValid(rows, h, w, tileH, tileW);
              expect(got.valid).toBe(want.valid);
              if (!got.valid) expect(got.reason).toBe(want.reason);
            }
          }
          const sol = solveRepeat(rows);
          const best = oracleSolve(rows);
          if (best === null) {
            expect(sol.kind).toBe('no_unique_repeat');
          } else {
            expect(sol.kind).toBe('unique');
            if (sol.kind === 'unique') {
              expect(sol.tileH).toBe(best.tileH);
              expect(sol.tileW).toBe(best.tileW);
            }
          }
        });
      }
    }
  }
});

describe('规定场景', () => {
  it('规则周期样片：找出最小单元并补全', () => {
    // 真值单元 2×2：AB / CD；含一整行未知与多个污点，但每个模位至少有一次已知
    const rows = ['?B?B', '????', 'AB?B', 'CD?D'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('unique');
    if (sol.kind !== 'unique') return;
    expect(sol.tileH).toBe(2);
    expect(sol.tileW).toBe(2);
    expect(sol.unit).toEqual(['AB', 'CD']);
    expect(sol.completed).toEqual(['ABAB', 'CDCD', 'ABAB', 'CDCD']);
    // 每个被补格都指回来源模位
    for (const f of sol.fills) {
      expect(sol.unit[f.sourceRow][f.sourceCol]).toBe(f.char);
      expect(rows[f.row][f.col]).toBe('?');
      expect(f.sourceRow).toBe(f.row % sol.tileH);
      expect(f.sourceCol).toBe(f.col % sol.tileW);
    }
    // 未知格共 8 个，全部被补，且不新增/遗漏
    const unknownCount = rows.join('').split('').filter((c) => c === '?').length;
    expect(sol.fills.length).toBe(8);
    expect(sol.fills.length).toBe(unknownCount);
  });

  it('覆盖全未知行：该行颜色由其他行的同模位证明', () => {
    const rows = ['ABAB', '????', 'ABAB', 'CDCD'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('unique');
    if (sol.kind !== 'unique') return;
    expect(sol.unit).toEqual(['AB', 'CD']);
    expect(sol.completed[1]).toBe('CDCD');
    // 全未知行的 4 个补全都指向第 2 模位行
    expect(sol.fills.filter((f) => f.row === 1).map((f) => f.sourceRow)).toEqual([1, 1, 1, 1]);
  });

  it('全部未知：整份样片不可证明，返回 NO_UNIQUE_REPEAT，不猜测', () => {
    const rows = ['????', '????', '????'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('no_unique_repeat');
    if (sol.kind !== 'no_unique_repeat') return;
    expect(sol.reason).toBe('unobserved');
    // 最小候选 1×1 的唯一模位无任何已知字符
    expect(sol.blockingCandidate.tileH).toBe(1);
    expect(sol.blockingCandidate.tileW).toBe(1);
    expect(sol.blockingCandidate.firstUnobserved).toEqual({ row: 0, col: 0 });
    expect('unit' in sol).toBe(false);
  });

  it('冲突模位：同模位已知字符互斥时该候选被排除', () => {
    // 2 行 4 列：(0,0)=A 与 (0,2)=B 同属模位列 0，1×2 候选冲突；
    // 2×2 时列 0、2 仍同模位，同样冲突。整尺寸 2×4 无冲突但含未知 → 不可唯一重建。
    const rows = ['AB?B', 'BBAB'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('no_unique_repeat');
    if (sol.kind !== 'no_unique_repeat') return;
    expect(sol.conflictCandidateCount).toBeGreaterThan(0);
    expect(sol.firstConflict).not.toBeNull();
    expect(sol.firstConflict?.expected).toBe('A');
    expect(sol.firstConflict?.actual).toBe('B');
    // 根本原因仍是最小无冲突候选缺少证据：2×4（整尺寸）的 (0,2) 无证据
    expect(sol.reason).toBe('unobserved');
    expect(sol.blockingCandidate.tileH).toBe(2);
    expect(sol.blockingCandidate.tileW).toBe(4);
    expect(sol.blockingCandidate.firstUnobserved).toEqual({ row: 0, col: 2 });
    expect(sol.conflictCandidateCount).toBe(5);
  });

  it('纯冲突但全部已知：整尺寸单元仍可唯一重建', () => {
    // 小周期冲突并不代表不可恢复 —— 整尺寸重复单元总是成立
    const rows = ['ABAB', 'BBAB'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('unique');
    if (sol.kind !== 'unique') return;
    expect(sol.tileH).toBe(2);
    expect(sol.tileW).toBe(4);
  });

  it('evaluateTile 直接报告冲突细节', () => {
    const rows = ['ABAB', 'BBAB'];
    const r = evaluateTile(rows, 2, 4, 1, 2);
    expect(r.valid).toBe(false);
    if (r.valid) return;
    expect(r.reason).toBe('conflict');
    expect(r.conflicts[0].actual).toBe('B');
  });

  it('横纵周期并列：同面积时取高较小者，最终仍由全局最小决定', () => {
    // 构造一个 6×6、真值周期为 2×3 的样片（列周期 3，行周期 2）。
    const tile = ['ABC', 'DEF'];
    const rows: string[] = [];
    for (let i = 0; i < 6; i++) rows.push(tile[i % 2].repeat(2));
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('unique');
    if (sol.kind !== 'unique') return;
    expect(sol.tileH).toBe(2);
    expect(sol.tileW).toBe(3);
    // 有效候选恰好是整除 2 与整除 3 的尺寸组合：行向 2 个、列向 2 个
    expect(sol.validCandidates).toBe(4);
  });

  it('无周期样片（全部已知）：回退到整尺寸单元，仍唯一可重建', () => {
    const rows = ['AB', 'CD'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('unique');
    if (sol.kind !== 'unique') return;
    expect(sol.tileH).toBe(2);
    expect(sol.tileW).toBe(2);
    expect(sol.fills.length).toBe(0);
    expect(sol.completed).toEqual(rows);
  });

  it('未被任何已知覆盖的模位：不允许补成看似更小的花型', () => {
    // 4×4，真值单元 2×2 = AB/CD，但模位 (1,0) 的颜色 C 被完全擦除：
    // 所有 (奇,偶) 格都是 ?。2×2 候选因此不可证明；
    // 4×4 整尺寸候选同样含未知，故 NO_UNIQUE_REPEAT。
    // 模位 (1,0) 的 4 个落点 (1,0)(1,2)(3,0)(3,2) 全部未知；
    // 2×2 候选无冲突但该模位无证据
    const rows = ['?B?B', '????', 'AB??', '???D'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('no_unique_repeat');
    if (sol.kind !== 'no_unique_repeat') return;
    // 阻断候选 2×2 本身无模位冲突；更小候选 (1×1/1×2/1×4) 因周期不足而冲突
    expect(sol.reason).toBe('unobserved');
    expect(sol.blockingCandidate.tileH).toBe(2);
    expect(sol.blockingCandidate.tileW).toBe(2);
    expect(sol.blockingCandidate.firstUnobserved).toEqual({ row: 1, col: 0 });
    expect(sol.conflictCandidateCount).toBe(5);
  });

  it('模位未覆盖时绝不输出任何补全结果', () => {
    // 4×2：C 所在模位 (1,0) 被完全擦除（所有奇偶格均未知）
    const rows = ['AB', '??', 'AB', '?D'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('no_unique_repeat');
    if (sol.kind !== 'no_unique_repeat') return;
    expect(sol.blockingCandidate.firstUnobserved).toEqual({ row: 1, col: 0 });
    expect('unit' in sol).toBe(false);
    expect('completed' in sol).toBe(false);
    expect('fills' in sol).toBe(false);
  });
});

describe('补全结果与导出一致性（画布与下载同源）', () => {
  it('completed 与 unit 严格周期一致；fills 坐标与源模位正确', () => {
    const rows = ['A?AB', '?DCD', 'AB?B', 'CDCD'];
    const sol = solveRepeat(rows);
    expect(sol.kind).toBe('unique');
    if (sol.kind !== 'unique') return;
    const { tileH, tileW, unit, completed, fills } = sol;
    for (let i = 0; i < completed.length; i++) {
      for (let j = 0; j < completed[0].length; j++) {
        expect(completed[i][j]).toBe(unit[i % tileH][j % tileW]);
      }
    }
    for (const f of fills) {
      expect(rows[f.row][f.col]).toBe('?');
      expect(f.sourceRow).toBe(f.row % tileH);
      expect(f.sourceCol).toBe(f.col % tileW);
      expect(f.char).toBe(unit[f.sourceRow][f.sourceCol]);
    }
    // 已知格不得出现在 fills 中，未知格必须全部出现在 fills 中
    const unknownCells = [];
    for (let i = 0; i < rows.length; i++)
      for (let j = 0; j < rows[0].length; j++)
        if (rows[i][j] === '?') unknownCells.push(`${i},${j}`);
    expect(fills.map((f) => `${f.row},${f.col}`).sort()).toEqual([...unknownCells].sort());
  });

  it('导出 JSON 使用 1 基坐标并携带指纹，指纹对结果内容稳定', () => {
    const rows = ['?B?B', '????', 'AB?B', 'CD?D'];
    const sol = solveRepeat(rows);
    if (sol.kind !== 'unique') throw new Error('expected unique');
    const payload = toExportPayload(sol);
    expect(payload.status).toBe('UNIQUE_REPEAT');
    expect(payload.fills[0].row).toBeGreaterThanOrEqual(1);
    expect(payload.fills[0].sourceModulo.row).toBeGreaterThanOrEqual(1);
    expect(payload.filledCellCount).toBe(sol.fills.length);
    expect(payload.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintSolution(sol)).toBe(payload.fingerprint);
  });
});
