# 今日のことちゃん

## アプリ概要
娘・琴音の成長記録Webアプリ。1日1枚だけ写真を残す家族向けアルバム。横スクロールで時系列を体感できるのがコンセプト。

- 本番URL: https://koto-chan.vercel.app/
- GitHub: https://github.com/TaishiSase/koto-chan

## 技術スタック
- フロントエンド: HTML + CSS + Vanilla JS（フレームワークなし）
- DB: Supabase（PostgreSQL + Storage）
- ホスティング: Vercel
- 認証: Supabase Auth（書き込み保護のみ）

## ファイル構成
```
public/
  index.html    ← HTML
  script.js     ← 全ロジック
  styles.css    ← 全スタイル
  config.json   ← Supabase接続情報
package.json
```

## Supabaseスキーマ

### posts（投稿）
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| post_date | DATE UNIQUE | 投稿日（1日1枚） |
| image_url | TEXT | Supabase Storage URL |
| comment | VARCHAR(30) | 短いコメント（30文字以内） |
| is_favorite | BOOLEAN DEFAULT false | お気に入りフラグ |
| created_at / updated_at | TIMESTAMP | |

### Storageバケット
- `photos`（PUBLIC）: 写真ファイル

## RLSポリシー
- posts: SELECT は anon に許可（誰でも閲覧可）
- posts: INSERT/UPDATE は authenticated のみ
- storage.objects: SELECT は anon に許可
- storage.objects: INSERT は authenticated のみ

## 主要機能
1. **横スクロール時系列**: 写真を時系列で横スクロールして閲覧
2. **1日1枚ルール**: post_date にUNIQUE制約
3. **お気に入り**: ハートマークでお気に入り登録
4. **年齢表示**: 投稿日時点での琴音の年齢を表示
5. **マイルストーン**: 誕生日・節目イベントを自動表示
6. **グリッドビュー**: サムネイル一覧表示
7. **LINE共有**: 写真をLINEでシェア
8. **画像圧縮**: Canvasで圧縮してからアップロード

## 認証
- 閲覧は誰でも可（anon）
- 投稿・編集はSupabase Auth認証が必要
- パパ: `taish.dengel@gmail.com` / ママ: `vv8.shk.4ill@hotmail.co.jp`
