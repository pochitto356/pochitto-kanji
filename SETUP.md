# ぽちっと漢字 — 公開までの準備手順

最終更新: 2026-09-12 / 作成: Claude
← [[00_INDEX]] / [[仕様_v0.1]] / [[共通_開発環境]]

コード側（ゲーム本体・広告・課金・通知・ビルド設定）は**できています**。
あとは **konishiさんにしかできない登録作業**（アカウントが必要なもの）を終えれば、ビルドして TestFlight に上げられます。

作業は上から順に。**所要時間は全部で1時間ほど**です。
各ステップで「Claudeに渡す値」を控えておいてください。最後にまとめて教えていただければ、こちらで設定ファイルに入れます。

---

## ステップ1. GitHub にリポジトリを作る（10分）

1. https://github.com/new を開く
2. Repository name に **`pochitto-kanji`**、Public を選択（GRID HUNTER と同じ。Privateでも可）
3. 「Create repository」
4. 作られたページの「uploading an existing file」をクリック
5. お渡しした **`pochitto-kanji-app.zip` を展開したフォルダの中身**をドラッグ＆ドロップ
   （`package.json` `capacitor.config.json` `codemagic.yaml` `www/` `assets/` などが**直下**に来るように。
   `pochitto-kanji-app` フォルダごと入れると1階層深くなってビルドが失敗します）
6. 「Commit changes」

> **もっと楽な方法**: Claude の設定で GitHub アカウントを連携していただくと、次回から私が直接コミット・プッシュできます（GRID HUNTER やマッスルフレンドと同じ運用）。今回だけは手動アップロードをお願いします。

**Claudeに渡す値**: リポジトリのURL

---

## ステップ2. App Store Connect でアプリを作る（15分）

1. https://appstoreconnect.apple.com → マイApp → ＋ → 新規App
2. 次のとおり入力

| 項目 | 値 |
|---|---|
| プラットフォーム | iOS |
| 名前 | ぽちっと漢字 |
| プライマリ言語 | 日本語 |
| バンドルID | `com.konishi.pochittokanji` ※先に作成が必要（下記） |
| SKU | `pochittokanji` |
| ユーザーアクセス | 制限なし |

> バンドルIDが一覧に出てこない場合は、先に https://developer.apple.com/account/resources/identifiers で
> **App IDs → ＋ → App → Description「Pochitto Kanji」/ Bundle ID（Explicit）`com.konishi.pochittokanji`** を作成してください。
> Capabilities は **In-App Purchase** にチェック（デフォルトで入っています）。

3. 作成後、左メニュー「App情報」でカテゴリを設定
   - **プライマリ: 教育**
   - **セカンダリ: ゲーム → 単語**
4. 「年齢制限指定」→ すべて「なし」で **4+**
5. ブラウザのURL `.../apps/【この数字】/...` が **Apple ID**（例: 6806726004）

**Claudeに渡す値**: Apple ID（10桁の数字）

### 2-1. アプリ内課金を登録する

1. 左メニュー「収益化 → App内課金」→ ＋
2. タイプ: **非消耗型**
3. 参照名: `広告なし`／ 製品ID: **`pochittokanji_premium`**
4. 価格: **¥480**（Tier の一覧から480円のものを選択）
5. ローカリゼーション（日本語）
   - 表示名: `広告なし+ヒント無制限`
   - 説明: `広告が表示されなくなり、ヒントを回数制限なく使えるようになります。買い切りです。`
6. 審査用スクリーンショットは、実機で設定画面を撮って後から添付します（Claudeが手順をお伝えします）

---

## ステップ3. AdMob で広告ユニットを作る（15分）

1. https://apps.admob.com → アプリ → アプリを追加
2. プラットフォーム **iOS**、「App Storeに登録済みですか？」→ **いいえ**（まだ未公開のため）
3. アプリ名: `ぽちっと漢字`
4. できた **アプリID**（`ca-app-pub-7792368657314009~XXXXXXXXXX`）を控える
5. 「広告ユニット」→ 次の**3つ**を作成し、それぞれのIDを控える

