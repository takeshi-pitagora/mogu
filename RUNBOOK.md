# MogU iOS 公開ランブック（TestFlight まで）

このフォルダの内容を GitHub に載せ、Codemagic（Mac不要）で iOS をビルドして
TestFlight へ配信するまでの手順です。上から順に進めてください。

---

## 0. このパックに入っているもの

| 区分 | 内容 |
|---|---|
| **ビルドに必須** | `codemagic.yaml`（リポジトリ直下）／`mogu-app/ios/`（iPhoneアプリの土台）／`mogu-app/capacitor.config.ts` |
| **審査で必須** | アカウント削除（`ProfileScreen.jsx` + Edge Function `delete-account`）／`docs/`（プライバシーポリシー等）／`PrivacyInfo.xcprivacy` |
| **仕上げ** | アプリアイコン（iOS・Android全サイズ）／セーフエリア対応／iPhone専用設定 |

既存の画面（スワイプ・グループ・保存）の処理には触れていません。
既存ファイルで変わるのは 9 個だけです（`ProfileScreen.jsx` は元の 1 行を置き換え、残りは追加のみ）。

---

## 1. GitHub に載せる（ブランチ + Pull Request）

1. https://github.com/anzu-1206/mogu → **Add file → Upload files**
2. このパックの **中身**（`RUNBOOK.md` `codemagic.yaml` `docs` `mogu-app` `store-assets`）をドラッグ＆ドロップ
   - 外側のフォルダ自体ではなく、中の 5 つを選ぶ
   - 重い場合は 2 回に分ける（①ios・android 以外 ②ios・android）
3. 下部で **Create a new branch for this commit and start a pull request** を選び、ブランチ名 `app-store-prep`
4. **Propose changes → Create pull request**
5. 髙水さんが確認して Merge（Codemagic は Merge 前でもこのブランチで試せる）

### GitHub Pages を有効化（プライバシーポリシーの公開）
**Settings → Pages → Source: Deploy from a branch → Branch: main / フォルダ: /docs → Save**
※ Merge 後に設定。数分後、以下が開けるようになります。
- https://anzu-1206.github.io/mogu/privacy-policy.html
- https://anzu-1206.github.io/mogu/terms.html
- https://anzu-1206.github.io/mogu/support.html

---

## 2. Supabase（アカウント削除の関数をデプロイ）

カメラ機能を外したので、バケット作成などは **不要** です。必要なのはこれだけ。

```bash
npx supabase login
npx supabase link --project-ref azcwpopmxavqxpvdjglf
npx supabase functions deploy delete-account
```

**必ず実機/ブラウザで動作確認**してください（Apple が審査で実際に押します）。
1. テスト用のメールアカウントを新規登録
2. マイページ →「アカウント削除」→「削除」と入力 → 実行
3. ログイン画面に戻り、同じメールでログインできなくなっていれば成功
4. 失敗する場合は Supabase → Edge Functions → delete-account → Logs に `[テーブル名] エラー内容` が出ます

> 既存テーブルの RLS（行レベルセキュリティ）が有効かも、ダッシュボードの Authentication → Policies で確認してください。

---

## 3. Codemagic（Mac不要でビルド → TestFlight）

### 3-1. リポジトリを連携
Codemagic → **Add application** → GitHub の `anzu-1206/mogu` を選択
（リポジトリ直下の `codemagic.yaml` が自動で使われます。ワークフロー名：`MogU iOS (TestFlight)`）

### 3-2. App Store Connect 連携（署名を自動化）
**Teams → Integrations → App Store Connect → Add key**
- Issuer ID：App Store Connect の「統合」画面に表示されているもの
- Key ID：`codemagic-key-final` の Key ID
- API Key：ダウンロードした `.p8` ファイル
- **名前は必ず `mogu_app_store_connection`**（yaml の記述と一致させる）

### 3-3. 環境変数グループ
**Environment variables → グループ名 `mogu_secrets`** に以下を登録（Secure にチェック）
- `VITE_SUPABASE_URL` … Supabase → Project Settings → API の Project URL
- `VITE_SUPABASE_ANON_KEY` … 同じ画面の anon public key

### 3-4. 初回ビルド
**Start new build → ブランチ `app-store-prep` → ワークフロー `MogU iOS (TestFlight)`**
自動実行はオフにしてあります（push のたびに有料のMac分数を使わないため）。

成功すると TestFlight に自動アップロードされます（反映まで数分〜数十分）。
TestFlight アプリを自分の iPhone に入れて、実機で確認してください。

**ビルドが失敗したら**：ビルドログの最後の 50 行をそのまま共有してください。原因を特定して直します。

---

## 4. App Store Connect の残り作業

### App Privacy（データ収集の申告）— 実態ベース
| 項目 | 回答 |
|---|---|
| 連絡先情報 | **メールアドレス** のみ（名前・電話・住所は選ばない） |
| ユーザコンテンツ | **その他のユーザコンテンツ**（グループ名）。写真/ビデオは **選ばない** |
| 識別子 | **ユーザID**（ゲストの匿名IDを含む）。デバイスIDは選ばない |
| 使用状況データ | **製品の操作**（スワイプ・保存の履歴） |
| 位置情報・財務・健康・閲覧履歴・診断 | 選ばない |

選んだ各項目の共通回答：**目的＝Appの機能のみ／ユーザーに紐付く＝はい／トラッキング＝いいえ**

### 審査ノート（App Review 情報）
`appstore_texts.md` の「審査ノート」をそのまま貼り付け。

### 提出前チェック
- [ ] プライバシーポリシーURLが実際に開く（GitHub Pages 有効化後）
- [ ] 問い合わせ先メールアドレスを実在のものに差し替えた（下記）
- [ ] 審査用アカウント（メール・パスワード）を用意した
- [ ] アカウント削除を TestFlight の実機で確認した
- [ ] スクリーンショット 4 枚を登録した

---

## 5. 公開前に必ず差し替える箇所（現在はプレースホルダー）

`support@example.com` を実際のメールアドレスに置換：
- `docs/privacy-policy.html`
- `docs/support.html`
- `mogu-app/src/pages/ProfileScreen.jsx`（`SUPPORT_EMAIL` 定数）

---

## 6. 正直な注意点

- **この環境では iOS の実コンパイルと署名はできません。** `npm ci`／ビルド／`cap sync`／設定ファイルの整合性は
  クリーン環境で検証済みですが、Xcode でのコンパイル・署名は Codemagic 上で初めて実行されます。
  初回ビルドで環境依存の問題が出る可能性があるため、失敗時はログを共有してください。
- **審査 4.2（Webアプリを包んだだけ、と判定されるリスク）** はカメラ撤去により保険が無くなりました。
  スワイプ・グループ・マッチングなど機能は十分あるため通る可能性は高いですが、指摘された場合は
  ネイティブ機能（共有シート・触覚フィードバックなど、権限不要のもの）の追加で対応できます。
- LINE／Apple／Google ログインは未実装です。メール+パスワードとゲストのみのため、Apple 4.8
  （Sign in with Apple 併設）の対象外です。ソーシャルログインを追加する際に必要になります。
