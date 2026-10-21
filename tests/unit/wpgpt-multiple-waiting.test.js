/**
 * 複数 Waiting の集約、終端判定、途中停止の契約を検証する。
 * 実サイトへの通信や操作は行わず、API の各応答を模した情報で確認する。
 */
'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { describe, test } = require( 'node:test' );

const src = fs.readFileSync( path.join( __dirname, '../../src/js/wpgpt-multiple-waiting.js' ), 'utf8' );
const setUrl = 'https://translate.wordpress.org/projects/wp-plugins/example/stable/ja/default/';
const row = ( id, originalId = 10, extra = {} ) => ( {
	id, original_id: originalId, translation_status: 'waiting',
	singular: 'Hello', context: null, plural: null,
	translations: [ 'こんにちは' ], user: { user_login: 'tester' }, ...extra,
} );

function load( responses = [], check = ( original, translated ) => ( {
	warning: translated.includes( '!' ) ? [ { textContent: '警告' } ] : [],
} ), schedule = ( fn ) => { fn(); return 1; } ) {
	const urls = [];
	let index = 0;
	const context = {
		URL, AbortController, module: { exports: {} }, setTimeout: schedule,
		clearTimeout() {},
		location: new URL( setUrl ),
		document: { addEventListener() {}, querySelector: () => null,
			createElement: () => ( { textContent: '', className: '', type: '', disabled: false,
				append() {}, appendChild() {}, addEventListener() {}, setAttribute() {} } ),
		},
		wpgpt_run_checks: check,
		wpgpt_all_page_warnings_waiting_busy: () => false,
		wpgpt_all_page_warnings_waiting_api_url: () => setUrl,
		fetch: async ( url, options ) => {
			urls.push( { url, options } );
			const value = responses[ index++ ];
			if ( value instanceof Error ) throw value;
			return value || {
				ok: true, status: 200, headers: { get: () => 'application/json' },
				json: async () => [],
			};
		},
	};
	vm.runInNewContext( src, context );
	const api = context.module.exports;
	const ui = {
		start: { disabled: true }, stop: { disabled: false }, warning: { checked: false },
		info: { textContent: '' }, qualification: { textContent: '' },
		results: { replaceChildren() {}, appendChild() {} },
		page: { textContent: '' }, prev: { disabled: false }, next: { disabled: false },
	};
	api.setUI( ui );
	return { api, urls, ui };
}
const response = ( rows, status = 200, type = 'application/json' ) => ( {
	ok: status === 200, status,
	headers: { get: () => type },
	json: async () => rows,
} );

describe( 'multiple Waiting aggregation', () => {
	test( 'finds proposals separated by pages and retains zero-Warning groups', () => {
		const { api } = load();
		api.ingest( [ row( 1 ), row( 3, 20 ) ] );
		assert.equal( api.visible().length, 0 );
		api.ingest( [ row( 2 ) ] );
		assert.equal( api.visible().length, 1 );
		assert.equal( api.visible()[ 0 ].proposals.size, 2 );
		assert.equal( api.visible()[ 0 ].proposals.get( '1' ).warnings, 0 );
	} );

	test( 'counts Warning per proposal with the shared checker', () => {
		const { api } = load();
		api.ingest( [ row( 1, 10, { translations: [ '!' ] } ), row( 2 ) ] );
		assert.equal( api.visible()[ 0 ].proposals.get( '1' ).warnings, 1 );
		assert.equal( api.visible()[ 0 ].proposals.get( '2' ).warnings, 0 );
	} );

	test( 'deduplicates same ID without creating a false multiple result', () => {
		const { api } = load();
		api.ingest( [ row( 1 ) ] );
		api.ingest( [ row( 1 ) ] );
		assert.equal( api.visible().length, 0 );
		assert.equal( api.stats.duplicates, 1 );
	} );



	// Warning は訳文フォームごとに元のルール設定で判定し、複数形の原文対応を保つ。
	test( 'checks singular and plural forms separately without losing proposal identity', () => {
		const calls = [];
		const { api } = load( [], ( original, translated, disabled, singular ) => {
			calls.push( [ original, translated, singular ] );
			return { warning: translated === '警告!' ? [ {} ] : [] };
		} );
		api.ingest( [ row( 1, 10, { singular: 'One file', plural: '%d files',
			translations: [ 'ファイル', '警告!' ] } ), row( 2, 10, { singular: 'One file',
			plural: '%d files', translations: [ 'ファイル', 'ファイルたち' ] } ) ] );
		assert.equal( api.visible().length, 1 );
		assert.equal( api.visible()[ 0 ].proposals.get( '1' ).warnings, 1 );
		assert.equal( api.visible()[ 0 ].proposals.get( '2' ).warnings, 0 );
		assert.deepEqual( calls[ 0 ], [ 'One file', 'ファイル', 'One file' ] );
		assert.deepEqual( calls[ 1 ], [ '%d files', '警告!', 'One file' ] );
	} );

	test( 'treats repeated IDs within the same page as one proposal', () => {
		const { api } = load();
		api.ingest( [ row( 1 ), row( 1 ) ] );
		assert.equal( api.groups.get( '10' ).proposals.size, 1 );
		assert.equal( api.stats.duplicates, 1 );
		assert.equal( api.visible().length, 0 );
	} );

	test( 'rejects inconsistent IDs or original metadata without partial page ingestion', () => {
		const { api } = load();
		api.ingest( [ row( 1 ) ] );
		assert.throws( () => api.ingest( [ row( 2 ), row( 1, 10, { translations: [ '変更' ] } ) ] ),
			/同一翻訳 ID/u );
		assert.equal( api.groups.get( '10' ).proposals.size, 1 );
		assert.throws( () => api.ingest( [ row( 2, 10, { context: 'different' } ) ] ),
			/Context/u );
		assert.throws( () => api.ingest( [ row( 3, 10, { translation_status: 'current' } ) ] ),
			/不正/u );
	} );
} );

