import { readFile } from "fs/promises";
import { LATEST_JSON_PATH } from "../config";
import { Snapshot } from "../types/video";

/**
 * 前回実行時の latest.json を読み込む。
 * 初回実行など、ファイルが存在しない場合は null を返す。
 */
export async function loadLatestSnapshot(): Promise<Snapshot | null> {
  try {
    const raw = await readFile(LATEST_JSON_PATH, "utf-8");
    return JSON.parse(raw) as Snapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
