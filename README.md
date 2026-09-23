# 织物纹样修复工作台

不联网的纯前端工作台：从受污织物样片仍可见的经纬纹样中，判定**唯一可证明的最小重复单元**，或给出明确的不可恢复原因（`NO_UNIQUE_REPEAT`），绝不把未知格随意补成看似更小的花型。

## 判定规则

- 导入数据为 `rows` 数组（或 `{ "rows": [...] }` 对象）：2–300 个等长字符串，每行 2–300 字符，仅允许 `A-Z` 与表示未知的 `?`，总格点 ≤ 50000。
- 结构错误**整份拒绝**，界面上保留上次合法样片。
- 候选单元高 `h`、宽 `w` 必须分别整除样片行数、列数。
- 候选合法当且仅当：同一模位 `(r mod h, c mod w)` 的所有已知字符一致，且每个模位至少被观测到一次。
- 在全部合法候选中按 **面积 → 高度 → 宽度** 升序取最小。
- 无合法候选时显示 `NO_UNIQUE_REPEAT` 及原因（模位冲突 / 模位从未被观测），不猜测缺失颜色。
- 成功时展示重复单元、补全后的样片（白点标出被补格）与每个被补格的来源模位；画布与下载的 JSON 来自同一计算结果。
- 任何单格编辑立即触发重算，旧结论随之失效。

## 本地开发

```bash
npm install
npm run dev      # Vite 开发服务器
npm test         # Vitest：小网格全整除尺寸对拍、全未知行、冲突模位、横纵周期并列等
npm run build    # tsc 类型检查 + 产出 dist/
npm run preview  # 预览构建产物
```

## Docker Compose 运行

```bash
docker compose up --build web   # http://localhost:8080
```

可选地在容器内跑判定测试：

```bash
docker compose --profile test run --rm test
```

## 界面操作

1. 粘贴 JSON 或从文件导入；「可修复示例」「不可恢复示例」按钮可快速体验两种结局。
2. 点击样片画布选中一格，按 `A-Z` 或 `?`（也可用色板）改写该格，结论即时重算。
3. 成功时可下载结果 JSON：`unit` / `completedRows` / `filled`（含每格来源模位）。

## 目录结构

```
src/core/repeat.ts     最小重复单元判定（枚举整除尺寸 + 一致性/覆盖检查 + 排序取优）
src/core/validate.ts   导入结构校验
src/core/importer.ts   导入应用：失败保留上次合法样片
src/components/        编辑器画布、结果画布、结果视图
tests/                 Vitest 对拍与边界用例
```
