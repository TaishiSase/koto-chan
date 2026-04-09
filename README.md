# 今日のことちゃん

娘のその日のベスト写真を1日1枚だけ保存し、短いコメントとともに日々の成長を振り返るためのウェブアプリです。

## 🌟 特徴

- 📸 **毎日1枚だけ保存** - 家族で共有するベスト写真を記録
- 💬 **シンプルなコメント** - 30文字までのコメント付き
- 👨‍👩‍👧 **家族向け** - パスワード保護で家族の思い出を安全に管理
- 🎨 **季節表現** - 春夏秋冬の色とアイコンで視覚的に表現
- ⭐ **お気に入い機能** - 思い出に残る写真をマーク
- 📱 **スマホ最適化** - iPhoneを中心にモバイル対応
- 🔄 **横スクロール体験** - 時間が流れていく感覚で成長を見返せる

## 🛠️ セットアップ

### 必要なもの

- Node.js (npm)
- GitHub アカウント
- Supabase 無料アカウント
- Vercel アカウント（デプロイ用、GitHub と連携可能）

### ステップ1: Node.js のインストール

[Node.js 公式サイト](https://nodejs.org) から LTS 版をダウンロードしてインストールしてください。

### ステップ2: Supabase セットアップ

1. [Supabase](https://supabase.com) を開き、GitHub でサインアップ
2. 新しいプロジェクトを作成
3. SQL エディタで以下を実行してテーブルを作成：

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_date DATE NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  comment VARCHAR(30) NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

> **注意**: Supabase の `storage.objects` テーブルは内部管理用のため、自分で作成する必要はありません。Storage バケットを新規作成するだけで十分です。

4. Storage セットアップ:
   - 「Storage」>「New Bucket」
   - 名前: `photos`
   - Public を選択

5. Policy の確認:
   - 公開バケットにした場合、ファイルの読み込みは公開されますが、アップロード権限は別です。
   - ブラウザから anon キーで `storage.upload()` する場合は、Storage のポリシーを設定する必要があります。
   - `posts` テーブルも anon で操作するなら、Database 側で `SELECT` / `INSERT` / `UPDATE` のポリシーを追加してください。

### ステップ3: 設定ファイル作成

1. `public/config.json` を編集（既に作成済み）：

2. Supabase から以下を取得:
   - Project URL → `supabaseUrl`
   - Anon Public Key → `supabaseKey`

3. `public/config.json` を編集:

```json
{
  "supabaseUrl": "https://xxxxx.supabase.co",
  "supabaseKey": "eyJhbGci..."
}
```

### ステップ4: ローカルで実行

```bash
npm install
npm start
```

ブラウザで `http://localhost:3000` を開き、パスワード `ことねこ` でログイン

### ステップ5: Vercel でデプロイ

1. このリポジトリを GitHub にプッシュ
2. [Vercel](https://vercel.com) で GitHub リポジトリをインポート
3. 環境変数は設定不要（`config.json` に記載済み）
4. デプロイして完了！

## 📱 使い方

### トップページ（今日）
- 本日の投稿を表示
- 未投稿の場合は「未投稿です」表示

### 投稿ページ
- 写真を選択（JPG / PNG / HEIC 対応）
- 30文字以内のコメント入力
- 既に投稿がある場合は上書き警告が表示
- 投稿ボタンで保存

### 一覧ページ
- 横スクロールで全投稿を表示
- 月・週の区切り線表示
- 季節の色とアイコンで視覚化
- 写真をタップでポップアップ表示

### お気に入りページ
- ⭐マークで登録した写真のみ表示

## 🔐 セキュリティ

- **パスワード**: `ことねこ`（仕様書固定）
- **認証状態**: 24時間保持（ローカルストレージ）
- 共通パスワード方式のため、将来的には個別アカウント化も可能

## 📦 技術スタック

- **フロントエンド**: HTML5 + CSS3 + Vanilla JavaScript
- **バックエンド / DB**: Supabase (PostgreSQL + Auth + Storage)
- **ホスティング**: Vercel
- **画像処理**: Canvas API + heic2any ライブラリ

## 🌐 環境変数

ローカル開発時：
- `public/config.json` に Supabase キーを記載

本番環境（Vercel）：
- 環境変数は設定不要（`config.json` をコミット）

## 📝 データベーススキーマ

### posts テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | プライマリキー |
| post_date | DATE | 投稿日（UNIQUE） |
| image_url | TEXT | 画像の URL |
| comment | VARCHAR(30) | 30文字以内のコメント |
| is_favorite | BOOLEAN | お気に入りフラグ |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

## 🚀 今後の拡張

- [ ] 動画対応
- [ ] 月ごとのまとめ表示
- [ ] 通知機能
- [ ] ダウンロード機能
- [ ] 個別ユーザーアカウント化
- [ ] コメント編集機能

## 📄 ライセンス

MIT License - 家族で自由に使用・改造できます

## 💝 作成者

Taishi Sase

---

**パスワード**: ことねこ

Happy memories! 🎉
