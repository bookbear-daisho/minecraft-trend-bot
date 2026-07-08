# minecraft-trend-bot

YouTube上のマインクラフト関連動画を毎週自動で取得し、再生数・高評価数・コメント数・前回との差分からランキング化、傾向分析を行い、Microsoft Teamsへ投稿するバッチツールです。

ニコリヒトラボのカリキュラム作成、および「こっぴーふーチャンネル」の動画企画のインプットとして使うことを想定しています。

## 処理の流れ

```text
YouTube Data API
  ↓ (search.list: キーワード / 固定チャンネル)
対象動画のID収集(videoIdで重複排除)
  ↓ (videos.list: 最大50件ずつまとめて取得)
動画ごとの統計情報(再生数・高評価数・コメント数)を取得
  ↓
data/latest.json (前回データ) と比較して差分計算
  ↓
タグ分類 → curriculumFitScore / videoIdeaFitScore / trendScore を算出
  ↓
ランキング・傾向分析・授業化候補・動画案をMarkdownレポートにまとめる
  ↓
data/latest.json, data/snapshots/YYYY-MM-DD.json に保存
  ↓
Microsoft Teamsへ投稿
```

## ディレクトリ構成

```text
minecraft-trend-bot/
  package.json
  tsconfig.json
  .env.example
  data/
    snapshots/       # 実行ごとの履歴 (YYYY-MM-DD.json)
    latest.json       # 直近実行結果(次回との差分比較に使用)
  src/
    index.ts          # バッチ処理のエントリーポイント
    config.ts          # 環境変数・検索キーワード・チャンネル・タグルールなどの設定
    youtube/
      youtubeClient.ts # YouTube Data API v3 の薄いラッパー(search.list / videos.list)
      fetchVideos.ts    # キーワード・チャンネルから動画を収集し重複排除
    analysis/
      scoreVideos.ts    # 前回データとの差分・trendScore・videoIdeaFitScoreを計算
      classifyVideos.ts # タイトルのキーワードからタグ・curriculumFitScoreを算出
      buildReport.ts    # 傾向分析(TrendSummary)とMarkdownレポートを生成
    storage/
      loadSnapshot.ts   # data/latest.json の読み込み
      saveSnapshot.ts   # data/latest.json, data/snapshots/*.json への保存
    teams/
      postToTeams.ts    # Incoming Webhook / Power Automate へのPOST、失敗時通知
    types/
      video.ts          # VideoRecord, Snapshot, TrendSummary の型定義
  .github/workflows/weekly.yml # GitHub Actionsでの週次自動実行
```

## 1. YouTube Data API キーの取得方法

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスし、プロジェクトを作成(または既存のものを選択)。
2. 左メニュー「APIとサービス」→「ライブラリ」から **YouTube Data API v3** を検索して有効化する。
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」を選択し、APIキーを発行する。
4. 必要に応じて、発行したAPIキーに「YouTube Data API v3のみ許可」のAPI制限をかけておくと安全です。
5. 発行されたキーを `.env` の `YOUTUBE_API_KEY` に設定します。

**クォータについて**: YouTube Data API v3 は1日あたり既定で10,000ユニットのクォータです。`search.list` は1回あたり**100ユニット**、`videos.list` は1回あたり**1ユニット**(IDをまとめて渡しても1ユニット)消費します。本ツールは `SEARCH_QUERIES` の数だけ `search.list` を呼ぶため、キーワード数を増やしすぎるとクォータを圧迫します。動画IDの統計取得は必ず50件ずつまとめて `videos.list` を呼ぶ実装になっています。

## 2. Teams Webhook URLの設定方法

### Incoming Webhookを使う場合(`TEAMS_POST_MODE=incomingWebhook`)

1. 投稿先のTeamsチャンネルの「…」メニュー →「コネクタ」(または「ワークフロー」)を開く。
2. 「Incoming Webhook」を検索して追加し、名前・アイコンを設定して作成する。
3. 発行されたWebhook URLをコピーし、`.env` の `TEAMS_WEBHOOK_URL` に設定する。

