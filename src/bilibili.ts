import axios from 'axios';
import { VideoInfo, SubtitleItem, BilibiliSubtitleListResponse } from './types';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class BilibiliClient {
    private client = axios.create({
        headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://www.bilibili.com'
        }
    });

    /**
     * 从 BV 号获取视频信息 (CID, 标题等)
     */
    async getVideoInfo(bvid: string): Promise<VideoInfo> {
        try {
            const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
            const response = await this.client.get(url);
            const data = response.data;

            if (data.code !== 0) {
                throw new Error(`Failed to get video info: ${data.message}`);
            }

            const videoData = data.data;
            return {
                bvid: videoData.bvid,
                aid: videoData.aid,
                cid: videoData.cid,
                title: videoData.title,
                desc: videoData.desc,
                pic: videoData.pic,
                duration: videoData.duration,
                pubdate: videoData.pubdate
            };
        } catch (error: any) {
            throw new Error(`Error fetching video info: ${error.message}`);
        }
    }

    /**
     * 获取视频字幕
     * 优先获取中文 (zh-CN), 其次是 AI 生成的中文, 最后是列表第一个
     */
    async getSubtitles(bvid: string, cid: number): Promise<SubtitleItem[]> {
        try {
            const url = `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`;
            const response = await this.client.get(url);
            const data = response.data;

            if (data.code !== 0) {
                // 有些视频可能没有字幕，不一定是错误，但这里抛出错误让上层处理
                console.warn(`Player API warning: ${data.message}`);
                return [];
            }

            const subtitles = data.data.subtitle?.subtitles;
            if (!subtitles || subtitles.length === 0) {
                return [];
            }

            // 策略: 找 zh-CN -> 找包含 "zh" 的 -> 第一个
            let targetSubtitle = subtitles.find((s: any) => s.lan === 'zh-CN');
            if (!targetSubtitle) {
                targetSubtitle = subtitles.find((s: any) => s.lan.startsWith('zh'));
            }
            if (!targetSubtitle) {
                targetSubtitle = subtitles[0];
            }

            if (!targetSubtitle) {
                return [];
            }

            // 字幕 URL 可能是 http，强制转 https 以防万一 (虽然 axios 都支持)
            const subtitleUrl = targetSubtitle.subtitle_url.startsWith('//') 
                ? `https:${targetSubtitle.subtitle_url}` 
                : targetSubtitle.subtitle_url;

            return await this.fetchSubtitleContent(subtitleUrl);

        } catch (error: any) {
            console.error(`Error fetching subtitles list: ${error.message}`);
            return [];
        }
    }

    /**
     * 下载并解析字幕 JSON
     */
    private async fetchSubtitleContent(url: string): Promise<SubtitleItem[]> {
        try {
            const response = await this.client.get(url);
            const json = response.data;
            
            // B站字幕格式: { body: [ { from, to, content }, ... ] }
            if (json.body && Array.isArray(json.body)) {
                return json.body.map((item: any) => ({
                    from: item.from,
                    to: item.to,
                    content: item.content
                }));
            }
            return [];
        } catch (error: any) {
            throw new Error(`Failed to download subtitle content: ${error.message}`);
        }
    }

    /**
     * 工具函数: 从链接或文本中提取 BV 号
     */
    static extractBvid(input: string): string | null {
        const regex = /(BV[a-zA-Z0-9]{10})/;
        const match = input.match(regex);
        return match ? match[1] : null;
    }
}
