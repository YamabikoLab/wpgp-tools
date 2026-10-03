// Translation checks.
let wpgpt_checks_shortcuts = false;
let wpgpt_user_edited = false;

const wpgpt_period = ( wpgpt_settings.custom_period.state !== '' ) ? wpgpt_settings.custom_period.state : '.';
const approve_with_warnings = document.createElement( 'div' );
approve_with_warnings.classList.add( 'wpgpt-ignore-warnings', 'noselect' );
const label_warnings = document.createElement( 'label' );
label_warnings.append( $wpgpt_createElement( 'input', { 'type': 'checkbox' } ), 'Save / Approve with warnings' );
approve_with_warnings.appendChild( label_warnings );
const wpgpt_li = document.createElement( 'li' );

const wpgpt_assets = document.querySelector( '#wpgpt_assets' );
const wpgpt_warning_icon = wpgpt_assets?.dataset?.warning ?? wpgpt_us_assets?.wpgpt_warning_icon;
const wpgpt_notice_icon = wpgpt_assets?.dataset?.notice ?? wpgpt_us_assets?.wpgpt_notice_icon;

let wpgpt_next_is_strict = true;
const wpgpt_error_message = '<b>Fix warnings first!</b><br><br>Alternatively, check <br><i>Save / Approve with warnings!</i><br><br>';

function wpgpt_check_all_translations() {
	document.querySelectorAll( '#translations tbody tr.preview' ).forEach( ( translation_p ) => {
		const translation_p_id = `#${translation_p.id}`;
		const translation_e_id = translation_p_id.replace( 'preview', 'editor' );
		wpgpt_editor_init( translation_e_id, translation_p_id );

		if ( translation_p.classList.contains( 'untranslated' ) ) {
			return;
		}

		const thisTranslation = {
			has_notice:     false,
			has_warning:    false,
			check_results:  '',
			preview_class:  '',
			preview_status: '',
			labels:         [],
			highlights:     [],
			ignore_status:  '',
		};

		prepare_checks( thisTranslation, translation_e_id, true );
		translation_p.classList.add( thisTranslation.preview_class );
		document.querySelector( `${translation_e_id} .wpgpt-ignore-warnings` ).style.display = thisTranslation.ignore_status;
		document.querySelector( `${translation_e_id} .editor-panel__right .panel-content .meta dl` ).insertAdjacentElement( 'beforebegin', thisTranslation.check_results );
		translation_p.querySelector( '.actions .action.edit' ).insertAdjacentElement( 'afterbegin', thisTranslation.preview_status );

		if ( 'enabled' === wpgpt_settings.checks_labels.state ) {
			const translation_p_text = translation_p.querySelectorAll( '.translation-text' );
			thisTranslation.labels.forEach( ( form_label, form_i ) => {
				wpgpt_add_labels_highlights( form_label, form_i, translation_p_text, thisTranslation.highlights );
			} );
		}
	} );
}

function wpgpt_add_labels_highlights( form_label, form_i, translation_p_text, highlights ) {
	if ( ! translation_p_text[ form_i ] ) {
		return;
	}
	if ( form_label.warnings !== '' || form_label.notices !== '' ) {
		const labels_final_w = document.createElement( 'div' );
		const labels_final_n = labels_final_w.cloneNode( true );
		labels_final_w.className = 'wpgpt-warning-labels';
		labels_final_n.className = 'wpgpt-notices-labels';
		( form_label.warnings !== '' ) && labels_final_w.appendChild( form_label.warnings );
		( form_label.notices !== '' ) && labels_final_n.appendChild( form_label.notices );
		translation_p_text[ form_i ].insertAdjacentElement( 'afterend', labels_final_n );
		translation_p_text[ form_i ].insertAdjacentElement( 'afterend', labels_final_w );
		if ( highlights.length ) {
			wpgpt_highlights( translation_p_text[ form_i ], highlights[ form_i ], 'wpgpt-highlight' );
		}
	}
}

function wpgpt_editor_init( translation_e_id, translation_p_id ) {
	const new_approve_with_warnings = approve_with_warnings.cloneNode( true );
	new_approve_with_warnings.querySelector( 'input' ).addEventListener( 'click', ( ev ) => { wpgpt_next_is_strict = ! ( ev.target.checked ); } );
	$wpgpt_addElement( `${translation_e_id} .translation-wrapper`, 'afterend', new_approve_with_warnings );

	document.querySelectorAll( `${translation_e_id} .translation-actions__save, ${translation_e_id} .approve` ).forEach( ( btn ) => {
		btn.addEventListener( 'click', ( e ) => {
			if ( ( ! wpgpt_check_this_translation( translation_e_id, translation_p_id ) ) && wpgpt_next_is_strict ) {
				e.preventDefault();
				e.stopPropagation();
				$gp.notices.error( wpgpt_error_message );
			}
			document.querySelectorAll( '.wpgpt-ignore-warnings input' ).forEach( ( el ) => { el.checked = false; } );
			wpgpt_next_is_strict = true;
			wpgpt_user_edited = false;
		} );
	} );
}

function wpgpt_check_this_translation( translation_e_id, translation_p_id ) {
	const thisTranslation = {
		has_notice:     false,
		has_warning:    false,
		check_results:  '',
		preview_class:  '',
		preview_status: '',
		labels:         [],
		highlights:     [],
		ignore_status:  '',
	};
	prepare_checks( thisTranslation, translation_e_id, false );
	wpgpt_display_check_results( translation_e_id, translation_p_id, thisTranslation );
	return ! thisTranslation.has_warning;
}

function wpgpt_display_check_results( translation_e_id, translation_p_id, thisTranslation ) {
	const editor = document.querySelector( `${translation_e_id} ` );
	const preview = document.querySelector( `${translation_p_id}` );
	if ( ! editor || ! preview ) {
		return;
	}

	const editor_check_results = editor.querySelector( '.meta .wpgpt-checks-list' );
	editor_check_results &&	editor_check_results.parentNode.replaceChild( thisTranslation.check_results, editor_check_results );
	( !	editor_check_results ) && editor.querySelector( '.meta dl' ).insertAdjacentElement( 'beforebegin', thisTranslation.check_results );

	const editor_ignore_warnings = editor.querySelector( '.wpgpt-ignore-warnings' );
	if ( editor_ignore_warnings ) {
		editor_ignore_warnings.style.display = thisTranslation.ignore_status;
	}

	preview.classList.remove( 'wpgpt-has-warning', 'wpgpt-has-notice', 'wpgpt-has-nothing' );
	preview.classList.add( thisTranslation.preview_class );

	const check_status = preview.querySelector( '.wpgpt-check-preview' );
	check_status && check_status.parentNode.replaceChild( thisTranslation.preview_status, check_status );
	( ! check_status ) && preview.querySelector( '.actions .action.edit' ).insertAdjacentElement( 'afterbegin', thisTranslation.preview_status );

	if ( 'enabled' === wpgpt_settings.checks_labels.state ) {
		preview.querySelectorAll( '.wpgpt-warning-labels, .wpgpt-notices-labels' ).forEach( ( label ) => {
			label.parentElement.removeChild( label );
		} );
		const new_translation_p_text = preview.querySelectorAll( '.translation-text' );
		new_translation_p_text.length && thisTranslation.labels.forEach( ( form_label, form_i ) => {
			wpgpt_add_labels_highlights( form_label, form_i, new_translation_p_text, thisTranslation.highlights );
		} );
	}
	wpgpt_filters();
}

function wpgpt_mutations() {
	const observer = new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			mutation.addedNodes.forEach( ( el ) => {
				if ( 1 !== el.nodeType || ! el.classList.contains( 'editor' ) ) {
					return;
				}
				wpgpt_check_this_translation( `#${el.id}`, `#${el.id.replace( 'editor', 'preview' )}` );
				if (
					'disabled' === wpgpt_settings.history_main.state ||
					( document.location.href.includes( 'historypage' ) && 'disabled' === wpgpt_settings.history_page.state )
				) { return; }
				wpgpt_history_editors = [];
				wpgpt_history_editors[ 0 ] = document.querySelector( `#${el.id}` );
				wpgpt_load_history_status( 0 );
			} );
		} );
	} );
	observer.observe( document.querySelector( '#translations tbody' ), {
		childList: true,
		subtree:   true,
	} );
}

function prepare_checks( thisTranslation, translation_e_id, highlight_spaces ) {
	const original_forms = [], translated_forms = [];
	document.querySelectorAll( `${translation_e_id} .source-string.strings div .original-raw` ).forEach( ( form ) => {
		original_forms[ original_forms.length ] = form.textContent;
	} );
	document.querySelectorAll( `${translation_e_id} .translation-wrapper div.textareas textarea` ).forEach( ( form ) => {
		translated_forms[ translated_forms.length ] = form.value;
	} );

	thisTranslation.check_results = document.createDocumentFragment();

	let original_form_i = 0;
	// For locales that have `nplurals === 1`. See issue #34.
	if ( 2 === original_forms.length && 1 === translated_forms.length ) {
		original_form_i = 1;
	}
	let check_results;
	translated_forms.forEach( ( translated_form, translated_form_i ) => {
		check_results = wpgpt_run_checks( original_forms[ original_form_i ], translated_form, highlight_spaces ? translation_e_id : false, original_forms[ 0 ] || original_forms[ original_form_i ] );
		const warnings_list = document.createElement( 'div' );
		const notices_list = warnings_list.cloneNode( true );
		warnings_list.classList.add( 'wpgpt-warnings-list' );

		thisTranslation.labels[ translated_form_i ] = { 'notices': '', 'warnings': '' };

		if ( check_results.warning.length ) {
			thisTranslation.has_warning = true;
			warnings_list.classList.add( 'has_warning' );

			const warningsF = document.createDocumentFragment();
			check_results.warning.forEach( ( el ) => {
				warningsF.appendChild( el );
			} );
			warnings_list.textContent = `Warnings${( translated_forms.length > 1 ) ? ` #${translated_form_i + 1}:` : ''}`;
			warnings_list.appendChild( document.createElement( 'ul' ) ).appendChild( warningsF.cloneNode( true ) );

			const warnings_labels = document.createElement( 'ul' );
			warnings_labels.className = 'wpgpt-warning-labels';
			warnings_labels.appendChild( warningsF );

			thisTranslation.check_results.appendChild( warnings_list );
			thisTranslation.labels[ translated_form_i ].warnings = warnings_labels;
		} else {
			warnings_list.textContent = `Warnings${( translated_forms.length > 1 ) ? ` #${translated_form_i + 1}:` : ''} ✓`;
			thisTranslation.check_results.appendChild( warnings_list );
		}

		if ( check_results.notice.length ) {
			thisTranslation.has_notice = true;
			notices_list.className = 'wpgpt-notices-list';

			const noticesF = document.createDocumentFragment();
			check_results.notice.forEach( ( el ) => {
				noticesF.appendChild( el );
			} );
			if ( ! thisTranslation.has_warning ) {
				notices_list.textContent = `Notices${( translated_forms.length > 1 ) ? ` #${translated_form_i + 1}:` : ''}`;
			}
			notices_list.appendChild( document.createElement( 'ul' ) ).appendChild( noticesF.cloneNode( true ) );

			const notices_labels = document.createElement( 'ul' );
			notices_labels.className = 'wpgpt-notice-labels';
			notices_labels.appendChild( noticesF );

			thisTranslation.check_results.appendChild( notices_list );
			thisTranslation.labels[ translated_form_i ].notices = notices_labels;
		}

		thisTranslation.highlights[ translated_form_i ] = check_results.highlight_me;

		if ( 2 === original_forms.length ) {
			original_form_i = 1;
		}
	} );

	const final_list = document.createElement( 'div' );
	final_list.className = 'wpgpt-checks-list';
	final_list.appendChild( thisTranslation.check_results );
	thisTranslation.check_results = final_list;

	if ( thisTranslation.has_warning ) {
		thisTranslation.ignore_status = 'block';
		thisTranslation.preview_class = 'wpgpt-has-warning';
		thisTranslation.preview_status = $wpgpt_createElement( 'img', { 'class': 'wpgpt-check-preview', 'title': 'String has a warning.', 'src': wpgpt_warning_icon } );
	} else if ( thisTranslation.has_notice ) {
		thisTranslation.ignore_status = 'none';
		thisTranslation.preview_class = 'wpgpt-has-notice';
		thisTranslation.preview_status = $wpgpt_createElement( 'img', { 'class': 'wpgpt-check-preview', 'title': 'String has a notice.', 'src': wpgpt_notice_icon } );
	} else {
		thisTranslation.ignore_status = 'none';
		thisTranslation.preview_class = 'wpgpt-has-nothing';
		const preview_status_passed = $wpgpt_createElement( 'span', { 'class': 'wpgpt-check-preview passed', 'title': 'All checks passed.' } );
		preview_status_passed.textContent = '✓';
		thisTranslation.preview_status = preview_status_passed;
	}
}

