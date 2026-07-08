import { buildAdaptiveCard } from "./analysis/buildAdaptiveCard";
import { buildTrendSummary } from "./analysis/buildReport";
import { classifyVideos } from "./analysis/classifyVideos";
import { scoreVideos } from "./analysis/scoreVideos";
import { loadLatestSnapshot } from "./storage/loadSnapshot";
import { saveSnapshot } from "./storage/saveSnapshot";
import { postErrorToTeams, postToTeams } from "./teams/postToTeams";
import { Snapshot } from "./types/video";
import { fetchVideos } from "./youtube/fetchVideos";

async function main(): Promise<void> {
  console.log("[1/6] YouTubeから動画を取得中...");
  const rawVideos = await fetchVideos();
  console.log(`  -> ${rawVideos.length}件の動画を取得(重複排除済み)`);

  console.log("[2/6] 前回スナップショットを読み込み中...");
  const previousSnapshot = await loadLatestSnapshot();

  console.log("[3/6] タグ分類中...");
  const classifiedVideos = classifyVideos(rawVideos);

  console.log("[4/6] 差分・スコアを計算中...");
  const scoredVideos = scoreVideos(classifiedVideos, previousSnapshot);

  console.log("[5/6] スナップショットを保存中...");
  const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), videos: scoredVideos };
  await saveSnapshot(snapshot);

  console.log("[6/6] Adaptive Cardを作成してTeamsへ投稿中...");
  const trendSummary = buildTrendSummary(scoredVideos);
  const card = buildAdaptiveCard(scoredVideos, trendSummary);
  await postToTeams(card);

  console.log("完了しました。");
}

main().catch(async (error) => {
  console.error("バッチ処理中にエラーが発生しました:", error);
  await postErrorToTeams(error);
  process.exitCode = 1;
});
