'use strict';

const assert = require( 'node:assert/strict' );
const { describe, test } = require( 'node:test' );

const { loadWpgptChecks } = require( './helpers/load-wpgpt-checks' );

const checks = loadWpgptChecks();

const JAPANESE_RULE_SETTINGS = [
	'ja_punctuation',
	'ja_half_width',
	'ja_half_full_spacing',
	'ja_parentheses',
	'ja_inner_parentheses_spacing',
	'ja_period_inside_parentheses',
	'ja_sentence_ending_parentheses',
	'ja_number_spacing',
	'ja_view_expression',
	'ja_not_allowed_expression',
	'ja_sorry_prefix',
	'ja_recommended_expressions',
	'ja_middle_dot',
];

function runRule( setting, singularOriginal, translated, severity = 'warning' ) {
	const settingOverrides = Object.fromEntries(
		JAPANESE_RULE_SETTINGS.map( ( key ) => [ key, 'nothing' ] )
	);
	settingOverrides[ setting ] = severity;

	return checks.runJapaneseChecks(
		singularOriginal,
		translated,
		settingOverrides
	);
}

function assertWarning( results, expectedMessage ) {
	assert.ok( results.warning.includes( expectedMessage ) );
}

function assertNotice( results, expectedMessage ) {
	assert.ok( results.notice.includes( expectedMessage ) );
}

function assertClean( results ) {
	assert.deepEqual( results.warning, [] );
	assert.deepEqual( results.notice, [] );
	assert.deepEqual( results.highlight_me, [] );
}