function wpgpt_run_checks( original, translated, translation_e_id = false, singular_original = original ) {
	if ( '' === translated ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Empty translation!';
		return { 'warning': [ msg ], 'notice': [], 'highlight_me': [] };
	}
	const results = { warning: [], notice: [], highlight_me: [] };
	wpgpt_push1( results.warning, wpgpt_check_placeholders( original, translated ) );
	( 'enabled' === wpgpt_settings.checks.state ) && wpgpt_run_general_checks( results, original, translated, translation_e_id );
	( 'enabled' === wpgpt_settings.ro_checks.state ) && wpgpt_run_romanian_checks( results, translated );
	( 'enabled' === wpgpt_settings.ja_checks.state ) && wpgpt_run_japanese_checks( results, singular_original, translated );
	return results;
}

function wpgpt_run_general_checks( results, original, translated, translation_e_id ) {
	const original_first = original.substr( 0, 1 );
	const translated_first = translated.substr( 0, 1 );
	const original_last = original.substr( original.length - 1 );
	const translated_last = translated.substr( translated.length - 1 );

	if ( wpgpt_settings.start_end_space.state !== 'none' ) {
		wpgpt_push1( results[ wpgpt_settings.start_end_space.state ], wpgpt_check_start_space( translated_first, original_first ) );
	}

	if ( original_last !== translated_last ) {
		const end_char = { warning: '', notice: '' };
		if ( wpgpt_settings.start_end_space.state !== 'nothing' ) {
			end_char[ wpgpt_settings.start_end_space.state ] = wpgpt_check_end_space( translated_last, original_last );
		}

		if ( '' === end_char.warning && '' === end_char.notice && wpgpt_settings.end_colon.state !== 'nothing' ) {
			end_char[ wpgpt_settings.end_colon.state ] = wpgpt_check_end_colon( translated_last, original_last );
		}

		if ( '' === end_char.warning && '' === end_char.notice && wpgpt_settings.end_question_exclamation.state !== 'nothing' ) {
			end_char[ wpgpt_settings.end_question_exclamation.state ] = wpgpt_check_end_question_exclamation( original_last );
		}

		if ( '' === end_char.warning && '' === end_char.notice && wpgpt_settings.end_period.state !== 'none' ) {
			end_char[ wpgpt_settings.end_period.state ] = wpgpt_check_missing_end_symbol( translated, original, translated_last, original_last );
			if ( '' === end_char.warning && '' === end_char.notice ) {
				end_char[ wpgpt_settings.end_period.state ] = wpgpt_check_additional_end_symbol( translated, original, translated_last, original_last );
			}
		}
		wpgpt_push1( results.warning, end_char.warning );
		wpgpt_push1( results.notice, end_char.notice );
	}

	if ( wpgpt_settings.double_spaces.state !== 'nothing' ) {
		const double_spaces = wpgpt_check_double_spaces( translated, original, translation_e_id );
		double_spaces.arr.length && wpgpt_push1( results[ wpgpt_settings.double_spaces.state ], double_spaces.msg );
		// If missing double spaces, set a notice instead.
		( ! double_spaces.arr.length ) && wpgpt_push1( results[ 'notice' ], double_spaces.msg );
		double_spaces.arr.length && wpgpt_push( results.highlight_me, double_spaces.arr );
	}

	if ( wpgpt_settings.warning_words.state !== '' ) {
		const warning_words = wpgpt_check_warning_words( translated );
		wpgpt_push1( results.warning, warning_words.msg );
		warning_words.arr.length && wpgpt_push( results.highlight_me, warning_words.arr );
	}
	if ( wpgpt_settings.match_words.state !== '' ) {
		wpgpt_push1( results.warning, wpgpt_check_match_words( translated, original ) );
	}

	if ( wpgpt_settings.tags_spaces.state !== 'disabled' ) {
		const tag_spaces = wpgpt_check_tag_spaces( translated );
		wpgpt_push1( results[ 'notice' ], tag_spaces.msg );
		tag_spaces.arr.length && wpgpt_push( results.highlight_me, tag_spaces.arr );
	}
}


/**
 * 日本語翻訳チェックの責務を定義する。
 *
 * WordPress 日本語翻訳スタイルガイドに基づき、機械的に判定できる表記ルールを確認し、
 * 利用者が修正箇所と確認理由を理解できる指摘を生成する。
 * URL、メールアドレス、HTML、プレースホルダー、コード表記などの技術文字列は、
 * 日本語本文の表記ルールを誤適用しないよう保護対象として扱う。
 *
 * 指摘位置は JavaScript 文字列と同じ UTF-16 code unit の [start, end) で保持し、
 * 表示側で安全に一意箇所を特定できる場合だけ強調表示へ利用する。
 */
const WPGPT_JA_STYLE_GUIDE = {
	punctuation: '1-1 日本語の句読点',
	half_width: '1-2 英数字・記号の半角表記',
	half_full_spacing: '1-4 半角文字と全角文字の間のスペース',
	parentheses: '1-5 半角丸括弧と前後スペース',
	inner_parentheses_spacing: '1-6 丸括弧内側の不要スペース',
	period_inside_parentheses: '1-7 括弧内末尾の句点',
	sentence_ending_parentheses: '1-8 文末括弧と句点の位置',
	number_spacing: '1-9 半角数字前後の不要スペース',
	view_expression: '3-2 「View XX」を「〜を表示 (する)」に統一',
	not_allowed_expression: '3-3 「XX are/is not allowed to...」を「〜する権限がありません」に統一',
	sorry_prefix: '3-4 「Sorry, ...」の Sorry を訳さない',
	recommended_expressions: '3-6 「下さい / 全て / 既に」などの推奨表記',
	middle_dot: '5. 中点「・」',
};

/**
 * 半角文字との境界判定で、日本語本文として扱う文字の範囲。
 */
const WPGPT_JA_JAPANESE_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
/**
 * 日本語との間に半角スペースを必要とする、数字以外の半角 ASCII 文字の範囲。
 */
const WPGPT_JA_ASCII_NON_DIGIT = /[\x21-\x2F\x3A-\x7E]/;
/**
 * 前後に半角スペースを置かない日本語の句読点・括弧類。
 */
const WPGPT_JA_NO_SPACE_PUNCTUATION = new Set( [ '『', '』', '「', '」', '。', '、' ] );
/**
 * 半角丸括弧の外側に半角スペースを要求しない日本語の句読点・括弧類。
 */
const WPGPT_JA_OUTER_PARENTHESES_SPACE_EXCEPTIONS = new Set( [ '『', '』', '「', '」', '。', '、' ] );
/**
 * 原文先頭の「Sorry,」に対応する訳として、削除確認の対象とする代表的な謝罪表現。
 */
const WPGPT_JA_APOLOGY_PREFIXES = [ 'すみませんが', 'すみません', '申し訳ございません', '申し訳ありません', 'ごめんなさい' ];

if (
	typeof $gp_editor_options !== 'undefined' &&
	(
		'enabled' === wpgpt_settings.checks.state ||
		'enabled' === wpgpt_settings.ro_checks.state ||
		( 'enabled' === wpgpt_settings.ja_checks.state && wpgpt_is_japanese_locale() )
	)
) {
	wpgpt_check_all_translations();
	wpgpt_filters();
	wpgpt_mutations();
	wpgpt_checks_shortcuts = true;
}

/**
 * 現在の翻訳画面が日本語ロケールかを判定する。
 *
 * 日本語固有ルールを他ロケールへ適用しないための実行条件として使用する。
 *
 * @returns {boolean} 日本語ロケールの場合は true。
 */
function wpgpt_is_japanese_locale() {
	return window.location.pathname.split( '/' ).includes( 'ja' );
}

/**
 * 日本語本文の表記ルールを適用しない技術文字列の範囲を特定する。
 *
 * URL、メールアドレス、HTML、テンプレート記法、プレースホルダー、関数表記、
 * コード表記、ファイルパスなどは、原文どおりの記号や空白を保持する必要があるため、
 * 日本語本文の表記違反として扱わない。
 *
 * HTML とテンプレート記法は、空白判定で前後の見えている文字を隣接文字として扱うため、
 * 通常の保護範囲とは別に「表示されないマークアップ」の範囲も返す。
 *
 * @param {string} text 判定対象の翻訳文。
 * @returns {{protected_indexes: Set<number>, hidden_markup_indexes: Set<number>}} 保護対象と表示されないマークアップの UTF-16 code unit 位置。
 */
