'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );

class TestElement {
	constructor( tagName = 'div' ) {
		this.tagName = tagName;
		this.children = [];
		this.attributes = {};
		this.dataset = {};
		this.className = '';
		this.textContent = '';
		this.style = {};
		this.classList = {
			add: ( ...names ) => {
				const current = new Set( this.className.split( /\s+/u ).filter( Boolean ) );
				names.forEach( ( name ) => current.add( name ) );
				this.className = Array.from( current ).join( ' ' );
			},
			contains: ( name ) => this.className.split( /\s+/u ).includes( name ),
			remove: () => {},
		};
	}

	append( ...children ) {
		this.children.push( ...children );
	}

	appendChild( child ) {
		this.children.push( child );
		return child;
	}

	cloneNode() {
		const clone = new TestElement( this.tagName );
		clone.className = this.className;
		clone.textContent = this.textContent;
		clone.dataset = { ...this.dataset };
		clone.attributes = { ...this.attributes };
		return clone;
	}

	setAttribute( name, value ) {
		this.attributes[ name ] = value;
	}

	querySelector() {
		return null;
	}

	querySelectorAll() {
		return [];
	}

	addEventListener() {}

	insertAdjacentElement() {}
}

function createSettings() {
	const settings = {
		custom_period: { state: '' },
		checks: { state: 'disabled' },
		ro_checks: { state: 'disabled' },
		ja_checks: { state: 'enabled' },
		checks_labels: { state: 'disabled' },
		history_main: { state: 'disabled' },
		history_page: { state: 'disabled' },
	};

	[
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
	].forEach( ( key ) => {
		settings[ key ] = { state: 'warning' };
	} );

	return settings;
}

function createDocument() {
	return {
		location: { href: 'https://translate.wordpress.org/projects/test/ja/default/' },
		createElement: ( tagName ) => new TestElement( tagName ),
		querySelector: () => null,
		querySelectorAll: () => [],
	};
}

function normalize( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function loadWpgptChecks() {
	const rootDir = path.resolve( __dirname, '../../..' );
	const context = vm.createContext( {
		console,
		URL,
		window: {
			location: {
				pathname: '/projects/test/ja/default/',
			},
			addEventListener: () => {},
		},
		document: createDocument(),
		wpgpt_settings: createSettings(),
		wpgpt_us_assets: {
			wpgpt_warning_icon: '',
			wpgpt_notice_icon: '',
		},
	} );

	const functionsSource = fs.readFileSync(
		path.join( rootDir, 'src/js/wpgpt-functions.js' ),
		'utf8'
	);
	const checksSource = fs.readFileSync(
		path.join( rootDir, 'src/js/wpgpt-checks.js' ),
		'utf8'
	);

	vm.runInContext( functionsSource, context, {
		filename: 'src/js/wpgpt-functions.js',
	} );
	vm.runInContext( checksSource, context, {
		filename: 'src/js/wpgpt-checks.js',
	} );

	const functionNames = [
		'wpgpt_run_japanese_checks',
		'wpgpt_ja_check_punctuation',
		'wpgpt_ja_check_half_width',
		'wpgpt_ja_check_half_full_spacing',
		'wpgpt_ja_check_parentheses',
		'wpgpt_ja_check_inner_parentheses_spacing',
		'wpgpt_ja_check_period_inside_parentheses',
		'wpgpt_ja_check_sentence_ending_parentheses',
		'wpgpt_ja_check_number_spacing',
		'wpgpt_ja_check_view_expression',
		'wpgpt_ja_check_not_allowed_expression',
		'wpgpt_ja_check_sorry_prefix',
		'wpgpt_ja_check_recommended_expressions',
		'wpgpt_ja_check_middle_dot',
	];

	const api = {};
	functionNames.forEach( ( name ) => {
		if ( typeof context[ name ] !== 'function' ) {
			throw new Error( `Unable to load ${name} from wpgpt-checks.js` );
		}
		api[ name ] = ( ...args ) => normalize( context[ name ]( ...args ) );
	} );

	api.runJapaneseChecks = ( singularOriginal, translated ) => {
		const results = {
			warning: [],
			notice: [],
			highlight_me: [],
		};
		context.wpgpt_run_japanese_checks(
			results,
			singularOriginal,
			translated,
			false
		);
		return {
			warning: results.warning.map( ( item ) => item.textContent ),
			notice: results.notice.map( ( item ) => item.textContent ),
			highlight_me: normalize( results.highlight_me ),
		};
	};

	return api;
}

module.exports = {
	loadWpgptChecks,
};
