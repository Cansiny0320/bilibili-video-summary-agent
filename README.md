# Bilibili Video Summary Agent

[![npm](https://img.shields.io/npm/v/bili-summary.svg)](https://www.npmjs.com/package/bili-summary)

这是一个基于 Node.js 和 TypeScript 开发的命令行工具 (CLI)，利用 AI (OpenAI API) 自动总结 Bilibili 视频内容。它能够抓取视频字幕，生成包含关键时间点跳转的摘要，帮助用户快速获取视频核心信息。

## ✨ 功能特点

- **自动识别**：支持输入 B 站视频链接或 BV 号 (如 `BV1xx...`)。
- **智能字幕获取**：自动解析视频 CID，优先获取中文字幕，支持 AI 生成的字幕。
- **AI 智能总结**：
  - 生成精炼的视频摘要。
  - 提取关键章节并附带**时间戳** (如 `[02:30]`)，点击即可跳转 (需配合支持的播放器或仅作参考)。
  - 自动处理超长字幕，防止 Token 消耗过大。
- **音频转录**：当视频无字幕时，支持自动下载音频并使用 Whisper 模型进行转录 (需显式开启)。
- **自动评论**：支持将生成的总结自动发表到视频评论区 (需配置 `BILIBILI_JCT`)。
- **Cookie 支持**：支持配置 B 站 `SESSDATA` 以访问需要登录才能获取的资源（如某些高画质音频或受限字幕）。
- **灵活配置**：支持通过命令行参数或 `.env` 文件配置 API Key 和 Base URL。

## 🚀 快速开始

### 前置要求

- Node.js (建议 v16+)
- OpenAI API Key (或兼容 OpenAI 格式的其他 LLM API Key)
- ffmpeg (使用音频转录/切分时需要)

### 安装

#### 方式一：通过 npm 安装 (推荐)

```bash
npm install -g bili-summary
```

安装后直接使用：

```bash
bili-summary BV1uT4y1P7CX
```

也可用 npx 直接运行：

```bash
npx bili-summary BV1uT4y1P7CX
```

#### 方式二：源码安装

1. **克隆仓库**
   ```bash
   git clone https://github.com/Cansiny0320/bilibili-video-summary-agent.git
   cd bilibili-video-summary-agent
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **编译项目**
   ```bash
   pnpm build
   ```

### ⚙️ 配置

你可以创建一个 `.env` 文件来配置默认的环境变量，避免每次输入 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，支持第三方中转地址
OPENAI_CHAT_MODEL=gpt-4o-mini              # 可选，摘要模型
OPENAI_AUDIO_MODEL=doubao-seed-1-6-251015  # 可选，音频转录模型
BILIBILI_SESSDATA=xxxxxxxx  # 可选，B站 Cookie 中的 SESSDATA，用于获取更完整的字幕或高画质音频
BILIBILI_JCT=xxxxxxxx       # 可选，B站 Cookie 中的 bili_jct (CSRF Token)，仅在使用 --comment 功能时需要
VOLC_APP_KEY=xxxxxxxx       # 可选，火山引擎 App Key（启用火山语音识别）
VOLC_ACCESS_KEY=xxxxxxxx    # 可选，火山引擎 Access Key
VOLC_CLUSTER=volc_auc_common # 可选，火山引擎资源 ID
VOLC_API_URL=xxxxxxxx       # 可选，自定义火山接口地址
```

## 📖 使用说明

编译完成后，可以直接运行 `dist/index.js`：

```bash
# 基本用法 (如果已配置 .env)
./dist/index.js BV1uT4y1P7CX

# 通过命令行传入 API Key
./dist/index.js https://www.bilibili.com/video/BV1uT4y1P7CX -k sk-xxxx

# 保存总结到文件
./dist/index.js BV1uT4y1P7CX -o summary.md

# 指定模型 (默认 gpt-4o-mini)
./dist/index.js BV1uT4y1P7CX -m gpt-4

# 开启无字幕视频的音频转录
./dist/index.js BV1uT4y1P7CX --transcribe

# 强制使用音频转录（忽略字幕）
./dist/index.js BV1uT4y1P7CX --force-transcribe

# 发布评论到视频（需要 BILIBILI_JCT + SESSDATA）
./dist/index.js BV1uT4y1P7CX --comment

# 指定分P（示例：P2）
./dist/index.js https://www.bilibili.com/video/BV1uT4y1P7CX?p=2
```

### 命令参数

```text
Usage: bili-summary [options] <video_id>

Arguments:
  video_id              Bilibili BV ID or URL

Options:
  -V, --version         output the version number
  -k, --key <key>       OpenAI API Key
  -b, --base-url <url>  OpenAI Base URL
  -m, --model <model>   OpenAI Model (default: gpt-4o-mini)
  -o, --output <file>   Save summary to file
  --comment             Post summary as a comment on the video
  --transcribe          Enable audio transcription if subtitles are missing
  --force-transcribe    Force audio transcription even if subtitles exist
  -h, --help            display help for command
```

## 📦 环境变量说明

```text
OPENAI_API_KEY        OpenAI API Key（必需，除非使用其他兼容服务）
OPENAI_BASE_URL       OpenAI Base URL（可选，默认 https://api.openai.com/v1）
OPENAI_CHAT_MODEL     摘要模型（可选，默认 gpt-4o-mini）
OPENAI_AUDIO_MODEL    音频转录模型（可选，默认 doubao-seed-1-6-251015）
BILIBILI_SESSDATA     B站 Cookie，获取更完整字幕/音频（可选）
BILIBILI_JCT          B站 CSRF Token，发评论必需（可选）
VOLC_APP_KEY          火山 App Key（可选，启用火山转录）
VOLC_ACCESS_KEY       火山 Access Key（可选）
VOLC_CLUSTER          火山资源 ID（可选）
VOLC_API_URL          火山接口地址（可选）
```

## ✅ 常见问题

1. **提示没有字幕**
   - 使用 `--transcribe` 或 `--force-transcribe` 开启音频转录。

2. **音频转录报错或无法切分**
   - 请确保本机已安装 `ffmpeg` 且在 PATH 中可用。

3. **发布评论失败**
   - 需要同时配置 `BILIBILI_JCT` 和 `BILIBILI_SESSDATA`。

4. **火山识别失败**
   - 确认 App Key/Access Key/Cluster 正确，并检查账号是否开通“一句话识别”或“Flash 识别”。

## 🚢 发布流程

```bash
# 版本变更（示例：patch）
npm version patch

# 构建并发布
npm publish --access public

# 生成 GitHub Release
gh release create vX.Y.Z -t "vX.Y.Z" -n "Release notes"
```

## 🛠️ 开发

开发需要安装 pnpm：

```bash
# 运行 TypeScript 源码 (无需编译)
pnpm dev BV1uT4y1P7CX

# 编译 TS 到 JS
pnpm build
```

## 📝 License

MIT
