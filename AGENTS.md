# AGENTS.md（仓库根目录）

本文件面向在本仓库工作的 agent/贡献者：如何构建/运行/检查，以及应遵守的代码与工作流约束。

## 0) 基本信息

- 项目类型：Node.js + TypeScript CLI
- CLI 名称：`bili-summary`
- 入口：`src/index.ts`
- 构建输出：`dist/`（由 `tsup` 生成）
- 包管理：优先 `pnpm`（仓库包含 `pnpm-lock.yaml`）
- 平台：本地常见为 Windows（PowerShell），CI 为 Ubuntu（GitHub Actions）

## 1) 快速命令（本地）

> 说明：仓库已引入 ESLint + Prettier（见 `eslint.config.mjs`、`.prettierrc.json`）。测试框架仍未引入。

### 安装依赖

- 推荐：`pnpm install`

（不推荐，但可用）

- `npm install`

### 构建

- `pnpm build`
  - 实际执行：`tsup`（见 `package.json` 与 `tsup.config.ts`）
  - 产物：`dist/index.js`（CJS）/ `dist/index.mjs`（ESM）+ 类型声明（d.ts）

### 运行（构建后）

- `node dist/index.js <video_id> [options]`
- `pnpm start -- <video_id> [options]`
  - 注意：传参请用 `--`，避免 pnpm/npm 把参数当作自身参数。

### 开发（直接运行 TS）

- `pnpm dev -- <video_id> [options]`
  - 实际执行：`ts-node src/index.ts`

### 纯类型检查（推荐补充）

仓库启用了 `strict: true`（见 `tsconfig.json`）。

- `pnpm typecheck`

## 2) Lint / Format

已引入 ESLint + Prettier，用于统一风格与基础代码质量检查。

- ESLint：配置见 `eslint.config.mjs`
  - `pnpm lint`
  - `pnpm lint:fix`
  - 单文件：`pnpm exec eslint src/index.ts`
- Prettier：配置见 `.prettierrc.json` / `.prettierignore`
  - `pnpm format`
  - `pnpm format:check`
  - 单文件：`pnpm exec prettier --write src/index.ts`

约束：

- 避免手工对齐空格/换行，优先用 Prettier 生成一致 diff。
- 当前 `pnpm lint` 已配置为 `--max-warnings 0`，默认要求零 warning。

## 3) 测试（包含“单测/单文件单测”）

当前仓库没有测试框架与测试目录；`package.json` 中 `test` 脚本会直接失败：

- `pnpm test` → `Error: no test specified`（退出码 1）

结论：

- 当前不存在“运行单个测试”的官方命令（例如 vitest/jest）
- 若后续引入测试框架，请在此处补充：
  - 全量测试命令
  - 单文件/单用例命令
  - watch 模式命令

## 4) 配置与环境变量

- CLI 通过 `dotenv` 加载环境变量（见 `src/index.ts`）
- 示例文件：`.env.example`
- `.env` 已在 `.gitignore` 中忽略；严禁提交真实密钥

常见环境变量（以 README / `.env.example` 为准）：

- `OPENAI_API_KEY`（必需，除非显式通过 CLI 参数传入）
- `OPENAI_BASE_URL`、`OPENAI_CHAT_MODEL`、`OPENAI_AUDIO_MODEL`
- `BILIBILI_SESSDATA`、`BILIBILI_JCT`
- `VOLC_APP_KEY`、`VOLC_ACCESS_KEY`、`VOLC_CLUSTER`、`VOLC_API_URL`

约束：新增任何环境变量必须同步更新：

1. `.env.example`
2. `README.md` 的“环境变量说明”

## 5) 临时文件与目录

运行期间可能创建：

- `temp_audio/`：音频下载/转录相关
- `temp_subtitles/`：字幕临时文件（`.gitignore` 已忽略）

约束：

- 不要提交临时产物（音频、字幕、转录中间文件）
- 如果新增新的临时目录，记得更新 `.gitignore`

## 6) CI / 发布（重要）

- CI 配置：
  - `.github/workflows/ci.yml`：push + pull_request 时执行 `pnpm typecheck` / `pnpm lint`
  - `.github/workflows/release.yml`：push 到 `master` 时执行构建 + semantic-release +（可选）发布
- Node 版本：CI 使用 Node `22`
- pnpm：CI 使用 pnpm `10`

Release workflow 主要流程：

1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `npx semantic-release`
4. 若检测到新版本且与 npm 当前版本不同，则 `npm publish`（启用 provenance）
5. 创建 GitHub Release（从 `CHANGELOG.md` 抽取对应版本的 notes）

## 7) Git hooks（提交前检查）

仓库使用 Husky，在 `git commit` 前会自动运行：

- `pnpm typecheck`
- `pnpm lint`

如果想跳过（不建议）：`git commit --no-verify`

## 8) 提交信息（Conventional Commits）

仓库使用 semantic-release（见 `.releaserc.json`），提交信息会影响版本发布。

建议使用 Conventional Commits：

- `feat: ...`（新功能）
- `fix: ...`（修复）
- `docs: ...`、`chore: ...`、`refactor: ...` 等
- 破坏性变更：使用 `!` 或 `BREAKING CHANGE:`

## 8) 代码风格与工程实践（基于现状）

### 核心原则：减少无意义 diff

- 代码风格以 Prettier 为准（见 `.prettierrc.json`），不要手工对齐空格/换行。
- 修改既有文件时，仍应避免把不相关的“逻辑重排”混入业务改动；纯格式统一请通过 `pnpm format` 完成。

### Imports

建议（在不引入全文件重排的前提下）：

- 分组顺序：第三方依赖 → Node 内置模块 → 本地模块（`./...`）
- 避免循环依赖；公共类型放到 `src/types.ts`

### Types

- 尽量避免 `any`：
  - 优先 `unknown` + 类型收窄
  - 或在 `src/types.ts` 补全接口以贴合真实响应
- 不要用 `@ts-ignore` / `@ts-expect-error` 隐藏错误

### 错误处理

- 允许 `try/catch`，并在 rethrow 时带上上下文：
  - 例如：`throw new Error(`Error fetching video info: ${error.message}`)`
- 避免空 `catch {}`；需要吞错时应解释原因并尽量限制影响范围

### 日志

- 当前使用 `console.log/warn/error`
- 避免遗留大量 `DEBUG:` 日志；如需要可控调试，建议通过环境变量开关（后续引入时补充到本文件与 `.env.example`）

## 9) Agent 规则文件（Cursor / Copilot）

未检测到以下文件（如后续新增，请在此处补充摘要，避免 agent 忽略）：

- `.cursorrules`
- `.cursor/rules/*`
- `.github/copilot-instructions.md`
