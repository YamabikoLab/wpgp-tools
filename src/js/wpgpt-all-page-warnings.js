/* YamabikoLab: all-page Warning scan for GlotPress translation lists. */

const WPGPT_ALL_PAGE_WARNING_RULES = [
	{ setting: 'ja_punctuation', label: '1-1 日本語の句読点' },
	{ setting: 'ja_half_width', label: '1-2 英数字・記号の半角表記' },
	{ setting: 'ja_half_full_spacing', label: '1-4 半角文字と全角文字の間のスペース' },
	{ setting: 'ja_parentheses', label: '1-5 半角丸括弧と前後スペース' },
	{ setting: 'ja_inner_parentheses_spacing', label: '1-6 丸括弧内側の不要スペース' },
	{ setting: 'ja_period_inside_parentheses', label: '1-7 括弧内末尾の句点' },
	{ setting: 'ja_sentence_ending_parentheses', label: '1-8 文末括弧と句点の位置' },
	{ setting: 'ja_number_spacing', label: '1-9 半角数字前後の不要スペース' },
	{ setting: 'ja_view_expression', label: '3-2 「View XX」の訳し方' },
	{ setting: 'ja_not_allowed_expression', label: '3-3 「not allowed to」の権限表現' },
	{ setting: 'ja_sorry_prefix', label: '3-4 「Sorry, ...」の Sorry を訳さない' },
	{ setting: 'ja_recommended_expressions', label: '3-6 推奨表記' },
	{ setting: 'ja_middle_dot', label: '5 中点「・」' },
];

function wpgpt_create_dirty_tracker() {
	const baselines = new Map();
	const currentValues = new Map();

	return {
		register( key, value ) {
			if ( ! baselines.has( key ) ) {
				baselines.set( key, value );
			}
			currentValues.set( key, value );
		},
		update( key, value ) {
			if ( ! baselines.has( key ) ) {
				baselines.set( key, value );
			}
			currentValues.set( key, value );
		},
		markSaved( key, value ) {
			baselines.set( key, value );
			currentValues.set( key, value );
		},
		isDirty( key ) {
			return baselines.has( key ) && currentValues.get( key ) !== baselines.get( key );
		},
		hasDirty() {
			for ( const key of baselines.keys() ) {
				if ( this.isDirty( key ) ) {
					return true;
				}
			}
			return false;
		},
		dirtyKeys() {
			return Array.from( baselines.keys() ).filter( ( key ) => this.isDirty( key ) );
		},
		baseline( key ) {
			return baselines.get( key );
		},
	};
}

function wpgpt_all_page_warnings_filter_results( results, selectedRules ) {
	if ( ! selectedRules || 0 === selectedRules.size ) {
		return results.map( ( result ) => ( {
			...result,
			displayWarnings: result.warnings,
		} ) );
	}

	return results.reduce( ( filtered, result ) => {
		const matching = result.japaneseFindings.filter( ( finding ) => selectedRules.has( finding.setting ) );
		if ( matching.length ) {
			filtered.push( {
				...result,
				displayWarnings: matching.map( ( finding ) => ( {
					text: finding.style_guide_item + ': ' + finding.message,
					form: finding.form,
					setting: finding.setting,
					styleGuideItem: finding.style_guide_item,
				} ) ),
			} );
		}
		return filtered;
	}, [] );
}

function wpgpt_all_page_warnings_summarize( results ) {
	return {
		warnings: results.reduce( ( total, result ) => total + result.displayWarnings.length, 0 ),
		strings: results.length,
	};
}

function wpgpt_all_page_warnings_paginate( results, page, pageSize ) {
	const totalPages = Math.max( 1, Math.ceil( results.length / pageSize ) );
	const safePage = Math.min( Math.max( 1, page ), totalPages );
	const start = ( safePage - 1 ) * pageSize;

	return {
		page: safePage,
		totalPages,
		start,
		items: results.slice( start, start + pageSize ),
	};
}