※ Microsoft社の仕様変更により、テナントによっては従来のIncoming WebhookコネクタがOffice 365 コネクタとして廃止/移行対象になっている場合があります。その場合は下記のPower Automateを利用してください。

### Power Automateを使う場合(`TEAMS_POST_MODE=powerAutomate`)

1. [Power Automate](https://make.powerautomate.com/) で「インスタントクラウドフロー」を新規作成。
2. トリガーに「HTTP要求の受信時」(When a HTTP request is received / Teams Webhook相当) を選択。
3. アクションに「Microsoft Teamsに投稿」→「チャネルにメッセージを投稿する」などを追加し、HTTP要求ボディの `text` (や `title`) を本文にマッピングする。
4. フロー保存後に発行される「HTTP POST URL」を `.env` の `TEAMS_WEBHOOK_URL` に設定し、`TEAMS_POST_MODE=powerAutomate` に設定する。

この場合、`postToTeams.ts` は以下の形式でPOSTします。

```json
{
  "title": "今週のマイクラ人気動画ランキング",
  "text": "(Markdownレポート本文)",
  "generatedAt": "2026-07-03T00:00:00.000Z"
}
```

## 3. `.env` の作り方

```bash
cp .env.example .env
```

作成した `.env` を編集し、以下を設定してください。

```env
YOUTUBE_API_KEY=your_youtube_api_key
TEAMS_WEBHOOK_URL=https://example.com/webhook
TEAMS_POST_MODE=incomingWebhook
MAX_RESULTS_PER_QUERY=25
TARGET_DAYS=30
```

`.env` は `.gitignore` に含まれているため、リポジトリにはコミットされません。APIキーやWebhook URLをコード中に直書きしないでください。

## 4. 実行方法

```bash
npm install

# 開発時(tsxでそのままTypeScriptを実行)
npm run dev

# ビルドしてから実行
npm run build
npm start
```

初回実行時は `data/latest.json` が空(または存在しない)ため、`weeklyViewIncrease` は「公開日からの経過日数から算出した1日あたり増加数 × 7」で仮計算されます。2回目以降の実行では前回の `viewCount` との差分になります。

## 5. Windowsのタスクスケジューラで週1実行する方法

1. プロジェクトを事前に `npm install` して `npm run build` し、`dist/index.js` を作成しておきます。
2. タスクスケジューラ(`taskschd.msc`)を開き、「タスクの作成」を選択。
3. 「全般」タブ: タスク名(例: `minecraft-trend-bot`)を入力。「ユーザーがログオンしているかどうかにかかわらず実行する」を選ぶと確実です。
4. 「トリガー」タブ:「新規」→ 開始「毎週」→ 曜日「月」、時刻「09:00」を設定。
5. 「操作」タブ:「新規」→
   - プログラム/スクリプト: `node`(または `node.exe` のフルパス、`where node` で確認可能)
   - 引数の追加: `dist/index.js`
   - 開始(作業フォルダー): プロジェクトのルートフォルダ(例: `C:\path\to\minecraft-trend-bot`)を指定。`.env` を読み込むため、作業フォルダの指定は必須です。
6. 「条件」「設定」タブは環境に応じて調整(例: バッテリー駆動でも実行する、など)。
7. 保存後、タスクを右クリック→「実行」でテストし、Teamsに投稿されるか確認してください。

## 6. GitHub Actionsで週1実行する方法

`.github/workflows/weekly.yml` を用意しています。日本時間 毎週月曜9:00 に実行されます(GitHub ActionsのcronはUTCのため `0 0 * * 1` = UTC月曜0:00 = JST月曜9:00)。

事前準備:

1. リポジトリの Settings → Secrets and variables → Actions で以下のSecretsを登録します。
   - `YOUTUBE_API_KEY`
   - `TEAMS_WEBHOOK_URL`
2. 手動実行して動作確認したい場合は、Actionsタブから該当ワークフローを選び「Run workflow」(`workflow_dispatch`)を実行してください。

**データ永続化に関する注意**: GitHub Actionsの実行環境は毎回使い捨てのため、`data/latest.json` をリポジトリにコミットして永続化しないと、次回実行時に「前回データ」が読み込めず、常に初回相当の仮計算になってしまいます。そのため `weekly.yml` には実行後に `data/` の変更を自動コミット&プッシュするステップを含めています。この挙動が不要、または別の永続化方法(後述のGoogle Sheets / Supabaseなど)に切り替える場合は、該当ステップを削除してください。

## 7. 将来的にGoogleスプレッドシート/Supabaseへ保存先を変える方法

現在の保存処理は `src/storage/loadSnapshot.ts`(読み込み)と `src/storage/saveSnapshot.ts`(書き込み)の2ファイルに閉じています。他のコード(`index.ts` や `scoreVideos.ts`)は `Snapshot` 型(`{ fetchedAt: string; videos: VideoRecord[] }`)としてやり取りするだけで、保存先の実装詳細を意識していません。

移行する場合は、この2ファイルの中身だけを差し替えれば済むようにしています。

### Google Sheetsへ変更する場合

- `googleapis` パッケージ等を使い、`loadLatestSnapshot()` はシートの最新シート(または特定範囲)を読み込んで `Snapshot` 型に変換して返す。
- `saveSnapshot()` は「最新シート」を上書きし、日付名の新規シート(または追記行)に履歴を保存する。
- 認証はサービスアカウントのJSON鍵を環境変数(`GOOGLE_SERVICE_ACCOUNT_KEY` など)経由で読み込む形にすると、GitHub Actions Secretsとも相性が良いです。

### Supabase / DBへ変更する場合

- `@supabase/supabase-js` などのクライアントを使い、`loadLatestSnapshot()` は最新の1件(例: `fetched_at` 降順1件)を取得。
- `saveSnapshot()` は動画テーブルへのinsert/upsertと、スナップショット管理用テーブルへのinsertを行う。
- 接続情報は `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` などを `.env` に追加して読み込む。

いずれの場合も、`config.ts` の `DATA_DIR` / `LATEST_JSON_PATH` / `SNAPSHOTS_DIR` はローカルJSON実装専用の定数なので、移行後は未使用になる想定です。

## スコアリング・分類ロジック

### trendScore(ランキング用)

```ts
trendScore = weeklyViewIncrease + likeCount * 10 + commentCount * 50
```

`weeklyViewIncrease` は前回データがあれば `current.viewCount - previous.viewCount`、なければ `公開日からの経過日数` から按分した推定値です。

### curriculumFitScore(タグごとの加点)

コマンド+30 / 建築+25 / レッドストーン+25 / アドオン+30 / 脱出・謎解き+30 / ミニゲーム+25 / ホラー-10 / セキュリティ+20 / AI活用候補+30(`src/config.ts` の `CURRICULUM_FIT_SCORE_BY_TAG` で定義)

### videoIdeaFitScore

`weeklyViewIncrease` の大きさ・企画向けタイトルキーワード(「作ってみた」「対決」「最強」「検証」「100日」「逃走中」「秘密基地」)・授業化しやすいタグの有無から加点します(`src/analysis/scoreVideos.ts`)。

## 今後の拡張予定(未実装)

- TeamsへAdaptive Card形式で投稿(現在はプレーンテキスト/Markdown文字列のみ)
- サムネイル画像付き投稿(`VideoRecord.thumbnailUrl` は既に取得済みのため、Adaptive Card化時に利用可能)
- チャンネル別・タグ別の週次推移グラフ
- 子ども向け／保護者向け／授業向けで企画を分類
- `buildReport.ts` の `IdeaGenerator` をOpenAI/Claude API呼び出しに差し替え、タイトル案・サムネ文言・授業タイトルまで自動生成