function wpgpt_ja_protect_technical_text( text ) {
	const protected_indexes = new Set();
	const hidden_markup_indexes = new Set();

	/*
	 * 日本語本文として判定しない技術文字列を定義する。
	 *
	 * hidden_markup が true のものは、チェック対象から除外するだけでなく、
	 * 画面上には表示されない文字列として隣接文字の判定でも読み飛ばす。
	 */
	const patterns = [
		// URL は内容自体に記号や半角文字を含むため、日本語の表記ルールを適用しない。
		{ pattern: /https?:\/\/[^\s]+/giu, hidden_markup: false },

		// メールアドレスは英数字や記号の組み合わせをそのまま保持する。
		{ pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, hidden_markup: false },

		// HTML タグは画面に表示されないため、保護するとともに表示上の隣接判定でも読み飛ばす。
		{ pattern: /<[^>]+>/gu, hidden_markup: true },

		// テンプレート用のマークアップは画面に表示されないため、表示上の隣接判定でも読み飛ばす。
		{ pattern: /\{\{\/?[A-Za-z][A-Za-z0-9_-]*\}\}/gu, hidden_markup: true },

		// 「%s」「%1$s」などの文字列プレースホルダーは、その書式を変更しない。
		{ pattern: /%(?:\d+\$)?s/gu, hidden_markup: false },

		// 「%(name)s」形式の名前付きプレースホルダーは、その書式を変更しない。
		{ pattern: /%\([A-Za-z0-9_.-]+\)s/gu, hidden_markup: false },

		// 関数名やプレースホルダーに続く「()」は、技術的な表記としてそのまま保持する。
		{ pattern: /(?:[A-Za-z_][A-Za-z0-9_]*|%(?:\d+\$)?s)\(\)/gu, hidden_markup: false },

		// バッククォートで囲まれたコード表記は、日本語本文の表記ルールを適用しない。
		{ pattern: /`[^`]+`/gu, hidden_markup: false },

		// Windows または Unix 系のファイルパスは、記号や半角文字を含めてそのまま保持する。
		{ pattern: /(?:[A-Z]:\\|\/(?![A-Za-z][A-Za-z0-9_-]*>))\S+/giu, hidden_markup: false },
	];

	/*
	 * 技術文字列ごとに翻訳文内の該当範囲を特定し、
	 * 日本語の表記ルールを適用しない位置として記録する。
	 */
	patterns.forEach( ( item ) => {
		// 同じ種類の技術文字列が複数現れる場合も、翻訳文全体からすべての一致範囲を保護する。
		for ( const match of text.matchAll( item.pattern ) ) {
			/*
			 * 一致した文字列全体を保護することで、
			 * その内部の個々の文字が別の日本語ルールで誤って指摘されることを防ぐ。
			 */
			for ( let index = match.index; index < match.index + match[ 0 ].length; index++ ) {
				protected_indexes.add( index );

				/*
				 * 画面に表示されないマークアップの場合は、
				 * 表示上の前後関係を判定するときにも読み飛ばせるよう別途記録する。
				 */
				if ( item.hidden_markup ) {
					hidden_markup_indexes.add( index );
				}
			}
		}
	} );

	return { protected_indexes, hidden_markup_indexes };
}

/**
 * 表示されないマークアップをまたいで、空白ルール上の隣接文字を取得する。
 *
 * HTML などのタグ自体は画面に表示されないため、コロン前後などの空白判定では
 * タグを挟んでいても利用者に見える文字同士を隣接関係として扱う。
 *
 * @param {string} text 判定対象の翻訳文。
 * @param {Set<number>} hidden_markup_indexes 表示されないマークアップの位置。
 * @param {number} start_index 探索を開始する UTF-16 code unit 位置。
 * @param {number} direction 前方または後方を示す探索方向。
 * @param {Set<string>} spacing_characters 空白として扱う文字。
 * @returns {{character: string, character_index: number, spacing_indexes: number[]}|undefined} 隣接する表示文字と、その間の空白位置。
 */
function wpgpt_ja_visible_adjacent_text( text, hidden_markup_indexes, start_index, direction, spacing_characters ) {
	let index = start_index;
	const spacing_indexes = [];
	// 表示されないマークアップと空白を読み飛ばし、画面上で実際に隣接する文字を確定する。
	while ( index >= 0 && index < text.length ) {
		// マークアップは画面上に表示されないため、隣接文字として扱わない。
		if ( hidden_markup_indexes.has( index ) ) {
			index += direction;
			continue;
		}
		const character = text[ index ];
		// 空白は隣接関係を判定するために位置を記録し、その先の表示文字まで探索する。
		if ( spacing_characters.has( character ) ) {
			spacing_indexes.push( index );
			index += direction;
			continue;
		}
		return { character, character_index: index, spacing_indexes };
	}
	return undefined;
}

/**
 * 半角丸括弧の外側にある、利用者から見える文字と半角スペース数を取得する。
 *
 * マークアップを挟む場合でも表示上の境界で「外側に半角スペース1つ」という
 * ルールを判定できるようにする。
 *
 * @param {string} text 判定対象の翻訳文。
 * @param {Set<number>} hidden_markup_indexes 表示されないマークアップの位置。
 * @param {number} start_index 探索を開始する UTF-16 code unit 位置。
 * @param {number} direction 前方または後方を示す探索方向。
 * @returns {{character: string, space_count: number}|undefined} 外側の表示文字と、その間にある半角スペース数。
 */
function wpgpt_ja_outer_parentheses_spacing( text, hidden_markup_indexes, start_index, direction ) {
	let index = start_index;
	let space_count = 0;
	// 翻訳文の範囲内にある間、丸括弧の外側にある表示文字を探索する。
	while ( index >= 0 && index < text.length ) {
		// マークアップは画面上に表示されないため、外側の文字として扱わない。
		if ( hidden_markup_indexes.has( index ) ) {
			index += direction;
			continue;
		}
		const character = text[ index ];
		// 表示文字との間にある半角スペースは、外側のスペース数として数える。
		if ( ' ' === character ) {
			space_count++;
			index += direction;
			continue;
		}
		return { character, space_count };
	}
	return undefined;
}

/**
 * 全角カンマ・全角ピリオドが数値表現の一部かを判定する。
 *
 * 数字に挟まれた「，」「．」は小数点や桁区切りとして使われる可能性があるため、
 * 句読点ルール 1-1 の誤検知対象から除外する。
 *
 * @param {string} text 判定対象の翻訳文。
 * @param {number} index 判定する記号の UTF-16 code unit 位置。
 * @returns {boolean} 数値表現の一部として扱う場合は true。
 */
function wpgpt_ja_is_numeric_full_width_punctuation( text, index ) {
	// 数値表現として例外扱いするのは、全角カンマと全角ピリオドだけに限定する。
	if ( ! [ '，', '．' ].includes( text[ index ] ) ) {
		return false;
	}
	const numeric_character = /[0-9０-９]/u;
	// 記号の前後がどちらも数字の場合だけ、小数点・桁区切りなどの数値表現として扱う。
	return numeric_character.test( text[ index - 1 ] || '' ) && numeric_character.test( text[ index + 1 ] || '' );
}

/**
 * 日本語チェックで検出した指摘箇所を、共通の位置情報として作成する。
 *
 * 各チェックルールで見つけた問題箇所について、翻訳文のどこを指摘対象として
 * 扱うかを開始位置と終了位置で表し、検出結果の表示や強調に利用できる形にそろえる。
 *
 * @param {number} start 指摘箇所の開始位置。
 * @param {number} end 指摘箇所の終了位置。終了位置自体は含まない。
 * @returns {{start: number, end: number}} 指摘位置。
 */
function wpgpt_ja_match( start, end ) {
	return { start, end };
}

/**
 * 日本語チェックの指摘を、設定・スタイルガイド項目・説明・位置情報の組として表す。
 *
 * @param {string} setting 指摘の重要度設定を参照する設定キー。
 * @param {string} style_guide_item 対応する日本語翻訳スタイルガイド項目。
 * @param {string} message 利用者へ示す修正または確認内容。
 * @param {Array<{start: number, end: number}>} matches 指摘に対応する UTF-16 code unit の位置情報。
 * @returns {{setting: string, style_guide_item: string, message: string, matches: Array<{start: number, end: number}>}} 日本語チェックの指摘。
 */
function wpgpt_ja_finding( setting, style_guide_item, message, matches = [] ) {
	return { setting, style_guide_item, message, matches };
}

/**
 * ルール 1-1「日本語の句読点」を確認する。
 *
 * 日本語本文では「、」「。」を使用し、明確な代替表記である「，」「．」「､」「｡」を指摘する。
 * 数値表現の一部や技術文字列内部は対象外とする。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-1 に該当する指摘。
 */
function wpgpt_ja_check_punctuation( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const matches = [];
	// 翻訳本文に現れる代替句読点を確認し、技術文字列と数値表現を除いた箇所だけを指摘する。
	for ( let index = 0; index < translated.length; index++ ) {
		const character = translated[ index ];
		/*
		 * 技術文字列の外側にある代替句読点のうち、
		 * 数値表現の一部ではない文字だけをルール 1-1 の対象とする。
		 */
		if (
			! protected_indexes.has( index ) &&
			[ '，', '．', '､', '｡' ].includes( character ) &&
			! wpgpt_ja_is_numeric_full_width_punctuation( translated, index )
		) {
			matches.push( wpgpt_ja_match( index, index + 1 ) );
		}
	}
	// 違反箇所が1つ以上ある場合だけルール 1-1 の指摘を返し、なければ指摘なしとする。
	return matches.length ? [ wpgpt_ja_finding( 'ja_punctuation', WPGPT_JA_STYLE_GUIDE.punctuation, '日本語の句読点は「、」「。」を使用してください', matches ) ] : [];
}

/**
 * ルール 1-2「英数字・記号の半角表記」を確認する。
 *
 * 全角 ASCII 相当文字は対応する半角文字へ統一する。
 * 丸括弧はルール 1-5、句読点の明確な代替表記はルール 1-1 が責務を持つため、
 * それらを重複して指摘しない。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-2 に該当する指摘。
 */
function wpgpt_ja_check_half_width( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const grouped = new Map();
	// 全角 ASCII 相当文字を確認し、同じ文字種の違反は1件の指摘へまとめて全位置を保持する。
	for ( let index = 0; index < translated.length; index++ ) {
		/*
		 * URL やメールアドレスなどの技術文字列は、
		 * 表記を変更すると内容そのものを壊す可能性があるため判定しない。
		 */
		if ( protected_indexes.has( index ) ) continue;
		const character = translated[ index ];
		const code_point = character?.codePointAt( 0 );
		/*
		 * ルール 1-2 の対象は、半角 ASCII へ直接対応付けられる
		 * 全角 ASCII 相当文字だけに限定する。
		 */
		if ( code_point === undefined || code_point < 0xff01 || code_point > 0xff5e ) continue;

		/*
		 * 全角丸括弧はルール 1-5、数値表現ではない「，」「．」はルール 1-1 で扱う。
		 * 数値表現中の「，」「．」は句読点ではないため、ルール 1-2 の対象として残す。
		 */
		if (
			[ '（', '）' ].includes( character ) ||
			( [ '，', '．' ].includes( character ) && ! wpgpt_ja_is_numeric_full_width_punctuation( translated, index ) )
		) continue;
		const expected = String.fromCodePoint( code_point - 0xfee0 );
		const key = `${character}:${expected}`;
		/*
		 * 同じ全角文字と期待する半角文字の組み合わせは、
		 * 指摘を1件にまとめて該当箇所だけを追加する。
		 */
		if ( ! grouped.has( key ) ) grouped.set( key, { character, expected, matches: [] } );
		grouped.get( key ).matches.push( wpgpt_ja_match( index, index + 1 ) );
	}
	return Array.from( grouped.values(), ( item ) => wpgpt_ja_finding(
		'ja_half_width',
		WPGPT_JA_STYLE_GUIDE.half_width,
		`「${item.character}」は半角の「${item.expected}」で表記してください`,
		item.matches
	) );
}

/**
 * ルール 1-4「半角文字と全角文字の間のスペース」を確認する。
 *
 * 半角英字・記号と日本語の境界には原則として半角スペース1つを要求する。
 * 日本語の句読点・括弧類、プレースホルダーなどの技術文字列にはこの境界ルールを適用しない。
 * コロンは一般境界とは別の規則として、前にスペースを置かず、後ろに1つ置く。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-4 に該当する指摘。
 */
function wpgpt_ja_check_half_full_spacing( translated ) {
	const { protected_indexes, hidden_markup_indexes } = wpgpt_ja_protect_technical_text( translated );
	const spacing_text = translated.replace( /%\d*\$?d/gu, ( value ) => '0'.repeat( value.length ) );
	const spacing_characters = new Set( [ ' ', '\u00a0', '　' ] );
	const valid_colon_spacing_characters = new Set( [ ' ', '　' ] );
	const findings = [];
	const boundary_matches = [];
	let boundary_message;
	const symbol_matches = [];
	let unnecessary_symbol;
	const colon_before_matches = [];
	const colon_after_matches = [];

	// 半角文字と日本語の境界を確認し、必要な半角スペースが1つだけ存在することを保証する。
	for ( let index = 0; index < spacing_text.length - 1; index++ ) {
		/*
		 * プレースホルダーなどの技術文字列の内部は、
		 * 表記上の半角・全角境界として扱わない。
		 */
		if ( protected_indexes.has( index ) ) continue;
		const left = spacing_text[ index ] || '';
		let right_index = index + 1;
		let space_count = 0;
		let invalid_space = false;

		/*
		 * 左右の文字の間にある空白をまとめて確認する。
		 * 半角スペース以外の空白が含まれている場合も、
		 * 正しい「半角スペース1つ」の状態ではないものとして扱う。
		 */
		while ( spacing_characters.has( spacing_text[ right_index ] || '' ) ) {
			space_count++;
			invalid_space ||= ' ' !== spacing_text[ right_index ];
			right_index++;
		}

		/*
		 * 空白の先が技術文字列の場合は、
		 * 通常の半角文字と日本語の境界として判定しない。
		 */
		if ( protected_indexes.has( right_index ) ) continue;
		const right = spacing_text[ right_index ] || '';

		/*
		 * 丸括弧、コロン、句読点などはそれぞれ専用の空白規則を持つため、
		 * 半角文字と日本語の一般的な境界判定から除外する。
		 */
		if (
			'(' === left || ')' === right || ')' === left || '(' === right ||
			':' === left || ':' === right ||
			WPGPT_JA_NO_SPACE_PUNCTUATION.has( left ) || WPGPT_JA_NO_SPACE_PUNCTUATION.has( right ) ||
			[ ',', '.', '，', '．', '､', '｡' ].includes( left ) || [ ',', '.', '，', '．', '､', '｡' ].includes( right )
		) continue;
		const left_half = WPGPT_JA_ASCII_NON_DIGIT.test( left ) && ! /\d/.test( left );
		const right_half = WPGPT_JA_ASCII_NON_DIGIT.test( right ) && ! /\d/.test( right );
		const left_japanese = WPGPT_JA_JAPANESE_CHARACTER.test( left );
		const right_japanese = WPGPT_JA_JAPANESE_CHARACTER.test( right );
	
		/*
		 * 半角英字・記号と日本語が隣接する境界では、
		 * 両者の間を半角スペース1つだけにする。
		 */
		if ( ( ( left_half && right_japanese ) || ( left_japanese && right_half ) ) && ( 1 !== space_count || invalid_space ) ) {
			/*
			 * スペースがない場合と、複数・不正な空白がある場合では利用者が行う修正が異なるため、
			 * 案内メッセージを分ける。
			 */
			const message = 0 === space_count
				? `「${left}」と「${right}」の間に半角スペースを入れてください`
				: `「${left}」と「${right}」の間の半角スペースは1つにしてください`;

			/*
			 * 同じ種類の指摘だけを1件にまとめ、
			 * 該当するすべての位置を保持する。
			 */
			if ( boundary_message === undefined ) boundary_message = message;
			// 最初に確定した指摘メッセージと同種の境界だけを、同じ指摘の位置情報としてまとめる。
			if ( boundary_message === message ) boundary_matches.push( wpgpt_ja_match( index, right_index + 1 ) );
		}
	}

	// 日本語の句読点・括弧類は前後に空白を置かないため、隣接する不要な空白を確認する。
	for ( let index = 0; index < translated.length; index++ ) {

		/*
		 * 技術文字列内部の記号は、日本語本文の句読点・括弧として判定しない。
		 */
		if ( protected_indexes.has( index ) ) continue;
		const character = translated[ index ];

		/*
		 * 前後に空白を置かない句読点・括弧類に空白が隣接している場合は、
		 * 不要な空白として指摘する。
		 */
		if (
			WPGPT_JA_NO_SPACE_PUNCTUATION.has( character ) &&
			( spacing_characters.has( translated[ index - 1 ] || '' ) || spacing_characters.has( translated[ index + 1 ] || '' ) )
		) {

			/*
			 * 同じ記号に対する指摘を1件にまとめ、
			 * 該当するすべての位置を保持する。
			 */
			if ( unnecessary_symbol === undefined ) unnecessary_symbol = character;
			if ( unnecessary_symbol === character ) {
				// 前側に空白がある場合は、強調範囲へその不要な空白も含める。
				const start = spacing_characters.has( translated[ index - 1 ] || '' ) ? index - 1 : index;
				// 後側に空白がある場合も、強調範囲へその不要な空白を含める。
				const end = spacing_characters.has( translated[ index + 1 ] || '' ) ? index + 2 : index + 1;
				symbol_matches.push( wpgpt_ja_match( start, end ) );
			}
		}
	}

	// コロン固有の規則として、表示上の前後関係を基準に「前は空白なし、後は1つ」を確認する。
	for ( let index = 0; index < translated.length; index++ ) {

		/*
		 * コロン以外の文字と、技術文字列内部のコロンは
		 * この規則の判定対象としない。
		 */
		if ( ':' !== translated[ index ] || protected_indexes.has( index ) ) continue;
		const before = wpgpt_ja_visible_adjacent_text( translated, hidden_markup_indexes, index - 1, -1, spacing_characters );
		const after = wpgpt_ja_visible_adjacent_text( translated, hidden_markup_indexes, index + 1, 1, spacing_characters );

		/*
		 * 「12:30」のように、空白を挟まず数字同士をコロンで区切る場合は
		 * 時刻表記として扱い、コロン後の空白を要求しない。
		 */
		if (
			before && after &&
			0 === before.spacing_indexes.length && 0 === after.spacing_indexes.length &&
			/\d/u.test( before.character ) && /\d/u.test( after.character )
		) continue;

		/*
		 * コロンの直前には空白を置かないため、
		 * 表示上の直前文字との間に空白があれば指摘する。
		 */
		if ( before && before.spacing_indexes.length > 0 ) {
			colon_before_matches.push( wpgpt_ja_match( Math.min( ...before.spacing_indexes ), index + 1 ) );
		}
		/*
		 * コロンの後ろに表示文字が存在する場合だけ後方の空白を判定する。
		 * 文末のコロンでは、存在しない後続文字に対するスペースを要求しない。
		 */
		if ( after ) {
			/*
			 * コロンの直後は、許可された空白文字が1つだけ存在する状態を正しいものとする。
			 * 空白がない、複数ある、または許可されていない空白文字を含む場合は指摘する。
			 */
			const invalid = after.spacing_indexes.some( ( spacing_index ) => ! valid_colon_spacing_characters.has( translated[ spacing_index ] || '' ) );
			if ( 0 === after.spacing_indexes.length || after.spacing_indexes.length > 1 || invalid ) {
				colon_after_matches.push( wpgpt_ja_match( index, after.character_index + 1 ) );
			}
		}
	}

	// 半角文字と日本語の一般境界に違反があった場合だけ、その指摘を結果へ追加する。
	boundary_message && findings.push( wpgpt_ja_finding( 'ja_half_full_spacing', WPGPT_JA_STYLE_GUIDE.half_full_spacing, boundary_message, boundary_matches ) );
	// 句読点・括弧類の周囲に不要な空白があった場合だけ、その指摘を結果へ追加する。
	unnecessary_symbol && findings.push( wpgpt_ja_finding( 'ja_half_full_spacing', WPGPT_JA_STYLE_GUIDE.half_full_spacing, `「${unnecessary_symbol}」の前後のスペースは不要です`, symbol_matches ) );
	// コロン前の不要な空白が1件以上あった場合だけ、コロン前の指摘を結果へ追加する。
	colon_before_matches.length && findings.push( wpgpt_ja_finding( 'ja_half_full_spacing', WPGPT_JA_STYLE_GUIDE.half_full_spacing, '「:」の前のスペースは不要です', colon_before_matches ) );
	// コロン後の空白不足・不正が1件以上あった場合だけ、コロン後の指摘を結果へ追加する。
	colon_after_matches.length && findings.push( wpgpt_ja_finding( 'ja_half_full_spacing', WPGPT_JA_STYLE_GUIDE.half_full_spacing, '「:」の後にスペースを1つ入れてください', colon_after_matches ) );
	return findings;
}

/**
 * ルール 1-5「半角丸括弧と前後スペース」を確認する。
 *
 * 丸括弧は半角を使用し、日本語句読点や文字列境界などの例外を除いて、
 * 丸括弧の外側には半角スペース1つを置く。
 * マークアップを挟む場合も、画面上で見える文字との境界を基準に判定する。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-5 に該当する指摘。
 */
function wpgpt_ja_check_parentheses( translated ) {
	const { protected_indexes, hidden_markup_indexes } = wpgpt_ja_protect_technical_text( translated );
	const findings = [];
	const full_width_matches = [];
	const outer_matches = [];
	// 丸括弧の表記と、利用者に見える外側文字とのスペース関係を翻訳文全体で確認する。
	for ( let index = 0; index < translated.length; index++ ) {

		/*
		 * プレースホルダーなどの技術文字列内部にある丸括弧は、
		 * 日本語本文の表記ルールの対象としない。
		 */
		if ( protected_indexes.has( index ) ) continue;
		const character = translated[ index ];

		/*
		 * 日本語本文の丸括弧には半角を使用するため、
		 * 全角の開き括弧・閉じ括弧を指摘する。
		 */
		if ( '（' === character || '）' === character ) full_width_matches.push( wpgpt_ja_match( index, index + 1 ) );

		/*
		 * 文字列の先頭以外にある開き括弧は、
		 * 画面上で直前に見える文字との間隔を確認する。
		 */
		if ( '(' === character && index > 0 ) {
			const outside = wpgpt_ja_outer_parentheses_spacing( translated, hidden_markup_indexes, index - 1, -1 );

			/*
			 * 日本語句読点など、外側にスペースを必要としない例外を除き、
			 * 開き括弧の直前には半角スペース1つを要求する。
			 */
			if ( outside && ! WPGPT_JA_OUTER_PARENTHESES_SPACE_EXCEPTIONS.has( outside.character ) && 1 !== outside.space_count ) {
				outer_matches.push( wpgpt_ja_match( Math.max( 0, index - Math.max( 1, outside.space_count ) ), index + 1 ) );
			}
		}

		/*
		 * 文字列の末尾以外にある閉じ括弧は、
		 * 画面上で直後に見える文字との間隔を確認する。
		 */
		if ( ')' === character && index < translated.length - 1 ) {
			const outside = wpgpt_ja_outer_parentheses_spacing( translated, hidden_markup_indexes, index + 1, 1 );

			/*
			 * 閉じ括弧の直後が句点などの例外でない場合は、
			 * 外側に半角スペース1つを要求する。
			 * 「。」は閉じ括弧の直後に直接置けるため、明示的に対象外とする。
			 */
			if ( outside && '。' !== outside.character && ! WPGPT_JA_OUTER_PARENTHESES_SPACE_EXCEPTIONS.has( outside.character ) && 1 !== outside.space_count ) {
				outer_matches.push( wpgpt_ja_match( index, Math.min( translated.length, index + Math.max( 2, outside.space_count + 1 ) ) ) );
			}
		}
	}
	// 全角丸括弧が1件以上見つかった場合だけ、半角丸括弧への修正指摘を追加する。
	full_width_matches.length && findings.push( wpgpt_ja_finding( 'ja_parentheses', WPGPT_JA_STYLE_GUIDE.parentheses, '丸括弧は半角の「( )」を使用してください', full_width_matches ) );
	// 丸括弧外側のスペース違反が1件以上見つかった場合だけ、その指摘を追加する。
	outer_matches.length && findings.push( wpgpt_ja_finding( 'ja_parentheses', WPGPT_JA_STYLE_GUIDE.parentheses, '丸括弧の外側は半角スペース1つにしてください', outer_matches ) );
	return findings;
}

/**
 * ルール 1-6「丸括弧内側の不要スペース」を確認する。
 *
 * 半角丸括弧の直後・直前には空白を置かない。
 * 技術文字列内部の丸括弧は対象外とする。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-6 に該当する指摘。
 */
function wpgpt_ja_check_inner_parentheses_spacing( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const matches = [];
	// 翻訳文全体の丸括弧を走査し、開き側・閉じ側それぞれの内側空白を確認する。
	for ( let index = 0; index < translated.length; index++ ) {

		/*
		 * プレースホルダーなどの技術文字列内部にある丸括弧は、
		 * 日本語本文の空白ルールの対象としない。
		 */
		if ( protected_indexes.has( index ) ) continue;

		/*
		 * 開き括弧の直後が技術文字列ではなく空白の場合は、
		 * 丸括弧内側の不要な空白として指摘する。
		 */
		if ( '(' === translated[ index ] && ! protected_indexes.has( index + 1 ) && /\s/u.test( translated[ index + 1 ] || '' ) ) matches.push( wpgpt_ja_match( index + 1, index + 2 ) );

		/*
		 * 閉じ括弧の直前が技術文字列ではなく空白の場合は、
		 * 丸括弧内側の不要な空白として指摘する。
		 */
		if ( ')' === translated[ index ] && ! protected_indexes.has( index - 1 ) && /\s/u.test( translated[ index - 1 ] || '' ) ) matches.push( wpgpt_ja_match( index - 1, index ) );
	}
	// 内側の不要な空白が1件以上ある場合だけルール 1-6 の指摘を返す。
	return matches.length ? [ wpgpt_ja_finding( 'ja_inner_parentheses_spacing', WPGPT_JA_STYLE_GUIDE.inner_parentheses_spacing, '丸括弧の内側のスペースは削除してください', matches ) ] : [];
}

/**
 * ルール 1-7「括弧内末尾の句点」を確認する。
 *
 * 文中の丸括弧内が句点「。」で終わる場合は、その句点を削除対象とする。
 * 翻訳文全体が「。)」で終わる場合はルール 1-8 が責務を持つため、重複して指摘しない。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-7 に該当する指摘。
 */
function wpgpt_ja_check_period_inside_parentheses( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const matches = [];

	/*
	 * 現在の文字とその直後の文字を組み合わせて確認するため、
	 * 次の文字が存在する位置までを判定対象とする。
	 */
	for ( let index = 0; index < translated.length - 1; index++ ) {

		/*
		 * 技術文字列の外側にある「。)」のうち、
		 * 翻訳文末ではないものだけを括弧内末尾の句点として指摘する。
		 * 文末の「。)」はルール 1-8 で扱うため、このルールでは対象外とする。
		 */
		if ( '。' === translated[ index ] && ')' === translated[ index + 1 ] && ! protected_indexes.has( index ) && ! protected_indexes.has( index + 1 ) && index + 1 !== translated.length - 1 ) {
			matches.push( wpgpt_ja_match( index, index + 1 ) );
		}
	}
	// 文中の括弧内末尾に句点が1件以上見つかった場合だけルール 1-7 の指摘を返す。
	return matches.length ? [ wpgpt_ja_finding( 'ja_period_inside_parentheses', WPGPT_JA_STYLE_GUIDE.period_inside_parentheses, '丸括弧内の末尾の句点は削除してください', matches ) ] : [];
}

/**
 * ルール 1-8「文末括弧と句点の位置」を確認する。
 *
 * 文末が「。)」となっている場合は、句点を閉じ丸括弧の外へ置く必要がある。
 * 単に閉じ丸括弧で終わるだけの文から、句点不足を推測して指摘することはしない。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-8 に該当する指摘。
 */
function wpgpt_ja_check_sentence_ending_parentheses( translated ) {
	/*
	 * このルールで指摘するのは、翻訳文が明確に「。)」で終わる場合だけとする。
	 * 閉じ丸括弧だけで終わる文については、句点が必要かどうかを推測しない。
	 */
	if ( ! /。\)$/u.test( translated ) ) return [];
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const period_index = translated.length - 2;
	const closing_index = translated.length - 1;
	/*
	 * 文末の句点または閉じ丸括弧が技術文字列の一部である場合は、
	 * 日本語本文の句点配置ルールの対象としない。
	 */
	if ( protected_indexes.has( period_index ) || protected_indexes.has( closing_index ) ) return [];
	return [ wpgpt_ja_finding( 'ja_sentence_ending_parentheses', WPGPT_JA_STYLE_GUIDE.sentence_ending_parentheses, '文末の句点は丸括弧の外に置いてください', [ wpgpt_ja_match( period_index, closing_index + 1 ) ] ) ];
}

/**
 * ルール 1-9「半角数字前後の不要スペース」を確認する。
 *
 * 半角数字または数値プレースホルダーと日本語の間にはスペースを置かない。
 * 時刻、識別子、バージョン、ファイル名などの技術的な半角トークンの一部は対象外とする。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 1-9 に該当する指摘。
 */
function wpgpt_ja_check_number_spacing( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );

	/*
	 * 半角数字の並び、または「%d」「%1$d」などの
	 * 整数を表す数値プレースホルダーを判定対象とする。
	 */
	const numeric_token = '(?:\\d+|%\\d*\\$?d)';
	const japanese = '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]';
	const pattern = new RegExp( `(?:(${numeric_token}) +(${japanese})|(${japanese}) +(${numeric_token}))`, 'gu' );
	const matches = [];
	// 数字と日本語の間にある空白候補を確認し、技術的な半角トークンに属さない箇所だけを指摘する。
	for ( const match of translated.matchAll( pattern ) ) {
		const value = match[ 0 ];
		const start = match.index;
		const numeric = match[ 1 ] || match[ 4 ];

		/*
		 * 数字または数値プレースホルダーを含む候補だけを判定対象とする。
		 */
		if ( ! numeric ) continue;
		const numeric_offset = value.indexOf( numeric );
		const numeric_start = start + numeric_offset;
		const numeric_end = numeric_start + numeric.length;

		/*
		 * プレースホルダーなど、保護された技術文字列に含まれる数値は
		 * 日本語本文の数字表記として扱わない。
		 */
		if ( protected_indexes.has( numeric_start ) ) continue;

		/*
		 * 通常の半角数字については、英数字や「_」「.」「-」と連続している場合、
		 * 識別子、バージョン、ファイル名などの技術的なトークンの一部として扱う。
		 * 数値プレースホルダーは、それ自体を1つの数値トークンとして
	 * 日本語とのスペースをルール 1-9 で判定するため、この確認を行わない。
		 */
		if ( ! numeric.startsWith( '%' ) ) {
			const before = translated[ numeric_start - 1 ] || '';
			const after = translated[ numeric_end ] || '';

			/*
			 * 数字の前後どちらかが技術的な半角文字と連続している場合は、
			 * 数字と日本語の間の空白ルールの対象外とする。
			 */
			if ( /[A-Za-z0-9_.-]/u.test( before ) || /[A-Za-z0-9_.-]/u.test( after ) ) continue;
		}
		matches.push( wpgpt_ja_match( start, start + value.length ) );
	}
	// 数字と日本語の間の不要な空白が1件以上ある場合だけルール 1-9 の指摘を返す。
	return matches.length ? [ wpgpt_ja_finding( 'ja_number_spacing', WPGPT_JA_STYLE_GUIDE.number_spacing, '半角数字と日本語の間のスペースは削除してください', matches ) ] : [];
}

/**
 * ルール 3-2「View XX の訳し方」を確認する。
 *
 * 原文が「View XX」の操作表現である場合は「〜を表示 (する)」への統一を確認する。
 * 「〜の表示」のような名詞表現は、この操作表現を満たしたものとは扱わない。
 *
 * @param {string} singular_original 原文。
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 3-2 に該当する確認指摘。
 */
function wpgpt_ja_check_view_expression( singular_original, translated ) {
	/*
	 * 原文が「View XX」で始まる操作表現でない場合は、
	 * この翻訳ルールの対象としない。
	 */
	if ( ! /^View\s+\S+/u.test( singular_original ) ) return [];

	/*
	 * 「〜を表示」または「〜を表示する」と訳され、
	 * 名詞表現の「〜の表示」になっていなければ適切な訳として扱う。
	 */
	if ( /を表示(?:する)?/u.test( translated ) && ! /の表示/u.test( translated ) ) return [];

	return [ wpgpt_ja_finding(
		'ja_view_expression',
		WPGPT_JA_STYLE_GUIDE.view_expression,
		'「View XX」の訳し方を確認してください'
	) ];
}

/**
 * ルール 3-3「not allowed to の権限表現」を確認する。
 *
 * ユーザーや権限ロールを主語とする「not allowed to」は、
 * 権限不足を表す「〜する権限がありません」へ統一する。
 * 値制約など権限と無関係な「not allowed to」には適用しない。
 *
 * @param {string} singular_original 原文。
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 3-3 に該当する確認指摘。
 */
function wpgpt_ja_check_not_allowed_expression( singular_original, translated ) {
	/*
	 * 「you」「user」「administrator」など、利用者や権限ロールを主語として
	 * 「not allowed to」が使われている原文だけを権限不足の表現として扱う。
	 */
	const permission_source = /\b(?:you|users?|administrators?|editors?|authors?|contributors?|subscribers?|customers?|members?)\s+(?:is|are) not allowed to\b/iu;

	/*
	 * 権限不足を表す「not allowed to」でない場合は、
	 * 値制約など別の意味で使われている可能性があるため判定しない。
	 */
	if ( ! permission_source.test( singular_original ) ) return [];

	/*
	 * 「権限がありません」と訳されていれば、
	 * 権限不足を表す訳として適切なものと扱う。
	 */
	if ( /権限がありません/u.test( translated ) ) return [];

	return [ wpgpt_ja_finding(
		'ja_not_allowed_expression',
		WPGPT_JA_STYLE_GUIDE.not_allowed_expression,
		'「not allowed to ...」の訳し方を確認してください'
	) ];
}

/**
 * ルール 3-4「原文先頭の Sorry を訳さない」を確認する。
 *
 * 原文が「Sorry,」で始まる場合、翻訳文先頭に対応する謝罪表現を残さない。
 * 原文途中の sorry や、明示的な謝罪表現として特定できない訳文は対象外とする。
 *
 * @param {string} singular_original 原文。
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 3-4 に該当する指摘。
 */
function wpgpt_ja_check_sorry_prefix( singular_original, translated ) {
	/*
	 * 原文先頭の「Sorry,」だけをこのルールの対象とし、
	 * 文中に現れる sorry は判定しない。
	 */
	if ( ! /^Sorry,\s*/u.test( singular_original ) ) return [];

	/*
	 * 翻訳文の先頭に「申し訳ありません」など、
	 * 原文の「Sorry,」に対応すると判断できる謝罪表現が残っているか確認する。
	 */
	const prefix = WPGPT_JA_APOLOGY_PREFIXES.find(
		// 登録済みの謝罪表現のうち、翻訳文の先頭と一致する最初の候補を採用する。
		( candidate ) => translated.startsWith( candidate )
	);

	/*
	 * 対応する謝罪表現が見つかった場合だけ、
	 * その先頭部分を削除対象として指摘する。
	 */
	return prefix
		? [ wpgpt_ja_finding(
			'ja_sorry_prefix',
			WPGPT_JA_STYLE_GUIDE.sorry_prefix,
			'先頭の「Sorry,」に対応する謝罪表現を削除してください',
			[ wpgpt_ja_match( 0, prefix.length ) ]
		) ]
		: [];
}

/**
 * ルール 3-6「推奨表記」を確認する。
 *
 * 「下さい」「全て」「既に」を、それぞれ「ください」「すべて」「すでに」へ統一する。
 * コードなどの技術文字列内部は対象外とする。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 3-6 に該当する指摘。
 */
function wpgpt_ja_check_recommended_expressions( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const recommendations = [ [ '下さい', 'ください' ], [ '全て', 'すべて' ], [ '既に', 'すでに' ] ];
	const findings = [];

	// 推奨表記ごとに翻訳文全体を確認し、同じ表記の複数箇所は1件の指摘へまとめる。
	recommendations.forEach( ( recommendation ) => {
		const [ detected, expected ] = recommendation;
		const matches = [];
		let index = translated.indexOf( detected );

		/*
		 * 対象となる表記が翻訳文内に複数ある場合も、
		 * 出現箇所を順番にすべて確認する。
		 */
		while ( -1 !== index ) {
			/*
			 * コードなどの技術文字列内部にある表記は変更対象とせず、
			 * 日本語本文に現れるものだけを指摘する。
			 */
			if ( ! protected_indexes.has( index ) ) {
				matches.push( wpgpt_ja_match( index, index + detected.length ) );
			}

			index = translated.indexOf( detected, index + detected.length );
		}

		/*
		 * 同じ推奨表記に対する指摘は1件にまとめ、
		 * 該当するすべての位置を保持する。
		 */
		if ( matches.length ) {
			findings.push(
				wpgpt_ja_finding(
					'ja_recommended_expressions',
					WPGPT_JA_STYLE_GUIDE.recommended_expressions,
					`「${detected}」は「${expected}」と表記してください`,
					matches
				)
			);
		}
	} );

	return findings;
}

/**
 * ルール 5「中点『・』」を確認する。
 *
 * 全角中点「・」と半角中黒「･」は原則使用しないため、
 * 通常本文に現れた場合は別表現へ置き換え可能か確認を促す。
 * 技術文字列内部は対象外とする。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @returns {Array<Object>} ルール 5 に該当する確認指摘。
 */
function wpgpt_ja_check_middle_dot( translated ) {
	const { protected_indexes } = wpgpt_ja_protect_technical_text( translated );
	const matches = [];

	/*
	 * 翻訳文全体から中点を探し、
	 * 日本語本文で使用されている箇所だけを確認対象とする。
	 */
	for ( let index = 0; index < translated.length; index++ ) {
		/*
		 * コードなどの技術文字列内部にある文字は、
		 * 日本語本文の表記ルールの対象としない。
		 */
		if ( protected_indexes.has( index ) ) continue;

		/*
		 * 全角中点「・」または半角中黒「･」が使用されている場合は、
		 * 別の表現へ置き換えられないか確認する箇所として記録する。
		 */
		if ( [ '・', '･' ].includes( translated[ index ] ) ) {
			matches.push( wpgpt_ja_match( index, index + 1 ) );
		}
	}

	// 中点が1件以上見つかった場合だけルール 5 の確認指摘を返す。
	return matches.length
		? [ wpgpt_ja_finding(
			'ja_middle_dot',
			WPGPT_JA_STYLE_GUIDE.middle_dot,
			'中点「・」は原則使用しません。別の表現に置き換えられないか確認してください',
			matches
		) ]
		: [];
}

/**
 * 日本語チェックの指摘から、安全に強調表示できる文字列だけを選ぶ。
 *
 * マークアップを含む範囲は DOM を壊す可能性があるため強調しない。
 * 同じ文字列が複数箇所に存在する場合は、文字列だけでは指摘位置を一意に特定できないため強調しない。
 * 指摘自体は保持し、強調表示できないことを理由に警告や通知を失わせない。
 *
 * @param {string} translated 判定対象の翻訳文。
 * @param {Array<Object>} findings 日本語チェックで生成された指摘。
 * @returns {string[]} 一意かつ安全に強調表示できる文字列。
 */
function wpgpt_ja_safe_highlights( translated, findings ) {
	const { hidden_markup_indexes } = wpgpt_ja_protect_technical_text( translated );
	const highlights = [];

	/*
	 * 各指摘の位置情報を確認し、
	 * 表示構造を壊さず一意に特定できる箇所だけを強調表示候補へ加える。
	 */
	findings.forEach( ( finding ) => {
		// 1つの指摘が複数箇所を持つ場合も、各範囲を個別に安全性判定する。
		finding.matches.forEach( ( match ) => {
			const value = translated.slice( match.start, match.end );

			/*
			 * 指摘範囲から表示対象となる文字列を取得できない場合は、
			 * 強調表示の対象としない。
			 */
			if ( ! value ) return;

			/*
			 * 指摘範囲に HTML などの表示されないマークアップが含まれる場合は、
			 * DOM 構造を壊す可能性があるため強調表示しない。
			 */
			for ( let index = match.start; index < match.end; index++ ) {
				// 指摘範囲のどこか1文字でも非表示マークアップなら、その範囲全体を強調対象外とする。
				if ( hidden_markup_indexes.has( index ) ) return;
			}

			/*
			 * 同じ文字列が翻訳文内の複数箇所に存在する場合は、
			 * 文字列だけでは今回の指摘位置を一意に特定できないため強調表示しない。
			 */
			if (
				translated.indexOf( value ) !== match.start ||
				translated.lastIndexOf( value ) !== match.start
			) return;

			highlights.push( value );
		} );
	} );

	return highlights;
}

/**
 * 有効な日本語ルールをまとめて実行し、WPGP Tools の警告・通知・強調表示へ統合する。
 *
 * 通常は日本語ロケールでのみ実行する。
 * 各ルールの指摘は設定された重要度に従って警告または通知へ振り分け、
 * 「nothing」が選択されたルールは表示対象から除外する。
 * 強調表示は、表示対象の指摘のうち安全に位置を特定できるものだけを追加する。
 *
 * @param {Object} results WPGP Tools が収集している警告・通知・強調表示の結果。
 * @param {string} singular_original 原文。
 * @param {string} translated 判定対象の翻訳文。
 * @param {boolean} require_japanese_locale 日本語ロケールであることを実行条件とするか。
 * @returns {void}
 */
function wpgpt_run_japanese_checks( results, singular_original, translated, require_japanese_locale = true ) {
	/*
	 * 通常の翻訳チェックでは日本語ロケールだけを対象とする。
	 * 個別確認などでロケール判定を不要とする場合は、この条件を無効化できる。
	 */
	if ( require_japanese_locale && ! wpgpt_is_japanese_locale() ) return;

	/*
	 * 各日本語ルールを実行し、検出された指摘を共通の形式でまとめる。
	 * 原文の表現も確認するルールには、原文と翻訳文の両方を渡す。
	 */
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
		...wpgpt_ja_check_view_expression( singular_original, translated ),
		...wpgpt_ja_check_not_allowed_expression( singular_original, translated ),
		...wpgpt_ja_check_sorry_prefix( singular_original, translated ),
		...wpgpt_ja_check_middle_dot( translated ),
	];

	/*
	 * 各指摘を利用者設定の重要度へ振り分け、
	 * 無効化されたルールは警告・通知へ追加しない。
	 */
	findings.forEach( ( finding ) => {
		const severity = wpgpt_settings[ finding.setting ].state;

		/*
		 * 「nothing」が選択されているルールは、
		 * 利用者が表示を無効化しているため結果へ含めない。
		 */
		if ( 'nothing' === severity ) return;

		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${finding.style_guide_item}: ${finding.message}`;
		wpgpt_push1( results[ severity ], msg );
	} );

	/*
	 * 表示が有効な指摘だけを対象として、
	 * DOM を壊さず一意に位置を特定できる箇所を強調表示へ追加する。
	 */
	wpgpt_push(
		results.highlight_me,
		wpgpt_ja_safe_highlights(
			translated,
			findings.filter(
				// 利用者が表示を無効化していないルールの指摘だけを強調表示候補へ渡す。
				( finding ) => 'nothing' !== wpgpt_settings[ finding.setting ].state
			)
		)
	);
}

