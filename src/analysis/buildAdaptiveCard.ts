import { SHAREPOINT_DASHBOARD_URL, SUPABASE_DASHBOARD_URL } from "../config";
import { TrendSummary, VideoRecord } from "../types/video";

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

function average(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

function computeTagTotals(videos: VideoRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const v of videos) {
    for (const tag of v.tags) {
      totals[tag] = (totals[tag] ?? 0) + (v.trendScore ?? 0);
    }
  }
  return totals;
}

type FeaturedTag = { tag: string; growth: number | "NEW" | null };

/**
 * 「今週の注目」として取り上げるタグ(テーマ)を1つ選ぶ。
 * 前回スナップショット(previousVideos)がある場合は、タグ別trend_score合計の
 * 先週比伸び率で選ぶ(Webダッシュボードの急上昇テーマと同じ考え方)。
 * 前回データが無い(初回実行)場合は、今週のtrend_score合計が最大のタグにする。
 */
function pickFeaturedTag(videos: VideoRecord[], previousVideos: VideoRecord[]): FeaturedTag | undefined {
  const currentTotals = computeTagTotals(videos);
  const tags = Object.keys(currentTotals);
  if (tags.length === 0) return undefined;

  if (previousVideos.length === 0) {
    const top = [...tags].sort((a, b) => currentTotals[b] - currentTotals[a])[0];
    return { tag: top, growth: null };
  }

  const previousTotals = computeTagTotals(previousVideos);
  const ranked = tags
    .map((tag) => {
      const prev = previousTotals[tag] ?? 0;
      const growth: number | "NEW" = prev > 0 ? ((currentTotals[tag] - prev) / prev) * 100 : "NEW";
      return { tag, growth };
    })
    .sort((a, b) => {
      const ga = a.growth === "NEW" ? Infinity : a.growth;
      const gb = b.growth === "NEW" ? Infinity : b.growth;
      return gb - ga;
    });
  return ranked[0];
}

function representativeVideo(videos: VideoRecord[], tag: string): VideoRecord | undefined {
  return [...videos].filter((v) => v.tags.includes(tag)).sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0))[0];
}

// 見出しには具体的な数値(%)を入れない。「何の%か」が伝わらないまま
// 誤解を招くことがあるため、数値の中身は「なぜ今注目?」で説明する。
function headlineFor(tag: string, growth: FeaturedTag["growth"]): string {
  if (growth === "NEW") return `${tag}系が新しく登場`;
  if (typeof growth === "number" && growth > 20) return `${tag}系が急上昇中`;
  return `${tag}系が今週の注目テーマ`;
}

// 「なぜ今注目?」ボタンをクリックすると何が見られるかを一言添える。
function toggleButtonTitleFor(growth: FeaturedTag["growth"]): string {
  if (growth === "NEW") return "🔥 なぜ話題に? → 新しく登場した理由を見る";
  if (typeof growth === "number" && growth > 20) return "🔥 なぜ急上昇? → 先週から伸びた理由を見る";
  return "🔥 なぜ注目? → 今週の注目理由を見る";
}

/**
 * 「なぜ注目か」をデータから機械的に組み立てる(AI文章生成ではなく、
 * 伸び率・投稿数・平均再生数という実データの比較のみで構成する)。
 * Webダッシュボードのタグ別採用理由と同じロジック。
 */
function buildTagReasons(tag: string, videos: VideoRecord[], growth: FeaturedTag["growth"]): string[] {
  const tagVideos = videos.filter((v) => v.tags.includes(tag));
  const reasons: string[] = [];

  if (growth === "NEW") reasons.push("先週は無かった新しいテーマ");
  else if (typeof growth === "number" && growth > 20) {
    reasons.push(`カテゴリ全体の話題性(trend_score合計)が先週比 +${Math.round(growth)}%`);
  }

  const avgTagView = average(tagVideos.map((v) => v.viewCount));
  const avgAllView = average(videos.map((v) => v.viewCount));
  if (avgAllView > 0 && avgTagView > avgAllView * 1.2) {
    reasons.push(`平均再生数が全体平均の${(avgTagView / avgAllView).toFixed(1)}倍`);
  }

  reasons.push(`今週${tagVideos.length}件投稿`);
  return reasons;
}

/**
 * 授業化度/動画案度の合計が高いタグを、断定せず「ヒント」として上位2つまで返す。
 * (「授業に採用しましょう」ではなく、動画から抽出したテーマの組み合わせとして
 * 気づきを与える程度に留める。例:「建築・脱出」)
 */
function pickTopFitTags(videos: VideoRecord[], key: "curriculumFitScore" | "videoIdeaFitScore"): string[] {
  const totals: Record<string, number> = {};
  for (const v of videos) {
    const score = v[key] ?? 0;
    if (score <= 0) continue;
    for (const tag of v.tags) {
      totals[tag] = (totals[tag] ?? 0) + score;
    }
  }
  return Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, 2);
}

