export interface SampleData {
  rows: string[];
  height: number;
  width: number;
}

/** 内置示例，便于空仓库起步时立即试用 */
export const SAMPLES: Array<{ name: string; rows: string[]; note: string }> = [
  {
    name: '周期样片（含污点）',
    note: '真值单元 2×2 = AB/CD，含一整行未知与多处 ?，但每个模位都有证据。',
    rows: ['?B?B', '????', 'AB?B', 'CD?D', '?B?B', '?D?D'],
  },
  {
    name: '横纵并列周期 2×3',
    note: '真值单元 2×3，行周期 2、列周期 3，面积最小候选唯一。',
    rows: ['ABCABC', 'DEFDEF', 'ABCABC', 'DEFDEF', 'ABCABC', 'DEFDEF'],
  },
  {
    name: '颜色被完全擦除（不可恢复）',
    note: '模位 (2,1) 的颜色在整片中从未出现，任何补全都只是猜测。',
    rows: ['?B?B', '????', 'AB??', '???D'],
  },
];
