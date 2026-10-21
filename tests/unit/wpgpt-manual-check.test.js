'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const { test } = require( 'node:test' );

function element( name = 'div' ) {
	const listeners = {};
	const node = {
		tagName: name,
		children: [],
		style: {},
		dataset: {},
		className: '',
		textContent: '',
		hidden: false,
		listeners,
		classList: { add() {}, remove() {} },
		append( ...children ) { this.children.push( ...children ); },
		appendChild( child ) { this.children.push( child ); return child; },
		cloneNode() { return element( name ); },
		addEventListener( type, fn ) { ( listeners[ type ] ||= [] ).push( fn ); },
		dispatch( type, target = this ) { ( listeners[ type ] || [] ).forEach( ( fn ) => fn( { target } ) ); },
		insertBefore( child ) { this.children.push( child ); },
		insertAdjacentElement() {},
		querySelector() { return null; },
		querySelectorAll() { return []; },
	};
	return node;
}

function fixture() {
	const editor = element();
	const preview = element();
	const save = element( 'button' );
	const warning = element();
	const ignore = element();
	const checkbox = element( 'input' );
	const meta = element();
	const inputs = [ { value: '最初', matches: () => true }, { value: '複数形', matches: () => true } ];
	const actions = element();
	save.parentNode = actions;
	warning.querySelector = () => checkbox;
	editor.querySelector = ( selector ) => {
		if ( selector === '.translation-actions__save' ) return save;
		if ( selector === '.meta .wpgpt-checks-list' ) return meta.active || null;
		if ( selector === '.meta dl' ) return meta;
		if ( selector === '.wpgpt-ignore-warnings' ) return ignore;
		return null;
	};
	editor.querySelectorAll = ( selector ) => selector.includes( 'textarea' ) ? inputs : [];
	const document = {
		createElement: element,
		createDocumentFragment: () => element( 'fragment' ),
		querySelector( selector ) {
			if ( selector === '#editor-1' || selector === '#editor-1 ' ) return editor;
			if ( selector === '#preview-1' ) return preview;
			return null;
		},
		querySelectorAll( selector ) {
			if ( selector === '#editor-1 .translation-actions__save, #editor-1 .approve' ) return [ save ];
			return [];
		},
	};
	return { editor, preview, save, warning, checkbox, ignore, inputs, actions, meta, document };
}

function load( f ) {
	const context = vm.createContext( {
		document: f.document,
		window: { location: { pathname: '/projects/test/ja/default/' } },
		wpgpt_settings: { custom_period: { state: '' }, checks_labels: { state: 'disabled' } },
		wpgpt_us_assets: { wpgpt_warning_icon: '', wpgpt_notice_icon: '' },
		$wpgpt_createElement: () => element(),
		$wpgpt_addElement: () => {},
	} );
	vm.runInContext( fs.readFileSync( path.resolve( __dirname, '../../src/js/wpgpt-checks.js' ), 'utf8' ), context );
	context.testFixture = f;
	vm.runInContext( 'approve_with_warnings.querySelector = () => testFixture.checkbox; approve_with_warnings.cloneNode = () => testFixture.warning;', context );
	return context;
}

test( 'Check initializes once and cannot submit or save the form', () => {
	const f = fixture();
	const ctx = load( f );
	let checked = 0;
	let previewUpdates = 0;
	ctx.prepare_checks = ( result ) => {
		checked++;
		result.check_results = element();
	};
	ctx.wpgpt_display_check_results = ( e, p, result, updatePreview ) => {
		assert.equal( updatePreview, false );
		previewUpdates++;
	};
	ctx.wpgpt_editor_init( '#editor-1', '#preview-1' );
	ctx.wpgpt_editor_init( '#editor-1', '#preview-1' );
	assert.equal( f.actions.children.length, 1, 'only one Check button' );
	assert.equal( f.save.listeners.click.length, 1, 'only one Save handler' );
	assert.equal( f.checkbox.listeners.click.length, 1, 'only one warning override handler' );
	const check = f.actions.children[ 0 ];
	assert.equal( check.textContent, 'Check' );
	assert.equal( check.type, 'button' );
	assert.equal( check.listeners.click.length, 1 );
	check.dispatch( 'click' );
	check.dispatch( 'click' );
	assert.equal( checked, 2 );
	assert.equal( previewUpdates, 2 );
	assert.equal( f.inputs[ 0 ].value, '最初' );
	assert.equal( f.inputs[ 1 ].value, '複数形' );
});

test( 'freshness compares every plural textarea even when no warnings exist', () => {
	const f = fixture();
	const ctx = load( f );
	const status = element( 'p' );
	f.editor.querySelector = ( ( original ) => ( selector ) =>
		selector === '.wpgpt-manual-check-stale' ? status : original( selector )
	)( f.editor.querySelector );
	ctx.wpgpt_editor_init( '#editor-1', '#preview-1' );
	f.editor.wpgptManualCheckValues = ctx.wpgpt_editor_values( f.editor );
	ctx.wpgpt_update_manual_check_freshness( f.editor );
	assert.equal( status.hidden, true );
	f.inputs[ 1 ].value = '変更した複数形';
	f.editor.dispatch( 'input', f.inputs[ 1 ] );
	assert.equal( status.hidden, false );
	f.editor.wpgptManualCheckValues = ctx.wpgpt_editor_values( f.editor );
	ctx.wpgpt_update_manual_check_freshness( f.editor );
	assert.equal( status.hidden, true );
	f.inputs[ 0 ].value = '変更した単数形';
	f.editor.dispatch( 'input', f.inputs[ 0 ] );
	assert.equal( status.hidden, false );
});

test( 'editor check only updates the editor result, not the saved preview', () => {
	const f = fixture();
	const ctx = load( f );
	const resultList = element();
	const oldResult = element();
	const parent = element();
	let replaced = 0;
	parent.replaceChild = () => { replaced++; };
	oldResult.parentNode = parent;
	f.editor.querySelector = ( ( original ) => ( selector ) =>
		selector === '.meta .wpgpt-checks-list' ? oldResult : original( selector )
	)( f.editor.querySelector );
	f.preview.classList.remove = () => { throw Error( 'preview modified' ); };
	ctx.wpgpt_display_check_results(
		'#editor-1', '#preview-1',
		{ check_results: resultList, ignore_status: 'block' }, false
	);
	assert.equal( replaced, 1 );
	assert.equal( resultList.children.length, 1 );
	assert.equal( resultList.children[ 0 ].className, 'wpgpt-manual-check-stale' );
	assert.equal( resultList.children[ 0 ].hidden, true );
});
