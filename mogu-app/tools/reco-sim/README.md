# レコメンドのシミュレーション

`src/lib/recommend.js`（グループ向けお店レコメンド）を、Mogu Type 16タイプ × 16タイプの全組み合わせで検証・調整するための道具です。

| ファイル | 役割 |
|---|---|
| `corpus.json` | 検証用の店舗データ（渋谷の実店舗100件 ＋ ジャンルを補う架空店舗35件。架空店舗は名前が「［テスト］」で始まる） |
| `sim.mjs` | 全組み合わせで推薦を実行し、品質指標を計測する。`node sim.mjs` で初期式と現在の式を比較 |
| `tune.mjs` | パラメータの自動探索。`node tune.mjs 1200 500`（ランダム探索1200回＋局所探索500回、約2〜3分） |
| `build_corpus.py` | `corpus.json` の作り直し用 |

## 品質指標
- **budgetViolationRate**: 誰かの予算を1段階以上超える店が上位5件に入った割合（0であること＝必須条件）
- **miseryRate**: 上位5件のうち、どちらかの満足度が0.7未満の割合
- **fairnessGap**: 2人の満足度の差の平均
- **genreDiversity**: 上位5件のジャンル数
- **vtResponsiveness / budgetResponsiveness**: ペアの好み（見た目/味、予算）と推薦された店の特徴の相関
- **nfEffect / plEffect**: 開拓派ペアと行きつけ派ペアの「新しさ」の差、きっちり派ペアとノリ派ペアの「予約しやすさ」の差
- **topShopShare / nearDuplicateLists**: 同じ店・同じリストばかりにならないか