describe( 'Japanese v1 rule 1-1', () => {
	/**
	 * 日本語の句読点として明確に不適切な代替文字を検出することを確認する。
	 *
	 * 操作:
	 * - 全角カンマを含む日本語翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-1 の警告と対応する表示メッセージが返る。
	 */
	test( 'when Japanese punctuation uses an unambiguous alternative character, should report rule 1-1', () => {
		const results = runRule( 'ja_punctuation', 'Message', '設定，保存' );

		assertWarning(
			results,
			'1-1 日本語の句読点: 日本語の句読点は「、」「。」を使用してください'
		);
		assert.deepEqual( results.highlight_me, [ '，' ] );
	} );

	/**
	 * 数値内の全角句読点を日本語本文の句読点として扱わないことを確認する。
	 *
	 * 操作:
	 * - 数字に挟まれた全角ピリオドと全角カンマを確認する。
	 *
	 * 期待結果:
	 * - 1-1 の指摘は返らない。
	 */
	test( 'when full-width punctuation is part of a number, should not report rule 1-1', () => {
		assertClean( runRule( 'ja_punctuation', 'Version', '1．2 と 1，000' ) );
	} );

	/**
	 * URL やメールアドレス内部の句読点記号を日本語本文の句読点として扱わないことを確認する。
	 *
	 * 操作:
	 * - URL とメールアドレスを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-1 の指摘は返らない。
	 */
	test( 'when punctuation appears inside a URL or email address, should not treat it as Japanese punctuation', () => {
		assertClean(
			runRule(
				'ja_punctuation',
				'Contact',
				'https://example.com または user@example.com を確認'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 1-2', () => {
	/**
	 * 半角表記すべき全角 ASCII 文字を検出することを確認する。
	 *
	 * 操作:
	 * - 全角英字を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-2 の警告と期待する半角文字が案内される。
	 */
	test( 'when full-width ASCII is used, should report rule 1-2 with the expected half-width character', () => {
		const results = runRule( 'ja_half_width', 'Name', '設定Ａ' );

		assertWarning(
			results,
			'1-2 英数字・記号の半角表記: 「Ａ」は半角の「A」で表記してください'
		);
		assert.deepEqual( results.highlight_me, [ 'Ａ' ] );
	} );

	/**
	 * 数値表記内の全角カンマ・ピリオドを半角表記へ直す指摘を返すことを確認する。
	 *
	 * 操作:
	 * - 数字に挟まれた全角ピリオドと全角カンマを確認する。
	 *
	 * 期待結果:
	 * - それぞれ対応する半角記号が案内される。
	 */
	test( 'when full-width punctuation is part of a number, should report rule 1-2', () => {
		const periodResults = runRule( 'ja_half_width', 'Version', '1．2' );
		const commaResults = runRule( 'ja_half_width', 'Number', '1，000' );

		assertWarning(
			periodResults,
			'1-2 英数字・記号の半角表記: 「．」は半角の「.」で表記してください'
		);
		assertWarning(
			commaResults,
			'1-2 英数字・記号の半角表記: 「，」は半角の「,」で表記してください'
		);
	} );

	/**
	 * 全角丸括弧は 1-5 の責務とし、1-2 では重複指摘しないことを確認する。
	 *
	 * 操作:
	 * - 全角丸括弧を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-2 の指摘は返らない。
	 */
	test( 'when full-width parentheses are checked by rule 1-2, should not report them as full-width ASCII', () => {
		assertClean( runRule( 'ja_half_width', 'Label', '設定（詳細）' ) );
	} );
} );

describe( 'Japanese v1 rule 1-4', () => {
	/**
	 * 半角英字と日本語が直接接する場合のスペース不足を検出することを確認する。
	 *
	 * 操作:
	 * - 半角英字と日本語の間にスペースがない翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の警告が返る。
	 */
	test( 'when half-width letters touch Japanese text, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'WordPress setting',
			'WordPress設定'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「s」と「設」の間に半角スペースを入れてください'
		);
	} );

	/**
	 * 半角英字と日本語の間に半角スペースが2個以上ある場合を検出することを確認する。
	 *
	 * 操作:
	 * - 半角スペースを2個含む境界を確認する。
	 *
	 * 期待結果:
	 * - 半角スペースを1つにする警告が返る。
	 */
	test( 'when multiple spaces separate half-width and Japanese text, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'WordPress setting',
			'WordPress  設定'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「s」と「設」の間の半角スペースは1つにしてください'
		);
	} );

	/**
	 * 全角スペースを通常の半角スペースとして扱わないことを確認する。
	 *
	 * 操作:
	 * - 半角英字と日本語の間に全角スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 半角スペース1つへの修正が案内される。
	 */
	test( 'when a full-width space separates half-width and Japanese text, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'WordPress setting',
			'WordPress　設定'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「s」と「設」の間の半角スペースは1つにしてください'
		);
	} );

	/**
	 * NBSP を通常の半角スペースとして扱わないことを確認する。
	 *
	 * 操作:
	 * - 半角英字と日本語の間に NBSP を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 半角スペース1つへの修正が案内される。
	 */
	test( 'when NBSP separates half-width and Japanese text, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'WordPress setting',
			'WordPress\u00a0設定'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「s」と「設」の間の半角スペースは1つにしてください'
		);
	} );

	/**
	 * 半角英字と日本語の間に半角スペース1つがある正常系を確認する。
	 *
	 * 操作:
	 * - 正しい境界スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘は返らない。
	 */
	test( 'when one space separates half-width and Japanese text, should not report rule 1-4', () => {
		assertClean(
			runRule(
				'ja_half_full_spacing',
				'WordPress setting',
				'WordPress 設定'
			)
		);
	} );

	/**
	 * 文字列プレースホルダーと日本語の境界を 1-4 として断定しないことを確認する。
	 *
	 * 操作:
	 * - %s が日本語へ直接接する翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘は返らない。
	 */
	test( 'when a string placeholder touches Japanese text, should not infer rule 1-4 spacing', () => {
		assertClean( runRule( 'ja_half_full_spacing', '%s items', '%s件' ) );
	} );

	/**
	 * 名前付き文字列プレースホルダーを本文の半角文字として誤検出しないことを確認する。
	 *
	 * 操作:
	 * - 名前付きプレースホルダーが日本語へ接する翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘は返らない。
	 */
	test( 'when a named string placeholder touches Japanese text, should not infer rule 1-4 spacing', () => {
		assertClean(
			runRule(
				'ja_half_full_spacing',
				'Field',
				'%(field)sの範囲'
			)
		);
	} );

	/**
	 * テンプレートマークアップの区切り記号を本文文字として扱わないことを確認する。
	 *
	 * 操作:
	 * - テンプレートマークアップが日本語へ接する翻訳を確認する。
	 *
	 * 期待結果:
	 * - マークアップ境界を理由とする 1-4 の指摘は返らない。
	 */
	test( 'when template markup touches Japanese text, should not treat the markup delimiter as rule 1-4 text', () => {
		assertClean(
			runRule(
				'ja_half_full_spacing',
				'Link',
				'{{Link}}WooCommerce マーケットプレイス{{/Link}}にアクセス'
			)
		);
	} );

	/**
	 * コロン前後の個別スペース規則を確認する。
	 *
	 * 操作:
	 * - コロン前に不要スペースがあり、後ろに必要なスペースがない翻訳を確認する。
	 *
	 * 期待結果:
	 * - 前後それぞれの 1-4 警告が返る。
	 */
	test( 'when a colon has a leading space or lacks one trailing space, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'Status',
			'状態 :有効'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の前のスペースは不要です'
		);
		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の後にスペースを1つ入れてください'
		);
	} );

	/**
	 * URL がコロン直後に続く場合もコロン後のスペース不足を検出することを確認する。
	 *
	 * 操作:
	 * - コロン直後に URL が続く翻訳を確認する。
	 *
	 * 期待結果:
	 * - コロン後のスペース不足が返る。
	 */
	test( 'when a URL follows a colon without a space, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'URL',
			'URL:https://example.com'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の後にスペースを1つ入れてください'
		);
	} );

	/**
	 * プレースホルダーがコロン直後に続く場合もコロン後のスペース不足を検出することを確認する。
	 *
	 * 操作:
	 * - コロン直後に文字列プレースホルダーが続く翻訳を確認する。
	 *
	 * 期待結果:
	 * - コロン後のスペース不足が返る。
	 */
	test( 'when a placeholder follows a colon without a space, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'Value',
			'値:%s'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の後にスペースを1つ入れてください'
		);
	} );

	/**
	 * URL の後ろにあるコロン前スペースも検出することを確認する。
	 *
	 * 操作:
	 * - URL とコロンの間に不要なスペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - コロン前のスペース不要が返る。
	 */
	test( 'when a URL is followed by a spaced colon, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'URL',
			'https://example.com :'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の前のスペースは不要です'
		);
	} );

	/**
	 * コロン前の全角スペースも不要なスペースとして扱うことを確認する。
	 *
	 * 操作:
	 * - コロンの直前に全角スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - コロン前のスペース不要が返る。
	 */
	test( 'when a colon has a leading full-width space, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'Status',
			'ユーザー ID　: username'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の前のスペースは不要です'
		);
	} );

	/**
	 * コロン前の NBSP も不要なスペースとして扱うことを確認する。
	 *
	 * 操作:
	 * - コロンの直前に NBSP を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - コロン前のスペース不要が返る。
	 */
	test( 'when a colon has a leading NBSP, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'User ID',
			'ユーザー ID\u00a0: username'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の前のスペースは不要です'
		);
	} );

	/**
	 * 日本語句読点の前後に不要なスペースがある場合を検出することを確認する。
	 *
	 * 操作:
	 * - 読点の前に半角スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 句読点前後のスペース不要が返る。
	 */
	test( 'when a Japanese punctuation mark has an adjacent space, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'Message',
			'設定 、保存'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「、」の前後のスペースは不要です'
		);
	} );

	/**
	 * 日本語句読点の前後に全角スペースがある場合も検出することを確認する。
	 *
	 * 操作:
	 * - 読点の直後に全角スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 句読点前後のスペース不要が返る。
	 */
	test( 'when Japanese punctuation has an adjacent full-width space, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'Message',
			'こんにちは、　username さん。'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「、」の前後のスペースは不要です'
		);
	} );

	/**
	 * 終了タグをまたいだコロン後の正しいスペースを正常とすることを確認する。
	 *
	 * 操作:
	 * - コロン直後に終了タグがあり、その後に半角スペース1つと本文が続く翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘は返らない。
	 */
	test( 'when one trailing space follows a colon across protected markup, should not report rule 1-4', () => {
		assertClean(
			runRule(
				'ja_half_full_spacing',
				'Ads',
				'<strong>Ads:</strong> Google 広告'
			)
		);
	} );

	/**
	 * 終了タグをまたいでもコロン後にスペースがなければ検出することを確認する。
	 *
	 * 操作:
	 * - コロン直後に終了タグがあり、その後へ本文が直接続く翻訳を確認する。
	 *
	 * 期待結果:
	 * - コロン後のスペース不足が返る。
	 */
	test( 'when a colon lacks trailing space across protected markup, should report rule 1-4', () => {
		const results = runRule(
			'ja_half_full_spacing',
			'Ads',
			'<strong>Ads:</strong>Google 広告'
		);

		assertWarning(
			results,
			'1-4 半角文字と全角文字の間のスペース: 「:」の後にスペースを1つ入れてください'
		);
	} );
} );