function wpgpt_run_romanian_checks( results, translated ) {
	if ( wpgpt_settings.ro_diacritics.state !== 'nothing' ) {
		const ro_diacritics = wpgpt_check_ro_diacritics( translated );
		wpgpt_push1( results[ wpgpt_settings.ro_diacritics.state ], ro_diacritics.msg );
		ro_diacritics.arr.length && wpgpt_push( results.highlight_me, ro_diacritics.arr );
	}

	if ( wpgpt_settings.ro_quotes.state !== 'nothing' ) {
		const ro_quotes = wpgpt_check_ro_quotes( translated );
		wpgpt_push1( results[ wpgpt_settings.ro_quotes.state ], ro_quotes.msg );
		ro_quotes.arr.length && wpgpt_push( results.highlight_me, ro_quotes.arr );
	}

	if ( wpgpt_settings.ro_slash.state !== 'nothing' ) {
		const ro_slash = wpgpt_check_ro_slash( translated );
		wpgpt_push1( results[ wpgpt_settings.ro_slash.state ], ro_slash.msg );
		wpgpt_push1( results.highlight_me, ro_slash.symbol );
	}

	if ( wpgpt_settings.ro_ampersand.state !== 'nothing' ) {
		wpgpt_push1( results[ wpgpt_settings.ro_ampersand.state ], wpgpt_check_ro_ampersand( translated ) );
	}

	if ( wpgpt_settings.ro_dash.state !== 'nothing' ) {
		const ro_dash = wpgpt_check_ro_dash( translated );
		wpgpt_push1( results[ wpgpt_settings.ro_dash.state ], ro_dash.msg );
		wpgpt_push1( results.highlight_me, ro_dash.symbol );
	}
}

