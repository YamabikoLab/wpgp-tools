
# WPGP Tools for Japanese - YamabikoLab

[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

This repository is a **YamabikoLab-maintained fork of [WPGP Tools](https://github.com/vlad-timotei/wpgp-tools)**, extended for Japanese WordPress translation work on translate.wordpress.org.

It is not the official upstream distribution. Japanese-specific checks and YamabikoLab changes should be reported to this repository.

<img align="right" src="https://user-images.githubusercontent.com/65488419/124776835-6defbf00-df48-11eb-9594-c538fe220dbd.png">

Adjust the **Settings** for this extension in the top blue navigation menu *Tools Settings*

## #1 Consistency Tools 
[Watch a demo video for Consistency Tool features.](https://youtu.be/k6oAFmBvIig)

<img align="right" src="https://user-images.githubusercontent.com/65488419/117620318-11a33580-b179-11eb-9968-f1148d58686c.png">

**Quick links**: copy URL or open in new tab
- Permalink
- History
- Consistency

<img align="right" src="https://user-images.githubusercontent.com/65488419/136012481-2c578ceb-8eaa-461a-9240-1ae84f54ef35.png">

**Search** a string in:
- current project, current locale
- WordPress development project, current locale
- consistency tool, current locale
- multiple plugin slugs separated by &nbsp; ` `

<br>
<img align="right" src="https://user-images.githubusercontent.com/65488419/136034004-c4cc7d52-36c3-4123-81f8-622eb5833540.png">


**Suggestions** directly from Consistency
 - Auto loads on editor opening or `Alt + C` to load them all.
 - Translation Memory sometimes has bad translations (see [#meta5340](https://meta.trac.wordpress.org/ticket/5340))
 - This shows Consistency translations directly in the editor panel
 - Button or Alt + the number of the suggestion to replace it in the textarea
 - Also displays plural forms and highlights spaces
 - ` ⟵` next to the current translation of the string if available

**GoogleTranslate** button - Link or Alt + G to open in a new tab current translated string in current locale, if locale exists on GT. ([missing locales in GT](https://gist.github.com/vlad-timotei/3f558547ac2bc0f3120f869fba7d8bec))

**Non-translatable** strings
- Highlight non-translatable strings in original
- Click on any non-translatable item in original
- Display real time usage of non-translatable strings
- Insert individual or Copy all 

![image](https://user-images.githubusercontent.com/65488419/131497503-b4809e96-dbb3-4203-b19a-de48dd2b6921.png)

## #2 General Checks 
[Watch a demo video for Checks feature.](https://youtu.be/R4M_TBSRWSE)

These checks run for all translated strings when page loads and when a translation is submitted. <br> Checks can be set as: Warning & prevent save, Just notification or Don't check.


**Notices and labels** for checks results

![image](https://user-images.githubusercontent.com/65488419/125183339-84369d00-e21e-11eb-9d29-e78be7fe508e.png)

**Highlights** double spaces and user defined "bad words" *(eg. below: link)*

![image](https://user-images.githubusercontent.com/65488419/125183284-f8bd0c00-e21d-11eb-9e80-f9608f8eaab5.png) <br>

<img align="right" width="550" src="https://user-images.githubusercontent.com/65488419/117626608-f4be3080-b17f-11eb-91a7-fefd621df320.png" >

<br>

<br>

<br>

<br>

<br>

To bypass warnings, click <br> Save / Approve with warnings

<br>

<br>


Personalize checks as you see fit:

![image](https://user-images.githubusercontent.com/65488419/141654544-7ad1ea41-1dba-4338-b724-41becdcbef75.png)

**Prevent saving these words** is a user defined list of words that if found in a translation will generate a warning. Separated by comma, no space, case insensitive. 

TIP: Include a double space string  ` ` ` `  in this field to **always** prevent the saving of double spaces. 

**Count and match these** is a user defined list of terms or symbols that will be counted both in original and in translation. If counts don't match, a warning will be generated. Separated by comma, no space, case insensitive.

**Tag spaces** checks will ensure that:
- there are no missing spaces before or after the tag pair. Wrong example: `This is<strong>bold</strong>and nice.`
- there are no additional spaces inside the tag pair. Wrong example: `This is <strong> bold </strong> and nice.`

Filter strings based on warnings: <br>
![image](https://user-images.githubusercontent.com/65488419/121800720-26715e00-cc3c-11eb-8b29-6e63f5db5b13.png)<br>

## #3 Locale specific Checks

If your locale uses a different symbol other than `.` for period, you can set it here. Additional specific locale checks can be added if requested in an issue.

![image](https://user-images.githubusercontent.com/65488419/119268770-1a761b80-bbfd-11eb-96ed-037e1c54ba1d.png)

## #4 History Tools
[Watch a demo video for History Tools feature.](https://youtu.be/ZKfqKD-ZIYE)

These are **opt-in** tools, so go to Settings > History Tools and enable them if you want to use them. 

<image align="right" src="https://user-images.githubusercontent.com/65488419/124787689-5c5ee500-df51-11eb-97d6-8f89b5fca581.png">
<br>

<br>

**I. History Compare** compares the string with a corresponding string from History

<br>

| String status | Compared with |
| --- | --- |
| Old | Current |
| Rejected | Current |
| Waiting | Current |
| Fuzzy | Waiting |

 <br>
 

 <br>

It adds preview and editor label and a diff highlighter in editor.
 
 <br>

 <br>

 <br>
 
 <img align="right" src="https://user-images.githubusercontent.com/65488419/124783181-8c0bee00-df4d-11eb-88d7-9ad0598f4455.png">
 <br>

 <br>
 
**II. History Count** counts (regardless of string status) types of strings in History for the respective string; doesn't count itself. It also checks if there are multiple current translations for the same string and will show a visual status of this check: ❌ or ✔️.
 
**III. History Tools in Translation History** enables or disables these tools on History pages opened trough a link.
 
 <br>
 
## #5 Bulk Consistency Tools for GTEs
[Watch a demo video for Bulk Consistency Tools feature.](https://youtu.be/kvUgUkQUfm0)

This is an **opt-in** only for GTEs tool. Even if you activate it, it only fully works for GTEs.
- Replace strings in bulk
- Reject strings in bulk
- Limited to 25 strings per action

![image](https://user-images.githubusercontent.com/65488419/131462782-b46f1e2c-5e4f-41e1-aab4-614b3c2cbe0b.png)

 
## #6 Custom Keyboard Shortcuts

| Action | Shortcut | Alternative Shortcut for Mac |
| --- | --- | --- |
| **F**uzzy | Ctrl + \* (numeric keyboard) <br/> Control + Shift + **F**  | 
| **S**ave with warnings | **S**hift + Ctrl + Enter |
 | Load all **C**onsistency suggestions | Alt + **C** | control + **C** |
| Copy consistency #**3** | Alt + **3** | control + **3** |
| **G**oogle Translate | Alt + **G** | control + **G** |
| Focus on **S**earch in **P**rojects  |   Alt + **S** or Alt + **P** |  control + **S** or control + **P** |
| Insert all **N**on-translatables | Alt + **N** | control + **N** | 

Note: Disable custom keyboard shortcuts if you use keyboard `Alt + numbers` to insert special characters. WPGPT overrides that shortcut.

## #7 Other features
- Keeps the editor in the middle of the screen when Page Up/Page Down shortcuts are used
- *Added* and *Last modified* in browser's local date format and time zone. This works correctly if the device language and time are set to your country language and timezone.
- Prompts for unsaved strings
- Adds an Anonymous author checkbox for user filter
- Consistency Bulk replacement for GTEs (disabled by default)

![anonymous_user](https://user-images.githubusercontent.com/65488419/127504757-2547f47b-d8fb-47f7-b362-47eb6037597b.gif)



## All-page Warning scan: status × translator (YamabikoLab)

On the GlotPress translation list, select the translation **status** (Current or Waiting, default: Current) and **translator** (All translators or a specific login, default: All translators). Both controls are always visible. The previous **Current filters** and **Waiting by user** modes have been replaced. **Existing page filters, including search terms, are not inherited** by these scans.

The four supported scopes are Current × All translators, Current × specific translator, Waiting × All translators, and Waiting × specific translator. Each scan requests one GlotPress PO export using `format=po` and `filters[status]`, adding `filters[user_login]` only for a specified translator. The user login corresponds to the **translation proposer**, not the approver, last editor or historical author of a replaced translation. The control does not verify the selected user is the signed-in account.

Translator choices load automatically when the translator drop-down is first focused, **at most once per page view**. For plugin and theme translation sets, they are read from the locale's Translation Contributors page using exact GlotPress `filters[user_login]` links, never profile slugs or display names. The list is not necessarily complete for the selected translation set. If a contributor is absent, the lookup fails (including HTTP 429), or the project type is unsupported, choose **Enter login name manually**. No automatic retries occur and the name is not saved. Choosing a translator never starts a PO scan.

An empty result only means no matching translations were **exported** for the selected scope, not that a specific person has made no proposals. PO entries are keyed by original and context; multiple Waiting proposals sharing these may be omitted. **The completeness of multi-proposal Waiting exports remains unverified. Do not treat Waiting scans as a guarantee that all suggestions have been inspected.** There is no per-row pagination or background network crawl. The scan reports HTTP or malformed PO failures, and refuses to run with unsaved edits. Confirm the server-side filtering behavior, especially Current × specific translator, on a real GlotPress page before release.

## My suggestion label (YamabikoLab)

Waiting translations authored by the signed-in WordPress.org account receive a small **My suggestion** label in the translation list. The feature reads the existing matching GlotPress editor row's **Translated by** profile link and the account link in the WordPress admin-bar account menu. It does not add requests, change permissions, or mark other translators' suggestions. If either account cannot be identified from a WordPress.org profile URL, no label is shown. Verify availability of those links on your signed-in translation page; the feature intentionally avoids guessing.

## Installation

### Chrome

The YamabikoLab edition is intended to be distributed through an **Unlisted Chrome Web Store listing** so translators can install and update it without Developer Mode.

The Chrome Web Store distribution URL will be added here after the listing has completed review and is ready for distribution.

> [!IMPORTANT]
> If you already use the upstream WPGP Tools extension, disable it before enabling the YamabikoLab edition. Running both extensions at the same time is not supported because they operate on the same translate.wordpress.org pages and share page elements and LocalStorage keys.

### Development / testing

For development and review, use a GitHub Release ZIP or load the `src/` directory as an unpacked extension in Chrome.

To build the distributable ZIP locally:

```sh
./scripts/build-extension-zip.sh
```

The script reads the version from `src/manifest.json` and creates `dist/wpgp-tools-<version>.zip`. The ZIP contains the **contents of `src/`**, so `manifest.json` is at the archive root.

For releases, keep these versions identical:

- `src/manifest.json` `version`
- `src/js/wpgpt-settings.js` `WPGPT_VERSION`
- Git tag
- GitHub Release
- Distribution ZIP filename

Firefox Add-ons remains an upstream distribution channel and is not provided for this YamabikoLab edition.

## GlotDict compatibility
 WPGPT asumes by default that you use GlotDict as well and so it disables features that have been imported in GlotDict. If you don't use GlotDict, change this behaviour in Tools Settings. But take a look first at what GlotDict has for you! :) 

## Backup & Restore Settings

 <img align="right" src="https://user-images.githubusercontent.com/65488419/127963637-fde72b20-c931-43db-a187-3c3aa9a08044.gif">

Your settings are saved **locally** using LocalStorage so they will remain saved in that browser untill you clear your browser data.
To backup and restore WPGPT settings:

 - Go to Settings.
 - Drag and drop **Backup WPGPT Settings** to your Bookmarks bar.
 - Restore your settings by clicking that bookmark.
 
## Known issues
- Tooltips overlap for the Quick Links section (should be fixed upstream)

## Future version features

- Personal translation notes & project status snippets
- ~~Personal glossary~~ (this is included in [WPTranslationFiller extension](https://github.com/vibgyj/WPTranslationFiller/) and [GlotDict](https://github.com/Mte90/GlotDict) and I don't plan to overlap features!)
- Gradually, some WPGPT features will be implemented in GlotDict, as part of a cross-project initiative. That said, WPGPT will continue to exist for those interested.
- When a feature will be included in GlotPress (the long term plan for as many features as possible) it will be excluded from this extension.


### [Changelog](/CHANGELOG.md)

### Documentation

See this README for the YamabikoLab edition.

### Upstream

- [Original WPGP Tools repository](https://github.com/vlad-timotei/wpgp-tools)
- [Original WPGP Tools documentation](https://github.com/vlad-timotei/wpgp-tools/wiki)

### Contributions
Contributions are welcome, bugreports, suggestions and even pull requests! No limitations, shoot for the stars!

## Waiting 提案の個別比較（YamabikoLab 版）

翻訳セットで全件 Warning チェックの対象を **Waiting** にして走査すると、Warning が検出された原文に「複数の翻訳提案を確認」ボタンが表示されます。「Warning がない翻訳も表示する」にチェックを入れると、PO に含まれる Warning 0件の訳文も原文・訳文・Context で検索でき、同じ比較ボタンから確認できます。チェックは既定でオフ、Current では利用できません。Warning 件数と影響する文字列数は従来のままです。クリックすると同じ原文 ID の Waiting 提案を翻訳 ID ごとに専用タブで読み取り専用表示し、既存の Warning 判定と日本語ルールで確認できます。比較タブは全件 Warning 結果のカード生成処理と CSS を共有し、原文・訳文の2列配置、日本語ルール番号、問題箇所の強調表示、指摘のコピー操作を共通化しています。「GlotPressで確認」は各提案の翻訳 ID に絞り込んだリンクで、「翻訳スタイルガイド」も元画面と同じ位置に表示します。比較タブで不要な「複数の翻訳提案を確認」ボタンだけは繰り返し表示しません。翻訳や承認状態は変更しません。

- API 通信はボタン操作時のみです。原文 ID の検索が必要な場合は最大1回、Waiting の取得に最大1回の GET を行い、再試行・全件巡回は行いません。
- PO に原文 ID がない場合、現在の翻訳一覧に同じ原文・Context の行が確認できるときだけ原文 ID を使用します。API 検索結果だけでは全候補の取得を保証できない場合、**誤表示防止のため確認を中止**します。
- 専用タブに表示される件数は API 応答に含まれる提案の件数です。**Waiting 全件の網羅を意味しません**。既存の PO 走査結果にも合算しません。
- 設定は元の翻訳画面から一時的に渡され、URL や永続ストレージには保存されません。再読み込み後は元の画面から再度開いてください。