describe( 'multiple Waiting scan lifecycle', () => {
	test( 'continues after short pages and ends only after an empty JSON array', async () => {
		const { api, urls } = load( [ response( [ row( 1 ) ] ), response( [ row( 2 ) ] ), response( [] ) ] );
		await api.scan( new AbortController().signal );
		assert.equal( api.stats.outcome, '走査終了（空ページ確認）' );
		assert.equal( api.stats.pages, 3 );
		assert.equal( api.visible().length, 1 );
		assert.equal( urls.length, 3 );
		for ( let i = 0; i < urls.length; i++ ) {
			const url = new URL( urls[ i ].url );
			assert.equal( url.searchParams.get( 'sort[by]' ), 'translation_date_added' );
			assert.equal( url.searchParams.get( 'sort[how]' ), 'asc' );
			assert.equal( url.searchParams.get( 'page' ), String( i + 1 ) );
			assert.equal( urls[ i ].options.method, 'GET' );
		}
	} );

	test( '429 stops immediately and retains already collected partial results', async () => {
		const { api, urls } = load( [ response( [ row( 1 ), row( 2 ) ] ), response( [], 429 ) ] );
		await api.scan( new AbortController().signal );
		assert.match( api.stats.outcome, /途中結果：HTTP 429/u );
		assert.equal( api.stats.pages, 1 );
		assert.equal( api.visible().length, 1 );
		assert.equal( urls.length, 2 );
	} );

	test( 'invalid JSON shape and 403 stop without retry', async () => {
		for ( const failure of [ response( {} ), response( [], 403 ), response( [], 200, 'text/html' ) ] ) {
			const { api, urls } = load( [ failure ] );
			await api.scan( new AbortController().signal );
			assert.match( api.stats.outcome, /途中結果/u );
			assert.equal( api.stats.pages, 0 );
			assert.equal( urls.length, 1 );
		}
	} );



	test( 'keeps results provisional when the page ceiling is reached without an empty response', async () => {
		const pages = Array.from( { length: 50 }, ( _, index ) => response( [ row( index + 1 ) ] ) );
		const { api, urls } = load( pages );
		await api.scan( new AbortController().signal );
		assert.equal( urls.length, 50 );
		assert.equal( api.stats.pages, 50 );
		assert.match( api.stats.outcome, /途中結果：最大ページ数/u );
		assert.equal( api.visible().length, 1 );
	} );

	test( 'resets previous results and prevents simultaneous searches', async () => {
		let release;
		const pending = new Promise( ( resolve ) => { release = resolve; } );
		const { api, urls, ui } = load( [ pending, response( [] ) ] );
		api.ingest( [ row( 1 ), row( 2 ) ] );
		api.start();
		api.start();
		assert.equal( api.visible().length, 0 );
		assert.equal( urls.length, 1 );
		assert.equal( ui.start.disabled, true );
		release( response( [] ) );
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( ui.start.disabled, false );
		api.start();
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( urls.length, 2 );
		assert.equal( api.stats.outcome, '走査終了（空ページ確認）' );
	} );

	test( 'Warning-only choice filters results without narrowing API acquisition', async () => {
		const { api, urls, ui } = load( [ response( [
			row( 1, 10, { translations: [ '!' ] } ), row( 2, 10 ),
			row( 3, 20 ), row( 4, 20 ),
		] ), response( [] ) ] );
		ui.warning.checked = true;
		api.start();
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( api.visible().length, 1 );
		assert.equal( api.visible()[ 0 ].originalId, '10' );
		assert.equal( api.groups.get( '20' ).proposals.size, 2 );
		assert.equal( urls.length, 2 );
	} );

	test( 'cancellation during the page interval prevents the next request', async () => {
		let waiting;
		const schedule = ( callback, delay ) => {
			waiting = { callback, delay };
			return 1;
		};
		const controller = new AbortController();
		const { api, urls } = load( [ response( [ row( 1 ) ] ), response( [ row( 2 ) ] ) ],
			undefined, schedule );
		const request = api.scan( controller.signal );
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( waiting.delay, 1000 );
		assert.equal( urls.length, 1 );
		controller.abort();
		await request;
		assert.equal( urls.length, 1 );
		assert.match( api.stats.outcome, /中止/u );
	} );

	test( 'does not send a GET after user aborts during first response', async () => {
		const controller = new AbortController();
		const { api, urls } = load( [ {
			ok: true, status: 200, headers: { get: () => 'application/json' },
			json: async () => { controller.abort(); return [ row( 1 ) ]; },
		} ] );
		await api.scan( controller.signal );
		assert.equal( urls.length, 1 );
		assert.equal( api.stats.pages, 0 );
		assert.match( api.stats.outcome, /中止/u );
	} );
} );