function wpgpt_all_page_warnings_collect_japanese_findings( singularOriginal, translated, form = 1 ) {
	if (
		'enabled' !== wpgpt_settings.ja_checks.state ||
		! wpgpt_is_japanese_locale()
	) {
		return [];
	}

	const findings = [
		...wpgpt_ja_check_punctuation( translated ),
		...wpgpt_ja_check_half_width( translated ),
		...wpgpt_ja_check_half_full_spacing( translated ),
		...wpgpt_ja_check_parentheses( translated ),
		...wpgpt_ja_check_inner_parentheses_spacing( translated ),
		...wpgpt_ja_check_period_inside_parentheses( translated ),
		...wpgpt_ja_check_sentence_ending_parentheses( translated ),
		...wpgpt_ja_check_number_spacing( translated ),
		...wpgpt_ja_check_recommended_expressions( translated ),
		...wpgpt_ja_check_view_expression( singularOriginal, translated ),
		...wpgpt_ja_check_not_allowed_expression( singularOriginal, translated ),
		...wpgpt_ja_check_sorry_prefix( singularOriginal, translated ),
		...wpgpt_ja_check_middle_dot( translated ),
	];

	return findings
		.filter( ( finding ) => 'warning' === wpgpt_settings[ finding.setting ]?.state )
		.map( ( finding ) => ( {
			setting: finding.setting,
			style_guide_item: finding.style_guide_item,
			message: finding.message,
			form,
		} ) );
}

function wpgpt_all_page_warnings_normalize_url( href, base = window.location.href ) {
	const url = new URL( href, base );
	url.hash = '';
	return url.href;
}

function wpgpt_all_page_warnings_paging_url( pageDocument, direction, baseUrl ) {
	const selector = 'previous' === direction ? '.paging a.previous' : '.paging a.next';
	const link = pageDocument.querySelector( selector );
	return link ? wpgpt_all_page_warnings_normalize_url( link.getAttribute( 'href' ), baseUrl ) : null;
}

async function wpgpt_all_page_warnings_fetch_page( url ) {
	const response = await fetch( url, {
		credentials: 'same-origin',
		headers: new Headers( { 'X-Requested-With': 'XMLHttpRequest' } ),
	} );

	if ( ! response.ok ) {
		throw new Error( 'HTTP ' + response.status + ' while loading ' + url );
	}

	const html = await response.text();
	const parsed = new DOMParser().parseFromString( html, 'text/html' );
	if ( ! parsed.querySelector( '#translations tbody' ) ) {
		throw new Error( 'The response did not contain a GlotPress translations table.' );
	}

	return {
		url,
		document: parsed,
	};
}

function wpgpt_all_page_warnings_extract_string( preview, pageDocument, pageNumber, pageUrl ) {
	if ( preview.classList.contains( 'untranslated' ) ) {
		return null;
	}

	const editorId = preview.id.replace( 'preview', 'editor' );
	const editor = pageDocument.getElementById( editorId );
	if ( ! editor ) {
		return null;
	}

	const originalForms = Array.from(
		editor.querySelectorAll( '.source-string.strings div .original-raw' ),
		( form ) => form.textContent
	);
	const translatedForms = Array.from(
		editor.querySelectorAll( '.translation-wrapper div.textareas textarea' ),
		( form ) => form.value
	);

	if ( ! originalForms.length || ! translatedForms.length ) {
		return null;
	}

	let originalFormIndex = 0;
	if ( 2 === originalForms.length && 1 === translatedForms.length ) {
		originalFormIndex = 1;
	}

	const warnings = [];
	const japaneseFindings = [];
	const singularOriginal = originalForms[ 0 ] || originalForms[ originalFormIndex ];

	translatedForms.forEach( ( translated, translatedIndex ) => {
		const original = originalForms[ originalFormIndex ];
		const checks = wpgpt_run_checks( original, translated, false, singularOriginal );
		checks.warning.forEach( ( warning ) => {
			warnings.push( {
				text: warning.textContent,
				form: translatedIndex + 1,
				setting: null,
				styleGuideItem: null,
			} );
		} );
		japaneseFindings.push(
			...wpgpt_all_page_warnings_collect_japanese_findings(
				singularOriginal,
				translated,
				translatedIndex + 1
			)
		);

		if ( 2 === originalForms.length ) {
			originalFormIndex = 1;
		}
	} );

	if ( ! warnings.length ) {
		return null;
	}

	const idParts = preview.id.split( '-' );
	return {
		id: idParts[ 1 ] || preview.id,
		previewId: preview.id,
		page: pageNumber,
		pageUrl,
		original: originalForms.join( '\n' ),
		translations: translatedForms,
		warnings,
		japaneseFindings,
	};
}