function wpgpt_check_placeholders( original, translated ) {
	const placeholder_pattern = /(?:%[bcdefgosuxl]|%\d[$][bcdefgosuxl])/g;
	const original_ph = original.match( placeholder_pattern );
	const translated_ph = translated.match( placeholder_pattern );
	if (
		original_ph !== null ||
		translated_ph !== null
	) {
		const msg = wpgpt_li.cloneNode( true );
		if (
			original_ph !== null &&
			null === translated_ph
		) {
			msg.textContent = `Missing/broken placeholder${( original_ph.length > 1 ) ? 's' : ''}: ${original_ph.toString()}`;
			return msg;
		} else {
			if (
				null === original_ph &&
				translated_ph !== null
			) {
				msg.textContent = `Additional placeholder${( translated_ph.length > 1 ) ? 's' : ''}: ${translated_ph.toString()}`;
				return msg;
			} else {
				if ( original_ph.length < translated_ph.length ) {
					msg.textContent = `Additional placeholder${( ( translated_ph.length - original_ph.length ) > 1 ) ? 's' : ''}: ${arr_diff( translated_ph, original_ph )}`;
					return msg;
				}
				if ( original_ph.length > translated_ph.length ) {
					msg.textContent = `Missing/broken placeholder${( ( original_ph.length - translated_ph.length ) > 1 ) ? 's' : ''}: ${arr_diff( original_ph, translated_ph )}`;
					return msg;
				}
				if ( original_ph.length === translated_ph.length ) {
					original_ph.sort();
					translated_ph.sort();
					const broken_placeholders = [];
					original_ph.forEach( ( original_ph, i ) => {
						if ( original_ph !== translated_ph[ i ] ) {
							broken_placeholders[ broken_placeholders.length ] = `${translated_ph[ i ]} instead of ${original_ph}`;
						}
					} );
					if ( broken_placeholders.length ) {
						msg.textContent = `Possible broken: ${broken_placeholders.toString()}`;
						return msg;
					}
				}
			}
		}
	}
	return '';
}

