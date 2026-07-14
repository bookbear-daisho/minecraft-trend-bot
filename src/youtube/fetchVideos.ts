import { MAX_RESULTS_PER_QUERY, SEARCH_QUERIES, TARGET_CHANNELS, TARGET_DAYS } from "../config";
import { VideoRecord } from "../types/video";
import { getVideoStatistics, searchVideos, YoutubeVideoItem } from "./youtubeClient";

function publishedAfterIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function pickThumbnail(thumbnails?: YoutubeVideoItem["snippet"]["thumbnails"]): string | undefined {
  return thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url;
}

function toVideoRecord(item: YoutubeVideoItem, fetchedAt: string): VideoRecord {
  const statistics = item.statistics ?? {};
  return {
    videoId: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
    description: item.snippet.description ?? "",

    viewCount: Number(statistics.viewCount ?? 0),
    likeCount: Number(statistics.likeCount ?? 0),
    commentCount: Number(statistics.commentCount ?? 0),

    fetchedAt,

    // タグ・スコアは analysis/classifyVideos.ts で確定させる
    tags: [],
    category: "未分類",
    curriculumFitScore: 0,
    videoIdeaFitScore: 0,
  };
}

/**
 * 検索キーワード・固定観測チャンネルから動画IDを収集し、統計情報付きの VideoRecord[] を返す。
 * videoId で重複排除済み。
 */
export async function fetchVideos(): Promise<VideoRecord[]> {
  const publishedAfter = publishedAfterIso(TARGET_DAYS);
  const videoIds = new Set<string>();

  for (const q of SEARCH_QUERIES) {
    const items = await searchVideos({ q, maxResults: MAX_RESULTS_PER_QUERY, publishedAfter });
    for (const item of items) {
      if (item.id.videoId) videoIds.add(item.id.videoId);
    }
  }

  for (const channelId of TARGET_CHANNELS) {
    const items = await searchVideos({ channelId, maxResults: MAX_RESULTS_PER_QUERY, publishedAfter });
    for (const item of items) {
      if (item.id.videoId) videoIds.add(item.id.videoId);
    }
  }

  if (videoIds.size === 0) {
    return [];
  }

  const fetchedAt = new Date().toISOString();
  const videoItems = await getVideoStatistics([...videoIds]);
  return videoItems.map((item) => toVideoRecord(item, fetchedAt));
}
