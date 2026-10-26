# 海外旅行予算ナビ

出発地域・旅行先・日程・航空会社から海外旅行の予算の目安を計算するサイトです。トップページと35都市のページがあります。

## ファイル構成

| ファイル | 中身 |
|---|---|
| `index.html`、`cities/*.html` | 公開するページ。`build.ps1` で自動生成されるので**直接編集しない** |
| `templates/page.html` | 上のページの元になるテンプレート |
| `site.json` | サイトのURL、更新日、ページのタイトル・説明文、都市の一覧 |
| `assets/data.js` | 料金の相場、航空会社、旅行先の注意点 |
| `plan.html`、`assets/planner.js`、`assets/plan.css`、`assets/spots.js` | 旅のしおり作成。`spots.js` の行き先ごとのスポット（「名前\|エリア\|タグ\|時間帯\|ひとこと」）から日ごとの予定を組み、予算の目安とAIへの依頼文も作る。スポットを増やすときは `spots.js` に行を足すだけ |
| `find.html`、`assets/finder.js`、`assets/find.css` | 予算から行き先を探す（予算逆算）と行き先診断。見積もりは app.js の計算を共用。診断で使う都市のタグは `assets/data.js` の `VIBES` |
| `map.html`、`assets/map.js`、`assets/map.css` | 旅の世界地図。写真を撮った場所を地図に貼る。写真はユーザーのブラウザ内（IndexedDB）にだけ保存し、サーバーには送らない |
| `assets/entry.js` | 入国情報（ビザ・渡航認証）。施行日つきで管理し、旅行の日付に合わせて自動で切り替わる |
| `assets/affiliates.js` | アフィリエイトリンクの設定（収益化） |
| `assets/app.js` | 計算と画面の処理 |
| `assets/scenes.js` | 背景の風景イラスト |
| `assets/style.css` | デザイン |
| `privacy.html`、`disclaimer.html` | プライバシーポリシー、免責事項・運営者情報 |
| `sitemap.xml`、`robots.txt` | 検索エンジン向けのファイル（自動生成） |

## ページを作り直す

`templates/page.html` か `site.json` を変えたら、このフォルダでPowerShellを開いて実行します。

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

`assets/` の中のファイルだけを変えた場合は、作り直さなくても反映されます。

## 公開するまでの手順

1. **【】の部分を埋める**
   `privacy.html` と `disclaimer.html` の「【運営者名を記入】」「【お問い合わせフォームのURLまたはメールアドレスを記入】」を書き換える。
   メールアドレスを載せたくない場合は、Googleフォームでお問い合わせフォームを作ってURLを載せる方法があります。

2. **公開する（無料）**
   GitHubにこのフォルダをアップロードして、GitHub Pages か Cloudflare Pages で公開します。
   ビルドの設定は不要で、フォルダの中身をそのまま公開すれば動きます。

3. **独自ドメインを設定する**
   ドメインを取得して公開サービスに設定したら、`site.json` の `"site"` を自分のURL（例：`https://tabi-yosan.com`）に書き換えて `build.ps1` を実行し、もう一度アップロードします。
   これで各ページのURL表記と `sitemap.xml` が正しくなります。

4. **Google Search Console に登録する**
   サイトを登録して `sitemap.xml` を送信すると、検索結果に早く載りやすくなります。

## 収益化の設定

### アフィリエイト
1. A8.net、もしもアフィリエイト、バリューコマースなどに登録する（審査に公開済みのサイトが必要なことが多いので、公開後に申し込む）
2. 航空券・宿・ツアー・eSIM・海外旅行保険などの広告主と提携する
3. 発行されたリンクを `assets/affiliates.js` に設定し、`affiliate: true` にする
   - ボタンと見出しに「PR」表記が自動で付き、フッターにアフィリエイトの説明文が出ます（ステマ規制への対応）
   - 使い方はファイル冒頭のコメントに書いてあります
4. `url` が空のボタン（ツアー・eSIM・保険）は表示されません。提携できたら URL を入れると表示されます

### Google AdSense
1. ある程度アクセスと記事が増えてから申請する
2. 審査用のコードを `templates/page.html` の `<head>` 内のコメントの場所に貼り、`build.ps1` を実行する
3. 合格後、広告ユニットを置きたい場所に貼る

### アクセス解析
Google Analytics のタグも `templates/page.html` の `<head>` 内に貼ります。

## 定期的にやること

- **料金の見直し**：`assets/data.js` の相場（`base` が航空券、`ht` が宿など）を、比較サイトの実際の料金と見比べて調整する
- **入国条件の確認**：ビザ・ETA・ESTAなどの情報は変わりやすいので、外務省や大使館のサイトで確認して `assets/entry.js` にルールを追加する（書き方はファイル冒頭のコメント参照）。施行日が先の変更も、発表された時点で追加しておけば当日から自動で切り替わる
- **更新日**：見直したら `site.json` の `updated` と `updatedJa` を書き換えて `build.ps1` を実行する

## 注意

- Skyscanner・Booking.com・Instagramなどのロゴは使わないでください（商標のため）。名前を文章で書くのは問題ありません。
- 背景のイラストは独自に描いたものです。実在のロゴや写真に差し替える場合は、権利を確認してください。
- アフィリエイトの収入が一定額を超えると確定申告が必要になる場合があります。親の扶養に入っている場合は扶養の条件にも影響することがあるので、収入が出始めたら確認してください。