function wpgpt_check_start_space( translated_first, original_first ) {
	if ( ' ' === translated_first && original_first !== ' '	) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Additional start space';
		return msg;
	}
	if ( translated_first !== ' ' && ' ' === original_first	) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Missing start space';
		return msg;
	}
	return '';
}

function wpgpt_check_end_space ( translated_last, original_last ) {
	if ( ' ' === translated_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Additional end space';
		return msg;
	}
	if ( '	' === translated_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Additional end tab';
		return msg;
	}
	if ( ' ' === original_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Missing end space';
		return msg;
	}
	if ( '	' === original_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Missing end tab';
		return msg;
	}

	return '';
}

function wpgpt_check_end_colon ( translated_last, original_last ) {
	if ( ':' === original_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Missing end :';
		return msg;
	}
	if ( ':' === translated_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Additional end :';
		return msg;
	}
	return '';
}

function wpgpt_check_end_question_exclamation ( original_last ) {
	if ( '?' === original_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Missing end ?';
		return msg;
	}
	if ( '!' === original_last ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = 'Missing end !';
		return msg;
	}
	return '';
}

/** Missing end period symbol;
* Ignore if:
*	a. original ends with . and translation ends with a period symbol
*	b. char - period swap( char should not be a letter or number ); Ideal examples: ". => ." or ). => .)
*	c. tag - period swap
*	d. 3 periods translated as elipsis
*/
function wpgpt_check_missing_end_symbol ( translated, original, translated_last, original_last ) {
	let not_tag_period_swap = true,
		not_translated_as_elipsis = true,
		not_character_period_swap = true;
	const original_last_but_one = original.substr( original.length - 2, 1 );
	const translated_last_but_one = translated.substr( translated.length - 2, 1 );

	if ( '.' === original_last && translated_last !== wpgpt_period && translated_last !== '.' ) {
		const a = ( translated_last_but_one === wpgpt_period || '.' === translated_last_but_one );
		const b = ( original_last_but_one === translated_last || is_locale_alternative( original_last_but_one, translated_last ) );
		const c = ( /[^a-zA-Z1-50]/ ).test( translated_last );
		not_character_period_swap = ! (	a && b && c );
		if ( not_character_period_swap ) {
			if ( '>' === translated_last ) {
				let translated_last_period_index = translated.lastIndexOf( wpgpt_period );
				let translated_last_tag = translated.substr( translated_last_period_index + 1 );
				if ( translated_last_tag === original.substr( original.length - translated_last_tag.length - 1, translated_last_tag.length ) ) {
					not_tag_period_swap = false;
				} else if ( wpgpt_period !== '.' ) {
					translated_last_period_index = translated.lastIndexOf( '.' );
					translated_last_tag = translated.substr( translated_last_period_index + 1 );
					if ( translated_last_tag === original.substr( original.length - translated_last_tag.length - 1, translated_last_tag.length ) ) {
						not_tag_period_swap = false;
					}
				}
			}
			if ( not_tag_period_swap ) {
				not_translated_as_elipsis = ! ( '…' === translated_last && '.' === original_last_but_one );
			}
		}

		if ( not_tag_period_swap && not_translated_as_elipsis && not_character_period_swap ) {
			const msg = wpgpt_li.cloneNode( true );
			msg.textContent = `Missing end period (${wpgpt_period}${( wpgpt_period !== '.' ) ? ' or . ' : ''})`;
			return msg;
		}
	}
	return '';
}

