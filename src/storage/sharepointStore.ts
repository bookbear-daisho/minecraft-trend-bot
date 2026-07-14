import {
  SHAREPOINT_CLIENT_ID,
  SHAREPOINT_CLIENT_SECRET,
  SHAREPOINT_LIST_NAME,
  SHAREPOINT_SITE_HOSTNAME,
  SHAREPOINT_SITE_PATH,
  SHAREPOINT_TENANT_ID,
} from "../config";
import { VideoRecord } from "../types/video";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function requireConfig(name: string, value: string): string {
  if (!value) {
    throw new Error(`SharePoint連携の環境変数 ${name} が設定されていません。.env を確認してください。`);
  }
  return value;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * アプリ専用(クライアントクレデンシャル)フローでGraph APIのアクセストークンを取得する。
 * トークンは有効期限内であればプロセス内でキャッシュして使い回す。
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const tenantId = requireConfig("SHAREPOINT_TENANT_ID", SHAREPOINT_TENANT_ID);
  const clientId = requireConfig("SHAREPOINT_CLIENT_ID", SHAREPOINT_CLIENT_ID);
  const clientSecret = requireConfig("SHAREPOINT_CLIENT_SECRET", SHAREPOINT_CLIENT_SECRET);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`SharePoint認証(トークン取得)に失敗しました: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Graph APIエラー (${path}): ${res.status} ${res.statusText} - ${await res.text()}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

async function resolveSiteId(): Promise<string> {
  const hostname = requireConfig("SHAREPOINT_SITE_HOSTNAME", SHAREPOINT_SITE_HOSTNAME);
  const sitePath = requireConfig("SHAREPOINT_SITE_PATH", SHAREPOINT_SITE_PATH);
  const site = await graphFetch<{ id: string }>(`/sites/${hostname}:${sitePath}`);
  return site.id;
}

async function resolveListId(siteId: string): Promise<string> {
  const result = await graphFetch<{ value: { id: string; displayName: string }[] }>(
    `/sites/${siteId}/lists?$select=id,displayName`,
  );
  const list = result.value.find((l) => l.displayName === SHAREPOINT_LIST_NAME);
  if (!list) {
    throw new Error(
      `SharePointリスト「${SHAREPOINT_LIST_NAME}」が見つかりません。事前に指定した列構成でリストを作成してください(README参照)。`,
    );
  }
  return list.id;
}

function toListItemFields(video: VideoRecord, weekLabel: string): Record<string, unknown> {
  return {
    Title: video.title,
    VideoId: video.videoId,
    ChannelTitle: video.channelTitle,
    VideoURL: video.url,
    ViewCount: video.viewCount,
    LikeCount: video.likeCount,
    CommentCount: video.commentCount,
    WeeklyViewIncrease: Math.round(video.weeklyViewIncrease ?? 0),
    TrendScore: Math.round(video.trendScore ?? 0),
    Tags: video.tags.length > 0 ? video.tags.join(", ") : "海外/その他",
    PublishedAt: video.publishedAt,
    WeekLabel: weekLabel,
    Description: video.description.slice(0, 255),
    CurriculumFitScore: video.curriculumFitScore,
    VideoIdeaFitScore: video.videoIdeaFitScore,
  };
}

/**
 * 週次のランキング上位を、分析用ダッシュボード(SharePointページ)の元データとして
 * SharePointリストへ1行ずつ追記する(上書きせず履歴として蓄積)。
 * 呼び出し回数を抑えるための一括投入(バッチAPI)は行わず、件数を絞ることで対応している
 * (config.ts の SHAREPOINT_SAVE_TOP_N を参照)。
 */
export async function saveToSharePoint(videos: VideoRecord[], fetchedAt: string): Promise<void> {
  const siteId = await resolveSiteId();
  const listId = await resolveListId(siteId);
  const weekLabel = fetchedAt.slice(0, 10);

  for (const video of videos) {
    await graphFetch(`/sites/${siteId}/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ fields: toListItemFields(video, weekLabel) }),
    });
  }
}
