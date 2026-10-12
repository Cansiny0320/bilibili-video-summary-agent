import type { SubtitleItem, VideoInfo } from './types'
import * as fs from 'node:fs'
import axios from 'axios'

const USER_AGENT
  = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class BilibiliClient {
  private client = axios.create({
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': 'https://www.bilibili.com',
      'Cookie': process.env.BILIBILI_SESSDATA ? `SESSDATA=${process.env.BILIBILI_SESSDATA}` : '',
    },
  })

  /**
   * 从 BV 号获取视频信息 (CID, 标题等)
   * @param bvid BV号
   * @param page 分P号，从1开始，默认1
   */
  async getVideoInfo(bvid: string, page: number = 1): Promise<VideoInfo> {
    try {
      const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      const response = await this.client.get(url)
      const data = response.data

      if (data.code !== 0) {
        throw new Error(`Failed to get video info: ${data.message}`)
      }

      const videoData = data.data
      let cid = videoData.cid
      let title = videoData.title
      let duration = videoData.duration
      let totalPages = 1
      let currentPage = 1

      // 处理分P
      if (videoData.pages && videoData.pages.length > 0) {
        totalPages = videoData.pages.length
        // 确保 page 在有效范围内
        const targetPage = Math.max(1, Math.min(page, videoData.pages.length))
        currentPage = targetPage
        const pageInfo = videoData.pages.find((p: any) => p.page === targetPage)

        if (pageInfo) {
          cid = pageInfo.cid
          // 如果是分P，标题通常建议加上分P标题
          if (videoData.pages.length > 1) {
            title = `${title} - P${targetPage} ${pageInfo.part}`
            duration = pageInfo.duration // 分P有自己的时长
          }
        }
      }

      return {
        bvid: videoData.bvid,
        aid: videoData.aid,
        cid,
        title,
        desc: videoData.desc,
        pic: videoData.pic,
        duration,
        pubdate: videoData.pubdate,
        totalPages,
        currentPage,
      }
    }
    catch (error: any) {
      throw new Error(`Error fetching video info: ${error.message}`)
    }
  }

  /**
   * HTML 的字幕元数据可能始终属于 P1，因此同时返回它实际所属的 CID。
   */
  private async getSubtitleMetadataFromHtml(bvid: string, page: number = 1): Promise<{ cid: number, ids: string[] } | null> {
    try {
      const url = `https://www.bilibili.com/video/${bvid}?p=${page}`
      // 模仿浏览器请求
      const response = await this.client.get(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        },
      })
      const html = response.data
      const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/)

      if (match) {
        const state = JSON.parse(match[1])
        if (state.videoData?.bvid === bvid && typeof state.videoData.cid === 'number'
          && Array.isArray(state.videoData.subtitle?.list)) {
          return {
            cid: state.videoData.cid,
            ids: state.videoData.subtitle.list.map((s: any) => s.id_str || s.id.toString()),
          }
        }
      }
      return null
    }
    catch {
      console.warn('Failed to extract subtitle IDs from HTML.')
      return null
    }
  }

  /**
   * 获取视频字幕
   * 校验视频身份及适用的字幕 ID 后，优先获取 AI 中文，其次是中文字幕
   */
  async getSubtitles(bvid: string, cid: number, aid?: number, page: number = 1): Promise<SubtitleItem[]> {
    try {
      const metadata = await this.getSubtitleMetadataFromHtml(bvid, page)
      if (!metadata || (page === 1 && metadata.cid !== cid)) {
        console.warn(`Cannot verify subtitle metadata for ${bvid} P${page} (cid=${cid}); refusing unverified subtitles.`)
        return []
      }
      // 多 P 页面仍可能给出 P1 字幕，不能拿 P1 的 ID 拦截其他分 P。
      // 其他分 P 使用 WBI 播放器响应，并在下方严格校验其视频身份。
      const validIds = metadata.cid === cid ? metadata.ids : null
      if (validIds?.length === 0) {
        console.warn(`No subtitle IDs for ${bvid} P${page} (cid=${cid}). Check whether BILIBILI_SESSDATA has expired.`)
        return []
      }

      const maxRetries = 3
      for (let i = 0; i <= maxRetries; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        let url = `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&bvid=${bvid}`
        if (aid !== undefined) {
          url += `&aid=${aid}`
        }
        url += `&_=${Date.now()}&r=${Math.random()}`
        const response = await this.client.get(url)
        const data = response.data

        if (data.code !== 0) {
          console.warn(`Player API warning: ${data.message}`)
          continue
        }

        // 旧 player/v2 曾返回标识正确但字幕错配的数据，使用浏览器当前的 WBI 接口。
        const playerData = data.data
        if (playerData?.bvid !== bvid || playerData?.cid !== cid
          || (aid !== undefined && playerData?.aid !== aid)) {
          console.warn(`Player identity mismatch for ${bvid} P${page} (cid=${cid}); retrying.`)
          continue
        }

        const subtitles = playerData.subtitle?.subtitles
        if (!subtitles || subtitles.length === 0) {
          continue
        }

        const verified = subtitles.filter((s: any) =>
          (validIds === null || validIds.includes(s.id_str || s.id?.toString()))
          && typeof s.subtitle_url === 'string' && s.subtitle_url.trim().length > 0,
        )
        if (verified.length > 0) {
          return await this.selectBestSubtitle(verified)
        }
        console.warn(`No matching subtitle IDs with usable URLs for ${bvid} P${page} (cid=${cid}); retrying.`)
      }

      console.warn(`No verified subtitles for ${bvid} P${page} (cid=${cid}) after retries.`)
      return []
    }
    catch (error: any) {
      console.error(`Error fetching subtitles list: ${error.message}`)
      return []
    }
  }

  private async selectBestSubtitle(subtitles: any[]): Promise<SubtitleItem[]> {
    if (!subtitles || subtitles.length === 0) return []

    console.log(
      'DEBUG: Selecting best subtitle from:',
      JSON.stringify(
        subtitles.map((s: any) => ({
          id: s.id_str || s.id,
          lan: s.lan,
          url: s.subtitle_url?.substring(0, 30) + '...',
        })),
        null,
        2,
      ),
    )

    // 策略: 找 ai-zh -> 找 zh-CN -> 找包含 "zh" 的 -> 第一个
    // 语言和路径仅用于已校验字幕的排序，不能证明字幕属于目标视频。

    // 1. 筛选语言候选列表
    let candidates = subtitles.filter((s: any) => s.lan === 'ai-zh')
    if (candidates.length === 0) {
      candidates = subtitles.filter((s: any) => s.lan === 'zh-CN')
    }
    if (candidates.length === 0) {
      candidates = subtitles.filter((s: any) => s.lan.startsWith('zh'))
    }
    if (candidates.length === 0) {
      candidates = subtitles
    }

    // 2. 在候选中选择最佳字幕
    let targetSubtitle = null
    if (candidates.length > 0) {
      // 优先查找包含 ai_subtitle 的链接
      targetSubtitle = candidates.find(
        (s: any) => s.subtitle_url && s.subtitle_url.includes('/ai_subtitle/'),
      )

      // 如果没有找到，或者为了保险起见，如果存在 id_str 但没有 ai_subtitle，也可以考虑其他逻辑
      // 但目前简单回退到第一个
      if (!targetSubtitle) {
        targetSubtitle = candidates[0]
      }
    }

    if (!targetSubtitle) {
      return []
    }

    // 字幕 URL 可能是 http，强制转 https 以防万一 (虽然 axios 都支持)
    const subtitleUrl = targetSubtitle.subtitle_url.startsWith('//')
      ? `https:${targetSubtitle.subtitle_url}`
      : targetSubtitle.subtitle_url

    console.log('Subtitle URL:', subtitleUrl)

    return await this.fetchSubtitleContent(subtitleUrl)
  }

  /**
   * 下载并解析字幕 JSON
   */
  private async fetchSubtitleContent(url: string): Promise<SubtitleItem[]> {
    try {
      const response = await this.client.get(url)
      const json = response.data

      // B站字幕格式: { body: [ { from, to, content }, ... ] }
      if (json.body && Array.isArray(json.body)) {
        return json.body.map((item: any) => ({
          from: item.from,
          to: item.to,
          content: item.content,
        }))
      }
      return []
    }
    catch (error: any) {
      throw new Error(`Failed to download subtitle content: ${error.message}`)
    }
  }

  /**
   * 获取视频音频流地址 (DASH audio)
   */
  async getAudioUrl(bvid: string, cid: number): Promise<string | null> {
    try {
      // fnval=16 表示请求 DASH 格式，里面包含分离的音视频流
      const url = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`
      const response = await this.client.get(url)
      const data = response.data

      if (data.code !== 0) {
        console.warn(`PlayUrl API warning: ${data.message}`)
        return null
      }

      const dash = data.data.dash
      if (dash && dash.audio && dash.audio.length > 0) {
        // 通常第一个 audio 是质量最好的或者默认的
        // 30280: 192K, 30232: 132K, 30216: 64K
        // 这里简单取第一个
        return dash.audio[0].baseUrl
      }

      return null
    }
    catch (error: any) {
      console.error(`Error fetching audio url: ${error.message}`)
      return null
    }
  }

  /**
   * 下载音频文件到指定路径
   */
  async downloadAudio(url: string, outputPath: string): Promise<void> {
    try {
      const response = await this.client.get(url, {
        responseType: 'stream',
      })

      const writer = fs.createWriteStream(outputPath)
      response.data.pipe(writer)

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })
    }
    catch (error: any) {
      throw new Error(`Failed to download audio: ${error.message}`)
    }
  }

  /**
   * 发送视频评论
   * 需要 BILIBILI_JCT (CSRF token) 和 SESSDATA
   */
  async postComment(aid: number, message: string): Promise<boolean> {
    const jct = process.env.BILIBILI_JCT
    if (!jct) {
      console.error('Error: BILIBILI_JCT (CSRF token) is required to post comments.')
      return false
    }

    try {
      const url = 'https://api.bilibili.com/x/v2/reply/add'
      const params = new URLSearchParams()
      params.append('type', '1') // 1 = 视频
      params.append('oid', aid.toString())
      params.append('message', message)
      params.append('csrf', jct)

      const response = await this.client.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      const data = response.data
      if (data.code === 0) {
        console.log('Comment posted successfully!')
        return true
      }
      else {
        console.error(`Failed to post comment: ${data.message} (Code: ${data.code})`)
        return false
      }
    }
    catch (error: any) {
      console.error(`Error posting comment: ${error.message}`)
      return false
    }
  }

  /**
   * 工具函数: 解析输入，返回 BV 号和分P号
   */
  static parseInput(input: string): { bvid: string | null, page: number } {
    const result = { bvid: null as string | null, page: 1 }

    // 1. 尝试提取 BV 号
    const regex = /(BV[a-zA-Z0-9]{10})/
    const match = input.match(regex)

    if (match) {
      result.bvid = match[1]

      // 2. 尝试提取分P参数 (?p=2 或 &p=2)
      // 简单解析 URL 参数
      const pMatch = input.match(/[?&]p=(\d+)/)
      if (pMatch) {
        result.page = Number.parseInt(pMatch[1], 10)
      }
    }

    return result
  }

  /**
   * @deprecated Use parseInput instead
   */
  static extractBvid(input: string): string | null {
    const { bvid } = BilibiliClient.parseInput(input)
    return bvid
  }
}
