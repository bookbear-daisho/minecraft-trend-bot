import { buildAdaptiveCard } from "./analysis/buildAdaptiveCard";
import { buildTrendSummary } from "./analysis/buildReport";
import { classifyVideos } from "./analysis/classifyVideos";
import { rankVideos, rankVideosWithLessonGuarantee } from "./analysis/rankVideos";
import { scoreVideos } from "./analysis/scoreVideos";
import { SHAREPOINT_ENABLED, SHAREPOINT_SAVE_TOP_N, SUPABASE_ENABLED, SUPABASE_SAVE_TOP_N } from "./config";
import { loadLatestSnapshot } from "./storage/loadSnapshot";
import { saveSnapshot } from "./storage/saveSnapshot";
import { saveToSharePoint } from "./storage/sharepointStore";
import { saveToSupabase } from "./storage/supabaseStore";
import { postErrorToTeams, postToTeams } from "./teams/postToTeams";
import { Snapshot } from "./types/video";
import { fetchVideos } from "./youtube/fetchVideos";

async function main(): Promise<void> {
  console.log("[1/8] YouTubeから動画を取得中...");
  const rawVideos = await fetchVideos();
  console.log(`  -> ${rawVideos.length}件の動画を取得(重複排除済み)`);

  console.log("[2/8] 前回スナップショットを読み込み中...");
  const previousSnapshot = await loadLatestSnapshot();

  console.log("[3/8] タグ分類中...");
  const classifiedVideos = classifyVideos(rawVideos);

  console.log("[4/8] 差分・スコアを計算中...");
  const scoredVideos = scoreVideos(classifiedVideos, previousSnapshot);

  console.log("[5/8] スナップショットを保存中...");
  const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), videos: scoredVideos };
  await saveSnapshot(snapshot);

  if (SHAREPOINT_ENABLED) {
    console.log("[6/8] SharePointへ履歴を保存中...");
    const topForHistory = rankVideos(scoredVideos, SHAREPOINT_SAVE_TOP_N);
    await saveToSharePoint(topForHistory, snapshot.fetchedAt);
  } else {
    console.log("[6/8] SharePoint連携は無効(SHAREPOINT_ENABLED=true未設定)のためスキップ");
  }

  if (SUPABASE_ENABLED) {
    console.log("[7/8] Supabaseへ履歴を保存中...");
    const topForSupabase = rankVideosWithLessonGuarantee(scoredVideos, SUPABASE_SAVE_TOP_N);
    await saveToSupabase(topForSupabase, snapshot.fetchedAt);
  } else {
    console.log("[7/8] Supabase連携は無効(SUPABASE_ENABLED=true未設定)のためスキップ");
  }

  console.log("[8/8] Adaptive Cardを作成してTeamsへ投稿中...");
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