/* Additional end period symbol
* Ignore if:
*	a. original doesn't end with . and translation doesn't end with period symbol
*	b. period - char swap ( char should not be a letter or number )
*	c. period - tag swap
*	d. elipsis translated as 3 periods
*/
function wpgpt_check_additional_end_symbol ( translated, original, translated_last, original_last ) {
	let not_period_tag_swap = true,
		not_translated_from_elipsis = true,
		not_period_character_swap = true;
	const original_last_but_one = original.substr( original.length - 2, 1 );
	const translated_last_but_one = translated.substr( translated.length - 2, 1 );

	if ( original_last !== '.' && ( translated_last === wpgpt_period || '.' === translated_last ) ) {
		if ( '.' === translated && original.includes( 'number_format' ) ) {
			return '';
		}
		const a = ( original_last_but_one === wpgpt_period || '.' === original_last_but_one );
		const b = ( original_last === translated_last_but_one || is_locale_alternative( original_last, translated_last_but_one ) );
		const c = ( /[^a-zA-Z1-50]/ ).test( original_last );
		not_period_character_swap = ! (	a && b && c );
		if ( not_period_character_swap ) {
			if ( '>' === translated_last_but_one ) {
				const original_last_period_index = original.lastIndexOf( '.' );
				const original_last_tag = original.substr( original_last_period_index + 1 );
				if ( original_last_tag === translated.substr( translated.length - original_last_tag.length - 1, original_last_tag.length ) ) {
					not_period_tag_swap = false;
				}
			}
			if ( not_period_tag_swap ) {
				not_translated_from_elipsis = ! ( '…' === original_last && '.' === translated_last_but_one );
			}
		}

		if ( not_translated_from_elipsis && not_period_character_swap && not_period_tag_swap ) {
			const msg = wpgpt_li.cloneNode( true );
			msg.textContent = `Additional end period (${wpgpt_period}${( wpgpt_period !== '.' ) ? ' or . ' : ''})`;
			return msg;
		}
	}
	return '';
}

function wpgpt_check_double_spaces( translated, original, translation_e_id ) {
	const translated_double_spaces = translated.match( /[^ ]* {2,7}[^ ]*/gm ) || [];
	const original_double_spaces = original.match( /[^ ]* {2,7}[^ ]*/gm ) || [];

	if ( translation_e_id && original_double_spaces.length ) {
		wpgpt_highlights( document.querySelector( `${translation_e_id} .original` ), [ '  ' ], 'wpgpt-space' );
		wpgpt_highlights( document.querySelector( `${translation_e_id.replaceAll( 'editor', 'preview' )} .original-text` ), [ '  ' ], 'wpgpt-space' );
		// To do: Highlight the spaces in the new row after Save process.
	}
	if ( translated_double_spaces.length > original_double_spaces.length ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${translated_double_spaces.length - original_double_spaces.length} double space${( ( translated_double_spaces.length - original_double_spaces.length ) > 1 ) ? 's' : ''}: “${translated_double_spaces.join( '”, “' ).replaceAll( ' ', '\xa0' )}”`;
		return { msg: msg, arr: translated_double_spaces };
	}
	if ( translated_double_spaces.length < original_double_spaces.length ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${original_double_spaces.length - translated_double_spaces.length} missing double space${( ( original_double_spaces.length - translated_double_spaces.length ) > 1 ) ? 's' : ''}`;
		return { msg: msg, arr: [] };
	}
	return { msg: '', arr: [] };
}

function wpgpt_check_warning_words ( translated ) {
	const result = { msg: '', arr: [] };
	wpgpt_settings.warning_words.state.split( ',' ).forEach( ( word ) => {
		( word !== '' && word !== ' ' ) && wpgpt_occurrences( translated, word ) && wpgpt_push1( result.arr, word );
	} );
	if ( result.arr.length ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `Using “${result.arr.join( ', ' )}”`;
		msg.className = 'has-highlight';
		result.msg = msg;
	}
	return result;
}

function wpgpt_check_match_words( translated, original ) {
	let msgTxt = '';
	wpgpt_settings.match_words.state.split( ',' ).forEach( ( word ) => {
		if ( word !== '' && word !== ' ' ) {
			const word_in_translated = wpgpt_occurrences( translated, word );
			const word_in_original = wpgpt_occurrences( original, word );
			if ( word_in_translated > word_in_original ) {
				msgTxt += `Additional ${word_in_translated - word_in_original} “${word}”`;
			} else if ( word_in_translated < word_in_original ) {
				msgTxt += `Missing ${word_in_original - word_in_translated} “${word}”`;
			}
		}
	} );
	if ( msgTxt !== '' ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = msgTxt;
		return msg;
	}
	return '';
}

