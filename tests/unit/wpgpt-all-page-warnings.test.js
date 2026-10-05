'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { describe, test } = require( 'node:test' );

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

function loadAllPageWarnings( { jaEnabled = true, japaneseLocale = true } = {} ) {
	const settings = {
		ja_checks: { state: jaEnabled ? 'enabled' : 'disabled' },
	};
	JAPANESE_RULE_SETTINGS.forEach( ( setting ) => {
		settings[ setting ] = { state: 'warning' };
	} );

	const context = vm.createContext( {
		console,
		URL,
		wpgpt_settings: settings,
		wpgpt_is_japanese_locale: () => japaneseLocale,
	} );

	const defaultRule = ( setting, styleGuideItem, message, matches = [] ) => () => [ {
		setting,
		style_guide_item: styleGuideItem,
		message,
		matches,
	} ];

	context.wpgpt_ja_check_punctuation = defaultRule(
		'ja_punctuation',
		'1-1 日本語の句読点',
		'句読点を確認してください',
		[ { start: 0, end: 1 } ]
	);
	context.wpgpt_ja_check_half_width = () => [];
	context.wpgpt_ja_check_half_full_spacing = defaultRule(
		'ja_half_full_spacing',
		'1-4 半角文字と全角文字の間のスペース',
		'スペースを確認してください',
		[ { start: 1, end: 3 } ]
	);
	context.wpgpt_ja_check_parentheses = () => [];
	context.wpgpt_ja_check_inner_parentheses_spacing = () => [];
	context.wpgpt_ja_check_period_inside_parentheses = () => [];
	context.wpgpt_ja_check_sentence_ending_parentheses = () => [];
	context.wpgpt_ja_check_number_spacing = () => [];
	context.wpgpt_ja_check_recommended_expressions = () => [];
	context.wpgpt_ja_check_view_expression = () => [];
	context.wpgpt_ja_check_not_allowed_expression = () => [];
	context.wpgpt_ja_check_sorry_prefix = () => [];
	context.wpgpt_ja_check_middle_dot = () => [];

	const source = fs.readFileSync(
		path.resolve( __dirname, '../../src/js/wpgpt-all-page-warnings.js' ),
		'utf8'
	);
	vm.runInContext( source, context, {
		filename: 'src/js/wpgpt-all-page-warnings.js',
	} );

	return context.wpgpt_all_page_warnings_test_api;
}

