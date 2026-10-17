# Issue #31: 複数 Waiting 提案取得 PoC

この検証は、**本実装の前に取得経路・権限・既存 Warning 判定の再利用可能性を確かめる**ためのものです。製品コード・manifest・翻訳データは変更しません。

## 実ブラウザーでの実行

1. Chrome の WPGP Tools 拡張機能を有効にし、WordPress.org の日本語翻訳セットを開いてください。既存の全件 Warning UI が利用できる状態で確認します。
2. Chrome DevTools の **Sources → Snippets** で新しいスニペットを作り、[`waiting-proposals-poc.js`](./waiting-proposals-poc.js) の内容をすべて貼り付けて実行します。**Console へ外部 URL から読み込む操作は不要**です。
3. 画面上部の PoC 領域に原文 ID `22606895` が初期入力されます。対象の翻訳セットが **Echo Knowledge Base / Stable / ja / default** であることを確認してください。異なる翻訳セットでは別の ID を指定してください。
4. 必要なら翻訳者ログイン名を指定し、**「1回だけ取得・検証する」**を押します。押すまで通信は発生しません。
5. 取得結果の翻訳 ID、件数、原文・Context、既存 Warning/Notice の件数と理由を確認し、GlotPress 画面の Waiting 結果と比較してください。
6. 「検証画面を閉じる」で領域を削除できます。再実行する場合はスニペットをもう一度実行してください。

## 確認する項目

- 指定原文では翻訳 ID `137070872` と `141335806` が個別に取得されるか（データは変更される場合があります）。
- 未ログイン・権限不足・HTTP 403/429・HTML 応答で失敗と表示されるか。**429 を意図的に発生させる必要はありません**。
- 応答が配列か、`original_id` / `translation_status` / `id` / `translations` / `singular` / `plural` / `context` / `user.user_login` が取得できるか。
- 現在の翻訳画面の設定で `wpgpt_run_checks()` を実行でき、既存スキャンの Warning/Notice と結果が一致するか。
- GlotPress 側にページングがあれば、API の件数と全件数の関係。**PoC 自体は1回の GET で止め、次ページの自動取得はしません**。
- PO Export には原文 ID が載らないため、既存 Warning 行と原文 ID を一意に対応付けられるかは**この PoC の検証対象外・未解決**です。

## 制約と安全性

- `translate.wordpress.org` の日本語翻訳セットでのみ実行できます。画面と同一オリジンの `/api/projects/...` へ認証付きの **GET をボタン操作ごとに1回だけ**送ります。書き込み・自動再試行・複数原文の一括取得はありません。
- API フィルターには原文 ID と Waiting ステータス、指定時にはログイン名が含まれます。ブラウザーの通信ログには表示されますが、画面 URL や永続ストレージへ保存しません。
- API が使えること、同じ設定で判定できること、複数の翻訳 ID が取得できることは**実ブラウザー検証まで未確定**です。API 実装の違いを推測で補うフォールバックは設けません。
- Chrome 拡張機能の内部タブは別の実行環境なので、**同じ判定が内部タブでも使えるかは本 PoC では証明されません**。実装前に共通境界の必要性を判断します。
- 取得件数は「全 Waiting の確認済み件数」ではありません。原文の一意解決も含め、本実装可否は検証結果を Issue #31 に記録して判断します。

## 技術上の判断材料

GlotPress の上流実装では、`GP_Route_Translation::translations_get()` が `filters` を `for_translation()` へ渡し、`/api/` 経路のテンプレートが翻訳配列を JSON 化します。WordPress.org の環境が同じルーティング・認証・応答形式かは実ブラウザーで確かめてください。

## 次の PoC: 原文 ID の解決と専用タブの判定再利用

### A. 原文 ID の自動解決

1. 前述と同じ日本語翻訳セット画面で、Chrome DevTools の Snippets に [`original-id-resolution-poc.js`](./original-id-resolution-poc.js) を貼り付けて実行してください。
2. 原文 `%1$s trend of article views over the last %2$s` が入力された状態で、Context は空欄のまま「原文を1回だけ検索」を押してください。
3. **「API 応答件数」「原文完全一致件数」「候補の原文 ID / 判定保留の理由」**を記録してください。

この PoC は原文テキストに対する `filters[term]` / `filters[term_scope]=scope_originals` / `filters[status]=waiting` の GET を1回送信します。訳文の変更、連続巡回、ページングはしません。Context が応答にない場合は、**他の Context を取り違える危険があるため原文 ID を確定しません**。一意の候補が表示されても、ページングによる候補漏れは未確認です。完了判定ではなく、採用可能性の調査です。

### B. Chrome 拡張機能の専用タブで既存判定を実行

1. [`src/`](../../src) を Chrome の `chrome://extensions` から「パッケージ化されていない拡張機能を読み込む」で開いてください。**PR #32 のブランチを取得した作業コピー**を使用します（通常の公開版だけではこの検証画面はありません）。現在の設定を変更したくない場合は検証用 Chrome プロファイルで実行してください。
2. 拡張機能の詳細から「ID」を確認し、Chrome のアドレスバーに `chrome-extension://<拡張機能ID>/wpgpt-waiting-proposals-poc.html` を入力して開いてください。拡張機能の詳細内の設定ページ URL を参考に ID をコピーできます。
3. 同じ設定で比較したい場合、翻訳ページの DevTools Console で次の式を**自分で実行**して設定をコピーしてください（ログイン情報・訳文は含みませんが、設定文字列に個人的な単語を指定している場合は取り扱いに注意してください）。

   ```js
   copy(JSON.stringify(Object.fromEntries(
     Object.entries(wpgpt_settings)
       .filter(([, setting]) => Object.hasOwn(setting, 'state'))
       .map(([key, setting]) => [key, setting.state])
   )))
   ```

4. 専用タブの「設定（JSON）」欄に貼り付けてください。原文と訳文は前回の Waiting 提案（1件目）が初期入力されています。「このタブで既存判定を実行」を押します。
5. `Warning 1件 / Notice 0件` と、前回の `Possible broken: %s instead of %1$s,%s instead of %2$s` が再現されるか確認してください。別の日本語ルールに該当する文章でも比較できます。**設定やテスト文を変更して再検証する場合は再読み込みしてください。**

専用タブでは、判定コードを設定反映後に読み込みます。これは `custom_period` などが読み込み時に確定するためです。拡張機能側は別のオリジンなので、**利用者設定は自動同期しません**。コピー・貼り付けは PoC 限定の手作業であり、本実装時は保存領域と受け渡し方法を再設計します。日本語判定のためロケールを明示的に日本語として扱います。

**制限:** この専用タブ PoC には GlotPress API への通信、実データ受け渡し、原文 ID の解決、結果の永続保存はありません。既存判定の再利用だけを独立に検証します。翻訳の保存・承認操作はありません。
