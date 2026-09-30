// Japanese locale-specific translation checks.
// Rule behavior is adapted from YamabikoLab/wp-translation-checker.

const WPGPT_JA_JAPANESE_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const WPGPT_JA_ASCII_NON_DIGIT = /[\x21-\x2F\x3A-\x7E]/;
const WPGPT_JA_NO_SPACE_PUNCTUATION = new Set( [ '『', '』', '「', '」', '。', '、' ] );
const WPGPT_JA_APOLOGY_PREFIXES = [
	'すみませんが',
	'すみません',
	'申し訳ございません',
	'申し訳ありません',
	'ごめんなさい',
];

function wpgpt_is_japanese_locale() {
	return window.location.pathname.split( '/' ).includes( 'ja' );
}

function wpgpt_run_japanese_checks( results, original, translated ) {
	if ( ! wpgpt_is_japanese_locale() ) {
		return;
	}

	wpgpt_check_japanese_punctuation( results, translated );
	wpgpt_check_japanese_spacing( results, translated );
	wpgpt_check_japanese_sorry( results, original, translated );
}

function wpgpt_ja_protect_technical_text( text ) {
	const protected_indexes = new Set();
	const patterns = [
		/https?:\/\/[^\s]+/giu,
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
		/<[^>]+>/gu,
		/\{\{\/?[A-Za-z][A-Za-z0-9_-]*\}\}/gu,
		/%(?:\d+\$)?s/gu,
		/%\([A-Za-z0-9_.-]+\)s/gu,
		/(?:[A-Za-z_][A-Za-z0-9_]*|%(?:\d+\$)?s)\(\)/gu,
		/`[^`]+`/gu,
		/(?:[A-Z]:\\|\/(?![A-Za-z][A-Za-z0-9_-]*>))\S+/giu,
	];

	patterns.forEach( ( pattern ) => {
		for ( const match of text.matchAll( pattern ) ) {
			for ( let index = match.index; index < match.index + match[ 0 ].length; index++ ) {
				protected_indexes.add( index );
			}
		}
	} );

	return protected_indexes;
}

function wpgpt_ja_is_numeric_full_width_punctuation( text, index ) {
	const character = text[ index ];
	if ( '，' !== character && '．' !== character ) {
		return false;
	}

	const numeric_character = /[0-9０-９]/u;
	return numeric_character.test( text[ index - 1 ] || '' ) &&
		numeric_character.test( text[ index + 1 ] || '' );
}

function wpgpt_ja_add_warning( results, message, highlights = [] ) {
	const msg = document.createElement( 'li' );
	msg.textContent = message;
	results.warning.push( msg );
	highlights.forEach( ( highlight ) => results.highlight_me.push( highlight ) );
}

function wpgpt_check_japanese_punctuation( results, translated ) {
	const protected_indexes = wpgpt_ja_protect_technical_text( translated );
	const matches = [];

	for ( let index = 0; index < translated.length; index++ ) {
		if ( protected_indexes.has( index ) ) {
			continue;
		}

		const character = translated[ index ];
		if (
			[ '，', '．', '､', '｡' ].includes( character ) &&
			! wpgpt_ja_is_numeric_full_width_punctuation( translated, index )
		) {
			matches.push( character );
		}
	}

	if ( matches.length ) {
		wpgpt_ja_add_warning(
			results,
			'Use Japanese punctuation (、。).',
			matches
		);
	}
}

function wpgpt_check_japanese_spacing( results, translated ) {
	const protected_indexes = wpgpt_ja_protect_technical_text( translated );
	const spacing_characters = new Set( [ ' ', '\u00a0', '　' ] );
	const spacing_text = translated.replace( /%\d*\$?d/gu, ( value ) => '0'.repeat( value.length ) );

	for ( let index = 0; index < spacing_text.length - 1; index++ ) {
		if ( protected_indexes.has( index ) ) {
			continue;
		}

		const left = spacing_text[ index ] || '';
		let right_index = index + 1;
		let space_count = 0;
		let invalid_space = false;

		while ( spacing_characters.has( spacing_text[ right_index ] || '' ) ) {
			space_count++;
			invalid_space = invalid_space || ' ' !== spacing_text[ right_index ];
			right_index++;
		}

		if ( protected_indexes.has( right_index ) ) {
			continue;
		}

		const right = spacing_text[ right_index ] || '';
		if (
			'(' === left || ')' === right || ')' === left || '(' === right ||
			':' === left || ':' === right ||
			WPGPT_JA_NO_SPACE_PUNCTUATION.has( left ) ||
			WPGPT_JA_NO_SPACE_PUNCTUATION.has( right ) ||
			[ ',', '.', '，', '．', '､', '｡' ].includes( left ) ||
			[ ',', '.', '，', '．', '､', '｡' ].includes( right )
		) {
			continue;
		}

		const left_half = WPGPT_JA_ASCII_NON_DIGIT.test( left ) && ! /\d/.test( left );
		const right_half = WPGPT_JA_ASCII_NON_DIGIT.test( right ) && ! /\d/.test( right );
		const left_japanese = WPGPT_JA_JAPANESE_CHARACTER.test( left );
		const right_japanese = WPGPT_JA_JAPANESE_CHARACTER.test( right );

		if (
			( ( left_half && right_japanese ) || ( left_japanese && right_half ) ) &&
			( 1 !== space_count || invalid_space )
		) {
			const highlight = translated.slice( index, right_index + 1 );
			const message = 0 === space_count
				? `Add one half-width space between "${left}" and "${right}".`
				: `Use exactly one half-width space between "${left}" and "${right}".`;
			wpgpt_ja_add_warning( results, message, [ highlight ] );
			return;
		}
	}
}

function wpgpt_check_japanese_sorry( results, original, translated ) {
	if ( ! /^Sorry,\s*/u.test( original ) ) {
		return;
	}

	const apology_prefix = WPGPT_JA_APOLOGY_PREFIXES.find( ( prefix ) => translated.startsWith( prefix ) );
	if ( apology_prefix ) {
		wpgpt_ja_add_warning(
			results,
			'Remove the Japanese apology corresponding to the leading "Sorry,".',
			[ apology_prefix ]
		);
	}
}
