import { mkdir, writeFile } from "fs/promises";
import { DATA_DIR, LATEST_JSON_PATH, SNAPSHOTS_DIR } from "../config";
import { Snapshot } from "../types/video";

function todayDateString(fetchedAt: string): string {
  return fetchedAt.slice(0, 10); // YYYY-MM-DD
}

/**
 * 今回取得結果を data/latest.json (次回比較用) と
 * data/snapshots/YYYY-MM-DD.json (履歴) の両方に保存する。
 */
export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  const json = JSON.stringify(snapshot, null, 2);
  await writeFile(LATEST_JSON_PATH, json, "utf-8");
  await writeFile(`${SNAPSHOTS_DIR}/${todayDateString(snapshot.fetchedAt)}.json`, json, "utf-8");
}
