'use strict';

const assert = require( 'node:assert/strict' );
const { describe, test } = require( 'node:test' );

const { loadWpgptChecks } = require( './helpers/load-wpgpt-checks' );

const checks = loadWpgptChecks();

function hasMessage( findings, message ) {
	return findings.some( ( finding ) => finding.message === message );
}

describe( 'Japanese v1 rule 1-1', () => {
	/**
	 * 日本語の句読点として明確に不適切な代替文字を検出することを確認する。
	 *
	 * 操作:
	 * - 全角カンマを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-1 の指摘が返る。
	 */
	test( 'when Japanese punctuation uses an unambiguous alternative character, should report rule 1-1', () => {
		const findings = checks.wpgpt_ja_check_punctuation( '設定，保存' );

		assert.equal( findings.length, 1 );
		assert.equal( findings[ 0 ].style_guide_item, '1-1 日本語の句読点' );
	} );

	/**
	 * 数値内部の全角句読点を 1-1 の対象外にすることを確認する。
	 *
	 * 操作:
	 * - 数字に挟まれた全角ピリオドを確認する。
	 *
	 * 期待結果:
	 * - 1-1 の指摘は返らない。
	 */
	test( 'when full-width punctuation is part of a number, should not report rule 1-1', () => {
		assert.deepEqual( checks.wpgpt_ja_check_punctuation( 'バージョン １．２' ), [] );
	} );

	/**
	 * 技術文字列内部の句読点を日本語本文の句読点として扱わないことを確認する。
	 *
	 * 操作:
	 * - URL とメールアドレスを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-1 の指摘は返らない。
	 */
	test( 'when punctuation appears inside a URL or email address, should not treat it as Japanese punctuation', () => {
		assert.deepEqual(
			checks.wpgpt_ja_check_punctuation( 'https://example.com と test@example.com を確認' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 rule 1-2', () => {
	/**
	 * 全角 ASCII 文字を半角へ直す指摘を返すことを確認する。
	 *
	 * 操作:
	 * - 全角英字を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-2 の指摘と期待する半角文字が返る。
	 */
	test( 'when full-width ASCII is used, should report rule 1-2 with the expected half-width character', () => {
		const findings = checks.wpgpt_ja_check_half_width( '設定Ａ' );

		assert.equal( findings.length, 1 );
		assert.equal( findings[ 0 ].style_guide_item, '1-2 英数字・記号の半角表記' );
		assert.equal( findings[ 0 ].message, '「Ａ」は半角の「A」で表記してください' );
	} );

	/**
	 * 全角丸括弧は 1-5 で扱うため、1-2 では重複して指摘しないことを確認する。
	 *
	 * 操作:
	 * - 全角丸括弧を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-2 の指摘は返らない。
	 */
	test( 'when full-width parentheses are checked by rule 1-2, should not report them as full-width ASCII', () => {
		assert.deepEqual( checks.wpgpt_ja_check_half_width( '設定（詳細）' ), [] );
	} );
} );

describe( 'Japanese v1 rule 1-4', () => {
	/**
	 * 半角英字と日本語が直接接している場合にスペース不足を検出することを確認する。
	 *
	 * 操作:
	 * - 半角英字と日本語の境界にスペースがない翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘が返る。
	 */
	test( 'when half-width letters touch Japanese text, should report rule 1-4', () => {
		const findings = checks.wpgpt_ja_check_half_full_spacing( 'A設定' );

		assert.equal( findings[ 0 ].style_guide_item, '1-4 半角文字と全角文字の間のスペース' );
		assert.equal( findings[ 0 ].message, '「A」と「設」の間に半角スペースを入れてください' );
	} );

	/**
	 * 半角英字と日本語の間に半角スペースが1つある正常系を確認する。
	 *
	 * 操作:
	 * - 正しいスペースを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘は返らない。
	 */
	test( 'when one space separates half-width and Japanese text, should not report rule 1-4', () => {
		assert.deepEqual( checks.wpgpt_ja_check_half_full_spacing( 'A 設定' ), [] );
	} );

	/**
	 * コロン前の不要スペースとコロン後の不足を個別に検出することを確認する。
	 *
	 * 操作:
	 * - コロン前にスペースがあり、後ろにスペースがない翻訳を確認する。
	 *
	 * 期待結果:
	 * - 前後それぞれの 1-4 指摘が返る。
	 */
	test( 'when a colon has a leading space or lacks one trailing space, should report rule 1-4', () => {
		const findings = checks.wpgpt_ja_check_half_full_spacing( '状態 :有効' );

		assert.equal( findings.length, 2 );
		assert.ok( hasMessage( findings, '「:」の前のスペースは不要です' ) );
		assert.ok( hasMessage( findings, '「:」の後にスペースを1つ入れてください' ) );
	} );

	/**
	 * プレースホルダーを技術文字列として保護し、境界ルールを誤適用しないことを確認する。
	 *
	 * 操作:
	 * - 名前付き文字列プレースホルダーが日本語へ接する翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-4 の指摘は返らない。
	 */
	test( 'when a named string placeholder touches Japanese text, should not infer rule 1-4 spacing', () => {
		assert.deepEqual(
			checks.wpgpt_ja_check_half_full_spacing( '%(name)s設定' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 rule 1-5', () => {
	/**
	 * 全角丸括弧と外側スペース違反を 1-5 として検出することを確認する。
	 *
	 * 操作:
	 * - 全角丸括弧を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の指摘が返る。
	 */
	test( 'when parentheses are full-width or outer spacing is invalid, should report rule 1-5', () => {
		const findings = checks.wpgpt_ja_check_parentheses( '設定（詳細）' );

		assert.ok( hasMessage( findings, '丸括弧は半角の「( )」を使用してください' ) );
	} );

	/**
	 * 関数呼び出しの空丸括弧を技術文字列として扱うことを確認する。
	 *
	 * 操作:
	 * - 関数呼び出しを含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の指摘は返らない。
	 */
	test( 'when empty parentheses belong to a function call, should not report rule 1-5', () => {
		assert.deepEqual( checks.wpgpt_ja_check_parentheses( 'foo() を実行' ), [] );
	} );

	/**
	 * 文頭・文末や日本語句読点の隣では外側スペースを要求しないことを確認する。
	 *
	 * 操作:
	 * - 文頭と句点直前の半角丸括弧を確認する。
	 *
	 * 期待結果:
	 * - 1-5 の外側スペース指摘は返らない。
	 */
	test( 'when parentheses are at string boundaries or next to Japanese punctuation, should not require outside spaces', () => {
		assert.deepEqual( checks.wpgpt_ja_check_parentheses( '(詳細)。' ), [] );
	} );
} );

describe( 'Japanese v1 rule 1-6', () => {
	/**
	 * 丸括弧内側の不要スペースを検出することを確認する。
	 *
	 * 操作:
	 * - 開き括弧直後と閉じ括弧直前にスペースがある翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-6 の指摘が返る。
	 */
	test( 'when spaces exist just inside parentheses, should report rule 1-6', () => {
		const findings = checks.wpgpt_ja_check_inner_parentheses_spacing( '( 詳細 )' );

		assert.equal( findings.length, 1 );
		assert.equal( findings[ 0 ].matches.length, 2 );
	} );

	/**
	 * 技術文字列内部の丸括弧内スペースを対象外にすることを確認する。
	 *
	 * 操作:
	 * - コード表記内の丸括弧を確認する。
	 *
	 * 期待結果:
	 * - 1-6 の指摘は返らない。
	 */
	test( 'when inner parentheses spacing appears inside a protected technical string, should not report rule 1-6', () => {
		assert.deepEqual(
			checks.wpgpt_ja_check_inner_parentheses_spacing( 'コード `foo( bar )` を確認' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 rule 1-7', () => {
	/**
	 * 文中の丸括弧内末尾に句点がある場合を検出することを確認する。
	 *
	 * 操作:
	 * - 「。)」の後に本文が続く翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-7 の指摘が返る。
	 */
	test( 'when a period appears before a closing parenthesis inside a larger sentence, should report rule 1-7', () => {
		const findings = checks.wpgpt_ja_check_period_inside_parentheses( '設定 (詳細。) を確認' );

		assert.equal( findings.length, 1 );
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
		assert.deepEqual(
			checks.wpgpt_ja_check_period_inside_parentheses( '設定 (詳細。)' ),
			[]
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
	 * - 1-8 の指摘が返る。
	 */
	test( 'when the translation ends with period then closing parenthesis, should report rule 1-8', () => {
		const findings = checks.wpgpt_ja_check_sentence_ending_parentheses( '設定 (詳細。)' );

		assert.equal( findings.length, 1 );
		assert.equal( findings[ 0 ].style_guide_item, '1-8 文末括弧と句点の位置' );
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
		assert.deepEqual(
			checks.wpgpt_ja_check_sentence_ending_parentheses( '設定 (詳細)' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 rule 1-9', () => {
	/**
	 * 半角数字と日本語の間の不要スペースを検出することを確認する。
	 *
	 * 操作:
	 * - 数字と日本語の間にスペースがある翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の指摘が返る。
	 */
	test( 'when a half-width number is separated from Japanese by a space, should report rule 1-9', () => {
		const findings = checks.wpgpt_ja_check_number_spacing( '3 件' );

		assert.equal( findings.length, 1 );
	} );

	/**
	 * 時刻など半角トークン同士のスペースを対象外にすることを確認する。
	 *
	 * 操作:
	 * - 半角数字と半角記号だけで構成される表現を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の指摘は返らない。
	 */
	test( 'when spacing is between half-width tokens such as a time expression, should not report rule 1-9', () => {
		assert.deepEqual( checks.wpgpt_ja_check_number_spacing( '10 : 30' ), [] );
	} );

	/**
	 * コード表記内部の数字周辺スペースを対象外にすることを確認する。
	 *
	 * 操作:
	 * - コード表記に数字と日本語を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 1-9 の指摘は返らない。
	 */
	test( 'when number spacing appears inside protected code, should not report rule 1-9', () => {
		assert.deepEqual( checks.wpgpt_ja_check_number_spacing( 'コード `3 件` を確認' ), [] );
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
	 * - 3-2 の指摘が返る。
	 */
	test( 'when View XX is translated using 閲覧, should report rule 3-2', () => {
		const findings = checks.wpgpt_ja_check_view_expression( 'View posts', '投稿を閲覧' );

		assert.equal( findings.length, 1 );
		assert.deepEqual( findings[ 0 ].matches, [] );
	} );

	/**
	 * View XX が「〜を表示」に訳されている正常系を確認する。
	 *
	 * 操作:
	 * - 推奨表現を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 3-2 の指摘は返らない。
	 */
	test( 'when View XX is translated as an action using 表示, should not report rule 3-2', () => {
		assert.deepEqual(
			checks.wpgpt_ja_check_view_expression( 'View posts', '投稿を表示' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 rule 3-3', () => {
	/**
	 * 権限文脈の not allowed to が推奨表現でない場合に確認指摘を返すことを確認する。
	 *
	 * 操作:
	 * - You are not allowed to ... を別表現で訳したケースを確認する。
	 *
	 * 期待結果:
	 * - 3-3 の指摘が返る。
	 */
	test( 'when not allowed to is translated without the permission expression, should report rule 3-3', () => {
		const findings = checks.wpgpt_ja_check_not_allowed_expression(
			'You are not allowed to edit this post.',
			'この投稿は編集できません。'
		);

		assert.equal( findings.length, 1 );
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
		assert.deepEqual(
			checks.wpgpt_ja_check_not_allowed_expression(
				'This value is not allowed to contain spaces.',
				'この値にスペースを含めることはできません。'
			),
			[]
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
	 * - 3-4 の指摘が返る。
	 */
	test( 'when Sorry starts the source and an explicit apology remains in translation, should report rule 3-4', () => {
		const findings = checks.wpgpt_ja_check_sorry_prefix(
			'Sorry, you cannot edit this post.',
			'申し訳ありません、この投稿は編集できません。'
		);

		assert.equal( findings.length, 1 );
		assert.deepEqual( findings[ 0 ].matches, [ { start: 0, end: 9 } ] );
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
		assert.deepEqual(
			checks.wpgpt_ja_check_sorry_prefix(
				'We are sorry, you cannot edit this post.',
				'申し訳ありません、この投稿は編集できません。'
			),
			[]
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
	 * - 各表記に対応する 3-6 の指摘が返る。
	 */
	test( 'when recommended expressions are used, should report each rule 3-6 message', () => {
		const findings = checks.wpgpt_ja_check_recommended_expressions( '全て既に確認して下さい' );

		assert.equal( findings.length, 3 );
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
		assert.deepEqual(
			checks.wpgpt_ja_check_recommended_expressions( 'コード `全て` を確認' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 rule 5', () => {
	/**
	 * 通常本文の全角中点と半角中黒をルール 5 として検出することを確認する。
	 *
	 * 操作:
	 * - 両方の中点表記を含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - ルール 5 の指摘が返る。
	 */
	test( 'when middle dots appear in normal text, should report rule 5 for full-width and half-width forms', () => {
		const fullWidth = checks.wpgpt_ja_check_middle_dot( '行・列' );
		const halfWidth = checks.wpgpt_ja_check_middle_dot( '行･列' );

		assert.equal( fullWidth.length, 1 );
		assert.equal( halfWidth.length, 1 );
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
		assert.deepEqual(
			checks.wpgpt_ja_check_middle_dot( 'コード `foo・bar` を確認' ),
			[]
		);
	} );
} );

describe( 'Japanese v1 match ranges', () => {
	/**
	 * 同じ 1-4 違反が複数箇所にある場合、UTF-16 code unit offset をすべて保持することを確認する。
	 *
	 * 操作:
	 * - 絵文字の後に同じ境界違反を2箇所含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - 2箇所の [start, end) が UTF-16 code unit offset で返る。
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
	 * 同一の推奨外表記が複数回現れる場合、1件の指摘に全範囲をまとめることを確認する。
	 *
	 * 操作:
	 * - 絵文字の後に「全て」を2箇所含む翻訳を確認する。
	 *
	 * 期待結果:
	 * - UTF-16 code unit offset の2範囲が1件の指摘へ保持される。
	 */
	test( 'when one recommended expression appears multiple times, should keep every UTF-16 range in one rule 3-6 message', () => {
		const findings = checks.wpgpt_ja_check_recommended_expressions( '😀全て保存、全て確認' );

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
	 * - 3-2 の確認対象となる翻訳を確認する。
	 *
	 * 期待結果:
	 * - 指摘は返るが matches は空配列となる。
	 */
	test( 'when a warning applies to the translation expression as a whole, should not invent a match range', () => {
		const findings = checks.wpgpt_ja_check_view_expression( 'View posts', '投稿を閲覧' );

		assert.deepEqual( findings[ 0 ].matches, [] );
	} );
} );

describe( 'Japanese v1 production boundary', () => {
	/**
	 * 個別ルールの結果が実際の日本語チェック実行境界でメッセージへ変換されることを確認する。
	 *
	 * 操作:
	 * - 1-1 違反を含む翻訳を日本語チェック全体へ渡す。
	 *
	 * 期待結果:
	 * - warning にルール名とメッセージが入り、該当文字列が highlight 候補になる。
	 */
	test( 'when a Japanese rule reports a finding, should expose the warning through the production runner', () => {
		const results = checks.runJapaneseChecks( 'Settings', '設定，保存' );

		assert.deepEqual(
			results.warning,
			[ '1-1 日本語の句読点: 日本語の句読点は「、」「。」を使用してください' ]
		);
		assert.deepEqual( results.highlight_me, [ '，' ] );
	} );
} );
