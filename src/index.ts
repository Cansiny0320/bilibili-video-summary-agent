#!/usr/bin/env node
import { Command } from 'commander'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { BilibiliClient } from './bilibili'
import { AIService } from './ai'

// 加载环境变量
dotenv.config()

const program = new Command()

program
  .name('bili-summary')
  .description('Bilibili Video Summary AI Agent')
  .version('1.0.0')
  .argument('<video_id>', 'Bilibili BV ID or URL')
  .option('-k, --key <key>', 'OpenAI API Key')
  .option('-b, --base-url <url>', 'OpenAI Base URL')
  .option('-m, --model <model>', 'OpenAI Model')
  .option('-o, --output <file>', 'Save summary to file')
  .option('--comment', 'Post summary as a comment on the video')
  .option('--transcribe', 'Enable audio transcription if subtitles are missing')
  .option('--force-transcribe', 'Force audio transcription even if subtitles exist')
  .action(async (videoId, options) => {
    try {
      // 1. 获取 API Key
      const apiKey = options.key || process.env.OPENAI_API_KEY
      if (!apiKey) {
        console.error(
          'Error: OpenAI API Key is required. Please provide it via --key option or OPENAI_API_KEY environment variable.',
        )
        process.exit(1)
      }

      const baseURL = options.baseUrl || process.env.OPENAI_BASE_URL
      // 默认模型优先级: 命令行参数 > 环境变量 > 默认值
      const model = options.model || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

      // 2. 解析 BV 号和分P
      const { bvid, page } = BilibiliClient.parseInput(videoId)

      if (!bvid) {
        console.error('Error: Invalid Bilibili video ID or URL.')
        process.exit(1)
      }

      console.log(`Fetching video info for ${bvid} (Page ${page})...`)

      // 3. 初始化客户端
      const biliClient = new BilibiliClient()
      const aiService = new AIService(apiKey, baseURL)

      // 4. 获取视频信息
      const videoInfo = await biliClient.getVideoInfo(bvid, page)
      console.log(`Title: ${videoInfo.title}`)
      console.log(`Duration: ${Math.floor(videoInfo.duration / 60)}m ${videoInfo.duration % 60}s`)

      // 多P 提示
      if (videoInfo.totalPages > 1) {
        console.log(`\nNote: This video has ${videoInfo.totalPages} parts.`)
        console.log(`Currently processing Part ${videoInfo.currentPage}.`)
        if (videoInfo.currentPage === 1 && !videoId.includes('p=')) {
          console.log(`To summarize a specific part, use the URL parameter ?p=X (e.g. ${bvid}?p=2)`)
        }
        console.log('')
      }

      // 5. 获取字幕
      let subtitles: any[] = []

      if (!options.forceTranscribe) {
        console.log('Fetching subtitles...')
        subtitles = await biliClient.getSubtitles(bvid, videoInfo.cid, videoInfo.aid)
      } else {
        console.log('Force transcription enabled. Skipping subtitle fetch.')
      }

      // 5.1 如果没有字幕，尝试音频转录
      if (subtitles.length === 0) {
        if (!options.transcribe && !options.forceTranscribe) {
          console.log('No subtitles found. Use --transcribe to enable audio transcription.')
          process.exit(0)
        }

        const reason = options.forceTranscribe
          ? 'Force transcription enabled'
          : 'No subtitles found'
        console.log(
          `${reason}. Attempting to download and transcribe audio (this may take a while)...`,
        )

        // 获取音频地址
        const audioUrl = await biliClient.getAudioUrl(bvid, videoInfo.cid)
        if (!audioUrl) {
          console.error('Error: No subtitles and no audio stream found. Cannot generate summary.')
          process.exit(1)
        }

        // 创建临时目录
        const tempDir = path.join(process.cwd(), 'temp_audio')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

        const tempAudioPath = path.join(tempDir, `${bvid}_${Date.now()}.m4s`) // B站通常是 m4s

        try {
          console.log('Downloading audio...')
          await biliClient.downloadAudio(audioUrl, tempAudioPath)

          console.log('Transcribing audio (OpenAI Whisper)...')
          subtitles = await aiService.transcribeAudio(tempAudioPath)

          // 清理临时文件
          fs.unlinkSync(tempAudioPath)
          // 尝试清理空目录
          try {
            fs.rmdirSync(tempDir)
          } catch (e) {}
        } catch (err: any) {
          console.error(`Audio processing failed: ${err.message}`)
          // 尝试清理
          if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath)
          process.exit(1)
        }
      }

      console.log(`Found subtitles (${subtitles.length} lines). Generating summary...`)

      // 保存字幕到临时文件
      const tempSubsDir = path.join(process.cwd(), 'temp_subtitles')
      if (!fs.existsSync(tempSubsDir)) fs.mkdirSync(tempSubsDir)
      const tempSubsPath = path.join(tempSubsDir, `${bvid}_${Date.now()}.txt`)
      const formattedSubs = aiService.formatSubtitles(subtitles)
      fs.writeFileSync(tempSubsPath, formattedSubs)
      console.log(`Subtitles saved to temporary file: ${tempSubsPath}`)

      // 6. 生成总结
      const summary = await aiService.summarize(videoInfo, subtitles, options.model)

      // 7. 输出结果
      console.log('\n' + '='.repeat(50))
      console.log('VIDEO SUMMARY')
      console.log('='.repeat(50) + '\n')
      console.log(summary)
      console.log('\n' + '='.repeat(50))

      // 保存到文件
      if (options.output) {
        fs.writeFileSync(options.output, summary)
        console.log(`Summary saved to ${options.output}`)
      }

      // 发送评论
      if (options.comment) {
        console.log('\nPosting summary to comments...')
        
        // 格式化为适合评论区的文本
        const commentContent = aiService.formatSummaryForComment(summary)
        
        const success = await biliClient.postComment(videoInfo.aid, commentContent)
        if (success) {
          console.log('✅ Comment posted successfully!')
        } else {
          console.log(
            '❌ Failed to post comment. Check your BILIBILI_JCT (CSRF token) and SESSDATA.',
          )
        }
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

program.parse()