function wpgpt_all_page_warnings_analyze_page( page ) {
	const current = page.document.querySelector( '.paging .current' );
	const pageNumber = current ? Number.parseInt( current.textContent, 10 ) || 1 : 1;
	const results = [];

	page.document.querySelectorAll( '#translations tbody tr.preview' ).forEach( ( preview ) => {
		const result = wpgpt_all_page_warnings_extract_string(
			preview,
			page.document,
			pageNumber,
			page.url
		);
		if ( result ) {
			results.push( result );
		}
	} );

	return results;
}

function wpgpt_all_page_warnings_create_element( tagName, className, text ) {
	const element = document.createElement( tagName );
	if ( className ) {
		element.className = className;
	}
	if ( undefined !== text ) {
		element.textContent = text;
	}
	return element;
}

const wpgptAllPageWarningsState = {
	results: [],
	selectedRules: new Set(),
	page: 1,
	pageSize: 25,
	scanning: false,
	checkedPages: 0,
	warningCount: 0,
	dirtyTracker: wpgpt_create_dirty_tracker(),
	pendingSaves: new Map(),
	ui: {},
};

function wpgpt_all_page_warnings_textarea_key( textarea ) {
	const editor = textarea.closest( 'tr.editor' );
	if ( ! editor?.id ) {
		return null;
	}
	const textareas = Array.from( editor.querySelectorAll( '.translation-wrapper div.textareas textarea' ) );
	return editor.id + '::' + textareas.indexOf( textarea );
}

function wpgpt_all_page_warnings_register_textareas( root = document ) {
	root.querySelectorAll( '#translations tbody tr.editor .translation-wrapper div.textareas textarea' ).forEach( ( textarea ) => {
		const key = wpgpt_all_page_warnings_textarea_key( textarea );
		if ( key ) {
			wpgptAllPageWarningsState.dirtyTracker.register( key, textarea.value );
		}
	} );
}

function wpgpt_all_page_warnings_capture_save( button ) {
	const editor = button.closest( 'tr.editor' );
	if ( ! editor?.id ) {
		return;
	}

	const forms = Array.from(
		editor.querySelectorAll( '.translation-wrapper div.textareas textarea' ),
		( textarea ) => ( {
			key: wpgpt_all_page_warnings_textarea_key( textarea ),
			value: textarea.value,
		} )
	).filter( ( form ) => form.key );

	wpgptAllPageWarningsState.pendingSaves.set( editor.id, forms );
}

function wpgpt_all_page_warnings_reconcile_pending_saves() {
	wpgptAllPageWarningsState.pendingSaves.forEach( ( forms, editorId ) => {
		const preview = document.getElementById( editorId.replace( 'editor', 'preview' ) );
		if ( ! preview ) {
			return;
		}

		const previewValues = Array.from(
			preview.querySelectorAll( '.translation-text' ),
			( translation ) => translation.textContent
		);
		if (
			forms.length === previewValues.length &&
			forms.every( ( form, index ) => form.value === previewValues[ index ] )
		) {
			forms.forEach( ( form ) => {
				wpgptAllPageWarningsState.dirtyTracker.markSaved( form.key, form.value );
			} );
			wpgptAllPageWarningsState.pendingSaves.delete( editorId );
		}
	} );
}

