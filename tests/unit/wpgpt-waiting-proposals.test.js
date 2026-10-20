/**
 * Waiting 個別比較で、原文の取り違えを防ぎ、翻訳者によらず提案を表示するための取得条件を検証する。
 * 実ブラウザー通信を模造せず、対象の識別・応答検証・エラー条件を保護する。
 */
'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { describe, test } = require( 'node:test' );

function load( fetchImpl = undefined, Parser = undefined ) {
	const context = vm.createContext( { URL, fetch: fetchImpl, DOMParser: Parser } );
	const source = fs.readFileSync( path.join( __dirname, '../../src/js/wpgpt-all-page-warnings.js' ), 'utf8' );
	vm.runInContext( source, context );
	return vm.runInContext( `({
		visibleId: wpgpt_all_page_warnings_visible_original_id,
		apiUrl: wpgpt_all_page_warnings_waiting_api_url,
		validate: wpgpt_all_page_warnings_validate_proposals,
		open: wpgpt_all_page_warnings_open_waiting,
		get: wpgpt_all_page_warnings_waiting_get,
		searchUrl: wpgpt_all_page_warnings_waiting_search_url,
		searchId: wpgpt_all_page_warnings_waiting_search_id,
		findId: wpgpt_all_page_warnings_find_waiting_original_id
	})`, context );
}

const source = 'https://translate.wordpress.org/projects/wp-plugins/echo-knowledge-base/stable/ja/default/';
const result = { original: 'Hello', singularOriginal: 'Hello', context: null };
function proposal( id, overrides = {} ) {
	return {
		id,
		original_id: '22606895',
		translation_status: 'waiting',
		singular: 'Hello',
		context: null,
		user: { user_login: 'alice' },
		translations: [ 'こんにちは' ],
		...overrides,
	};
}

describe( 'Waiting comparison API request', () => {
	test( 'individual comparison always requests all Waiting translators', () => {
		const api = load();
		const url = new URL( api.apiUrl( source + '?filters[user_login]=alice', {
			original_id: '22606895',
		} ) );
		assert.deepEqual( Array.from( url.searchParams.entries() ), [
			[ 'filters[status]', 'waiting' ], [ 'filters[original_id]', '22606895' ],
		] );
	} );

	test( 'builds restricted API URLs without old filters or unrelated parameters', () => {
		const api = load();
		const url = new URL( api.apiUrl( source + '?filters%5Bstatus%5D=current', {
			original_id: '22606895',
			user_login: 'alice',
		} ) );
		assert.equal( url.origin, 'https://translate.wordpress.org' );
		assert.equal( url.pathname, '/api/projects/wp-plugins/echo-knowledge-base/stable/ja/default/' );
		assert.deepEqual( Array.from( url.searchParams.entries() ), [
			[ 'filters[status]', 'waiting' ], [ 'filters[original_id]', '22606895' ],
			[ 'filters[user_login]', 'alice' ],
		] );
	} );
	test( 'rejects unrelated and cross-origin paths', () => {
		const api = load();
		for ( const url of [ 'https://example.com/projects/a/b/c/ja/default/',
			'https://translate.wordpress.org/other/', 'https://translate.wordpress.org/projects/x/ja/' ] ) {
			assert.throws( () => api.apiUrl( url, {} ), /URL が不正/u );
		}
	} );
	test( 'rejects errors and unexpected JSON instead of silently returning incomplete data', async () => {
		let count = 0;
		const api = load( async () => {
			count++;
			return { ok: false, status: 429 };
		} );
		await assert.rejects( api.get( api.apiUrl( source, {} ) ), /HTTP 429/u );
		assert.equal( count, 1 );
		const notJson = load( async () => ( { ok: true, headers: { get: () => 'text/html' } } ) );
		await assert.rejects( notJson.get( api.apiUrl( source, {} ) ), /JSON/u );
		const invalid = load( async () => ( {
			ok: true, headers: { get: () => 'application/json' }, json: async () => ( { translations: [] } ),
		} ) );
		await assert.rejects( invalid.get( api.apiUrl( source, {} ) ), /応答形式/u );
	} );
} );