function wpgpt_check_tag_spaces( translated ) {
	const bad_tags_spaces = translated.replaceAll( 'br', '' ).match( /[^"'`„“([>/\s]+<[^>/]+>|<[^>/]+>\s|<\/[^>]+>[^.,!?:。।։។။།۔"'`”)\]+</\s]|\s<\/[^>]+>/g );
	if ( bad_tags_spaces !== null ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${bad_tags_spaces.length} wrong space${( bad_tags_spaces.length > 1 ) ? 's' : ''}: “${bad_tags_spaces.toString()}”`;
		msg.className = 'has-highlight';
		return { msg: msg, arr: bad_tags_spaces };
	}
	return { msg: '', arr: [] };
}

function wpgpt_check_ro_diacritics( translated ) {
	const not_using_ro_diacritics = translated.match( /[ãşţ]/ig );
	if ( not_using_ro_diacritics !== null ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${not_using_ro_diacritics.length} wrong diacritic${( not_using_ro_diacritics.length > 1 ) ? 's' : ''}: “${not_using_ro_diacritics.toString()}”`;
		msg.className = 'has-highlight';
		return { msg: msg, arr: not_using_ro_diacritics };
	}
	return { msg: '', arr: [] };
}

function wpgpt_check_ro_quotes ( translated ) {
	const result = { msg: '', arr: [] };
	const not_using_ro_quotes = translated.match( /(?<!=)"(?:[^"<=>]*)"|(?<!=)'(?:[^'<=>]*)'/g );
	if ( not_using_ro_quotes !== null ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${not_using_ro_quotes.length} wrong quotes: ${not_using_ro_quotes.toString()}. Use „ ”`;
		msg.className = 'has-highlight';
		return { msg: msg, arr: not_using_ro_quotes };
	}
	[ '&quot;', '&#34;', '&apos;', '&#39;', '&ldquo;', '&#8220;', '“' ].forEach( ( word ) => {
		( wpgpt_occurrences( translated, word ) ) && wpgpt_push1( result.arr, word );
	} );
	if ( result.arr.length ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${result.arr.length} wrong quote: ${result.arr.join( ', ' ).replaceAll( '&', '&amp;' )}`;
		msg.className = 'has-highlight';
	}
	return result;
}

function wpgpt_check_ro_slash ( translated ) {
	const not_using_ro_slash_spaces = wpgpt_occurrences( translated, ' / ' );
	if ( not_using_ro_slash_spaces ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `${not_using_ro_slash_spaces} / space${( not_using_ro_slash_spaces > 1 ) ? 's' : ''}`;
		msg.className = 'has-highlight';
		return { msg: msg, symbol: ' / ' };
	}
	return { msg: '', symbol: '' };
}

function wpgpt_check_ro_ampersand ( translated ) {
	const not_using_ro_ampersand = translated.match( /[&](?!.{1,7}?[;=])/g );
	if ( not_using_ro_ampersand !== null ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `Using ${not_using_ro_ampersand.length} &`;
		return msg;
	}
	return '';
}

function wpgpt_check_ro_dash ( translated ) {
	const not_using_ro_dash = wpgpt_occurrences( translated, '—' );
	if ( not_using_ro_dash ) {
		const msg = wpgpt_li.cloneNode( true );
		msg.textContent = `Using ${not_using_ro_dash} —`;
		msg.className = 'has-highlight';
		return { msg: msg, symbol: '—' };
	}
	return { msg: '', symbol: '' };
}

/*
*	Fix for ro_RO case where original ends with << "WordPress." >> and translation ends with << „WordPress”. >>
*	Others alternatives can be added for other locales.
*/
function is_locale_alternative( original, translated ) {
	if ( 'enabled' === wpgpt_settings.ro_checks.state ) {
		const en_end_characters = [ '"' ];
		const ro_end_characters = [ '”' ];

		for ( let i = 0; i < en_end_characters.length; i++ ) {
			if ( en_end_characters[ i ] === original && ro_end_characters[i] === translated ) {
				return true;
			}
		}
	}
	return false;
}

// Function adapted from https://stackoverflow.com/a/29798094
function wpgpt_highlights( looking_for_container, looking_for_arr, highlight_class ) {
	function span_inserter( n, looking_for ) {
		let node_val = n.nodeValue, found_index, begin, matched, text_node, span;
		const parent_node = n.parentNode;
		while ( true ) {
			found_index = node_val.toLowerCase().indexOf( looking_for.toLowerCase() );
			if ( found_index < 0 ) {
				if ( node_val ) {
					text_node = document.createTextNode( node_val );
					parent_node.insertBefore( text_node, n );
				}
				parent_node.removeChild( n );
				break;
			}
			begin = node_val.substring( 0, found_index );
			matched = node_val.substr( found_index, looking_for.length );
			if ( begin ) {
				text_node = document.createTextNode( begin );
				parent_node.insertBefore( text_node, n );
			}
			span = document.createElement( 'span' );
			span.className = highlight_class;
			span.appendChild( document.createTextNode( matched ) );
			parent_node.insertBefore( span, n );
			node_val = node_val.substring( found_index + looking_for.length );
		}
	};

	function text_node_iterator( container, looking_for ) {
		if ( null === container ) { return; }
		Array.prototype.slice.call( container.childNodes ).forEach( ( n ) => {
			if ( 3 === n.nodeType ) {
				span_inserter( n, looking_for );
			} else if ( 1 === n.nodeType ) {
				text_node_iterator( n, looking_for );
			}
		} );
	};

	looking_for_arr.forEach( ( looking_for ) => {
		text_node_iterator( looking_for_container, looking_for );
	} );
};

// Prevent leaving without saving.
document.querySelectorAll( 'textarea' ).forEach( ( el ) => { el.addEventListener( 'change', () => { wpgpt_user_edited = true; } ); } );
window.addEventListener( 'beforeunload', ( e ) => {
	if ( 'enabled' === wpgpt_settings.prevent_unsaved.state && wpgpt_user_edited ) {
		const open_editor = document.querySelector( '.editor[style="display: table-row;"] textarea' );
		if ( open_editor && open_editor.value !== '' ) {
			e.preventDefault();
			e.returnValue = '';
			return e;
		}
	}
} );

// Row filter by existance of warnings and notices.
function wpgpt_filters() {
	const notices_count = document.querySelectorAll( '.wpgpt-has-notice' ).length;
	const warnings_count = document.querySelectorAll( '.wpgpt-has-warning' ).length;

	const filtersF = document.createDocumentFragment();
	filtersF.appendChild(
		$wpgpt_createElement( 'a', { 'href': '#', 'title': `Click to view strings with notices only - ${notices_count} strings`, 'class': `wpgpt-filter-notices count-${notices_count}` } ),
	).append( $wpgpt_createElement( 'img', { 'src': wpgpt_notice_icon } ), `Notices (${notices_count})` );
	filtersF.appendChild( $wpgpt_createElement( 'span', { 'class': 'separator' }, ' ' ) );
	filtersF.appendChild(
		$wpgpt_createElement( 'a', { 'href': '#', 'title': `Click to view strings with warnings only - ${warnings_count} strings`, 'class': `wpgpt-filter-warnings count-${warnings_count}` } ),
	).append( $wpgpt_createElement( 'img', { 'src': wpgpt_warning_icon } ), `Warnings (${warnings_count})` );
	filtersF.appendChild( $wpgpt_createElement( 'span', { 'class': 'separator' }, ' ' ) );
	filtersF.appendChild( $wpgpt_createElement( 'a', { 'href': '#', 'title': `Click to view all strings`, 'class': 'wpgpt-filter-all' }, 'All' ) );
	const filters = document.createElement( 'div' );
	filters.className = 'wpgpt-filters';
	filters.appendChild( filtersF );

	const current_filters = document.querySelector( '.wpgpt-filters' );
	const paging = document.querySelector( '.paging' );
	if ( current_filters ) {
		current_filters.parentNode.replaceChild( filters, current_filters );
	} else {
		paging && paging.insertAdjacentElement( 'afterbegin', filters );
	}

	paging && document.querySelector( '.wpgpt-filter-warnings' ).addEventListener( 'click', () => {
		document.querySelectorAll( 'tr.preview' ).forEach( ( el ) => { el.style.display = 'none'; } );
		document.querySelectorAll( 'tr.preview.wpgpt-has-warning' ).forEach( ( el ) => { el.style.display = 'table-row'; } );
	} );

	paging && document.querySelector( '.wpgpt-filter-notices' ).addEventListener( 'click', () => {
		document.querySelectorAll( 'tr.preview' ).forEach( ( el ) => { el.style.display = 'none'; } );
		document.querySelectorAll( 'tr.preview.wpgpt-has-notice' ).forEach( ( el ) => { el.style.display = 'table-row'; } );
	} );
	paging && document.querySelector( '.wpgpt-filter-all' ).addEventListener( 'click', () => {
		document.querySelectorAll( 'tr.preview' ).forEach( ( el ) => { el.style.display = 'table-row'; } );
	} );
}

function arr_diff( a, b ) {
	return a.filter( ( i ) => {
		const pos = b.indexOf( i );
		if ( pos < 0 ) {
			return true;
		} else {
			b[ pos ] += '-checked';
			return false;
		}
	} ).toString();
}

// Count occurrences by Vitim.us at https://gist.github.com/victornpb/7736865
function wpgpt_occurrences( string, subString ) {
	string = `${string.toLowerCase()}`;
	subString = `${subString.toLowerCase()}`;
	if ( subString.length <= 0 ) { return ( string.length + 1 ); }
	let n = 0, pos = 0;
	const step = subString.length;
	while ( true ) {
		pos = string.indexOf( subString, pos );
		if ( pos >= 0 ) { ++n; pos += step; } else { break; }
	}
	return n;
}

// Shorcuts based on: https://meta.trac.wordpress.org/browser/sites/trunk/wordpress.org/public_html/wp-content/plugins/wporg-gp-customizations/templates/js/editor.js#L143
if ( typeof $gp_editor_options !== 'undefined' ) {
	$gp.editor.keydown = ( function( original ) {
		return function( event ) {
			if ( 13 === event.keyCode && event.shiftKey ) {	// Shift-Enter = Save.
				wpgpt_save( event.target.closest( '.editor-panel' ).querySelector( 'button.translation-actions__save' ), event.ctrlKey );
			} else if ( ( 107 === event.keyCode && event.ctrlKey ) || ( 65 === event.keyCode && event.shiftKey && event.ctrlKey ) ) { // Ctrl-+ or Ctrl-Shift-A = Approve.
				wpgpt_save( event.target.closest( '.editor-panel' ).querySelector( '.approve' ) );
			} else if ( 'enabled' === wpgpt_settings.shortcuts.state && ( ( 106 === event.keyCode && event.ctrlKey ) || ( 70 === event.keyCode && event.shiftKey && event.ctrlKey ) ) ) { // Ctrl-* (NumPad) or Ctrl-Shift-F = Fuzzy.
				const fuzzy = event.target.closest( '.editor-panel' ).querySelector( '.fuzzy' );
				fuzzy && fuzzy.click();
			} else {
				return original.apply( $gp.editor, arguments );
			}
			return false;
		};
	} )( $gp.editor.keydown );
}

/**
*                         wpgpt_next_is_strict = true  wpgpt_next_is_strict = false
* warnings_passd = true   false && true = FALSE        false && false = FALSE
* warnings_passd = false  true && true = TRUE          true && false = FALSE
*/
function wpgpt_save( save, forced_save = false ) {
	if ( forced_save ) {
		wpgpt_next_is_strict = false;
	}
	if ( wpgpt_checks_shortcuts && ! wpgpt_check_this_translation( `#${$gp.editor.current.attr( 'id' )}`, `#${$gp.editor.current.attr( 'id' ).replace( 'editor', 'preview' )}` ) && wpgpt_next_is_strict ) {
		$gp.notices.error( wpgpt_error_message );
		return false;
	} else {
		document.querySelectorAll( '.wpgpt-ignore-warnings input' ).forEach( ( check ) => { check.checked = false; } );
		wpgpt_user_edited = false;
		save.click();
	}
	wpgpt_next_is_strict = true;
}