function wpgpt_all_page_warnings_init_dirty_tracking() {
	const translations = document.querySelector( '#translations' );
	if ( ! translations ) {
		return;
	}

	wpgpt_all_page_warnings_register_textareas();

	translations.addEventListener( 'input', ( event ) => {
		if ( 'TEXTAREA' !== event.target.tagName ) {
			return;
		}
		const key = wpgpt_all_page_warnings_textarea_key( event.target );
		if ( key ) {
			wpgptAllPageWarningsState.dirtyTracker.update( key, event.target.value );
		}
	} );

	translations.addEventListener( 'change', ( event ) => {
		if ( 'TEXTAREA' !== event.target.tagName ) {
			return;
		}
		const key = wpgpt_all_page_warnings_textarea_key( event.target );
		if ( key ) {
			wpgptAllPageWarningsState.dirtyTracker.update( key, event.target.value );
		}
	} );

	translations.addEventListener( 'click', ( event ) => {
		const save = event.target.closest( '.translation-actions__save, .approve' );
		if ( save ) {
			wpgpt_all_page_warnings_capture_save( save );
		}
	} );

	const observer = new MutationObserver( () => {
		wpgpt_all_page_warnings_register_textareas();
		wpgpt_all_page_warnings_reconcile_pending_saves();
	} );
	observer.observe( translations, {
		childList: true,
		subtree: true,
		characterData: true,
	} );
}

function wpgpt_all_page_warnings_set_status( text, state = '' ) {
	const status = wpgptAllPageWarningsState.ui.status;
	status.className = 'wpgpt-all-page-warnings__status' + ( state ? ' is-' + state : '' );
	status.textContent = text;
	status.hidden = false;
}

function wpgpt_all_page_warnings_set_scanning( scanning ) {
	wpgptAllPageWarningsState.scanning = scanning;
	wpgptAllPageWarningsState.ui.scan.disabled = scanning;
	wpgptAllPageWarningsState.ui.rescan.disabled = scanning;
}

function wpgpt_all_page_warnings_rule_counts( results ) {
	const counts = new Map();
	results.forEach( ( result ) => {
		result.japaneseFindings.forEach( ( finding ) => {
			counts.set( finding.setting, ( counts.get( finding.setting ) || 0 ) + 1 );
		} );
	} );
	return counts;
}

function wpgpt_all_page_warnings_render_rule_options() {
	const container = wpgptAllPageWarningsState.ui.ruleOptions;
	const counts = wpgpt_all_page_warnings_rule_counts( wpgptAllPageWarningsState.results );
	container.replaceChildren();

	WPGPT_ALL_PAGE_WARNING_RULES.forEach( ( rule ) => {
		const label = wpgpt_all_page_warnings_create_element( 'label', 'wpgpt-all-page-warnings__rule' );
		const checkbox = document.createElement( 'input' );
		checkbox.type = 'checkbox';
		checkbox.value = rule.setting;
		checkbox.checked = wpgptAllPageWarningsState.selectedRules.has( rule.setting );
		checkbox.addEventListener( 'change', () => {
			if ( checkbox.checked ) {
				wpgptAllPageWarningsState.selectedRules.add( rule.setting );
			} else {
				wpgptAllPageWarningsState.selectedRules.delete( rule.setting );
			}
			wpgptAllPageWarningsState.page = 1;
			wpgpt_all_page_warnings_render();
		} );
		label.append(
			checkbox,
			wpgpt_all_page_warnings_create_element( 'span', '', rule.label ),
			wpgpt_all_page_warnings_create_element( 'small', '', String( counts.get( rule.setting ) || 0 ) )
		);
		container.appendChild( label );
	} );
}

function wpgpt_all_page_warnings_render_chips() {
	const chips = wpgptAllPageWarningsState.ui.chips;
	chips.replaceChildren();

	WPGPT_ALL_PAGE_WARNING_RULES.forEach( ( rule ) => {
		if ( ! wpgptAllPageWarningsState.selectedRules.has( rule.setting ) ) {
			return;
		}
		const chip = wpgpt_all_page_warnings_create_element( 'span', 'wpgpt-all-page-warnings__chip' );
		chip.appendChild( wpgpt_all_page_warnings_create_element( 'span', '', rule.label ) );
		const remove = wpgpt_all_page_warnings_create_element( 'button', '', '×' );
		remove.type = 'button';
		remove.setAttribute( 'aria-label', rule.label + ' の絞り込みを解除' );
		remove.addEventListener( 'click', () => {
			wpgptAllPageWarningsState.selectedRules.delete( rule.setting );
			wpgptAllPageWarningsState.page = 1;
			wpgpt_all_page_warnings_render_rule_options();
			wpgpt_all_page_warnings_render();
		} );
		chip.appendChild( remove );
		chips.appendChild( chip );
	} );
}

