# ieltsapp

IELTS の4技能を、スマホで少しずつ練習するアプリ(React + TypeScript + Vite)。
元は [msk978/eiwaku-app](https://github.com/msk978/eiwaku-app) の英文穴埋めアプリで、IELTS 版をこのリポジトリに移して機能を足した。

## できること

- **Writing Task 2 / Task 1**: モデルエッセイを穴埋めで覚える。使える表現はマーキング済みで、全文和訳つき
  - 「型を見る」から、Task 2 の5つの型・Task 1 の4つの型の段落ごとの書き出し、注意点、採点基準を確認し、各型のエッセイ例をそのまま練習できる
- **Reading**: 本番と同じ設問形式(段落選択・TRUE/FALSE/NOT GIVEN・YES/NO/NOT GIVEN・4択・組み合わせ・空所補充)の演習。タイマー、自動採点、バンドの目安、根拠の段落つきの日本語解説
- **語彙**: トピック別(環境・教育・テクノロジーなど12トピック)のコロケーションを例文の穴埋めで覚える
- **Speaking**: Part 1〜3 の質問とモデルアンサーを穴埋めで覚える

保存はブラウザの中だけ(設定画面からバックアップ・引き継ぎができる)。

## 開発

```bash
npm ci
npm run dev -- --mode everyone   # IELTS 版を起動
npm test
npm run build:everyone           # dist に出力
```

`main` に push すると、GitHub Actions がテストとビルドをして GitHub Pages に公開する(リポジトリの Settings → Pages で Source を「GitHub Actions」にしておく)。

## 内蔵の題材

- `src/data/band6/` Writing のモデルエッセイ・図・和訳(`task2Models.txt` が型ごとの全文モデル)
- `src/data/reading/*.json` Reading の本文・設問・解説
- `src/data/collocationTopics.txt` / `collocationTranslations.txt` 語彙
- `src/data/speakingTopics.txt` / `speakingPrompts.txt` / `speakingTranslations.txt` Speaking
- `src/lib/writingTemplates.ts` Writing の型と採点基準

Reading・語彙・Speaking の英文はすべてこのアプリ用に書き下ろしたもの。
