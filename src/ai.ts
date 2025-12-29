import OpenAI from 'openai'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

import ffmpeg from 'fluent-ffmpeg'
import { VideoInfo, SubtitleItem } from './types'

export class AIService {
  private openai: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    })
  }

  /**
   * 将音频文件转录为带时间戳的字幕
   * 如果文件过大，自动分割并分批识别
   */
  async transcribeAudio(audioPath: string): Promise<SubtitleItem[]> {
    const stats = fs.statSync(audioPath)
    const fileSizeInMB = stats.size / (1024 * 1024)

    // OpenAI Whisper 限制 25MB，预留一点空间
    if (fileSizeInMB < 24) {
      return this.transcribeChunk(audioPath, 0)
    }

    console.log(`Audio file too large (${fileSizeInMB.toFixed(2)}MB), splitting...`)
    const chunks = await this.splitAudio(audioPath)

    let allSubtitles: SubtitleItem[] = []
    let timeOffset = 0

    for (const chunk of chunks) {
      console.log(`Transcribing chunk: ${chunk.path}...`)
      const chunkSubtitles = await this.transcribeChunk(chunk.path, timeOffset)
      allSubtitles = allSubtitles.concat(chunkSubtitles)

      // 更新时间偏移量
      timeOffset += chunk.duration

      // 清理临时分片文件
      try {
        fs.unlinkSync(chunk.path)
      } catch (e) {}
    }

    return allSubtitles
  }

  private async transcribeChunk(filePath: string, timeOffset: number): Promise<SubtitleItem[]> {
    // 优先检查是否配置了火山引擎鉴权信息
    if (process.env.VOLC_APP_KEY && process.env.VOLC_ACCESS_KEY) {
        return this.transcribeWithVolc(filePath, timeOffset);
    }

    try {
      const audioModel = process.env.OPENAI_AUDIO_MODEL || 'doubao-seed-1-6-251015'
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: audioModel,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'], // 获取分段级时间戳
      })

      // 处理 verbose_json 格式的返回
      // 修正类型定义：OpenAI SDK 的类型比较复杂，这里做简单的断言
      const segments = (response as any).segments

      if (!segments) {
        // 如果没有 segments，可能是 text 格式或者只有 text 字段
        return [
          {
            from: timeOffset,
            to: timeOffset + (response as any).duration || 0,
            content: response.text,
          },
        ]
      }

      return segments.map((seg: any) => ({
        from: seg.start + timeOffset,
        to: seg.end + timeOffset,
        content: seg.text.trim(),
      }))
    } catch (error: any) {
      throw new Error(`Whisper transcription failed: ${error.message}`)
    }
  }

  private async transcribeWithVolc(filePath: string, timeOffset: number): Promise<SubtitleItem[]> {
      try {
          const fileData = fs.readFileSync(filePath);
          const audioBase64 = fileData.toString('base64');
          const appId = process.env.VOLC_APP_KEY;
          const token = process.env.VOLC_ACCESS_KEY;
          const cluster = process.env.VOLC_CLUSTER || 'volc_auc_common';
          
          // 自动判断接口地址
          let url = 'https://openspeech.bytedance.com/api/v1/asr'; // 默认一句话识别
          if (cluster.endsWith('_turbo') || cluster.endsWith('.flash')) {
              url = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash'; // 极速版/Flash
          }
          if (process.env.VOLC_API_URL) {
              url = process.env.VOLC_API_URL;
          }

          const reqId = require('crypto').randomUUID();

          // 使用 JSON 格式
          const response = await axios.post(url, {
              app: {
                  appid: appId,
                  token: token,
                  cluster: cluster
              },
              user: {
                  uid: "bili_summary_agent"
              },
              audio: {
                  format: "mp3",
                  rate: 16000,
                  channel: 1,
                  cuted: false,
                  data: audioBase64
              },
              request: {
                  reqid: reqId,
                  workflow: "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate",
                  sequence: 1
              }
          }, {
              headers: {
                  'Content-Type': 'application/json',
                  'X-Api-App-Key': appId,
                  'X-Api-Access-Key': token,
                  'X-Api-Resource-Id': cluster,
                  'X-Api-Request-Id': reqId
              },
              maxBodyLength: Infinity,
              maxContentLength: Infinity
          });

          const data = response.data;
          
          // 极速版可能返回 resp 对象，也可能直接是 code
          const code = data.code !== undefined ? data.code : (data.resp?.code);
          const message = data.message || data.resp?.message || 'Unknown';

          // 只要有识别结果 result，就视为成功
          const hasResult = (Array.isArray(data.result) && data.result.length > 0) || 
                            (data.result && !Array.isArray(data.result) && data.result.text) ||
                            (data.resp && data.resp.text);

          // Volc API 成功时 code 通常是 1000，或者直接返回了结果
          if (!hasResult && code !== 1000 && message !== 'Success') {
               throw new Error(`Volc API Error: ${JSON.stringify(data)}`);
          }
          
          // 兼容不同接口的返回字段
          // v1/asr: data.result[0].text
          // v3/.../flash: data.resp.text (假设) 或 data.result[0].text 或 data.result.text
          let text = '';
          if (Array.isArray(data.result) && data.result[0]) {
              text = data.result[0].text;
          } else if (data.result && !Array.isArray(data.result) && data.result.text) {
              text = data.result.text;
          } else if (data.resp && data.resp.text) {
              text = data.resp.text;
          }

          return [{
              from: timeOffset,
              to: timeOffset + 50, 
              content: text
          }];

      } catch (error: any) {
          // 检查 error.response.data 中的错误信息
          const errorMsg = error.response?.data?.message || error.message;
          
          // 如果是因为 cluster 找不到，再次尝试不带 cluster 的请求
          if (errorMsg && errorMsg.includes('no available instances')) {
              console.warn(`Volc cluster '${process.env.VOLC_CLUSTER || 'volc_auc_common'}' not found/unavailable, retrying without cluster...`);
              return this.transcribeWithVolcFallback(filePath, timeOffset);
          }

          if (errorMsg && errorMsg.includes('is not allowed')) {
              console.error('\n[Error] The provided Volcengine Resource ID is not supported by the Short Audio/Flash interface.');
              console.error('Please ensure your App ID has "Short Audio Recognition" (一句话识别) or "Flash Recognition" (极速版) enabled.');
              console.error('Note: "volc.bigasr.auc" is typically for Async API (requires URL) and cannot be used with local files here.\n');
          }
          
          console.error('Volc transcription failed:', error.response?.data || error.message);
          throw new Error(`Volc transcription failed: ${error.message}`);
      }
  }

  // Fallback method without specific cluster
  private async transcribeWithVolcFallback(filePath: string, timeOffset: number): Promise<SubtitleItem[]> {
        const fileData = fs.readFileSync(filePath);
        const audioBase64 = fileData.toString('base64');
        const appId = process.env.VOLC_APP_KEY;
        const token = process.env.VOLC_ACCESS_KEY;
        const url = 'https://openspeech.bytedance.com/api/v1/asr';

        const response = await axios.post(url, {
            app: {
                appid: appId,
                token: token,
                // cluster: "volc_auc_common" // Fallback: Do NOT send cluster
            },
            user: {
                uid: "bili_summary_agent"
            },
            audio: {
                format: "mp3",
                rate: 16000,
                channel: 1,
                cuted: false,
                data: audioBase64
            },
            request: {
                reqid: require('crypto').randomUUID(),
                workflow: "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate",
                sequence: 1
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Api-App-Key': appId,
                'X-Api-Access-Key': token
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        const data = response.data;
        if (data.code !== 1000 && data.message !== 'Success') {
             throw new Error(`Volc API Error: ${JSON.stringify(data)}`);
        }
        
        const text = data.result && data.result[0] ? data.result[0].text : '';

        return [{
            from: timeOffset,
            to: timeOffset + 50, 
            content: text
        }];
  }

  /**
   * 使用 ffmpeg 切割音频
   * @param segmentDuration 切片时长(秒)，默认 600
   */
  private async splitAudio(filePath: string, segmentDuration: number = 600): Promise<{ path: string; duration: number }[]> {
    return new Promise((resolve, reject) => {
      const chunks: { path: string; duration: number }[] = []

      // 获取音频时长
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err)

        const duration = metadata.format.duration || 0
        // const segmentDuration = 600 // remove hardcode
        const numSegments = Math.ceil(duration / segmentDuration)
        const fileExt = path.extname(filePath)
        const baseName = path.basename(filePath, fileExt)
        const dir = path.dirname(filePath)

        // 生成分片计划
        const promises = []
        for (let i = 0; i < numSegments; i++) {
          const outputName = path.join(dir, `${baseName}_part${i}${fileExt}`)
          const startTime = i * segmentDuration

          // 计算当前分片的实际时长（处理最后一段）
          const currentDuration = i === numSegments - 1 ? duration - startTime : segmentDuration

          chunks.push({ path: outputName, duration: currentDuration })

          const p = new Promise<void>((res, rej) => {
            ffmpeg(filePath)
              .setStartTime(startTime)
              .setDuration(segmentDuration)
              .output(outputName)
              .on('end', () => res())
              .on('error', err => rej(err))
              .run()
          })
          promises.push(p)
        }

        Promise.all(promises)
          .then(() => resolve(chunks))
          .catch(reject)
      })
    })
  }

  private formatTime(seconds: number): string {
    const date = new Date(0)
    date.setSeconds(seconds)
    const hh = date.getUTCHours()
    const mm = date.getUTCMinutes()
    const ss = date.getUTCSeconds()

    if (hh > 0) {
      return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss
        .toString()
        .padStart(2, '0')}`
    }
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  }

  public formatSubtitles(subtitles: SubtitleItem[]): string {
    // 每隔一定时间或每隔几句合并一下，避免全是密密麻麻的时间戳
    // 这里简单处理：每一句都带时间戳，让AI自己筛选重要的
    return subtitles
      .map(item => {
        return `[${this.formatTime(item.from)}] ${item.content}`
      })
      .join('\n')
  }

  /**
   * 将 Markdown 格式的摘要转换为适合 B 站评论区的纯文本格式
   */
  public formatSummaryForComment(summary: string): string {
    return summary
      // 1. 转换 Markdown 标题 (## 标题 -> 【标题】)
      .replace(/^##\s+(.+)$/gm, '\n【$1】')
      .replace(/^##(.+)$/gm, '\n【$1】')
      // 简单清理可能存在的【】格式
      .replace(/^\n+【/gm, '\n【')

      // 2. 将无序列表 (- ) 转换为点号 (• )
      .replace(/^-\s+/gm, '• ')

      // 3. 去除加粗符号 (**)
      .replace(/\*\*(.*?)\*\*/g, '$1')

      // 4. 去除多余的空行 (超过2行变成2行)
      .replace(/\n{3,}/g, '\n\n')
      
      // 5. 去除首尾空白
      .trim()
  }

  async summarize(
    videoInfo: VideoInfo,
    subtitles: SubtitleItem[],
    model: string = 'deepseek-v3-2-251201',
  ): Promise<string> {
    const formattedSubtitles = this.formatSubtitles(subtitles)

    // 简单长度保护 (防止超长消耗巨额token)
    // 假设平均一个汉字/单词算 1-2 token，保留约 30000 字符大概是安全范围
    // 如果字幕极长，截取前 50000 个字符
    const maxLength = 50000
    let contentToSend = formattedSubtitles
    if (contentToSend.length > maxLength) {
      console.warn(
        `Subtitle content too long (${contentToSend.length} chars), truncating to ${maxLength} chars...`,
      )
      contentToSend = contentToSend.substring(0, maxLength) + '\n...(content truncated)...'
    }

    const systemPrompt = `
你是一个专业的视频内容总结助手。
你的任务是根据提供的 B 站视频元数据（标题、简介）和带时间戳的字幕内容，生成一份高质量的视频总结。

要求：
1. **摘要**：用 2-3 句话概括视频的核心主题和主要内容。
2. **章节速览**：列出视频的关键节点和主要观点。
   - 每个要点必须包含准确的时间戳链接（格式如 [02:15]）。
   - 时间戳应对应相关内容开始的时间。
   - 描述要简洁明了。
3. **风格**：客观、清晰，便于用户快速获取信息。
4. **格式**：直接生成适合 B 站评论区的纯文本格式，**不要使用 Markdown 语法**（如 ##, **, - 等）。
   - 标题使用【】包裹（如【摘要】）。
   - 列表项使用 "• " 开头。
   - 重点内容直接叙述，无需加粗。

示例输出：
【摘要】
本视频详细介绍了...

【关键要点】
• [00:30] 介绍了项目背景...
• [02:15] 详细演示了核心功能...
• [05:40] 总结了优缺点...
`

    const userMessage = `
视频标题：${videoInfo.title}
视频简介：${videoInfo.desc.substring(0, 500)}...

字幕内容：
${contentToSend}
`

    try {
      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 1,
      })

      return completion.choices[0]?.message?.content || '未能生成总结。'
    } catch (error: any) {
      throw new Error(`AI generation failed: ${error.message}`)
    }
  }
}
