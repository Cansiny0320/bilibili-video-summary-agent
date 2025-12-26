import OpenAI from 'openai';
import { VideoInfo, SubtitleItem } from './types';

export class AIService {
    private openai: OpenAI;

    constructor(apiKey: string, baseURL?: string) {
        this.openai = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL || 'https://api.openai.com/v1',
        });
    }

    private formatTime(seconds: number): string {
        const date = new Date(0);
        date.setSeconds(seconds);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds();
        
        if (hh > 0) {
            return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
        }
        return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    }

    private formatSubtitles(subtitles: SubtitleItem[]): string {
        // 每隔一定时间或每隔几句合并一下，避免全是密密麻麻的时间戳
        // 这里简单处理：每一句都带时间戳，让AI自己筛选重要的
        return subtitles.map(item => {
            return `[${this.formatTime(item.from)}] ${item.content}`;
        }).join('\n');
    }

    async summarize(videoInfo: VideoInfo, subtitles: SubtitleItem[]): Promise<string> {
        const formattedSubtitles = this.formatSubtitles(subtitles);
        
        // 简单长度保护 (防止超长消耗巨额token)
        // 假设平均一个汉字/单词算 1-2 token，保留约 30000 字符大概是安全范围
        // 如果字幕极长，截取前 50000 个字符
        const maxLength = 50000;
        let contentToSend = formattedSubtitles;
        if (contentToSend.length > maxLength) {
            console.warn(`Subtitle content too long (${contentToSend.length} chars), truncating to ${maxLength} chars...`);
            contentToSend = contentToSend.substring(0, maxLength) + "\n...(content truncated)...";
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
4. **输出格式**：Markdown。

示例输出：
## 摘要
本视频详细介绍了...

## 关键要点
- [00:30] 介绍了项目背景...
- [02:15] 详细演示了核心功能...
- [05:40] 总结了优缺点...
`;

        const userMessage = `
视频标题：${videoInfo.title}
视频简介：${videoInfo.desc.substring(0, 500)}...

字幕内容：
${contentToSend}
`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini", // 默认使用性价比高的模型，或者让用户选
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7,
            });

            return completion.choices[0]?.message?.content || "未能生成总结。";
        } catch (error: any) {
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }
}
