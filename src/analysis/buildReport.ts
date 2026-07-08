import { TrendSummary, VideoRecord } from "../types/video";

const TOP_N = 10;
const CANDIDATE_N = 5;

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("ja-JP");
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function buildTrendSummary(videos: VideoRecord[]): TrendSummary {
  const tagCounts = new Map<string, number>();
  for (const video of videos) {
    for (const tag of video.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const channelStats = new Map<string, { count: number; totalTrendScore: number }>();
  for (const video of videos) {
    const stat = channelStats.get(video.channelTitle) ?? { count: 0, totalTrendScore: 0 };
    stat.count += 1;
    stat.totalTrendScore += video.trendScore ?? 0;
    channelStats.set(video.channelTitle, stat);
  }
  const topChannels = [...channelStats.entries()]
    .map(([channelTitle, stat]) => ({ channelTitle, ...stat }))
    .sort((a, b) => b.totalTrendScore - a.totalTrendScore);

  const curriculumCandidates = [...videos]
    .filter((v) => v.curriculumFitScore > 0)
    .sort((a, b) => b.curriculumFitScore - a.curriculumFitScore)
    .slice(0, CANDIDATE_N);

  const videoIdeaCandidates = [...videos]
    .sort((a, b) => b.videoIdeaFitScore - a.videoIdeaFitScore)
    .slice(0, CANDIDATE_N);

  return { topTags, topChannels, curriculumCandidates, videoIdeaCandidates };
}

// タグごとの授業化案・動画案テンプレート。
// 将来的に OpenAI/Claude API で生成する IdeaGenerator に差し替えることを想定し、
// 「タグ + 実データ」から案を組み立てるロジックはこの1関数に閉じている。
const IDEA_TEMPLATES: Record<string, { curriculum: string; videoIdea: string }> = {
  "建築": {
    curriculum: "人気の建築動画をお手本に、テーマ建築(夏祭り会場など)を作ろう",
    videoIdea: "今週人気の建築企画をこっぴーが真似して作ってみた",
  },
  "サバイバル": {
    curriculum: "◯日間生き延びろ!ミニサバイバルチャレンジを作ろう",
    videoIdea: "小学生だけでマイクラサバイバル◯日間生活してみた",
  },
  "コマンド": {
    curriculum: "コマンドで一瞬で夏祭り会場を作ろう",
    videoIdea: "コマンドだけで未来の夏祭りワールドを作ってみた",
  },
  "アドオン": {
    curriculum: "自分だけのオリジナルアドオンを作ってみよう",
    videoIdea: "小学生が考えたオリジナルアドオンを形にしてみた",
  },
  "レッドストーン": {
    curriculum: "レッドストーンで自動ドアとトラップを作ろう",
    videoIdea: "レッドストーンだけで作る秘密の仕掛け屋敷",
  },
  "脱出・謎解き": {
    curriculum: "みんなで挑戦!脱出・謎解きマップを作ろう",
    videoIdea: "小学生が本気で作った脱出ゲームに挑戦してみた",
  },
  "ミニゲーム": {
    curriculum: "逃走中ミニゲームを自作しよう",
    videoIdea: "マイクラ逃走中をプログラミングで作ってみた",
  },
  "セキュリティ": {
    curriculum: "セキュリティハウスを作って村を守ろう",
    videoIdea: "小学生が考えた最強セキュリティハウス",
  },
  "AI活用候補": {
    curriculum: "AIに設計させた秘密基地をマイクラで作ろう",
    videoIdea: "AIに秘密基地を設計させたら小学生でも作れるのか?",
  },
};

const FALLBACK_CURRICULUM_IDEAS = [
  "AIに設計させた秘密基地をマイクラで作ろう",
  "コマンドで一瞬で夏祭り会場を作ろう",
  "セキュリティハウスを作って村を守ろう",
  "逃走中ミニゲームを自作しよう",
  "レッドストーンで自動ドアとトラップを作ろう",
];

const FALLBACK_VIDEO_IDEAS = [
  "今週人気のマイクラ企画をこっぴーが授業化してみた",
  "AIに秘密基地を設計させたら小学生でも作れるのか?",
  "コマンドだけで未来の夏祭りワールドを作ってみた",
  "小学生が考えた最強セキュリティハウス",
  "マイクラ逃走中をプログラミングで作ってみた",
];

export type IdeaGenerationResult = {
  trendNotes: string[];
  curriculumIdeas: string[];
  videoIdeas: string[];
};

export type IdeaGenerator = (videos: VideoRecord[], trend: TrendSummary) => IdeaGenerationResult;

/**
 * ルールベースのアイデア生成(AI APIなし)。
 * 将来的に OpenAI/Claude API で自然文生成する IdeaGenerator に差し替える場合は、
 * この関数と同じシグネチャの関数を実装して buildReport() の第3引数に渡す。
 */
export const defaultIdeaGenerator: IdeaGenerator = (videos, trend) => {
  const trendNotes: string[] = [];
  const topTag = trend.topTags[0]?.tag;
  if (topTag) {
    trendNotes.push(`${topTag}系の動画が多い`);
  }
  if (trend.topTags.some((t) => t.tag === "ミニゲーム")) {
    trendNotes.push("逃走中・鬼ごっこ系が伸びている");
  }
  if (trend.topTags.some((t) => t.tag === "セキュリティ" || t.tag === "建築")) {
    trendNotes.push("秘密基地・セキュリティ系は授業化しやすい");
  }
  if (trend.topTags.some((t) => t.tag === "コマンド" || t.tag === "アドオン")) {
    trendNotes.push("コマンドやアドオンに変換できるテーマが多い");
  }
  if (trendNotes.length === 0) {
    trendNotes.push("特に際立った傾向は見られませんでした");
  }

  const candidateTags = [
    ...new Set([
      ...trend.curriculumCandidates.flatMap((v) => v.tags),
      ...trend.videoIdeaCandidates.flatMap((v) => v.tags),
      ...trend.topTags.map((t) => t.tag),
    ]),
  ].filter((tag) => IDEA_TEMPLATES[tag]);

  const curriculumIdeas = candidateTags.map((tag) => IDEA_TEMPLATES[tag].curriculum);
  const videoIdeas = candidateTags.map((tag) => IDEA_TEMPLATES[tag].videoIdea);

  for (const fallback of FALLBACK_CURRICULUM_IDEAS) {
    if (curriculumIdeas.length >= CANDIDATE_N) break;
    if (!curriculumIdeas.includes(fallback)) curriculumIdeas.push(fallback);
  }
  for (const fallback of FALLBACK_VIDEO_IDEAS) {
    if (videoIdeas.length >= CANDIDATE_N) break;
    if (!videoIdeas.includes(fallback)) videoIdeas.push(fallback);
  }

  return {
    trendNotes,
    curriculumIdeas: curriculumIdeas.slice(0, CANDIDATE_N),
    videoIdeas: videoIdeas.slice(0, CANDIDATE_N),
  };
};

function buildRankingSection(videos: VideoRecord[]): string {
  const ranked = [...videos].sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0)).slice(0, TOP_N);

  const lines = ranked.map((video, index) => {
    const increase = video.weeklyViewIncrease ?? 0;
    const sign = increase >= 0 ? "+" : "";
    return [
      `${index + 1}. 【${video.channelTitle}】${video.title}`,
      `   再生数: ${formatNumber(video.viewCount)}`,
      `   週間増加推定: ${sign}${formatNumber(increase)}`,
      `   コメント: ${formatNumber(video.commentCount)}`,
      `   タグ: ${video.tags.length > 0 ? video.tags.join(" / ") : "なし"}`,
      `   URL: ${video.url}`,
    ].join("\n");
  });

  return lines.join("\n\n");
}

/**
 * Teamsに投稿するMarkdownレポートを組み立てる。
 * ideaGenerator を差し替えることで、授業化案・動画案の生成方法(AI API利用など)を変更できる。
 */
export function buildReport(
  videos: VideoRecord[],
  trend: TrendSummary,
  ideaGenerator: IdeaGenerator = defaultIdeaGenerator,
): string {
  const { trendNotes, curriculumIdeas, videoIdeas } = ideaGenerator(videos, trend);

  return `## 🎮 今週のマイクラ人気動画ランキング

集計日時: ${formatDateTime(new Date())}

### TOP ${TOP_N}

${buildRankingSection(videos)}

---

## 📈 今週の傾向

${trendNotes.map((note) => `- ${note}`).join("\n")}

---

## 🧑‍🏫 ニコリヒトラボ授業化候補

${curriculumIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}

---

## 🎥 こっぴーふーチャンネル動画案

${videoIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}
`;
}
