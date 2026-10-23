# WPGP Tools for Japanese 初期設定ガイド

WPGP Tools for Japanese (YamabikoLab) を Chrome にインストールし、WordPress の日本語翻訳チェックを利用するためのガイドです。

初めて利用する方は、以下の手順に沿って設定してください。

## 1. WPGP Tools for Japanese について

WPGP Tools for Japanese (YamabikoLab) は、WordPress.org の翻訳プラットフォーム（GlotPress）で、日本語翻訳の品質チェックやレビュー作業を支援する Chrome 拡張機能です。

主な機能は以下のとおりです。

- WordPress 日本語翻訳スタイルガイドに基づくチェック
- 保存せずに任意のタイミングで実行できる個別翻訳の Check
- 翻訳セット全体の Warning チェック
- Current / Waiting の翻訳者別チェック
- 同じ原文に対する複数 Waiting 翻訳案の比較
- 翻訳の一貫性チェック
- 翻訳履歴の確認

## 2. インストール方法

### Chrome ウェブストアからインストール

以下のページにアクセスしてください。

**[WPGP Tools for Japanese (YamabikoLab) - Chrome ウェブストア](https://chromewebstore.google.com/detail/wpgp-tools-for-japanese-y/ilclhahfffhabdbeadpapfdmghgkejml)**

1. **Chrome に追加** をクリックします。
2. 確認ダイアログが表示されたら、内容を確認して **拡張機能を追加** をクリックします。
3. インストールが完了したら、WordPress.org の翻訳ページを開きます。

動作対象：

https://translate.wordpress.org/

> [!IMPORTANT]
> **オリジナル版の WPGP Tools を使用している場合は、先に無効化してください。**
>
> オリジナル版と YamabikoLab 版を同時に有効にすると、チェック処理や画面表示が重複する可能性があります。

---

## 3. 日本語翻訳向けの初期設定

日本語翻訳チェックを適切に利用するため、以下の設定を確認してください。

### STEP 1：WPGPT Settings を開く

1. [WordPress.org の日本語翻訳ページ](https://translate.wordpress.org/locale/ja/default/)を開きます。
2. プラグインやテーマなどの翻訳セットのページに移動します。
3. ページ上部のメニューから **WPGPT Settings** をクリックします。

### STEP 2：日本語の句点を設定する

設定画面の **Locale specific checks** セクションを探します。

次の項目に、日本語の句点を設定してください。

**My locale uses this custom period symbol:**

設定値：`。`

> [!IMPORTANT]
> 全角句点 `。` を1文字だけ入力してください。
>
> 半角ピリオド `.` や全角ピリオド `．` ではありません。

この設定により、日本語の句点を使用する翻訳に対して、不要なピリオド関連の Warning が表示されるのを防ぎます。

### STEP 3：Japanese checks を有効にする

同じ **Locale specific checks** セクションにある、次の項目を確認します。

**Japanese checks：Yes**

`No` になっている場合は、`Yes` に変更してください。

日本語チェックを有効にすると、WordPress 日本語翻訳スタイルガイドに基づくチェックが利用できます。

### 設定画面

以下の画像を参考にしてください。

![日本語翻訳チェックの初期設定](https://github.com/user-attachments/assets/46209da4-d3f9-4dc3-a845-db7fdb08dfc8)

設定する項目は次の2つです。

| 設定項目 | 設定値 |
| --- | --- |
| My locale uses this custom period symbol: | `。` |
| Japanese checks | `Yes` |

### STEP 4：設定を保存する

1. 設定画面の **Save all settings** をクリックします。
2. 翻訳ページを再読み込みします。
3. 再び設定画面を開き、設定が反映されていることを確認してください。

これで日本語翻訳向けの初期設定は完了です。

---

## 4. 日本語翻訳チェックの使い方

日本語チェックを有効にすると、翻訳の編集時に、設定されたルールに従って表記上の問題を検出します。

主なチェック対象：

- 日本語の句読点
- 全角・半角文字の使い分け
- コロン前後の空白
- 丸括弧前後の空白
- かぎ括弧の扱い
- その他、日本語翻訳の表記ルール

問題が検出された場合は、設定に応じて Warning などが表示されます。

詳しい表記ルールについては、[WordPress 日本語翻訳スタイルガイド](https://ja.wordpress.org/team/handbook/translation/translation-style-guide/)をご確認ください。

### 保存せずにチェックする（Check ボタン）

翻訳の個別編集画面には、**Save の左側に Check ボタン**があります。入力した訳文を保存せずに確認したいときに使用してください。

1. 翻訳を選択して個別編集画面を開きます。
2. **Check** をクリックします。訳文を変更していなくても実行できます。
3. 編集画面の **Warnings / Notices** に表示された結果を確認します。
4. 訳文を変更した場合は、再度 **Check** をクリックして結果を更新します。

Check は現在の入力内容に対して、既存の一般チェックと日本語翻訳チェックを実行します。単数形・複数形の入力欄がある場合は両方を確認します。チェック後にどちらか一方でも訳文を変更すると、以前の結果が古くなったことを知らせます。指摘がない場合も同様です。

> [!NOTE]
> **Check では翻訳の保存・承認・却下は行われず、保存済みの翻訳や一覧の Warning 表示も変更されません。** 保存する場合は従来どおり Save を使用してください。
>
> Check には専用の設定はありません。一般チェック・日本語チェックは **WPGPT Settings** の既存の有効・無効および Warning / Notice 設定に従います。日本語チェックを利用するには、上記の **Japanese checks：Yes** を設定してください。

<img width="1870" height="690" alt="check" src="https://github.com/user-attachments/assets/d4219154-6cd8-4001-aca0-df2249c17a98" />

## 5. 全件 Warning チェック

WPGP Tools には、翻訳セット全体を対象として Warning をまとめて確認する機能があります。

通常の翻訳画面では、表示されている翻訳を個別に確認しますが、全件 Warning チェックでは、取得した翻訳データをまとめて検査できます。

### 主な機能

- Warning がある翻訳を一覧表示
- 日本語チェックのルールごとに絞り込み
- 原文・訳文・Context による文字列検索
- Warning 箇所のハイライト
- 検出結果のページネーション
- 個別の Warning や絞り込み結果を Slack 向けにコピー

### Current / Waiting の選択

v2.4.0 では、スキャン対象を次の条件で指定できます。

| 項目 | 説明 |
| --- | --- |
| Current | 現在採用されている翻訳 |
| Waiting | 承認待ちの翻訳 |
| すべての翻訳者 | 翻訳者を指定せずに検索 |
| 特定の翻訳者 | 指定した翻訳者の翻訳を検索 |

Current と Waiting のどちらでも、翻訳者を指定できます。

ほかの翻訳者が採用された翻訳でどのような表現を使っているか確認する際にも役立ちます。

翻訳者は Translation Contributors から候補を取得して選択できます。一覧にない場合は、WordPress.org のログイン名を直接入力することもできます。

### 全件 Warning チェックの画面

![全件 Warning チェックの実行画面](https://github.com/user-attachments/assets/4f95f070-f866-462f-981a-68ef1ddff31b)

### Warning 一覧の表示例

![全件 Warning チェック結果](https://github.com/user-attachments/assets/3a3aa1a3-6d3d-4f01-b03c-7720141c026b)

> [!NOTE]
> 全件 Warning チェックは、GlotPress の PO Export から取得した翻訳を対象とします。
>
> 同じ原文・Context に複数の Waiting 翻訳がある場合、PO Export にすべての翻訳案が含まれるとは限りません。

---

## 6. 複数の Waiting 翻訳案を比較する

### 複数 Waiting を検索する

翻訳セットのページにある **「複数 Waiting を検索」** をクリックすると、すべての翻訳者の Waiting を調べ、同じ原文に異なる翻訳 ID の提案が2件以上あるものを一覧表示します。**「Warning ありのみ」** で絞り込むこともできます。各原文の **「個別比較」** をクリックすると、対象の提案を再取得して比較用の別タブに表示します。

検索は1秒以上の間隔で順番に取得し、**最大50ページ**（終了確認用の空ページも含む）で停止します。上限や中止、通信エラーで終わった場合は「途中結果」であり、「複数 Waiting: 0 原文」と表示されても、まだ取得していないページに複数提案が残っている可能性があります。

<img width="1864" height="844" alt="複数Waiting検索画面と結果一覧" src="https://github.com/user-attachments/assets/98c08703-8ee7-4e52-bfee-53f1ef1a8bbb" />

#### 大きな翻訳セットを検索するときの件数設定

GlotPress は初期設定では通常 **1ページ15件**です。最大50ページの場合、15件設定では約750件までしか調べられません。対象が見つからない場合は、必要に応じて **1ページ100件や200件**に変更すると、同じページ上限でもより多くの提案を調べられます。

1. WordPress.org にログインして、[GlotPress のユーザー設定](https://translate.wordpress.org/settings/)を開きます。
2. **Number of items per page:** を探し、必要に応じて `100` または `200` を入力します。
3. **Save Settings** をクリックして保存します。
4. 翻訳セットのページへ戻り、改めて **「複数 Waiting を検索」** を実行します。

<img width="916" height="125" alt="image" src="https://github.com/user-attachments/assets/21a1abde-4a84-4255-91f9-fbf4000b44fb" />

| 1ページの設定 | 最大50ページで取得できるレコード数の目安 |
| --- | ---: |
| 15件（初期値） | 約750件 |
| 100件 | 約5,000件 |
| 200件 | 約10,000件 |

> [!IMPORTANT]
> この設定は **WPGP Tools の設定ではなく、GlotPress 側のユーザー設定**です。通常の GlotPress 翻訳一覧の表示件数にも影響します。拡張機能が自動的に変更することはありません。
>
> 100件・200件は利用例であり、すべての環境で取得件数や動作を保証する値ではありません。件数を増やすと1回の応答量と処理負荷も増えるため、必要な場合だけ変更してください。50ページ上限・中止・429/403での即停止は変わりません。
>
> 検索中に提案が変更された場合や同じ追加日時の提案がある場合、空ページまで確認できても網羅性は保証されません。個別比較でも API の取得制約に注意してください。

### 従来の全件 Warning チェックから比較する

GlotPress では、**ひとつの原文に対して複数の Waiting（承認待ち）翻訳が存在する**場合があります。

WPGP Tools v2.4.0 では、これらの翻訳案を個別に確認できるようになりました。

### 比較方法

1. 全件 Warning チェックで **Waiting** を選択します。
2. 必要に応じて翻訳者を指定します。
3. スキャンを実行します。
4. 対象となる翻訳の **複数の翻訳提案を確認** をクリックします。
5. 新しいタブに翻訳提案の比較画面が表示されます。

Warning がない翻訳も対象にする場合は、Waiting スキャンで **Warning がない翻訳も表示する** を選択してください。

### 比較できる情報

- 原文
- 各翻訳者の訳文
- 翻訳者の WordPress.org ログイン名
- 翻訳 ID
- Warning / Notice
- GlotPress の確認用リンク

### 複数 Waiting の比較画面

![複数の Waiting 翻訳提案の比較画面](https://github.com/user-attachments/assets/2ec46201-b224-4047-a35d-cdc7baca3af5)

複数の提案を並べて確認することで、訳し方の違いや Warning の有無を比較できます。

> [!NOTE]
> この比較画面は読み取り専用です。翻訳の変更や承認は行いません。
>
> また、GlotPress API のページネーション等の制約により、すべての提案が取得されることまでは保証していません。

---

## 7. 設定の保存について

WPGP Tools の設定は、ブラウザーのローカルストレージに保存されます。

通常、同じブラウザープロファイルでは保存した設定を引き続き利用できます。

ただし、以下の場合は設定を再確認してください。

- 別のパソコンで使用する場合
- 別のブラウザーや Chrome プロファイルで使用する場合
- ブラウザーのサイトデータを削除した場合
- 拡張機能を再インストールした場合

設定がリセットされた場合は、本ガイドの「3. 日本語翻訳向けの初期設定」を参照してください。

## 8. よくある質問

### Q. WPGPT Settings が表示されません

以下を確認してください。

- Chrome で拡張機能が有効になっているか
- `translate.wordpress.org` の翻訳セットのページを開いているか
- 拡張機能のサイトアクセスが許可されているか
- ページを再読み込みしたか

### Q. 日本語の Warning が表示されません

以下を確認してください。

- Japanese checks が Yes になっているか
- 個別のチェックルールが有効になっているか
- 設定を保存しているか
- ページを再読み込みしたか

### Q. 句点に関する不要な Warning が表示されます

**My locale uses this custom period symbol:** に全角句点 `。` が設定されているか確認してください。

### Q. 全件 Warning チェックで翻訳が表示されません

以下を確認してください。

- Current / Waiting の選択が正しいか
- 指定した翻訳者に該当する翻訳が存在するか
- Warning のない翻訳を除外する設定になっていないか
- 検索文字列やルール別フィルターで絞り込まれていないか

### Q. オリジナル版の WPGP Tools と併用できますか？

併用は推奨していません。

両方を有効にすると、チェック処理や画面表示が重複する可能性があります。

YamabikoLab 版を利用する場合は、オリジナル版を無効化してください。

### Q. 更新は自動的に行われますか？

Chrome ウェブストアからインストールした拡張機能は、通常、Chrome によって自動更新されます。

---

## 9. 関連リンク

- [Chrome ウェブストア](https://chromewebstore.google.com/detail/wpgp-tools-for-japanese-y/ilclhahfffhabdbeadpapfdmghgkejml)
- [GitHub リポジトリ](https://github.com/YamabikoLab/wpgp-tools)
- [GitHub Releases](https://github.com/YamabikoLab/wpgp-tools/releases)
- [不具合報告・機能要望](https://github.com/YamabikoLab/wpgp-tools/issues)
- [WordPress 日本語翻訳スタイルガイド](https://ja.wordpress.org/team/handbook/translation/translation-style-guide/)

---

## ライセンスとプロジェクトについて

WPGP Tools for Japanese は、オリジナルの WPGP Tools を基に YamabikoLab が独自に開発・保守している派生版です。

WordPress.org や WordPress 日本語翻訳チームによる公式配布版ではありません。

ライセンス：GPL-3.0

オリジナルプロジェクト：
https://github.com/vlad-timotei/wpgp-tools
