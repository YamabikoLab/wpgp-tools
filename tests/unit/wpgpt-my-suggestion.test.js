'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { test } = require( 'node:test' );

function load( document ) {
	const context = vm.createContext( {
		URL,
		document,
		window: { location: { href: 'https://translate.wordpress.org/projects/test/ja/default/' } },
		MutationObserver: class { observe() {} },
	} );
	vm.runInContext( fs.readFileSync(
		path.resolve( __dirname, '../../src/js/wpgpt-my-suggestion.js' ), 'utf8'
	), context );
	return context;
}

function link( href ) {
	return { href };
}

function fixture( { user = 'alice', author = 'alice', status = 'waiting', editorStatus = status } = {} ) {
	const labels = [];
	const cell = {
		querySelectorAll: () => labels,
		appendChild( label ) {
			label.remove = () => labels.splice( labels.indexOf( label ), 1 );
			labels.push( label );
		},
	};
	const field = {
		querySelector: ( selector ) => 'dt' === selector ? { textContent: 'Translated by:' } : null,
		querySelectorAll: () => author ? [ link( 'https://profiles.wordpress.org/' + author + '/' ) ] : [],
	};
	const editor = {
		classList: { contains: ( value ) => value === editorStatus },
		querySelectorAll: () => [ field ],
	};
	const preview = {
		id: 'preview-123',
		classList: { contains: ( value ) => value === status },
		querySelector: () => cell,
	};
	const menu = user ? {
		querySelectorAll: () => [ link( 'https://profiles.wordpress.org/' + user + '/' ) ],
	} : null;
	const document = {
		readyState: 'loading',
		addEventListener() {},
		querySelector( selector ) {
			return '#wp-admin-bar-my-account' === selector ? menu : null;
		},
		querySelectorAll: () => [ preview ],
		getElementById: ( id ) => 'editor-123' === id ? editor : null,
		createElement: () => ( {} ),
	};
	return { document, labels, preview, editor, field, cell };
}

test( 'profile URLs require a single WordPress.org account slug', () => {
	const ctx = load( fixture().document );
	assert.equal( ctx.wpgpt_my_suggestion_profile( 'https://profiles.wordpress.org/Alice/' ), 'alice' );
	assert.equal( ctx.wpgpt_my_suggestion_profile( 'https://evil.example/alice/' ), null );
	assert.equal( ctx.wpgpt_my_suggestion_profile( 'https://profiles.wordpress.org/alice/activity/' ), null );
});

test( 'only own Waiting row is marked and repeated scans do not duplicate labels', () => {
	const f = fixture();
	const ctx = load( f.document );
	ctx.wpgpt_my_suggestion_sync();
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 1 );
	assert.equal( f.labels[ 0 ].textContent, 'My suggestion' );
});

test( 'other authors, missing identity, and non-Waiting do not receive labels', () => {
	for ( const options of [ { author: 'bob' }, { author: null }, { user: null },
		{ status: 'current' }, { editorStatus: 'current' } ] ) {
		const f = fixture( options );
		load( f.document ).wpgpt_my_suggestion_sync();
		assert.equal( f.labels.length, 0 );
	}
});

test( 'a matching row that changes status or author loses its old label', () => {
	const f = fixture();
	const ctx = load( f.document );
	ctx.wpgpt_my_suggestion_sync();
	f.preview.classList.contains = () => false;
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
	f.preview.classList.contains = ( value ) => 'waiting' === value;
	f.field.querySelectorAll = () => [ link( 'https://profiles.wordpress.org/bob/' ) ];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
});

test( 'only author in matching editor is used, never another row', () => {
	const f = fixture( { author: 'bob' } );
	f.document.getElementById = ( id ) => 'editor-999' === id ? f.editor : null;
	load( f.document ).wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
});

test( 'ambiguous signed-in profile and multiple author links are not trusted', () => {
	const f = fixture();
	const ctx = load( f.document );
	f.document.querySelector( '#wp-admin-bar-my-account' ).querySelectorAll = () => [
		link( 'https://profiles.wordpress.org/alice/' ),
		link( 'https://profiles.wordpress.org/bob/' ),
	];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
	f.document.querySelector( '#wp-admin-bar-my-account' ).querySelectorAll = () => [
		link( 'https://profiles.wordpress.org/alice/' ),
	];
	f.field.querySelectorAll = () => [
		link( 'https://profiles.wordpress.org/alice/' ),
		link( 'https://profiles.wordpress.org/bob/' ),
	];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
});