function wpgpt_all_page_warnings_warning_item( warning, multipleForms ) {
	const item = wpgpt_all_page_warnings_create_element( 'li', 'wpgpt-all-page-warnings__warning' );
	if ( warning.setting ) {
		const rule = WPGPT_ALL_PAGE_WARNING_RULES.find( ( candidate ) => candidate.setting === warning.setting );
		item.appendChild(
			wpgpt_all_page_warnings_create_element(
				'span',
				'wpgpt-all-page-warnings__badge',
				rule ? rule.label.split( ' ' )[ 0 ] : warning.setting
			)
		);
	}
	const text = multipleForms ? 'Form #' + warning.form + ': ' + warning.text : warning.text;
	item.appendChild( wpgpt_all_page_warnings_create_element( 'span', '', text ) );
	return item;
}

function wpgpt_all_page_warnings_result_card( result ) {
	const card = wpgpt_all_page_warnings_create_element( 'article', 'wpgpt-all-page-warnings__card' );
	const head = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__card-head' );
	head.append(
		wpgpt_all_page_warnings_create_element( 'strong', '', '#' + result.id ),
		wpgpt_all_page_warnings_create_element( 'span', '', 'GlotPress Page ' + result.page )
	);
	const open = wpgpt_all_page_warnings_create_element( 'a', 'button', 'Page ' + result.page + ' で開く' );
	open.href = result.pageUrl + '#'+ result.previewId;
	open.target = '_blank';
	open.rel = 'noopener';
	head.appendChild( open );
	card.appendChild( head );

	const body = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__card-body' );
	const original = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__field' );
	original.append(
		wpgpt_all_page_warnings_create_element( 'strong', '', '原文' ),
		wpgpt_all_page_warnings_create_element( 'div', '', result.original )
	);
	const translated = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__field' );
	translated.append(
		wpgpt_all_page_warnings_create_element( 'strong', '', '訳文' ),
		wpgpt_all_page_warnings_create_element( 'div', '', result.translations.join( '\n' ) )
	);
	const warnings = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__warnings' );
	warnings.appendChild( wpgpt_all_page_warnings_create_element( 'strong', '', 'Warnings' ) );
	const list = document.createElement( 'ul' );
	const multipleForms = result.translations.length > 1;
	result.displayWarnings.forEach( ( warning ) => {
		list.appendChild( wpgpt_all_page_warnings_warning_item( warning, multipleForms ) );
	} );
	warnings.appendChild( list );
	body.append( original, translated, warnings );
	card.appendChild( body );
	return card;
}

function wpgpt_all_page_warnings_render_pagination( pageInfo ) {
	const pagination = wpgptAllPageWarningsState.ui.pagination;
	pagination.replaceChildren();
	if ( pageInfo.totalPages <= 1 ) {
		return;
	}

	const addButton = ( label, page, disabled = false, active = false ) => {
		const button = wpgpt_all_page_warnings_create_element( 'button', active ? 'is-active' : '', label );
		button.type = 'button';
		button.disabled = disabled;
		button.addEventListener( 'click', () => {
			wpgptAllPageWarningsState.page = page;
			wpgpt_all_page_warnings_render();
			wpgptAllPageWarningsState.ui.root.scrollIntoView( { block: 'start' } );
		} );
		pagination.appendChild( button );
	};

	addButton( '←', pageInfo.page - 1, 1 === pageInfo.page );
	for ( let page = 1; page <= pageInfo.totalPages; page++ ) {
		const nearCurrent = Math.abs( page - pageInfo.page ) <= 1;
		const edge = page <= 2 || page > pageInfo.totalPages - 2;
		if ( ! nearCurrent && ! edge ) {
			if ( ! pagination.lastElementChild?.classList.contains( 'is-dots' ) ) {
				pagination.appendChild( wpgpt_all_page_warnings_create_element( 'span', 'is-dots', '…' ) );
			}
			continue;
		}
		addButton( String( page ), page, false, page === pageInfo.page );
	}
	addButton( '→', pageInfo.page + 1, pageInfo.page === pageInfo.totalPages );
}

