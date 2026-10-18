/**
 * 拡張機能の専用タブが、別タブの翻訳内容を受け取らないことを確認する。
 * 受信元検証、タブごとの一時情報、一度きりの受領と破棄を保護する。
 */
'use strict';
const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { describe, test } = require( 'node:test' );

function setup() {
	let handleMessage;
	let closed;
	const chrome = {
		runtime: {
			id: 'test-extension',
			getURL: ( file ) => 'chrome-extension://test-extension/' + file,
			onMessage: { addListener: ( listener ) => { handleMessage = listener; } },
		},
		tabs: {
			create: ( options, callback ) => {
				assert.equal( options.url, 'chrome-extension://test-extension/wpgpt-waiting-proposals.html' );
				callback( { id: 10 } );
			},
			onRemoved: { addListener: ( listener ) => { closed = listener; } },
		},
	};
	vm.runInNewContext(
		fs.readFileSync( path.join( __dirname, '../../src/js/wpgpt-waiting-proposals-background.js' ), 'utf8' ),
		{ chrome }
	);
	const send = ( type, sender, payload ) => {
		let response;
		handleMessage( { type, payload }, sender, ( value ) => { response = value; } );
		return response;
	};
	return { send, closed };
}

const source = {
	tab: { id: 3 },
	url: 'https://translate.wordpress.org/projects/wp-plugins/example/stable/ja/default/',
};
const ready = {
	id: 'test-extension',
	tab: { id: 10 },
	url: 'chrome-extension://test-extension/wpgpt-waiting-proposals.html',
};
const payload = {
	setUrl: 'https://translate.wordpress.org/projects/wp-plugins/example/stable/ja/default/',
	original: 'Hello',
	context: null,
	proposals: [],
	settings: [],
};

describe( 'Waiting comparison tab relay', () => {
	test( 'accepts only the translation website and selected extension page', () => {
		const { send } = setup();
		assert.match( send( 'wpgpt-waiting-proposals-open', { ...source, url: 'https://evil.example/' }, payload ).error, /翻訳ページ以外/u );
		assert.equal( send( 'wpgpt-waiting-proposals-open', source, payload ).success, true );
		assert.match( send( 'wpgpt-waiting-proposals-ready', { ...ready, url: 'chrome-extension://test-extension/other.html' } ).error, /受信元/u );
		assert.equal( send( 'wpgpt-waiting-proposals-ready', ready ).payload.original, 'Hello' );
	} );
	test( 'delivers a payload only once and never replays after reload', () => {
		const { send } = setup();
		send( 'wpgpt-waiting-proposals-open', source, payload );
		assert.deepEqual( send( 'wpgpt-waiting-proposals-ready', ready ).payload, payload );
		assert.match( send( 'wpgpt-waiting-proposals-ready', ready ).error, /一時データ/u );
	} );
	test( 'discards pending content when its destination tab closes', () => {
		const { send, closed } = setup();
		send( 'wpgpt-waiting-proposals-open', source, payload );
		closed( 10 );
		assert.match( send( 'wpgpt-waiting-proposals-ready', ready ).error, /一時データ/u );
	} );
	test( 'rejects malformed content before opening a tab', () => {
		const { send } = setup();
		assert.match( send( 'wpgpt-waiting-proposals-open', source, { ...payload, proposals: null } ).error, /不正/u );
		assert.match( send( 'wpgpt-waiting-proposals-open', source, { ...payload, setUrl: 'https://evil.example/projects/a' } ).error, /不正/u );
	} );
} );