function buildFeaturedSection(videos: VideoRecord[], previousVideos: VideoRecord[]): AdaptiveCard[] {
  const featured = pickFeaturedTag(videos, previousVideos);
  if (!featured) return [];

  const video = representativeVideo(videos, featured.tag);
  const reasons = buildTagReasons(featured.tag, videos, featured.growth);
  const lessonHint = pickTopFitTags(videos, "curriculumFitScore");
  const videoHint = pickTopFitTags(videos, "videoIdeaFitScore");

  // 通知の中で一番伝えたい情報なので、見出しを最大サイズにして目立たせる。
  const items: AdaptiveCard[] = [
    {
      type: "TextBlock",
      text: "🔥 今週の注目",
      size: "Medium",
      weight: "Bolder",
      spacing: "Medium",
      wrap: true,
      color: "Attention",
    },
    {
      type: "TextBlock",
      text: headlineFor(featured.tag, featured.growth),
      wrap: true,
      weight: "Bolder",
      size: "ExtraLarge",
    },
  ];

  if (video) {
    const increase = video.weeklyViewIncrease ?? 0;
    const sign = increase >= 0 ? "+" : "";
    items.push({
      type: "ColumnSet",
      spacing: "Medium",
      columns: [
        ...(video.thumbnailUrl
          ? [
              {
                type: "Column",
                width: "80px",
                items: [{ type: "Image", url: video.thumbnailUrl, size: "Stretch" }],
              },
            ]
          : []),
        {
          type: "Column",
          width: "stretch",
          items: [
            { type: "TextBlock", text: `【${video.channelTitle}】${video.title}`, wrap: true, weight: "Bolder", size: "Small" },
            // 絶対値(累計再生数)より、企画判断に直結する「今週どれだけ伸びたか」を主役にする。
            {
              type: "TextBlock",
              text: `📈 週間 ${sign}${formatNumber(increase)}再生(先週比)`,
              wrap: true,
              weight: "Bolder",
              size: "Small",
              color: "Good",
            },
            {
              type: "TextBlock",
              text: `累計再生数: ${formatNumber(video.viewCount)}`,
              wrap: true,
              isSubtle: true,
              size: "Small",
            },
          ],
        },
      ],
    });
  }

  items.push(
    {
      type: "ActionSet",
      spacing: "Medium",
      actions: [
        {
          type: "Action.ToggleVisibility",
          title: toggleButtonTitleFor(featured.growth),
          style: "positive",
          targetElements: ["reasonsContainer"],
        },
      ],
    },
    {
      type: "Container",
      id: "reasonsContainer",
      isVisible: false,
      spacing: "Small",
      items: reasons.map((r) => ({ type: "TextBlock", text: `・${r}`, wrap: true, isSubtle: true, size: "Small" })),
    },
  );

  if (lessonHint.length > 0) {
    items.push({
      type: "TextBlock",
      text: `📚 レッスンのヒント: ${lessonHint.join(" × ")}`,
      wrap: true,
      spacing: "Medium",
      size: "Small",
      color: "Good",
    });
  }
  if (videoHint.length > 0) {
    items.push({
      type: "TextBlock",
      text: `🎥 企画のヒント: ${videoHint.join(" × ")}`,
      wrap: true,
      size: "Small",
      color: "Good",
    });
  }

  if (video) {
    items.push({
      type: "ActionSet",
      spacing: "Medium",
      actions: [{ type: "Action.OpenUrl", title: "動画を見る", url: video.url }],
    });
  }

  return items;
}

/**
 * Power Automate / Incoming Webhook のどちらに投稿する場合も、
 * Markdown文字列(## や ** など)がHTMLとして誤表示される問題を避けるため、
 * Adaptive Card形式のJSONを直接組み立てて返す。
 *
 * 「通知 → なぜ注目? → 動画を見る → ダッシュボード」の導線に絞ったシンプル版。
 * YouTube概要欄はここでは表示しない(動画ページ・ダッシュボードで読めるため)。
 * TOP10の全件表示・候補リスト等は、Web分析ダッシュボードの方が見やすく
 * 網羅的なため、Teamsには載せない。
 */
export function buildAdaptiveCard(
  videos: VideoRecord[],
  _trend: TrendSummary,
  previousVideos: VideoRecord[] = [],
): AdaptiveCard {
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
      text: `📅 ${formatDateTime(new Date())}`,
      isSubtle: true,
      size: "Small",
      wrap: true,
    },
    ...buildFeaturedSection(videos, previousVideos),
  ];

  // 「なぜ注目?→ダッシュボード」が本命の導線、「動画を見る」は補助導線という
  // 優先順位を、ボタンのスタイル(positive=強調)でも伝える。
  const dashboardActions: AdaptiveCard[] = [
    ...(SUPABASE_DASHBOARD_URL
      ? [
          {
            type: "Action.OpenUrl",
            title: "📊 分析ダッシュボードを開く(Web)",
            style: "positive",
            url: SUPABASE_DASHBOARD_URL,
          },
        ]
      : []),
    ...(SHAREPOINT_DASHBOARD_URL
      ? [
          {
            type: "Action.OpenUrl",
            title: "📊 分析ダッシュボードを開く(SharePoint)",
            style: "positive",
            url: SHAREPOINT_DASHBOARD_URL,
          },
        ]
      : []),
  ];

  const actions: AdaptiveCard[] =
    dashboardActions.length > 0
      ? [
          {
            type: "ActionSet",
            separator: true,
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