describe( 'Waiting source ID and proposal integrity', () => {
	test( 'uses an ID only from the visible row matching original and Context', () => {
		const api = load();
		const preview = {
			id: 'preview-22606895-141335806',
			querySelector( selector ) {
				return selector === '.context' ? null : { textContent: 'Hello' };
			},
		};
		const doc = {
			querySelectorAll: () => [ preview ],
			getElementById: () => ( { querySelector: () => ( { textContent: 'Hello' } ) } ),
		};
		assert.equal( api.visibleId( result, doc ), '22606895' );
		assert.equal( api.visibleId( { ...result, context: 'button' }, doc ), null );
		assert.equal( api.visibleId( { ...result, original: 'Other', singularOriginal: 'Other' }, doc ), null );
	} );
	test( 'retains proposals from all translators without consolidating translation IDs', () => {
		const api = load();
		const rows = [
			proposal( '137070872', { user: { user_login: 'alice' } } ),
			proposal( '141335806', { user: { user_login: 'bob' } } ),
		];
		const values = JSON.parse( JSON.stringify( api.validate( rows, {
			id: '22606895', original: 'Hello', context: null,
		} ) ) );
		assert.deepEqual( values.map( ( item ) => [ item.id, item.user.user_login ] ), [
			[ '137070872', 'alice' ], [ '141335806', 'bob' ],
		] );
	} );
	test( 'rejects cross-original, status, Context and duplicate ID', () => {
		const api = load();
		const expect = { id: '22606895', original: 'Hello', context: null };
		for ( const changed of [
			{ original_id: '999' }, { translation_status: 'current' }, { singular: 'Goodbye' },
			{ context: 'menu' }, { id: 'not-an-id' },
			{ translations: [ 20 ] },
		] ) {
			assert.throws( () => api.validate( [ proposal( '10', changed ) ], expect ), /対象外/u );
		}
		assert.throws( () => api.validate( [ proposal( '10' ), proposal( '10' ) ], expect ), /重複/u );
	} );
	test( 'retains empty and single proposal responses independently', () => {
		const api = load();
		const expected = { id: '22606895', original: 'Hello', context: null };
		assert.equal( api.validate( [], expected ).length, 0 );
		assert.equal( api.validate( [ proposal( '10' ) ], expected ).length, 1 );
	} );
} );

/**
 * 実 HTML と同じ行・原文・Context の契約を使い、単発検索が誤った ID を返さないことを検証する。
 * @param {string} id 原文 ID。
 * @param {string} value 原文。
 * @param {string|null} context 文脈。
 * @returns {Object} GlotPress のプレビュー行相当。
 */
function htmlRow( id, value = 'Hello', context = null ) {
	return {
		id: 'preview-' + id + '-141335806',
		querySelector( selector ) {
			if ( selector === '.original-text' ) return { textContent: value };
			if ( selector === '.context' && context ) return { textContent: context };
			return null;
		},
	};
}

function htmlDocument( rows, pagination = false ) {
	return {
		querySelectorAll( selector ) {
			if ( selector === '.paging a' ) {
				return pagination ? [ { getAttribute: () => '?page=2' } ] : [];
			}
			return rows;
		},
		getElementById() { return null; },
	};
}