function wpgpt_all_page_warnings_render() {
	const filtered = wpgpt_all_page_warnings_filter_results(
		wpgptAllPageWarningsState.results,
		wpgptAllPageWarningsState.selectedRules
	);
	const summary = wpgpt_all_page_warnings_summarize( filtered );
	const pageInfo = wpgpt_all_page_warnings_paginate(
		filtered,
		wpgptAllPageWarningsState.page,
		wpgptAllPageWarningsState.pageSize
	);
	wpgptAllPageWarningsState.page = pageInfo.page;

	wpgptAllPageWarningsState.ui.warningCount.textContent = String( summary.warnings );
	wpgptAllPageWarningsState.ui.stringCount.textContent = String( summary.strings );
	wpgptAllPageWarningsState.ui.pageCount.textContent = String( wpgptAllPageWarningsState.checkedPages );
	wpgptAllPageWarningsState.ui.results.replaceChildren();

	if ( ! pageInfo.items.length ) {
		wpgptAllPageWarningsState.ui.results.appendChild(
			wpgpt_all_page_warnings_create_element(
				'div',
				'wpgpt-all-page-warnings__empty',
				wpgptAllPageWarningsState.results.length ?
					'選択したルールに一致する Warning はありません。' :
					'Warning は見つかりませんでした。'
			)
		);
	} else {
		pageInfo.items.forEach( ( result ) => {
			wpgptAllPageWarningsState.ui.results.appendChild(
				wpgpt_all_page_warnings_result_card( result )
			);
		} );
	}

	const first = summary.strings ? pageInfo.start + 1 : 0;
	const last = Math.min( pageInfo.start + pageInfo.items.length, summary.strings );
	wpgptAllPageWarningsState.ui.range.textContent =
		first + '–' + last + ' / ' + summary.strings + '文字列';
	wpgptAllPageWarningsState.ui.resultPage.textContent =
		'結果ページ ' + pageInfo.page + ' / ' + pageInfo.totalPages;
	wpgptAllPageWarningsState.ui.content.hidden = false;
	wpgpt_all_page_warnings_render_chips();
	wpgpt_all_page_warnings_render_pagination( pageInfo );
}

function wpgpt_all_page_warnings_reset_results() {
	wpgptAllPageWarningsState.results = [];
	wpgptAllPageWarningsState.selectedRules.clear();
	wpgptAllPageWarningsState.page = 1;
	wpgptAllPageWarningsState.checkedPages = 0;
	wpgptAllPageWarningsState.warningCount = 0;
	wpgptAllPageWarningsState.ui.content.hidden = true;
	wpgptAllPageWarningsState.ui.results.replaceChildren();
	wpgptAllPageWarningsState.ui.pagination.replaceChildren();
}

