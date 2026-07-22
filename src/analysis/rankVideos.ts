import { VideoRecord } from "../types/video";

/**
 * trendScore(週間再生数の伸び + 高評価 + コメントの加重合計)降順で上位N件を返す。
 * Adaptive Card表示とSharePoint保存の両方で同じ並び順を使うための共通ロジック。
 */
export function rankVideos(videos: VideoRecord[], topN: number): VideoRecord[] {
  return [...videos].sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0)).slice(0, topN);
}

export type IncludedReason = "trend" | "lesson_guarantee";
export type GuaranteedRankedVideo = VideoRecord & { includedReason: IncludedReason };

const DEFAULT_LESSON_GUARANTEE_SLOTS = 5;

/**
 * trend_score上位N件だけを保存すると、海外の大型バズ動画が上位を独占した週に
 * curriculumFitScore(授業テーマ適合度)を持つ動画が1件も残らないことがある
 * (Web分析ダッシュボードの「ニコリヒトラボ おすすめ」が空になる)。
 * これを防ぐため、trend_score上位に加えてcurriculumFitScore上位の動画を
 * 別枠で必ず含める。全体件数はtopNのまま(trend_score枠を必要な分だけ
 * 削って確保する)。別枠で追加された動画には includedReason: "lesson_guarantee"
 * を付け、保存先・画面側で「trend_score圏外から確保した」ことが分かるようにする。
 */
export function rankVideosWithLessonGuarantee(
  videos: VideoRecord[],
  topN: number,
  guaranteedLessonSlots: number = DEFAULT_LESSON_GUARANTEE_SLOTS,
): GuaranteedRankedVideo[] {
  const byTrend = [...videos].sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0));
  const topByTrend = byTrend.slice(0, topN);
  const topByTrendIds = new Set(topByTrend.map((v) => v.videoId));

  const lessonCandidates = [...videos]
    .filter((v) => (v.curriculumFitScore ?? 0) > 0 && !topByTrendIds.has(v.videoId))
    .sort((a, b) => (b.curriculumFitScore ?? 0) - (a.curriculumFitScore ?? 0))
    .slice(0, guaranteedLessonSlots);

  const trimmed = topByTrend.slice(0, Math.max(0, topN - lessonCandidates.length));

  return [
    ...trimmed.map((v) => ({ ...v, includedReason: "trend" as const })),
    ...lessonCandidates.map((v) => ({ ...v, includedReason: "lesson_guarantee" as const })),
  ];
}
