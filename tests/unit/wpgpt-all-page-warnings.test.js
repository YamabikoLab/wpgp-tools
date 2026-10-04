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
				{ text: '1-4 warning', form: 1, setting: null },
			],
			japaneseFindings: [
				{
					setting: 'ja_half_full_spacing',
					style_guide_item: '1-4 半角文字と全角文字の間のスペース',
					message: 'スペースを確認してください',
					form: 1,
				},
			],
		},
		{
			id: '102',
			warnings: [
				{ text: '1-1 warning', form: 1, setting: null },
			],
			japaneseFindings: [
				{
					setting: 'ja_punctuation',
					style_guide_item: '1-1 日本語の句読点',
					message: '句読点を確認してください',
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

describe( 'unsaved translation tracking', () => {
	test( 'becomes dirty only while the current value differs from its saved baseline', () => {
		const api = loadAllPageWarnings();
		const tracker = api.createDirtyTracker();

		tracker.register( 'editor-1::0', '保存済み' );
		assert.equal( tracker.hasDirty(), false );

		tracker.update( 'editor-1::0', '編集中' );
		assert.equal( tracker.hasDirty(), true );

		tracker.update( 'editor-1::0', '保存済み' );
		assert.equal( tracker.hasDirty(), false );
	} );

	test( 'tracks multiple editors independently and only clears the successfully saved one', () => {
		const api = loadAllPageWarnings();
		const tracker = api.createDirtyTracker();

		tracker.register( 'editor-1::0', 'A' );
		tracker.register( 'editor-2::0', 'B' );
		tracker.update( 'editor-1::0', 'A2' );
		tracker.update( 'editor-2::0', 'B2' );

		tracker.markSaved( 'editor-1::0', 'A2' );

		assert.equal( tracker.isDirty( 'editor-1::0' ), false );
		assert.equal( tracker.isDirty( 'editor-2::0' ), true );
		assert.equal( tracker.hasDirty(), true );
		assert.deepEqual( normalize( tracker.dirtyKeys() ), [ 'editor-2::0' ] );
	} );

	test( 'a failed save leaves the previous baseline and dirty state intact', () => {
		const api = loadAllPageWarnings();
		const tracker = api.createDirtyTracker();

		tracker.register( 'editor-1::0', 'before' );
		tracker.update( 'editor-1::0', 'after' );

		assert.equal( tracker.baseline( 'editor-1::0' ), 'before' );
		assert.equal( tracker.isDirty( 'editor-1::0' ), true );
	} );

	test( 'registering a dynamically replaced textarea keeps its existing saved baseline', () => {
		const api = loadAllPageWarnings();
		const tracker = api.createDirtyTracker();

		tracker.register( 'editor-1::0', 'saved' );
		tracker.update( 'editor-1::0', 'dirty' );
		tracker.register( 'editor-1::0', 'saved' );

		assert.equal( tracker.baseline( 'editor-1::0' ), 'saved' );
		assert.equal( tracker.hasDirty(), false );
	} );
} );