async function wpgpt_all_page_warnings_scan() {
	if ( wpgptAllPageWarningsState.scanning ) {
		return;
	}

	wpgpt_all_page_warnings_register_textareas();
	if ( wpgptAllPageWarningsState.dirtyTracker.hasDirty() ) {
		wpgpt_all_page_warnings_set_status(
			'未保存の編集があります。翻訳を保存してから、もう一度全ページ確認を実行してください。',
			'warning'
		);
		return;
	}

	wpgpt_all_page_warnings_reset_results();
	wpgpt_all_page_warnings_set_scanning( true );
	wpgpt_all_page_warnings_set_status( '先頭ページを確認しています…' );

	try {
		const currentUrl = wpgpt_all_page_warnings_normalize_url( window.location.href );
		const backwards = [];
		const visited = new Set();
		let page = await wpgpt_all_page_warnings_fetch_page( currentUrl );

		while ( page ) {
			if ( visited.has( page.url ) ) {
				throw new Error( 'Pagination loop detected.' );
			}
			visited.add( page.url );
			backwards.push( page );
			const previousUrl = wpgpt_all_page_warnings_paging_url( page.document, 'previous', page.url );
			if ( ! previousUrl ) {
				break;
			}
			wpgpt_all_page_warnings_set_status( '先頭ページを確認しています…' );
			page = await wpgpt_all_page_warnings_fetch_page( previousUrl );
		}

		const ordered = backwards.reverse();
		for ( const prefetched of ordered ) {
			const pageResults = wpgpt_all_page_warnings_analyze_page( prefetched );
			wpgptAllPageWarningsState.results.push( ...pageResults );
			wpgptAllPageWarningsState.checkedPages++;
			wpgptAllPageWarningsState.warningCount += pageResults.reduce(
				( total, result ) => total + result.warnings.length,
				0
			);
			wpgpt_all_page_warnings_set_status(
				'Scanning… ' + wpgptAllPageWarningsState.checkedPages +
				' pages checked / ' + wpgptAllPageWarningsState.warningCount +
				' warnings found'
			);
		}

		let lastPage = ordered[ ordered.length - 1 ];
		let nextUrl = wpgpt_all_page_warnings_paging_url( lastPage.document, 'next', lastPage.url );
		while ( nextUrl ) {
			if ( visited.has( nextUrl ) ) {
				throw new Error( 'Pagination loop detected.' );
			}
			visited.add( nextUrl );
			lastPage = await wpgpt_all_page_warnings_fetch_page( nextUrl );
			const pageResults = wpgpt_all_page_warnings_analyze_page( lastPage );
			wpgptAllPageWarningsState.results.push( ...pageResults );
			wpgptAllPageWarningsState.checkedPages++;
			wpgptAllPageWarningsState.warningCount += pageResults.reduce(
				( total, result ) => total + result.warnings.length,
				0
			);
			wpgpt_all_page_warnings_set_status(
				'Scanning… ' + wpgptAllPageWarningsState.checkedPages +
				' pages checked / ' + wpgptAllPageWarningsState.warningCount +
				' warnings found'
			);
			nextUrl = wpgpt_all_page_warnings_paging_url( lastPage.document, 'next', lastPage.url );
		}

		wpgpt_all_page_warnings_set_status(
			'✓ 全' + wpgptAllPageWarningsState.checkedPages + 'ページを確認しました。',
			'success'
		);
		wpgpt_all_page_warnings_render_rule_options();
		wpgpt_all_page_warnings_render();
		wpgptAllPageWarningsState.ui.scan.textContent = 'Scan again';
	} catch ( error ) {
		wpgpt_all_page_warnings_set_status(
			'Scan incomplete. ' + wpgptAllPageWarningsState.checkedPages +
				' pages checked / ' + wpgptAllPageWarningsState.warningCount +
				' warnings found. ' + error.message,
			'error'
		);
	} finally {
		wpgpt_all_page_warnings_set_scanning( false );
	}
}

