# ぽちっと漢字 (Pochitto Kanji)

上下左右の4つの漢字すべてと熟語になる「まんなかの漢字」を当てる、毎日3問のパズル。
pochitto games / iOS (Capacitor 7)

- 本体: `www/index.html`（HTML/CSS/JS 1ファイル）
- 問題データ: `www/puzzles.js`（469問・読み付き。別解チェック済み）
- ネイティブ連携: `www/native.js`（AdMob / アプリ内課金 / ローカル通知）
- ビルド: `codemagic.yaml`（Codemagic のクラウドMacでIPA作成 → App Store Connect）

## 遊び方
毎日3問（やさしい・ふつう・むずかしい）。日付で問題が決まるので、全員が同じ問題を解く。
答えはキーボードで漢字1文字を入力。3回まで挑戦でき、ヒント（候補6枚 → 2枚消す → 読み）も使える。
連続日数（ストリーク）、過去問カレンダー、バッジ10種、結果のシェア。

## 収益
- バナー（ホームのみ）／ インタースティシャル（練習5問ごと・初回起動から3日目以降）
- リワード動画（ヒント・コンティニュー・ストリーク保護）
- 買い切り `pochittokanji_premium` ¥480（広告なし＋ヒント無制限）

## 開発
```bash
npm install
npx cap add ios && npx cap sync ios   # Macが必要。通常は Codemagic 側で実行
```
ブラウザで `www/index.html` を直接開けば、広告・課金なしでそのまま遊べる（動作確認用）。

## 問題データの検証
`tools/check.py`（JMdictと照合して別解・読みを検査）。詳細は `tools/README_tools.md`。
辞書はライセンス上アプリには同梱せず、制作時の検査にのみ使用。

## 公開までの手順
`SETUP.md` を参照。
