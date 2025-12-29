export interface SubtitleItem {
    from: number; // 开始时间 (秒)
    to: number;   // 结束时间 (秒)
    content: string; // 字幕文本
    location?: number;
}

export interface VideoInfo {
    bvid: string;
    aid: number;
    cid: number;
    title: string;
    desc: string;
    pic: string; // 封面图
    duration: number;
    pubdate: number;
    totalPages: number; // 总分P数
    currentPage: number; // 当前分P
}

export interface BilibiliSubtitleListResponse {
    code: number;
    message: string;
    ttl: number;
    data: {
        lan: string;
        lan_doc: string;
        is_lock: boolean;
        subtitle_url: string;
        type: number;
        id: number;
        id_str: string;
        ai_type: number;
        ai_status: number;
        author: {
            mid: number;
            name: string;
            sex: string;
            face: string;
            sign: string;
            rank: number;
            birthday: number;
            is_fake_account: number;
            is_deleted: number;
        }
    }[];
}