describe( 'Japanese v1 rule 1-5', () => {
	/**
	 * 本文中の半角丸括弧で外側スペースが不足する場合を検出することを確認する。
	 *
	 * 操作:
	 * - 丸括弧が前後の本文へ直接接する翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の警告が返る。
	 */
	test( 'when parentheses are full-width or outer spacing is invalid, should report rule 1-5', () => {
		const results = runRule(
			'ja_parentheses',
			'Label',
			'設定(詳細)項目'
		);

		assertWarning(
			results,
			'1-5 半角丸括弧と前後スペース: 丸括弧の外側は半角スペース1つにしてください'
		);
	} );

	/**
	 * 全角丸括弧を検出することを確認する。
	 *
	 * 操作:
	 * - 全角丸括弧を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 半角丸括弧の使用が案内される。
	 */
	test( 'when parentheses are full-width, should report rule 1-5', () => {
		const results = runRule( 'ja_parentheses', 'Label', '設定（詳細）' );

		assertWarning(
			results,
			'1-5 半角丸括弧と前後スペース: 丸括弧は半角の「( )」を使用してください'
		);
	} );

	/**
	 * 関数呼び出しの丸括弧を本文の丸括弧として誤検出しないことを確認する。
	 *
	 * 操作:
	 * - 明確な関数呼び出しを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の指摘は返らない。
	 */
	test( 'when empty parentheses belong to a function call, should not report rule 1-5', () => {
		assertClean(
			runRule(
				'ja_parentheses',
				'Function',
				'remove_order_items() は文字列型の項目を期待します'
			)
		);
	} );

	/**
	 * 名前付き文字列プレースホルダー内部の丸括弧を誤検出しないことを確認する。
	 *
	 * 操作:
	 * - 名前付きプレースホルダーが日本語へ接する翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の指摘は返らない。
	 */
	test( 'when a named string placeholder is checked by rule 1-5, should not report its parentheses', () => {
		assertClean(
			runRule(
				'ja_parentheses',
				'Field',
				'%(field)sの範囲'
			)
		);
	} );

	/**
	 * 文字列境界や日本語句読点の隣では外側スペースを要求しないことを確認する。
	 *
	 * 操作:
	 * - 文頭の開き括弧と日本語句読点へ接する閉じ括弧を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の指摘は返らない。
	 */
	test( 'when parentheses are at string boundaries or next to Japanese punctuation, should not require outside spaces', () => {
		assertClean(
			runRule(
				'ja_parentheses',
				'Label',
				'(詳細)、設定。'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 1-6', () => {
	/**
	 * 丸括弧内側の不要スペースを検出することを確認する。
	 *
	 * 操作:
	 * - 丸括弧内側に半角スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-6 の警告が返る。
	 */
	test( 'when spaces exist just inside parentheses, should report rule 1-6', () => {
		const results = runRule(
			'ja_inner_parentheses_spacing',
			'Label',
			'設定 ( 詳細 )'
		);

		assertWarning(
			results,
			'1-6 丸括弧内側の不要スペース: 丸括弧の内側のスペースは削除してください'
		);
	} );

	/**
	 * 技術文字列内部の丸括弧内側スペースを対象外にすることを確認する。
	 *
	 * 操作:
	 * - コード表記内部に丸括弧と内側スペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-6 の指摘は返らない。
	 */
	test( 'when inner parentheses spacing appears inside a protected technical string, should not report rule 1-6', () => {
		assertClean(
			runRule(
				'ja_inner_parentheses_spacing',
				'Code',
				'コード \`foo( bar )\` を確認'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 1-7', () => {
	/**
	 * 文中の丸括弧内末尾に句点がある場合を検出することを確認する。
	 *
	 * 操作:
	 * - 文の途中に「。)」を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-7 の警告が返る。
	 */
	test( 'when a period appears before a closing parenthesis inside a larger sentence, should report rule 1-7', () => {
		const results = runRule(
			'ja_period_inside_parentheses',
			'Message',
			'設定 (詳細。) を保存'
		);

		assertWarning(
			results,
			'1-7 括弧内末尾の句点: 丸括弧内の末尾の句点は削除してください'
		);
	} );

	/**
	 * 文末の「。)」は 1-8 の責務とし、1-7 では重複指摘しないことを確認する。
	 *
	 * 操作:
	 * - 「。)」で終わる翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-7 の指摘は返らない。
	 */
	test( 'when the translation ends with period then closing parenthesis, should not report rule 1-7', () => {
		assertClean(
			runRule(
				'ja_period_inside_parentheses',
				'Message',
				'設定 (詳細。)'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 1-8', () => {
	/**
	 * 文末の句点が丸括弧内にある場合を検出することを確認する。
	 *
	 * 操作:
	 * - 「。)」で終わる翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-8 の警告が返る。
	 */
	test( 'when the translation ends with period then closing parenthesis, should report rule 1-8', () => {
		const results = runRule(
			'ja_sentence_ending_parentheses',
			'Message',
			'設定 (詳細。)'
		);

		assertWarning(
			results,
			'1-8 文末括弧と句点の位置: 文末の句点は丸括弧の外に置いてください'
		);
	} );

	/**
	 * 単に閉じ括弧で終わるだけの翻訳から不足句点を推測しないことを確認する。
	 *
	 * 操作:
	 * - 句点なしで閉じ括弧に終わる翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-8 の指摘は返らない。
	 */
	test( 'when a translation merely ends with a closing parenthesis, should not infer a missing period', () => {
		assertClean(
			runRule(
				'ja_sentence_ending_parentheses',
				'Label',
				'(詳細)'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 1-9', () => {
	/**
	 * 半角数字と日本語の間の不要スペースを検出することを確認する。
	 *
	 * 操作:
	 * - 半角数字と日本語単位の間にスペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の警告が返る。
	 */
	test( 'when a half-width number is separated from Japanese by a space, should report rule 1-9', () => {
		const results = runRule( 'ja_number_spacing', 'Count', '3 件' );

		assertWarning(
			results,
			'1-9 半角数字前後の不要スペース: 半角数字と日本語の間のスペースは削除してください'
		);
	} );

	/**
	 * 数値プレースホルダーを半角数字と同様に扱うことを確認する。
	 *
	 * 操作:
	 * - 数値プレースホルダーと日本語の間にスペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の警告が返る。
	 */
	test( 'when a numeric placeholder is separated from Japanese by a space, should report rule 1-9', () => {
		const results = runRule(
			'ja_number_spacing',
			'%d items',
			'%1$d 件'
		);

		assertWarning(
			results,
			'1-9 半角数字前後の不要スペース: 半角数字と日本語の間のスペースは削除してください'
		);
	} );

	/**
	 * 技術的な半角トークン内の数字を誤検出しないことを確認する。
	 *
	 * 操作:
	 * - 規格番号やバージョンを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の指摘は返らない。
	 */
	test( 'when a digit is part of a technical token, should not report rule 1-9', () => {
		assertClean(
			runRule(
				'ja_number_spacing',
				'Version',
				'WooCommerce 5.3 で導入されました'
			)
		);
	} );

	/**
	 * コード表記内部の数字周辺スペースを対象外にすることを確認する。
	 *
	 * 操作:
	 * - コード表記内部に「数字 + スペース + 日本語」を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の指摘は返らない。
	 */
	test( 'when number spacing appears inside protected code, should not report rule 1-9', () => {
		assertClean(
			runRule(
				'ja_number_spacing',
				'Code',
				'コード \`3 件\` を確認'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 3-2', () => {
	/**
	 * View XX の翻訳が推奨表現でない場合に確認指摘を返すことを確認する。
	 *
	 * 操作:
	 * - View posts を「投稿を閲覧」と翻訳したケースを確認する。
	 *
	 * 期待結果:
	 * - 3-2 の警告が返る。
	 */
	test( 'when View XX is translated using 閲覧, should report rule 3-2', () => {
		const results = runRule(
			'ja_view_expression',
			'View posts',
			'投稿を閲覧'
		);

		assertWarning(
			results,
			'3-2 「View XX」を「〜を表示 (する)」に統一: 「View XX」の訳し方を確認してください'
		);
		assert.deepEqual( results.highlight_me, [] );
	} );

	/**
	 * View XX が推奨表現で訳されている正常系を確認する。
	 *
	 * 操作:
	 * - 「投稿を表示する」とした翻訳を確認する。
	 *
	 * 期待結果:
	 * - 3-2 の指摘は返らない。
	 */
	test( 'when View XX is translated as an action using 表示, should not report rule 3-2', () => {
		assertClean(
			runRule(
				'ja_view_expression',
				'View posts',
				'投稿を表示する'
			)
		);
	} );

	/**
	 * 原文が Preview の場合は 3-2 の対象外であることを確認する。
	 *
	 * 操作:
	 * - Preview post を「投稿を閲覧」とした翻訳を確認する。
	 *
	 * 期待結果:
	 * - 3-2 の指摘は返らない。
	 */
	test( 'when the source is Preview instead of View XX, should not report rule 3-2', () => {
		assertClean(
			runRule(
				'ja_view_expression',
				'Preview post',
				'投稿を閲覧'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 3-3', () => {
	/**
	 * 権限文脈の not allowed to が推奨表現でない場合を検出することを確認する。
	 *
	 * 操作:
	 * - Users are not allowed to ... を別表現で訳したケースを確認する。
	 *
	 * 期待結果:
	 * - 3-3 の警告が返る。
	 */
	test( 'when not allowed to is translated without the permission expression, should report rule 3-3', () => {
		const results = runRule(
			'ja_not_allowed_expression',
			'Users are not allowed to edit this.',
			'ユーザーは編集できません。'
		);

		assertWarning(
			results,
			'3-3 「XX are/is not allowed to...」を「〜する権限がありません」に統一: 「not allowed to ...」の訳し方を確認してください'
		);
	} );

	/**
	 * 値制約など権限以外の not allowed to を対象外にすることを確認する。
	 *
	 * 操作:
	 * - 主語がユーザー種別ではない原文を確認する。
	 *
	 * 期待結果:
	 * - 3-3 の指摘は返らない。
	 */
	test( 'when not allowed to describes a value constraint, should not report rule 3-3', () => {
		assertClean(
			runRule(
				'ja_not_allowed_expression',
				'This value is not allowed to contain spaces.',
				'この値にスペースを含めることはできません。'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 3-4', () => {
	/**
	 * 原文先頭の Sorry に対応する謝罪表現が翻訳へ残っている場合を検出することを確認する。
	 *
	 * 操作:
	 * - Sorry, で始まる原文と謝罪表現で始まる翻訳を確認する。
	 *
	 * 期待結果:
	 * - 3-4 の警告が返る。
	 */
	test( 'when Sorry starts the source and an explicit apology remains in translation, should report rule 3-4', () => {
		const results = runRule(
			'ja_sorry_prefix',
			'Sorry, you cannot edit this post.',
			'申し訳ありません、この投稿は編集できません。'
		);

		assertWarning(
			results,
			'3-4 「Sorry, ...」の Sorry を訳さない: 先頭の「Sorry,」に対応する謝罪表現を削除してください'
		);
	} );

	/**
	 * 原文先頭が Sorry でない場合は謝罪表現を機械的に削除対象としないことを確認する。
	 *
	 * 操作:
	 * - Sorry が文頭ではない原文を確認する。
	 *
	 * 期待結果:
	 * - 3-4 の指摘は返らない。
	 */
	test( 'when Sorry is not at the source start or the translation has no listed apology prefix, should not report rule 3-4', () => {
		assertClean(
			runRule(
				'ja_sorry_prefix',
				'We are sorry, you cannot edit this post.',
				'申し訳ありません、この投稿は編集できません。'
			)
		);
	} );
} );

describe( 'Japanese v1 rule 3-6', () => {
	/**
	 * 推奨外表記をそれぞれ検出することを確認する。
	 *
	 * 操作:
	 * - 「下さい」「全て」「既に」を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 各表記に対応する 3-6 の警告が返る。
	 */
	test( 'when recommended expressions are used, should report each rule 3-6 message', () => {
		const results = runRule(
			'ja_recommended_expressions',
			'Message',
			'全て既に確認して下さい'
		);

		assertWarning(
			results,
			'3-6 「下さい / 全て / 既に」などの推奨表記: 「下さい」は「ください」と表記してください'
		);
		assertWarning(
			results,
			'3-6 「下さい / 全て / 既に」などの推奨表記: 「全て」は「すべて」と表記してください'
		);
		assertWarning(
			results,
			'3-6 「下さい / 全て / 既に」などの推奨表記: 「既に」は「すでに」と表記してください'
		);
	} );

	/**
	 * 技術文字列内部だけにある推奨外表記を対象外にすることを確認する。
	 *
	 * 操作:
	 * - コード表記内部だけに「全て」を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 3-6 の指摘は返らない。
	 */
	test( 'when a recommended expression appears only inside protected code, should not report rule 3-6', () => {
		assertClean(
			runRule(
				'ja_recommended_expressions',
				'Code',
				'コード \`全て\` を確認'
			)
		);
	} );

	/**
	 * 保護文字列と通常本文の両方に推奨外表記がある場合、通常本文だけを指摘することを確認する。
	 *
	 * 操作:
	 * - コード内部と通常本文の双方に「全て」を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 3-6 の警告は1件だけ返る。
	 */
	test( 'when a recommended expression appears both inside protected code and normal text, should report rule 3-6 once', () => {
		const results = runRule(
			'ja_recommended_expressions',
			'Message',
			'コード \`全て\` はそのままにして、全ての設定を保存'
		);

		assert.equal(
			results.warning.filter(
				( message ) => message.includes( '「全て」は「すべて」と表記してください' )
			).length,
			1
		);
	} );
} );

describe( 'Japanese v1 rule 5', () => {
	/**
	 * 通常本文の全角中点と半角中黒をルール 5 として検出することを確認する。
	 *
	 * 操作:
	 * - 両方の中点表記をそれぞれ確認する。
	 *
	 * 期待結果:
	 * - どちらも同じルール 5 の警告が返る。
	 */
	test( 'when middle dots appear in normal text, should report rule 5 for full-width and half-width forms', () => {
		const fullWidth = runRule(
			'ja_middle_dot',
			'Reorder rows and columns',
			'行・列を並び替える'
		);
		const halfWidth = runRule(
			'ja_middle_dot',
			'Reorder rows and columns',
			'行･列を並び替える'
		);
		const expected =
			'5. 中点「・」: 中点「・」は原則使用しません。別の表現に置き換えられないか確認してください';

		assertWarning( fullWidth, expected );
		assertWarning( halfWidth, expected );
	} );

	/**
	 * 技術文字列内部だけにある中点を対象外にすることを確認する。
	 *
	 * 操作:
	 * - コード表記内部の中点を確認する。
	 *
	 * 期待結果:
	 * - ルール 5 の指摘は返らない。
	 */
	test( 'when a middle dot appears only inside protected technical text, should not report rule 5', () => {
		assertClean(
			runRule(
				'ja_middle_dot',
				'Code',
				'コード \`foo・bar\` を確認'
			)
		);
	} );

	/**
	 * 保護文字列と通常本文の両方に中点がある場合、通常本文だけを根拠として指摘することを確認する。
	 *
	 * 操作:
	 * - コード内部と通常本文の双方に同じ中点を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - ルール 5 の警告は1件だけ返る。
	 * - 同じ文字列が複数箇所に存在して強調位置を一意に特定できないため、強調候補は返らない。
	 */
	test( 'when protected and normal-text middle dots coexist, should report only the normal-text occurrence', () => {
		const results = runRule(
			'ja_middle_dot',
			'Code and label',
			'コード \`foo・bar\` と行・列を確認'
		);

		assert.equal( results.warning.length, 1 );
		assert.deepEqual( results.highlight_me, [] );
	} );
} );

describe( 'Japanese v1 production boundary', () => {
	/**
	 * 日本語ロケール判定を含む本番実行境界から警告を取得できることを確認する。
	 *
	 * 操作:
	 * - 1-1 違反を日本語チェック全体へ渡す。
	 *
	 * 期待結果:
	 * - warning と highlight 候補が返る。
	 */
	test( 'when a Japanese rule reports a finding, should expose the warning through the production runner', () => {
		const results = checks.runJapaneseChecks( 'Settings', '設定，保存' );

		assertWarning(
			results,
			'1-1 日本語の句読点: 日本語の句読点は「、」「。」を使用してください'
		);
		assert.deepEqual( results.highlight_me, [ '，' ] );
	} );

	/**
	 * ルール設定が notice の場合は通知へ振り分けられることを確認する。
	 *
	 * 操作:
	 * - 1-1 だけを notice として実行する。
	 *
	 * 期待結果:
	 * - warning ではなく notice に表示メッセージが返る。
	 */
	test( 'when a Japanese rule is configured as notice, should expose the finding as a notice', () => {
		const results = runRule(
			'ja_punctuation',
			'Settings',
			'設定，保存',
			'notice'
		);

		assert.deepEqual( results.warning, [] );
		assertNotice(
			results,
			'1-1 日本語の句読点: 日本語の句読点は「、」「。」を使用してください'
		);
	} );

	/**
	 * ルール設定が nothing の場合は表示結果にも強調候補にも含めないことを確認する。
	 *
	 * 操作:
	 * - 全ルールを nothing として違反を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 警告・通知・強調候補のいずれにも追加されない。
	 */
	test( 'when a Japanese rule is disabled, should omit its message and highlight from production results', () => {
		const overrides = Object.fromEntries(
			JAPANESE_RULE_SETTINGS.map( ( key ) => [ key, 'nothing' ] )
		);
		const results = checks.runJapaneseChecks(
			'Settings',
			'設定，保存',
			overrides
		);

		assertClean( results );
	} );
} );

describe( 'Japanese v1 match ranges', () => {
	/**
	 * 同じ 1-1 違反が複数箇所にある場合、UTF-16 code unit offset をすべて保持することを確認する。
	 *
	 * 操作:
	 * - 絵文字の後に同じ不適切な句読点を2箇所含む翻訳を個別ルールへ渡す。
	 *
	 * 期待結果:
	 * - 2箇所の [start, end) が1件の指摘へ保持される。
	 */
	test( 'when the same punctuation finding occurs multiple times, should keep every UTF-16 match range in one message', () => {
		const findings = checks.wpgpt_ja_check_punctuation( '😀設定，保存，完了' );

		assert.deepEqual(
			findings[ 0 ].matches,
			[
				{ start: 4, end: 5 },
				{ start: 7, end: 8 },
			]
		);
	} );

	/**
	 * 同じ 1-4 違反が複数箇所にある場合、UTF-16 code unit offset をすべて保持することを確認する。
	 *
	 * 操作:
	 * - 絵文字の後に同じ境界違反を2箇所含む翻訳を個別ルールへ渡す。
	 *
	 * 期待結果:
	 * - 2箇所の [start, end) が1件の指摘へ保持される。
	 */
	test( 'when the same spacing boundary violation occurs multiple times, should keep all match ranges in one rule 1-4 message', () => {
		const findings = checks.wpgpt_ja_check_half_full_spacing( '😀A設定とA設定' );

		assert.deepEqual(
			findings[ 0 ].matches,
			[
				{ start: 2, end: 4 },
				{ start: 6, end: 8 },
			]
		);
	} );

	/**
	 * コロン前後の異なる違反が、それぞれ自分の問題箇所だけを位置情報として持つことを確認する。
	 *
	 * 操作:
	 * - コロン前後に別々の違反を含む翻訳を個別ルールへ渡す。
	 *
	 * 期待結果:
	 * - 前側と後側の指摘が別々の matches を保持する。
	 */
	test( 'when colon spacing has separate before and after violations, should keep distinct match ranges for each rule 1-4 message', () => {
		const findings = checks.wpgpt_ja_check_half_full_spacing( '状態 :有効' );
		const before = findings.find(
			( finding ) => finding.message === '「:」の前のスペースは不要です'
		);
		const after = findings.find(
			( finding ) => finding.message === '「:」の後にスペースを1つ入れてください'
		);

		assert.deepEqual( before.matches, [ { start: 2, end: 4 } ] );
		assert.deepEqual( after.matches, [ { start: 3, end: 5 } ] );
	} );

	/**
	 * 同一の推奨外表記が複数回現れる場合、全範囲を1件の指摘へまとめることを確認する。
	 *
	 * 操作:
	 * - 絵文字の後に「全て」を2箇所含む翻訳を個別ルールへ渡す。
	 *
	 * 期待結果:
	 * - UTF-16 code unit offset の2範囲が保持される。
	 */
	test( 'when one recommended expression appears multiple times, should keep every UTF-16 range in one rule 3-6 message', () => {
		const findings = checks.wpgpt_ja_check_recommended_expressions(
			'😀全て保存、全て確認'
		);

		assert.deepEqual(
			findings[ 0 ].matches,
			[
				{ start: 2, end: 4 },
				{ start: 7, end: 9 },
			]
		);
	} );

	/**
	 * 翻訳全体へ適用する確認指摘では、誤った位置情報を生成しないことを確認する。
	 *
	 * 操作:
	 * - 3-2 の確認対象となる翻訳を個別ルールへ渡す。
	 *
	 * 期待結果:
	 * - 指摘は返るが matches は空配列となる。
	 */
	test( 'when a warning applies to the translation expression as a whole, should not invent a match range', () => {
		const findings = checks.wpgpt_ja_check_view_expression(
			'View posts',
			'投稿を閲覧'
		);

		assert.deepEqual( findings[ 0 ].matches, [] );
	} );
} );
