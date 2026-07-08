import { CURRICULUM_FIT_SCORE_BY_TAG } from "../config";
import { Snapshot, VideoRecord } from "../types/video";

const VIDEO_IDEA_TITLE_KEYWORDS = ["作ってみた", "対決", "最強", "検証", "100日", "逃走中", "秘密基地"];

function daysSince(publishedAt: string, now: Date): number {
  const publishedDate = new Date(publishedAt);
  const diffMs = now.getTime() - publishedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(1, diffDays);
}

function calcVideoIdeaFitScore(video: VideoRecord, weeklyViewIncrease: number): number {
  let score = 0;

  // weeklyViewIncrease が大きいほど加点 (5,000再生増加ごとに+1点、上限40点)
  score += Math.min(40, Math.floor(Math.max(0, weeklyViewIncrease) / 5000));

  // タイトルに企画向けキーワードが含まれていれば加点
  for (const keyword of VIDEO_IDEA_TITLE_KEYWORDS) {
    if (video.title.includes(keyword)) score += 5;
  }

  // ニコリヒトラボの授業化しやすいタグ(curriculumFitScoreが正のタグ)が付いていれば加点
  const lessonFriendlyTagCount = video.tags.filter((tag) => (CURRICULUM_FIT_SCORE_BY_TAG[tag] ?? 0) > 0).length;
  score += lessonFriendlyTagCount * 10;

  return score;
}

/**
 * 前回スナップショットとの差分から weeklyViewIncrease / trendScore / videoIdeaFitScore を確定させる。
 * classifyVideos() でタグ付けを終えた VideoRecord[] を渡すこと。
 */
export function scoreVideos(videos: VideoRecord[], previousSnapshot: Snapshot | null): VideoRecord[] {
  const previousByVideoId = new Map(previousSnapshot?.videos.map((v) => [v.videoId, v]) ?? []);
  const now = new Date();

  return videos.map((video) => {
    const previous = previousByVideoId.get(video.videoId);

    let dailyViewIncrease: number;
    let weeklyViewIncrease: number;
    let previousViewCount: number | undefined;

    if (previous) {
      previousViewCount = previous.viewCount;
      weeklyViewIncrease = video.viewCount - previous.viewCount;
      dailyViewIncrease = weeklyViewIncrease / 7;
    } else {
      const days = daysSince(video.publishedAt, now);
      dailyViewIncrease = video.viewCount / days;
      weeklyViewIncrease = dailyViewIncrease * 7;
    }

    const trendScore = weeklyViewIncrease + video.likeCount * 10 + video.commentCount * 50;
    const videoIdeaFitScore = calcVideoIdeaFitScore(video, weeklyViewIncrease);

    return {
      ...video,
      previousViewCount,
      weeklyViewIncrease,
      dailyViewIncrease,
      trendScore,
      videoIdeaFitScore,
    };
  });
}
