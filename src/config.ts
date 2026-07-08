import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env を確認してください。`);
  }
  return value;
}

export const YOUTUBE_API_KEY = requireEnv("YOUTUBE_API_KEY");
export const TEAMS_WEBHOOK_URL = requireEnv("TEAMS_WEBHOOK_URL");
export const TEAMS_POST_MODE: "incomingWebhook" | "powerAutomate" =
  process.env.TEAMS_POST_MODE === "powerAutomate" ? "powerAutomate" : "incomingWebhook";

export const MAX_RESULTS_PER_QUERY = Number(process.env.MAX_RESULTS_PER_QUERY ?? 25);
export const TARGET_DAYS = Number(process.env.TARGET_DAYS ?? 30);

// 検索キーワード(search.list で使用)
export const SEARCH_QUERIES: string[] = [
  "マイクラ",
  "マインクラフト",
  "Minecraft",
  "マイクラ 建築",
  "マイクラ コマンド",
  "マイクラ アドオン",
  "マイクラ 逃走中",
  "マイクラ 秘密基地",
  "マイクラ セキュリティ",
  "マイクラ サバイバル",
];

// 固定観測対象チャンネル(channelIdは後から入力。空でも動作する)
export const TARGET_CHANNELS: string[] = [
  // HikakinGames
  // まいぜんシスターズ
  // ちろぴの
  // カラフルピーチ
  // ドズル社
  // mkのゲーム実況ch
  // ウォーターチャレンジ
  // 日常組
];

export type TagRule = { tag: string; keywords: string[] };

export const TAG_RULES: TagRule[] = [
  { tag: "建築", keywords: ["建築", "家", "拠点", "基地", "街", "都市", "城"] },
  { tag: "サバイバル", keywords: ["サバイバル", "ハードコア", "生活", "100日"] },
  { tag: "コマンド", keywords: ["コマンド", "fill", "clone", "execute", "座標"] },
  { tag: "アドオン", keywords: ["アドオン", "MOD", "モッド", "データパック"] },
  { tag: "レッドストーン", keywords: ["レッドストーン", "回路", "自動", "装置"] },
  { tag: "ホラー", keywords: ["ホラー", "怖い", "化け物", "怪異"] },
  { tag: "脱出・謎解き", keywords: ["脱出", "謎解き", "迷路", "パズル"] },
  { tag: "ミニゲーム", keywords: ["逃走中", "鬼ごっこ", "PvP", "ミニゲーム"] },
  { tag: "セキュリティ", keywords: ["セキュリティ", "防犯", "トラップ", "守る"] },
  { tag: "AI活用候補", keywords: ["AI", "自動生成", "作ってみた", "設計"] },
];

export const CURRICULUM_FIT_SCORE_BY_TAG: Record<string, number> = {
  "コマンド": 30,
  "建築": 25,
  "レッドストーン": 25,
  "アドオン": 30,
  "脱出・謎解き": 30,
  "ミニゲーム": 25,
  "ホラー": -10,
  "セキュリティ": 20,
  "AI活用候補": 30,
};

export const DATA_DIR = "data";
export const LATEST_JSON_PATH = `${DATA_DIR}/latest.json`;
export const SNAPSHOTS_DIR = `${DATA_DIR}/snapshots`;
