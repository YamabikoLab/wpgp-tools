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
		window: { location: { pathname: '/projects/test/ja/default/' }, addEventListener() {} },
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

test( 'Save still blocks warnings unless the user explicitly permits them', () => {
	const f = fixture();
	const ctx = load( f );
	const errors = [];
	ctx.$gp = { notices: { error( message ) { errors.push( message ); } } };
	let checks = 0;
	ctx.wpgpt_check_this_translation = () => {
		checks++;
		return false;
	};
	ctx.wpgpt_editor_init( '#editor-1', '#preview-1' );

	function clickSave() {
		let blocked = false;
		f.save.listeners.click[ 0 ]( {
			preventDefault() { blocked = true; },
			stopPropagation() {},
		} );
		return blocked;
	}

	assert.equal( clickSave(), true, 'warnings block Save by default' );
	assert.equal( errors.length, 1 );
	vm.runInContext( 'wpgpt_next_is_strict = false;', ctx );
	assert.equal( clickSave(), false, 'explicit warning override allows Save' );
	assert.equal( errors.length, 1, 'no additional error when warnings are allowed' );
	assert.equal( checks, 2, 'Save continues to check each attempt' );
	assert.equal( vm.runInContext( 'wpgpt_next_is_strict', ctx ), true, 'override resets after Save' );
} );

test( 'dynamically added editor gets a single Check without handling unrelated nodes', () => {
	const f = fixture();
	const ctx = load( f );
	const callbacks = [];
	ctx.MutationObserver = class {
		constructor( callback ) { callbacks.push( callback ); }
		observe() {}
	};
	ctx.wpgpt_settings.history_main = { state: 'disabled' };
	let checks = 0;
	ctx.wpgpt_check_this_translation = () => { checks++; return true; };
	ctx.wpgpt_mutations();
	assert.equal( callbacks.length, 1 );

	const editorRow = {
		nodeType: 1,
		id: 'editor-1',
		classList: { contains: ( name ) => name === 'editor' },
	};
	const irrelevant = {
		nodeType: 1,
		classList: { contains: () => false },
	};
	callbacks[ 0 ]( [ { addedNodes: [ irrelevant, editorRow ] } ] );
	assert.equal( f.actions.children.length, 1 );
	assert.equal( f.save.listeners.click.length, 1 );
	assert.equal( checks, 1, 'newly added editor receives existing checks' );

	callbacks[ 0 ]( [ { addedNodes: [ editorRow ] } ] );
	assert.equal( f.actions.children.length, 1, 'repeat notifications do not add a second Check' );
	assert.equal( f.save.listeners.click.length, 1, 'Save listener remains single' );
} );

test( 'manual Check still works without a saved preview row', () => {
	const f = fixture();
	f.document.querySelector = ( ( original ) => ( selector ) =>
		selector === '#preview-1' ? null : original( selector )
	)( f.document.querySelector );
	const ctx = load( f );
	const result = element();
	const original = f.editor.querySelector;
	f.editor.querySelector = ( selector ) => {
		if ( selector === '.meta .wpgpt-checks-list' ) return null;
		return original( selector );
	};
	let validations = 0;
	ctx.prepare_checks = ( translation ) => {
		validations++;
		translation.check_results = result;
		translation.ignore_status = 'none';
	};
	ctx.wpgpt_manual_check( '#editor-1', '#preview-1' );
	assert.equal( validations, 1 );
	assert.equal( result.children.length, 1, 'stale guidance is available without a preview' );
	assert.equal( f.editor.wpgptManualCheckValues.length, 2 );
} );

test( 'saving continues to update the saved preview state and filters', () => {
	const f = fixture();
	const ctx = load( f );
	const classes = [];
	const inserted = [];
	let refreshed = 0;
	f.preview.classList.remove = ( ...names ) => classes.push( [ 'remove', ...names ] );
	f.preview.classList.add = ( name ) => classes.push( [ 'add', name ] );
	f.preview.querySelector = ( selector ) => {
		if ( selector === '.actions .action.edit' ) {
			return { insertAdjacentElement( position, node ) { inserted.push( [ position, node ] ); } };
		}
		return null;
	};
	ctx.wpgpt_filters = () => { refreshed++; };
	const result = element();
	const status = element();
	ctx.wpgpt_display_check_results( '#editor-1', '#preview-1', {
		check_results: result,
		ignore_status: 'block',
		preview_class: 'wpgpt-has-warning',
		preview_status: status,
		labels: [],
	}, true );
	assert.equal( f.ignore.style.display, 'block' );
	assert.deepEqual( classes[ 1 ], [ 'add', 'wpgpt-has-warning' ] );
	assert.equal( inserted.length, 1, 'saved preview warning status is updated' );
	assert.equal( inserted[ 0 ][ 1 ], status );
	assert.equal( refreshed, 1, 'saved preview filters are refreshed' );
	assert.equal( result.children.length, 0, 'no manual freshness notice in saved results' );
} );
