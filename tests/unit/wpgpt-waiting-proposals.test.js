/**
 * Waiting 個別比較で、誤った原文・別翻訳者を表示しないための取得条件と通信境界を検証する。
 * 実ブラウザー通信を模造せず、対象の識別・応答検証・エラー条件を保護する。
 */
'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { describe, test } = require( 'node:test' );

function load( fetchImpl = undefined ) {
	const context = vm.createContext( { URL, fetch: fetchImpl } );
	const source = fs.readFileSync( path.join( __dirname, '../../src/js/wpgpt-all-page-warnings.js' ), 'utf8' );
	vm.runInContext( source, context );
	return vm.runInContext( `({
		visibleId: wpgpt_all_page_warnings_visible_original_id,
		apiUrl: wpgpt_all_page_warnings_waiting_api_url,
		validate: wpgpt_all_page_warnings_validate_proposals,
		get: wpgpt_all_page_warnings_waiting_get
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
	test( 'retains all distinct Waiting translation IDs without consolidating content', () => {
		const api = load();
		const rows = [ proposal( '137070872' ), proposal( '141335806' ) ];
		const values = JSON.parse( JSON.stringify( api.validate( rows, {
			id: '22606895', original: 'Hello', context: null, login: '',
		} ) ) );
		assert.deepEqual( values.map( ( item ) => item.id ), [ '137070872', '141335806' ] );
	} );
	test( 'rejects cross-original, status, Context, user and duplicate ID', () => {
		const api = load();
		const expect = { id: '22606895', original: 'Hello', context: null, login: 'alice' };
		for ( const changed of [
			{ original_id: '999' }, { translation_status: 'current' }, { singular: 'Goodbye' },
			{ context: 'menu' }, { user: { user_login: 'bob' } }, { id: 'not-an-id' },
			{ translations: [ 20 ] },
		] ) {
			assert.throws( () => api.validate( [ proposal( '10', changed ) ], expect ), /対象外/u );
		}
		assert.throws( () => api.validate( [ proposal( '10' ), proposal( '10' ) ], expect ), /重複/u );
	} );
	test( 'retains empty and single proposal responses independently', () => {
		const api = load();
		const expected = { id: '22606895', original: 'Hello', context: null, login: '' };
		assert.equal( api.validate( [], expected ).length, 0 );
		assert.equal( api.validate( [ proposal( '10' ) ], expected ).length, 1 );
	} );
} );
