const presets = {
	punctuation: {
		original: 'This is a test.',
		translated: 'これはテストです｡',
	},
	spacing: {
		original: 'Use WordPress.',
		translated: 'WordPressを使用します。',
	},
	sorry: {
		original: 'Sorry, you are not allowed to edit this item.',
		translated: '申し訳ありません。この項目を編集する権限がありません。',
	},
};

const original = document.getElementById( 'original' );
const translated = document.getElementById( 'translated' );
const resultsContainer = document.getElementById( 'results' );

document.querySelectorAll( '[data-preset]' ).forEach( ( button ) => {
	button.addEventListener( 'click', () => {
		const preset = presets[ button.dataset.preset ];
		original.value = preset.original;
		translated.value = preset.translated;
	} );
} );

document.getElementById( 'run-checks' ).addEventListener( 'click', () => {
	const results = {
		warning: [],
		notice: [],
		highlight_me: [],
	};

	wpgpt_check_japanese_punctuation( results, translated.value );
	wpgpt_check_japanese_spacing( results, translated.value );
	wpgpt_check_japanese_sorry( results, original.value, translated.value );

	resultsContainer.replaceChildren();

	if ( 0 === results.warning.length ) {
		const passed = document.createElement( 'p' );
		passed.className = 'pass';
		passed.textContent = 'No Japanese check warnings.';
		resultsContainer.appendChild( passed );
		return;
	}

	const heading = document.createElement( 'h2' );
	heading.textContent = 'Warnings';
	resultsContainer.appendChild( heading );

	const warnings = document.createElement( 'ul' );
	results.warning.forEach( ( warning ) => {
		const item = document.createElement( 'li' );
		item.textContent = warning.textContent;
		warnings.appendChild( item );
	} );
	resultsContainer.appendChild( warnings );

	if ( results.highlight_me.length ) {
		const highlightHeading = document.createElement( 'h2' );
		highlightHeading.textContent = 'Highlights';
		resultsContainer.appendChild( highlightHeading );

		const highlights = document.createElement( 'ul' );
		results.highlight_me.forEach( ( highlight ) => {
			const item = document.createElement( 'li' );
			item.textContent = highlight;
			highlights.appendChild( item );
		} );
		resultsContainer.appendChild( highlights );
	}
} );
