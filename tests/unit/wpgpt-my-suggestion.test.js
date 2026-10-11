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

test( 'profile identity rejects malformed, insecure, and non-account destinations', () => {
	const ctx = load( fixture().document );
	for ( const href of [
		'http://profiles.wordpress.org/alice/',
		'https://profiles.wordpress.org.evil.example/alice/',
		'https://profiles.wordpress.org/',
		'https://profiles.wordpress.org/alice%2Fbob/',
		'https://profiles.wordpress.org/alice/bob/',
		'not a valid URL',
	] ) {
		assert.equal( ctx.wpgpt_my_suggestion_profile( href ), null, href );
	}
	assert.equal( ctx.wpgpt_my_suggestion_profile( 'https://profiles.wordpress.org/ALICE/?tab=activity' ), 'alice' );
});

test( 'unrelated menu links are ignored and repeated identical identities remain valid', () => {
	const f = fixture();
	const ctx = load( f.document );
	const menu = f.document.querySelector( '#wp-admin-bar-my-account' );
	menu.querySelectorAll = () => [
		link( 'https://translate.wordpress.org/' ),
		link( 'https://profiles.wordpress.org/Alice/' ),
		link( 'https://profiles.wordpress.org/alice/' ),
	];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 1 );
});

test( 'author metadata must have exactly one Translated by field with one valid profile', () => {
	const f = fixture();
	const ctx = load( f.document );
	const authorField = f.field;
	const unrelatedField = {
		querySelector: () => ( { textContent: 'Approved by:' } ),
		querySelectorAll: () => [ link( 'https://profiles.wordpress.org/alice/' ) ],
	};
	f.editor.querySelectorAll = () => [ unrelatedField, authorField ];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 1 );

	f.editor.querySelectorAll = () => [ unrelatedField ];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );

	f.editor.querySelectorAll = () => [ authorField, authorField ];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );

	f.editor.querySelectorAll = () => [ authorField ];
	authorField.querySelectorAll = () => [ link( 'https://evil.example/alice/' ) ];
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
});

test( 'duplicate labels are reduced to one and all removed after identity becomes unavailable', () => {
	const f = fixture();
	const ctx = load( f.document );
	ctx.wpgpt_my_suggestion_sync();
	f.cell.appendChild( { className: 'wpgpt-my-suggestion' } );
	f.cell.appendChild( { className: 'wpgpt-my-suggestion' } );
	assert.equal( f.labels.length, 3 );
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 1 );
	f.document.querySelector = () => null;
	ctx.wpgpt_my_suggestion_sync();
	assert.equal( f.labels.length, 0 );
});

test( 'each translation row is evaluated independently, including rows with no translation cell', () => {
	const own = fixture();
	const other = fixture( { author: 'bob' } );
	other.preview.id = 'preview-456';
	const missing = fixture();
	missing.preview.id = 'preview-789';
	missing.preview.querySelector = () => null;
	own.document.querySelectorAll = () => [ own.preview, other.preview, missing.preview ];
	own.document.getElementById = ( id ) => {
		if ( 'editor-123' === id ) return own.editor;
		if ( 'editor-456' === id ) return other.editor;
		if ( 'editor-789' === id ) return missing.editor;
		return null;
	};
	load( own.document ).wpgpt_my_suggestion_sync();
	assert.equal( own.labels.length, 1 );
	assert.equal( other.labels.length, 0 );
	assert.equal( missing.labels.length, 0 );
});

test( 'initialization does nothing without a translation table', () => {
	const f = fixture();
	let observed = 0;
	f.document.querySelector = () => null;
	const ctx = load( f.document );
	ctx.MutationObserver = class {
		observe() { observed++; }
	};
	ctx.wpgpt_my_suggestion_init();
	assert.equal( observed, 0 );
	assert.equal( f.labels.length, 0 );
});

test( 'the observer coalesces changes and updates labels after a status change', async () => {
	const f = fixture();
	f.document.querySelector = ( selector ) => {
		if ( 'table.translations' === selector ) return {};
		if ( '#wp-admin-bar-my-account' === selector ) {
			return { querySelectorAll: () => [ link( 'https://profiles.wordpress.org/alice/' ) ] };
		}
		return null;
	};
	const ctx = load( f.document );
	let notify;
	let observed;
	ctx.MutationObserver = class {
		constructor( callback ) { notify = callback; }
		observe( target, options ) { observed = { target, options }; }
	};
	f.document.body = {};
	ctx.wpgpt_my_suggestion_init();
	assert.equal( f.labels.length, 1 );
	assert.equal( observed.target, f.document.body );
	assert.deepEqual( Array.from( observed.options.attributeFilter ), [ 'class', 'href' ] );
	f.preview.classList.contains = () => false;
	notify();
	notify();
	await Promise.resolve();
	assert.equal( f.labels.length, 0 );
});
