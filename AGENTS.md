# AGENTS.md（仓库根目录）

本文件面向在本仓库工作的 agent/贡献者：如何构建/运行/检查，以及应遵守的代码与工作流约束。

## 0) 基本信息

- 项目类型：Node.js + TypeScript CLI（ESM）
- CLI 名称：`bili-summary`
- 入口：`src/index.ts`
- 构建输出：`dist/`（由 `tsdown` 生成，主要产物 `dist/index.mjs` + `dist/index.d.mts`）
- 包管理：`pnpm`（建议配合 `@antfu/ni` 使用 `nci` / `nr`）

## 1) 常用命令（本地）

### 安装依赖

- `pnpm i`
- 或（推荐）：`pnpm i -g @antfu/ni` 后用 `nci`

### 开发（直接运行 TS）

- `pnpm dev -- <video_id> [options]`

### 构建

- `pnpm build`

### 运行（构建后）

- `pnpm start -- <video_id> [options]`

### 质量检查

- `pnpm lint`
- `pnpm typecheck`

### 测试

- `pnpm test`
- 运行单测文件：`pnpm test -- test/parseInput.test.ts`
- 按用例名过滤：`pnpm test -- -t "parse BV"`

## 2) 环境变量与配置

- CLI 通过 `dotenv` 加载环境变量（见 `src/index.ts`）
- 示例文件：`.env.example`
- `.env` 已在 `.gitignore` 中忽略；严禁提交真实密钥

常见环境变量（以 README / `.env.example` 为准）：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`、`OPENAI_CHAT_MODEL`、`OPENAI_AUDIO_MODEL`
- `BILIBILI_SESSDATA`、`BILIBILI_JCT`
- `VOLC_APP_KEY`、`VOLC_ACCESS_KEY`、`VOLC_CLUSTER`、`VOLC_API_URL`

约束：新增任何环境变量必须同步更新：

1. `.env.example`
2. `README.md` 的环境变量说明

## 3) 临时文件与目录

运行期间可能创建：

- `temp_audio/`：音频下载/转录相关
- `temp_subtitles/`：字幕临时文件

约束：

- 不要提交临时产物（音频、字幕、转录中间文件）
- 如果新增新的临时目录，记得更新 `.gitignore`

## 4) Git hooks（提交前检查）

仓库使用 `simple-git-hooks` + `lint-staged`。

- `prepare`：`pnpm prepare`（安装 hooks）
- `pre-commit`：确保依赖一致后再执行 `lint-staged`
- `lint-staged`：对暂存文件执行 `eslint --fix`

## 5) CI / Release

- CI：`.github/workflows/ci.yml`
  - `lint`：`nr lint` + `nr typecheck`
  - `test`：多平台（Ubuntu/Windows/macOS）运行 `nr build` + `nr test`

- Release：`.github/workflows/release.yml`
  - 触发：push tag `v*`
  - 说明：如果启用了 npm Trusted Publisher，tag 推送将触发 CI 发布

## 6) 代码约束（硬规则）

- 禁止使用 `@ts-ignore` / `@ts-expect-error` 隐藏错误
- 需要吞错时不要写空的 `catch {}`；必须解释原因并尽量限制影响范围
- CLI 允许 `console.*` 与 `process.exit()`
