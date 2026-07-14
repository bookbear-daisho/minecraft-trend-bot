import { VideoRecord } from "../types/video";

/**
 * trendScore(週間再生数の伸び + 高評価 + コメントの加重合計)降順で上位N件を返す。
 * Adaptive Card表示とSharePoint保存の両方で同じ並び順を使うための共通ロジック。
 */
export function rankVideos(videos: VideoRecord[], topN: number): VideoRecord[] {
  return [...videos].sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0)).slice(0, topN);
}
