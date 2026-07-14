export type VideoRecord = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  thumbnailUrl?: string;
  description: string;

  viewCount: number;
  likeCount: number;
  commentCount: number;

  fetchedAt: string;

  tags: string[];
  category: string;
  curriculumFitScore: number;
  videoIdeaFitScore: number;

  previousViewCount?: number;
  weeklyViewIncrease?: number;
  dailyViewIncrease?: number;
  trendScore?: number;
};

export type Snapshot = {
  fetchedAt: string;
  videos: VideoRecord[];
};

export type TrendSummary = {
  topTags: { tag: string; count: number }[];
  topChannels: { channelTitle: string; count: number; totalTrendScore: number }[];
  curriculumCandidates: VideoRecord[];
  videoIdeaCandidates: VideoRecord[];
};