describe( 'comparison opened from multiple Waiting discovery', () => {
	test( 're-fetches the selected original even when the PO scan is set to Current', async () => {
		const requests = [];
		const events = [];
		const sourceCode = fs.readFileSync(
			path.join( __dirname, '../../src/js/wpgpt-all-page-warnings.js' ), 'utf8'
		);
		const context = vm.createContext( {
			URL,
			wpgpt_settings: { ja_checks: { state: 'enabled' } },
			CustomEvent: class {
				constructor( type, options ) { this.type = type; this.detail = options.detail; }
			},
			document: {
				addEventListener() {},
				dispatchEvent( event ) { events.push( event ); },
			},
			fetch: async ( url, options ) => {
				requests.push( { url, options } );
				return {
					ok: true, status: 200,
					headers: { get: () => 'application/json' },
					json: async () => [ proposal( '1' ), proposal( '2', { user: { user_login: 'bob' } } ) ],
				};
			},
		} );
		vm.runInContext( sourceCode, context );
		const open = vm.runInContext( 'wpgpt_all_page_warnings_open_waiting', context );
		const button = { disabled: false, textContent: '個別比較' };
		await open( { ...result, sourceUrl: source }, button, '22606895' );
		assert.equal( requests.length, 1 );
		const requested = new URL( requests[ 0 ].url );
		assert.equal( requested.searchParams.get( 'filters[original_id]' ), '22606895' );
		assert.equal( requested.searchParams.get( 'filters[status]' ), 'waiting' );
		assert.equal( requests[ 0 ].options.method, 'GET' );
		assert.equal( events.length, 1 );
		assert.equal( events[ 0 ].type, 'wpgpt-waiting-proposals-open' );
		const payload = events[ 0 ].detail.payload;
		assert.equal( payload.id, '22606895' );
		assert.equal( payload.proposals.length, 2 );
		assert.equal( payload.proposals[ 1 ].user.user_login, 'bob' );
	} );
} );

describe( 'Waiting original ID fallback via GlotPress search', () => {
	test( 'search URL uses only Waiting and original filters', () => {
		const api = load();
		const url = new URL( api.searchUrl( source + '?page=5&filters[status]=current', 'Hello' ) );
		assert.equal( url.origin, 'https://translate.wordpress.org' );
		assert.equal( url.pathname, '/projects/wp-plugins/echo-knowledge-base/stable/ja/default/' );
		assert.deepEqual( Array.from( url.searchParams.entries() ), [
			[ 'filters[status]', 'waiting' ],
			[ 'filters[term]', 'Hello' ],
			[ 'filters[term_scope]', 'scope_originals' ],
		] );
		assert.throws( () => api.searchUrl( 'https://example.com/projects/wp-plugins/foo/stable/ja/default/', 'Hello' ), /URL が不正/u );
	} );

	test( 'identifies one original ID across multiple Waiting translation rows', () => {
		const api = load();
		assert.equal( api.searchId( htmlDocument( [ htmlRow( '22606895' ), htmlRow( '22606895' ) ] ), result ), '22606895' );
	} );

	test( 'does not identify different original, Context, missing or paginated rows', () => {
		const api = load();
		for ( const rows of [
			[ htmlRow( '22606895' ), htmlRow( '99999999' ) ],
			[ htmlRow( '22606895', 'Other' ) ],
			[ htmlRow( '22606895', 'Hello', 'button' ) ],
			[],
		] ) {
			assert.equal( api.searchId( htmlDocument( rows ), result ), null );
		}
		assert.equal( api.searchId( htmlDocument( [ htmlRow( '22606895' ) ], true ), result ), null );
	} );

	test( 'fetches search HTML once and does not alter GlotPress UI', async () => {
		let requests = [];
		const html = htmlDocument( [ htmlRow( '22606895' ), htmlRow( '22606895' ) ] );
		const api = load( async ( url, options ) => {
			requests.push( { url, options } );
			return { ok: true, headers: { get: () => 'text/html; charset=utf-8' },
				text: async () => '<html></html>' };
		}, class { parseFromString() { return html; } } );
		assert.equal( await api.findId( source, result ), '22606895' );
		assert.equal( requests.length, 1 );
		assert.equal( requests[ 0 ].options.credentials, 'same-origin' );
		assert.equal( requests[ 0 ].options.redirect, 'error' );
	} );

	test( 'stops after one HTTP 429, non-HTML or inconclusive response', async () => {
		for ( const config of [
			{ ok: false, status: 429, headers: { get: () => 'text/html' } },
			{ ok: true, headers: { get: () => 'application/json' } },
			{ ok: true, headers: { get: () => 'text/html' }, text: async () => '<html></html>' },
		] ) {
			let calls = 0;
			const api = load( async () => { calls++; return config; },
				class { parseFromString() { return htmlDocument( [ htmlRow( '22606895' ) ], true ); } } );
			await assert.rejects( api.findId( source, result ) );
			assert.equal( calls, 1 );
		}
	} );
} );
