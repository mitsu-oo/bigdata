# GBIF MegaData Pulse

100万件をはるかに超える無料公開データを使う UI コンポーネントのデモです。

- データソース: [GBIF Occurrence API](https://www.gbif.org/developer/occurrence)
- 総レコード: 30億件超（API の `count` をリアルタイム表示）
- 機能:
  - 国・記録タイプごとのフィルタ
  - 過去10年の観測数推移チャート
  - Top species のランキング
  - API 接続不可時のデモデータ自動フォールバック（ブラウザ確認を止めない）

## ブラウザで確認する（ローカル）

```bash
python3 -m http.server 4173
```

- `http://localhost:4173` を開いてください。
- 画面が出ればコンポーネントは表示されています。
- ネットワーク制限がある環境では、ステータス欄に「デモデータ表示中」と出ます。

## GitHub Pages に公開する

このリポジトリには `.github/workflows/deploy-pages.yml` を追加済みです。

1. GitHub のリポジトリ設定で `Settings` → `Pages` を開く。
2. `Build and deployment` の `Source` が `GitHub Actions` であることを確認する。
3. `main` または `master` へ push すると、Actions の `Deploy static site to GitHub Pages` が実行される。
4. 公開 URL は通常 `https://<ユーザー名>.github.io/<リポジトリ名>/` です。

> 補足: この環境からは GitHub への push 操作を実行できないため、最終反映はリポジトリ側での push が必要です。
