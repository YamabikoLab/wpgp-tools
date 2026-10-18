/**
 * Waiting 比較画面が日本語指摘と強調位置を表示することを確認する。
 * 実際の翻訳や承認を変更しない DOM の単体テスト。
 */
'use strict';
const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { test } = require( 'node:test' );

class Node {
	constructor( tag, text = '' ) {
		this.tag = tag;
		this.textContent = text;
		this.children = [];
		this.className = '';
		this.attributes = {};
	}
	append( ...items ) { this.children.push( ...items ); }
	appendChild( node ) { this.append( node ); return node; }
	replaceChildren( ...items ) { this.children = items; }
	addEventListener() {}
	setAttribute( name, value ) { this.attributes[ name ] = value; }
}

test( 'Waiting card uses Japanese 1-4 badge and highlights the violating text', async () => {
	const results = new Node( 'div' );
	const status = new Node( 'p' );
	const context = vm.createContext( { URL, console } );
	const document = {
		createElement: ( tag ) => new Node( tag ),
		createTextNode: ( text ) => new Node( '#text', text ),
		getElementById: ( id ) => id === 'waiting-results' ? results : status,
		querySelector: () => null,
	};
	context.document = document;
	context.wpgpt_settings = {
		ja_checks: { state: 'enabled' },
		ja_half_full_spacing: { state: 'warning' },
	};
	context.wpgpt_is_japanese_locale = () => false;
	const message = '「I」と「が」の間に半角スペースを入れてください';
	context.wpgpt_run_checks = () => ( {
		warning: [ { textContent: '1-4 半角文字と全角文字の間のスペース: ' + message } ],
		notice: [],
	} );
	for ( const name of [ 'punctuation', 'half_width', 'half_full_spacing', 'parentheses',
		'inner_parentheses_spacing', 'period_inside_parentheses', 'sentence_ending_parentheses',
		'number_spacing', 'recommended_expressions', 'view_expression', 'not_allowed_expression',
		'sorry_prefix', 'middle_dot' ] ) {
		context[ 'wpgpt_ja_check_' + name ] = name === 'half_full_spacing' ?
			() => [ { setting: 'ja_half_full_spacing', style_guide_item: '1-4 半角文字と全角文字の間のスペース',
				message, matches: [ { start: 1, end: 3 } ] } ] : () => [];
	}
	const root = path.resolve( __dirname, '../../src/js' );
	document.head = {
		append( script ) {
			if ( script.src.endsWith( 'wpgpt-all-page-warnings.js' ) ) {
				vm.runInContext( fs.readFileSync( path.join( root, 'wpgpt-all-page-warnings.js' ), 'utf8' ), context );
			}
			script.onload();
		},
	};
	context.chrome = { runtime: { lastError: null, sendMessage( unused, callback ) {
		callback( { payload: {
			locale: 'ja', original: 'AI did not return a response. Please try again.',
			context: null, login: '', setUrl: 'https://translate.wordpress.org/projects/example/stable/ja/default/',
			settings: [ [ 'ja_checks', 'enabled' ], [ 'ja_half_full_spacing', 'warning' ] ],
			proposals: [ { id: '143760185', user: { user_login: 'echoplugins' },
				translations: [ 'AIが応答を返しませんでした。' ] } ],
		} } );
	} } };
	vm.runInContext( fs.readFileSync( path.join( root, 'wpgpt-waiting-proposals.js' ), 'utf8' ), context );
	await new Promise( ( resolve ) => setImmediate( resolve ) );
	const all = [];
	function walk( node ) {
		all.push( node );
		node.children.forEach( walk );
	}
	walk( results );
	assert.ok( all.some( ( node ) => node.textContent === '1-4' && node.className.includes( '__badge' ) ) );
	assert.ok( all.some( ( node ) => node.tag === 'mark' && node.textContent === 'Iが' ) );
	assert.ok( all.some( ( node ) => node.textContent === 'Warnings' ) );
	assert.ok( all.some( ( node ) => node.textContent === '提案者: echoplugins' ) );
	const actionLabels = all.filter( ( node ) => node.tag === 'a' || node.tag === 'button' ).map( ( node ) => node.textContent );
	assert.ok( actionLabels.includes( 'GlotPressで確認' ) );
	assert.ok( actionLabels.includes( '翻訳スタイルガイド' ) );
	assert.ok( actionLabels.includes( 'この指摘をコピー' ) );
	assert.ok( ! actionLabels.includes( '複数の翻訳提案を確認' ) );
	const glotPress = all.find( ( node ) => node.tag === 'a' && node.textContent === 'GlotPressで確認' );
	assert.match( glotPress.href, /filters%5Btranslation_id%5D=143760185/u );
	assert.match( status.textContent, /読み取り専用/u );
} );
