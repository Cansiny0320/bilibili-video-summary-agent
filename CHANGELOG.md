## [1.1.1](https://github.com/Cansiny0320/bilibili-video-summary-agent/compare/v1.1.0...v1.1.1) (2026-10-12)

### Bug Fixes

- 使用 WBI 播放器接口获取字幕，严格校验 `bvid`、`aid` 和 `cid`；页面元数据属于当前分 P 时，同时校验字幕 ID，避免下载其他视频或分 P 的字幕。
- 修复多 P 页面元数据仍属于 P1 时的字幕匹配；无法验证或重试耗尽时返回空字幕，保留已有的可选音频转录流程。
- 过滤空字幕 URL，避免不可用的高优先级语言遮挡可用字幕。
- CLI 的 `--version` 从 `package.json` 读取，确保与发布版本一致。

### Maintenance

- 构建切换至 `tsdown`，更新 TypeScript、ESLint 和 Vitest 工具链。
- 增加字幕身份、错配重试、多 P 和 CLI 版本回归检查。

# [1.1.0](https://github.com/Cansiny0320/bilibili-video-summary-agent/compare/v1.0.1...v1.1.0) (2026-01-11)


### Features

* **cli:** allow config via flags ([1cb6d3c](https://github.com/Cansiny0320/bilibili-video-summary-agent/commit/1cb6d3c7a56729142ec91bb9e7186714f5c38a77))

## [1.0.1](https://github.com/Cansiny0320/bilibili-video-summary-agent/compare/v1.0.0...v1.0.1) (2026-01-09)

### Bug Fixes

- verify trusted publisher workflow ([d2fbf09](https://github.com/Cansiny0320/bilibili-video-summary-agent/commit/d2fbf090fa6dc61c7dfc98b7878036c6deb87bca))
