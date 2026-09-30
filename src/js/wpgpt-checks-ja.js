// Japanese locale-specific translation checks.

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

function wpgpt_check_japanese_punctuation( results, translated ) {
	const matches = translated.match( /[一-龯ぁ-んァ-ヶー][,.]/g ) || [];
	if ( ! matches.length ) {
		return;
	}

	const msg = document.createElement( 'li' );
	msg.textContent = 'Use Japanese punctuation (、。) after Japanese text instead of half-width comma or period.';
	results.warning.push( msg );
	matches.forEach( ( match ) => results.highlight_me.push( match ) );
}

function wpgpt_check_japanese_spacing( results, translated ) {
	const japanese = '[一-龯ぁ-んァ-ヶー]';
	const ascii = '[A-Za-z0-9!"#$%&\\'()*+,\\-./:;<=>?@\\[\\]\\\\^_`{|}~]';
	const pattern = new RegExp( `(?:${japanese} +${ascii}|${ascii} +${japanese})`, 'g' );
	const matches = translated.match( pattern ) || [];

	if ( ! matches.length ) {
		return;
	}

	const msg = document.createElement( 'li' );
	msg.textContent = 'Remove unnecessary spaces between Japanese text and half-width alphanumeric characters or symbols.';
	results.warning.push( msg );
	matches.forEach( ( match ) => results.highlight_me.push( match ) );
}

function wpgpt_check_japanese_sorry( results, original, translated ) {
	if ( ! /\\bSorry\\b/i.test( original ) || /\\bSorry\\b/i.test( translated ) ) {
		return;
	}

	const msg = document.createElement( 'li' );
	msg.textContent = 'Keep "Sorry" untranslated according to the Japanese translation style guide.';
	results.warning.push( msg );
}
