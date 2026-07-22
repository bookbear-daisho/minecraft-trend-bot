import { SHAREPOINT_DASHBOARD_URL, SUPABASE_DASHBOARD_URL } from "../config";
import { TrendSummary, VideoRecord } from "../types/video";

export type AdaptiveCard = Record<string, unknown>;

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("ja-JP");
}

function excerpt(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return "";
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen)}…`;
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/**
 * 「気になる部分」として1件だけ取り上げる動画を選ぶ。
 * curriculumFitScore・videoIdeaFitScoreの合計が最も高い動画
 * (=授業にもこっぴーふーチャンネルの企画にも使いやすい動画)を優先し、
 * 同点の場合はtrendScoreで決める。Webダッシュボードの「今日のおすすめ」と同じ考え方。
 */
function pickFeaturedVideo(videos: VideoRecord[]): VideoRecord | undefined {
  return [...videos].sort((a, b) => {
    const scoreA = (a.curriculumFitScore ?? 0) + (a.videoIdeaFitScore ?? 0);
    const scoreB = (b.curriculumFitScore ?? 0) + (b.videoIdeaFitScore ?? 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.trendScore ?? 0) - (a.trendScore ?? 0);
  })[0];
}

function buildFeaturedSuggestion(video: VideoRecord): string {
  const hasCurriculum = (video.curriculumFitScore ?? 0) > 0;
  const hasVideoIdea = (video.videoIdeaFitScore ?? 0) > 0;
  if (hasCurriculum && hasVideoIdea) {
    return "ニコリヒトラボの授業テーマにも、こっぴーふーチャンネルの動画企画にも使えそうです。";
  }
  if (hasCurriculum) {
    return "ニコリヒトラボの授業テーマとして使えそうです。";
  }
  if (hasVideoIdea) {
    return "こっぴーふーチャンネルの動画企画に使えそうです。";
  }
  return "今週伸びている動画です。";
}

function buildFeaturedSection(video: VideoRecord): AdaptiveCard[] {
  const increase = video.weeklyViewIncrease ?? 0;
  const sign = increase >= 0 ? "+" : "";
  const desc = excerpt(video.description, 80);

  return [
    {
      type: "TextBlock",
      text: "🔎 今週の気になる動画",
      size: "Medium",
      weight: "Bolder",
      spacing: "Medium",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: `【${video.channelTitle}】${video.title}`,
      wrap: true,
      weight: "Bolder",
    },
    {
      type: "TextBlock",
      text: `再生数: ${formatNumber(video.viewCount)}(週間${sign}${formatNumber(increase)})`,
      wrap: true,
      isSubtle: true,
      size: "Small",
    },
    ...(desc
      ? [
          {
            type: "TextBlock",
            text: `概要: ${desc}`,
            wrap: true,
            isSubtle: true,
            size: "Small",
          },
        ]
      : []),
    {
      type: "TextBlock",
      text: `💡 ${buildFeaturedSuggestion(video)}`,
      wrap: true,
      weight: "Bolder",
      color: "Good",
    },
    {
      type: "ActionSet",
      actions: [
        {
          type: "Action.OpenUrl",
          title: "動画を見る",
          url: video.url,
        },
      ],
    },
  ];
}

/**
 * Power Automate / Incoming Webhook のどちらに投稿する場合も、
 * Markdown文字列(## や ** など)がHTMLとして誤表示される問題を避けるため、
 * Adaptive Card形式のJSONを直接組み立てて返す。
 *
 * 「通知 → 気になる部分 → 詳細ページを開く」の3段構成に絞ったシンプル版。
 * TOP10の全件表示・傾向の箇条書き・授業化候補/動画案リストは、
 * Web分析ダッシュボードの方が見やすく網羅的なため、Teamsには載せない。
 */
export function buildAdaptiveCard(videos: VideoRecord[], trend: TrendSummary): AdaptiveCard {
  const featured = pickFeaturedVideo(videos);
  const topTagNames = trend.topTags.slice(0, 3).map((t) => t.tag);

  const body: AdaptiveCard[] = [
    {
      type: "TextBlock",
      text: "🎮 マイクラトレンド更新",
      size: "Large",
      weight: "Bolder",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: `集計日時: ${formatDateTime(new Date())}`,
      isSubtle: true,
      size: "Small",
      wrap: true,
    },
    ...(featured ? buildFeaturedSection(featured) : []),
    ...(topTagNames.length > 0
      ? [
          {
            type: "TextBlock",
            text: `📈 今週伸びているテーマ: ${topTagNames.join(" / ")}`,
            wrap: true,
            spacing: "Medium",
            isSubtle: true,
            size: "Small",
          },
        ]
      : []),
  ];

  const dashboardActions: AdaptiveCard[] = [
    ...(SHAREPOINT_DASHBOARD_URL
      ? [
          {
            type: "Action.OpenUrl",
            title: "📊 分析ダッシュボードを開く(SharePoint)",
            url: SHAREPOINT_DASHBOARD_URL,
          },
        ]
      : []),
    ...(SUPABASE_DASHBOARD_URL
      ? [
          {
            type: "Action.OpenUrl",
            title: "📊 分析ダッシュボードを開く(Web)",
            url: SUPABASE_DASHBOARD_URL,
          },
        ]
      : []),
  ];

  const actions: AdaptiveCard[] =
    dashboardActions.length > 0
      ? [
          {
            type: "ActionSet",
            spacing: "Large",
            actions: dashboardActions,
          },
        ]
      : [];

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [...body, ...actions],
  };
}