function normalize( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function sampleResults() {
	return [
		{
			id: '101',
			warnings: [
				{ text: 'General warning', form: 1, setting: null },
				{ text: '1-4 半角文字と全角文字の間のスペース: スペースを確認してください', form: 1, setting: null },
			],
			japaneseFindings: [
				{
					setting: 'ja_half_full_spacing',
					style_guide_item: '1-4 半角文字と全角文字の間のスペース',
					message: 'スペースを確認してください',
					matches: [ { start: 0, end: 9 } ],
					form: 1,
				},
			],
		},
		{
			id: '102',
			warnings: [
				{ text: '1-1 日本語の句読点: 句読点を確認してください', form: 1, setting: null },
			],
			japaneseFindings: [
				{
					setting: 'ja_punctuation',
					style_guide_item: '1-1 日本語の句読点',
					message: '句読点を確認してください',
					matches: [ { start: 0, end: 1 } ],
					form: 1,
				},
			],
		},
		{
			id: '103',
			warnings: [
				{ text: 'Another general warning', form: 1, setting: null },
			],
			japaneseFindings: [],
		},
	];
}

describe( 'all-page Warning result filtering', () => {
	test( 'without a Japanese rule filter, keeps every Warning for every affected string', () => {
		const api = loadAllPageWarnings();
		const filtered = api.filterResults( sampleResults(), new Set() );
		const summary = api.summarize( filtered );

		assert.equal( filtered.length, 3 );
		assert.equal( summary.warnings, 4 );
		assert.equal( summary.strings, 3 );
	} );

	test( 'multiple selected Japanese rules use OR semantics and only expose matching findings', () => {
		const api = loadAllPageWarnings();
		const filtered = api.filterResults(
			sampleResults(),
			new Set( [ 'ja_punctuation', 'ja_half_full_spacing' ] )
		);
		const summary = api.summarize( filtered );

		assert.deepEqual( normalize( filtered.map( ( result ) => result.id ) ), [ '101', '102' ] );
		assert.equal( summary.warnings, 2 );
		assert.equal( summary.strings, 2 );
		assert.ok( filtered[ 0 ].displayWarnings[ 0 ].text.startsWith( '1-4 ' ) );
	} );

	test( 'rule filter options omit zero-count rules and include the 件 unit', () => {
		const api = loadAllPageWarnings();
		const options = normalize( api.ruleOptions( sampleResults() ) );

		assert.deepEqual(
			options.map( ( option ) => [ option.setting, option.countLabel ] ),
			[
				[ 'ja_punctuation', '1件' ],
				[ 'ja_half_full_spacing', '1件' ],
			]
		);
	} );

	test( 'pagination slices affected strings without altering the full result set', () => {
		const api = loadAllPageWarnings();
		const results = Array.from( { length: 96 }, ( _, index ) => ( {
			id: String( index + 1 ),
			displayWarnings: [ { text: 'Warning', form: 1 } ],
		} ) );

		const page = api.paginate( results, 4, 25 );

		assert.equal( page.page, 4 );
		assert.equal( page.totalPages, 4 );
		assert.equal( page.items.length, 21 );
		assert.equal( page.items[ 0 ].id, '76' );
		assert.equal( results.length, 96 );
	} );
} );


describe( 'all-page Warning normalization and search', () => {
	function searchableResults() {
		return [
			{
				id: '201',
				context: 'Button label',
				original: 'Use WordPress here.',
				translations: [ 'WordPressは便利です。', '別の訳文' ],
				sourceUrl: 'https://translate.wordpress.org/example/201',
				warnings: [
					{ text: 'General warning', form: 1, setting: null },
					{
						text: '1-4 半角文字と全角文字の間のスペース: スペースを確認してください',
						form: 1,
						setting: null,
					},
				],
				japaneseFindings: [
					{
						setting: 'ja_half_full_spacing',
						style_guide_item: '1-4 半角文字と全角文字の間のスペース',
						message: 'スペースを確認してください',
						form: 1,
						matches: [ { start: 0, end: 9 } ],
					},
				],
			},
			{
				id: '202',
				context: null,
				original: 'Save changes',
				translations: [ '変更を保存' ],
				sourceUrl: 'https://translate.wordpress.org/example/202',
				warnings: [ { text: 'General warning', form: 1, setting: null } ],
				japaneseFindings: [],
			},
		];
	}

	test( 'normalization adds Japanese metadata without changing the logical Warning count', () => {
		const api = loadAllPageWarnings();
		const normalized = api.normalizeResult( searchableResults()[ 0 ] );

		assert.equal( normalized.displayWarnings.length, 2 );
		assert.equal( normalized.displayWarnings[ 0 ].text, 'General warning' );
		assert.equal( normalized.displayWarnings[ 1 ].setting, 'ja_half_full_spacing' );
		assert.deepEqual(
			normalize( normalized.displayWarnings[ 1 ].matches ),
			[ { start: 0, end: 9 } ]
		);
	} );

	test( 'search matches original, translations, context, plural forms, and ignores case', () => {
		const api = loadAllPageWarnings();
		const results = api.filterResults( searchableResults(), new Set() );

		assert.deepEqual(
			normalize( api.searchResults( results, 'wordpress' ).map( ( result ) => result.id ) ),
			[ '201' ]
		);
		assert.deepEqual(
			normalize( api.searchResults( results, 'BUTTON' ).map( ( result ) => result.id ) ),
			[ '201' ]
		);
		assert.deepEqual(
			normalize( api.searchResults( results, '別の訳文' ).map( ( result ) => result.id ) ),
			[ '201' ]
		);
		assert.deepEqual(
			normalize( api.searchResults( results, '変更を保存' ).map( ( result ) => result.id ) ),
			[ '202' ]
		);
		assert.equal( api.searchResults( results, 'missing' ).length, 0 );
		assert.equal( api.searchResults( results, '   ' ).length, 2 );
	} );

	test( 'rule filter and text search use AND semantics', () => {
		const api = loadAllPageWarnings();
		const matched = api.applyFilters(
			searchableResults(),
			new Set( [ 'ja_half_full_spacing' ] ),
			'wordpress'
		);
		const missed = api.applyFilters(
			searchableResults(),
			new Set( [ 'ja_half_full_spacing' ] ),
			'Save changes'
		);

		assert.deepEqual( normalize( matched.map( ( result ) => result.id ) ), [ '201' ] );
		assert.equal( matched[ 0 ].displayWarnings.length, 1 );
		assert.equal( missed.length, 0 );
	} );
} );

describe( 'Warning Slack copy generation', () => {
	function slackResult() {
		return {
			context: '# button',
			original: '# Title',
			translations: [ 'WordPressは便利です。', '_second_' ],
			sourceUrl: 'https://translate.wordpress.org/projects/example/ja/default/?filters=1',
			displayWarnings: [
				{
					text: '1-4 *warning*',
					form: 1,
					setting: 'ja_half_full_spacing',
					matches: [ { start: 0, end: 10 }, { start: 8, end: 10 } ],
				},
				{
					text: 'General [warning]',
					form: 2,
					setting: null,
					matches: [],
				},
			],
		};
	}

	test( 'literal blocks keep user text inside Slack code blocks', () => {
		const api = loadAllPageWarnings();
		const literal = api.slackLiteral( '# Title *bold*' );

		assert.equal( literal, '```\n# Title *bold*\n```' );
	} );

	test( 'problem text clamps and merges ranges before adding Slack bold markers', () => {
		const api = loadAllPageWarnings();
		const marked = api.slackProblemText(
			'WordPressは便利',
			{ matches: [ { start: 0, end: 4 }, { start: 3, end: 9 }, { start: 99, end: 120 } ] }
		);

		assert.equal( marked, '*WordPress*は便利' );
	} );

	test( 'full Slack copy uses only displayWarnings and includes context, forms, problem location, and URL', () => {
		const api = loadAllPageWarnings();
		const result = slackResult();
		const output = api.slackAll(
			[ result ],
			new Set( [ 'ja_half_full_spacing' ] ),
			'WordPress'
		);

		assert.ok( output.includes( '対象: 1文字列 / 2 Warnings' ) );
		assert.ok( output.includes( 'ルール: 1-4' ) );
		assert.ok( output.includes( '検索:' ) );
		assert.ok( output.includes( 'WordPress' ) );
		assert.ok( output.includes( '# button' ) );
		assert.ok( output.includes( '*Translation Form #1*' ) );
		assert.ok( output.includes( '*Translation Form #2*' ) );
		assert.ok( output.includes( '*Problem location*' ) );
		assert.ok( output.includes( '*WordPressは*便利です。' ) );
		assert.ok( output.includes( 'General [warning]' ) );
		assert.ok( output.includes( result.sourceUrl ) );
	} );

	test( 'single-Warning Slack copy contains only the selected Warning and its translation form', () => {
		const api = loadAllPageWarnings();
		const result = slackResult();
		const output = api.slackSingle( result, result.displayWarnings[ 1 ] );

		assert.ok( output.includes( '_second_' ) );
		assert.ok( output.includes( 'General [warning]' ) );
		assert.equal( output.includes( '1-4 *warning*' ), false );
		assert.equal( output.includes( 'WordPressは便利です。' ), false );
	} );

	test( 'copy helper resolves only after writeText succeeds and rejects failures', async () => {
		const api = loadAllPageWarnings();
		let copied = '';
		await api.copyText( 'review', {
			async writeText( value ) {
				copied = value;
			},
		} );
		assert.equal( copied, 'review' );

		await assert.rejects(
			api.copyText( 'review', {
				async writeText() {
					throw new Error( 'denied' );
				},
			} ),
			/denied/u
		);
	} );
} );

describe( 'Japanese finding collection', () => {
	test( 'collects structured findings only for rules configured as warnings', () => {
		const api = loadAllPageWarnings();
		const findings = api.collectJapaneseFindings( 'Original', '翻訳', 2 );

		assert.deepEqual(
			normalize( findings.map( ( finding ) => finding.setting ) ),
			[ 'ja_punctuation', 'ja_half_full_spacing' ]
		);
		assert.ok( findings.every( ( finding ) => 2 === finding.form ) );
		assert.deepEqual( normalize( findings[ 1 ].matches ), [ { start: 1, end: 3 } ] );
	} );

	test( 'does not collect Japanese findings when Japanese checks are disabled', () => {
		const api = loadAllPageWarnings( { jaEnabled: false } );

		assert.deepEqual( normalize( api.collectJapaneseFindings( 'Original', '翻訳', 1 ) ), [] );
	} );

	test( 'does not collect Japanese findings outside a Japanese locale', () => {
		const api = loadAllPageWarnings( { japaneseLocale: false } );

		assert.deepEqual( normalize( api.collectJapaneseFindings( 'Original', 'Translation', 1 ) ), [] );
	} );
} );

describe( 'Japanese Warning highlight ranges', () => {
	test( 'uses only visible rules and the matching plural form, then merges overlapping ranges', () => {
		const api = loadAllPageWarnings();
		const result = {
			japaneseFindings: [
				{
					setting: 'ja_punctuation',
					form: 1,
					matches: [ { start: 0, end: 2 } ],
				},
				{
					setting: 'ja_half_full_spacing',
					form: 1,
					matches: [ { start: 1, end: 4 }, { start: 8, end: 20 } ],
				},
				{
					setting: 'ja_half_full_spacing',
					form: 2,
					matches: [ { start: 4, end: 6 } ],
				},
			],
		};

		assert.deepEqual(
			normalize( api.highlightRanges( result, 1, new Set(), 10 ) ),
			[ { start: 0, end: 4 }, { start: 8, end: 10 } ]
		);
		assert.deepEqual(
			normalize( api.highlightRanges( result, 1, new Set( [ 'ja_punctuation' ] ), 10 ) ),
			[ { start: 0, end: 2 } ]
		);
		assert.deepEqual(
			normalize( api.highlightRanges( result, 2, new Set(), 10 ) ),
			[ { start: 4, end: 6 } ]
		);
	} );
} );


describe( 'PO export scanning', () => {
	test( 'builds a PO export URL from the GlotPress filtered export link', () => {
		const api = loadAllPageWarnings();
		const pageDocument = {
			querySelector( selector ) {
				assert.equal( selector, 'a#export' );
				return {
					getAttribute( name ) {
						if ( 'filters' === name ) {
							return '/projects/example/ja/default/export-translations/?filters%5Bstatus%5D=current';
						}
						return null;
					},
				};
			},
		};

		const url = api.buildExportUrl(
			pageDocument,
			'https://translate.wordpress.org/projects/example/ja/default/'
		);

		assert.equal(
			url,
			'https://translate.wordpress.org/projects/example/ja/default/export-translations/?filters%5Bstatus%5D=current&format=po'
		);
	} );

	test( 'builds a GlotPress original-search URL without the export path', () => {
		const api = loadAllPageWarnings();
		const url = new URL(
			api.buildSourceUrl(
				'https://translate.wordpress.org/projects/example/ja/default/export-translations/?filters%5Bstatus%5D=current&format=po',
				'Hello world'
			)
		);

		assert.equal( url.pathname, '/projects/example/ja/default/' );
		assert.equal( url.searchParams.get( 'filters[status]' ), 'current' );
		assert.equal( url.searchParams.get( 'filters[term]' ), 'Hello world' );
		assert.equal( url.searchParams.get( 'filters[term_scope]' ), 'scope_originals' );
		assert.equal( url.searchParams.has( 'format' ), false );
	} );

	test( 'parses singular, plural, context, multiline, and escaped PO values', () => {
		const api = loadAllPageWarnings();
		const entries = normalize( api.parsePo(
			[
				'msgid ""',
				'msgstr ""',
				'"Project-Id-Version: Example\\n"',
				'',
				'msgctxt "button"',
				'msgid ""',
				'"Save "',
				'"changes"',
				'msgstr "変更を保存"',
				'',
				'msgid "One file"',
				'msgid_plural "%d files"',
				'msgstr[0] "1個のファイル"',
				'msgstr[1] "%d個のファイル"',
				'',
				'msgid "Line\\nbreak"',
				'msgstr "改行\\nあり"',
			].join( '\n' )
		) );

		assert.equal( entries.length, 3 );
		assert.deepEqual( entries[ 0 ], {
			context: 'button',
			msgid: 'Save changes',
			msgidPlural: null,
			translations: [ '変更を保存' ],
		} );
		assert.deepEqual( entries[ 1 ], {
			context: null,
			msgid: 'One file',
			msgidPlural: '%d files',
			translations: [ '1個のファイル', '%d個のファイル' ],
		} );
		assert.deepEqual( entries[ 2 ], {
			context: null,
			msgid: 'Line\nbreak',
			msgidPlural: null,
			translations: [ '改行\nあり' ],
		} );
	} );

	test( 'does not treat an HTML response as a PO export', () => {
		const api = loadAllPageWarnings();

		assert.equal( api.isPo( '<!doctype html><title>Login</title>' ), false );
		assert.equal( api.isPo( 'msgid "Hello"\nmsgstr "こんにちは"' ), true );
	} );
} );

describe( 'unsaved translation detection', () => {
	function rootWithTextareas( textareas ) {
		return {
			querySelectorAll( selector ) {
				assert.equal(
					selector,
					'#translations tbody tr.editor .translation-wrapper div.textareas textarea'
				);
				return textareas;
			},
		};
	}

	test( 'reports no unsaved translations when every textarea matches its default value', () => {
		const api = loadAllPageWarnings();
		const root = rootWithTextareas( [
			{ value: '保存済み', defaultValue: '保存済み' },
			{ value: '複数形', defaultValue: '複数形' },
		] );

		assert.equal( api.hasUnsavedTranslations( root ), false );
	} );

	test( 'reports unsaved translations when any textarea differs from its default value', () => {
		const api = loadAllPageWarnings();
		const root = rootWithTextareas( [
			{ value: '保存済み', defaultValue: '保存済み' },
			{ value: '編集中', defaultValue: '保存前' },
		] );

		assert.equal( api.hasUnsavedTranslations( root ), true );
	} );

	test( 'detects a changed plural form among otherwise unchanged editors', () => {
		const api = loadAllPageWarnings();
		const root = rootWithTextareas( [
			{ value: 'A', defaultValue: 'A' },
			{ value: 'B', defaultValue: 'B' },
			{ value: 'C2', defaultValue: 'C' },
			{ value: 'D', defaultValue: 'D' },
		] );

		assert.equal( api.hasUnsavedTranslations( root ), true );
	} );

	test( 'treats replacement textareas with saved values as clean', () => {
		const api = loadAllPageWarnings();
		const root = rootWithTextareas( [
			{ value: '保存後', defaultValue: '保存後' },
		] );

		assert.equal( api.hasUnsavedTranslations( root ), false );
	} );

	test( 'reports no unsaved translations when no editor textareas exist', () => {
		const api = loadAllPageWarnings();

		assert.equal( api.hasUnsavedTranslations( rootWithTextareas( [] ) ), false );
	} );

	test( 'does not expose removed dirty tracking APIs', () => {
		const api = loadAllPageWarnings();
		const removed = [
			'createDirtyTracker',
			'textareaKey',
			'registerTextareas',
			'updateTextarea',
			'captureSave',
			'reconcilePendingSaves',
			'isDirty',
			'hasDirty',
		];

		removed.forEach( ( name ) => {
			assert.equal( Object.hasOwn( api, name ), false );
		} );
		assert.equal( typeof api.hasUnsavedTranslations, 'function' );
	} );
} );
