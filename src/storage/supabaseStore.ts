import { IncludedReason } from "../analysis/rankVideos";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_TABLE_NAME, SUPABASE_URL } from "../config";
import { VideoRecord } from "../types/video";

type SupabaseVideoInput = VideoRecord & { includedReason?: IncludedReason };

function requireConfig(name: string, value: string): string {
  if (!value) {
    throw new Error(`Supabase連携の環境変数 ${name} が設定されていません。.env を確認してください。`);
  }
  return value;
}

function toRow(video: SupabaseVideoInput, weekLabel: string): Record<string, unknown> {
  return {
    video_id: video.videoId,
    title: video.title,
    channel_title: video.channelTitle,
    video_url: video.url,
    view_count: video.viewCount,
    like_count: video.likeCount,
    comment_count: video.commentCount,
    weekly_view_increase: Math.round(video.weeklyViewIncrease ?? 0),
    trend_score: Math.round(video.trendScore ?? 0),
    tags: video.tags.length > 0 ? video.tags.join(", ") : "海外/その他",
    published_at: video.publishedAt,
    week_label: weekLabel,
    description: video.description,
    curriculum_fit_score: video.curriculumFitScore,
    video_idea_fit_score: video.videoIdeaFitScore,
    thumbnail_url: video.thumbnailUrl ?? null,
    // "trend"(通常のtrend_score上位) / "lesson_guarantee"
    // (trend_score圏外だがcurriculumFitScore上位のため別枠で確保)。
    // 未指定(SharePoint専用パス等)の場合は通常のtrend扱いとする。
    included_reason: video.includedReason ?? "trend",
  };
}

/**
 * 週次のランキング上位を、Supabase(Postgres)へ一括insertする。
 * SharePointとは独立した追加の保存先(M365アカウントを持たないクライアント等が
 * Supabase Table Editorで直接閲覧できるようにするため)。
 * PostgRESTのbulk insertを使い、1回のリクエストでまとめて送る。
 */
export async function saveToSupabase(videos: SupabaseVideoInput[], fetchedAt: string): Promise<void> {
  const url = requireConfig("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireConfig("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  const weekLabel = fetchedAt.slice(0, 10);

  const rows = videos.map((video) => toRow(video, weekLabel));

  const res = await fetch(`${url}/rest/v1/${SUPABASE_TABLE_NAME}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    throw new Error(`Supabaseへの保存に失敗しました: ${res.status} ${res.statusText} - ${await res.text()}`);
  }
}
