import { YOUTUBE_API_KEY } from "../config";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${path}): ${res.status} ${res.statusText} - ${body}`);
  }
  return (await res.json()) as T;
}

export type YoutubeSearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
};

type YoutubeSearchResponse = {
  items: YoutubeSearchItem[];
  nextPageToken?: string;
};

/**
 * search.list はクォータ消費が大きい(1回=100ユニット)ため、
 * 呼び出し回数(=検索キーワード数・チャンネル数)を増やしすぎないよう注意すること。
 */
export async function searchVideos(params: {
  q?: string;
  channelId?: string;
  maxResults: number;
  publishedAfter?: string;
}): Promise<YoutubeSearchItem[]> {
  const query: Record<string, string> = {
    part: "snippet",
    type: "video",
    order: "date",
    maxResults: String(Math.min(params.maxResults, 50)),
  };
  if (params.q) query.q = params.q;
  if (params.channelId) query.channelId = params.channelId;
  if (params.publishedAfter) query.publishedAfter = params.publishedAfter;

  const response = await getJson<YoutubeSearchResponse>("search", query);
  return response.items;
}

export type YoutubeVideoItem = {
  id: string;
  snippet: {
    title: string;
    description?: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

type YoutubeVideosResponse = {
  items: YoutubeVideoItem[];
};

/**
 * videos.list は最大50件のIDをまとめて指定できる(1回=1ユニット)。
 * 動画IDは必ずチャンクにまとめて呼び出し回数を最小化すること。
 */
export async function getVideoStatistics(videoIds: string[]): Promise<YoutubeVideoItem[]> {
  const results: YoutubeVideoItem[] = [];
  const chunkSize = 50;

  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const chunk = videoIds.slice(i, i + chunkSize);
    const response = await getJson<YoutubeVideosResponse>("videos", {
      part: "snippet,statistics",
      id: chunk.join(","),
    });
    results.push(...response.items);
  }

  return results;
}
