import { TrendSummary, VideoRecord } from "../types/video";
import { defaultIdeaGenerator, IdeaGenerator } from "./buildReport";

const TOP_N = 10;

export type AdaptiveCard = Record<string, unknown>;

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("ja-JP");
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function buildVideoContainer(video: VideoRecord, rank: number): AdaptiveCard {
  const increase = video.weeklyViewIncrease ?? 0;
  const sign = increase >= 0 ? "+" : "";

  return {
    type: "Container",
    spacing: "Medium",
    separator: true,
    items: [
      {
        type: "TextBlock",
        text: `${rank}. 【${video.channelTitle}】${video.title}`,
        wrap: true,
        weight: "Bolder",
      },
      {
        type: "TextBlock",
        text: `再生数: ${formatNumber(video.viewCount)} ／ 週間増加推定: ${sign}${formatNumber(increase)} ／ コメント: ${formatNumber(video.commentCount)}`,
        wrap: true,
        isSubtle: true,
        size: "Small",
      },
      {
        type: "TextBlock",
        text: `タグ: ${video.tags.length > 0 ? video.tags.join(" / ") : "なし"}`,
        wrap: true,
        isSubtle: true,
        size: "Small",
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
    ],
  };
}

function buildListSection(title: string, items: string[]): AdaptiveCard[] {
  return [
    {
      type: "TextBlock",
      text: title,
      wrap: true,
      size: "Large",
      weight: "Bolder",
      spacing: "Large",
    },
    {
      type: "TextBlock",
      text: items.map((item, i) => `${i + 1}. ${item}`).join("\n\n"),
      wrap: true,
    },
  ];
}

/**
 * Power Automate / Incoming Webhook のどちらに投稿する場合も、
 * Markdown文字列(## や ** など)がHTMLとして誤表示される問題を避けるため、
 * Adaptive Card形式のJSONを直接組み立てて返す。
 */
export function buildAdaptiveCard(
  videos: VideoRecord[],
  trend: TrendSummary,
  ideaGenerator: IdeaGenerator = defaultIdeaGenerator,
): AdaptiveCard {
  const { trendNotes, curriculumIdeas, videoIdeas } = ideaGenerator(videos, trend);
  const ranked = [...videos].sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0)).slice(0, TOP_N);

  const body: AdaptiveCard[] = [
    {
      type: "TextBlock",
      text: "🎮 今週のマイクラ人気動画ランキング",
      size: "ExtraLarge",
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
    {
      type: "TextBlock",
      text: `TOP ${TOP_N}`,
      size: "Large",
      weight: "Bolder",
      spacing: "Large",
      wrap: true,
    },
    ...ranked.map((video, i) => buildVideoContainer(video, i + 1)),
    ...buildListSection("📈 今週の傾向", trendNotes),
    ...buildListSection("🧑‍🏫 ニコリヒトラボ授業化候補", curriculumIdeas),
    ...buildListSection("🎥 こっぴーふーチャンネル動画案", videoIdeas),
  ];

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body,
  };
}