| 種類 | 広告ユニット名 | 用途 |
|---|---|---|
| バナー | `PK_banner_home` | ホーム画面の下 |
| インタースティシャル | `PK_interstitial_practice` | 練習モード5問ごと |
| リワード | `PK_rewarded` | ヒント・コンティニュー・ストリーク保護 |

6. 「アプリを確認」（app-ads.txt）は公開後で構いません

**Claudeに渡す値**: アプリID + 広告ユニットID 3つ

---

## ステップ4. プライバシーポリシーを公開する（5分）

1. `pochitto356.github.io` リポジトリを開く（GRID HUNTER のときに使ったもの）
2. `privacy/pochittokanji-privacy.html` を **`pochittokanji-privacy.html`** という名前でアップロード
3. 数分後 https://pochitto356.github.io/pochittokanji-privacy.html で開けることを確認

---

## ステップ5. Codemagic にアプリを追加する（10分）

1. https://codemagic.io → Add application
2. GitHub → `pochitto-kanji` を選択
3. 「codemagic.yaml を使用」を選ぶ（リポジトリに入っています）
4. Teams → Code signing identities で、`com.konishi.pochittokanji` のプロビジョニングプロファイルを **Fetch profiles**
   - 「No matching profiles found」が出たら、developer.apple.com で App Store 配布用プロファイルを先に作成

> ⚠ ビルド開始時は必ず URL の `?app_id=` でアプリを絞り込んでから「Start new build」を押してください
> （9/4 に GRID HUNTER のビルドを誤爆した教訓）

---

## 以上が終わったら

次の5つを教えてください。こちらで `codemagic.yaml` と `www/native.js` に入れて、ビルドできる状態にします。

```
1. Apple ID（数字10桁）      : 
2. AdMob アプリID            : ca-app-pub-...~...
3. バナー広告ユニットID       : ca-app-pub-.../...
4. インタースティシャルID     : ca-app-pub-.../...
5. リワードID                : ca-app-pub-.../...
```

**現在はGoogle公式のテスト広告IDが入っています。** 本番IDに差し替えるまで審査に出さないでください
（テストIDのまま提出すると、広告が出ない・収益が発生しない状態になります）。

---

## そのあとClaudeがやること

1. 実IDへの差し替え、`IS_TESTING = false` に変更
2. Codemagic でビルド → TestFlight へアップロード
3. konishiさんに実機確認をお願いする（購入シートが出るか・広告が出るか・通知が来るか）
4. App Store Connect のメタデータ入力（説明文・キーワード・スクリーンショット。文章はChatGPT案から）
5. 審査提出 ← **ここは必ずkonishiさんの「OK」をもらってから押します**

## 審査で気をつける点（過去2アプリの教訓）

| 教訓 | 本アプリでの対応 |
|---|---|
| 課金の初期化を `window.load` でやると商品が取れず却下（GRID HUNTER 2.1(b)） | `deviceready` を待って初期化。商品未取得なら `store.update()` で取り直してから注文（`native.js`）済み |
| 横画面固定で iPad マルチタスク要求のアップロードエラー 90474 | 縦画面固定＋`UIRequiresFullScreen=YES` を `codemagic.yaml` に記載済み |
| 初回申請でガイドライン2.1「情報要求」 | 提出時に操作の画面録画を最初から添付する |
| 同じ不具合を全アプリに横展開していなかった | 本アプリは最初から対策込み |
| ATT は AdMob 初期化の前 | `AdMob.initialize({requestTrackingAuthorization:true})` で順序を保証 |

## App Privacy（データ収集の申告）に書く内容

- **サードパーティ広告**: 「識別子 → デバイスID」「使用状況データ → 製品インタラクション」を収集、トラッキングに使用（AdMob）
- 開発者自身は何も収集しない（アカウントなし・サーバーなし）
- 購入情報は Apple が処理（申告不要）
