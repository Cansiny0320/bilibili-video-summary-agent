# Bilibili Video Summary Agent

[![npm](https://img.shields.io/npm/v/bili-summary.svg)](https://www.npmjs.com/package/bili-summary)

一个命令行工具（CLI）：输入 B 站视频 BV 号或链接，自动获取字幕（或按需转录音频），用 LLM 生成「摘要 + 关键要点（带时间戳）」；可选自动发到评论区。

## 功能

- 支持输入 BV 号或视频 URL（含分 P 参数）
- 自动获取中文字幕（优先 AI 生成中文）
- 无字幕时可选音频转录（需要 ffmpeg）
- 生成适合评论区的纯文本总结（含时间戳）
- 可选自动评论（需要 B 站 Cookie 参数）
- 配置方式灵活：全部参数都可通过命令行传入（不依赖 `.env`）

## 快速开始（推荐）

### 1) 安装

```bash
npm i -g bili-summary
# 或：npm install -g bili-summary
```

### 2) 直接使用

如果你不想创建 `.env`，直接把 Key 通过命令行传入：

```bash
bili-summary BV1uT4y1P7CX -k sk-xxxx
```

如果你更习惯用 npx：

```bash
npx bili-summary BV1uT4y1P7CX -k sk-xxxx
```

查看完整参数（永远以此为准）：

```bash
bili-summary --help
```

## 常见用法

### 基本总结

```bash
bili-summary BV1uT4y1P7CX -k sk-xxxx
```

### 指定模型 / Base URL

```bash
bili-summary BV1uT4y1P7CX \
  -k sk-xxxx \
  -b https://api.openai.com/v1 \
  -m gpt-4o-mini
```

### 保存到文件

```bash
bili-summary BV1uT4y1P7CX -k sk-xxxx -o summary.txt
```

### 没有字幕时启用音频转录

需要本机安装 `ffmpeg`。

```bash
bili-summary BV1uT4y1P7CX -k sk-xxxx --transcribe
```

指定转录模型：

```bash
bili-summary BV1uT4y1P7CX -k sk-xxxx --transcribe --audio-model doubao-seed-1-6-251015
```

强制转录（忽略字幕）：

```bash
bili-summary BV1uT4y1P7CX -k sk-xxxx --force-transcribe
```

### 自动发评论（不需要写 .env）

```bash
bili-summary BV1uT4y1P7CX \
  -k sk-xxxx \
  --comment \
  --sessdata "SESSDATA_VALUE" \
  --jct "BILI_JCT_VALUE"
```

### 分 P

```bash
bili-summary "https://www.bilibili.com/video/BV1uT4y1P7CX?p=2" -k sk-xxxx
```

### 使用火山（Volcengine）语音识别转录

当设置了 `--volc-app-key/--volc-access-key` 时，会优先使用火山语音识别。

```bash
bili-summary BV1uT4y1P7CX \
  --transcribe \
  --volc-app-key "xxx" \
  --volc-access-key "yyy" \
  --volc-cluster "volc_auc_common"
```

## 参数速查（摘要）

> 以 `bili-summary --help` 输出为准。

- `-k, --key <key>`：OpenAI API Key（或兼容服务）
- `-b, --base-url <url>`：OpenAI Base URL
- `-m, --model <model>`：用于总结的 Chat 模型
- `--audio-model <model>`：音频转录模型
- `-o, --output <file>`：保存结果到文件
- `--transcribe`：无字幕时转录音频
- `--force-transcribe`：强制转录（忽略字幕）
- `--comment`：发布总结到评论区
- `--sessdata <sessdata>`：B 站 Cookie（SESSDATA 值）
- `--jct <jct>`：B 站 CSRF（bili_jct）
- `--volc-app-key <key>` / `--volc-access-key <key>`：火山鉴权
- `--volc-cluster <cluster>` / `--volc-api-url <url>`：火山资源与地址

## 常见问题

- 提示没有字幕：使用 `--transcribe` 或 `--force-transcribe`。
- 转录报错/无法切分：确认安装 `ffmpeg`，并且在 PATH 中可用。
- 评论失败：需要同时提供 `--sessdata` 与 `--jct`（或在环境变量里配置）。

## 配置（可选：使用 .env 作为默认值）

你可以完全不创建 `.env`；但如果你希望避免每次都输入参数，可以使用 `.env`。

`.env` 放置位置：

- 如果你在仓库里运行 `pnpm dev` / `pnpm start`，把 `.env` 放在仓库根目录（与 `package.json` 同级）。
- 如果你全局安装后在任意目录运行 `bili-summary` / `npx bili-summary`，把 `.env` 放在你执行命令的当前目录（也就是 shell 的工作目录）。

创建示例：

```bash
cp .env.example .env
```

常用变量（示例，完整列表见 `.env.example`）：

```env
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_AUDIO_MODEL=doubao-seed-1-6-251015

BILIBILI_SESSDATA=xxxx
BILIBILI_JCT=yyyy

VOLC_APP_KEY=xxx
VOLC_ACCESS_KEY=yyy
VOLC_CLUSTER=volc_auc_common
VOLC_API_URL=https://openspeech.bytedance.com/api/v1/asr
```

优先级：命令行参数 > 环境变量（`.env` / 系统环境）> 默认值。

## 开发（仓库贡献者）

```bash
pnpm install

# 直接跑 TS
pnpm dev -- BV1uT4y1P7CX -k sk-xxxx

# 构建后运行
pnpm build
pnpm start -- BV1uT4y1P7CX -k sk-xxxx

# 质量检查
pnpm format:check
pnpm typecheck
pnpm lint
```

## License

MIT