function wpgpt_all_page_warnings_build_ui() {
	const root = wpgpt_all_page_warnings_create_element( 'section', 'wpgpt-all-page-warnings' );
	const head = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__head' );
	const titleWrap = document.createElement( 'div' );
	titleWrap.append(
		wpgpt_all_page_warnings_create_element( 'h2', '', '全ページの Warning を確認' ),
		wpgpt_all_page_warnings_create_element(
			'p',
			'',
			'現在の検索・ステータス・並び順を維持した全ページを、必要なときだけ順番に確認します。'
		)
	);
	const scan = wpgpt_all_page_warnings_create_element( 'button', 'button is-primary', 'Scan all pages for warnings' );
	scan.type = 'button';
	scan.addEventListener( 'click', wpgpt_all_page_warnings_scan );
	head.append( titleWrap, scan );
	root.appendChild( head );

	const status = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__status' );
	status.hidden = true;
	root.appendChild( status );

	const content = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__content' );
	content.hidden = true;
	const snapshot = wpgpt_all_page_warnings_create_element(
		'p',
		'wpgpt-all-page-warnings__snapshot',
		'この一覧は走査時点の結果です。翻訳を修正した後は「Scan again」を実行してください。'
	);
	content.appendChild( snapshot );

	const metrics = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__metrics' );
	const createMetric = ( label ) => {
		const metric = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__metric' );
		const value = wpgpt_all_page_warnings_create_element( 'strong', '', '0' );
		metric.append( value, wpgpt_all_page_warnings_create_element( 'span', '', label ) );
		metrics.appendChild( metric );
		return value;
	};
	const warningCount = createMetric( 'Warning' );
	const stringCount = createMetric( '影響する文字列' );
	const pageCount = createMetric( '確認した GlotPress ページ' );
	content.appendChild( metrics );

	const filters = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__filters' );
	const details = document.createElement( 'details' );
	const summary = wpgpt_all_page_warnings_create_element( 'summary', 'button', 'ルールで絞り込む' );
	details.appendChild( summary );
	const ruleOptions = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__rule-options' );
	details.appendChild( ruleOptions );
	const clear = wpgpt_all_page_warnings_create_element( 'button', 'button', 'すべて解除' );
	clear.type = 'button';
	clear.addEventListener( 'click', () => {
		wpgptAllPageWarningsState.selectedRules.clear();
		wpgptAllPageWarningsState.page = 1;
		wpgpt_all_page_warnings_render_rule_options();
		wpgpt_all_page_warnings_render();
	} );
	details.appendChild( clear );
	const chips = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__chips' );
	filters.append( details, chips );
	content.appendChild( filters );

	const toolbar = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__toolbar' );
	const range = wpgpt_all_page_warnings_create_element( 'strong', '', '0–0 / 0文字列' );
	const pageSize = document.createElement( 'select' );
	[ 25, 50, 100 ].forEach( ( size ) => {
		const option = document.createElement( 'option' );
		option.value = String( size );
		option.textContent = size + '件ずつ';
		pageSize.appendChild( option );
	} );
	pageSize.addEventListener( 'change', () => {
		wpgptAllPageWarningsState.pageSize = Number.parseInt( pageSize.value, 10 );
		wpgptAllPageWarningsState.page = 1;
		wpgpt_all_page_warnings_render();
	} );
	const resultPage = wpgpt_all_page_warnings_create_element( 'span', '', '結果ページ 1 / 1' );
	const rescan = wpgpt_all_page_warnings_create_element( 'button', 'button', 'Scan again' );
	rescan.type = 'button';
	rescan.addEventListener( 'click', wpgpt_all_page_warnings_scan );
	toolbar.append( range, pageSize, resultPage, rescan );
	content.appendChild( toolbar );

	const results = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__results' );
	const pagination = wpgpt_all_page_warnings_create_element( 'div', 'wpgpt-all-page-warnings__pagination' );
	content.append( results, pagination );
	root.appendChild( content );

	wpgptAllPageWarningsState.ui = {
		root,
		scan,
		rescan,
		status,
		content,
		warningCount,
		stringCount,
		pageCount,
		ruleOptions,
		chips,
		range,
		resultPage,
		results,
		pagination,
	};

	return root;
}

function wpgpt_init_all_page_warnings() {
	const translations = document.querySelector( '#translations' );
	if ( ! translations || document.querySelector( '.wpgpt-all-page-warnings' ) ) {
		return;
	}

	const paging = document.querySelector( '.paging' );
	if ( ! paging ) {
		return;
	}

	const ui = wpgpt_all_page_warnings_build_ui();
	paging.insertAdjacentElement( 'afterend', ui );
	wpgpt_all_page_warnings_init_dirty_tracking();
}

globalThis.wpgpt_all_page_warnings_test_api = {
	createDirtyTracker: wpgpt_create_dirty_tracker,
	filterResults: wpgpt_all_page_warnings_filter_results,
	summarize: wpgpt_all_page_warnings_summarize,
	paginate: wpgpt_all_page_warnings_paginate,
	collectJapaneseFindings: wpgpt_all_page_warnings_collect_japanese_findings,
};

if ( 'undefined' !== typeof document && 'undefined' !== typeof window ) {
	wpgpt_init_all_page_warnings();
}
