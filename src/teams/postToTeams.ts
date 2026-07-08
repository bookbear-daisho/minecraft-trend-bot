import { TEAMS_POST_MODE, TEAMS_WEBHOOK_URL } from "../config";
import { AdaptiveCard } from "../analysis/buildAdaptiveCard";

export type TeamsPostMode = "incomingWebhook" | "powerAutomate";

/**
 * incomingWebhook: 従来のMessageCard形式ではなくAdaptive CardをattachmentsでラップしてPOSTする
 * (Incoming WebhookコネクタはAdaptive Cardのattachments形式にも対応している)。
 *
 * powerAutomate: フロー側で「カードをチャットまたはチャネルに投稿する」アクションにそのまま
 * 渡せるよう、cardフィールドにAdaptive Card本体をそのまま入れて渡す。
 */
function buildBody(mode: TeamsPostMode, card: AdaptiveCard): unknown {
  if (mode === "powerAutomate") {
    return {
      title: "今週のマイクラ人気動画ランキング",
      generatedAt: new Date().toISOString(),
      card,
    };
  }
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card,
      },
    ],
  };
}

async function post(mode: TeamsPostMode, card: AdaptiveCard): Promise<void> {
  const res = await fetch(TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(mode, card)),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teams投稿に失敗しました: ${res.status} ${res.statusText} - ${body}`);
  }
}

/**
 * TEAMS_POST_MODE ("incomingWebhook" | "powerAutomate") に応じてbody形式を切り替えてTeamsへ投稿する。
 */
export async function postToTeams(card: AdaptiveCard, mode: TeamsPostMode = TEAMS_POST_MODE): Promise<void> {
  await post(mode, card);
}

/**
 * バッチ処理が失敗した際にTeamsへ簡易エラー通知を送る。
 * 通知自体が失敗しても、呼び出し元の本来のエラーをもみ消さないよう例外は握りつぶさずログのみ出す。
 */
export async function postErrorToTeams(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const card: AdaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "⚠️ マイクラ人気動画ランキング バッチ処理失敗",
        size: "Large",
        weight: "Bolder",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `発生日時: ${new Date().toISOString()}`,
        isSubtle: true,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: message,
        wrap: true,
        fontType: "Monospace",
      },
    ],
  };

  try {
    await post(TEAMS_POST_MODE, card);
  } catch (notifyError) {
    console.error("Teamsへのエラー通知にも失敗しました:", notifyError);
  }
}
