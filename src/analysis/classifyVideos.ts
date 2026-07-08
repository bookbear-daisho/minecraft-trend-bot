import { CURRICULUM_FIT_SCORE_BY_TAG, TAG_RULES } from "../config";
import { VideoRecord } from "../types/video";

function matchTags(title: string): string[] {
  const tags: string[] = [];
  for (const rule of TAG_RULES) {
    if (rule.keywords.some((keyword) => title.includes(keyword))) {
      tags.push(rule.tag);
    }
  }
  return tags;
}

function calcCurriculumFitScore(tags: string[]): number {
  return tags.reduce((sum, tag) => sum + (CURRICULUM_FIT_SCORE_BY_TAG[tag] ?? 0), 0);
}

/**
 * タイトルベースのルール分類でタグ・カテゴリ・curriculumFitScore を確定させる。
 * (videoIdeaFitScore は weeklyViewIncrease が必要なため scoreVideos.ts 側で確定する)
 */
export function classifyVideos(videos: VideoRecord[]): VideoRecord[] {
  return videos.map((video) => {
    const tags = matchTags(video.title);
    return {
      ...video,
      tags,
      category: tags[0] ?? "未分類",
      curriculumFitScore: calcCurriculumFitScore(tags),
    };
  });
}
