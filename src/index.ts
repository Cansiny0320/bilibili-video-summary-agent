#!/usr/bin/env node
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { BilibiliClient } from './bilibili';
import { AIService } from './ai';

// 加载环境变量
dotenv.config();

const program = new Command();

program
    .name('bili-summary')
    .description('Bilibili Video Summary AI Agent')
    .version('1.0.0')
    .argument('<video_id>', 'Bilibili BV ID or URL')
    .option('-k, --key <key>', 'OpenAI API Key')
    .option('-b, --base-url <url>', 'OpenAI Base URL')
    .option('-m, --model <model>', 'OpenAI Model (default: gpt-4o-mini)')
    .option('-o, --output <file>', 'Save summary to file')
    .action(async (videoId, options) => {
        try {
            // 1. 获取 API Key
            const apiKey = options.key || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                console.error('Error: OpenAI API Key is required. Please provide it via --key option or OPENAI_API_KEY environment variable.');
                process.exit(1);
            }

            const baseURL = options.baseUrl || process.env.OPENAI_BASE_URL;

            // 2. 解析 BV 号
            let bvid: string;
            const extracted = BilibiliClient.extractBvid(videoId);
            if (extracted) {
                bvid = extracted;
            } else if (videoId.startsWith('BV') || videoId.startsWith('bv')) {
                bvid = videoId;
            } else {
                console.error('Error: Invalid Bilibili video ID or URL.');
                process.exit(1);
            }

            console.log(`Fetching video info for ${bvid}...`);
            
            // 3. 初始化客户端
            const biliClient = new BilibiliClient();
            const aiService = new AIService(apiKey, baseURL);

            // 4. 获取视频信息
            const videoInfo = await biliClient.getVideoInfo(bvid);
            console.log(`Title: ${videoInfo.title}`);
            console.log(`Duration: ${Math.floor(videoInfo.duration / 60)}m ${videoInfo.duration % 60}s`);

            // 5. 获取字幕
            console.log('Fetching subtitles...');
            const subtitles = await biliClient.getSubtitles(bvid, videoInfo.cid);
            
            if (subtitles.length === 0) {
                console.error('Error: No subtitles found for this video. Cannot generate summary.');
                process.exit(1);
            }
            console.log(`Found subtitles (${subtitles.length} lines). Generating summary...`);

            // 6. 生成总结
            const summary = await aiService.summarize(videoInfo, subtitles);

            // 7. 输出结果
            console.log('\n' + '='.repeat(50));
            console.log('VIDEO SUMMARY');
            console.log('='.repeat(50) + '\n');
            console.log(summary);
            console.log('\n' + '='.repeat(50));

            // 保存到文件
            if (options.output) {
                fs.writeFileSync(options.output, summary);
                console.log(`Summary saved to ${options.output}`);
            }

        } catch (error: any) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    });

program.parse();
